const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const os = require('os');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { exec } = require('child_process'); // Para executar comandos do sistema (mongodump/mongorestore)
const archiver = require('archiver'); // Para criar arquivos .zip
const unzipper = require('unzipper'); // Para extrair arquivos .zip
const multer = require('multer'); // Para lidar com upload de arquivos

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

// --- CONFIGURAÇÃO DO UPLOAD ---
// Define onde os arquivos de backup carregados serão armazenados temporariamente.
const uploadDir = path.join(__dirname, '..', '_temp_uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configura o multer para salvar o arquivo com seu nome original no diretório temporário.
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.originalname.endsWith('.zip') || file.originalname.endsWith('.gz')) {
            cb(null, true);
        } else {
            cb(new Error('Formato de arquivo inválido. Apenas .zip ou .gz são permitidos.'), false);
        }
    }
});

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

        // 2. Uso de espaço em disco pela pasta de uploads (assíncrono e em cache para evitar varreduras pesadas)
        const uploadsDir = path.join(__dirname, '../uploads');
        let diskUsage = 0;
        let backupDiskUsage = 0;

        const CACHE_TTL_MS = 30 * 1000; // 30 segundos
        if (!router._statusCache) router._statusCache = { ts: 0, diskUsage: 0, backupDiskUsage: 0 };

        const now = Date.now();
        if (router._statusCache.ts && (now - router._statusCache.ts) < CACHE_TTL_MS) {
            diskUsage = router._statusCache.diskUsage;
            backupDiskUsage = router._statusCache.backupDiskUsage;
        } else {
            const getDirSizeAsync = async (dirPath) => {
                let total = 0;
                try {
                    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
                    for (const entry of entries) {
                        const entryPath = path.join(dirPath, entry.name);
                        if (entry.isDirectory()) {
                            total += await getDirSizeAsync(entryPath);
                        } else {
                            const stats = await fs.promises.stat(entryPath);
                            total += stats.size;
                        }
                    }
                } catch (e) {
                    // Se o diretório sumir ou ocorrer erro, ignora e segue
                }
                return total;
            };

            try {
                if (fs.existsSync(uploadsDir)) {
                    diskUsage = await getDirSizeAsync(uploadsDir);
                }
                if (fs.existsSync(backupDir)) {
                    backupDiskUsage = await getDirSizeAsync(backupDir);
                }
                router._statusCache = { ts: Date.now(), diskUsage, backupDiskUsage };
            } catch (e) {
                console.error('Erro ao calcular tamanho de diretórios:', e.message);
            }
        }

        // 4. Contagem de entidades
        const totalUsuarios = await Usuario.countDocuments();
        const totalEmpresas = await Empresa.countDocuments();

        // Dados do sistema
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        const processMem = process.memoryUsage();

        res.json({
            dbStatus: { status: dbStatus, state: dbState },
            diskUsage: { 
                uploads: { bytes: diskUsage, megabytes: (diskUsage / (1024 * 1024)).toFixed(2) },
                backups: { bytes: backupDiskUsage, megabytes: (backupDiskUsage / (1024 * 1024)).toFixed(2) }
            },
            counts: {
                usuarios: totalUsuarios,
                empresas: totalEmpresas
            },
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                osUptimeSeconds: os.uptime(),
                processUptimeSeconds: process.uptime(),
                cpus: { count: os.cpus().length, model: os.cpus()[0] ? os.cpus()[0].model : null },
                memory: {
                    totalBytes: totalMem,
                    freeBytes: freeMem,
                    usedBytes: usedMem,
                    totalMB: (totalMem / (1024 * 1024)).toFixed(2),
                    freeMB: (freeMem / (1024 * 1024)).toFixed(2),
                    usedPercent: ((usedMem / totalMem) * 100).toFixed(2)
                },
                processMemory: {
                    rssMB: (processMem.rss / (1024 * 1024)).toFixed(2),
                    heapTotalMB: (processMem.heapTotal / (1024 * 1024)).toFixed(2),
                    heapUsedMB: (processMem.heapUsed / (1024 * 1024)).toFixed(2)
                }
            }
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao buscar status do sistema.' });
    }
});

// @route   GET api/admin/dashboard/stats
// @desc    Estatísticas detalhadas: usuários por role e empresas por estado
router.get('/dashboard/stats', async (req, res) => {
    try {
        // Usuários por perfil
        const usersByRole = await Usuario.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } },
            { $project: { role: '$_id', count: 1, _id: 0 } }
        ]);

        // Empresas por estado (endereco.estado)
        const companiesByState = await Empresa.aggregate([
            { $match: { 'endereco.estado': { $exists: true, $ne: '' } } },
            { $group: { _id: '$endereco.estado', count: { $sum: 1 } } },
            { $project: { estado: '$_id', count: 1, _id: 0 } }
        ]);

        res.json({ usersByRole, companiesByState });
    } catch (err) {
        console.error('Erro ao gerar estatísticas:', err.message);
        res.status(500).json({ msg: 'Erro no servidor ao gerar estatísticas.' });
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
  const command = `"${mongodumpExecutable}" --uri="${MONGODB_URI_PARA_BACKUP}" --archive="${dbDumpFilePath}" --gzip`;

  console.log('[BACKUP CREATE] ========================================');
  console.log('[BACKUP CREATE] Iniciando criação de backup...');
  console.log('[BACKUP CREATE] URI fonte:', MONGODB_URI_PARA_BACKUP);
  console.log('[BACKUP CREATE] Arquivo destino:', dbDumpFilePath);
  console.log('[BACKUP CREATE] Comando:', command);
  console.log('[BACKUP CREATE] ========================================');

  // 3. Executa o comando.
  exec(command, (dumpError, stdout, stderr) => {
    const output = stdout + '\n' + stderr;
    console.log('[BACKUP CREATE] --- OUTPUT DO MONGODUMP ---');
    console.log(output);
    console.log('[BACKUP CREATE] -----------------------------------');
    
    if (dumpError) {
      console.error('[BACKUP CREATE] ❌ Erro ao criar dump:', dumpError.message);
      console.error('[BACKUP CREATE] stderr:', stderr);
      return res.status(500).json({ msg: 'Falha ao criar o backup do banco de dados.', error: stderr });
    }

    // Verificar se o arquivo foi criado e tem conteúdo
    if (fs.existsSync(dbDumpFilePath)) {
      const fileSize = fs.statSync(dbDumpFilePath).size;
      console.log('[BACKUP CREATE] ✅ Arquivo dump criado:', dbDumpFilePath);
      console.log('[BACKUP CREATE] 📊 Tamanho do dump:', fileSize, 'bytes');
      
      if (fileSize < 100) {
        console.log('[BACKUP CREATE] ⚠️ AVISO: Dump muito pequeno! Provavelmente está vazio.');
      }
      
      // Extrair contagem de documentos do output
      const match = output.match(/(\d+) document\(s\)/);
      if (match) {
        console.log('[BACKUP CREATE] 📄 Documentos exportados:', match[1]);
      }
    } else {
      console.error('[BACKUP CREATE] ❌ Arquivo dump não foi criado!');
      return res.status(500).json({ msg: 'Falha ao criar arquivo de dump.' });
    }

    // 4. Se o dump do banco de dados foi bem-sucedido, cria o arquivo .zip.
    const finalBackupFilename = `backup-completo-${timestamp}.zip`;
    const finalBackupPath = path.join(backupDir, finalBackupFilename);
    const uploadsPath = path.join(__dirname, '../uploads');

    const zipStream = fs.createWriteStream(finalBackupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    zipStream.on('close', () => {
      console.log('[BACKUP CREATE] ✅ Arquivo ZIP criado:', finalBackupPath);
      console.log('[BACKUP CREATE] 📦 Tamanho total do backup:', archive.pointer(), 'bytes');
      fs.unlink(dbDumpFilePath, (unlinkErr) => { if (unlinkErr) console.error("Erro ao remover arquivo de dump temporário:", unlinkErr); });
      res.json({ msg: 'Backup completo criado com sucesso!', file: finalBackupFilename });
    });

    archive.on('error', (archiveErr) => {
      console.error('[BACKUP CREATE] ❌ Erro ao criar ZIP:', archiveErr.message);
      res.status(500).json({ msg: 'Falha ao criar o arquivo ZIP.', error: archiveErr.message });
    });
    
    archive.pipe(zipStream);
    archive.file(dbDumpFilePath, { name: dbDumpFilename });
    if (fs.existsSync(uploadsPath)) {
      console.log('[BACKUP CREATE] 📁 Adicionando pasta uploads ao ZIP...');
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
router.post('/backup/restore', async (req, res) => {
    try {
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

        // Extrair o ZIP usando Promise
        await new Promise((resolve, reject) => {
            fs.createReadStream(backupFilePath)
                .pipe(unzipper.Extract({ path: tempRestoreDir }))
                .on('finish', resolve)
                .on('error', reject);
        });

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

        console.log('[RESTORE] ========================================');
        console.log('[RESTORE] Iniciando restauração do banco de dados...');
        console.log('[RESTORE] URI destino:', MONGODB_URI_PARA_BACKUP);
        console.log('[RESTORE] Arquivo dump:', dbDumpFilePath);
        console.log('[RESTORE] Tamanho do dump:', fs.statSync(dbDumpFilePath).size, 'bytes');
        console.log('[RESTORE] Comando:', restoreCommand);
        console.log('[RESTORE] ========================================');

        // Executar restore usando Promise
        await new Promise((resolve, reject) => {
            exec(restoreCommand, (restoreError, stdout, stderr) => {
                console.log('[RESTORE] --- OUTPUT DO MONGORESTORE ---');
                console.log('[RESTORE] stdout:', stdout);
                console.log('[RESTORE] stderr:', stderr);
                console.log('[RESTORE] -----------------------------------');
                
                if (restoreError) {
                    console.error('[RESTORE] ❌ Erro ao restaurar banco de dados:', stderr);
                    console.error('[RESTORE] Código de erro:', restoreError.code);
                    reject(new Error(stderr || 'Falha ao restaurar o banco de dados'));
                } else {
                    console.log('[RESTORE] ✓ Banco de dados restaurado com sucesso');
                    
                    // Verificar quantos documentos foram restaurados
                    const match = (stdout + stderr).match(/(\d+) document\(s\) restored/);
                    if (match) {
                        console.log('[RESTORE] 📊 Total de documentos restaurados:', match[1]);
                    }
                    
                    resolve();
                }
            });
        });

        // Restaurar uploads - SUBSTITUIR COMPLETAMENTE
        const uploadsBackupPath = path.join(tempRestoreDir, 'uploads');
        const serverUploadsPath = path.join(__dirname, '../uploads');

        console.log('[RESTORE] Verificando pasta de uploads no backup...');
        if (fs.existsSync(uploadsBackupPath)) {
            console.log('[RESTORE] Pasta uploads encontrada no backup');
            
            // Remover uploads atuais para evitar conflitos
            if (fs.existsSync(serverUploadsPath)) {
                console.log('[RESTORE] Removendo uploads atuais...');
                fs.rmSync(serverUploadsPath, { recursive: true, force: true });
            }
            
            // Copiar recursivamente do backup
            console.log('[RESTORE] Copiando uploads do backup...');
            const copyRecursive = (src, dest) => {
                if (!fs.existsSync(dest)) {
                    fs.mkdirSync(dest, { recursive: true });
                }
                const entries = fs.readdirSync(src, { withFileTypes: true });
                for (const entry of entries) {
                    const srcPath = path.join(src, entry.name);
                    const destPath = path.join(dest, entry.name);
                    if (entry.isDirectory()) {
                        copyRecursive(srcPath, destPath);
                    } else {
                        fs.copyFileSync(srcPath, destPath);
                    }
                }
            };
            copyRecursive(uploadsBackupPath, serverUploadsPath);
            console.log('[RESTORE] ✓ Uploads restaurados com sucesso');
        } else {
            console.log('[RESTORE] ⚠ Nenhuma pasta uploads encontrada no backup');
        }

        // Limpar pasta temporária
        console.log('[RESTORE] Limpando arquivos temporários...');
        fs.rmSync(tempRestoreDir, { recursive: true, force: true });
        console.log('[RESTORE] ✓ Restauração concluída com sucesso!');
        
        res.json({ msg: 'Sistema restaurado com sucesso! Banco de dados e arquivos foram restaurados.' });

    } catch (error) {
        console.error('Erro ao restaurar backup:', error);
        res.status(500).json({ 
            msg: 'Erro ao restaurar backup.', 
            error: error.message 
        });
    }
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

// --- NOVA ROTA PARA UPLOAD E RESTAURAÇÃO ---
// A rota usa o middleware 'auth', 'adminAuth' e o 'upload.single()'.
// 'backupFile' deve ser o mesmo nome usado no FormData do frontend.
router.post('/backup/upload', upload.single('backupFile'), async (req, res) => {
    let uploadedFilePath = null;
    let tempRestoreDir = null;
    
    try {
        console.log('[BACKUP UPLOAD] Iniciando processo de upload e restauração...');
        
        // Verifica se um arquivo foi realmente enviado.
        if (!req.file) {
            console.log('[BACKUP UPLOAD] Erro: Nenhum arquivo recebido');
            return res.status(400).json({ msg: 'Nenhum arquivo de backup foi enviado.' });
        }

        uploadedFilePath = req.file.path;
        console.log('[BACKUP UPLOAD] Arquivo recebido:', req.file.originalname, 'Tamanho:', req.file.size, 'bytes');
        
        const fileExtension = path.extname(req.file.originalname).toLowerCase();

        // Validação do formato do arquivo
        if (fileExtension !== '.zip') {
            console.log('[BACKUP UPLOAD] Erro: Formato inválido:', fileExtension);
            if (fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
            return res.status(400).json({ msg: 'Formato de arquivo inválido. A restauração só pode ser feita a partir de um arquivo .zip gerado pelo sistema.' });
        }

        tempRestoreDir = path.join(uploadDir, `temp-restore-${Date.now()}`);
        fs.mkdirSync(tempRestoreDir, { recursive: true });
        console.log('[BACKUP UPLOAD] Diretório temporário criado:', tempRestoreDir);

        // Descompacta o arquivo .zip carregado usando Promise
        console.log('[BACKUP UPLOAD] Iniciando descompactação...');
        await new Promise((resolve, reject) => {
            fs.createReadStream(uploadedFilePath)
                .pipe(unzipper.Extract({ path: tempRestoreDir }))
                .on('close', () => {
                    console.log('[BACKUP UPLOAD] Descompactação concluída');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('[BACKUP UPLOAD] Erro na descompactação:', err);
                    reject(err);
                });
        });

        // Remove o arquivo zip após extração
        if (fs.existsSync(uploadedFilePath)) {
            fs.unlinkSync(uploadedFilePath);
            uploadedFilePath = null;
            console.log('[BACKUP UPLOAD] Arquivo ZIP temporário removido');
        }

        const filesInTemp = fs.readdirSync(tempRestoreDir);
        console.log('[BACKUP UPLOAD] Arquivos extraídos:', filesInTemp);
        
        const dbDumpFile = filesInTemp.find(f => f.endsWith('.gz'));

        if (!dbDumpFile) {
            console.log('[BACKUP UPLOAD] Erro: Dump do banco não encontrado');
            throw new Error('Arquivo de dump (.gz) do banco de dados não encontrado dentro do backup .zip.');
        }

        console.log('[BACKUP UPLOAD] Arquivo de dump encontrado:', dbDumpFile);
        const dbDumpFilePath = path.join(tempRestoreDir, dbDumpFile);
        const MONGODB_URI_PARA_BACKUP = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
        const mongorestoreExecutable = process.env.MONGODUMP_PATH ? `"${process.env.MONGODUMP_PATH.replace('mongodump', 'mongorestore')}"` : 'mongorestore';
        const restoreCommand = `${mongorestoreExecutable} --uri="${MONGODB_URI_PARA_BACKUP}" --archive="${dbDumpFilePath}" --gzip --drop`;

        console.log('[BACKUP UPLOAD] ========================================');
        console.log('[BACKUP UPLOAD] Executando mongorestore...');
        console.log('[BACKUP UPLOAD] URI destino:', MONGODB_URI_PARA_BACKUP);
        console.log('[BACKUP UPLOAD] Tamanho do dump:', fs.statSync(dbDumpFilePath).size, 'bytes');
        console.log('[BACKUP UPLOAD] ========================================');
        
        // Executar restore usando Promise
        await new Promise((resolve, reject) => {
            exec(restoreCommand, (restoreError, stdout, stderr) => {
                const output = stdout + '\n' + stderr;
                console.log('[BACKUP UPLOAD] --- OUTPUT COMPLETO DO MONGORESTORE ---');
                console.log(output);
                console.log('[BACKUP UPLOAD] -----------------------------------');
                
                if (restoreError) {
                    console.error('[BACKUP UPLOAD] ❌ Erro no mongorestore');
                    reject(new Error(`Falha ao restaurar o banco de dados: ${stderr}`));
                } else {
                    // Verificar quantos documentos foram restaurados
                    const match = output.match(/(\d+) document\(s\) restored/);
                    if (match) {
                        console.log('[BACKUP UPLOAD] ✅ Banco de dados restaurado com sucesso');
                        console.log('[BACKUP UPLOAD] 📊 Total de documentos restaurados:', match[1]);
                    } else {
                        console.log('[BACKUP UPLOAD] ⚠️ Restauração concluída mas nenhum documento detectado');
                        console.log('[BACKUP UPLOAD] Isso pode indicar que o backup estava vazio');
                    }
                    resolve();
                }
            });
        });

        // Restaurar uploads se existir
        const uploadsBackupPath = path.join(tempRestoreDir, 'uploads');
        const serverUploadsPath = path.join(__dirname, '../uploads');

        if (fs.existsSync(uploadsBackupPath)) {
            console.log('[BACKUP UPLOAD] Restaurando arquivos de upload...');
            
            // FUNÇÃO AUXILIAR PARA COPIAR DIRETÓRIOS DE FORMA SEGURA
            const copyDirSync = (src, dest) => {
                fs.mkdirSync(dest, { recursive: true });
                const entries = fs.readdirSync(src, { withFileTypes: true });
                for (let entry of entries) {
                    const srcPath = path.join(src, entry.name);
                    const destPath = path.join(dest, entry.name);
                    if (entry.isDirectory()) {
                        copyDirSync(srcPath, destPath);
                    } else {
                        fs.copyFileSync(srcPath, destPath);
                    }
                }
            };

            // Faz backup da pasta uploads atual antes de substituir
            if (fs.existsSync(serverUploadsPath)) {
                const backupUploadsPath = path.join(__dirname, `../uploads_old_${Date.now()}`);
                fs.renameSync(serverUploadsPath, backupUploadsPath);
                console.log('[BACKUP UPLOAD] Backup da pasta uploads atual criado:', backupUploadsPath);
            }
            
            copyDirSync(uploadsBackupPath, serverUploadsPath);
            console.log('[BACKUP UPLOAD] Arquivos de upload restaurados');
        } else {
            console.log('[BACKUP UPLOAD] Nenhuma pasta uploads encontrada no backup');
        }

        // Limpar pasta temporária
        if (tempRestoreDir && fs.existsSync(tempRestoreDir)) {
            fs.rmSync(tempRestoreDir, { recursive: true, force: true });
            console.log('[BACKUP UPLOAD] Pasta temporária removida');
        }
        
        console.log('[BACKUP UPLOAD] Processo concluído com sucesso!');
        res.json({ msg: 'Sistema restaurado com sucesso a partir do arquivo carregado!' });

    } catch (error) {
        console.error('[BACKUP UPLOAD] Erro no processo:', error);
        
        // Cleanup em caso de erro
        if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
            try { fs.unlinkSync(uploadedFilePath); } catch (e) { console.error('Erro ao remover arquivo:', e); }
        }
        if (tempRestoreDir && fs.existsSync(tempRestoreDir)) {
            try { fs.rmSync(tempRestoreDir, { recursive: true, force: true }); } catch (e) { console.error('Erro ao remover diretório:', e); }
        }
        
        res.status(500).json({ 
            msg: 'Erro ao processar o backup.', 
            error: error.message 
        });
    }
});

// --- ENDPOINT DE DIAGNÓSTICO ---
router.get('/diagnostico', async (req, res) => {
    try {
        const empresasCount = await Empresa.countDocuments();
        const usuariosCount = await Usuario.countDocuments();
        const dbName = mongoose.connection.db.databaseName;
        const dbHost = mongoose.connection.host;
        const dbState = mongoose.connection.readyState; // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
        
        const stateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
        
        // Lista todas as coleções do banco
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        // Busca detalhes de cada coleção
        const detalhesColecoes = {};
        for (const collectionName of collectionNames) {
            try {
                const count = await mongoose.connection.db.collection(collectionName).countDocuments();
                detalhesColecoes[collectionName] = count;
            } catch (e) {
                detalhesColecoes[collectionName] = 'erro';
            }
        }
        
        res.json({
            banco: {
                nome: dbName,
                host: dbHost,
                estado: stateMap[dbState],
                uri: process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL
            },
            colecoes: collectionNames,
            detalhesColecoes: detalhesColecoes,
            contagens: {
                empresas: empresasCount,
                usuarios: usuariosCount
            }
        });
    } catch (error) {
        console.error('[DIAGNOSTICO] Erro:', error);
        res.status(500).json({ msg: 'Erro ao obter diagnóstico', error: error.message });
    }
});

// --- FUNÇÕES AUXILIARES PARA INSPEÇÃO ---
async function inspecionarBackupComum(backupPath, originalName) {
    let tempInspectDir = null;
    
    try {
        tempInspectDir = path.join(uploadDir, `temp-inspect-${Date.now()}`);
        fs.mkdirSync(tempInspectDir, { recursive: true });

        // Descompactar
        await new Promise((resolve, reject) => {
            fs.createReadStream(backupPath)
                .pipe(unzipper.Extract({ path: tempInspectDir }))
                .on('close', resolve)
                .on('error', reject);
        });

        const filesInTemp = fs.readdirSync(tempInspectDir);
        const dbDumpFile = filesInTemp.find(f => f.endsWith('.gz'));
        const hasUploadsFolder = fs.existsSync(path.join(tempInspectDir, 'uploads'));

        let uploadsFolderInfo = null;
        if (hasUploadsFolder) {
            const uploadsPath = path.join(tempInspectDir, 'uploads');
            const getDirectorySize = (dirPath) => {
                let size = 0;
                const files = fs.readdirSync(dirPath, { withFileTypes: true });
                for (const file of files) {
                    const filePath = path.join(dirPath, file.name);
                    if (file.isDirectory()) {
                        size += getDirectorySize(filePath);
                    } else {
                        size += fs.statSync(filePath).size;
                    }
                }
                return size;
            };

            const countFiles = (dirPath) => {
                let count = 0;
                const files = fs.readdirSync(dirPath, { withFileTypes: true });
                for (const file of files) {
                    const filePath = path.join(dirPath, file.name);
                    if (file.isDirectory()) {
                        count += countFiles(filePath);
                    } else {
                        count++;
                    }
                }
                return count;
            };

            uploadsFolderInfo = {
                exists: true,
                size: getDirectorySize(uploadsPath),
                fileCount: countFiles(uploadsPath)
            };
        }

        // Inspecionar o dump usando mongorestore --dryRun
        let dumpInfo = { success: false };
        if (dbDumpFile) {
            const dbDumpFilePath = path.join(tempInspectDir, dbDumpFile);
            const mongorestoreExecutable = process.env.MONGODUMP_PATH 
                ? `"${process.env.MONGODUMP_PATH.replace('mongodump', 'mongorestore')}"` 
                : 'mongorestore';
            
            const inspectCommand = `${mongorestoreExecutable} --archive="${dbDumpFilePath}" --gzip --dryRun`;

            await new Promise((resolve) => {
                exec(inspectCommand, (error, stdout, stderr) => {
                    const output = stdout + stderr;
                    const lines = output.split('\n');
                    const collections = [];
                    
                    lines.forEach(line => {
                        const restoreMatch = line.match(/restoring (\w+)\.(\w+) from/);
                        const docMatch = line.match(/(\d+) document\(s\)/);
                        
                        if (restoreMatch) {
                            const collectionName = restoreMatch[2];
                            const docCount = docMatch ? parseInt(docMatch[1]) : 0;
                            collections.push({ 
                                database: restoreMatch[1], 
                                collection: collectionName,
                                docCount: docCount
                            });
                        }
                    });

                    if (collections.length > 0 || output.includes('dry run completed')) {
                        dumpInfo = {
                            success: true,
                            output: output,
                            collections: collections
                        };
                    } else {
                        dumpInfo = {
                            success: false,
                            error: output
                        };
                    }
                    resolve();
                });
            });
        }

        // Limpar pasta temporária
        if (tempInspectDir && fs.existsSync(tempInspectDir)) {
            fs.rmSync(tempInspectDir, { recursive: true, force: true });
        }

        return {
            arquivoOriginal: originalName,
            tamanho: fs.statSync(backupPath).size,
            arquivosExtraidos: filesInTemp,
            temDumpDB: !!dbDumpFile,
            dumpInfo: dumpInfo,
            uploadsInfo: uploadsFolderInfo || { exists: false }
        };

    } catch (error) {
        if (tempInspectDir && fs.existsSync(tempInspectDir)) {
            try { fs.rmSync(tempInspectDir, { recursive: true, force: true }); } catch (e) {}
        }
        throw error;
    }
}

// --- ENDPOINT PARA INSPECIONAR BACKUP ENVIADO ---
router.post('/backup/inspecionar', upload.single('backupFile'), async (req, res) => {
    let uploadedFilePath = null;
    
    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'Nenhum arquivo foi enviado.' });
        }

        uploadedFilePath = req.file.path;
        const fileExtension = path.extname(req.file.originalname).toLowerCase();

        if (fileExtension !== '.zip') {
            if (fs.existsSync(uploadedFilePath)) fs.unlinkSync(uploadedFilePath);
            return res.status(400).json({ msg: 'Formato inválido. Envie um arquivo .zip' });
        }

        const resultado = await inspecionarBackupComum(uploadedFilePath, req.file.originalname);
        
        // Remover arquivo enviado após inspeção
        if (fs.existsSync(uploadedFilePath)) {
            fs.unlinkSync(uploadedFilePath);
        }

        res.json(resultado);

    } catch (error) {
        console.error('[INSPECIONAR BACKUP] Erro:', error);
        
        if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
            try { fs.unlinkSync(uploadedFilePath); } catch (e) {}
        }
        
        res.status(500).json({ msg: 'Erro ao inspecionar backup', error: error.message });
    }
});

// --- ENDPOINT PARA INSPECIONAR BACKUP DO SERVIDOR ---
router.post('/backup/inspecionar-servidor', async (req, res) => {
    try {
        const { filename } = req.body;
        
        if (!filename) {
            return res.status(400).json({ msg: 'Nome do arquivo não fornecido' });
        }

        const backupPath = path.join(backupDir, filename);
        
        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ msg: 'Backup não encontrado no servidor' });
        }

        const resultado = await inspecionarBackupComum(backupPath, filename);
        resultado.filename = filename; // Adiciona o filename ao resultado
        
        res.json(resultado);

    } catch (error) {
        console.error('[INSPECIONAR BACKUP SERVIDOR] Erro:', error);
        res.status(500).json({ msg: 'Erro ao inspecionar backup', error: error.message });
    }
});

module.exports = router;