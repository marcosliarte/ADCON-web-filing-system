const mongoose = require('mongoose');

const EnderecoSchema = new mongoose.Schema({
    logradouro: String, numero: String, complemento: String, cep: String, bairro: String, cidade: String, uf: String,
}, { _id: false });

const PagamentoFuncionarioSchema = new mongoose.Schema({
    mes: { type: Number, required: true },
    ano: { type: Number, required: true },
    salarioBase: { type: Number, required: true },
    adicionais: [{ descricao: String, valor: Number }],
    descontosFixos: [{ descricao: String, valor: Number }],
    descontosVariaveis: [{ descricao: String, valor: Number }],
    formaPagamento: String, // 'pix', 'dinheiro', 'outro'
    chavePix: String, // Chave usada no momento do pagamento
    totalProventos: { type: Number, required: true },
    totalDescontos: { type: Number, required: true },
    salarioLiquido: { type: Number, required: true },
    dataPagamento: { type: Date, default: Date.now },
    status: { type: String, enum: ['Pago', 'Pendente'], default: 'Pago' }
});

const DescontoSchema = new mongoose.Schema({
    descricao: { type: String, required: true, trim: true },
    valor: { type: Number, required: true },
    mesInicio: { type: Number, min: 1, max: 12 },
    anoInicio: { type: Number },
    mesesDuracao: { type: Number, default: -1 } // -1 para indefinido/permanente
}, { _id: false });

const FuncionarioSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    cargo: { type: String, required: true },
    salarioBruto: { type: Number, required: true },
    chavePix: String, // Chave PIX padrão do funcionário
    dataAdmissao: { type: Date, default: Date.now },
    descontos: { type: [DescontoSchema], default: [] },
    historicoPagamentos: { type: [PagamentoFuncionarioSchema], default: [] } // Histórico de pagamentos
});

const TemaSchema = new mongoose.Schema({
    primary:     String,
    primaryDark: String,
    bg:          String,
}, { _id: false });

// Schema principal
const ConfiguracaoEmpresaSchema = new mongoose.Schema({
    identificador: { type: String, default: 'adcon_config', unique: true },
    nomeEmpresa: String,
    cnpj: String,
    endereco: EnderecoSchema,
    telefone: String,
    email: String,
    logotipoUrl: String,
    tema: { type: TemaSchema, default: {} },
    funcionarios: { type: [FuncionarioSchema], default: [] }
});

module.exports = mongoose.model('ConfiguracaoEmpresa', ConfiguracaoEmpresaSchema);