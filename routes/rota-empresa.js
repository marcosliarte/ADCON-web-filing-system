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

function validarCNPJ(cnpj) {
  const cnpjLimpo = limparCNPJ(cnpj);
  if (!/^\d{14}$/.test(cnpjLimpo)) return false;
  
  // Validação dos dígitos verificadores
  let tamanho = cnpjLimpo.length - 2;
  let numeros = cnpjLimpo.substring(0, tamanho);
  const digitos = cnpjLimpo.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado != digitos.charAt(0)) return false;
  
  tamanho = tamanho + 1;
  numeros = cnpjLimpo.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  
  for (let i = tamanho; i >= 1; i--) {
    soma += numeros.charAt(tamanho - i) * pos--;
    if (pos < 2) pos = 9;
  }
  
  resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
  if (resultado != digitos.charAt(1)) return false;
    
  return true;
}

// POST - Cadastro de empresa
router.post('/empresa', upload.single('arquivo'), async (req, res) => {
  try {
    const { cnpj, nome } = req.body;

    if (!cnpj || !nome || !req.file) {
      return res.status(400).json({ 
        mensagem: 'Todos os campos são obrigatórios (CNPJ, nome, arquivo).',
        camposFaltantes: {
          cnpj: !cnpj,
          nome: !nome,
          arquivo: !req.file
        }
      });
    }

    const cnpjLimpo = limparCNPJ(cnpj);

    if (!validarCNPJ(cnpjLimpo)) {
      return res.status(400).json({ 
        mensagem: 'CNPJ inválido. Verifique o número digitado.',
        cnpj: cnpjLimpo
      });
    }

    const empresaExistente = await Empresa.findOne({ cnpj: cnpjLimpo });
    if (empresaExistente) {
      return res.status(400).json({ 
        mensagem: 'CNPJ já cadastrado.',
        empresaExistente: {
          id: empresaExistente._id,
          nome: empresaExistente.nome
        }
      });
    }

    const novaEmpresa = new Empresa({
      cnpj: cnpjLimpo,
      nome,
      arquivo: req.file.filename,
      nomeArquivo: req.file.originalname,
      dataCadastro: new Date()
    });

    await novaEmpresa.save();
    
    res.status(201).json({ 
      mensagem: 'Cadastro realizado com sucesso!',
      empresa: {
        id: novaEmpresa._id,
        nome: novaEmpresa.nome,
        cnpj: novaEmpresa.cnpj
      }
    });

  } catch (err) {
    console.error('Erro ao salvar empresa:', err);

    if (err.code === 11000) {
      return res.status(400).json({ mensagem: 'CNPJ duplicado.' });
    }

    if (err.message === 'Tipo de arquivo não permitido') {
      return res.status(400).json({ 
        mensagem: 'Tipo de arquivo não permitido. Envie apenas: PDF, DOC, DOCX, PNG, JPG, JPEG.',
        tiposPermitidos: ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg']
      });
    }

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          mensagem: 'O arquivo excede o tamanho máximo de 5MB.',
          tamanhoMaximo: '5MB'
        });
      }
      return res.status(400).json({ mensagem: 'Erro no upload do arquivo.' });
    }

    res.status(500).json({ 
      mensagem: 'Erro interno do servidor',
      erro: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// GET - Listar empresas com paginação
router.get('/empresas', async (req, res) => {
  try {
    const { pagina = 1, limite = 10, busca = '' } = req.query;
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
        .sort({ nome: 1 })
        .skip(skip)
        .limit(Number(limite)),
      Empresa.countDocuments(query)
    ]);

    const totalPaginas = Math.ceil(total / limite);

    res.json({
      empresas,
      paginacao: {
        pagina: Number(pagina),
        limite: Number(limite),
        total,
        totalPaginas
      }
    });

  } catch (err) {
    console.error('Erro ao listar empresas:', err);
    res.status(500).json({ 
      mensagem: 'Erro interno do servidor',
      erro: err.message
    });
  }
});

// GET - Obter empresa por ID
router.get('/empresa/:id', async (req, res) => {
  try {
    const empresa = await Empresa.findById(req.params.id);
    if (!empresa) {
      return res.status(404).json({ 
        mensagem: 'Empresa não encontrada.',
        id: req.params.id
      });
    }
    
    res.json({
      _id: empresa._id,
      cnpj: empresa.cnpj,
      nome: empresa.nome,
      arquivo: empresa.arquivo,
      nomeArquivo: empresa.nomeArquivo,
      dataCadastro: empresa.dataCadastro,
      urlArquivo: `/uploads/${empresa.arquivo}`
    });
    
  } catch (err) {
    console.error('Erro ao buscar empresa:', err);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ 
        mensagem: 'ID inválido.',
        id: req.params.id
      });
    }
    res.status(500).json({ 
      mensagem: 'Erro interno do servidor',
      erro: err.message
    });
  }
});

router.put('/empresa/:id', upload.single('arquivo'), async (req, res) => {
  try {
    const { nome, cnpj, removerArquivo } = req.body;
    const empresaId = req.params.id;

    // Validação básica
    if (!nome || !cnpj) {
      return res.status(400).json({
        success: false,
        message: 'Nome e CNPJ são obrigatórios'
      });
    }

    // Formata e valida CNPJ
    const cnpjLimpo = limparCNPJ(cnpj);
    if (!validarCNPJ(cnpjLimpo)) {
      return res.status(400).json({
        success: false,
        message: 'CNPJ inválido (deve conter 14 dígitos)'
      });
    }

    // Verifica se empresa existe
    const empresa = await Empresa.findById(empresaId);
    if (!empresa) {
      return res.status(404).json({
        success: false,
        message: 'Empresa não encontrada'
      });
    }

    // Verifica CNPJ duplicado
    const cnpjExistente = await Empresa.findOne({ 
      cnpj: cnpjLimpo, 
      _id: { $ne: empresaId } 
    });
    if (cnpjExistente) {
      return res.status(400).json({
        success: false,
        message: 'CNPJ já está em uso por outra empresa'
      });
    }

    // Prepara dados para atualização
    const updateData = {
      nome,
      cnpj: cnpjLimpo
    };

    // Tratamento do arquivo
    if (req.file) {
      // Remove arquivo antigo se existir
      if (empresa.arquivo) {
        const caminhoAntigo = path.join(__dirname, '../uploads', empresa.arquivo);
        if (fs.existsSync(caminhoAntigo)) {
          fs.unlinkSync(caminhoAntigo);
        }
      }
      updateData.arquivo = req.file.filename;
    } else if (removerArquivo === 'true') {
      // Remove arquivo existente
      if (empresa.arquivo) {
        const caminhoAntigo = path.join(__dirname, '../uploads', empresa.arquivo);
        if (fs.existsSync(caminhoAntigo)) {
          fs.unlinkSync(caminhoAntigo);
        }
      }
      updateData.arquivo = undefined;
    }

    // Atualiza no banco
    const empresaAtualizada = await Empresa.findByIdAndUpdate(
      empresaId,
      updateData,
      { new: true, runValidators: true, omitUndefined: true }
    );

    // Resposta de sucesso
    res.json({
      success: true,
      message: 'Empresa atualizada com sucesso',
      data: {
        id: empresaAtualizada._id,
        cnpj: empresaAtualizada.cnpj,
        nome: empresaAtualizada.nome,
        arquivo: empresaAtualizada.arquivo || null
      }
    });

  } catch (error) {
    console.error('Erro na atualização:', error);
    
    // Tratamento de erros
    let statusCode = 500;
    let errorMessage = 'Erro interno no servidor';

    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = 'Dados inválidos';
    } 
    else if (error instanceof multer.MulterError) {
      statusCode = 400;
      errorMessage = error.code === 'LIMIT_FILE_SIZE' 
        ? 'Arquivo muito grande (máx. 5MB)' 
        : 'Erro no upload do arquivo';
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE - Remover empresa
router.delete('/empresa/:id', async (req, res) => {
  try {
    const empresa = await Empresa.findById(req.params.id);
    if (!empresa) {
      return res.status(404).json({ 
        mensagem: 'Empresa não encontrada.',
        id: req.params.id
      });
    }

    // Remove o arquivo do sistema se existir
    if (empresa.arquivo) {
      const caminhoArquivo = path.join('uploads', empresa.arquivo);
      if (fs.existsSync(caminhoArquivo)) {
        fs.unlinkSync(caminhoArquivo);
      }
    }

    await Empresa.deleteOne({ _id: req.params.id });
    
    res.json({ 
      mensagem: 'Empresa removida com sucesso.',
      empresa: {
        id: empresa._id,
        nome: empresa.nome,
        cnpj: empresa.cnpj
      }
    });
    
  } catch (err) {
    console.error('Erro ao remover empresa:', err);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ 
        mensagem: 'ID inválido.',
        id: req.params.id
      });
    }
    res.status(500).json({ 
      mensagem: 'Erro interno do servidor',
      erro: err.message
    });
  }
});

module.exports = router;