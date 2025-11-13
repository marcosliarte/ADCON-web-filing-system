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
    mesInicio: { // Mês de início da aplicação do desconto (1-12)
        type: Number,
        min: 1,
        max: 12
    },
    anoInicio: { // Ano de início da aplicação do desconto
        type: Number
    },
    mesesDuracao: { // Quantidade de meses que o desconto será aplicado (-1 para indefinido/permanente)
        type: Number,
        default: -1 // -1 significa que o desconto é permanente
    }
}, { _id: false }); // _id: false para não criar IDs para cada desconto individualmente

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
    descontos: [DescontoSchema], // Array de descontos fixos
    historicoPagamentos: [PagamentoSchema] // Novo campo para o histórico
});

module.exports = mongoose.model('Funcionario', FuncionarioSchema);