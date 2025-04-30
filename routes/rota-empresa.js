const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const Empresa = require('../models/model-empresa');

// Configuração do multer com nome de arquivo com hash
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const hash = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${hash}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!tiposPermitidos.includes(ext)) {
      return cb(new Error('Tipo de arquivo não permitido'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

function limparCNPJ(cnpj) {
  return cnpj.replace(/[^\d]/g, '');
}

// Validação de CNPJ
function validarCNPJ(cnpj) {
  if (!/^\d{14}$/.test(cnpj)) return false;
  
  // Implementação da validação de dígitos verificadores do CNPJ
  // (pode ser adicionada posteriormente para validação mais robusta)
  
  return true;
}

// POST - Cadastro de empresa
router.post('/empresa', upload.single('arquivo'), async (req, res) => {
  try {
    const { cnpj, nome } = req.body;

    if (!cnpj || !nome || !req.file) {
      return res.status(400).json({ mensagem: 'Todos os campos são obrigatórios (CNPJ, nome, arquivo).' });
    }

    const cnpjLimpo = limparCNPJ(cnpj);

    if (!validarCNPJ(cnpjLimpo)) {
      return res.status(400).json({ mensagem: 'CNPJ inválido. Deve conter exatamente 14 dígitos numéricos.' });
    }

    const empresaExistente = await Empresa.findOne({ cnpj: cnpjLimpo });
    if (empresaExistente) {
      return res.status(400).json({ mensagem: 'CNPJ já cadastrado.' });
    }

    const novaEmpresa = new Empresa({
      cnpj: cnpjLimpo,
      nome,
      arquivo: req.file.filename,
      nomeArquivo: req.file.originalname
    });

    await novaEmpresa.save();
    res.status(201).json({ mensagem: 'Cadastro realizado com sucesso!' });

  } catch (err) {
    console.error('Erro ao salvar empresa:', err);

    if (err.code === 11000) {
      return res.status(400).json({ mensagem: 'CNPJ duplicado.' });
    }

    if (err.message === 'Tipo de arquivo não permitido') {
      return res.status(400).json({ mensagem: 'Tipo de arquivo não permitido. Envie apenas PDF, DOC, PNG, JPG, etc.' });
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ mensagem: 'O arquivo excede o tamanho máximo de 5MB.' });
      }
      return res.status(400).json({ mensagem: 'Erro no upload do arquivo.' });
    }

    if (err.message.includes('ENOENT') || err.message.includes('Error')) {
      return res.status(500).json({ mensagem: 'Erro no processamento do arquivo.' });
    }

    res.status(500).json({ mensagem: 'Erro interno do servidor' });
  }
});

// GET - Listar empresas com paginação, ordenação e busca
router.get('/empresas', async (req, res) => {
  try {
    const { pagina = 1, ordem = 'nome', busca = '' } = req.query;
    const limite = 10; // Número de itens por página
    const skip = (pagina - 1) * limite;

    const query = {};
    if (busca) {
      query.$or = [
        { nome: { $regex: busca, $options: 'i' } },
        { cnpj: { $regex: busca.replace(/[^\d]/g, '') } }
      ];
    }

    const [empresas, total] = await Promise.all([
      Empresa.find(query)
        .sort({ [ordem]: 1 })
        .skip(skip)
        .limit(limite),
      Empresa.countDocuments(query)
    ]);

    const totalPaginas = Math.ceil(total / limite);

    res.json({
      empresas,
      totalPaginas,
      paginaAtual: Number(pagina)
    });

  } catch (err) {
    console.error('Erro ao listar empresas:', err);
    res.status(500).json({ mensagem: 'Erro interno do servidor.' });
  }
});

// PUT - Atualizar empresa
router.put('/empresa/:id', upload.single('arquivo'), async (req, res) => {
  try {
    const { nome, cnpj } = req.body;

    if (!nome || !cnpj) {
      return res.status(400).json({ mensagem: 'Nome e CNPJ são obrigatórios.' });
    }

    const cnpjLimpo = limparCNPJ(cnpj);

    if (!validarCNPJ(cnpjLimpo)) {
      return res.status(400).json({ mensagem: 'CNPJ inválido. Deve conter exatamente 14 dígitos numéricos.' });
    }

    // Verifica se o CNPJ já existe em outra empresa
    const empresaComCNPJ = await Empresa.findOne({ cnpj: cnpjLimpo, _id: { $ne: req.params.id } });
    if (empresaComCNPJ) {
      return res.status(400).json({ mensagem: 'CNPJ já está em uso por outra empresa.' });
    }

    const dadosAtualizados = {
      nome,
      cnpj: cnpjLimpo
    };

    if (req.file) {
      // Remove o arquivo antigo se existir
      const empresa = await Empresa.findById(req.params.id);
      if (empresa && empresa.arquivo) {
        const caminhoArquivo = path.join('uploads', empresa.arquivo);
        if (fs.existsSync(caminhoArquivo)) {
          fs.unlinkSync(caminhoArquivo);
        }
      }
      
      dadosAtualizados.arquivo = req.file.filename;
      dadosAtualizados.nomeArquivo = req.file.originalname;
    }

    const empresaAtualizada = await Empresa.findByIdAndUpdate(
      req.params.id,
      dadosAtualizados,
      { new: true, runValidators: true }
    );

    if (!empresaAtualizada) {
      return res.status(404).json({ mensagem: 'Empresa não encontrada.' });
    }

    res.json({ mensagem: 'Empresa atualizada com sucesso!', empresa: empresaAtualizada });

  } catch (err) {
    console.error('Erro ao atualizar empresa:', err);

    if (err.message === 'Tipo de arquivo não permitido') {
      return res.status(400).json({ mensagem: 'Tipo de arquivo não permitido. Envie apenas PDF, DOC, PNG, JPG, etc.' });
    }

    if (err instanceof multer.MulterError) {
      return res.status(400).json({ mensagem: 'Erro no upload do arquivo.' });
    }

    if (err.kind === 'ObjectId') {
      return res.status(400).json({ mensagem: 'ID inválido.' });
    }

    res.status(500).json({ mensagem: 'Erro interno do servidor.' });
  }
});

// DELETE - Remover empresa
router.delete('/empresa/:id', async (req, res) => {
  try {
    const empresa = await Empresa.findById(req.params.id);

    if (!empresa) {
      return res.status(404).json({ mensagem: 'Empresa não encontrada.' });
    }

    // Remove o arquivo do sistema se existir
    const caminhoArquivo = path.join('uploads', empresa.arquivo);
    if (fs.existsSync(caminhoArquivo)) {
      fs.unlinkSync(caminhoArquivo);
    }

    await Empresa.deleteOne({ _id: req.params.id });
    res.json({ mensagem: 'Empresa removida com sucesso.' });
  } catch (err) {
    console.error('Erro ao remover empresa:', err);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ mensagem: 'ID inválido.' });
    }
    res.status(500).json({ mensagem: 'Erro interno do servidor.' });
  }
});

module.exports = router;