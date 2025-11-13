const mongoose = require('mongoose');

// Schema para o histórico de pagamentos (subdocumento)
const PagamentoSchema = new mongoose.Schema({
    mes: { type: Number, required: true },
    ano: { type: Number, required: true },
    salarioBase: { type: Number, required: true },
    adicionais: [{ descricao: String, valor: Number }],
    descontosFixos: [{ descricao: String, valor: Number }],
    descontosVariaveis: [{ descricao: String, valor: Number }],
    totalProventos: { type: Number, required: true },
    totalDescontos: { type: Number, required: true },
    salarioLiquido: { type: Number, required: true },
    dataPagamento: { type: Date, default: Date.now },
    status: { type: String, enum: ['Pago', 'Pendente'], default: 'Pago' }
});

// Schema para os descontos (subdocumento)
const DescontoSchema = new mongoose.Schema({
    descricao: {
        type: String,
        required: true,
        trim: true
    },
    valor: {
        type: Number,
        required: true
    },
    mesInicio: { type: Number, min: 1, max: 12 },
    anoInicio: { type: Number },
    mesesDuracao: { type: Number, default: -1 }
}, { _id: false });

// Schema principal do Funcionário
const FuncionarioSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: [true, 'O nome do funcionário é obrigatório.'],
        trim: true
    },
    cargo: {
        type: String,
        required: [true, 'O cargo do funcionário é obrigatório.'],
        trim: true
    },
    salarioBruto: {
        type: Number,
        required: [true, 'O salário bruto é obrigatório.']
    },
    descontos: [DescontoSchema],
    historicoPagamentos: [PagamentoSchema]
});

module.exports = mongoose.model('Funcionario', FuncionarioSchema);