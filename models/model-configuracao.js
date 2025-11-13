const mongoose = require('mongoose');

// Sub-schemas para manter a estrutura organizada
const AtividadeSchema = new mongoose.Schema({
    codigo: String,
    descricao: String,
}, { _id: false });

const EnderecoSchema = new mongoose.Schema({
    logradouro: String,
    numero: String,
    complemento: String,
    cep: String,
    bairro_distrito: String,
    municipio: String,
    uf: String,
}, { _id: false });

const ContatoSchema = new mongoose.Schema({
    telefone: String,
    email: String,
}, { _id: false });

const NaturezaJuridicaSchema = new mongoose.Schema({
    codigo: String,
    descricao: String,
}, { _id: false });

const SituacaoCadastralSchema = new mongoose.Schema({
    status: String,
    data_situacao_cadastral: String,
    motivo_situacao_cadastral: String,
}, { _id: false });

// Schema principal
const ConfiguracaoEmpresaSchema = new mongoose.Schema({
    // Usamos um identificador fixo para garantir que haja apenas um documento nesta coleção (padrão singleton)
    identificador: { type: String, default: 'adcon_config', unique: true },
    cnpj: { type: String, required: true },
    tipo: String,
    data_abertura: String,
    nome_empresarial: { type: String, required: true },
    nome_fantasia: String,
    porte: String,
    atividade_principal: AtividadeSchema,
    natureza_juridica: NaturezaJuridicaSchema,
    endereco: EnderecoSchema,
    contato: ContatoSchema,
    situacao_cadastral: SituacaoCadastralSchema,
});

module.exports = mongoose.model('ConfiguracaoEmpresa', ConfiguracaoEmpresaSchema);