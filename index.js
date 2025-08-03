const AiClientFactory = require('./core/AiClientFactory.js');
const createChatHandler = require('./core/ChatHandler.js');
const ProxyValidator = require('./core/ProxyValidator.js');

const PLUGIN_OWNER_ID = 'plugin:ai-chat';

async function onLoad(bot, options) {
    const log = bot.sendLog;
    const { settings } = options;
    const config = settings.aiProviderConfig || {};

    try {
        const aiClient = AiClientFactory.createClient(config, settings.useHistory);
        if (!aiClient) {
            log(`[${PLUGIN_OWNER_ID}] Не удалось инициализировать AI клиент. Проверьте конфигурацию.`);
            return;
        }

        await bot.api.registerPermissions([
            {
                name: 'user.ai',
                description: 'Доступ к общению с ИИ-ботом',
                owner: PLUGIN_OWNER_ID
            },
            {
                name: 'user.ainocd',
                description: 'Доступ к общению с ИИ-ботом без кулдауна',
                owner: PLUGIN_OWNER_ID
            }
        ]);

        if (bot.api.installedPlugins.includes('clan-role-manager')) {
            await bot.api.addPermissionsToGroup('Member', ['user.ai']);
        }

        await bot.api.addPermissionsToGroup('Admin', ['user.ainocd']);
        

        const chatHandler = createChatHandler(bot, settings, config, aiClient);
        bot.events.on('chat:message', chatHandler);

        bot.once('end', () => {
            bot.events.removeListener('chat:message', chatHandler);
        });

        const triggerWords = (config.triggerWords || []).join(', ');
        let logMessage = `[${PLUGIN_OWNER_ID}] Плагин успешно загружен. Провайдер: ${config.provider}. Триггеры: ${triggerWords}`;
        
        const providerConfig = config.providers?.[config.provider];
        if (providerConfig?.proxy?.enabled) {
            const validation = ProxyValidator.validate(providerConfig.proxy);
            if (validation.isValid) {
                const formattedInfo = ProxyValidator.formatProxyInfo(providerConfig.proxy);
                logMessage += `. Прокси: ${formattedInfo}`;
            } else {
                logMessage += `. Ошибка прокси: ${validation.message}`;
            }
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