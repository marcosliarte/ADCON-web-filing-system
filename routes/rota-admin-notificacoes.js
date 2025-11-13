const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Usuario = require('../models/model-usuario');
const Notificacao = require('../models/model-notificacao');

/**
 * @route   POST /api/admin/notificacoes/enviar
 * @desc    Admin envia uma notificação para usuários
 */
router.post('/enviar', [auth, adminAuth], async (req, res) => {
    const { destinatarioTipo, destinatarioValor, mensagem, link } = req.body;

    if (!destinatarioTipo || !mensagem) {
        return res.status(400).json({ msg: 'Por favor, forneça o tipo de destinatário e a mensagem.' });
    }

    try {
        let userIds = [];

        switch (destinatarioTipo) {
            case 'todos':
                const todosUsuarios = await Usuario.find().select('_id');
                userIds = todosUsuarios.map(u => u._id);
                break;
            case 'perfil':
                if (!destinatarioValor) return res.status(400).json({ msg: 'Perfil não especificado.' });
                const usuariosPorPerfil = await Usuario.find({ role: destinatarioValor }).select('_id');
                userIds = usuariosPorPerfil.map(u => u._id);
                break;
            case 'especifico':
                if (!destinatarioValor) return res.status(400).json({ msg: 'Usuário não especificado.' });
                const usuarioEspecifico = await Usuario.findById(destinatarioValor).select('_id');
                if (!usuarioEspecifico) return res.status(404).json({ msg: 'Usuário não encontrado.' });
                userIds.push(usuarioEspecifico._id);
                break;
            default:
                return res.status(400).json({ msg: 'Tipo de destinatário inválido.' });
        }

        if (userIds.length === 0) {
            return res.status(404).json({ msg: 'Nenhum usuário encontrado para os critérios fornecidos.' });
        }

        const notificacoesParaInserir = userIds.map(userId => ({
            id_usuario: userId,
            mensagem: mensagem,
            link: link || null
        }));

        await Notificacao.insertMany(notificacoesParaInserir);

        res.json({ msg: `Notificação enviada com sucesso para ${userIds.length} usuário(s).` });

    } catch (err) {
        console.error('Erro ao enviar notificação:', err.message);
        res.status(500).json({ msg: 'Erro no Servidor' });
    }
});

/**
 * @route   DELETE /api/admin/notificacoes/batch/:batchId
 * @desc    Admin exclui um lote inteiro de notificações
 */
router.delete('/batch/:batchId', [auth, adminAuth], async (req, res) => {
    try {
        const { batchId } = req.params;

        // Valida se o batchId é um ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(batchId)) {
            return res.status(400).json({ msg: 'ID de lote inválido.' });
        }

        const result = await Notificacao.deleteMany({ batchId: batchId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ msg: 'Nenhuma notificação encontrada para este lote.' });
        }

        res.json({ msg: `${result.deletedCount} notificação(ões) foram excluídas com sucesso.` });
    } catch (err) {
        console.error('Erro ao excluir lote de notificações:', err.message);
        res.status(500).json({ msg: 'Erro no Servidor' });
    }
});

module.exports = router;