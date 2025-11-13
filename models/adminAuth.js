const Usuario = require('../models/model-usuario');

/**
 * Middleware para verificar se o usuário logado tem permissão de Admin ou Gerente.
 */
module.exports = async function (req, res, next) {
  try {
    const usuario = await Usuario.findById(req.usuario.id);

    // Garante que apenas 'admin' e 'gerente' tenham acesso.
    if (!['admin', 'gerente'].includes(usuario.role)) {
      return res.status(403).json({ msg: 'Acesso negado. Permissão de administrador ou gerente necessária.' });
    }
    next();
  } catch (err) {
    res.status(500).json({ msg: 'Erro no servidor ao verificar permissões.' });
  }
};