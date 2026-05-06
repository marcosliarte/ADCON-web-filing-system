const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

function stripHtml(str) {
  return str ? String(str).replace(/<[^>]*>/g, '') : '';
}
const Notificacao = require('../models/model-notificacao');
const Usuario = require('../models/model-usuario');
const Empresa = require('../models/model-empresa');

// @route   GET api/notificacoes
// @desc    Obter notificações do usuário logado
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { lida, limit = 50, skip = 0 } = req.query;
    
    const query = { usuarioId: req.usuario.id };
    if (lida !== undefined) {
      query.lida = lida === 'true';
    }

    const notificacoes = await Notificacao.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await Notificacao.countDocuments(query);
    const naoLidas = await Notificacao.countDocuments({ 
      usuarioId: req.usuario.id, 
      lida: false 
    });

    res.json({ 
      notificacoes, 
      total,
      naoLidas 
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro ao buscar notificações.' });
  }
});

// @route   GET api/notificacoes/count
// @desc    Obter contagem de notificações não lidas
// @access  Private
router.get('/count', auth, async (req, res) => {
  try {
    const count = await Notificacao.countDocuments({ 
      usuarioId: req.usuario.id, 
      lida: false 
    });
    res.json({ count });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro ao contar notificações.' });
  }
});

// @route   PUT api/notificacoes/:id/ler
// @desc    Marcar notificação como lida
// @access  Private
router.put('/:id/ler', auth, async (req, res) => {
  try {
    const notificacao = await Notificacao.findOneAndUpdate(
      { _id: req.params.id, usuarioId: req.usuario.id },
      { lida: true },
      { new: true }
    );

    if (!notificacao) {
      return res.status(404).json({ msg: 'Notificação não encontrada.' });
    }

    res.json(notificacao);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro ao marcar notificação como lida.' });
  }
});

// @route   PUT api/notificacoes/ler-todas
// @desc    Marcar todas as notificações como lidas
// @access  Private
router.put('/ler-todas', auth, async (req, res) => {
  try {
    await Notificacao.updateMany(
      { usuarioId: req.usuario.id, lida: false },
      { lida: true }
    );
    res.json({ msg: 'Todas as notificações foram marcadas como lidas.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro ao marcar notificações como lidas.' });
  }
});

// @route   DELETE api/notificacoes/:id
// @desc    Excluir notificação
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const notificacao = await Notificacao.findOneAndDelete({
      _id: req.params.id,
      usuarioId: req.usuario.id
    });

    if (!notificacao) {
      return res.status(404).json({ msg: 'Notificação não encontrada.' });
    }

    res.json({ msg: 'Notificação excluída com sucesso.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro ao excluir notificação.' });
  }
});

// @route   DELETE api/notificacoes/limpar
// @desc    Excluir todas as notificações lidas
// @access  Private
router.delete('/limpar/lidas', auth, async (req, res) => {
  try {
    await Notificacao.deleteMany({
      usuarioId: req.usuario.id,
      lida: true
    });
    res.json({ msg: 'Notificações lidas excluídas com sucesso.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro ao limpar notificações.' });
  }
});

// ===== ROTAS ADMINISTRATIVAS =====

// @route   POST api/notificacoes/admin/enviar
// @desc    Enviar notificação para usuário(s) específico(s) ou todos
// @access  Private (Admin)
router.post('/admin/enviar', [auth, adminAuth], async (req, res) => {
  try {
    const { destinatarios, titulo, mensagem, link } = req.body;

    if (!titulo || !mensagem) {
      return res.status(400).json({ msg: 'Título e mensagem são obrigatórios.' });
    }

    let usuariosIds = [];

    if (destinatarios === 'todos') {
      const usuarios = await Usuario.find().select('_id');
      usuariosIds = usuarios.map(u => u._id);
    } else if (Array.isArray(destinatarios)) {
      usuariosIds = destinatarios;
    } else if (destinatarios) {
      usuariosIds = [destinatarios];
    } else {
      return res.status(400).json({ msg: 'Destinatários inválidos.' });
    }

    const tituloSafe = stripHtml(titulo);
    const mensagemSafe = stripHtml(mensagem);

    const notificacoes = usuariosIds.map(userId => ({
      usuarioId: userId,
      tipo: 'mensagem_admin',
      titulo: tituloSafe,
      mensagem: mensagemSafe,
      link: link || null,
      criadoPor: req.usuario.id
    }));

    await Notificacao.insertMany(notificacoes);

    res.json({
      msg: `Notificação enviada para ${usuariosIds.length} usuário(s).`,
      count: usuariosIds.length
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro ao enviar notificação.' });
  }
});

// @route   POST api/notificacoes/admin/enviar-role
// @desc    Enviar notificação para todos os usuários de um perfil específico
// @access  Private (Admin)
router.post('/admin/enviar-role', [auth, adminAuth], async (req, res) => {
  try {
    const { role, titulo, mensagem, link } = req.body;

    if (!role || !titulo || !mensagem) {
      return res.status(400).json({ msg: 'Role, título e mensagem são obrigatórios.' });
    }

    const usuarios = await Usuario.find({ role }).select('_id');
    const usuariosIds = usuarios.map(u => u._id);

    if (usuariosIds.length === 0) {
      return res.status(404).json({ msg: 'Nenhum usuário encontrado com este perfil.' });
    }

    const tituloSafe = stripHtml(titulo);
    const mensagemSafe = stripHtml(mensagem);

    const notificacoes = usuariosIds.map(userId => ({
      usuarioId: userId,
      tipo: 'mensagem_admin',
      titulo: tituloSafe,
      mensagem: mensagemSafe,
      link: link || null,
      criadoPor: req.usuario.id
    }));

    await Notificacao.insertMany(notificacoes);

    res.json({
      msg: `Notificação enviada para ${usuariosIds.length} usuário(s) com perfil ${role}.`,
      count: usuariosIds.length
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro ao enviar notificação.' });
  }
});

// ===== FUNÇÕES AUXILIARES PARA CRIAR NOTIFICAÇÕES =====

// Função para criar notificação de documento vencendo
async function criarNotificacaoDocumentoVencendo(usuarioId, empresaId, empresaNome, documentoTipo, dataValidade, diasRestantes) {
  try {
    const titulo = diasRestantes <= 0 
      ? '⚠️ Documento Vencido!' 
      : `⏰ Documento Vencendo em ${diasRestantes} dia(s)`;
    
    const mensagem = diasRestantes <= 0
      ? `O documento ${documentoTipo} da empresa ${empresaNome} está VENCIDO desde ${new Date(dataValidade).toLocaleDateString('pt-BR')}.`
      : `O documento ${documentoTipo} da empresa ${empresaNome} vence em ${diasRestantes} dia(s) (${new Date(dataValidade).toLocaleDateString('pt-BR')}).`;

    await Notificacao.create({
      usuarioId,
      tipo: diasRestantes <= 0 ? 'documento_vencido' : 'documento_vencendo',
      titulo,
      mensagem,
      link: `/detalhes-empresa.html?id=${empresaId}`,
      dadosAdicionais: {
        empresaId,
        empresaNome,
        documentoTipo,
        dataValidade
      }
    });
  } catch (err) {
    console.error('Erro ao criar notificação de documento:', err.message);
  }
}

// Função para criar notificação de pagamento recebido
async function criarNotificacaoPagamentoRecebido(usuarioId, empresaId, empresaNome, pagamentoId, valor) {
  try {
    await Notificacao.create({
      usuarioId,
      tipo: 'pagamento_recebido',
      titulo: '💰 Pagamento Recebido',
      mensagem: `Pagamento de R$ ${valor.toFixed(2)} recebido da empresa ${empresaNome}.`,
      link: `/meus-pagamentos.html`,
      dadosAdicionais: {
        empresaId,
        empresaNome,
        pagamentoId,
        valorPagamento: valor
      }
    });
  } catch (err) {
    console.error('Erro ao criar notificação de pagamento:', err.message);
  }
}

// Exporta as funções auxiliares
module.exports = router;
module.exports.criarNotificacaoDocumentoVencendo = criarNotificacaoDocumentoVencendo;
module.exports.criarNotificacaoPagamentoRecebido = criarNotificacaoPagamentoRecebido;
