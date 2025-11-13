const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notificacao = require('../models/model-notificacao');

/**
 * @route   GET /api/notificacoes
 * @desc    Busca as últimas 20 notificações do usuário logado
 */
router.get('/', auth, async (req, res) => {
    try {
        const notificacoes = await Notificacao.find({ id_usuario: req.usuario.id })
            .sort({ criado_em: -1 })
            .limit(20);
        res.json(notificacoes);
    } catch (err) {
        console.error('Erro ao buscar notificações:', err.message);
        res.status(500).json({ msg: 'Erro no Servidor' });
    }
});

/**
 * @route   GET /api/notificacoes/contagem-nao-lidas
 * @desc    Retorna a contagem de notificações não lidas
 */
router.get('/contagem-nao-lidas', auth, async (req, res) => {
    try {
        const count = await Notificacao.countDocuments({ id_usuario: req.usuario.id, lida: false });
        res.json({ count });
    } catch (err) {
        console.error('Erro ao contar notificações:', err.message);
        res.status(500).json({ msg: 'Erro no Servidor' });
    }
});

/**
 * @route   POST /api/notificacoes/marcar-como-lidas
 * @desc    Marca todas as notificações do usuário como lidas
 */
router.post('/marcar-como-lidas', auth, async (req, res) => {
    try {
        await Notificacao.updateMany({ id_usuario: req.usuario.id, lida: false }, { $set: { lida: true } });
        res.json({ msg: 'Notificações marcadas como lidas.' });
    } catch (err) {
        console.error('Erro ao marcar notificações como lidas:', err.message);
        res.status(500).json({ msg: 'Erro no Servidor' });
    }
});

/**
 * @route   GET /api/notificacoes/todas
 * @desc    Busca todas as notificações do usuário com paginação
 */
router.get('/todas', auth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const skip = (page - 1) * limit;

        const notificacoes = await Notificacao.find({ id_usuario: req.usuario.id })
            .sort({ criado_em: -1 })
            .skip(skip)
            .limit(limit)
            .lean(); // .lean() para melhor performance em leituras

        const total = await Notificacao.countDocuments({ id_usuario: req.usuario.id });

        res.json({
            notificacoes,
            total,
            pages: Math.ceil(total / limit)
        });
    } catch (err) {
        res.status(500).json({ msg: 'Erro no Servidor' });
    }
});

/**
 * @route   DELETE /api/notificacoes/:id
 * @desc    Exclui uma notificação específica do usuário logado
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        const notificacao = await Notificacao.findOne({ _id: req.params.id, id_usuario: req.usuario.id });

        if (!notificacao) {
            return res.status(404).json({ msg: 'Notificação não encontrada ou você não tem permissão para excluí-la.' });
        }

        await Notificacao.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Notificação excluída com sucesso.' });
    } catch (err) {
        console.error('Erro ao excluir notificação:', err.message);
        res.status(500).json({ msg: 'Erro no Servidor' });
    }
});

/**
 * @route   GET /api/notificacoes/:id
 * @desc    Busca uma notificação específica pelo ID
 */
router.get('/:id', auth, async (req, res) => {
    try {
        const notificacao = await Notificacao.findOne({
            _id: req.params.id,
            id_usuario: req.usuario.id // Garante que o usuário só possa ver suas próprias notificações
        });

        if (!notificacao) {
            return res.status(404).json({ msg: 'Notificação não encontrada.' });
        }
        res.json(notificacao);
    } catch (err) {
        res.status(500).json({ msg: 'Erro no Servidor' });
    }
});

module.exports = router;