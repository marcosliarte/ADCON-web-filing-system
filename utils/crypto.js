const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
        throw new Error('ENCRYPTION_KEY inválida. Deve ser uma string hex de 64 caracteres (32 bytes).');
    }
    return Buffer.from(key, 'hex');
}

// Retorna string no formato "iv:authTag:dados" (tudo em hex)
function encrypt(text) {
    if (!text) return null;
    const key = getKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

// Aceita formato "iv:authTag:dados". Se não estiver nesse formato, assume plain text legado.
function decrypt(encryptedText) {
    if (!encryptedText) return null;
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText; // legado: retorna como está
    const [ivHex, authTagHex, dataHex] = parts;
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
