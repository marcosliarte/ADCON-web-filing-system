const mongoose = require('mongoose');

const DespesaSchema = new mongoose.Schema({
    descricao: { type: String, required: true, trim: true },
    valor: { type: Number, required: true },
    data: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Despesa', DespesaSchema);