const mongoose = require('mongoose');

const DespesaSchema = new mongoose.Schema({
    descricao: { type: String, required: true, trim: true },
    valor: { type: Number, required: true },
    tipo: {
        type: String,
        required: true,
        enum: ['unica', 'fixa', 'parcelada'],
        default: 'unica'
    },
    data: { type: Date }, // Usado para despesa 'unica'
    dataInicio: { type: Date }, // Usado para despesa 'fixa' e 'parcelada'
    diaVencimento: { type: Number, min: 1, max: 31 }, // Dia do mês para recorrência
    totalParcelas: { type: Number }, // Apenas para tipo 'parcelada'
    status: { // Apenas para tipo 'fixa'
        type: String,
        enum: ['ativa', 'cancelada'],
        default: 'ativa'
    }
}, {
    timestamps: true // Adiciona createdAt e updatedAt
});

module.exports = mongoose.model('Despesa', DespesaSchema);