require('dotenv').config(); // Garante que as variáveis de ambiente sejam carregadas
const mongoose = require('mongoose');
const Usuario = require('./models/model-usuario');
const connectDB = require('./config/db'); // Importa a função de conexão padronizada

// --- IMPORTANTE ---
// Carregue as variáveis de ambiente manualmente se o script não as encontrar.
// Descomente as linhas abaixo e preencha com seus dados se necessário.

// --- DADOS DO ADMINISTRADOR ---
// Altere os dados abaixo para o seu usuário administrador
const ADMIN_EMAIL = 'marcos.liarte.neves@gmail.com';
const ADMIN_SENHA = 'Rokku281093!';
const ADMIN_NOME = 'Marcos Liarte';

const createAdmin = async () => {
  try {
    // 1. Conectar ao MongoDB
    await connectDB();
    console.log('Conectado ao MongoDB para criar o admin...');

    // 2. Verificar se o admin já existe
    const adminExists = await Usuario.findOne({ email: ADMIN_EMAIL });
    if (adminExists) {
      console.log('Usuário administrador já existe.');
      return;
    }

    // 3. Criar o novo usuário administrador
    const admin = new Usuario({
      nome: ADMIN_NOME,
      email: ADMIN_EMAIL,
      senha: ADMIN_SENHA, // A senha será hasheada pelo hook 'pre-save' do Mongoose
      role: 'admin',
    });

    await admin.save();
    console.log('Usuário administrador criado com sucesso!');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Senha: ${ADMIN_SENHA}`);

  } catch (error) {
    console.error('Erro ao criar o usuário administrador:', error.message);
  }
};

createAdmin();
