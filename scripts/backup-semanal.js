// Backup semanal automatico: dump do MongoDB + pasta uploads, zipados em _backups/,
// com uma copia em um segundo disco (protege contra falha do disco principal).
// Disparado pelo Agendador de Tarefas do Windows (ver scripts/instalar-tarefa-backup.ps1).
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const archiver = require('archiver');

const backupDir = path.join(__dirname, '../_backups');
const uploadsPath = path.join(__dirname, '../uploads');
const logFile = path.join(__dirname, '../logs/backup-semanal.log');

// Copia secundaria em outro disco fisico - ajuste se a letra do disco mudar.
const SEGUNDA_COPIA_DIR = 'E:\\ADCON-Backups';

// Quantos backups semanais manter em cada local (8 = ~2 meses de historico)
const RETENCAO = 8;

fs.mkdirSync(backupDir, { recursive: true });
fs.mkdirSync(path.dirname(logFile), { recursive: true });

function log(msg) {
  const line = `${new Date().toLocaleString('pt-BR')} - ${msg}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
}

function aplicarRetencao(dir) {
  if (!fs.existsSync(dir)) return;
  const arquivos = fs.readdirSync(dir)
    .filter((f) => /^backup-completo-.*\.zip$/.test(f))
    .map((f) => ({ nome: f, caminho: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  const antigos = arquivos.slice(RETENCAO);
  for (const arq of antigos) {
    fs.unlinkSync(arq.caminho);
    log(`Backup antigo removido (retencao de ${RETENCAO}): ${arq.nome} [${dir}]`);
  }
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dbDumpFilename = `db-dump-${timestamp}.gz`;
  const dbDumpFilePath = path.join(backupDir, dbDumpFilename);
  const mongodumpExecutable = process.env.MONGODUMP_PATH || 'mongodump';
  const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;

  if (!MONGODB_URI) {
    log('ERRO: MONGODB_URI nao configurada. Abortando backup.');
    process.exit(1);
  }

  log('Iniciando backup semanal...');

  const command = `"${mongodumpExecutable}" --uri="${MONGODB_URI}" --archive="${dbDumpFilePath}" --gzip`;

  await new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        log(`ERRO no mongodump: ${stderr || err.message}`);
        return reject(err);
      }
      resolve();
    });
  });

  if (!fs.existsSync(dbDumpFilePath) || fs.statSync(dbDumpFilePath).size === 0) {
    log('ERRO: dump do banco nao foi criado ou esta vazio.');
    process.exit(1);
  }
  log(`Dump do banco criado: ${(fs.statSync(dbDumpFilePath).size / 1024).toFixed(2)} KB`);

  const finalBackupFilename = `backup-completo-${timestamp}.zip`;
  const finalBackupPath = path.join(backupDir, finalBackupFilename);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(finalBackupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.on('warning', (w) => log(`Aviso ao zipar: ${w.message}`));

    archive.pipe(output);
    archive.file(dbDumpFilePath, { name: dbDumpFilename });
    if (fs.existsSync(uploadsPath)) {
      archive.directory(uploadsPath, 'uploads');
    }
    archive.finalize();
  });

  fs.unlinkSync(dbDumpFilePath);
  const zipSizeMB = (fs.statSync(finalBackupPath).size / (1024 * 1024)).toFixed(2);
  log(`Backup completo criado: ${finalBackupFilename} (${zipSizeMB} MB)`);

  aplicarRetencao(backupDir);

  // Copia para o segundo disco, se disponivel
  try {
    fs.mkdirSync(SEGUNDA_COPIA_DIR, { recursive: true });
    fs.copyFileSync(finalBackupPath, path.join(SEGUNDA_COPIA_DIR, finalBackupFilename));
    log(`Copia salva em: ${SEGUNDA_COPIA_DIR}`);
    aplicarRetencao(SEGUNDA_COPIA_DIR);
  } catch (copyErr) {
    log(`AVISO: nao foi possivel copiar para ${SEGUNDA_COPIA_DIR}: ${copyErr.message}`);
  }

  log('Backup semanal concluido com sucesso.');
}

main().catch((err) => {
  log(`FALHA no backup semanal: ${err.message}`);
  process.exit(1);
});
