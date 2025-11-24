require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('./models/model-usuario');

// Utiliza a mesma lógica do server.js para obter a URI do MongoDB
const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;

const ADMIN_EMAIL = 'marcos.liarte.neves@gmail.com';
const ADMIN_SENHA = '91886129';
const ADMIN_NOME = 'Marcos Antonio Liarte Neves';

const createAdmin = async () => {
  try {
    // Conectar ao MongoDB
    if (!mongoURI) {
      throw new Error('A variável de ambiente MONGODB_URI ou MONGODB_URI_LOCAL não foi definida no arquivo .env');
    }

    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const dbType = mongoURI.includes('127.0.0.1') || mongoURI.includes('localhost') ? 'local' : 'produção';
    console.log(`Conectado ao MongoDB (${dbType})`);

    // Verificar se o admin já existe
    const adminExists = await Usuario.findOne({ email: ADMIN_EMAIL });
    if (adminExists) {
      console.log('Usuário administrador já existe.');
      process.exit(0);
      return;
    }

    // Criar o usuário admin
    const admin = new Usuario({
      nome: ADMIN_NOME,
      email: ADMIN_EMAIL,
      senha: ADMIN_SENHA,
      role: 'admin',
    });

    await admin.save();
    console.log('Usuário administrador criado com sucesso!');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Senha: ${ADMIN_SENHA}`);

    process.exit(0);
  } catch (error) {
    console.error('Erro ao criar o usuário administrador:', error.message);
    process.exit(1);
  }
};

createAdmin();
