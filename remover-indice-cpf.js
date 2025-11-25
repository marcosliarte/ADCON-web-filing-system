const mongoose = require('mongoose');
require('dotenv').config();

async function removerIndiceCPF() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/adcon');
        console.log('Conectado ao MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('empresas');

        // Listar índices existentes
        console.log('\n📋 Índices atuais:');
        const indices = await collection.indexes();
        indices.forEach(index => {
            console.log(`   - ${index.name}:`, JSON.stringify(index.key));
        });

        // Tentar remover todos os índices relacionados a CPF
        const indicesToRemove = ['socios.cpf_1', 'cpf_1'];
        
        for (const indexName of indicesToRemove) {
            try {
                await collection.dropIndex(indexName);
                console.log(`\n✅ Índice "${indexName}" removido com sucesso!`);
            } catch (error) {
                if (error.code === 27) {
                    console.log(`\n⚠️  Índice "${indexName}" não encontrado`);
                } else {
                    console.log(`\n❌ Erro ao remover "${indexName}":`, error.message);
                }
            }
        }

        // Verificar se há algum índice com 'cpf' no nome
        console.log('\n🔍 Verificando índices com "cpf":');
        const indicesApos = await collection.indexes();
        const indicesCPF = indicesApos.filter(idx => 
            JSON.stringify(idx).toLowerCase().includes('cpf')
        );
        
        if (indicesCPF.length > 0) {
            console.log('   Encontrados:');
            indicesCPF.forEach(index => {
                console.log(`   - ${index.name}:`, JSON.stringify(index.key));
            });
            
            // Tentar remover manualmente
            for (const index of indicesCPF) {
                try {
                    await collection.dropIndex(index.name);
                    console.log(`   ✅ Removido: ${index.name}`);
                } catch (error) {
                    console.log(`   ❌ Erro: ${error.message}`);
                }
            }
        } else {
            console.log('   ✅ Nenhum índice de CPF encontrado');
        }

        // Listar índices finais
        console.log('\n📋 Índices finais:');
        const indicesFinais = await collection.indexes();
        indicesFinais.forEach(index => {
            console.log(`   - ${index.name}:`, JSON.stringify(index.key));
        });

        console.log('\n✅ Operação concluída! Reinicie o servidor para aplicar as mudanças.');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Erro:', error.message);
        console.error(error);
        process.exit(1);
    }
}

removerIndiceCPF();
