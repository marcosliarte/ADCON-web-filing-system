// middleware/validators.js - Validadores reutilizáveis

const { check, validationResult } = require('express-validator');
const securityConfig = require('../config/security');

/**
 * Middleware para verificar erros de validação
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      msg: 'Erro de validação',
      errors: errors.array() 
    });
  }
  next();
};

/**
 * Validação de senha forte
 */
const passwordValidation = () => {
  const { minLength, requireUppercase, requireLowercase, requireNumbers, requireSpecialChars } = 
    securityConfig.password;

  let message = `A senha deve ter pelo menos ${minLength} caracteres`;
  
  if (requireUppercase) message += ', incluir letras maiúsculas';
  if (requireLowercase) message += ', incluir letras minúsculas';
  if (requireNumbers) message += ', incluir números';
  if (requireSpecialChars) message += ', incluir caracteres especiais';

  return check('senha')
    .isLength({ min: minLength })
    .withMessage(message)
    .custom((value) => {
      if (requireUppercase && !/[A-Z]/.test(value)) {
        throw new Error('A senha deve conter pelo menos uma letra maiúscula');
      }
      if (requireLowercase && !/[a-z]/.test(value)) {
        throw new Error('A senha deve conter pelo menos uma letra minúscula');
      }
      if (requireNumbers && !/\d/.test(value)) {
        throw new Error('A senha deve conter pelo menos um número');
      }
      if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
        throw new Error('A senha deve conter pelo menos um caractere especial');
      }
      return true;
    });
};

/**
 * Validadores para autenticação
 */
const authValidators = {
  register: [
    check('nome')
      .trim()
      .notEmpty().withMessage('O nome é obrigatório')
      .isLength({ min: 3, max: 100 }).withMessage('Nome deve ter entre 3 e 100 caracteres')
      .matches(/^[a-zA-ZÀ-ÿ\s]+$/).withMessage('Nome deve conter apenas letras'),
    
    check('email')
      .trim()
      .notEmpty().withMessage('O email é obrigatório')
      .isEmail().withMessage('Email inválido')
      .normalizeEmail(),
    
    passwordValidation(),
    
    check('role')
      .optional()
      .isIn(['admin', 'gerente', 'funcionario', 'empresario'])
      .withMessage('Tipo de usuário inválido'),
    
    validate,
  ],

  login: [
    check('email')
      .trim()
      .notEmpty().withMessage('O email é obrigatório')
      .isEmail().withMessage('Email inválido')
      .normalizeEmail(),
    
    check('senha')
      .notEmpty().withMessage('A senha é obrigatória'),
    
    validate,
  ],

  updatePassword: [
    check('senhaAtual')
      .notEmpty().withMessage('Senha atual é obrigatória'),
    
    passwordValidation(),
    
    check('senhaConfirmacao')
      .custom((value, { req }) => value === req.body.senha)
      .withMessage('As senhas não coincidem'),
    
    validate,
  ],
};

/**
 * Validadores para empresas
 */
const empresaValidators = {
  create: [
    check('nome')
      .trim()
      .notEmpty().withMessage('Nome da empresa é obrigatório')
      .isLength({ min: 3, max: 200 }).withMessage('Nome deve ter entre 3 e 200 caracteres'),
    
    check('cnpj')
      .trim()
      .notEmpty().withMessage('CNPJ é obrigatório')
      .matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/)
      .withMessage('CNPJ inválido (formato: 00.000.000/0000-00)'),
    
    check('email')
      .optional()
      .trim()
      .isEmail().withMessage('Email inválido')
      .normalizeEmail(),
    
    check('telefone')
      .optional()
      .trim()
      .matches(/^\(\d{2}\)\s?\d{4,5}-\d{4}$/)
      .withMessage('Telefone inválido (formato: (00) 00000-0000)'),
    
    validate,
  ],

  update: [
    check('nome')
      .optional()
      .trim()
      .isLength({ min: 3, max: 200 }).withMessage('Nome deve ter entre 3 e 200 caracteres'),
    
    check('email')
      .optional()
      .trim()
      .isEmail().withMessage('Email inválido')
      .normalizeEmail(),
    
    check('telefone')
      .optional()
      .trim()
      .matches(/^\(\d{2}\)\s?\d{4,5}-\d{4}$/)
      .withMessage('Telefone inválido'),
    
    validate,
  ],
};

/**
 * Validador de ObjectId do MongoDB
 */
const validateObjectId = (paramName = 'id') => [
  check(paramName)
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('ID inválido'),
  validate,
];

/**
 * Sanitizador de filename (previne path traversal)
 */
const sanitizeFilename = (filename) => {
  if (!filename) return null;
  
  // Remove caracteres perigosos
  let safe = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  
  // Remove sequências de path traversal
  safe = safe.replace(/\.\./g, '');
  
  // Remove paths absolutos
  safe = safe.replace(/^[\/\\]+/, '');
  
  // Limita o tamanho
  if (safe.length > 255) {
    const ext = safe.substring(safe.lastIndexOf('.'));
    safe = safe.substring(0, 255 - ext.length) + ext;
  }
  
  return safe;
};

/**
 * Validador de datas
 */
const dateValidators = {
  futureDate: (fieldName) => 
    check(fieldName)
      .isISO8601()
      .withMessage('Data inválida')
      .custom((value) => {
        if (new Date(value) <= new Date()) {
          throw new Error('Data deve ser futura');
        }
        return true;
      }),
  
  pastDate: (fieldName) =>
    check(fieldName)
      .isISO8601()
      .withMessage('Data inválida')
      .custom((value) => {
        if (new Date(value) >= new Date()) {
          throw new Error('Data deve ser passada');
        }
        return true;
      }),
};

module.exports = {
  validate,
  passwordValidation,
  authValidators,
  empresaValidators,
  validateObjectId,
  sanitizeFilename,
  dateValidators,
};
