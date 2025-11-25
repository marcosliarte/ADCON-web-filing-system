const mongoose = require('mongoose');

// Schema para armazenar o faturamento mensal de cada empresa
const FaturamentoMensalSchema = new mongoose.Schema({
  mes: { type: Number, required: true, min: 1, max: 12 }, // 1-12
  ano: { type: Number, required: true },
  valor: { type: Number, required: true, default: 0 },
}, { _id: false });

// Schema principal de Faturamento
const FaturamentoSchema = new mongoose.Schema({
  empresaId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Empresa', 
    required: true 
  },
  meses: [FaturamentoMensalSchema], // Array de faturamentos mensais
  dataCriacao: { type: Date, default: Date.now },
  dataAtualizacao: { type: Date, default: Date.now }
});

// Índice composto para garantir que não haja duplicatas de empresa
FaturamentoSchema.index({ empresaId: 1 }, { unique: true });

// Índice para buscar por empresa e mês específico
FaturamentoSchema.index({ empresaId: 1, 'meses.ano': 1, 'meses.mes': 1 });

// Método para adicionar ou atualizar faturamento de um mês
FaturamentoSchema.methods.atualizarMes = function(mes, ano, valor) {
  const index = this.meses.findIndex(m => m.mes === mes && m.ano === ano);
  
  if (index >= 0) {
    this.meses[index].valor = valor;
  } else {
    this.meses.push({ mes, ano, valor });
  }
  
  this.dataAtualizacao = Date.now();
  
  // Manter apenas os últimos 24 meses
  this.limparHistoricoAntigo();
};

// Método para limpar dados com mais de 24 meses
FaturamentoSchema.methods.limparHistoricoAntigo = function() {
  const dataLimite = new Date();
  dataLimite.setMonth(dataLimite.getMonth() - 24);
  
  this.meses = this.meses.filter(m => {
    const dataMes = new Date(m.ano, m.mes - 1);
    return dataMes >= dataLimite;
  });
};

// Método para buscar faturamento de um período
FaturamentoSchema.methods.buscarPeriodo = function(mesInicio, anoInicio, mesFim, anoFim) {
  return this.meses.filter(m => {
    const dataMes = new Date(m.ano, m.mes - 1);
    const dataInicio = new Date(anoInicio, mesInicio - 1);
    const dataFim = new Date(anoFim, mesFim - 1);
    
    return dataMes >= dataInicio && dataMes <= dataFim;
  }).sort((a, b) => {
    if (a.ano !== b.ano) return a.ano - b.ano;
    return a.mes - b.mes;
  });
};

module.exports = mongoose.model('Faturamento', FaturamentoSchema);
