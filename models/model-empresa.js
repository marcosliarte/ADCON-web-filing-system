const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const CertidaoSchema = mongoose.Schema({
  nomeArquivo: {
    type: String,
    required: true,
  },
  caminhoArquivo: {
    type: String,
    required: true,
  },
  dataUpload: {
    type: Date,
    default: Date.now,
  },
  dataValidade: {
    type: Date,
  },
});

const EmpresaSchema = mongoose.Schema({
  cnpj: {
    type: String,
    required: true,
    unique: true,
  },
  nome: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
  },
  certidoes: [CertidaoSchema],
  dataCadastro: { type: Date, default: Date.now },
});

EmpresaSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Empresa', EmpresaSchema);