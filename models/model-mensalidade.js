const mongoose = require('mongoose');

const MensalidadeSchema = new mongoose.Schema({
    empresaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Empresa',
        required: true,
    },
    valor: {
        type: Number,
        required: true,
    },
    mes: {
        type: Number,
        required: true,
        min: 1,
        max: 12,
    },
    ano: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['Pendente', 'Pago', 'Atrasado'],
        default: 'Pendente',
    },
    dataVencimento: {
        type: Date,
    },
    dataPagamento: {
        type: Date,
    },
});

MensalidadeSchema.index({ empresaId: 1, mes: 1, ano: 1 }, { unique: true });

module.exports = mongoose.model('Mensalidade', MensalidadeSchema);