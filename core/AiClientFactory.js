const fs = require('fs');
const { OpenRouterClient, MemoryHistoryStorage } = require('openrouter-kit');
const { GeminiClient } = require('google-ai-kit');
const ProxyValidator = require('./ProxyValidator.js');

class AiClientFactory {
    static createClient(config, useHistory, proxyConfig) {
        const { provider, providers } = config;
        if (!provider || !providers || !providers[provider]) {
            throw new Error(`Провайдер "${provider}" не найден или не сконфигурирован.`);
        }

        if (proxyConfig?.enabled) {
            const validation = ProxyValidator.validate(proxyConfig);
            if (!validation.isValid) {
                throw new Error(`Ошибка конфигурации прокси: ${validation.message}`);
            }
        }

        const providerConfig = providers[provider];

        switch (provider) {
            case 'openrouter':
                return this._createOpenRouterAdapter(providerConfig, useHistory, proxyConfig);
            case 'google':
                return this._createGoogleAiAdapter(providerConfig, useHistory, proxyConfig);
            default:
                throw new Error(`Неподдерживаемый провайдер: ${provider}`);
        }
    }

    static _createOpenRouterAdapter(config, useHistory, proxyConfig) {
        if (!config.apiKey) throw new Error('API ключ для OpenRouter не указан.');
        
        const clientConfig = {
            apiKey: config.apiKey,
            model: config.model,
            historyAdapter: useHistory ? new MemoryHistoryStorage() : undefined,
        };

        if (proxyConfig?.enabled) {
            const proxyObject = ProxyValidator.createProxyObject(proxyConfig);
            if (proxyObject) {
                clientConfig.proxy = proxyObject;
            }
        }

        const client = new OpenRouterClient(clientConfig);

        return {
            async chat(prompt, user, customSystemPrompt) {
                const systemPrompt = customSystemPrompt || "Ты — полезный ИИ-бот в игре Minecraft. Отвечай коротко и дружелюбно.";
                const response = await client.chat({
                    systemPrompt: systemPrompt,
                    prompt,
                    user,
                    temperature: config.temperature,
                    max_tokens: config.maxTokens,
                });
                return response?.content || null;
            }
        };
    }

    static _createGoogleAiAdapter(config, useHistory, proxyConfig) {
        if (!config.apiKeys || config.apiKeys.length === 0) {
            throw new Error('API ключи для Google AI не указаны.');
        }

        const clientConfig = {
            apiKeys: config.apiKeys,
            defaultModel: config.model,
            messageStoreConfig: useHistory ? { type: 'memory' } : undefined,
        };

        if (proxyConfig?.enabled) {
            const proxyObject = ProxyValidator.createProxyObject(proxyConfig);
            if (proxyObject) {
                clientConfig.proxy = proxyObject;
            }
        }

        const client = new GeminiClient(clientConfig);

        return {
            async chat(prompt, user, customSystemPrompt) {
                const systemPrompt = customSystemPrompt || "Ты — полезный ИИ-бот в игре Minecraft. Отвечай коротко и дружелюбно.";
                const response = await client.generateContent({
                    systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
                    prompt,
                    user,
                    generationConfig: {
                        temperature: config.temperature,
                        maxOutputTokens: config.maxTokens,
                    },
                });
                return response.text();
            }
        };
    }
}

module.exports = AiClientFactory;