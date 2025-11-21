const { PLUGIN_OWNER_ID, PERMISSIONS, MESSAGES } = require('./constants');
const AiClientFactory = require('./core/AiClientFactory.js');
const createChatHandler = require('./core/ChatHandler.js');
const ProxyValidator = require('./core/ProxyValidator.js');
const createGptModeCommand = require('./commands/gptmode');

async function onLoad(bot, options) {
    const log = bot.sendLog;
    const { settings, store } = options;
    const config = settings.aiProviderConfig || {};
    const promptsData = settings.prompts || { default: 'Ты — полезный ИИ-бот в игре Minecraft. Отвечай коротко и дружелюбно.' };
    const proxyConfig = settings.proxy;

    try {
        if (proxyConfig?.enabled) {
            const validation = ProxyValidator.validate(proxyConfig);
            if (!validation.isValid) {
                log(`[${PLUGIN_OWNER_ID}] Ошибка прокси: ${validation.message}`);
            }
        }

        const aiClient = AiClientFactory.createClient(config, settings.useHistory, proxyConfig);
        if (!aiClient) {
            log(`[${PLUGIN_OWNER_ID}] Не удалось инициализировать AI клиент. Проверьте конфигурацию.`);
            return;
        }

        await bot.api.registerPermissions([
            {
                name: PERMISSIONS.AI,
                description: 'Доступ к общению с ИИ-ботом',
                owner: PLUGIN_OWNER_ID
            },
            {
                name: PERMISSIONS.AI_NOCD,
                description: 'Доступ к общению с ИИ-ботом без кулдауна',
                owner: PLUGIN_OWNER_ID
            },
            {
                name: PERMISSIONS.GPTMODE,
                description: 'Управление режимами ИИ-чата',
                owner: PLUGIN_OWNER_ID
            }
        ]);

        if (bot.api.installedPlugins.includes('clan-role-manager')) {
            await bot.api.addPermissionsToGroup('Member', [PERMISSIONS.AI]);
        }

        await bot.api.addPermissionsToGroup('Admin', [PERMISSIONS.AI_NOCD, PERMISSIONS.GPTMODE]);

        const chatHandler = createChatHandler(bot, settings, config, aiClient, store, promptsData);
        bot.events.on('chat:message', chatHandler);

        const GptModeCommand = createGptModeCommand(bot, store, promptsData);
        await bot.api.registerCommand(new GptModeCommand(settings));

        bot.once('end', () => {
            bot.events.removeListener('chat:message', chatHandler);
        });

        const triggerWords = (config.triggerWords || []).join(', ');
        let logMessage = `[${PLUGIN_OWNER_ID}] Плагин успешно загружен v2.0.2. Провайдер: ${config.provider}. Триггеры: ${triggerWords}`;

        if (proxyConfig?.enabled) {
            const formattedInfo = ProxyValidator.formatProxyInfo(proxyConfig);
            logMessage += `. Прокси: ${formattedInfo}`;
        }

        log(logMessage);

    } catch (error) {
        log(`[${PLUGIN_OWNER_ID}] Ошибка при загрузке: ${error.message}`);
    }
}

async function onUnload({ botId, prisma }) {
    console.log(`[${PLUGIN_OWNER_ID}] Удаление ресурсов для бота ID: ${botId}`);
    try {
        await prisma.permission.deleteMany({
            where: { botId, owner: PLUGIN_OWNER_ID }
        });
        console.log(`[${PLUGIN_OWNER_ID}] Права плагина удалены.`);
    } catch (error) {
        console.error(`[${PLUGIN_OWNER_ID}] Ошибка при очистке ресурсов:`, error);
    }
}

module.exports = { onLoad, onUnload };
