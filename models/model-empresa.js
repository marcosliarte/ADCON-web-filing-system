const mongoose = require('mongoose');

const empresaSchema = new mongoose.Schema({
  cnpj: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^\d{14}$/.test(v);
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
    required: false
  }
});

const Empresa = mongoose.model('Empresa', empresaSchema);

module.exports = Empresa;