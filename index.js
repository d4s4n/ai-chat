const {
    OpenRouterClient,
    MemoryHistoryStorage
} = require('openrouter-kit');

const PLUGIN_OWNER_ID = 'plugin:ai-chat';

function clearBadSymbols(text) {
    if (typeof text !== 'string') return text;
    let cleanedText = text.replace(/(?![\u0030-\u0039])[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Modifier_Base}\p{Emoji_Component}\u{200D}]/gu, '');
    cleanedText = cleanedText.replace(/(?![\u0030-\u0039])[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu, '');
    return cleanedText.replace(/\s+/g, ' ').trim();
}

async function onLoad(bot, options) {
    const log = bot.sendLog;
    const settings = options.settings;
    const config = settings.aiConfig || {};

    if (!config.apiKey) {
        log(`[${PLUGIN_OWNER_ID}] ВНИМАНИЕ: API ключ не указан в конфигурации. Плагин не будет работать.`);
        return;
    }

    const permissionName = config.permission || 'user.ai.chat';

    const aiClient = new OpenRouterClient({
        apiKey: config.apiKey,
        model: config.model,
        historyAdapter: settings.useHistory ? new MemoryHistoryStorage() : undefined,
    });

    const cooldowns = new Map();
    const processingUsers = new Set();
    const triggerWords = (config.triggerWords || []).map(w => w.toLowerCase());

    const chatHandler = async (data) => {
        const {
            username,
            message,
            type
        } = data;
        const lowerMessage = message.toLowerCase().trim();
        const userKey = username.toLowerCase();

        const foundTrigger = triggerWords.find(trigger => lowerMessage.startsWith(trigger));
        if (!foundTrigger) return;

        const user = await bot.api.getUser(username);
        if (!user || !user.hasPermission(permissionName)) return;

        if (processingUsers.has(userKey)) {
            bot.api.sendMessage(type, settings.thinkingMessage, username);
            return;
        }

        const now = Date.now();
        const lastUsed = cooldowns.get(userKey) || 0;
        const cooldownDuration = (config.cooldown || 20) * 1000;

        if (now - lastUsed < cooldownDuration) {
            const timeLeft = Math.ceil((cooldownDuration - (now - lastUsed)) / 1000);
            const cooldownMessage = (settings.cooldownMessage || "Подождите еще {timeLeft} сек.").replace('{timeLeft}', timeLeft);
            bot.api.sendMessage(type, cooldownMessage, username);
            return;
        }

        const prompt = message.substring(foundTrigger.length).trim();
        if (!prompt) {
            bot.api.sendMessage(type, settings.noPromptMessage, username);
            return;
        }

        processingUsers.add(userKey);

        try {
            const response = await aiClient.chat({
                systemPrompt: config.prompt,
                prompt,
                user: username,
                temperature: config.temperature,
                max_tokens: config.maxTokens,
            });

            if (!response || !response.content) {
                throw new Error('Получен пустой ответ от API.');
            }

            let botResponse = response.content;
            if (settings.clearBadSymbols) {
                botResponse = clearBadSymbols(botResponse);
            }
            if (botResponse.length > 250) {
                botResponse = botResponse.substring(0, 247) + '...';
            }
            bot.api.sendMessage(type, botResponse, username);

        } catch (error) {
            log(`[${PLUGIN_OWNER_ID}] Ошибка API: ${error.message}`);
            bot.api.sendMessage(type, 'Извините, у меня возникли технические неполадки.', username);
        } finally {
            cooldowns.set(userKey, Date.now());
            processingUsers.delete(userKey);
        }
    };

    try {
        await bot.api.registerPermissions([{
            name: permissionName,
            description: 'Доступ к общению с ИИ-ботом',
            owner: PLUGIN_OWNER_ID
        }]);

        if (bot.api.installedPlugins.includes('clan-role-manager')) {
            await bot.api.addPermissionsToGroup('Member', [permissionName]);
        }

        bot.events.on('chat:message', chatHandler);

        bot.once('end', () => {
            bot.events.removeListener('chat:message', chatHandler);
        });

        log(`[${PLUGIN_OWNER_ID}] Плагин успешно загружен. Триггеры: ${triggerWords.join(', ')}`);

    } catch (error) {
        log(`[${PLUGIN_OWNER_ID}] Ошибка при загрузке: ${error.message}`);
    }
}

async function onUnload({
    botId,
    prisma
}) {
    console.log(`[${PLUGIN_OWNER_ID}] Удаление ресурсов для бота ID: ${botId}`);
    try {
        await prisma.permission.deleteMany({
            where: {
                botId,
                owner: PLUGIN_OWNER_ID
            }
        });
        console.log(`[${PLUGIN_OWNER_ID}] Права плагина удалены.`);
    } catch (error) {
        console.error(`[${PLUGIN_OWNER_ID}] Ошибка при очистке ресурсов:`, error);
    }
}

module.exports = {
    onLoad,
    onUnload,
};