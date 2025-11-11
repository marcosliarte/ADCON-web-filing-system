const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const auth = require('../middleware/auth');
const Empresa = require('../models/model-empresa');
const Usuario = require('../models/model-usuario'); // Para verificar roles

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/certidoes');
    fs.mkdirSync(uploadPath, { recursive: true }); // Garante que o diretório exista
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Sanitiza o nome do arquivo para remover caracteres inválidos
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
    cb(null, `${Date.now()}-${sanitizedFilename}`);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF são permitidos!'), false);
    }
  },
});

// @route   POST api/empresa
// @desc    Cadastrar uma nova empresa com certidão
// @access  Private (Admin ou Funcionário)
router.post(
  '/',
  [
    auth,
    upload.single('arquivo'), // 'arquivo' é o nome do campo no formulário
    check('cnpj', 'CNPJ é obrigatório').not().isEmpty(),
    check('nome', 'Nome da empresa é obrigatório').not().isEmpty(),
    check('email', 'Email da empresa é obrigatório').isEmail(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Verificar permissão
    const usuarioLogado = await Usuario.findById(req.usuario.id);
    if (!usuarioLogado || (usuarioLogado.role !== 'admin' && usuarioLogado.role !== 'funcionario')) {
      return res.status(403).json({ msg: 'Acesso negado. Você não tem permissão para cadastrar empresas.' });
    }

    const { cnpj, nome, email } = req.body;

    try {
      let empresa = await Empresa.findOne({ cnpj });
      if (empresa) {
        return res.status(400).json({ msg: 'Empresa com este CNPJ já existe' });
      }

      const novaEmpresa = new Empresa({
        // Define o ownerId se o usuário logado for um empresário
        ownerId: (usuarioLogado.role === 'empresario') ? req.usuario.id : undefined,
        // Se um admin/funcionario está criando para um empresário específico,
        // o ownerId pode vir do body (ex: formData.append('ownerId', 'id_do_empresario'))
        // Por simplicidade, aqui assumimos que o empresário só cria para si mesmo.
        // Para admins/funcionarios criando para outros, seria necessário um campo extra no formulário.
        // ownerId: req.body.ownerId || (usuarioLogado.role === 'empresario' ? req.usuario.id : undefined),
        cnpj,
        nome,
        email,
      });

      if (req.file) {
        novaEmpresa.certidoes.push({
          nomeArquivo: req.file.originalname,
          caminhoArquivo: `/uploads/certidoes/${req.file.filename}`, // Caminho relativo para acesso via web
          // dataValidade: req.body.dataValidade // Se houver um campo para isso no formulário
        });
      }

      await novaEmpresa.save();
      res.json(novaEmpresa);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Erro no servidor');
    }
  }
);

// @route   GET api/empresas
// @desc    Listar todas as empresas com busca, ordenação e paginação
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { busca, ordenacao = 'nome', direcao = 'asc', pagina = 1, limite = 10, ownerId } = req.query;
    const query = {};
    const usuarioLogado = await Usuario.findById(req.usuario.id);

    // Filtrar por ownerId se o usuário for empresário
    if (usuarioLogado.role === 'empresario') {
      query.ownerId = req.usuario.id;
    } else if (ownerId && usuarioLogado.role === 'admin') {
      // Admin pode filtrar por ownerId específico
      query.ownerId = ownerId;
    }

    if (busca) {
      query.$or = [
        { nome: { $regex: busca, $options: 'i' } },
        { cnpj: { $regex: busca, $options: 'i' } },
      ];
      if (usuarioLogado.role === 'empresario') {
        query.$or.forEach(item => item.ownerId = req.usuario.id); // Garante que a busca do empresário seja apenas nas suas empresas
      }
    }

    const options = {
      page: parseInt(pagina, 10),
      limit: parseInt(limite, 10),
      sort: { [ordenacao]: direcao === 'asc' ? 1 : -1 },
    };

    const empresas = await Empresa.paginate(query, options);
    res.json(empresas);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   GET api/empresa/:id
// @desc    Obter detalhes de uma empresa específica
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const empresa = await Empresa.findById(req.params.id);
    if (!empresa) {
      return res.status(404).json({ msg: 'Empresa não encontrada' });
    }
    const usuarioLogado = await Usuario.findById(req.usuario.id);
    // Empresário só pode ver suas próprias empresas
    if (usuarioLogado.role === 'empresario' && empresa.ownerId.toString() !== req.usuario.id) {
      return res.status(403).json({ msg: 'Acesso negado. Você não tem permissão para visualizar esta empresa.' });
    }
    res.json(empresa);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   DELETE api/empresa/:id
// @desc    Excluir uma empresa
// @access  Private (Apenas Admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const usuarioLogado = await Usuario.findById(req.usuario.id);
    if (!usuarioLogado || usuarioLogado.role !== 'admin') {
      // Funcionários também não podem excluir, apenas admins
      if (usuarioLogado.role === 'funcionario') {
        return res.status(403).json({ msg: 'Acesso negado. Apenas administradores podem excluir empresas.' });
      }
      // Empresários não podem excluir
      if (usuarioLogado.role === 'empresario') {
        return res.status(403).json({ msg: 'Acesso negado. Empresários não podem excluir empresas.' });
      }
      return res.status(403).json({ msg: 'Acesso negado. Apenas administradores podem excluir empresas.' });
    }

    const empresa = await Empresa.findByIdAndDelete(req.params.id);
    if (!empresa) {
      return res.status(404).json({ msg: 'Empresa não encontrada' });
    }
    res.json({ msg: 'Empresa removida' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   PUT api/empresa/:id
// @desc    Atualizar uma empresa
// @access  Private (Admin ou Funcionário)
router.put(
  '/:id',
  [
    auth,
    upload.single('arquivo'),
    check('cnpj', 'CNPJ é obrigatório').not().isEmpty(),
    check('nome', 'Nome da empresa é obrigatório').not().isEmpty(),
    check('email', 'Email da empresa é obrigatório').isEmail(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nome, cnpj, email, removerArquivo } = req.body;

    try {
      const empresa = await Empresa.findById(req.params.id);
      const usuarioLogado = await Usuario.findById(req.usuario.id);
      // Empresário não pode editar
      if (usuarioLogado.role === 'empresario') {
        return res.status(403).json({ msg: 'Acesso negado. Empresários não podem editar empresas.' });
      }
      // Funcionário e Admin podem editar
      if (!empresa) {
        return res.status(404).json({ msg: 'Empresa não encontrada' });
      }

      // Atualiza os campos básicos
      empresa.nome = nome;
      empresa.cnpj = cnpj;
      empresa.email = email;

      // Lógica para o arquivo
      if (removerArquivo === 'true' && empresa.certidoes.length > 0) {
        const caminhoAntigo = path.join(__dirname, '..', empresa.certidoes[0].caminhoArquivo);
        if (fs.existsSync(caminhoAntigo)) {
          fs.unlinkSync(caminhoAntigo);
        }
        empresa.certidoes = []; // Remove a certidão
      }

      if (req.file) {
        // Se já existir uma certidão, remove a antiga antes de adicionar a nova
        if (empresa.certidoes.length > 0) {
            const caminhoAntigo = path.join(__dirname, '..', empresa.certidoes[0].caminhoArquivo);
            if (fs.existsSync(caminhoAntigo)) {
                fs.unlinkSync(caminhoAntigo);
            }
        }
        empresa.certidoes = [{
          nomeArquivo: req.file.originalname,
          caminhoArquivo: `/uploads/certidoes/${req.file.filename}`,
        }];
      }

      await empresa.save();
      res.json(empresa);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Erro no servidor');
    }
  }
);

module.exports = router;