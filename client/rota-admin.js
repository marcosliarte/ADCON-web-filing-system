const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Middleware de autenticação
const Usuario = require('../models/Usuario');
const Log = require('../models/Log');
const Empresa = require('../models/Empresa');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

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
        // Usa o nome original do arquivo para evitar conflitos.
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Validação importante: mongorestore com --gzip espera .gz, não .zip
        // O frontend foi ajustado para enviar .zip, mas o backend espera .gz
        // Vamos aceitar ambos e tratar na rota.
        if (file.mimetype === 'application/zip' || file.mimetype === 'application/gzip' || file.originalname.endsWith('.zip') || file.originalname.endsWith('.gz')) {
            cb(null, true);
        } else {
            cb(new Error('Formato de arquivo inválido. Apenas .zip ou .gz são permitidos.'), false);
        }
    }
});

// --- NOVA ROTA PARA UPLOAD E RESTAURAÇÃO ---
// A rota usa o middleware 'auth' e o 'upload.single()'.
// 'backupFile' deve ser o mesmo nome usado no FormData do frontend.
router.post('/backup/upload', auth, upload.single('backupFile'), async (req, res) => {
    // Verifica se o usuário é um administrador.
    if (req.usuario.role !== 'admin') {
        return res.status(403).json({ msg: 'Acesso negado. Apenas administradores podem restaurar backups.' });
    }

    // Verifica se um arquivo foi realmente enviado.
    if (!req.file) {
        return res.status(400).json({ msg: 'Nenhum arquivo de backup foi enviado.' });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();

    // Validação crucial: mongorestore com --gzip espera .gz.
    // Se o arquivo for .zip, a restauração falhará.
    if (fileExtension !== '.gz') {
        fs.unlinkSync(filePath); // Limpa o arquivo inválido que foi carregado.
        return res.status(400).json({ msg: 'Formato de arquivo inválido. A restauração só pode ser feita a partir de um arquivo .gz gerado pelo sistema.' });
    }

    // --- COMANDO DE RESTAURAÇÃO ---
    // ATENÇÃO: Ajuste o caminho para o seu mongorestore.exe se for diferente.
    const mongoRestorePath = `"C:\\Program Files\\MongoDB\\Tools\\100\\bin\\mongorestore.exe"`;
    const dbUri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;

    if (!dbUri) {
        return res.status(500).json({ msg: 'URI do banco de dados não configurada no servidor.' });
    }

    // O comando --drop limpa o banco de dados antes de restaurar. É uma operação destrutiva.
    const command = `${mongoRestorePath} --uri="${dbUri}" --archive="${filePath}" --gzip --drop`;

    console.log('--- EXECUTANDO COMANDO DE RESTAURAÇÃO ---');
    console.log(command);

    exec(command, (error, stdout, stderr) => {
        // Limpa o arquivo temporário após a tentativa de restauração.
        fs.unlinkSync(filePath);

        if (error) {
            console.error(`Erro ao restaurar: ${error.message}`);
            console.error(`Stderr: ${stderr}`);
            return res.status(500).json({ msg: `Erro ao executar a restauração. Detalhes: ${stderr || error.message}` });
        }

        console.log(`Stdout: ${stdout}`);
        res.status(200).json({ msg: 'Banco de dados restaurado com sucesso a partir do backup!' });
    });
});

// Adicione outras rotas de admin aqui, se houver...

module.exports = router;