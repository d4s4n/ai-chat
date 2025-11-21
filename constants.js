const PLUGIN_OWNER_ID = 'plugin:ai-chat';

const PERMISSIONS = {
    AI: 'user.ai',
    AI_NOCD: 'user.ainocd',
    GPTMODE: 'admin.gpt'
};

const MESSAGES = {
    MODE_CURRENT: '&aВаш режим: &e{mode}',
    MODE_PLAYER: '&aРежим &e{playername}: &e{mode}',
    MODE_CHANGED_SELF: '&aВаш режим изменён на &e{modename}',
    MODE_CHANGED_OTHER: '&aРежим &e{playername} изменён на &e{modename}',
    MODE_INVALID: '&c- &e{modename}&c | Доступные режимы: &e{modes}',
    NO_PLAYER: '&cИгрок &e{playername}&c не найден или данных нет.',
    FALLBACK_PROMPT: 'Ты — полезный ИИ-бот в игре Minecraft. Отвечай коротко и дружелюбно.'
};

module.exports = { PLUGIN_OWNER_ID, PERMISSIONS, MESSAGES };