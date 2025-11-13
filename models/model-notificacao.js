const mongoose = require('mongoose');

const NotificacaoSchema = new mongoose.Schema({
    id_usuario: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario', // Referencia o seu modelo de usuário
        required: true,
        index: true // Adiciona um índice para otimizar a busca por usuário
    },
    mensagem: {
        type: String,
        required: true,
    },
    link: {
        type: String,
    },
    lida: {
        type: Boolean,
        default: false,
    },
    criado_em: {
        type: Date,
        default: Date.now,
    },
    // NOVO: ID para agrupar notificações enviadas em massa pelo admin
    batchId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true
    }
});

module.exports = mongoose.model('Notificacao', NotificacaoSchema);