const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Seu middleware de autenticação

// CORREÇÃO: Aponta para os arquivos de modelo corretos.
const Funcionario = require('../models/model-funcionario');
// O modelo 'Despesa' é definido em 'rota-relatorios.js', então o buscamos diretamente do Mongoose.
const Despesa = require('mongoose').model('Despesa');
/**
 * @route   GET /api/pagamentos/meus-pagamentos
 * @desc    Busca o histórico de pagamentos (holerites) do funcionário logado
 * @access  Private
 */
router.get('/meus-pagamentos', auth, async (req, res) => {
    try {
        // 1. Encontrar o funcionário vinculado ao ID do usuário logado
        // CORREÇÃO: O campo correto é 'usuario', não 'usuarioVinculado'.
        const funcionario = await Funcionario.findOne({ usuario: req.usuario.id }).lean();

        // Se não encontrar um funcionário vinculado, retorna uma lista vazia.
        // Isso é normal para usuários que não são funcionários (ex: admin sem vínculo).
        if (!funcionario || !funcionario.historicoPagamentos || funcionario.historicoPagamentos.length === 0) {
            return res.json([]);
        }

        // 2. CORREÇÃO: Os pagamentos estão no histórico do próprio funcionário.
        const pagamentos = funcionario.historicoPagamentos;

        // 3. Formatar os dados para corresponder ao que o frontend espera
        const holerites = pagamentos.map(p => ({
            _id: p._id, // ID para referência
            mesReferencia: new Date(p.ano, p.mes - 1),
            salarioBase: p.salarioBase,
            adicionais: p.adicionais || [], // Lista de bônus/adicionais
            descontosFixos: p.descontosFixos || [], // Lista de descontos fixos
            descontosVariaveis: p.descontosVariaveis || [], // Lista de descontos do mês
            totalProventos: p.totalProventos,
            totalDescontos: p.totalDescontos,
            salarioLiquido: p.salarioLiquido,
            dataPagamento: p.dataPagamento, // Data em que o pagamento foi feito
            formaPagamento: p.formaPagamento // Ex: PIX, Dinheiro
        })).sort((a, b) => b.mesReferencia - a.mesReferencia); // Ordena do mais recente para o mais antigo

        res.json(holerites);
    } catch (error) {
        console.error('Erro ao buscar pagamentos:', error.message);
        res.status(500).send('Erro no servidor ao buscar pagamentos.');
    }
});

module.exports = router;