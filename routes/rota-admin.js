const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { exec } = require('child_process'); // Para executar comandos do sistema (mongodump/mongorestore)

const Empresa = require('../models/model-empresa');

// Middleware para garantir que apenas admins acessem estas rotas
router.use(auth, adminAuth);

// --- CONFIGURAÇÃO DE BACKUP ---
const backupDir = path.join(__dirname, '../../_backups'); // Pasta na raiz do projeto

// Garante que a pasta de backups exista
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

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

// @route   POST api/admin/backup/create
// @desc    Criar um novo backup do banco de dados
router.post('/backup/create', (req, res) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.gz`;
    const backupFilePath = path.join(backupDir, filename);
    const command = `mongodump --uri="${process.env.MONGODB_URI}" --archive="${backupFilePath}" --gzip`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro ao criar backup: ${stderr}`);
            return res.status(500).json({ msg: 'Falha ao criar o backup.', error: stderr });
        }
        res.json({ msg: 'Backup criado com sucesso!', file: filename });
    });
});

// @route   GET api/admin/backup/list
// @desc    Listar os backups existentes
router.get('/backup/list', (req, res) => {
    fs.readdir(backupDir, (err, files) => {
        if (err) {
            return res.status(500).json({ msg: 'Não foi possível ler a pasta de backups.' });
        }
        const backups = files
            .filter(file => file.endsWith('.gz'))
            .map(file => {
                const stats = fs.statSync(path.join(backupDir, file));
                return {
                    filename: file,
                    size: (stats.size / (1024 * 1024)).toFixed(2), // em MB
                    createdAt: stats.birthtime,
                };
            })
            .sort((a, b) => b.createdAt - a.createdAt); // Mais recentes primeiro
        res.json(backups);
    });
});

// @route   POST api/admin/backup/restore
// @desc    Restaurar o banco de dados a partir de um backup
router.post('/backup/restore', (req, res) => {
    const { filename } = req.body;
    if (!filename) {
        return res.status(400).json({ msg: 'Nome do arquivo de backup é obrigatório.' });
    }

    const backupFilePath = path.join(backupDir, filename);
    if (!fs.existsSync(backupFilePath)) {
        return res.status(404).json({ msg: 'Arquivo de backup não encontrado.' });
    }

    // O --drop apaga as coleções existentes antes de restaurar
    const command = `mongorestore --uri="${process.env.MONGODB_URI}" --archive="${backupFilePath}" --gzip --drop`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Erro ao restaurar backup: ${stderr}`);
            return res.status(500).json({ msg: 'Falha ao restaurar o backup.', error: stderr });
        }
        res.json({ msg: 'Banco de dados restaurado com sucesso!' });
    });
});

// @route   GET api/admin/backup/download/:filename
// @desc    Baixar um arquivo de backup
router.get('/backup/download/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(backupDir, filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).send('Arquivo não encontrado.');
    }
});

// @route   DELETE api/admin/backup/delete/:filename
// @desc    Excluir um arquivo de backup
router.delete('/backup/delete/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(backupDir, filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ msg: 'Backup excluído com sucesso.' });
    } else {
        res.status(404).json({ msg: 'Arquivo não encontrado.' });
    }
});

module.exports = router;