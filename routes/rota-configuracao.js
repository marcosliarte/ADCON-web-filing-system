const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { check, validationResult } = require('express-validator');
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



// @route   GET api/configuracao/tema
// @desc    Retorna apenas o tema de cores (sem auth — aplicado antes do login)
// @access  Public
router.get('/tema', async (req, res) => {
    try {
        const config = await ConfiguracaoEmpresa.findOne({ identificador: 'adcon_config' });
        res.json(config?.tema || {});
    } catch (err) {
        res.json({});
    }
});

// @route   GET api/configuracao
// @desc    Buscar os dados da empresa administradora
// @access  Private (Admin, Gerente)
router.get('/', auth, async (req, res) => {
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
        const { nomeEmpresa, nome_fantasia, cnpj, endereco, telefone, email, tema } = req.body;
        const dadosAtualizados = { nomeEmpresa, nome_fantasia, cnpj, endereco, telefone, email, tema };
        Object.keys(dadosAtualizados).forEach(k => dadosAtualizados[k] === undefined && delete dadosAtualizados[k]);

        const config = await ConfiguracaoEmpresa.findOneAndUpdate(
            { identificador: 'adcon_config' },
            { $set: dadosAtualizados },
            { new: true, upsert: true, setDefaultsOnInsert: true }
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
router.post('/logotipo', [auth, upload.single('logotipo')], async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ msg: 'Nenhum arquivo enviado.' });
    }

    try {
        let config = await ConfiguracaoEmpresa.findOne({ identificador: 'adcon_config' });
        if (!config) {
            // Cria configuração se não existir
            config = new ConfiguracaoEmpresa({ identificador: 'adcon_config' });
        }

        // Se já existe um logotipo antigo, remove o arquivo do servidor
        if (config.logotipoUrl) {
            const oldPath = path.join(__dirname, '..', config.logotipoUrl);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
                console.log(`Logotipo antigo removido: ${oldPath}`);
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

// @route   DELETE api/configuracao/logotipo
// @desc    Remover o logotipo da empresa
// @access  Private (Admin, Gerente)
router.delete('/logotipo', auth, async (req, res) => {
    console.log('[DELETE /logotipo] Iniciando remoção do logotipo...');
    try {
        const config = await ConfiguracaoEmpresa.findOne({ identificador: 'adcon_config' });
        console.log('[DELETE /logotipo] Configuração encontrada:', config ? 'Sim' : 'Não');
        
        if (!config || !config.logotipoUrl) {
            console.log('[DELETE /logotipo] Nenhum logotipo cadastrado');
            return res.status(404).json({ msg: 'Nenhum logotipo cadastrado.' });
        }

        console.log('[DELETE /logotipo] URL do logotipo:', config.logotipoUrl);

        // Remove o arquivo físico
        const logoPath = path.join(__dirname, '..', config.logotipoUrl);
        console.log('[DELETE /logotipo] Caminho completo:', logoPath);
        
        if (fs.existsSync(logoPath)) {
            fs.unlinkSync(logoPath);
            console.log(`[DELETE /logotipo] ✓ Arquivo físico removido: ${logoPath}`);
        } else {
            console.log(`[DELETE /logotipo] ⚠ Arquivo não encontrado: ${logoPath}`);
        }

        // Remove a referência do banco
        config.logotipoUrl = null;
        await config.save();
        console.log('[DELETE /logotipo] ✓ Referência removida do banco');

        res.status(200).json({ msg: 'Logotipo removido com sucesso!' });
        console.log('[DELETE /logotipo] ✓ Resposta enviada ao cliente');
    } catch (err) {
        console.error('[DELETE /logotipo] ERRO:', err.message);
        console.error('[DELETE /logotipo] Stack:', err.stack);
        res.status(500).json({ msg: 'Erro no servidor ao remover o logotipo.' });
    }
});

module.exports = router;