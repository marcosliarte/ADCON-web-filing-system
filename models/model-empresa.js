const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

// --- Sub-documentos para organização ---

// Schema para Endereço (reutilizável para empresa e sócios)
const EnderecoSchema = new mongoose.Schema({
  cep: { type: String },
  rua: { type: String },
  numero: { type: String },
  complemento: { type: String },
  bairro: { type: String },
  cidade: { type: String },
  estado: { type: String },
}, { _id: false });

// Schema para cada Sócio
const SocioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  cpf: { type: String, required: true },
  rg: { type: String },
  data_nascimento: { type: Date },
  is_admin: { type: String, enum: ['sim', 'nao'], default: 'nao' },
  estado_civil: { type: String },
  regime_casamento: { type: String },
  endereco: EnderecoSchema,
}, { _id: false });

// Schema para cada Contrato (original e alterações)
const ContratoSchema = new mongoose.Schema({
  nomeArquivo: { type: String, required: true },
  caminhoArquivo: { type: String, required: true },
  dataAlteracao: { type: Date },
  numeroAlteracao: { type: String },
}, { _id: false });

// Schema para agrupar todos os documentos da empresa
const DocumentosEmpresaSchema = new mongoose.Schema({
  cartaoCnpj: {
    nomeArquivo: String,
    caminhoArquivo: String,
  },
  certificadoDigital: {
    nomeArquivo: String,
    caminhoArquivo: String,
    dataValidade: Date,
  },
  contratos: [ContratoSchema],
}, { _id: false });


// --- Schema Principal da Empresa ---

const EmpresaSchema = mongoose.Schema({
  nome: { type: String, required: true },
  cnpj: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  nome_fantasia: { type: String },
  data_abertura: { type: Date },
  capital_social: { type: String },
  atividade_principal: { type: String },
  atividade_principal_descricao: { type: String }, // Novo campo para a descrição
  porte: { type: String },
  natureza_juridica: { type: String },
  possui_filial: { type: String },
  simples_nacional: { type: String },
  telefone: { type: String },
  endereco: EnderecoSchema,
  socios: [SocioSchema],
  documentos: DocumentosEmpresaSchema,
  dataCadastro: { type: Date, default: Date.now },
});

EmpresaSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('Empresa', EmpresaSchema);