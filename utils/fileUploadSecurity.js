// utils/fileUploadSecurity.js - Segurança para upload de arquivos

const path = require('path');
const multer = require('multer');
const securityConfig = require('../config/security');

/**
 * Valida extensão de arquivo contra whitelist
 * @param {string} filename - Nome do arquivo
 * @param {RegExp} allowedTypes - Regex de tipos permitidos
 * @returns {boolean}
 */
function validateFileExtension(filename, allowedTypes) {
  const ext = path.extname(filename).toLowerCase();
  return allowedTypes.test(ext.substring(1)); // Remove o ponto inicial
}

/**
 * Valida MIME type contra whitelist
 * @param {string} mimetype - MIME type do arquivo
 * @param {RegExp} allowedTypes - Regex de tipos permitidos
 * @returns {boolean}
 */
function validateMimeType(mimetype, allowedTypes) {
  // Extrai a parte após a barra (ex: "image/jpeg" -> "jpeg")
  const type = mimetype.split('/')[1];
  return allowedTypes.test(type);
}

/**
 * Sanitiza nome de arquivo removendo caracteres perigosos
 * @param {string} filename - Nome do arquivo original
 * @returns {string} - Nome sanitizado
 */
function sanitizeFilename(filename) {
  // Remove path traversal
  let safe = path.basename(filename);
  
  // Remove caracteres especiais perigosos, mantém apenas alfanuméricos, hífen, underscore e ponto
  safe = safe.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  
  // Remove múltiplos pontos consecutivos (possível tentativa de path traversal)
  safe = safe.replace(/\.{2,}/g, '.');
  
  // Garante que não começa com ponto (arquivo oculto)
  if (safe.startsWith('.')) {
    safe = '_' + safe;
  }
  
  // Limita o tamanho do nome
  if (safe.length > 200) {
    const ext = path.extname(safe);
    safe = safe.substring(0, 200 - ext.length) + ext;
  }
  
  return safe;
}

/**
 * Gera nome de arquivo único e seguro
 * @param {string} originalname - Nome original do arquivo
 * @param {string} userId - ID do usuário (opcional)
 * @returns {string} - Nome único e seguro
 */
function generateSafeFilename(originalname, userId = null) {
  const sanitized = sanitizeFilename(originalname);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = path.extname(sanitized);
  const basename = path.basename(sanitized, ext);
  
  const prefix = userId ? `${userId}_` : '';
  return `${prefix}${basename}_${timestamp}_${random}${ext}`;
}

/**
 * Cria configuração segura de storage para multer
 * @param {string} destination - Pasta de destino
 * @param {Object} options - Opções adicionais
 * @param {boolean} options.includeUserId - Se deve incluir ID do usuário no nome
 * @returns {Object} - Configuração do multer storage
 */
function createSecureStorage(destination, options = {}) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      // Valida que o destino não contém path traversal
      const safeDest = path.resolve(destination);
      if (!safeDest.startsWith(path.resolve(__dirname, '..'))) {
        return cb(new Error('Destino de upload inválido'));
      }
      cb(null, safeDest);
    },
    filename: (req, file, cb) => {
      try {
        const userId = options.includeUserId && req.usuario ? req.usuario.id : null;
        const safeName = generateSafeFilename(file.originalname, userId);
        cb(null, safeName);
      } catch (err) {
        cb(err);
      }
    },
  });
}

/**
 * Cria middleware de upload com validação de segurança
 * @param {Object} config - Configuração
 * @param {string} config.destination - Pasta de destino
 * @param {number} config.maxSize - Tamanho máximo em bytes
 * @param {RegExp} config.allowedTypes - Tipos permitidos (regex)
 * @param {string} config.errorMessage - Mensagem de erro customizada
 * @param {boolean} config.includeUserId - Incluir ID do usuário no nome
 * @returns {Object} - Middleware multer configurado
 */
function createSecureUpload(config) {
  const {
    destination,
    maxSize,
    allowedTypes,
    errorMessage = 'Tipo de arquivo não permitido',
    includeUserId = false,
  } = config;

  return multer({
    storage: createSecureStorage(destination, { includeUserId }),
    limits: {
      fileSize: maxSize,
      files: 1, // Apenas 1 arquivo por vez (pode ser ajustado)
    },
    fileFilter: (req, file, cb) => {
      // Valida extensão
      const validExtension = validateFileExtension(file.originalname, allowedTypes);
      
      // Valida MIME type
      const validMimeType = validateMimeType(file.mimetype, allowedTypes);
      
      if (!validExtension || !validMimeType) {
        console.warn(`⚠️ Upload rejeitado: ${file.originalname} (${file.mimetype})`);
        return cb(new Error(errorMessage), false);
      }
      
      // Valida tamanho do nome do arquivo
      if (file.originalname.length > 255) {
        return cb(new Error('Nome do arquivo muito longo'), false);
      }
      
      cb(null, true);
    },
  });
}

/**
 * Configurações pré-definidas para tipos comuns de upload
 */
const uploadPresets = {
  profilePic: createSecureUpload({
    destination: path.join(__dirname, '../uploads/profile-pics'),
    maxSize: securityConfig.upload.profilePic.maxSize,
    allowedTypes: securityConfig.upload.profilePic.allowedTypes,
    errorMessage: 'Apenas imagens são permitidas (JPEG, PNG, GIF, WebP)',
    includeUserId: true,
  }),
  
  documents: createSecureUpload({
    destination: path.join(__dirname, '../uploads/documentos_empresa'),
    maxSize: securityConfig.upload.maxFileSize,
    allowedTypes: securityConfig.upload.allowedDocumentTypes,
    errorMessage: 'Apenas documentos são permitidos (PDF, DOC, DOCX, XLS, XLSX)',
    includeUserId: false,
  }),
  
  certificates: createSecureUpload({
    destination: path.join(__dirname, '../uploads/certificados'),
    maxSize: securityConfig.upload.maxFileSize,
    allowedTypes: /pdf|jpg|jpeg|png/,
    errorMessage: 'Apenas PDF ou imagens são permitidos',
    includeUserId: false,
  }),
};

/**
 * Middleware para validar que arquivo foi enviado
 */
function requireFile(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ msg: 'Nenhum arquivo enviado' });
  }
  next();
}

module.exports = {
  validateFileExtension,
  validateMimeType,
  sanitizeFilename,
  generateSafeFilename,
  createSecureStorage,
  createSecureUpload,
  uploadPresets,
  requireFile,
};
