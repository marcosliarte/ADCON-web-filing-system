const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const auth = require('../middleware/auth');
const Empresa = require('../models/model-empresa');
const Usuario = require('../models/model-usuario');
const { encrypt, decrypt } = require('../utils/crypto');

// --- NOVA: Função Auxiliar para Registrar Log ---
async function registrarLog(usuarioId, acao, entidade) {
  const usuario = await Usuario.findById(usuarioId).select('nome');
  // Busca o modelo de Log que agora está compilado globalmente
  const LogAcao = mongoose.model('LogAcao');
  const log = new LogAcao({ usuarioId, usuarioNome: usuario.nome, acao, entidadeId: entidade._id, entidadeNome: entidade.nome });
  await log.save();
}

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Salva diferentes tipos de arquivos em pastas diferentes
    let subfolder = 'documentos_empresa';
    if (file.fieldname.startsWith('contrato_social')) {
      subfolder = 'contratos';
    } else if (file.fieldname === 'certificado_digital') {
      subfolder = 'certificados';
    } else if (file.fieldname === 'alvara_arquivo') {
      subfolder = 'alvaras';
    } else if (file.fieldname.startsWith('balanco_patrimonial')) {
      subfolder = 'balancos';
    } else if (file.fieldname.startsWith('documento_diverso')) {
      subfolder = 'documentos_diversos';
    } else if (file.fieldname.startsWith('certidao_')) {
      // Agrupa todas as outras certidões em uma pasta
      subfolder = 'certidoes';
    } else if (file.fieldname === 'inscricao_estadual_arquivo') {
      // Inscrição Estadual vai para documentos_empresa
      subfolder = 'documentos_empresa';
    }
    const uploadPath = path.join(__dirname, `../uploads/${subfolder}`);
    fs.mkdirSync(uploadPath, { recursive: true }); // Garante que o diretório exista
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Sanitiza o nome do arquivo para remover caracteres inválidos
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniquePrefix}-${sanitizedFilename}`);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;

    // Lista de extensões permitidas
    const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png', '.pfx', '.p12'];
    // Lista de mimetypes permitidos para arquivos comuns (PDF, imagens)
    const commonAllowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    // Mimetypes comuns para certificados PFX/P12 (inclui octet-stream para flexibilidade)
    const certMimeTypes = ['application/x-pkcs12', 'application/pkcs12', 'application/octet-stream'];

    if (allowedExtensions.includes(fileExtension) && 
        (commonAllowedMimeTypes.includes(mimeType) || certMimeTypes.includes(mimeType))) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não permitido! Apenas ${allowedExtensions.join(', ')} são aceitos.`), false);
    }
  },
});

// Middleware para tratar erros do Multer
const handleMulterError = (req, res, next) => {
  // Gerar campos dinamicamente para até 50 contratos sociais
  const contratoFields = Array.from({ length: 50 }, (_, i) => ({
    name: `contrato_social[${i}][arquivo]`,
    maxCount: 1
  }));

  // Gerar campos dinamicamente para até 50 balanços patrimoniais
  const balancoFields = Array.from({ length: 50 }, (_, i) => ({
    name: `balanco_patrimonial[${i}][arquivo]`,
    maxCount: 1
  }));

  // Gerar campos dinamicamente para até 50 documentos diversos
  const diversoFields = Array.from({ length: 50 }, (_, i) => ({
    name: `documento_diverso[${i}][arquivo]`,
    maxCount: 1
  }));

  const uploadFields = upload.fields([
    { name: 'arquivo_cnpj', maxCount: 1 },
    { name: 'certificado_digital', maxCount: 1 },
    ...contratoFields, // Adiciona todos os campos de contratos dinamicamente
    ...balancoFields, // Adiciona todos os campos de balanços dinamicamente
    ...diversoFields, // Adiciona todos os campos de documentos diversos dinamicamente
    { name: 'alvara_arquivo', maxCount: 1 },
    { name: 'certidao_prefeitura_arquivo', maxCount: 1 },
    { name: 'certidao_receita_arquivo', maxCount: 1 },
    { name: 'certidao_fgts_arquivo', maxCount: 1 },
    { name: 'certidao_sefaz_arquivo', maxCount: 1 },
    { name: 'inscricao_estadual_arquivo', maxCount: 1 },
    { name: 'certidao_trabalhista_arquivo', maxCount: 1 },
    { name: 'certidao_falencia_arquivo', maxCount: 1 },
  ]);

  uploadFields(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'UNEXPECTED_FIELD') {
        return res.status(400).json({ 
          msg: `Campo de arquivo inesperado: ${err.field}. Verifique se todos os contratos estão nomeados corretamente.` 
        });
      }
      return res.status(400).json({ msg: `Erro no upload: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ msg: err.message });
    }
    next();
  });
};

// @route   POST api/empresa
// @desc    Cadastrar uma nova empresa com certidão
// @access  Private (Admin ou Funcionário)
router.post(
  '/',
  [
    auth,
    handleMulterError,
    check('nome_empresarial', 'Nome empresarial é obrigatório').not().isEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { cnpj } = req.body;

    try {
      let empresa = await Empresa.findOne({ cnpj });
      if (empresa) {
        return res.status(400).json({ msg: 'Empresa com este CNPJ já cadastrado.' });
      }

      // Mapeia os dados do body para o schema, incluindo objetos aninhados
      const dadosEmpresa = {
        ...req.body,
        nome: req.body.nome_empresarial,
        inscricao_estadual: req.body.inscricao_estadual,
        filiais: req.body.filiais || [],
        atividade_principal_descricao: req.body.atividade_principal_descricao,
        endereco: {
          cep: req.body['endereco.cep'],
          rua: req.body['endereco.rua'],
          numero: req.body['endereco.numero'],
          complemento: req.body['endereco.complemento'],
          bairro: req.body['endereco.bairro'],
          cidade: req.body['endereco.cidade'],
          estado: req.body['endereco.estado'],
        },
        documentos: {
          contratos: [],
          balancosPatrimoniais: [],
          documentosDiversos: [],
        },
      };

      // CORREÇÃO: Se matriz_id for uma string vazia, remova-o para que o Mongoose use o valor padrão (null)
      if (!dadosEmpresa.matriz_id) {
        delete dadosEmpresa.matriz_id;
      }

      // Processa os arquivos e associa aos dados
      if (req.files) {
        if (req.files.arquivo_cnpj) {
          const file = req.files.arquivo_cnpj[0];
          dadosEmpresa.documentos.cartaoCnpj = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/documentos_empresa/${file.filename}` };
        }
        if (req.files.certificado_digital) {
          const file = req.files.certificado_digital[0];
          dadosEmpresa.documentos.certificadoDigital = {
            nomeArquivo: file.originalname,
            caminhoArquivo: `/uploads/certificados/${file.filename}`,
            dataValidade: req.body.certificado_validade,
            senha: req.body.certificado_senha ? encrypt(req.body.certificado_senha) : null,
          };
        }
        if (req.files.alvara_arquivo) {
          const file = req.files.alvara_arquivo[0];
          dadosEmpresa.documentos.alvara = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/alvaras/${file.filename}`, ano: req.body.alvara_ano };
        }
        if (req.files.certidao_prefeitura_arquivo) {
          const file = req.files.certidao_prefeitura_arquivo[0];
          dadosEmpresa.documentos.certidaoPrefeitura = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_prefeitura_validade };
        }
        if (req.files.certidao_receita_arquivo) {
          const file = req.files.certidao_receita_arquivo[0];
          dadosEmpresa.documentos.certidaoReceita = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_receita_validade };
        }
        if (req.files.certidao_fgts_arquivo) {
          const file = req.files.certidao_fgts_arquivo[0];
          dadosEmpresa.documentos.certidaoFGTS = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_fgts_validade };
        }
        if (req.files.certidao_sefaz_arquivo) {
          const file = req.files.certidao_sefaz_arquivo[0];
          dadosEmpresa.documentos.certidaoSefaz = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_sefaz_validade };
        }
        if (req.files.inscricao_estadual_arquivo) {
          const file = req.files.inscricao_estadual_arquivo[0];
          dadosEmpresa.documentos.inscricaoEstadual = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/documentos_empresa/${file.filename}`, dataValidade: req.body.inscricao_estadual_validade };
        }
        if (req.files.certidao_trabalhista_arquivo) {
          const file = req.files.certidao_trabalhista_arquivo[0];
          dadosEmpresa.documentos.certidaoTrabalhista = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_trabalhista_validade };
        }
        if (req.files.certidao_falencia_arquivo) {
          const file = req.files.certidao_falencia_arquivo[0];
          dadosEmpresa.documentos.certidaoFalencia = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_falencia_validade };
        }

        // Processa os contratos
        if (req.body.contrato_social) {
          // O multer-parser já nos dá um array de arquivos para campos com o mesmo nome
          const contratosInfo = req.body.contrato_social; // Array de {data, numero}
          const contratoFiles = req.files['contrato_social[0][arquivo]'] || []; // O nome pode variar, pegamos o primeiro

          contratosInfo.forEach((info, index) => {
            const file = req.files[`contrato_social[${index}][arquivo]`]?.[0];
            const newContrato = {
              dataAlteracao: info.data,
            };

            if (file) {
              newContrato.nomeArquivo = file.originalname;
              newContrato.caminhoArquivo = `/uploads/contratos/${file.filename}`;
            }
            // Adiciona o contrato se houver data, mesmo sem arquivo
            if (newContrato.dataAlteracao) dadosEmpresa.documentos.contratos.push(newContrato);
          });
        }

        // Processa os balanços patrimoniais
        if (req.body.balanco_patrimonial) {
          const balancosInfo = req.body.balanco_patrimonial; // Array de {ano}

          balancosInfo.forEach((info, index) => {
            const file = req.files[`balanco_patrimonial[${index}][arquivo]`]?.[0];
            
            // Só adiciona se houver arquivo e ano
            if (file && info.ano) {
              const newBalanco = {
                nomeArquivo: file.originalname,
                caminhoArquivo: `/uploads/balancos/${file.filename}`,
                ano: info.ano,
              };
              dadosEmpresa.documentos.balancosPatrimoniais.push(newBalanco);
            }
          });
        }

        // Processa os documentos diversos
        if (req.body.documento_diverso) {
          const diversosInfo = req.body.documento_diverso; // Array de {nome, validade}

          diversosInfo.forEach((info, index) => {
            const file = req.files[`documento_diverso[${index}][arquivo]`]?.[0];
            
            // Só adiciona se houver arquivo e nome
            if (file && info.nome) {
              const newDiverso = {
                nomeDocumento: info.nome,
                nomeArquivo: file.originalname,
                caminhoArquivo: `/uploads/documentos_diversos/${file.filename}`,
              };
              
              // Adiciona validade se fornecida
              if (info.validade) {
                newDiverso.dataValidade = info.validade;
              }

              dadosEmpresa.documentos.documentosDiversos.push(newDiverso);
            }
          });
        }
      }

      const novaEmpresa = new Empresa(dadosEmpresa);

      await novaEmpresa.save();
      // REGISTRA O LOG
      await registrarLog(req.usuario.id, 'Criação de Empresa', novaEmpresa);

      res.status(201).json(novaEmpresa);
    } catch (err) {
      if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message).join('. ');
        return res.status(400).json({ msg: `Dados inválidos: ${messages}` });
      }
      console.error(err.message);
      console.error(err.stack);
      res.status(500).json({ msg: 'Erro no servidor' });
    }
  }
);

// @route   GET api/empresas
// @desc    Listar todas as empresas com busca, ordenação e paginação
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { busca, ordenacao = 'nome', direcao = 'asc', pagina = 1, limite = 10, ownerId, tipo } = req.query;
    const query = {};
    const usuarioLogado = await Usuario.findById(req.usuario.id);

    // Empresário só acessa a empresa vinculada ao seu perfil
    if (usuarioLogado.role === 'empresario') {
      if (!usuarioLogado.empresaId) return res.status(403).json({ msg: 'Nenhuma empresa vinculada a este perfil.' });
      query._id = usuarioLogado.empresaId;
    } else if (ownerId && usuarioLogado.role === 'admin') {
      query.ownerId = ownerId;
    }

    // Adicionado filtro por tipo de empresa (matriz ou filial)
    if (tipo) {
      if (tipo === 'matriz') {
        // Para compatibilidade com registros antigos, busca por 'matriz' ou onde o campo 'tipo' não existe/é nulo.
        query.$or = [
          { tipo: 'matriz' },
          { tipo: { $exists: false } }
        ];
      } else {
        query.tipo = tipo; // Para 'filial' ou outros tipos, a busca é exata.
      }
    }

    if (busca) {
      const buscaQuery = {
        $or: [
        { nome: { $regex: busca, $options: 'i' } },
        { cnpj: { $regex: busca, $options: 'i' } },
      ]};
      // Combina a busca com a query principal
      if (query.$or) { // Se já existe um $or (do filtro de tipo)
        query = { $and: [ { $or: query.$or }, buscaQuery ] };
      } else {
        Object.assign(query, buscaQuery);
      }
    }

    const options = {
      page: parseInt(pagina, 10),
      limit: parseInt(limite, 10),
      sort: { [ordenacao]: direcao === 'asc' ? 1 : -1 },
    };

    const empresas = await Empresa.paginate(query, options);
    res.json(empresas);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
  }
});

// @route   GET api/empresa/:id
// @desc    Obter detalhes de uma empresa específica
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const usuarioLogado = await Usuario.findById(req.usuario.id).select('role');

    const empresa = await Empresa.findById(req.params.id)
      .select('+documentos.certificadoDigital.senha')
      .populate('matriz_id', 'nome _id cnpj')
      .lean();

    if (!empresa) {
      return res.status(404).json({ msg: 'Empresa não encontrada' });
    }

    // Empresário só pode ver a empresa vinculada ao seu perfil
    if (usuarioLogado.role === 'empresario' && String(empresa._id) !== String(usuarioLogado.empresaId)) {
      return res.status(403).json({ msg: 'Acesso negado.' });
    }

    // Descriptografa a senha do certificado — apenas para admin, gerente e funcionário
    if (empresa.documentos?.certificadoDigital?.senha) {
      if (['admin', 'gerente', 'funcionario'].includes(usuarioLogado.role)) {
        try {
          empresa.documentos.certificadoDigital.senha = decrypt(empresa.documentos.certificadoDigital.senha);
        } catch (e) {
          empresa.documentos.certificadoDigital.senha = null;
        }
      } else {
        empresa.documentos.certificadoDigital.senha = null;
      }
    }

    empresa.matriz = empresa.matriz_id || null;
    // Busca as filiais SE a empresa for uma matriz
    empresa.filiais = (empresa.tipo === 'matriz' || !empresa.tipo) ? await Empresa.find({ matriz_id: req.params.id }).lean() : [];

    res.json(empresa);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
  }
});

// @route   DELETE api/empresa/:id
// @desc    Excluir uma empresa
// @access  Private (Admin, Gerente, Funcionário)
router.delete('/:id', auth, async (req, res) => {
  try {
    const usuarioLogado = await Usuario.findById(req.usuario.id);
    if (!['admin', 'gerente', 'funcionario'].includes(usuarioLogado.role)) {
      return res.status(403).json({ msg: 'Acesso negado. Você não tem permissão para excluir empresas.' });
    }

    const empresa = await Empresa.findById(req.params.id);
    if (!empresa) {
      return res.status(404).json({ msg: 'Empresa não encontrada' });
    }

    // Função auxiliar para deletar arquivos de forma assíncrona (não bloqueia o event loop)
    const deletarArquivos = (caminhos) => {
      const validos = caminhos.filter(Boolean).map(c => path.join(__dirname, '..', c));
      return Promise.all(validos.map(p => fs.promises.unlink(p).catch(() => {})));
    };

    if (empresa.documentos) {
      const caminhos = [
        empresa.documentos.cartaoCnpj?.caminhoArquivo,
        empresa.documentos.certificadoDigital?.caminhoArquivo,
        empresa.documentos.alvara?.caminhoArquivo,
        empresa.documentos.certidaoPrefeitura?.caminhoArquivo,
        empresa.documentos.certidaoReceita?.caminhoArquivo,
        empresa.documentos.certidaoFGTS?.caminhoArquivo,
        empresa.documentos.certidaoSefaz?.caminhoArquivo,
        empresa.documentos.inscricaoEstadual?.caminhoArquivo,
        empresa.documentos.certidaoTrabalhista?.caminhoArquivo,
        empresa.documentos.certidaoFalencia?.caminhoArquivo,
        ...(empresa.documentos.contratos || []).map(c => c.caminhoArquivo),
        ...(empresa.documentos.balancosPatrimoniais || []).map(b => b.caminhoArquivo),
        ...(empresa.documentos.documentosDiversos || []).map(d => d.caminhoArquivo),
      ];
      await deletarArquivos(caminhos);
    }

    // Após deletar os arquivos, remove o registro do banco de dados
    await Empresa.findByIdAndDelete(req.params.id);

    // REGISTRA O LOG
    await registrarLog(req.usuario.id, 'Exclusão de Empresa', empresa);

    res.json({ msg: 'Empresa e todos os seus arquivos foram removidos com sucesso' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
  }
});

// @route   PUT api/empresa/:id
// @desc    Atualizar uma empresa
// @access  Private (Admin ou Funcionário)
router.put(
  '/:id',
  [
    auth,
    // CORREÇÃO: Usar upload.any() para aceitar qualquer arquivo enviado.
    // Isso torna a rota mais flexível e evita o erro "Unexpected field".
    upload.any(),
    check('nome_empresarial', 'Nome empresarial é obrigatório').not().isEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const usuarioLogado = await Usuario.findById(req.usuario.id);
      if (!['admin', 'gerente', 'funcionario'].includes(usuarioLogado.role)) {
        return res.status(403).json({ msg: 'Acesso negado.' });
      }

      let empresa = await Empresa.findById(req.params.id);
      if (!empresa) {
        return res.status(404).json({ msg: 'Empresa não encontrada' });
      }

      // Mapeia os arquivos recebidos pelo `upload.any()` para um formato mais fácil de usar.
      // Transforma o array de arquivos em um objeto onde a chave é o nome do campo.
      const filesMap = (req.files || []).reduce((acc, file) => {
        // Se já existe um arquivo para este campo, transforma em um array.
        if (acc[file.fieldname]) {
          acc[file.fieldname] = Array.isArray(acc[file.fieldname]) ? [...acc[file.fieldname], file] : [acc[file.fieldname], file];
        } else {
          acc[file.fieldname] = file;
        }
        return acc;
      }, {});

      // Atualiza os campos de texto simples
      empresa.nome = req.body.nome_empresarial;
      empresa.cnpj = req.body.cnpj;
      empresa.inscricao_estadual = req.body.inscricao_estadual;
      empresa.filiais = req.body.filiais || []; // Atualiza os dados das filiais
      empresa.nire = req.body.nire;
      empresa.data_abertura = req.body.data_abertura;
      empresa.nome_fantasia = req.body.nome_fantasia;
      empresa.capital_social = req.body.capital_social;
      empresa.atividade_principal = req.body.atividade_principal;
      empresa.porte = req.body.porte;
      empresa.atividade_principal_descricao = req.body.atividade_principal_descricao; // Adiciona a descrição do CNAE
      empresa.natureza_juridica = req.body.natureza_juridica;
      empresa.email = req.body.email;
      empresa.telefone = req.body.telefone;

      // **CORREÇÃO DEFINITIVA:** Recria o objeto de endereço para garantir que ele exista
      // antes de atribuir os novos valores.
      empresa.endereco = {
        cep: req.body['endereco.cep'],
        rua: req.body['endereco.rua'],
        numero: req.body['endereco.numero'],
        complemento: req.body['endereco.complemento'],
        bairro: req.body['endereco.bairro'],
        cidade: req.body['endereco.cidade'],
        estado: req.body['endereco.estado']
      };

      // LÓGICA PARA ATUALIZAR SÓCIOS (SUBSTITUIÇÃO COMPLETA)
      if (req.body.socios) {
        empresa.socios = req.body.socios.map(socio => ({
          nome: socio.nome,
          cpf: socio.cpf,
          rg: socio.rg,
          orgao_emissor: socio.orgao_emissor,
          estado_emissor: socio.estado_emissor,
          data_nascimento: socio.data_nascimento,
          is_admin: socio.is_admin,
          estado_civil: socio.estado_civil,
          regime_casamento: socio.regime_casamento,
          endereco: socio.endereco
        }));
      } else {
        // Se nenhum sócio for enviado no formulário, remove todos.
        empresa.socios = [];
      }

      // NOVA LÓGICA: Remover arquivos marcados para exclusão
      const deletarArquivoSeMarcado = (campoMarcacao, docSubPath) => {
        if (req.body[campoMarcacao] === 'true' && empresa.documentos[docSubPath]?.caminhoArquivo) {
          const caminhoCompleto = path.join(__dirname, '..', empresa.documentos[docSubPath].caminhoArquivo);
          if (fs.existsSync(caminhoCompleto)) {
            fs.unlinkSync(caminhoCompleto);
            console.log(`Arquivo removido: ${caminhoCompleto}`);
          }
          empresa.documentos[docSubPath] = undefined;
        }
      };

      deletarArquivoSeMarcado('remover_arquivo_cnpj', 'cartaoCnpj');
      deletarArquivoSeMarcado('remover_certificado_digital', 'certificadoDigital');
      deletarArquivoSeMarcado('remover_alvara_arquivo', 'alvara');
      deletarArquivoSeMarcado('remover_certidao_prefeitura_arquivo', 'certidaoPrefeitura');
      deletarArquivoSeMarcado('remover_certidao_receita_arquivo', 'certidaoReceita');
      deletarArquivoSeMarcado('remover_certidao_fgts_arquivo', 'certidaoFGTS');
      // Adicionando os que faltavam
      deletarArquivoSeMarcado('remover_inscricao_estadual_arquivo', 'inscricaoEstadual');
      deletarArquivoSeMarcado('remover_certidao_sefaz_arquivo', 'certidaoSefaz');
      deletarArquivoSeMarcado('remover_certidao_trabalhista_arquivo', 'certidaoTrabalhista');
      deletarArquivoSeMarcado('remover_certidao_falencia_arquivo', 'certidaoFalencia');

      // Lógica para atualizar/adicionar contratos - CORRIGIDA
      if (req.body.contrato_social) {
        // Garante que contrato_social seja sempre um array
        const contratosInfo = Array.isArray(req.body.contrato_social) ? req.body.contrato_social : [req.body.contrato_social];

        empresa.documentos.contratos = contratosInfo
          .map((contratoInfo, index) => {
            const file = filesMap[`contrato_social[${index}][arquivo]`];
            // Pega o contrato existente pelo mesmo índice para manter o arquivo se não for alterado
            const contratoExistente = empresa.documentos.contratos?.[index] || {};

            return {
              nomeArquivo: file ? file.originalname : contratoExistente.nomeArquivo,
              caminhoArquivo: file ? `/uploads/contratos/${file.filename}` : contratoExistente.caminhoArquivo,
              dataAlteracao: contratoInfo.data,
            };
          })
          // Remove entradas vazias (sem data)
          .filter(c => c.dataAlteracao);
      } else {
        empresa.documentos.contratos = []; // Limpa se nenhum contrato for enviado
      }

      // Lógica para atualizar/adicionar balanços patrimoniais
      if (req.body.balanco_patrimonial) {
        // Garante que balanco_patrimonial seja sempre um array
        const balancosInfo = Array.isArray(req.body.balanco_patrimonial) ? req.body.balanco_patrimonial : [req.body.balanco_patrimonial];

        empresa.documentos.balancosPatrimoniais = balancosInfo
          .map((balancoInfo, index) => {
            const file = filesMap[`balanco_patrimonial[${index}][arquivo]`];
            // Pega o balanço existente pelo mesmo índice para manter o arquivo se não for alterado
            const balancoExistente = empresa.documentos.balancosPatrimoniais?.[index] || {};

            return {
              nomeArquivo: file ? file.originalname : balancoExistente.nomeArquivo,
              caminhoArquivo: file ? `/uploads/balancos/${file.filename}` : balancoExistente.caminhoArquivo,
              ano: balancoInfo.ano,
            };
          })
          // Remove entradas vazias (sem ano)
          .filter(b => b.ano && b.nomeArquivo);
      } else {
        empresa.documentos.balancosPatrimoniais = []; // Limpa se nenhum balanço for enviado
      }

        // Lógica para atualizar/adicionar documentos diversos
        if (req.body.documento_diverso) {
          // Garante que documento_diverso seja sempre um array
          const diversosInfo = Array.isArray(req.body.documento_diverso) ? req.body.documento_diverso : [req.body.documento_diverso];

          empresa.documentos.documentosDiversos = diversosInfo
            .map((diversoInfo, index) => {
              const file = filesMap[`documento_diverso[${index}][arquivo]`];
              // Pega o documento existente pelo mesmo índice para manter o arquivo se não for alterado
              const diversoExistente = empresa.documentos.documentosDiversos?.[index] || {};

              const documento = {
                nomeDocumento: diversoInfo.nome,
                nomeArquivo: file ? file.originalname : diversoExistente.nomeArquivo,
                caminhoArquivo: file ? `/uploads/documentos_diversos/${file.filename}` : diversoExistente.caminhoArquivo,
              };

              // Adiciona validade se fornecida
              if (diversoInfo.validade) {
                documento.dataValidade = diversoInfo.validade;
              }

              return documento;
            })
            // Remove entradas vazias (sem nome ou arquivo)
            .filter(d => d.nomeDocumento && d.nomeArquivo);
        } else {
          empresa.documentos.documentosDiversos = []; // Limpa se nenhum documento for enviado
        }


      // A lógica de upload de novos arquivos e remoção de antigos na edição
      // exigiria um tratamento mais detalhado dos `req.files`.

      // A lógica de arquivos na edição é complexa. Vamos simplificar por agora:
      // Se um novo arquivo é enviado, ele substitui o antigo.
      // A remoção de arquivos existentes precisaria de uma lógica separada.
      if (filesMap) {
        if (filesMap.arquivo_cnpj) {
            const file = filesMap.arquivo_cnpj;
            empresa.documentos.cartaoCnpj = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/documentos_empresa/${file.filename}` };
        }
        if (filesMap.certificado_digital) {
            const file = filesMap.certificado_digital;
            empresa.documentos.certificadoDigital = {
                nomeArquivo: file.originalname,
                caminhoArquivo: `/uploads/certificados/${file.filename}`,
                dataValidade: req.body.certificado_validade,
                senha: req.body.certificado_senha ? encrypt(req.body.certificado_senha) : null,
            };
        }
        if (filesMap.alvara_arquivo) {
            const file = filesMap.alvara_arquivo;
            empresa.documentos.alvara = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/alvaras/${file.filename}`, ano: req.body.alvara_ano };
        }
        if (filesMap.certidao_prefeitura_arquivo) {
            const file = filesMap.certidao_prefeitura_arquivo;
            empresa.documentos.certidaoPrefeitura = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_prefeitura_validade };
        }
        if (filesMap.certidao_receita_arquivo) {
            const file = filesMap.certidao_receita_arquivo;
            empresa.documentos.certidaoReceita = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_receita_validade };
        }
        if (filesMap.certidao_fgts_arquivo) {
            const file = filesMap.certidao_fgts_arquivo;
            empresa.documentos.certidaoFGTS = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_fgts_validade };
        }
        if (filesMap.certidao_sefaz_arquivo) {
            const file = filesMap.certidao_sefaz_arquivo;
            empresa.documentos.certidaoSefaz = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_sefaz_validade };
        }
        if (filesMap.inscricao_estadual_arquivo) {
            const file = filesMap.inscricao_estadual_arquivo;
            empresa.documentos.inscricaoEstadual = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/documentos_empresa/${file.filename}`, dataValidade: req.body.inscricao_estadual_validade };
        }
        if (filesMap.certidao_trabalhista_arquivo) {
            const file = filesMap.certidao_trabalhista_arquivo;
            empresa.documentos.certidaoTrabalhista = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_trabalhista_validade };
        }
        if (filesMap.certidao_falencia_arquivo) {
            const file = filesMap.certidao_falencia_arquivo;
            empresa.documentos.certidaoFalencia = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_falencia_validade };
        }
      }

      const empresaAtualizada = await empresa.save();
      // REGISTRA O LOG
      await registrarLog(req.usuario.id, 'Edição de Empresa', empresaAtualizada);

      res.json(empresaAtualizada);
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
    }
  }
);

// @route   GET api/empresas/cep/:cep
// @desc    Consultar um CEP usando a API ViaCEP (servindo como proxy)
// @access  Private
router.get('/cep/:cep', auth, async (req, res) => {
  const { cep } = req.params;
  const cepFormatado = cep.replace(/\D/g, ''); // Garante que só tenha números

  if (cepFormatado.length !== 8) {
    return res.status(400).json({ msg: 'Formato de CEP inválido.' });
  }

  try {
    // Usaremos o fetch do lado do servidor.
    // É necessário ter o 'node-fetch' instalado: npm install node-fetch@2
    const fetch = require('node-fetch');
    const response = await fetch(`https://viacep.com.br/ws/${cepFormatado}/json/`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro no proxy do ViaCEP:', error.message);
    res.status(500).json({ msg: 'Erro interno ao consultar o CEP.' }); // Já era JSON, mas mantido
  }
});

// @route   GET api/empresas/cnae/:codigo
// @desc    Consultar um CNAE usando a API do IBGE (servindo como proxy)
// @access  Private
router.get('/cnae/:codigo', auth, async (req, res) => {
  const { codigo } = req.params;
  const cnaeFormatado = codigo.replace(/\D/g, ''); // Garante que só tenha números

  if (!cnaeFormatado) {
    return res.status(400).json({ msg: 'Código CNAE inválido.' });
  }

  try {
    const fetch = require('node-fetch');
    // A API do IBGE usa o endpoint de subclasses para os códigos de 7 dígitos
    const response = await fetch(`https://servicodados.ibge.gov.br/api/v2/cnae/subclasses/${cnaeFormatado}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erro no proxy do CNAE:', error.message);
    res.status(500).json({ msg: 'Erro interno ao consultar o CNAE.' });
  }
});

// @route   GET api/empresas/cnpj/:cnpj
// @desc    Obter detalhes de uma empresa específica pelo CNPJ
// @access  Private
router.get('/cnpj/:cnpj', auth, async (req, res) => {
  try {
    const { cnpj } = req.params;
    // Formata o CNPJ com a máscara para comparar com o que pode estar no banco
    const cnpjFormatado = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

    // Busca a empresa pelo CNPJ, selecionando apenas os campos necessários
    // Tenta encontrar pelo CNPJ puro (14 dígitos) ou pelo CNPJ formatado
    const empresa = await Empresa.findOne({
      $or: [
        { cnpj: cnpj },
        { cnpj: cnpjFormatado }
      ]
    }).select('_id nome').lean();

    if (!empresa) {
      return res.status(404).json({ msg: 'Empresa não encontrada com este CNPJ.' });
    }

    res.json(empresa);
  } catch (err) {
    console.error('Erro ao buscar empresa por CNPJ:', err.message);
    res.status(500).json({ msg: 'Erro no servidor' });
  }
});

// @route   GET api/empresas/documentos/vencendo
// @desc    Listar todos os documentos a vencer nos próximos 30 dias ou já vencidos
// @access  Private (Admin, Gerente, Funcionário)
router.get('/documentos/vencendo', auth, async (req, res) => {
  try {
    const usuarioLogado = await Usuario.findById(req.usuario.id).select('role');
    if (!['admin', 'gerente', 'funcionario'].includes(usuarioLogado.role)) {
      return res.status(403).json({ msg: 'Acesso negado.' });
    }

    const hoje = new Date();
    const dataLimite = new Date();
    dataLimite.setDate(hoje.getDate() + 30);

    const empresas = await Empresa.find({
      $or: [
        { 'documentos.certificadoDigital.dataValidade': { $lte: dataLimite } },
        { 'documentos.certidaoPrefeitura.dataValidade': { $lte: dataLimite } },
        { 'documentos.certidaoReceita.dataValidade': { $lte: dataLimite } },
        { 'documentos.certidaoFGTS.dataValidade': { $lte: dataLimite } },
        { 'documentos.certidaoTrabalhista.dataValidade': { $lte: dataLimite } },
        { 'documentos.certidaoFalencia.dataValidade': { $lte: dataLimite } },
        { 'documentos.inscricaoEstadual.dataValidade': { $lte: dataLimite } },
        { 'documentos.certidaoSefaz.dataValidade': { $lte: dataLimite } },
      ],
    }).select('nome documentos');

    const documentosVencendo = [];
    const umDiaEmMs = 1000 * 60 * 60 * 24;

    empresas.forEach(empresa => {
      const checarDocumento = (doc, nomeDoc) => {
        if (doc && doc.dataValidade && doc.dataValidade <= dataLimite) {
          const diasRestantes = Math.ceil((doc.dataValidade - hoje) / umDiaEmMs);
          documentosVencendo.push({
            empresaId: empresa._id,
            empresaNome: empresa.nome,
            documento: nomeDoc,
            dataValidade: doc.dataValidade,
            diasRestantes: diasRestantes,
          });
        }
      };

      checarDocumento(empresa.documentos.certificadoDigital, 'Certificado Digital');
      checarDocumento(empresa.documentos.certidaoPrefeitura, 'Certidão da Prefeitura');
      checarDocumento(empresa.documentos.certidaoReceita, 'Certidão da Receita Federal');
      checarDocumento(empresa.documentos.certidaoFGTS, 'Certidão do FGTS');
      checarDocumento(empresa.documentos.certidaoTrabalhista, 'Certidão Trabalhista');
      checarDocumento(empresa.documentos.certidaoFalencia, 'Certidão de Falência');
      checarDocumento(empresa.documentos.inscricaoEstadual, 'Inscrição Estadual');
      checarDocumento(empresa.documentos.certidaoSefaz, 'Certidão da SEFAZ');
    });

    res.json(documentosVencendo.sort((a, b) => a.diasRestantes - b.diasRestantes));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' });
  }
});

// @route   DELETE api/empresas/:id/documentos/excluir
// @desc    Excluir documentos selecionados da empresa
// @access  Private (Admin, Gerente, Funcionário)
router.delete('/:id/documentos/excluir', auth, async (req, res) => {
  try {
    const usuarioLogado = await Usuario.findById(req.usuario.id).select('role');
    if (!['admin', 'gerente', 'funcionario'].includes(usuarioLogado.role)) {
      return res.status(403).json({ msg: 'Acesso negado.' });
    }

    const { documentos } = req.body; // Array de { tipo, caminho }

    if (!documentos || !Array.isArray(documentos) || documentos.length === 0) {
      return res.status(400).json({ msg: 'Nenhum documento selecionado para exclusão.' });
    }

    const empresa = await Empresa.findById(req.params.id);
    if (!empresa) {
      return res.status(404).json({ msg: 'Empresa não encontrada.' });
    }

    let excluidos = 0;
    const erros = [];
    const camposParaRemover = {};
    const uploadsDir = path.resolve(__dirname, '..', 'uploads');

    for (const doc of documentos) {
      try {
        const { tipo, caminho } = doc;

        if (!empresa.documentos) {
          erros.push({ tipo: tipo || 'Desconhecido', erro: 'Empresa sem documentos' });
          continue;
        }

        const documentosObj = empresa.documentos.toObject ? empresa.documentos.toObject() : empresa.documentos;
        const campos = Object.keys(documentosObj);
        let campoEncontrado = false;

        for (const campo of campos) {
          const docCampo = empresa.documentos[campo];

          if (Array.isArray(docCampo)) {
            const indexItem = docCampo.findIndex(c => c.caminhoArquivo === caminho);
            if (indexItem !== -1) {
              // Use the DB-stored path for deletion — not the client-provided value
              const dbCaminho = docCampo[indexItem].caminhoArquivo;
              const cleanPath = dbCaminho.startsWith('/') ? dbCaminho.substring(1) : dbCaminho;
              const fullPath = path.resolve(__dirname, '..', cleanPath);
              if (fullPath.startsWith(uploadsDir + path.sep)) {
                if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
              }
              empresa.documentos[campo].splice(indexItem, 1);
              campoEncontrado = true;
              excluidos++;
              break;
            }
          } else if (docCampo && docCampo.caminhoArquivo === caminho) {
            // Use the DB-stored path for deletion
            const dbCaminho = docCampo.caminhoArquivo;
            const cleanPath = dbCaminho.startsWith('/') ? dbCaminho.substring(1) : dbCaminho;
            const fullPath = path.resolve(__dirname, '..', cleanPath);
            if (fullPath.startsWith(uploadsDir + path.sep)) {
              if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            }
            camposParaRemover[`documentos.${campo}`] = '';
            campoEncontrado = true;
            excluidos++;
            break;
          }
        }

        if (!campoEncontrado) {
          erros.push({ tipo: doc.tipo || 'Desconhecido', erro: 'Campo não encontrado no banco de dados' });
        }
      } catch (error) {
        console.error(`Erro ao excluir documento ${doc.tipo}:`, error);
        erros.push({ tipo: doc.tipo, erro: error.message });
      }
    }

    if (Object.keys(camposParaRemover).length > 0) {
      await Empresa.updateOne(
        { _id: req.params.id },
        { $unset: camposParaRemover }
      );
    }

    await empresa.save();
    await registrarLog(req.usuario.id, 'Exclusão de Documentos', empresa);

    const resposta = {
      msg: `${excluidos} documento(s) excluído(s) com sucesso.`,
      excluidos,
      total: documentos.length
    };

    if (erros.length > 0) {
      resposta.erros = erros;
      resposta.msg += ` ${erros.length} erro(s) ocorreram.`;
    }

    res.json(resposta);

  } catch (err) {
    console.error('Erro ao excluir documentos:', err);
    res.status(500).json({ msg: 'Erro no servidor ao excluir documentos.' });
  }
});

module.exports = router;