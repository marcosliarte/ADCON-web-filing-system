const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const ConfiguracaoEmpresa = require('../models/model-configuracao');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuração do Multer para o upload do logotipo
const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/logotipos');
        fs.mkdirSync(uploadPath, { recursive: true }); // Garante que a pasta exista
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `logotipo-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: logoStorage, limits: { fileSize: 5 * 1024 * 1024 } /* Limite de 5MB */ });



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

// @route   POST api/configuracao/logotipo
// @desc    Fazer upload do logotipo da empresa
// @access  Private (Admin, Gerente)
router.post('/logotipo', [auth, adminAuth, upload.single('logotipo')], async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ msg: 'Nenhum arquivo enviado.' });
    }

    try {
        const config = await ConfiguracaoEmpresa.findOne({ identificador: 'adcon_config' });
        if (!config) {
            return res.status(404).json({ msg: 'Configuração da empresa não encontrada.' });
        }

        // Se já existe um logotipo antigo, remove o arquivo do servidor
        if (config.logotipoUrl) {
            const oldPath = path.join(__dirname, '..', config.logotipoUrl);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        // Salva o caminho do novo logotipo
        config.logotipoUrl = `/uploads/logotipos/${req.file.filename}`;
        await config.save();

        res.json({ msg: 'Logotipo atualizado com sucesso!', logotipoUrl: config.logotipoUrl });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao salvar o logotipo.' });
    }
});

module.exports = router;