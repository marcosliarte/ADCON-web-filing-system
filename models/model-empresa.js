const mongoose = require('mongoose');

// Esquema da empresa
const empresaSchema = new mongoose.Schema({
  cnpj: { 
    type: String, 
    required: true, 
    unique: true, // Garante que o CNPJ não se repita no banco
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{14}$/.test(v); // CNPJ com exatamente 14 dígitos numéricos
      },
      message: props => `${props.value} não é um CNPJ válido!`
    }
  },
  nome: { 
    type: String, 
    required: true,
    trim: true
  },
  arquivo: { 
    type: String, 
    required: true
  }
});

const Empresa = mongoose.model('Empresa', empresaSchema);

module.exports = Empresa;
