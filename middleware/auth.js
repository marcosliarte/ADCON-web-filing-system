const jwt = require('jsonwebtoken');
const Usuario = require('../models/model-usuario');
const tokenBlacklist = require('../utils/tokenBlacklist');

module.exports = function (req, res, next) {
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ msg: 'Nenhum token, autorização negada' });
  }

  // Rejeita tokens que foram explicitamente revogados (logout)
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ msg: 'Token revogado. Faça login novamente.', expired: true });
  }

  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      console.error('⚠️ JWT_SECRET não configurado corretamente!');
      return res.status(500).json({ msg: 'Erro de configuração do servidor' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Validar estrutura do token
    if (!decoded.usuario || !decoded.usuario.id) {
      return res.status(401).json({ msg: 'Token inválido' });
    }

    req.usuario = decoded.usuario;
    
    // Atualiza a última atividade do usuário de forma assíncrona (sem bloquear a requisição)
    Usuario.findByIdAndUpdate(req.usuario.id, { 
      lastActivity: new Date() 
    }).catch(err => {
      // Log silencioso, não queremos interromper a requisição por falha na atualização
      console.error('Erro ao atualizar lastActivity:', err.message);
    });
    
    next();
  } catch (err) {
    // Diferentes tipos de erro JWT
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: 'Token expirado', expired: true });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ msg: 'Token inválido' });
    }
    // Erro genérico
    return res.status(401).json({ msg: 'Falha na autenticação' });
  }
};