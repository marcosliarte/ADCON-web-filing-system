const mongoose = require('mongoose');

const FilaServicoSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['alteracao_empresa', 'abertura_empresa', 'encerramento_empresa', 'declaracao_fiscal', 'certidao_negativa', 'certificado_digital', 'consultoria', 'outro'],
    default: 'outro'
  },
  titulo: { type: String, required: true, trim: true },
  descricao: { type: String, trim: true },
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa' },
  funcionario: { type: mongoose.Schema.Types.ObjectId, ref: 'Funcionario' },
  responsavel: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  status: {
    type: String,
    enum: ['pendente', 'em_andamento', 'concluido', 'cancelado'],
    default: 'pendente'
  },
  prioridade: {
    type: String,
    enum: ['baixa', 'normal', 'alta'],
    default: 'normal'
  },
  dataPrevisao: { type: Date }
}, { timestamps: true });

FilaServicoSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('FilaServico', FilaServicoSchema);
