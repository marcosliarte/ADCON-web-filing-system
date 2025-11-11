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
    // Salva diferentes tipos de arquivos em pastas diferentes
    let subfolder = 'documentos_empresa';
    if (file.fieldname.startsWith('contrato_social')) {
      subfolder = 'contratos';
    } else if (file.fieldname === 'certificado_digital') {
      subfolder = 'certificados';
    }
    const uploadPath = path.join(__dirname, `../uploads/${subfolder}`);
    fs.mkdirSync(uploadPath, { recursive: true }); // Garante que o diretório exista
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Sanitiza o nome do arquivo para remover caracteres inválidos
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniquePrefix}-${sanitizedFilename}`);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Permite os tipos de arquivo definidos no formulário
    const allowedTypes = /pdf|jpeg|jpg|png|pfx|p12/;
    if (allowedTypes.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido!'), false);
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
    // Espera arquivos de múltiplos campos definidos no formulário
    upload.fields([
      { name: 'arquivo_cnpj', maxCount: 1 },
      { name: 'certificado_digital', maxCount: 1 },
      // Permite múltiplos arquivos para alterações contratuais
      { name: 'contrato_social[0][arquivo]', maxCount: 1 },
      { name: 'contrato_social[1][arquivo]', maxCount: 1 },
      { name: 'contrato_social[2][arquivo]', maxCount: 1 },
      { name: 'contrato_social[3][arquivo]', maxCount: 1 },
      { name: 'contrato_social[4][arquivo]', maxCount: 1 } // Adicione mais se precisar
    ]),
    check('nome_empresarial', 'Nome empresarial é obrigatório').not().isEmpty(),
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

    const { cnpj } = req.body;

    try {
      let empresa = await Empresa.findOne({ cnpj });
      if (empresa) {
        return res.status(400).json({ msg: 'Empresa com este CNPJ já cadastrado.' });
      }

      // Mapeia os dados do body para o schema, incluindo objetos aninhados
      const dadosEmpresa = {
        ...req.body,
        nome: req.body.nome_empresarial, // Mapeia o nome_empresarial do form para o campo 'nome' do schema
        endereco: req.body.endereco || {},
        socios: [],
        documentos: {
          contratos: [],
        },
      };

      // Processa os sócios
      if (req.body.socios) {
        dadosEmpresa.socios = Object.values(req.body.socios);
      }

      // Processa os arquivos e associa aos dados
      if (req.files) {
        if (req.files.arquivo_cnpj) {
          const file = req.files.arquivo_cnpj[0];
          dadosEmpresa.documentos.cartaoCnpj = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/documentos_empresa/${file.filename}` };
        }
        if (req.files.certificado_digital) {
          const file = req.files.certificado_digital[0];
          dadosEmpresa.documentos.certificadoDigital = { 
            nomeArquivo: file.originalname, 
            caminhoArquivo: `/uploads/certificados/${file.filename}`,
            dataValidade: req.body.certificado_validade 
          };
        }

        // Processa os contratos
        if (req.body.contrato_social) {
          Object.keys(req.body.contrato_social).forEach(key => {
            const contratoInfo = req.body.contrato_social[key];
            const fileInfo = req.files[`contrato_social[${key}][arquivo]`];
            if (fileInfo) {
              const file = fileInfo[0];
              dadosEmpresa.documentos.contratos.push({
                nomeArquivo: file.originalname,
                caminhoArquivo: `/uploads/contratos/${file.filename}`,
                dataAlteracao: contratoInfo.data,
                numeroAlteracao: contratoInfo.numero
              });
            }
          });
        }
      }

      const novaEmpresa = new Empresa(dadosEmpresa);

      await novaEmpresa.save();
      res.status(201).json(novaEmpresa);
    } catch (err) {
      console.error(err.message);
      console.error(err.stack); // Adiciona mais detalhes do erro no log
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