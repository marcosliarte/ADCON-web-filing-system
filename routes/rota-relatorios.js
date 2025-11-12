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
        // CORREÇÃO: Buscar pelo mês e ano da mensalidade, não pela data de vencimento.
        const mensalidades = await Mensalidade.find({
            ano: parseInt(ano),
            mes: parseInt(mes)
        }).populate('empresaId', 'nome cnpj');

        const totalMensalidades = mensalidades.length;
        const pagas = mensalidades.filter(m => m.status === 'Pago');
        
        // CORREÇÃO: Verifica se dataVencimento existe antes de comparar.
        // Se não existir, considera como pendente para não quebrar a aplicação.
        const hoje = new Date();
        const pendentes = mensalidades.filter(m => m.status === 'Pendente' && (!m.dataVencimento || hoje < m.dataVencimento));
        const atrasadas = mensalidades.filter(m => m.status !== 'Pago' && m.dataVencimento && hoje >= m.dataVencimento);

        // CORREÇÃO 2: Renomear 'empresaId' para 'empresa' para o frontend funcionar
        const formatarLista = (lista) => {
            return lista.map(item => {
                const itemObj = item.toObject(); // Converte para um objeto simples
                itemObj.empresa = itemObj.empresaId;
                delete itemObj.empresaId;
                return itemObj;
            });
        };

        const listaPagas = formatarLista(pagas);
        const listaPendentes = formatarLista(pendentes);
        const listaAtrasadas = formatarLista(atrasadas);

        const receita = listaPagas.reduce((acc, m) => acc + m.valor, 0);

        res.json({
            periodo: { ano, mes },
            totalMensalidades,
            receita,
            pagas: {
                quantidade: pagas.length,
                lista: listaPagas
            },
            pendentes: {
                quantidade: pendentes.length,
                lista: listaPendentes
            },
            atrasadas: {
                quantidade: atrasadas.length,
                lista: listaAtrasadas
            }
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor' });
    }
});

module.exports = router;