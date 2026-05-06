const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const os = require('os');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { exec } = require('child_process');
const archiver = require('archiver');
const unzipper = require('unzipper');
const multer = require('multer');
const cache = require('../utils/cache');
const zlib = require('zlib');

const Empresa = require('../models/model-empresa');
const Usuario = require('../models/model-usuario');

function getDbNameFromUri(uri) {
    const match = uri.match(/\/([^/?@]+)(\?|$)/);
    return (match && match[1]) ? match[1] : null;
}

function getBaseUri(uri) {
    return uri.replace(/\/([^/?@]+)(\?|$)/, '/$2');
}

async function getSourceDbFromArchive(archivePath) {
    return new Promise((resolve) => {
        const input = fs.createReadStream(archivePath);
        const gz = zlib.createGunzip();
        let buf = Buffer.alloc(0);
        let done = false;

        const finish = (result) => {
            if (done) return;
            done = true;
            resolve(result);
            input.destroy();
            gz.destroy();
        };

        gz.on('data', (chunk) => {
            buf = Buffer.concat([buf, chunk]);
            const marker = Buffer.from([0x02, 0x64, 0x62, 0x00]); // \x02 "db" \x00
            const idx = buf.indexOf(marker);
            if (idx !== -1 && buf.length >= idx + 8) {
                const strLen = buf.readInt32LE(idx + 4);
                if (buf.length >= idx + 8 + strLen) {
                    finish(buf.slice(idx + 8, idx + 8 + strLen - 1).toString('utf8'));
                }
            }
            if (buf.length > 4096) finish(null);
        });

        gz.on('error', () => finish(null));
        gz.on('end', () => finish(null));
        input.on('error', () => finish(null));
        input.pipe(gz);
    });
}

function buildRestoreCommand(executable, uri, archivePath) {
    const targetDb = getDbNameFromUri(uri);
    return async () => {
        const sourceDb = await getSourceDbFromArchive(archivePath);
        const needsRemap = targetDb && sourceDb && targetDb !== sourceDb;
        const connUri = needsRemap ? getBaseUri(uri) : uri;
        const nsFlags = needsRemap ? `--nsFrom="${sourceDb}.*" --nsTo="${targetDb}.*"` : '';
        return `${executable} --uri="${connUri}" --archive="${archivePath}" --gzip --drop ${nsFlags}`.trimEnd();
    };
}

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

        // 2. Uso de espaço em disco — cacheado por 60s para evitar varreduras frequentes
        const uploadsDir = path.join(__dirname, '../uploads');
        let diskUsage = 0;
        let backupDiskUsage = 0;

        const cachedDisk = cache.get('dashboard:diskUsage');
        if (cachedDisk) {
            ({ diskUsage, backupDiskUsage } = cachedDisk);
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
                } catch (e) {}
                return total;
            };

            try {
                if (fs.existsSync(uploadsDir)) diskUsage = await getDirSizeAsync(uploadsDir);
                if (fs.existsSync(backupDir)) backupDiskUsage = await getDirSizeAsync(backupDir);
                cache.set('dashboard:diskUsage', { diskUsage, backupDiskUsage }, 60 * 1000);
            } catch (e) {
                console.error('Erro ao calcular tamanho de diretórios:', e.message);
            }
        }

        // 4. Contagem de entidades — cacheado por 30s
        let totalUsuarios, totalEmpresas;
        const cachedCounts = cache.get('dashboard:counts');
        if (cachedCounts) {
            ({ totalUsuarios, totalEmpresas } = cachedCounts);
        } else {
            [totalUsuarios, totalEmpresas] = await Promise.all([
                Usuario.countDocuments(),
                Empresa.countDocuments(),
            ]);
            cache.set('dashboard:counts', { totalUsuarios, totalEmpresas }, 30 * 1000);
        }

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
router.post('/backup/create', async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dbDumpFilename = `db-dump-${timestamp}.gz`;
    const dbDumpFilePath = path.join(backupDir, dbDumpFilename);

    // Pega o caminho do mongodump do .env ou usa o comando padrão
    const mongodumpExecutable = process.env.MONGODUMP_PATH || 'mongodump';
    const MONGODB_URI_PARA_BACKUP = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;

    console.log(`[BACKUP] Iniciando backup em ${timestamp}`);
    console.log(`[BACKUP] Usando mongodump: ${mongodumpExecutable}`);
    console.log(`[BACKUP] URI MongoDB: ${MONGODB_URI_PARA_BACKUP ? 'Configurada' : 'NÃO CONFIGURADA'}`);

    // Verifica se há dados no banco antes de criar backup
    const mongoose = require('mongoose');
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`[BACKUP] Coleções no banco: ${collections.length}`);
    
    if (collections.length === 0) {
      return res.status(400).json({ 
        msg: 'O banco de dados está vazio. Não há dados para fazer backup.' 
      });
    }

    // Conta documentos totais
    let totalDocs = 0;
    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log(`[BACKUP] Coleção ${col.name}: ${count} documentos`);
      totalDocs += count;
    }

    console.log(`[BACKUP] Total de documentos no banco: ${totalDocs}`);

    if (totalDocs === 0) {
      return res.status(400).json({ 
        msg: 'O banco de dados não contém documentos. Não há dados para fazer backup.' 
      });
    }

    // Constrói o comando com aspas para Windows
    const command = `"${mongodumpExecutable}" --uri="${MONGODB_URI_PARA_BACKUP}" --archive="${dbDumpFilePath}" --gzip`;

    console.log(`[BACKUP] Executando mongodump...`);

  // Executa o comando com buffer maior
  exec(command, { maxBuffer: 50 * 1024 * 1024 }, (dumpError, stdout, stderr) => {
    if (dumpError) {
      console.error(`[BACKUP ERROR] Erro ao criar dump:`, dumpError.message);
      console.error(`[BACKUP ERROR] stderr:`, stderr);
      console.error(`[BACKUP ERROR] stdout:`, stdout);
      return res.status(500).json({ 
        msg: 'Falha ao criar o backup do banco de dados.', 
        error: stderr || dumpError.message 
      });
    }

    console.log(`[BACKUP] stdout:`, stdout);
    if (stderr) console.log(`[BACKUP] stderr:`, stderr);

    // Verifica se o arquivo de dump foi criado e tem tamanho > 0
    if (!fs.existsSync(dbDumpFilePath)) {
      console.error(`[BACKUP ERROR] Arquivo de dump não foi criado: ${dbDumpFilePath}`);
      return res.status(500).json({ 
        msg: 'Arquivo de dump do banco não foi criado.' 
      });
    }

    const dumpStats = fs.statSync(dbDumpFilePath);
    console.log(`[BACKUP] Dump criado com sucesso: ${(dumpStats.size / 1024).toFixed(2)} KB`);

    if (dumpStats.size === 0) {
      console.error(`[BACKUP ERROR] Arquivo de dump está vazio (0 bytes)`);
      fs.unlinkSync(dbDumpFilePath);
      return res.status(500).json({ 
        msg: 'Backup do banco de dados está vazio. Verifique se há dados no MongoDB.' 
      });
    }

    // Cria o arquivo ZIP final
    const finalBackupFilename = `backup-completo-${timestamp}.zip`;
    const finalBackupPath = path.join(backupDir, finalBackupFilename);
    const uploadsPath = path.join(__dirname, '../uploads');

    console.log(`[BACKUP] Criando arquivo ZIP: ${finalBackupFilename}`);

    const output = fs.createWriteStream(finalBackupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      const zipSize = (archive.pointer() / (1024 * 1024)).toFixed(2);
      console.log(`[BACKUP] ZIP criado com sucesso: ${zipSize} MB`);
      
      // Remove o dump temporário
      fs.unlink(dbDumpFilePath, (unlinkErr) => { 
        if (unlinkErr) console.error("[BACKUP] Erro ao remover dump temporário:", unlinkErr); 
      });
      
      res.json({ 
        msg: `Backup completo criado com sucesso! (${zipSize} MB)`, 
        file: finalBackupFilename,
        size: zipSize + ' MB'
      });
    });

    archive.on('error', (archiveErr) => {
      console.error(`[BACKUP ERROR] Erro ao criar ZIP:`, archiveErr);
      res.status(500).json({ 
        msg: 'Falha ao criar o arquivo ZIP.', 
        error: archiveErr.message 
      });
    });

    archive.on('warning', (warn) => {
      console.warn(`[BACKUP WARNING]`, warn);
    });

    archive.pipe(output);
    
    // Adiciona o dump do banco ao ZIP
    archive.file(dbDumpFilePath, { name: dbDumpFilename });
    
    // Adiciona pasta uploads se existir
    if (fs.existsSync(uploadsPath)) {
      const uploadsStats = fs.readdirSync(uploadsPath);
      console.log(`[BACKUP] Adicionando pasta uploads (${uploadsStats.length} itens)`);
      archive.directory(uploadsPath, 'uploads');
    } else {
      console.log(`[BACKUP] Pasta uploads não encontrada, continuando sem ela`);
    }
    
    archive.finalize();
  });
  
  } catch (error) {
    console.error('[BACKUP ERROR] Erro inesperado:', error);
    res.status(500).json({ 
      msg: 'Erro ao criar backup.', 
      error: error.message 
    });
  }
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

// @route   GET api/admin/backup/analyze/:filename
// @desc    Analisar o conteúdo de um backup sem restaurá-lo
router.get('/backup/analyze/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        if (!filename) {
            return res.status(400).json({ msg: 'Nome do arquivo de backup é obrigatório.' });
        }

        const backupFilePath = path.join(backupDir, filename);
        if (!fs.existsSync(backupFilePath)) {
            return res.status(404).json({ msg: 'Arquivo de backup não encontrado.' });
        }

        // Informações básicas do arquivo
        const stats = fs.statSync(backupFilePath);
        const fileInfo = {
            filename,
            size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
            createdAt: stats.birthtime,
        };

        // Criar diretório temporário para análise
        const tempInspectDir = path.join('_temp_uploads', `temp-inspect-${Date.now()}`);
        fs.mkdirSync(tempInspectDir, { recursive: true });

        try {
            // Extrair o ZIP
            await new Promise((resolve, reject) => {
                fs.createReadStream(backupFilePath)
                    .pipe(unzipper.Extract({ path: tempInspectDir }))
                    .on('finish', resolve)
                    .on('error', reject);
            });

            const filesInTemp = fs.readdirSync(tempInspectDir);
            
            // Analisar arquivos de dump do banco
            const dbDumpFile = filesInTemp.find(f => f.endsWith('.gz'));
            let databaseInfo = {
                totalCollections: 0,
                totalDocuments: 0,
                collections: {}
            };

            if (dbDumpFile) {
                const dbDumpFilePath = path.join(tempInspectDir, dbDumpFile);
                
                // Criar diretório temporário para restauração de teste
                const tempDbDir = path.join(tempInspectDir, 'temp_db_inspect');
                fs.mkdirSync(tempDbDir, { recursive: true });

                // Extrair dump para análise
                const mongorestoreExecutable = process.env.MONGODUMP_PATH ? 
                    `"${process.env.MONGODUMP_PATH.replace('mongodump', 'mongorestore')}"` : 
                    'mongorestore';
                
                const inspectCommand = `${mongorestoreExecutable} --archive="${dbDumpFilePath}" --gzip --dryRun 2>&1`;
                
                try {
                    const { stdout } = await new Promise((resolve, reject) => {
                        exec(inspectCommand, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
                            if (error && !stdout) {
                                reject(error);
                            } else {
                                resolve({ stdout: stdout + stderr });
                            }
                        });
                    });

                    // Parsear output do mongorestore --dryRun
                    const lines = stdout.split('\n');
                    const collectionCounts = {};
                    
                    for (const line of lines) {
                        // Procurar por linhas que indicam documentos restaurados
                        const match = line.match(/(\w+)\.(\w+)\s+to\s+\w+\.(\w+)/);
                        if (match) {
                            const collection = match[2];
                            if (!collectionCounts[collection]) {
                                collectionCounts[collection] = 0;
                                databaseInfo.totalCollections++;
                            }
                        }
                        
                        // Contar documentos
                        const docMatch = line.match(/(\d+)\s+document/);
                        if (docMatch) {
                            const count = parseInt(docMatch[1]);
                            databaseInfo.totalDocuments += count;
                            
                            // Tentar associar ao último collection visto
                            const lastCollection = Object.keys(collectionCounts).pop();
                            if (lastCollection) {
                                collectionCounts[lastCollection] = count;
                            }
                        }
                    }

                    databaseInfo.collections = collectionCounts;
                    
                } catch (execError) {
                    console.error('Erro ao analisar dump:', execError);
                    // Análise básica se falhar
                    databaseInfo = {
                        totalCollections: 'N/A',
                        totalDocuments: 'N/A',
                        collections: { info: 'Análise detalhada não disponível' }
                    };
                }
            }

            // Analisar pasta uploads
            let uploadsInfo = {
                totalFiles: 0,
                totalSize: '0 MB',
                folders: []
            };

            const uploadsFolderInBackup = path.join(tempInspectDir, 'uploads');
            if (fs.existsSync(uploadsFolderInBackup)) {
                let totalBytes = 0;
                const folderStats = {};

                function scanDirectory(dir, baseDir = '') {
                    const items = fs.readdirSync(dir);
                    
                    for (const item of items) {
                        const fullPath = path.join(dir, item);
                        const stat = fs.statSync(fullPath);
                        
                        if (stat.isDirectory()) {
                            const folderName = baseDir ? `${baseDir}/${item}` : item;
                            if (!folderStats[folderName]) {
                                folderStats[folderName] = { count: 0, size: 0 };
                            }
                            scanDirectory(fullPath, folderName);
                        } else {
                            uploadsInfo.totalFiles++;
                            totalBytes += stat.size;
                            
                            if (baseDir && !folderStats[baseDir]) {
                                folderStats[baseDir] = { count: 0, size: 0 };
                            }
                            if (baseDir) {
                                folderStats[baseDir].count++;
                                folderStats[baseDir].size += stat.size;
                            }
                        }
                    }
                }

                scanDirectory(uploadsFolderInBackup);
                uploadsInfo.totalSize = (totalBytes / (1024 * 1024)).toFixed(2) + ' MB';
                uploadsInfo.folders = Object.entries(folderStats).map(([name, stats]) => ({
                    name,
                    count: stats.count,
                    size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB'
                }));
            }

            // Limpar diretório temporário
            fs.rmSync(tempInspectDir, { recursive: true, force: true });

            // Retornar análise
            res.json({
                ...fileInfo,
                database: databaseInfo,
                uploads: uploadsInfo,
            });

        } catch (extractError) {
            // Limpar em caso de erro
            if (fs.existsSync(tempInspectDir)) {
                fs.rmSync(tempInspectDir, { recursive: true, force: true });
            }
            throw extractError;
        }

    } catch (error) {
        console.error('Erro ao analisar backup:', error);
        res.status(500).json({ 
            msg: 'Erro ao analisar backup.', 
            error: error.message 
        });
    }
});

// @route   POST api/admin/backup/restore
// @desc    Restaurar o banco de dados a partir de um backup
router.post('/backup/restore', async (req, res) => {
    let tempRestoreDir = null;
    try {
        const { filename } = req.body;
        if (!filename) {
            return res.status(400).json({ msg: 'Nome do arquivo de backup é obrigatório.' });
        }

        const backupFilePath = path.join(backupDir, filename);
        if (!fs.existsSync(backupFilePath)) {
            return res.status(404).json({ msg: 'Arquivo de backup não encontrado.' });
        }

        tempRestoreDir = path.join(backupDir, `temp-restore-${Date.now()}`);
        fs.mkdirSync(tempRestoreDir, { recursive: true });

        // Extrair o ZIP usando Promise
        await new Promise((resolve, reject) => {
            fs.createReadStream(backupFilePath)
                .pipe(unzipper.Extract({ path: tempRestoreDir }))
                .on('close', resolve)
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
        const restoreCommand = await buildRestoreCommand(mongorestoreExecutable, MONGODB_URI_PARA_BACKUP, dbDumpFilePath)();

        // Executar restore usando Promise
        await new Promise((resolve, reject) => {
            exec(restoreCommand, { maxBuffer: 50 * 1024 * 1024 }, (restoreError, stdout, stderr) => {
                if (stdout) console.log('[RESTORE] mongorestore output:', stdout);
                if (stderr) console.log('[RESTORE] mongorestore stderr:', stderr);
                if (restoreError) {
                    console.error(`[RESTORE ERROR] Erro ao restaurar banco de dados: ${restoreError.message}`);
                    reject(new Error(stderr || restoreError.message || 'Falha ao restaurar o banco de dados'));
                } else {
                    resolve();
                }
            });
        });

        // Restaurar uploads se existir - MERGE ao invés de substituir
        const uploadsBackupPath = path.join(tempRestoreDir, 'uploads');
        const serverUploadsPath = path.join(__dirname, '../uploads');

        if (fs.existsSync(uploadsBackupPath)) {
            if (fs.existsSync(serverUploadsPath)) {
                // Fazer merge: copiar arquivos do backup sem sobrescrever os existentes
                const copyRecursivePreservingExisting = (src, dest) => {
                    if (fs.statSync(src).isDirectory()) {
                        if (!fs.existsSync(dest)) {
                            fs.mkdirSync(dest, { recursive: true });
                        }
                        const entries = fs.readdirSync(src, { withFileTypes: true });
                        for (const entry of entries) {
                            const srcPath = path.join(src, entry.name);
                            const destPath = path.join(dest, entry.name);
                            if (entry.isDirectory()) {
                                copyRecursivePreservingExisting(srcPath, destPath);
                            } else {
                                // Copiar apenas se o arquivo não existir no destino
                                if (!fs.existsSync(destPath)) {
                                    fs.copyFileSync(srcPath, destPath);
                                }
                            }
                        }
                    }
                };
                copyRecursivePreservingExisting(uploadsBackupPath, serverUploadsPath);
            } else {
                // Se não existe pasta uploads, simplesmente mover
                fs.renameSync(uploadsBackupPath, serverUploadsPath);
            }
        }

        // Limpar pasta temporária
        fs.rmSync(tempRestoreDir, { recursive: true, force: true });
        
        res.json({ msg: 'Sistema restaurado com sucesso!' });

    } catch (error) {
        console.error('Erro ao restaurar backup:', error);
        if (tempRestoreDir && fs.existsSync(tempRestoreDir)) {
            try { fs.rmSync(tempRestoreDir, { recursive: true, force: true }); } catch (e) {}
        }
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
        const restoreCommand = await buildRestoreCommand(mongorestoreExecutable, MONGODB_URI_PARA_BACKUP, dbDumpFilePath)();

        console.log('[BACKUP UPLOAD] Executando mongorestore...');

        // Executar restore usando Promise
        await new Promise((resolve, reject) => {
            exec(restoreCommand, (restoreError, stdout, stderr) => {
                if (restoreError) {
                    console.error('[BACKUP UPLOAD] Erro no mongorestore:', stderr);
                    reject(new Error(`Falha ao restaurar o banco de dados: ${stderr}`));
                } else {
                    console.log('[BACKUP UPLOAD] Banco de dados restaurado com sucesso');
                    if (stdout) console.log('[BACKUP UPLOAD] mongorestore output:', stdout);
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

module.exports = router;