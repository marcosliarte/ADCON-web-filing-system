const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Usuario = require('../models/model-usuario');
const Funcionario = require('../models/model-funcionario');

// Middleware para verificar se o usuário é Admin ou Gerente
const checkAdminGerente = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.usuario.id).select('role');
    if (!['admin', 'gerente'].includes(usuario.role)) {
      return res.status(403).json({ msg: 'Acesso negado. Permissão de Admin ou Gerente necessária.' });
    }
    next();
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' });
  }
};

// @route   POST api/funcionarios
// @desc    Cadastrar um novo funcionário
// @access  Private (Admin/Gerente)
router.post(
  '/',
  [
    auth,
    checkAdminGerente,
    check('nome', 'O nome é obrigatório').not().isEmpty(),
    check('salario', 'O salário é obrigatório e deve ser um número').isNumeric(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { nome, cargo, salario } = req.body;
      const novoFuncionario = new Funcionario({ nome, cargo, salario });
      await novoFuncionario.save();
      res.status(201).json(novoFuncionario);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Erro no servidor');
    }
  }
);

// @route   GET api/funcionarios
// @desc    Listar todos os funcionários
// @access  Private (Admin/Gerente)
router.get('/', [auth, checkAdminGerente], async (req, res) => {
  try {
    const funcionarios = await Funcionario.find().sort({ nome: 1 });
    res.json(funcionarios);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   DELETE api/funcionarios/:id
// @desc    Deletar um funcionário
// @access  Private (Admin/Gerente)
router.delete('/:id', [auth, checkAdminGerente], async (req, res) => {
    try {
      let funcionario = await Funcionario.findById(req.params.id);
      if (!funcionario) {
        return res.status(404).json({ msg: 'Funcionário não encontrado' });
      }
      await Funcionario.findByIdAndDelete(req.params.id);
      res.json({ msg: 'Funcionário removido' });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Erro no servidor');
    }
  }
);

module.exports = router;