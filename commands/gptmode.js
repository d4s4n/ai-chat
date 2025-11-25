const { PERMISSIONS, MESSAGES, PLUGIN_OWNER_ID } = require('../constants.js');

module.exports = (bot, store, promptsData) => {
    class GptModeCommand extends bot.api.Command {
        constructor(settings = {}) {
            super({
                name: 'gptmode',
                aliases: ['gptm', 'mode'],
                description: 'Управление режимами ИИ-чата',
                permissions: PERMISSIONS.GPTMODE,
                owner: PLUGIN_OWNER_ID,
                cooldown: 3,
                allowedChatTypes: ['chat', 'clan'],
                args: [
                    { name: 'target', type: 'string', required: false, description: 'Ник игрока или имя режима (опционально)' },
                    { name: 'modename', type: 'string', required: false, description: 'Имя режима (опционально)' }
                ]
            });
            this.store = store;
            this.bot = bot;
            this.promptsData = promptsData || { default: MESSAGES.FALLBACK_PROMPT };
            this.settings = settings;
        }

        getPrompts() {
            return this.promptsData;
        }

        async handler(bot, typeChat, user, { target, modename }) {
            const prompts = this.getPrompts();
            const modesList = Object.keys(prompts).join(', ');
            const userLower = user.username.toLowerCase();
            const modeKey = `ai:mode:${userLower}`;

            if (!target && !modename) {
                // Показать свой
                const mode = await this.store.get(modeKey) || 'default';
                const msg = MESSAGES.MODE_CURRENT.replace('{mode}', mode);
                bot.api.sendMessage(typeChat, msg, user.username);
                return;
            }

            if (target && !modename) {
                // Один аргумент: сначала проверить как режим (для self), иначе как target player
                if (prompts[target]) {
                    // Это режим — сменить свой
                    await this.store.set(modeKey, target);
                    const msg = MESSAGES.MODE_CHANGED_SELF.replace('{modename}', target);
                    bot.api.sendMessage(typeChat, msg, user.username);
                    this.bot.sendLog(`[ai-chat] ${user.username} сменил свой режим на ${target}`);
                    return;
                } else {
                    // Показать режим игрока target
                    const targetLower = target.toLowerCase();
                    const targetModeKey = `ai:mode:${targetLower}`;
                    const targetUser = await bot.api.getUser(target);
                    if (!targetUser && targetLower !== userLower) {
                        bot.api.sendMessage(typeChat, MESSAGES.NO_PLAYER.replace('{playername}', target), user.username);
                        return;
                    }
                    const mode = await this.store.get(targetModeKey) || 'default';
                    const msg = MESSAGES.MODE_PLAYER.replace('{playername}', target).replace('{mode}', mode);
                    bot.api.sendMessage(typeChat, msg, user.username);
                    return;
                }
            }

            if (!target && modename) {
                // Только modename (маловероятно, но на всякий)
                if (!prompts[modename]) {
                    const msg = MESSAGES.MODE_INVALID.replace('{modename}', modename).replace('{modes}', modesList);
                    bot.api.sendMessage(typeChat, msg, user.username);
                    return;
                }
                await this.store.set(modeKey, modename);
                const msg = MESSAGES.MODE_CHANGED_SELF.replace('{modename}', modename);
                bot.api.sendMessage(typeChat, msg, user.username);
                this.bot.sendLog(`[ai-chat] ${user.username} сменил свой режим на ${modename}`);
                return;
            }

            if (target && modename) {
                // Сменить чужой / свой
                const targetLower = target.toLowerCase();
                if (targetLower === userLower) {
                    // Свой
                    if (!prompts[modename]) {
                        const msg = MESSAGES.MODE_INVALID.replace('{modename}', modename).replace('{modes}', modesList);
                        bot.api.sendMessage(typeChat, msg, user.username);
                        return;
                    }
                    await this.store.set(modeKey, modename);
                    const msg = MESSAGES.MODE_CHANGED_SELF.replace('{modename}', modename);
                    bot.api.sendMessage(typeChat, msg, user.username);
                    return;
                }
                const targetModeKey = `ai:mode:${targetLower}`;
                const targetUser = await bot.api.getUser(target);
                if (!targetUser) {
                    bot.api.sendMessage(typeChat, MESSAGES.NO_PLAYER.replace('{playername}', target), user.username);
                    return;
                }
                if (!prompts[modename]) {
                    const msg = MESSAGES.MODE_INVALID.replace('{modename}', modename).replace('{modes}', modesList);
                    bot.api.sendMessage(typeChat, msg, user.username);
                    return;
                }
                await this.store.set(targetModeKey, modename);
                const msg = MESSAGES.MODE_CHANGED_OTHER.replace('{playername}', target).replace('{modename}', modename);
                bot.api.sendMessage(typeChat, msg, user.username);
                this.bot.sendLog(`[ai-chat] ${user.username} (${PERMISSIONS.GPTMODE}) сменил режим ${target} на ${modename}`);
                return;
            }
        }
    }

    return GptModeCommand;
};