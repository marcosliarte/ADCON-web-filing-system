const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Faturamento = require('../models/model-faturamento');
const Empresa = require('../models/model-empresa');

// @route   POST /api/faturamento
// @desc    Salvar faturamento mensal de uma empresa
// @access  Private (admin)
router.post('/', [auth, adminAuth], async (req, res) => {
  try {
    const { empresaId, faturamentos } = req.body;

    // Verificar se a empresa existe
    const empresa = await Empresa.findById(empresaId);
    if (!empresa) {
      return res.status(404).json({ msg: 'Empresa não encontrada' });
    }

    // Buscar ou criar registro de faturamento
    let faturamento = await Faturamento.findOne({ empresaId });
    
    if (!faturamento) {
      faturamento = new Faturamento({ empresaId, meses: [] });
    }

    // Atualizar cada mês do faturamento
    faturamentos.forEach(({ mes, ano, valor }) => {
      faturamento.atualizarMes(mes, ano, valor);
    });

    await faturamento.save();

    res.json({ 
      msg: 'Faturamento salvo com sucesso', 
      faturamento 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Erro ao salvar faturamento' });
  }
});

// @route   GET /api/faturamento/:empresaId
// @desc    Buscar faturamento de uma empresa
// @access  Private
router.get('/:empresaId', auth, async (req, res) => {
  try {
    const { empresaId } = req.params;
    const { mesInicio, anoInicio, mesFim, anoFim } = req.query;

    const faturamento = await Faturamento.findOne({ empresaId });

    if (!faturamento) {
      return res.json({ meses: [] });
    }

    // Se houver filtro de período
    if (mesInicio && anoInicio && mesFim && anoFim) {
      const mesesFiltrados = faturamento.buscarPeriodo(
        parseInt(mesInicio),
        parseInt(anoInicio),
        parseInt(mesFim),
        parseInt(anoFim)
      );
      return res.json({ meses: mesesFiltrados });
    }

    // Retornar todos os meses (últimos 24)
    const mesesOrdenados = faturamento.meses.sort((a, b) => {
      if (a.ano !== b.ano) return a.ano - b.ano;
      return a.mes - b.mes;
    });

    res.json({ meses: mesesOrdenados });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Erro ao buscar faturamento' });
  }
});

// @route   GET /api/faturamento/:empresaId/ultimos/:quantidade
// @desc    Buscar últimos N meses de faturamento
// @access  Private
router.get('/:empresaId/ultimos/:quantidade', auth, async (req, res) => {
  try {
    const { empresaId, quantidade } = req.params;
    const qtd = Math.min(parseInt(quantidade), 24); // Máximo 24 meses

    const faturamento = await Faturamento.findOne({ empresaId });

    if (!faturamento) {
      return res.json({ meses: [] });
    }

    // Ordenar por data e pegar os últimos N meses
    const mesesOrdenados = faturamento.meses
      .sort((a, b) => {
        if (a.ano !== b.ano) return b.ano - a.ano;
        return b.mes - a.mes;
      })
      .slice(0, qtd)
      .reverse();

    res.json({ meses: mesesOrdenados });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Erro ao buscar faturamento' });
  }
});

// @route   DELETE /api/faturamento/:empresaId/:ano/:mes
// @desc    Deletar faturamento de um mês específico
// @access  Private (admin)
router.delete('/:empresaId/:ano/:mes', [auth, adminAuth], async (req, res) => {
  try {
    const { empresaId, ano, mes } = req.params;

    const faturamento = await Faturamento.findOne({ empresaId });

    if (!faturamento) {
      return res.status(404).json({ msg: 'Faturamento não encontrado' });
    }

    // Remover o mês específico
    faturamento.meses = faturamento.meses.filter(
      m => !(m.mes === parseInt(mes) && m.ano === parseInt(ano))
    );

    faturamento.dataAtualizacao = Date.now();
    await faturamento.save();

    res.json({ msg: 'Faturamento do mês removido com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Erro ao deletar faturamento' });
  }
});

module.exports = router;
