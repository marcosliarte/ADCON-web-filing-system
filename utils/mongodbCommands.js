// utils/mongodbCommands.js - Executor seguro de comandos MongoDB

const { spawn } = require('child_process');
const path = require('path');

/**
 * Sanitiza um caminho de arquivo para prevenir command injection
 * @param {string} filePath - Caminho do arquivo
 * @returns {string} - Caminho sanitizado
 */
function sanitizePath(filePath) {
  if (!filePath) {
    throw new Error('Caminho do arquivo não pode ser vazio');
  }

  // Resolve o caminho para evitar path traversal
  const resolved = path.resolve(filePath);

  // Verifica se contém caracteres perigosos
  const dangerous = /[;&|`$()]/;
  if (dangerous.test(resolved)) {
    throw new Error('Caminho contém caracteres não permitidos');
  }

  return resolved;
}

/**
 * Sanitiza a URI do MongoDB para prevenir injection
 * @param {string} uri - URI do MongoDB
 * @returns {string} - URI sanitizada
 */
function sanitizeMongoURI(uri) {
  if (!uri) {
    throw new Error('URI do MongoDB não pode ser vazia');
  }

  // Verifica formato básico
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error('URI do MongoDB inválida');
  }

  // Verifica caracteres perigosos (mas permite @ e : que são válidos em URIs)
  const dangerous = /[;&|`$()]/;
  if (dangerous.test(uri)) {
    throw new Error('URI contém caracteres não permitidos');
  }

  return uri;
}

/**
 * Executa mongodump de forma segura usando spawn (não exec)
 * @param {Object} options - Opções
 * @param {string} options.uri - URI do MongoDB
 * @param {string} options.outputPath - Caminho do arquivo de saída
 * @param {string} options.mongodumpPath - Caminho do executável mongodump (opcional)
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function executeMongodump({ uri, outputPath, mongodumpPath = 'mongodump' }) {
  return new Promise((resolve, reject) => {
    try {
      // Sanitiza inputs
      const safeUri = sanitizeMongoURI(uri);
      const safeOutput = sanitizePath(outputPath);
      
      // Sanitiza o caminho do executável
      const safeMongodumpPath = mongodumpPath.includes('mongodump') 
        ? mongodumpPath 
        : 'mongodump';

      // Usa spawn ao invés de exec para evitar shell injection
      // spawn não interpreta comandos do shell, apenas executa o binário diretamente
      const args = [
        `--uri=${safeUri}`,
        `--archive=${safeOutput}`,
        '--gzip',
      ];

      console.log('[MONGODUMP] Executando:', safeMongodumpPath, 'com argumentos separados');

      const proc = spawn(safeMongodumpPath, args);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`mongodump falhou com código ${code}: ${stderr}`));
        }
        resolve({ stdout, stderr });
      });

      proc.on('error', (err) => {
        reject(new Error(`Erro ao executar mongodump: ${err.message}`));
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Executa mongorestore de forma segura usando spawn
 * @param {Object} options - Opções
 * @param {string} options.uri - URI do MongoDB
 * @param {string} options.archivePath - Caminho do arquivo de backup
 * @param {string} options.mongorestorePath - Caminho do executável mongorestore (opcional)
 * @param {boolean} options.drop - Se deve dropar coleções existentes (padrão: true)
 * @param {boolean} options.dryRun - Modo dry-run para inspeção (padrão: false)
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function executeMongorestore({ 
  uri, 
  archivePath, 
  mongorestorePath = 'mongorestore',
  drop = true,
  dryRun = false,
}) {
  return new Promise((resolve, reject) => {
    try {
      // Sanitiza inputs
      const safeUri = sanitizeMongoURI(uri);
      const safeArchive = sanitizePath(archivePath);
      
      // Sanitiza o caminho do executável
      const safeMongorestorePath = mongorestorePath.includes('mongorestore') 
        ? mongorestorePath 
        : 'mongorestore';

      // Argumentos seguros
      const args = [
        `--uri=${safeUri}`,
        `--archive=${safeArchive}`,
        '--gzip',
      ];

      if (drop) args.push('--drop');
      if (dryRun) args.push('--dryRun');

      console.log('[MONGORESTORE] Executando:', safeMongorestorePath, 'com argumentos separados');

      const proc = spawn(safeMongorestorePath, args);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`mongorestore falhou com código ${code}: ${stderr}`));
        }
        resolve({ stdout, stderr });
      });

      proc.on('error', (err) => {
        reject(new Error(`Erro ao executar mongorestore: ${err.message}`));
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Extrai contagem de documentos do output do mongodump/mongorestore
 * @param {string} output - Output do comando
 * @returns {number} - Número de documentos
 */
function extractDocumentCount(output) {
  // Procura por padrões como "23 document(s)"
  const match = output.match(/(\d+)\s+document/);
  return match ? parseInt(match[1], 10) : 0;
}

module.exports = {
  executeMongodump,
  executeMongorestore,
  sanitizePath,
  sanitizeMongoURI,
  extractDocumentCount,
};
