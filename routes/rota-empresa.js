const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const mongoose = require('mongoose');
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

// Funções auxiliares
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

    // Validação dos campos obrigatórios
    if (!cnpj || !nome || !req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'Todos os campos são obrigatórios (CNPJ, nome, arquivo)',
        details: {
          camposFaltantes: {
            cnpj: !cnpj,
            nome: !nome,
            arquivo: !req.file
          }
        }
      });
    }

    const cnpjLimpo = limparCNPJ(cnpj);

    // Validação do CNPJ
    if (!validarCNPJ(cnpjLimpo)) {
      return res.status(400).json({ 
        success: false,
        message: 'CNPJ inválido',
        details: {
          cnpjRecebido: cnpj,
          cnpjLimpo: cnpjLimpo
        }
      });
    }

    // Verifica se CNPJ já existe
    const empresaExistente = await Empresa.findOne({ cnpj: cnpjLimpo });
    if (empresaExistente) {
      return res.status(400).json({ 
        success: false,
        message: 'CNPJ já cadastrado',
        details: {
          empresaExistente: {
            id: empresaExistente._id,
            nome: empresaExistente.nome
          }
        }
      });
    }

    // Cria nova empresa
    const novaEmpresa = new Empresa({
      cnpj: cnpjLimpo,
      nome,
      arquivo: req.file.filename
    });

    await novaEmpresa.save();
    
    // Resposta de sucesso
    res.status(201).json({ 
      success: true,
      message: 'Cadastro realizado com sucesso',
      data: {
        id: novaEmpresa._id,
        nome: novaEmpresa.nome,
        cnpj: novaEmpresa.cnpj,
        arquivo: {
          nome: req.file.filename,
          url: `/api/empresa/${novaEmpresa._id}/arquivo`
        }
      }
    });

  } catch (err) {
    console.error('Erro ao salvar empresa:', err);

    // Tratamento de erros específicos
    let statusCode = 500;
    let errorResponse = {
      success: false,
      message: 'Erro interno do servidor'
    };

    if (err.code === 11000) {
      statusCode = 400;
      errorResponse.message = 'CNPJ duplicado';
    } 
    else if (err.message === 'Tipo de arquivo não permitido') {
      statusCode = 400;
      errorResponse.message = 'Tipo de arquivo não permitido';
      errorResponse.details = {
        tiposPermitidos: ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg']
      };
    } 
    else if (err instanceof multer.MulterError) {
      statusCode = 400;
      errorResponse.message = err.code === 'LIMIT_FILE_SIZE' 
        ? 'O arquivo excede o tamanho máximo de 5MB' 
        : 'Erro no upload do arquivo';
    }

    if (process.env.NODE_ENV === 'development') {
      errorResponse.error = err.message;
      errorResponse.stack = err.stack;
    }

    res.status(statusCode).json(errorResponse);
  }
});

// GET - Listar empresas com paginação
router.get('/empresas', async (req, res) => {
  try {
    const { 
      pagina = 1, 
      limite = 10, 
      busca = '',
      ordenacao = 'nome',
      direcao = 'asc'
    } = req.query;

    // Validação e formatação dos parâmetros
    const limiteNumerico = Math.min(Number(limite), 100);
    const paginaNumerica = Math.max(Number(pagina), 1);
    const skip = (paginaNumerica - 1) * limiteNumerico;
    const direcaoOrdenacao = direcao === 'desc' ? -1 : 1;

    // Construção da query
    const query = {};
    if (busca) {
      const buscaRegex = new RegExp(busca.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
      query.$or = [
        { nome: buscaRegex },
        { cnpj: busca.replace(/\D/g, '') }
      ];
    }

    // Configuração de ordenação
    const sort = {};
    sort[ordenacao] = direcaoOrdenacao;

    // Execução das queries em paralelo
    const [empresas, total] = await Promise.all([
      Empresa.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limiteNumerico)
        .lean(),
      Empresa.countDocuments(query)
    ]);

    const totalPaginas = Math.ceil(total / limiteNumerico);

    // Formatação da resposta
    const empresasFormatadas = empresas.map(empresa => ({
      id: empresa._id,
      cnpj: empresa.cnpj,
      nome: empresa.nome,
      arquivo: empresa.arquivo ? {
        nome: empresa.arquivo,
        url: `/api/empresa/${empresa._id}/arquivo`
      } : null,
      links: {
        detalhes: `/api/empresa/${empresa._id}`,
        editar: `/api/empresa/${empresa._id}/editar`
      }
    }));

    res.json({
      success: true,
      data: empresasFormatadas,
      meta: {
        paginacao: {
          pagina: paginaNumerica,
          limite: limiteNumerico,
          totalRegistros: total,
          totalPaginas,
          hasNext: paginaNumerica < totalPaginas,
          hasPrev: paginaNumerica > 1
        },
        ordenacao: {
          campo: ordenacao,
          direcao
        }
      }
    });

  } catch (err) {
    console.error('Erro ao listar empresas:', err);
    
    const errorResponse = {
      success: false,
      message: 'Erro ao listar empresas'
    };

    if (process.env.NODE_ENV === 'development') {
      errorResponse.error = err.message;
      errorResponse.stack = err.stack;
    }

    res.status(500).json(errorResponse);
  }
});

// GET - Obter empresa por ID
router.get('/empresa/:id', async (req, res) => {
  try {
    // Validação do ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const empresa = await Empresa.findById(req.params.id).lean();

    if (!empresa) {
      return res.status(404).json({ 
        success: false,
        message: 'Empresa não encontrada'
      });
    }
    
    // Formatação da resposta
    res.json({
      success: true,
      data: {
        id: empresa._id,
        cnpj: empresa.cnpj,
        nome: empresa.nome,
        arquivo: empresa.arquivo ? {
          nome: empresa.arquivo,
          url: `/api/empresa/${empresa._id}/arquivo`,
          downloadUrl: `/api/empresa/${empresa._id}/arquivo/download`
        } : null,
        links: {
          self: `/api/empresa/${empresa._id}`,
          editar: `/api/empresa/${empresa._id}`,
          excluir: `/api/empresa/${empresa._id}`
        }
      }
    });
    
  } catch (err) {
    console.error('Erro ao buscar empresa:', err);
    
    const errorResponse = {
      success: false,
      message: 'Erro ao buscar empresa'
    };

    if (process.env.NODE_ENV === 'development') {
      errorResponse.error = err.message;
    }

    res.status(500).json(errorResponse);
  }
});

// GET - Download do arquivo da empresa
router.get('/empresa/:id/arquivo/download', async (req, res) => {
  try {
    const empresa = await Empresa.findById(req.params.id);
    
    if (!empresa || !empresa.arquivo) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado'
      });
    }

    const filePath = path.join(__dirname, '../uploads', empresa.arquivo);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado no servidor'
      });
    }

    res.download(filePath, empresa.arquivo, (err) => {
      if (err) {
        console.error('Erro no download:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Erro ao baixar arquivo'
          });
        }
      }
    });

  } catch (err) {
    console.error('Erro no download:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// PUT - Atualizar empresa
router.put('/empresa/:id', upload.single('arquivo'), async (req, res) => {
  try {
    const { nome, cnpj, removerArquivo } = req.body;
    const empresaId = req.params.id;

    // Validação básica
    if (!nome || !cnpj) {
      return res.status(400).json({
        success: false,
        message: 'Nome e CNPJ são obrigatórios',
        details: {
          camposFaltantes: {
            nome: !nome,
            cnpj: !cnpj
          }
        }
      });
    }

    // Formata e valida CNPJ
    const cnpjLimpo = limparCNPJ(cnpj);
    if (!validarCNPJ(cnpjLimpo)) {
      return res.status(400).json({
        success: false,
        message: 'CNPJ inválido',
        details: {
          cnpjRecebido: cnpj,
          cnpjLimpo: cnpjLimpo
        }
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
    const empresaComCNPJ = await Empresa.findOne({ 
      cnpj: cnpjLimpo, 
      _id: { $ne: empresaId } 
    });
    if (empresaComCNPJ) {
      return res.status(400).json({
        success: false,
        message: 'CNPJ já está em uso por outra empresa',
        details: {
          empresaExistente: {
            id: empresaComCNPJ._id,
            nome: empresaComCNPJ.nome
          }
        }
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
        arquivo: empresaAtualizada.arquivo ? {
          nome: empresaAtualizada.arquivo,
          url: `/api/empresa/${empresaAtualizada._id}/arquivo`
        } : null
      },
      changes: {
        nome: nome !== empresa.nome,
        cnpj: cnpjLimpo !== empresa.cnpj,
        arquivo: !!req.file || removerArquivo === 'true'
      }
    });

  } catch (error) {
    console.error('Erro na atualização:', error);
    
    // Tratamento de erros
    let statusCode = 500;
    let errorResponse = {
      success: false,
      message: 'Erro interno no servidor'
    };

    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorResponse.message = 'Dados inválidos';
      errorResponse.details = error.errors;
    } 
    else if (error instanceof multer.MulterError) {
      statusCode = 400;
      errorResponse.message = error.code === 'LIMIT_FILE_SIZE' 
        ? 'Arquivo muito grande (máx. 5MB)' 
        : 'Erro no upload do arquivo';
    }

    if (process.env.NODE_ENV === 'development') {
      errorResponse.error = error.message;
      errorResponse.stack = error.stack;
    }

    res.status(statusCode).json(errorResponse);
  }
});

// DELETE - Remover empresa
router.delete('/empresa/:id', async (req, res) => {
  try {
    // Validação do ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const empresa = await Empresa.findById(req.params.id);
    if (!empresa) {
      return res.status(404).json({ 
        success: false,
        message: 'Empresa não encontrada'
      });
    }

    // Remove o arquivo do sistema se existir
    if (empresa.arquivo) {
      const caminhoArquivo = path.join(__dirname, '../uploads', empresa.arquivo);
      if (fs.existsSync(caminhoArquivo)) {
        fs.unlinkSync(caminhoArquivo);
      }
    }

    await Empresa.deleteOne({ _id: req.params.id });
    
    res.json({ 
      success: true,
      message: 'Empresa removida com sucesso',
      data: {
        id: empresa._id,
        nome: empresa.nome,
        cnpj: empresa.cnpj
      }
    });
    
  } catch (err) {
    console.error('Erro ao remover empresa:', err);
    
    const errorResponse = {
      success: false,
      message: 'Erro ao remover empresa'
    };

    if (process.env.NODE_ENV === 'development') {
      errorResponse.error = err.message;
    }

    res.status(500).json(errorResponse);
  }
});

module.exports = router;