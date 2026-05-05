// config/security.js - Configurações centralizadas de segurança

require('dotenv').config();

module.exports = {
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200, // 200 requisições por janela
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX) || 5, // 5 tentativas
    },
  },

  // Upload de Arquivos
  upload: {
    maxFileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024, // MB para bytes
    allowedImageTypes: /jpeg|jpg|png|gif|webp/,
    allowedDocumentTypes: /pdf|doc|docx|xls|xlsx/,
    profilePic: {
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: /jpeg|jpg|png|gif|webp/,
    },
  },

  // MongoDB
  mongodb: {
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      minPoolSize: 2,
    },
  },

  // CORS — em produção, defina CORS_ORIGIN no .env (ex: "https://meudominio.com")
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
      : (process.env.NODE_ENV === 'production' ? false : '*'),
    credentials: true,
  },

  // Senha
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false, // Pode ser true para maior segurança
    saltRounds: 10,
  },

  // Validação
  validation: {
    // Regex para validar nomes de arquivos seguros (sem path traversal)
    safeFilename: /^[a-zA-Z0-9_\-\.]+$/,
    // Regex para validar paths seguros
    safePath: /^[a-zA-Z0-9_\-\/\\\.]+$/,
  },
};
