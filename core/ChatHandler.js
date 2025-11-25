const { PERMISSIONS, MESSAGES } = require('../constants');
const { clearBadSymbols } = require('../utils/textUtils.js');

function createChatHandler(bot, settings, config, aiClient, store, promptsData) {
    const cooldowns = new Map();
    const processingUsers = new Set();
    const triggerWords = (config.triggerWords || []).map(w => w.toLowerCase());
    const allowedChatTypes = settings.allowedChatTypes || ['clan', 'chat'];
    const nearbyChatEnabled = settings.nearbyChat || false;
    const nearbyChatRadius = settings.nearbyChatRadius || 4;

    function replacePlaceholders(prompt, username, chatType) {
        const now = new Date();
        const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const date = now.toLocaleDateString('ru-RU');

        return prompt
            .replace(/{username}/g, username)
            .replace(/{user}/g, username)
            .replace(/{chatType}/g, chatType)
            .replace(/{time}/g, time)
            .replace(/{date}/g, date)
            .replace(/{datetime}/g, `${date} ${time}`);
    }

    function isPlayerLookingAtBot(playerEntity) {
        if (!playerEntity || !bot.entity) return false;

        const dx = bot.entity.position.x - playerEntity.position.x;
        const dy = bot.entity.position.y - playerEntity.position.y;
        const dz = bot.entity.position.z - playerEntity.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance > nearbyChatRadius) return false;

        const angleToBot = Math.atan2(-dx, -dz);
        const playerYaw = playerEntity.yaw;

        let angleDiff = Math.abs(angleToBot - playerYaw);
        angleDiff = Math.min(angleDiff, 2 * Math.PI - angleDiff);

        const lookingThreshold = Math.PI / 4;
        return angleDiff < lookingThreshold;
    }

    return async (data) => {
        const { username, message, type } = data;

        if (username.toLowerCase() === bot.username.toLowerCase()) {
            return;
        }

        if (!allowedChatTypes.includes(type)) {
            return;
        }

        const lowerMessage = message.toLowerCase().trim();
        const userKey = username.toLowerCase();

        const foundTrigger = triggerWords.find(trigger => lowerMessage.startsWith(trigger));

        const user = await bot.api.getUser(username);
        if (!user) return;

        const hasAiPermission = user.hasPermission(PERMISSIONS.AI);
        const hasNoCooldownPermission = user.hasPermission(PERMISSIONS.AI_NOCD);
        const hasNearbyPermission = user.hasPermission(PERMISSIONS.AI_NEARBY);

        let isNearbyInteraction = false;
        if (!foundTrigger && nearbyChatEnabled && hasNearbyPermission) {
            const playerEntity = bot.players[username]?.entity;
            if (playerEntity && isPlayerLookingAtBot(playerEntity)) {
                isNearbyInteraction = true;
            } else {
                return;
            }
        } else if (!foundTrigger) {
            return;
        }

        if (!isNearbyInteraction && !hasAiPermission && !hasNoCooldownPermission) return;

        if (processingUsers.has(userKey)) {
            bot.api.sendMessage(type, settings.thinkingMessage, username);
            return;
        }

        if (!hasNoCooldownPermission) {
            const now = Date.now();
            const lastUsed = cooldowns.get(userKey) || 0;
            const cooldownDuration = (config.cooldown || 10) * 1000;

            if (now - lastUsed < cooldownDuration) {
                const timeLeft = Math.ceil((cooldownDuration - (now - lastUsed)) / 1000);
                const cooldownMessage = (settings.cooldownMessage || "Подождите еще {timeLeft} сек.").replace('{timeLeft}', timeLeft);
                bot.api.sendMessage(type, cooldownMessage, username);
                return;
            }
        }

        let prompt;
        if (isNearbyInteraction) {
            prompt = message.trim();
        } else {
            prompt = message.substring(foundTrigger.length).trim();
        }

        if (!prompt) {
            bot.api.sendMessage(type, settings.noPromptMessage, username);
            return;
        }

        processingUsers.add(userKey);

        try {
            const modeKey = `ai:mode:${userKey}`;
            const mode = store ? await store.get(modeKey) || 'default' : 'default';
            let systemPrompt = promptsData[mode] || promptsData.default || MESSAGES.FALLBACK_PROMPT;
            systemPrompt = replacePlaceholders(systemPrompt, username, type);

            const botResponseContent = await aiClient.chat(prompt, username, systemPrompt);

            if (!botResponseContent) {
                throw new Error('Получен пустой ответ от AI API.');
            }

            let botResponse = botResponseContent;
            if (settings.clearBadSymbols) {
                botResponse = clearBadSymbols(botResponse);
            }
            if (botResponse.length > 250) {
                botResponse = botResponse.substring(0, 247) + '...';
            }
            
            bot.api.sendMessage(type, botResponse, username);

        } catch (error) {
            bot.sendLog(`[ai-chat] Ошибка API: ${error.message}`);
            bot.api.sendMessage(type, 'Извините, у меня возникли технические неполадки.', username);
            console.log(error);
        } finally {
            if (!user.hasPermission(PERMISSIONS.AI_NOCD)) {
                cooldowns.set(userKey, Date.now());
            }
            processingUsers.delete(userKey);
        }
    };
}

module.exports = createChatHandler;