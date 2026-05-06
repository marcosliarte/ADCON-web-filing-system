const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UsuarioSchema = mongoose.Schema({
  nome: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  senha: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'gerente', 'funcionario', 'empresario'],
    default: 'funcionario',
  },
  fotoPerfilUrl: {
    type: String,
  },
  dataRegistro: {
    type: Date,
    default: Date.now,
  },
  lastActivity: {
    type: Date,
    default: Date.now,
  },
  // Verificação de mudança de e-mail
  emailPendente: { type: String, default: null },
  emailVerificacaoToken: { type: String, default: null }, // hash SHA-256 do token
  emailVerificacaoExpira: { type: Date, default: null },
});

UsuarioSchema.pre('save', async function (next) {
  if (!this.isModified('senha')) return next();
  const salt = await bcrypt.genSalt(10);
  this.senha = await bcrypt.hash(this.senha, salt);
  next();
});

UsuarioSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.senha);
};

module.exports = mongoose.model('Usuario', UsuarioSchema);
