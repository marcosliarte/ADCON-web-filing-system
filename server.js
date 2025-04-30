const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer'); // Importando multer para lidar com uploads
const empresaRoute = require('./routes/rota-empresa'); // Importando as rotas
const fs = require('fs'); // Para manipulação de arquivos e diretórios
const cors = require('cors'); // Para permitir CORS, se necessário

const app = express();

// Configuração do Multer para salvar arquivos de forma segura
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/'; // Diretório de upload

    // Verifica se o diretório existe, caso contrário, cria
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }

    cb(null, uploadDir); // Define o diretório de destino
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Define um nome único para o arquivo
  }
});

// Adicionando validações de tipo de arquivo e tamanho
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Tipo de arquivo não permitido'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 } // Limitar o tamanho do arquivo para 10MB
});

// Conexão com o MongoDB
mongoose.connect('mongodb://localhost:27017/system_adcon', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('Conectado ao MongoDB'))
  .catch(err => console.error('Erro de conexão:', err));

// Middleware para JSON e URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração de CORS (caso o frontend esteja em outro servidor)
app.use(cors());

// Servindo o formulário estático (frontend)
app.use(express.static(path.join(__dirname, 'client')));

// Servindo os arquivos enviados (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rota para as empresas
app.use('/api', empresaRoute); // Certifique-se de que a rota está correta em rota-empresa.js

// Tratamento de erros do Multer (para uma resposta mais amigável ao frontend)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ mensagem: err.message });
  }
  if (err) {
    return res.status(500).json({ mensagem: 'Erro no servidor' });
  }
  next();
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
