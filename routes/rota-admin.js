const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const Empresa = require('../models/model-empresa');

// Middleware para garantir que apenas admins acessem estas rotas
router.use(auth, adminAuth);

// @route   GET api/admin/dashboard/status
// @desc    Obter o status de componentes vitais do sistema
router.get('/dashboard/status', async (req, res) => {
    try {
        // 1. Status do Banco de Dados
        const dbState = mongoose.connection.readyState;
        let dbStatus = 'Desconhecido';
        switch (dbState) {
            case 0: dbStatus = 'Desconectado'; break;
            case 1: dbStatus = 'Conectado'; break;
            case 2: dbStatus = 'Conectando'; break;
            case 3: dbStatus = 'Desconectando'; break;
        }

        // 2. Uso de espaço em disco pela pasta de uploads
        const uploadsDir = path.join(__dirname, '../uploads');
        let diskUsage = 0;

        const getDirSize = (dirPath) => {
            let size = 0;
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    size += getDirSize(filePath);
                } else {
                    size += stats.size;
                }
            }
            return size;
        };

        if (fs.existsSync(uploadsDir)) {
            diskUsage = getDirSize(uploadsDir);
        }

        res.json({
            dbStatus: { status: dbStatus, state: dbState },
            diskUsage: { bytes: diskUsage, megabytes: (diskUsage / (1024 * 1024)).toFixed(2) }
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao buscar status do sistema.' });
    }
});

// @route   GET api/admin/dashboard/expiring-docs
// @desc    Obter documentos de empresas que estão prestes a vencer
router.get('/dashboard/expiring-docs', async (req, res) => {
    try {
        const hoje = new Date();
        const limite = new Date();
        limite.setDate(hoje.getDate() + 30); // Alerta para documentos que vencem nos próximos 30 dias

        const query = {
            $or: [
                { 'documentos.certificadoDigital.dataValidade': { $gte: hoje, $lte: limite } },
                { 'documentos.certidaoPrefeitura.dataValidade': { $gte: hoje, $lte: limite } },
                { 'documentos.certidaoReceita.dataValidade': { $gte: hoje, $lte: limite } },
                { 'documentos.certidaoFGTS.dataValidade': { $gte: hoje, $lte: limite } },
                { 'documentos.certidaoSefaz.dataValidade': { $gte: hoje, $lte: limite } },
                { 'documentos.certidaoTrabalhista.dataValidade': { $gte: hoje, $lte: limite } },
                { 'documentos.certidaoFalencia.dataValidade': { $gte: hoje, $lte: limite } },
            ]
        };

        const empresas = await Empresa.find(query).select('nome documentos').lean();

        const alertas = [];
        empresas.forEach(empresa => {
            for (const docKey in empresa.documentos) {
                const doc = empresa.documentos[docKey];
                if (doc && doc.dataValidade) {
                    const dataValidade = new Date(doc.dataValidade);
                    if (dataValidade >= hoje && dataValidade <= limite) {
                        // Converte a chave do documento (ex: 'certificadoDigital') para um nome legível ('Certificado Digital')
                        const nomeDocumento = docKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        
                        alertas.push({
                            empresaNome: empresa.nome,
                            documento: nomeDocumento,
                            dataValidade: dataValidade,
                            diasRestantes: Math.ceil((dataValidade - hoje) / (1000 * 60 * 60 * 24))
                        });
                    }
                }
            }
        });

        res.json(alertas);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao buscar documentos a vencer.' });
    }
});

module.exports = router;