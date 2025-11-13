const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const Empresa = require('../models/model-empresa');
const Mensalidade = require('../models/model-mensalidade'); // CORREÇÃO: Aponta para o arquivo correto na pasta models

// @route   GET api/relatorios/geral
// @desc    Obter um relatório geral (total de clientes, etc.)
// @access  Private (Admin, Gerente)
router.get('/geral', [auth, adminAuth], async (req, res) => {
    try {
        const totalClientes = await Empresa.countDocuments();

        // Conta como "cliente pagante" qualquer empresa que já teve ao menos uma mensalidade com status "Pago".
        const clientesPagantes = await Mensalidade.distinct('empresaId', {
            status: 'Pago'
        });

        res.json({
            totalClientes,
            clientesPagantes: clientesPagantes.length,
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
        // REESTRUTURAÇÃO COMPLETA DA LÓGICA
        // 1. Busca as mensalidades do período e já popula os dados da empresa.
        //    Usa .lean() para retornar objetos JS puros, o que é mais rápido e seguro.
        const mensalidades = await Mensalidade.find({
            ano: parseInt(ano),
            mes: parseInt(mes)
        }).populate('empresaId', 'nome cnpj').lean();

        const totalMensalidades = mensalidades.length;
        const pagas = mensalidades.filter(m => m.status === 'Pago');
        
        // 2. Lógica de classificação precisa baseada na data de hoje.
        //    Normaliza 'hoje' para o início do dia para evitar problemas com fuso horário.
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const pendentes = mensalidades.filter(m => 
            m.status === 'Pendente' && m.dataVencimento && new Date(m.dataVencimento) >= hoje
        );
        const atrasadas = mensalidades.filter(m => 
            m.status !== 'Pago' && m.dataVencimento && new Date(m.dataVencimento) < hoje
        );

        // 3. Formata a lista para o front-end, renomeando 'empresaId' para 'empresa'.
        const formatarLista = (lista) => lista.map(item => ({ ...item, empresa: item.empresaId, empresaId: undefined }));

        const listaPagas = formatarLista(pagas);
        const listaPendentes = formatarLista(pendentes);
        const listaAtrasadas = formatarLista(atrasadas);

        const receita = pagas.reduce((acc, m) => acc + m.valor, 0);

        res.json({
            periodo: { ano, mes },
            totalMensalidades,
            receita,
            pagas: { quantidade: pagas.length, lista: listaPagas },
            pendentes: { quantidade: pendentes.length, lista: listaPendentes },
            atrasadas: { quantidade: atrasadas.length, lista: listaAtrasadas }
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

// @route   GET api/relatorios/anual
// @desc    Obter relatório financeiro anual (receita por mês)
// @access  Private (Admin, Gerente)
router.get('/anual', [auth, adminAuth], async (req, res) => {
    const { ano } = req.query;

    if (!ano) {
        return res.status(400).json({ msg: 'O ano é obrigatório.' });
    }

    try {
        const receitaAnual = await Mensalidade.aggregate([
            // 1. Filtrar mensalidades pagas do ano especificado
            { $match: { ano: parseInt(ano), status: 'Pago' } },
            // 2. Agrupar por mês e somar os valores
            { $group: { _id: '$mes', receitaTotal: { $sum: '$valor' } } },
            // 3. Ordenar pelo mês
            { $sort: { _id: 1 } }
        ]);

        res.json(receitaAnual);

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao gerar relatório anual' });
    }
});

module.exports = router;