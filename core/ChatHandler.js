const { PERMISSIONS, MESSAGES } = require('../constants');
const { clearBadSymbols } = require('../utils/textUtils.js');

function createChatHandler(bot, settings, config, aiClient, store, promptsData) {
    const cooldowns = new Map();
    const processingUsers = new Set();
    const triggerWords = (config.triggerWords || []).map(w => w.toLowerCase());
    const allowedChatTypes = settings.allowedChatTypes || ['clan', 'chat'];

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
        if (!foundTrigger) return;

        const user = await bot.api.getUser(username);
        if (!user) return;

        const hasAiPermission = user.hasPermission(PERMISSIONS.AI);
        const hasNoCooldownPermission = user.hasPermission(PERMISSIONS.AI_NOCD);
        
        if (!hasAiPermission && !hasNoCooldownPermission) return;

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

        const prompt = message.substring(foundTrigger.length).trim();
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