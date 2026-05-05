// Blacklist de tokens JWT revogados (logout, troca de senha, etc.)
// Em produção: substituir por Redis para persistência entre reinicializações e múltiplos processos.
const blacklist = new Set();

// Limpeza automática a cada hora para evitar crescimento ilimitado em memória.
// Remove tokens que com certeza já expiraram (>= 24h, valor do JWT_EXPIRES_IN padrão).
setInterval(() => {
    const cutoff = Date.now() - 25 * 60 * 60 * 1000; // 25h de margem
    for (const entry of blacklist) {
        const [, ts] = entry.split('|');
        if (parseInt(ts, 10) < cutoff) blacklist.delete(entry);
    }
}, 60 * 60 * 1000);

module.exports = {
    add(token) {
        blacklist.add(`${token}|${Date.now()}`);
    },
    has(token) {
        for (const entry of blacklist) {
            if (entry.startsWith(`${token}|`)) return true;
        }
        return false;
    },
};
