const Usuario = require('../models/model-usuario');

module.exports = async function (req, res, next) {
  try {
    const usuario = await Usuario.findById(req.usuario.id);
    if (!usuario || usuario.role !== 'admin') {
      return res.status(403).json({ msg: 'Acesso negado. Apenas administradores podem realizar esta ação.' });
    }
    next();
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
};