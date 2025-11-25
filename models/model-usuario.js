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
    // CORREÇÃO: Adicionado 'gerente' à lista de perfis permitidos
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
});

// Hash da senha antes de salvar
UsuarioSchema.pre('save', async function (next) {
  if (!this.isModified('senha')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.senha = await bcrypt.hash(this.senha, salt);
});

// Método para comparar senha
UsuarioSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.senha);
};

module.exports = mongoose.model('Usuario', UsuarioSchema);