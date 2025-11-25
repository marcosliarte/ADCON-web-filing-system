// Script de migração para adicionar o campo lastActivity aos usuários existentes
require('dotenv').config();
const mongoose = require('mongoose');
const Usuario = require('../models/model-usuario');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;

async function migrate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado ao MongoDB...');

    // Atualiza todos os usuários que não têm o campo lastActivity
    const result = await Usuario.updateMany(
      { lastActivity: { $exists: false } },
      { $set: { lastActivity: new Date() } }
    );

    console.log(`✓ Migração concluída! ${result.modifiedCount} usuários atualizados.`);

    // Cria índice no campo lastActivity para otimizar consultas
    try {
      await Usuario.collection.createIndex({ lastActivity: -1 });
      console.log('✓ Índice criado no campo lastActivity.');
    } catch (indexError) {
      console.log('⚠ Índice já existe ou erro ao criar:', indexError.message);
    }
    
    await mongoose.connection.close();
    console.log('Conexão fechada.');
    process.exit(0);
  } catch (error) {
    console.error('Erro na migração:', error);
    process.exit(1);
  }
}

migrate();
