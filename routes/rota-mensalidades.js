const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');

const Mensalidade = require('../models/model-mensalidade'); // CORREÇÃO: Aponta para o arquivo na pasta models
const Empresa = require('../models/model-empresa');
const Usuario = require('../models/model-usuario');

// @route   GET api/mensalidades/status-geral
// @desc    Listar todas as empresas e o status da mensalidade para um mês/ano
// @access  Private (Admin ou Gerente)
router.get('/status-geral', auth, async (req, res) => {
  const usuarioLogado = await Usuario.findById(req.usuario.id);
  if (!['admin', 'gerente', 'funcionario'].includes(usuarioLogado.role)) {
    return res.status(403).json({ msg: 'Acesso negado para este recurso.' });
  }
  try {
    const mes = parseInt(req.query.mes);
    const ano = parseInt(req.query.ano);
    const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
    const limite = Math.min(100, Math.max(1, parseInt(req.query.limite) || 50));
    const skip = (pagina - 1) * limite;

    if (!mes || !ano) {
      return res.status(400).json({ msg: 'Mês e ano são obrigatórios.' });
    }

    const dataFiltro = new Date(ano, mes - 1, 1);

    const pipeline = [
      {
        $lookup: {
          from: 'mensalidades',
          let: { empresaId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: ['$empresaId', '$$empresaId'] }, { $eq: ['$mes', mes] }, { $eq: ['$ano', ano] } ] } } }
          ],
          as: 'mensalidadeExata',
        },
      },
      {
        $lookup: {
          from: 'mensalidades',
          let: { empresaId: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: ['$empresaId', '$$empresaId'] }, { $lt: [ { $dateFromParts: { 'year': '$ano', 'month': '$mes', 'day': 1 } }, dataFiltro ] } ] } } },
            { $sort: { ano: -1, mes: -1 } },
            { $limit: 1 }
          ],
          as: 'mensalidadeAnterior',
        },
      },
      { $unwind: { path: '$mensalidadeExata', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$mensalidadeAnterior', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          nome: 1,
          cnpj: 1,
          valorPadraoMensalidade: 1,
          mensalidade: {
            $cond: {
              if: '$mensalidadeExata',
              then: '$mensalidadeExata',
              else: {
                _id: null,
                valor: { $ifNull: ['$mensalidadeAnterior.valor', '$valorPadraoMensalidade'] },
                status: 'Não Gerada',
              }
            }
          }
        }
      },
      { $sort: { nome: 1 } },
    ];

    // Contagem total e dados paginados em paralelo
    const [totalResult, empresas] = await Promise.all([
      Empresa.aggregate([...pipeline, { $count: 'total' }]),
      Empresa.aggregate([...pipeline, { $skip: skip }, { $limit: limite }]),
    ]);

    const total = totalResult[0]?.total ?? 0;
    res.json({
      data: empresas,
      paginacao: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' });
  }
});

// @route   POST api/mensalidades
// @desc    Criar uma nova mensalidade
// @access  Private (Admin ou Gerente)
router.post(
  '/',
  [
    auth,
    check('empresaId', 'A empresa é obrigatória').not().isEmpty(),
    check('valor', 'O valor é obrigatório e deve ser numérico').isNumeric(),
    check('mes', 'O mês é obrigatório').isInt({ min: 1, max: 12 }),
    check('ano', 'O ano é obrigatório').isInt(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const usuarioLogado = await Usuario.findById(req.usuario.id);
    // CORREÇÃO: Completa a verificação de permissão.
    if (!['admin', 'gerente', 'funcionario'].includes(usuarioLogado.role)) {
      return res.status(403).json({ msg: 'Acesso negado para criar mensalidades.' });
    }
    const { empresaId, mes, ano, valor } = req.body;

    try {
      if (await Mensalidade.findOne({ empresaId, mes, ano })) {
        return res.status(400).json({ msg: `Já existe uma mensalidade para esta empresa em ${mes}/${ano}.` });
      }

      // MELHORIA: Define uma data de vencimento padrão (dia 10 do mês)
      const dataVencimento = new Date(ano, mes - 1, 10);

      const novaMensalidade = new Mensalidade({ 
        empresaId, valor, mes, ano, dataVencimento 
      });

      await novaMensalidade.save();
      
      // Atualiza o valor padrão na empresa para facilitar futuras gerações
      await Empresa.findByIdAndUpdate(empresaId, { valorPadraoMensalidade: valor });

      res.status(201).json(novaMensalidade);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ msg: 'Erro no servidor' });
    }
  }
);

// @route   PUT api/mensalidades/:id
// @desc    Atualizar uma mensalidade (pagar, editar valor/vencimento)
// @access  Private (Admin ou Gerente)
router.put('/:id', auth, async (req, res) => {
  const usuarioLogado = await Usuario.findById(req.usuario.id);
  if (!['admin', 'gerente', 'funcionario'].includes(usuarioLogado.role)) {
    return res.status(403).json({ msg: 'Acesso negado para atualizar mensalidades.' });
  }

  try {
    const { valor, status, dataVencimento, dataPagamento } = req.body;
    const camposAtualizados = {};
    if (valor) camposAtualizados.valor = valor;
    if (status) camposAtualizados.status = status;
    if (dataVencimento) camposAtualizados.dataVencimento = dataVencimento;
    if (dataPagamento) camposAtualizados.dataPagamento = dataPagamento;

    let mensalidade = await Mensalidade.findById(req.params.id);
    if (!mensalidade) {
      return res.status(404).json({ msg: 'Mensalidade não encontrada.' });
    }

    mensalidade = await Mensalidade.findByIdAndUpdate(req.params.id, { $set: camposAtualizados }, { new: true });
    res.json(mensalidade);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' });
  }
});

// @route   DELETE api/mensalidades/:id
// @desc    Excluir uma mensalidade
// @access  Private (Admin ou Gerente)
router.delete('/:id', auth, async (req, res) => {
  const usuarioLogado = await Usuario.findById(req.usuario.id);
  if (!['admin', 'gerente', 'funcionario'].includes(usuarioLogado.role)) {
    return res.status(403).json({ msg: 'Acesso negado para excluir mensalidades.' });
  }

  try {
    const mensalidade = await Mensalidade.findById(req.params.id);
    if (!mensalidade) {
      return res.status(404).json({ msg: 'Mensalidade não encontrada.' });
    }

    await Mensalidade.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Mensalidade excluída com sucesso.' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' });
  }
});

module.exports = router;