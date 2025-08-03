class ProxyValidator {
    static validate(proxyConfig) {
        if (!proxyConfig || !proxyConfig.enabled) {
            return { isValid: true, message: 'Прокси отключен' };
        }

        if (!proxyConfig.host) {
            return { isValid: false, message: 'Хост прокси не указан' };
        }

        if (!proxyConfig.port) {
            return { isValid: false, message: 'Порт прокси не указан' };
        }

        const port = parseInt(proxyConfig.port);
        if (isNaN(port) || port < 1 || port > 65535) {
            return { 
                isValid: false, 
                message: 'Некорректный порт прокси' 
            };
        }

        if (proxyConfig.host.trim() === '') {
            return { 
                isValid: false, 
                message: 'Хост прокси не может быть пустым' 
            };
        }

        return { 
            isValid: true, 
            message: `Прокси настроен: ${proxyConfig.host}:${proxyConfig.port}` 
        };
    }

    static formatProxyInfo(proxyConfig) {
        if (!proxyConfig || !proxyConfig.enabled) {
            return 'Прокси отключен';
        }

        let info = `${proxyConfig.host}:${proxyConfig.port}`;
        
        if (proxyConfig.user) {
            info = `${proxyConfig.user}:***@${info}`;
        }

        return info;
    }

    static needsAuthentication(proxyConfig) {
        if (!proxyConfig || !proxyConfig.enabled) {
            return false;
        }

        return !!(proxyConfig.user && proxyConfig.pass);
    }

    static createProxyObject(proxyConfig) {
        if (!proxyConfig || !proxyConfig.enabled) {
            return null;
        }

        const proxy = {
            host: proxyConfig.host,
            port: proxyConfig.port
        };

        if (proxyConfig.user) {
            proxy.user = proxyConfig.user;
        }

        if (proxyConfig.pass) {
            proxy.pass = proxyConfig.pass;
        }

        return proxy;
    }
}

module.exports = ProxyValidator; 