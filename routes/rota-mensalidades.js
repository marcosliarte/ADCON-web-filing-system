const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');

const Mensalidade = require('../model-mensalidade'); // CORREÇÃO: Aponta para o arquivo na raiz do projeto
const Empresa = require('../models/model-empresa');
const Usuario = require('../models/model-usuario');

// @route   GET api/mensalidades/status-geral
// @desc    Listar todas as empresas e o status da mensalidade para um mês/ano
// @access  Private (Admin ou Gerente)
router.get('/status-geral', auth, async (req, res) => {
  const usuarioLogado = await Usuario.findById(req.usuario.id);
  if (!['admin', 'gerente'].includes(usuarioLogado.role)) {
    return res.status(403).json({ msg: 'Acesso negado.' });
  }

  try {
    const mes = parseInt(req.query.mes);
    const ano = parseInt(req.query.ano);

    if (!mes || !ano) {
      return res.status(400).json({ msg: 'Mês e ano são obrigatórios.' });
    }

    const dataFiltro = new Date(ano, mes - 1, 1);

    const empresasComMensalidade = await Empresa.aggregate([
      {
        // Passo 1: Buscar a mensalidade EXATA do período para cada empresa.
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
        // Passo 2: Se não houver mensalidade exata, buscar a MAIS RECENTE ANTERIOR ao período.
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
        // Passo 3: Projetar o resultado final.
        $project: {
          nome: 1,
          cnpj: 1,
          valorPadraoMensalidade: 1,
          mensalidade: {
            $cond: {
              if: '$mensalidadeExata',
              then: '$mensalidadeExata', // Se a mensalidade do mês existe, use-a.
              else: { // Se não, crie uma "virtual" para exibição.
                _id: null,
                valor: { $ifNull: ['$mensalidadeAnterior.valor', '$valorPadraoMensalidade'] }, // Usa o valor anterior ou o padrão da empresa.
                status: 'Não Gerada',
              }
            }
          }
        }
      },
      { $sort: { nome: 1 } },
    ]);
    res.json(empresasComMensalidade);
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
    check('dataVencimento', 'A data de vencimento é obrigatória').isISO8601().toDate(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const usuarioLogado = await Usuario.findById(req.usuario.id);
    if (!['admin', 'gerente'].includes(usuarioLogado.role)) {
      return res.status(403).json({ msg: 'Acesso negado.' });
    }

    const { empresaId, mes, ano, valor, dataVencimento } = req.body;

    try {
      if (await Mensalidade.findOne({ empresaId, mes, ano })) {
        return res.status(400).json({ msg: `Já existe uma mensalidade para esta empresa em ${mes}/${ano}.` });
      }

      const novaMensalidade = new Mensalidade({ empresaId, valor, mes, ano, dataVencimento });
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
  if (!['admin', 'gerente'].includes(usuarioLogado.role)) {
    return res.status(403).json({ msg: 'Acesso negado.' });
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
  if (!['admin', 'gerente'].includes(usuarioLogado.role)) {
    return res.status(403).json({ msg: 'Acesso negado.' });
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