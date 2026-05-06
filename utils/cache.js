// Cache em memória com TTL simples.
// Em produção com múltiplos processos/instâncias, substituir por Redis.
class Cache {
    constructor() {
        this._store = new Map();
    }

    set(key, value, ttlMs) {
        this._store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }

    get(key) {
        const entry = this._store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this._store.delete(key);
            return undefined;
        }
        return entry.value;
    }

    del(key) {
        this._store.delete(key);
    }

    // Remove todas as entradas que começam com o prefixo (útil para invalidar grupos)
    delByPrefix(prefix) {
        for (const key of this._store.keys()) {
            if (key.startsWith(prefix)) this._store.delete(key);
        }
    }
}

module.exports = new Cache();
