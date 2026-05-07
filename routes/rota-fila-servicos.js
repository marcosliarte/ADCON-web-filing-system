const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Usuario = require('../models/model-usuario');
const Funcionario = require('../models/model-funcionario');
const Notificacao = require('../models/model-notificacao');
const FilaServico = require('../models/model-fila-servicos');

const TIPOS_LABEL = {
  alteracao_empresa:    'Alteração de Empresa',
  abertura_empresa:     'Abertura de Empresa',
  encerramento_empresa: 'Encerramento de Empresa',
  declaracao_fiscal:    'Declaração Fiscal',
  certidao_negativa:    'Certidão Negativa',
  certificado_digital:  'Certificado Digital',
  consultoria:          'Consultoria',
  outro:                'Outro'
};

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

function popularServico(query) {
  return query
    .populate('empresa', 'nome cnpj')
    .populate('funcionario', 'nome cargo usuario')
    .populate('responsavel', 'nome')
    .populate('criadoPor', 'nome');
}

async function notificarFuncionario(funcionarioId, servico) {
  try {
    const func = await Funcionario.findById(funcionarioId).select('usuario nome');
    if (!func || !func.usuario) return;

    const tipoLabel = TIPOS_LABEL[servico.tipo] || servico.tipo;

    await Notificacao.create({
      usuarioId: func.usuario,
      tipo: 'sistema',
      titulo: 'Novo serviço atribuído a você',
      mensagem: `Você foi vinculado ao serviço "${servico.titulo}" (${tipoLabel}). Acesse a fila de serviços para mais detalhes.`,
      link: '/fila-servicos.html',
      criadoPor: servico.criadoPor
    });
  } catch (err) {
    console.error('Erro ao notificar funcionário:', err.message);
  }
}

// @route   GET /api/fila-servicos
// @desc    Listar todos os serviços
// @access  Private (todos os autenticados)
router.get('/', auth, async (req, res) => {
  try {
    const filtro = {};
    if (req.query.status) filtro.status = req.query.status;

    const servicos = await popularServico(
      FilaServico.find(filtro).sort({ createdAt: -1 })
    ).lean();

    res.json(servicos);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' });
  }
});

// @route   GET /api/fila-servicos/:id
// @desc    Detalhes de um serviço
// @access  Private (todos os autenticados)
router.get('/:id', auth, async (req, res) => {
  try {
    const servico = await popularServico(FilaServico.findById(req.params.id)).lean();
    if (!servico) return res.status(404).json({ msg: 'Serviço não encontrado.' });
    res.json(servico);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' });
  }
});

// @route   POST /api/fila-servicos
// @desc    Criar novo serviço
// @access  Private (Admin/Gerente)
router.post(
  '/',
  [
    auth,
    checkAdminGerente,
    check('titulo', 'O título é obrigatório').not().isEmpty().trim()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tipo, titulo, descricao, empresa, empresaNaoCadastrada, funcionario, prioridade, dataPrevisao } = req.body;

    try {
      const novoServico = new FilaServico({
        tipo: tipo || 'outro',
        titulo,
        descricao,
        empresa: empresa || null,
        empresaNaoCadastrada: empresaNaoCadastrada || null,
        funcionario: funcionario || null,
        prioridade: prioridade || 'normal',
        dataPrevisao: dataPrevisao || null,
        criadoPor: req.usuario.id
      });

      await novoServico.save();

      if (funcionario) await notificarFuncionario(funcionario, novoServico);

      const populado = await popularServico(FilaServico.findById(novoServico._id));
      res.status(201).json(populado);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ msg: 'Erro no servidor' });
    }
  }
);

// @route   PUT /api/fila-servicos/:id
// @desc    Editar serviço
// @access  Private (Admin/Gerente)
router.put(
  '/:id',
  [
    auth,
    checkAdminGerente,
    check('titulo', 'O título é obrigatório').not().isEmpty().trim()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tipo, titulo, descricao, empresa, empresaNaoCadastrada, funcionario, status, prioridade, dataPrevisao, responsavel } = req.body;

    try {
      const servico = await FilaServico.findById(req.params.id);
      if (!servico) return res.status(404).json({ msg: 'Serviço não encontrado.' });

      const funcionarioAnteriorId = servico.funcionario ? servico.funcionario.toString() : null;

      servico.tipo        = tipo || servico.tipo;
      servico.titulo      = titulo;
      servico.descricao   = descricao || '';
      servico.empresa              = empresa || null;
      servico.empresaNaoCadastrada = empresaNaoCadastrada || null;
      servico.funcionario = funcionario || null;
      servico.status      = status || servico.status;
      servico.prioridade  = prioridade || servico.prioridade;
      servico.dataPrevisao = dataPrevisao || null;
      if (responsavel !== undefined) servico.responsavel = responsavel || null;

      await servico.save();

      // Notifica apenas se o funcionário foi alterado para um novo
      const novoFuncionarioId = funcionario || null;
      if (novoFuncionarioId && novoFuncionarioId !== funcionarioAnteriorId) {
        await notificarFuncionario(novoFuncionarioId, servico);
      }

      const populado = await popularServico(FilaServico.findById(servico._id));
      res.json(populado);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ msg: 'Erro no servidor' });
    }
  }
);

// @route   PUT /api/fila-servicos/:id/assumir
// @desc    Assumir ou liberar um serviço
// @access  Private (todos os autenticados)
router.put('/:id/assumir', auth, async (req, res) => {
  try {
    const servico = await FilaServico.findById(req.params.id);
    if (!servico) return res.status(404).json({ msg: 'Serviço não encontrado.' });

    const usuario = await Usuario.findById(req.usuario.id).select('role');

    if (servico.responsavel && servico.responsavel.toString() === req.usuario.id) {
      servico.responsavel = null;
      if (servico.status === 'em_andamento') servico.status = 'pendente';
    } else if (!servico.responsavel || ['admin', 'gerente'].includes(usuario.role)) {
      servico.responsavel = req.usuario.id;
      if (servico.status === 'pendente') servico.status = 'em_andamento';
    } else {
      return res.status(400).json({ msg: 'Este serviço já foi assumido por outro usuário.' });
    }

    await servico.save();
    const populado = await popularServico(FilaServico.findById(servico._id));
    res.json(populado);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' });
  }
});

// @route   DELETE /api/fila-servicos/:id
// @desc    Excluir serviço
// @access  Private (Admin/Gerente)
router.delete('/:id', [auth, checkAdminGerente], async (req, res) => {
  try {
    const servico = await FilaServico.findById(req.params.id);
    if (!servico) return res.status(404).json({ msg: 'Serviço não encontrado.' });

    await FilaServico.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Serviço removido.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' });
  }
});

module.exports = router;
