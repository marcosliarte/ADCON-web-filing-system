/**
 * Script para corrigir os caminhos da Inscrição Estadual no banco de dados
 * Altera de /uploads/certidoes/ para /uploads/documentos_empresa/
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Empresa = require('./models/model-empresa');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;

async function corrigirCaminhos() {
    try {
        console.log('Conectando ao MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Conectado ao MongoDB\n');

        // Busca todas as empresas que têm inscrição estadual
        const empresas = await Empresa.find({
            'documentos.inscricaoEstadual.caminhoArquivo': { $exists: true }
        });

        console.log(`Encontradas ${empresas.length} empresas com Inscrição Estadual cadastrada.\n`);

        let corrigidos = 0;
        let jaCorretos = 0;

        for (const empresa of empresas) {
            const caminhoAtual = empresa.documentos.inscricaoEstadual.caminhoArquivo;
            
            // Verifica se o caminho está apontando para certidoes
            if (caminhoAtual && caminhoAtual.includes('/certidoes/')) {
                const novoCaminho = caminhoAtual.replace('/certidoes/', '/documentos_empresa/');
                
                console.log(`Empresa: ${empresa.nome}`);
                console.log(`  Caminho antigo: ${caminhoAtual}`);
                console.log(`  Caminho novo:   ${novoCaminho}`);
                
                empresa.documentos.inscricaoEstadual.caminhoArquivo = novoCaminho;
                await empresa.save();
                
                console.log(`  ✓ Corrigido\n`);
                corrigidos++;
            } else if (caminhoAtual && caminhoAtual.includes('/documentos_empresa/')) {
                console.log(`Empresa: ${empresa.nome} - Já está correto`);
                jaCorretos++;
            }
        }

        console.log('\n=================================');
        console.log('RESUMO DA CORREÇÃO');
        console.log('=================================');
        console.log(`Total de empresas analisadas: ${empresas.length}`);
        console.log(`Caminhos corrigidos: ${corrigidos}`);
        console.log(`Já estavam corretos: ${jaCorretos}`);
        console.log('=================================\n');

    } catch (error) {
        console.error('❌ Erro ao corrigir caminhos:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Conexão com MongoDB fechada.');
    }
}

// Executa o script
corrigirCaminhos();
