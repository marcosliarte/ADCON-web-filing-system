/**
 * Script para verificar os caminhos da Inscrição Estadual no banco
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Empresa = require('./models/model-empresa');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;

async function verificarCaminhos() {
    try {
        await mongoose.connect(MONGODB_URI);
        
        const empresas = await Empresa.find({
            'documentos.inscricaoEstadual.caminhoArquivo': { $exists: true }
        });

        console.log('CAMINHOS DA INSCRIÇÃO ESTADUAL NO BANCO:\n');
        
        empresas.forEach(empresa => {
            console.log(`Empresa: ${empresa.nome}`);
            console.log(`Caminho: ${empresa.documentos.inscricaoEstadual.caminhoArquivo}`);
            console.log(`Arquivo: ${empresa.documentos.inscricaoEstadual.nomeArquivo}\n`);
        });

    } catch (error) {
        console.error('Erro:', error);
    } finally {
        await mongoose.connection.close();
    }
}

verificarCaminhos();
