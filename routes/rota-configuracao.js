const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const ConfiguracaoEmpresa = require('../models/model-configuracao');

// @route   GET api/configuracao
// @desc    Buscar os dados da empresa administradora
// @access  Private (Admin, Gerente)
router.get('/', [auth, adminAuth], async (req, res) => {
    try {
        let config = await ConfiguracaoEmpresa.findOne({ identificador: 'adcon_config' });
        if (!config) {
            // Se não existir, retorna um objeto vazio para o front-end não quebrar
            return res.json({});
        }
        res.json(config);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

// @route   PUT api/configuracao
// @desc    Atualizar os dados da empresa administradora
// @access  Private (Admin, Gerente)
router.put('/', [auth, adminAuth], async (req, res) => {
    try {
        const dadosAtualizados = req.body;

        // Usamos findOneAndUpdate com upsert:true.
        // Isso cria o documento se ele não existir, ou o atualiza se já existir.
        const config = await ConfiguracaoEmpresa.findOneAndUpdate(
            { identificador: 'adcon_config' }, // Filtro para encontrar o documento único
            { $set: dadosAtualizados }, // Dados para atualizar
            { new: true, upsert: true, setDefaultsOnInsert: true } // Opções
        );

        res.json({ msg: 'Dados da empresa atualizados com sucesso!', config });

    } catch (err) {
        console.error(err.message);
        if (err.code === 11000) { // Erro de chave duplicada
            return res.status(400).json({ msg: 'Erro de consistência de dados. Tente novamente.' });
        }
        res.status(500).json({ msg: 'Erro no servidor ao atualizar os dados.' });
    }
});

module.exports = router;