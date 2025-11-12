const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const Empresa = require('../models/model-empresa');
const Mensalidade = require('../model-mensalidade'); // CORREÇÃO: Aponta para o arquivo na raiz do projeto

// @route   GET api/relatorios/geral
// @desc    Obter um relatório geral (total de clientes, etc.)
// @access  Private (Admin, Gerente)
router.get('/geral', [auth, adminAuth], async (req, res) => {
    try {
        const totalClientes = await Empresa.countDocuments();

        // Para as próximas métricas, precisaremos de um campo que indique se a empresa é um cliente ativo/pagante.
        // Esta é uma lógica simplificada. O ideal seria ter um status na própria empresa.
        const clientesComMensalidade = await Mensalidade.distinct('empresa');

        res.json({
            totalClientes,
            clientesAtivos: clientesComMensalidade.length,
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

// @route   GET api/relatorios/mensal
// @desc    Obter relatório financeiro de um mês/ano específico
// @access  Private (Admin, Gerente)
router.get('/mensal', [auth, adminAuth], async (req, res) => {
    const { ano, mes } = req.query;

    if (!ano || !mes) {
        return res.status(400).json({ msg: 'Ano e mês são obrigatórios.' });
    }

    try {
        const primeiroDia = new Date(ano, mes - 1, 1);
        const ultimoDia = new Date(ano, mes, 0, 23, 59, 59);

        // Busca mensalidades com vencimento no período
        const mensalidades = await Mensalidade.find({
            dataVencimento: { $gte: primeiroDia, $lte: ultimoDia }
        }).populate('empresa', 'nome cnpj');

        const totalMensalidades = mensalidades.length;
        const pagas = mensalidades.filter(m => m.status === 'paga');
        const pendentes = mensalidades.filter(m => m.status === 'pendente' && new Date() < m.dataVencimento);
        const atrasadas = mensalidades.filter(m => m.status !== 'paga' && new Date() >= m.dataVencimento);

        const receita = pagas.reduce((acc, m) => acc + m.valor, 0);

        res.json({
            periodo: { ano, mes },
            totalMensalidades,
            receita,
            pagas: {
                quantidade: pagas.length,
                lista: pagas
            },
            pendentes: {
                quantidade: pendentes.length,
                lista: pendentes
            },
            atrasadas: {
                quantidade: atrasadas.length,
                lista: atrasadas
            }
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

module.exports = router;