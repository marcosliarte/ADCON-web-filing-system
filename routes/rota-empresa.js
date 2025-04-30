const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs'); // Importando o módulo fs
const Empresa = require('../models/model-empresa');

// Configuração do multer com nome de arquivo com hash
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    // Verifica se o diretório de uploads existe, caso contrário, cria
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true }); // Criação recursiva do diretório
    }
    cb(null, uploadDir); // Define o diretório de destino
  },
  filename: (req, file, cb) => {
    const hash = crypto.randomBytes(16).toString('hex'); // Gera um nome de arquivo único
    const ext = path.extname(file.originalname).toLowerCase(); // Obtém a extensão do arquivo
    cb(null, `${hash}${ext}`); // Define o nome único do arquivo
  }
});

// Inicializando o multer com validação de arquivo
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase(); // Obtém a extensão do arquivo
    if (!tiposPermitidos.includes(ext)) {
      return cb(new Error('Tipo de arquivo não permitido'), false);
    }
    cb(null, true); // Aceita o arquivo
  },
  limits: { fileSize: 5 * 1024 * 1024 } // Limite de 5MB por arquivo
});

// Função para limpar o CNPJ (remover caracteres não numéricos)
function limparCNPJ(cnpj) {
  return cnpj.replace(/[^\d]/g, '');
}

// Rota de POST para cadastro de empresa
router.post('/empresa', upload.single('arquivo'), async (req, res) => {
  try {
    const { cnpj, nome } = req.body;

    // Validação se todos os campos foram preenchidos
    if (!cnpj || !nome || !req.file) {
      return res.status(400).json({ mensagem: 'Todos os campos são obrigatórios (CNPJ, nome, arquivo).' });
    }

    // Limpa o CNPJ para garantir que não haja caracteres não numéricos
    const cnpjLimpo = limparCNPJ(cnpj);

    // Validação de CNPJ (deve ter 14 dígitos numéricos)
    if (!/^\d{14}$/.test(cnpjLimpo)) {
      return res.status(400).json({ mensagem: 'CNPJ inválido. Deve conter exatamente 14 dígitos numéricos.' });
    }

    // Verifica se a empresa já existe
    const empresaExistente = await Empresa.findOne({ cnpj: cnpjLimpo });
    if (empresaExistente) {
      return res.status(400).json({ mensagem: 'CNPJ já cadastrado.' });
    }

    // Criação de uma nova empresa
    const novaEmpresa = new Empresa({
      cnpj: cnpjLimpo,
      nome,
      arquivo: req.file.filename, // Nome do arquivo gerado
      nomeArquivo: req.file.originalname // Nome original do arquivo
    });

    // Salva a nova empresa no banco de dados
    await novaEmpresa.save();
    res.status(201).json({ mensagem: 'Cadastro realizado com sucesso!' });

  } catch (err) {
    console.error('Erro ao salvar empresa:', err);

    // Tratamento específico para erro de CNPJ duplicado
    if (err.code === 11000) {
      return res.status(400).json({ mensagem: 'CNPJ duplicado.' });
    }

    // Tratamento de erro de tipo de arquivo
    if (err.message === 'Tipo de arquivo não permitido') {
      return res.status(400).json({ mensagem: 'Tipo de arquivo não permitido. Envie apenas PDF, DOC, PNG, JPG, etc.' });
    }

    // Erro de leitura ou outro erro geral
    if (err.message.includes('ENOENT') || err.message.includes('Error')) {
      return res.status(500).json({ mensagem: 'Erro no processamento do arquivo.' });
    }

    // Erro geral do servidor
    res.status(500).json({ mensagem: 'Erro interno do servidor' });
  }
});

module.exports = router;
