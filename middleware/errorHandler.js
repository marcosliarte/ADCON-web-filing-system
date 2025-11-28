// middleware/errorHandler.js - Tratamento centralizado de erros

/**
 * Middleware de tratamento de erros centralizado
 * Previne exposição de stack traces e informações sensíveis
 */

const errorHandler = (err, req, res, next) => {
  // Log do erro (sem expor ao cliente)
  console.error('❌ Erro capturado:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Erros conhecidos do Mongoose
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      msg: 'Erro de validação',
      errors,
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      msg: 'ID inválido',
    });
  }

  if (err.code === 11000) {
    // Erro de duplicação (unique constraint)
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      msg: `${field} já está em uso`,
    });
  }

  // Erros do Multer (upload)
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        msg: 'Arquivo muito grande',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        msg: 'Campo de arquivo inesperado',
      });
    }
    return res.status(400).json({
      msg: 'Erro no upload do arquivo',
    });
  }

  // Erros de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      msg: 'Token inválido',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      msg: 'Token expirado',
      expired: true,
    });
  }

  // Erro genérico
  // IMPORTANTE: Nunca expor detalhes do erro em produção
  res.status(err.statusCode || 500).json({
    msg: err.message || 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * Middleware para rotas não encontradas (404)
 */
const notFound = (req, res, next) => {
  res.status(404).json({
    msg: 'Rota não encontrada',
    path: req.originalUrl,
  });
};

/**
 * Wrapper para funções assíncronas
 * Elimina a necessidade de try-catch em todas as rotas
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler,
};
