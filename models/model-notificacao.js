const mongoose = require('mongoose');

const NotificacaoSchema = new mongoose.Schema({
  usuarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  tipo: {
    type: String,
    enum: ['documento_vencendo', 'documento_vencido', 'pagamento_recebido', 'mensagem_admin', 'sistema'],
    required: true
  },
  titulo: {
    type: String,
    required: true
  },
  mensagem: {
    type: String,
    required: true
  },
  lida: {
    type: Boolean,
    default: false
  },
  link: {
    type: String, // URL para onde a notificação deve direcionar
  },
  dadosAdicionais: {
    empresaId: mongoose.Schema.Types.ObjectId,
    empresaNome: String,
    documentoTipo: String,
    dataValidade: Date,
    pagamentoId: mongoose.Schema.Types.ObjectId,
    valorPagamento: Number
  },
  criadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario' // Para mensagens do admin
  }
}, {
  timestamps: true
});

// Índices para otimizar consultas
NotificacaoSchema.index({ usuarioId: 1, lida: 1, createdAt: -1 });
NotificacaoSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notificacao', NotificacaoSchema);
