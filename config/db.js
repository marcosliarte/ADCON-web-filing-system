const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout de conexão
      maxPoolSize: 10, // Limite de conexões simultâneas
      minPoolSize: 2,
    });
    
    // Não expor URI completa nos logs (pode conter senha)
    const isLocal = process.env.MONGODB_URI.includes('127.0.0.1') || 
                    process.env.MONGODB_URI.includes('localhost');
    console.log(`✅ MongoDB conectado [${isLocal ? 'LOCAL' : 'REMOTO'}]`);
  } catch (err) {
    // Não logar erro completo que pode conter URI com senha
    console.error('❌ Erro ao conectar MongoDB:', err.message);
    process.exit(1);
  }
};

// Tratamento de erros de conexão após conectado
mongoose.connection.on('error', (err) => {
  console.error('❌ Erro MongoDB:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB desconectado');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🔌 MongoDB desconectado por encerramento do app');
  process.exit(0);
});

module.exports = connectDB;
