require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('./models/model-usuario');

// Escolher URI de acordo com o ambiente
const isProduction = process.env.NODE_ENV === 'production';
const mongoURI = isProduction 
  ? process.env.MONGODB_URI_PROD 
  : process.env.MONGODB_URI_LOCAL;

const ADMIN_EMAIL = 'marcos.liarte.neves@gmail.com';
const ADMIN_SENHA = '123456';
const ADMIN_NOME = 'Marcos Liarte';

const createAdmin = async () => {
  try {
    // Conectar ao MongoDB
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`Conectado ao MongoDB (${isProduction ? 'produção' : 'local'})`);

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
