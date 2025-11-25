const jwt = require('jsonwebtoken');
const Usuario = require('../models/model-usuario');

module.exports = function (req, res, next) {
  // Obter o token do cabeçalho
  const token = req.header('x-auth-token');

  // Verificar se não há token
  if (!token) {
    return res.status(401).json({ msg: 'Nenhum token, autorização negada' });
  }

  // Verificar token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
    res.status(401).json({ msg: 'Token inválido' });
  }
};