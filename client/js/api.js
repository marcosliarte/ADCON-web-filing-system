/* ========================================
   API UTILITIES - Centralized API calls
   ======================================== */

// Configuração base da API
const API_CONFIG = {
    baseURL: `http://${window.location.hostname}:3000/api`,
    timeout: 30000, // 30 segundos
};

/**
 * Classe para gerenciar chamadas à API
 */
class APIClient {
    constructor(config) {
        this.baseURL = config.baseURL;
        this.timeout = config.timeout;
    }

    /**
     * Obter token do localStorage
     */
    getToken() {
        return localStorage.getItem('token');
    }

    /**
     * Headers padrão para requisições
     */
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (includeAuth) {
            const token = this.getToken();
            if (token) {
                headers['x-auth-token'] = token;
            }
        }

        return headers;
    }

    /**
     * Fazer requisição HTTP
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: this.getHeaders(options.auth !== false),
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(url, {
                ...config,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const data = await response.json();

            if (!response.ok) {
                // Tratar erro de autenticação
                if (response.status === 401) {
                    this.handleUnauthorized();
                }
                throw new APIError(data.msg || 'Erro na requisição', response.status, data);
            }

            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new APIError('Tempo de requisição esgotado', 408);
            }
            throw error;
        }
    }

    /**
     * GET request
     */
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    /**
     * POST request
     */
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    /**
     * Upload de arquivo
     */
    async uploadFile(endpoint, formData) {
        const url = `${this.baseURL}${endpoint}`;
        const token = this.getToken();

        const headers = {};
        if (token) {
            headers['x-auth-token'] = token;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData, // FormData já tem Content-Type correto
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                this.handleUnauthorized();
            }
            throw new APIError(data.msg || 'Erro no upload', response.status, data);
        }

        return data;
    }

    /**
     * Tratar erro de não autorizado
     */
    handleUnauthorized() {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    }
}

/**
 * Classe de erro da API
 */
class APIError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

// Instância global do cliente API
const api = new APIClient(API_CONFIG);

// Exportar para uso global
window.api = api;
window.APIError = APIError;
