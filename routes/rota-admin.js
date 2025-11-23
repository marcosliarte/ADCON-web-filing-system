const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { exec } = require('child_process'); // Para executar comandos do sistema (mongodump/mongorestore)
const archiver = require('archiver'); // Para criar arquivos .zip
const unzipper = require('unzipper'); // Para extrair arquivos .zip

const Empresa = require('../models/model-empresa');
const Usuario = require('../models/model-usuario'); // Adicionado para contagem de usuários

// Middleware para garantir que apenas admins acessem estas rotas
router.use(auth, adminAuth);

// --- CONFIGURAÇÃO DE BACKUP ---
const backupDir = path.join(__dirname, '../_backups'); // Define a pasta de backups DENTRO do projeto.

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

        // 3. Uso de espaço em disco pela pasta de backups
        let backupDiskUsage = 0;
        if (fs.existsSync(backupDir)) {
            backupDiskUsage = getDirSize(backupDir);
        }

        // 4. Contagem de entidades
        const totalUsuarios = await Usuario.countDocuments();
        const totalEmpresas = await Empresa.countDocuments();

        res.json({
            dbStatus: { status: dbStatus, state: dbState },
            diskUsage: { 
                uploads: { bytes: diskUsage, megabytes: (diskUsage / (1024 * 1024)).toFixed(2) },
                backups: { bytes: backupDiskUsage, megabytes: (backupDiskUsage / (1024 * 1024)).toFixed(2) }
            },
            counts: {
                usuarios: totalUsuarios,
                empresas: totalEmpresas
            }
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
        
        // CORREÇÃO: A query agora usa $lte (menor ou igual a) para incluir documentos já vencidos.
        const query = {
            $or: [
                { 'documentos.certificadoDigital.dataValidade': { $lte: limite } },
                { 'documentos.certidaoPrefeitura.dataValidade': { $lte: limite } },
                { 'documentos.certidaoReceita.dataValidade': { $lte: limite } },
                { 'documentos.certidaoFGTS.dataValidade': { $lte: limite } },
                { 'documentos.certidaoSefaz.dataValidade': { $lte: limite } },
                { 'documentos.certidaoTrabalhista.dataValidade': { $lte: limite } },
                { 'documentos.certidaoFalencia.dataValidade': { $lte: limite } },
            ]
        };

        const empresas = await Empresa.find(query).select('nome documentos').lean();

        const alertas = [];
        empresas.forEach(empresa => {
            for (const docKey in empresa.documentos) {
                const doc = empresa.documentos[docKey];
                if (doc && doc.dataValidade) {
                    const dataValidade = new Date(doc.dataValidade);
                    if (dataValidade <= limite) { // CORREÇÃO: A verificação também é simplificada aqui.
                        // Converte a chave do documento (ex: 'certificadoDigital') para um nome legível ('Certificado Digital')
                        const nomeDocumento = docKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        
                        alertas.push({
                            empresaId: empresa._id, // ADICIONADO: Envia o ID da empresa para o frontend.
                            empresaNome: empresa.nome,
                            documento: nomeDocumento,
                            dataValidade: dataValidade,
                            diasRestantes: Math.ceil((dataValidade - hoje) / (1000 * 60 * 60 * 24))
                        });
                    }
                }
            }
        });

        // NOVA LÓGICA: Ordenar os alertas pela data de validade (do mais antigo/próximo para o mais distante).
        alertas.sort((a, b) => a.dataValidade - b.dataValidade);

        res.json(alertas);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao buscar documentos a vencer.' });
    }
});

// @route   POST api/admin/backup/create
// @desc    Criar um novo backup do banco de dados
router.post('/backup/create', (req, res) => {
  // LÓGICA DE BACKUP DO ZERO
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dbDumpFilename = `db-dump-${timestamp}.gz`;
  const dbDumpFilePath = path.join(backupDir, dbDumpFilename);

  // 1. Pega o caminho do mongodump do .env ou usa o comando padrão.
  const mongodumpExecutable = process.env.MONGODUMP_PATH || 'mongodump';
  const MONGODB_URI_PARA_BACKUP = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;

  // 2. Constrói o comando, garantindo que o executável e os caminhos de arquivo estejam entre aspas.
  // Esta é a correção crucial para o Windows.
  const command = `"${mongodumpExecutable}" --uri="${MONGODB_URI_PARA_BACKUP}" --archive="${dbDumpFilePath}" --gzip`;

  console.log('--- EXECUTANDO COMANDO DE BACKUP ---');
  console.log(command);

  // 3. Executa o comando.
  exec(command, (dumpError, stdout, stderr) => {
    if (dumpError) {
      console.error(`Erro ao criar dump do banco de dados: ${stderr}`);
      return res.status(500).json({ msg: 'Falha ao criar o backup do banco de dados.', error: stderr });
    }

    // 4. Se o dump do banco de dados foi bem-sucedido, cria o arquivo .zip.
    const finalBackupFilename = `backup-completo-${timestamp}.zip`;
    const finalBackupPath = path.join(backupDir, finalBackupFilename);
    const uploadsPath = path.join(__dirname, '../uploads');

    const output = fs.createWriteStream(finalBackupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      fs.unlink(dbDumpFilePath, (unlinkErr) => { if (unlinkErr) console.error("Erro ao remover arquivo de dump temporário:", unlinkErr); });
      res.json({ msg: 'Backup completo criado com sucesso!', file: finalBackupFilename });
    });

    archive.on('error', (archiveErr) => res.status(500).json({ msg: 'Falha ao criar o arquivo ZIP.', error: archiveErr.message }));
    archive.pipe(output);
    archive.file(dbDumpFilePath, { name: dbDumpFilename });
    if (fs.existsSync(uploadsPath)) {
      archive.directory(uploadsPath, 'uploads');
    }
    archive.finalize();
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
            .filter(file => file.endsWith('.zip')) // Lista os arquivos .zip
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

    const tempRestoreDir = path.join(backupDir, `temp-restore-${Date.now()}`);
    fs.mkdirSync(tempRestoreDir, { recursive: true });

    fs.createReadStream(backupFilePath)
        .pipe(unzipper.Extract({ path: tempRestoreDir }))
        .on('finish', () => {
            const filesInTemp = fs.readdirSync(tempRestoreDir);
            const dbDumpFile = filesInTemp.find(f => f.endsWith('.gz'));

            if (!dbDumpFile) {
                fs.rmSync(tempRestoreDir, { recursive: true, force: true });
                return res.status(500).json({ msg: 'Arquivo de dump do banco de dados não encontrado no backup.' });
            }

            const dbDumpFilePath = path.join(tempRestoreDir, dbDumpFile);
            const MONGODB_URI_PARA_BACKUP = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
            const mongorestoreExecutable = process.env.MONGODUMP_PATH ? `"${process.env.MONGODUMP_PATH.replace('mongodump', 'mongorestore')}"` : 'mongorestore';
            const restoreCommand = `${mongorestoreExecutable} --uri="${MONGODB_URI_PARA_BACKUP}" --archive="${dbDumpFilePath}" --gzip --drop`;

            exec(restoreCommand, (restoreError, stdout, stderr) => {
                if (restoreError) {
                    fs.rmSync(tempRestoreDir, { recursive: true, force: true });
                    console.error(`Erro ao restaurar banco de dados: ${stderr}`);
                    return res.status(500).json({ msg: 'Falha ao restaurar o banco de dados.', error: stderr });
                }

                const uploadsBackupPath = path.join(tempRestoreDir, 'uploads');
                const serverUploadsPath = path.join(__dirname, '../uploads');

                if (fs.existsSync(uploadsBackupPath)) {
                    if (fs.existsSync(serverUploadsPath)) {
                        fs.rmSync(serverUploadsPath, { recursive: true, force: true });
                    }
                    fs.renameSync(uploadsBackupPath, serverUploadsPath);
                }

                fs.rmSync(tempRestoreDir, { recursive: true, force: true });
                res.json({ msg: 'Sistema restaurado com sucesso!' });
            });
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

// @route   GET api/admin/logs/recent
// @desc    Obter os 5 logs de atividade mais recentes
router.get('/logs/recent', async (req, res) => {
    try {
        // CORREÇÃO: Verifica se o modelo já foi compilado antes de tentar compilá-lo novamente.
        // Isso evita erros em ambientes onde a ordem de carregamento dos arquivos pode variar.
        const LogAcao = mongoose.models.LogAcao || mongoose.model('LogAcao');
        if (!LogAcao) {
            return res.status(500).json({ msg: 'Modelo de Log não inicializado.' });
        }
        const recentLogs = await LogAcao.find({})
            .sort({ createdAt: -1 }) // Ordena dos mais recentes para os mais antigos
            .limit(5); // Limita a 5 resultados

        res.json(recentLogs);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao buscar logs recentes.' });
    }
});

module.exports = router;