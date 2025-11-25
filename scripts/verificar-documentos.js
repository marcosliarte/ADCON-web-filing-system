/**
 * Script para verificar documentos vencendo e criar notificações
 * Deve ser executado diariamente via cron job ou task scheduler
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Empresa = require('../models/model-empresa');
const Usuario = require('../models/model-usuario');
const Notificacao = require('../models/model-notificacao');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;

// Dias de antecedência para notificar sobre vencimentos
const DIAS_ALERTA = [30, 15, 7, 3, 1, 0]; // 30, 15, 7, 3, 1 dia antes e no dia do vencimento

async function verificarDocumentosVencendo() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado ao MongoDB...');

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Busca todas as empresas
    const empresas = await Empresa.find().lean();
    
    // Busca todos os usuários admin e gerente que podem receber notificações
    const usuariosNotificacao = await Usuario.find({ 
      role: { $in: ['admin', 'gerente'] } 
    }).select('_id nome email').lean();
    
    if (usuariosNotificacao.length === 0) {
      console.log('Nenhum usuário admin/gerente encontrado para enviar notificações.');
      await mongoose.connection.close();
      process.exit(0);
    }
    
    let notificacoesCriadas = 0;

    for (const empresa of empresas) {

      // Verifica cada tipo de documento
      const tiposDocumento = [
        { campo: 'certificadoDigital', nome: 'Certificado Digital' },
        { campo: 'certidaoPrefeitura', nome: 'Certidão Prefeitura' },
        { campo: 'certidaoReceita', nome: 'Certidão Receita Federal' },
        { campo: 'certidaoFGTS', nome: 'Certidão FGTS' },
        { campo: 'certidaoSefaz', nome: 'Certidão SEFAZ' },
        { campo: 'certidaoTrabalhista', nome: 'Certidão Trabalhista' },
        { campo: 'certidaoFalencia', nome: 'Certidão de Falência' }
      ];

      for (const tipo of tiposDocumento) {
        const doc = empresa.documentos?.[tipo.campo];
        if (!doc?.dataValidade) continue;

        const dataValidade = new Date(doc.dataValidade);
        dataValidade.setHours(0, 0, 0, 0);

        const diffTime = dataValidade.getTime() - hoje.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Verifica se deve notificar (30, 15, 7, 3, 1 dias antes ou vencido)
        if (DIAS_ALERTA.includes(diffDays) || diffDays < 0) {
          // Verifica se já existe notificação para este documento e data (para qualquer usuário)
          const notifExistente = await Notificacao.findOne({
            'dadosAdicionais.empresaId': empresa._id,
            'dadosAdicionais.documentoTipo': tipo.nome,
            createdAt: { 
              $gte: new Date(hoje.getTime() - 24 * 60 * 60 * 1000) // Criada nas últimas 24h
            }
          });

          if (!notifExistente) {
            const titulo = diffDays < 0 
              ? '⚠️ Documento Vencido!' 
              : diffDays === 0
              ? '⚠️ Documento Vence Hoje!'
              : `⏰ Documento Vence em ${diffDays} dia(s)`;
            
            const mensagem = diffDays < 0
              ? `O ${tipo.nome} da empresa ${empresa.nome} está VENCIDO desde ${dataValidade.toLocaleDateString('pt-BR')}.`
              : diffDays === 0
              ? `O ${tipo.nome} da empresa ${empresa.nome} VENCE HOJE (${dataValidade.toLocaleDateString('pt-BR')})!`
              : `O ${tipo.nome} da empresa ${empresa.nome} vence em ${diffDays} dia(s) (${dataValidade.toLocaleDateString('pt-BR')}).`;

            // Cria notificação para todos os admins e gerentes
            for (const usuario of usuariosNotificacao) {
              await Notificacao.create({
                usuarioId: usuario._id,
                tipo: diffDays < 0 ? 'documento_vencido' : 'documento_vencendo',
                titulo,
                mensagem,
                link: `/detalhes-empresa.html?id=${empresa._id}`,
                dadosAdicionais: {
                  empresaId: empresa._id,
                  empresaNome: empresa.nome,
                  documentoTipo: tipo.nome,
                  dataValidade: doc.dataValidade
                }
              });
            }

            notificacoesCriadas += usuariosNotificacao.length;
            console.log(`✓ Notificações criadas: ${tipo.nome} - ${empresa.nome} (${diffDays} dias) - ${usuariosNotificacao.length} usuário(s)`);
          }
        }
      }
    }

    console.log(`\n✓ Verificação concluída! ${notificacoesCriadas} notificação(ões) criada(s).`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Erro na verificação:', error);
    process.exit(1);
  }
}

verificarDocumentosVencendo();
