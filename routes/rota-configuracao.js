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
router.put('/', auth, async (req, res) => {
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
router.post('/logotipo', [auth, upload.single('logotipo')], async (req, res) => {
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

// --- ROTAS PARA GESTÃO DE FUNCIONÁRIOS ---

// @route   GET api/configuracao/funcionarios
// @desc    Listar todos os funcionários com status de pagamento do mês atual
// @access  Private (Admin, Gerente)
router.get('/funcionarios', [auth, adminAuth], async (req, res) => {
    try {
        const config = await ConfiguracaoEmpresa.findOne({ identificador: 'adcon_config' }).select('funcionarios').lean();
        if (!config || !config.funcionarios) return res.json([]);

        const hoje = new Date();
        const mesAtual = hoje.getMonth() + 1;
        const anoAtual = hoje.getFullYear();

        const funcionariosComStatus = config.funcionarios.map(func => {
            const pagamentoMesAtual = (func.historicoPagamentos || []).find(p => p.mes === mesAtual && p.ano === anoAtual);
            func.statusPagamentoMesAtual = pagamentoMesAtual ? 'Pago' : 'A Pagar';
            return func;
        });

        res.json(funcionariosComStatus);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

// @route   POST api/configuracao/funcionarios
// @desc    Adicionar um novo funcionário
// @access  Private (Admin, Gerente)
router.post('/funcionarios', [auth, adminAuth], [
    check('nome', 'O nome é obrigatório').not().isEmpty(),
    check('cargo', 'O cargo é obrigatório').not().isEmpty(),
    check('salarioBruto', 'O salário bruto é obrigatório e deve ser um número').isFloat({ gt: 0 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { nome, cargo, salarioBruto, chavePix, descontos } = req.body;
    try {
        const config = await ConfiguracaoEmpresa.findOne({ identificador: 'adcon_config' });
        if (!config) return res.status(404).json({ msg: 'Configuração da empresa não encontrada.' });

        config.funcionarios.push({ nome, cargo, salarioBruto, chavePix, descontos: descontos || [] });
        await config.save();
        res.status(201).json(config.funcionarios);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

// @route   PUT api/configuracao/funcionarios/:id
// @desc    Atualizar um funcionário
// @access  Private (Admin, Gerente)
router.put('/funcionarios/:id', [auth, adminAuth], [
    check('nome', 'O nome é obrigatório').not().isEmpty(),
    check('cargo', 'O cargo é obrigatório').not().isEmpty(),
    check('salarioBruto', 'O salário bruto é obrigatório e deve ser um número').isFloat({ gt: 0 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { nome, cargo, salarioBruto, chavePix, descontos } = req.body;
    try {
        const config = await ConfiguracaoEmpresa.findOne({ identificador: 'adcon_config' });
        if (!config) return res.status(404).json({ msg: 'Configuração da empresa não encontrada.' });
        const funcionario = config.funcionarios.id(req.params.id);
        if (!funcionario) return res.status(404).json({ msg: 'Funcionário não encontrado.' });

        funcionario.nome = nome;
        funcionario.cargo = cargo;
        funcionario.salarioBruto = salarioBruto;
        funcionario.chavePix = chavePix;
        funcionario.descontos = descontos || [];

        await config.save();
        res.json(funcionario);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

// @route   GET api/configuracao/funcionarios/:id
// @desc    Obter um funcionário pelo ID
// @access  Private (Admin, Gerente)
router.get('/funcionarios/:id', [auth, adminAuth], async (req, res) => {
    try {
        const config = await ConfiguracaoEmpresa.findOne({ identificador: 'adcon_config' });
        if (!config) {
            return res.status(404).json({ msg: 'Configuração da empresa não encontrada.' });
        }
        const funcionario = config.funcionarios.id(req.params.id);
        if (!funcionario) return res.status(404).json({ msg: 'Funcionário não encontrado.' });
        res.json(funcionario);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

// @route   POST api/configuracao/funcionarios/:id/pagamentos
// @desc    Registrar um novo pagamento para um funcionário
// @access  Private (Admin, Gerente)
router.post('/funcionarios/:id/pagamentos', [auth, adminAuth], [
    check('mes', 'Mês é obrigatório').isInt({ min: 1, max: 12 }),
    check('ano', 'Ano é obrigatório').isInt(),
    check('formaPagamento', 'Forma de pagamento é obrigatória').not().isEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { mes, ano, salarioBase, adicionais, descontosFixos, descontosVariaveis, totalProventos, totalDescontos, salarioLiquido, formaPagamento, chavePix } = req.body;
    try {
        const config = await ConfiguracaoEmpresa.findOne({ identificador: 'adcon_config' });
        const funcionario = config.funcionarios.id(req.params.id);
        if (!funcionario) return res.status(404).json({ message: 'Funcionário não encontrado.' });

        // Remove pagamento antigo para o mesmo período para evitar duplicatas
        funcionario.historicoPagamentos = funcionario.historicoPagamentos.filter(p => !(p.mes === mes && p.ano === ano));

        funcionario.historicoPagamentos.push({ mes, ano, salarioBase, adicionais, descontosFixos, descontosVariaveis, totalProventos, totalDescontos, salarioLiquido, formaPagamento, chavePix });
        await config.save();

        res.status(201).json({ message: 'Pagamento registrado com sucesso!', funcionario });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

// @route   DELETE api/configuracao/funcionarios/:id
// @desc    Excluir um funcionário
// @access  Private (Admin, Gerente)
router.delete('/funcionarios/:id', [auth, adminAuth], async (req, res) => {
    try {
        const config = await ConfiguracaoEmpresa.findOne({ identificador: 'adcon_config' });
        if (!config) return res.status(404).json({ msg: 'Configuração da empresa não encontrada.' });

        config.funcionarios.pull({ _id: req.params.id }); // Remove o funcionário do array
        await config.save();
        res.json({ msg: 'Funcionário removido com sucesso!' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

// @route   DELETE api/configuracao/funcionarios/:id
// @desc    Excluir um funcionário
// @access  Private (Admin, Gerente)
router.delete('/funcionarios/:id', [auth, adminAuth], async (req, res) => {
    try {
        const config = await ConfiguracaoEmpresa.findOne({ identificador: 'adcon_config' });
        if (!config) return res.status(404).json({ msg: 'Configuração da empresa não encontrada.' });

        config.funcionarios.pull({ _id: req.params.id }); // Remove o funcionário do array
        await config.save();
        res.json({ msg: 'Funcionário removido com sucesso!' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

module.exports = router;