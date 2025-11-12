const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const auth = require('../middleware/auth');
const Empresa = require('../models/model-empresa');
const Usuario = require('../models/model-usuario'); // Para verificar roles

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
    } else if (file.fieldname.startsWith('certidao_')) {
      // Agrupa todas as outras certidões em uma pasta
      subfolder = 'certidoes';
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

// @route   POST api/empresa
// @desc    Cadastrar uma nova empresa com certidão
// @access  Private (Admin ou Funcionário)
router.post(
  '/',
  [
    auth,
    // Espera arquivos de múltiplos campos definidos no formulário
    upload.fields([
      { name: 'arquivo_cnpj', maxCount: 1 },
      { name: 'certificado_digital', maxCount: 1 },
      // Permite múltiplos arquivos para alterações contratuais
      { name: 'contrato_social[0][arquivo]', maxCount: 1 },
      { name: 'contrato_social[1][arquivo]', maxCount: 1 },
      { name: 'contrato_social[2][arquivo]', maxCount: 1 },
      { name: 'contrato_social[3][arquivo]', maxCount: 1 },
      { name: 'contrato_social[4][arquivo]', maxCount: 1 }, // Adicione mais se precisar
      // Novos campos de arquivo
      { name: 'alvara_arquivo', maxCount: 1 },
      { name: 'certidao_prefeitura_arquivo', maxCount: 1 },
      { name: 'certidao_receita_arquivo', maxCount: 1 },
      { name: 'certidao_fgts_arquivo', maxCount: 1 },
      { name: 'certidao_sefaz_arquivo', maxCount: 1 },
      { name: 'certidao_trabalhista_arquivo', maxCount: 1 },
      { name: 'certidao_falencia_arquivo', maxCount: 1 },
    ]),
    check('nome_empresarial', 'Nome empresarial é obrigatório').not().isEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Verificar permissão
    const usuarioLogado = await Usuario.findById(req.usuario.id);
    if (!usuarioLogado || (usuarioLogado.role !== 'admin' && usuarioLogado.role !== 'funcionario')) {
      return res.status(403).json({ msg: 'Acesso negado. Você não tem permissão para cadastrar empresas.' });
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
        nome: req.body.nome_empresarial, // Mapeia o nome_empresarial do form para o campo 'nome' do schema
        filiais: req.body.filiais || [], // Adiciona os dados das filiais
        atividade_principal_descricao: req.body.atividade_principal_descricao, // Adiciona a descrição do CNAE
        documentos: {
          contratos: [],
        },
      };

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
            senha: req.body.certificado_senha // Salva a senha do certificado
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
            if (file) {
              info.nomeArquivo = file.originalname;
              info.caminhoArquivo = `/uploads/contratos/${file.filename}`;
              info.dataAlteracao = info.data; // Renomeando para corresponder ao schema
              dadosEmpresa.documentos.contratos.push(info);
            }
          });
        }
      }

      const novaEmpresa = new Empresa(dadosEmpresa);

      await novaEmpresa.save();
      res.status(201).json(novaEmpresa);
    } catch (err) {
      console.error(err.message);
      console.error(err.stack); // Adiciona mais detalhes do erro no log
      res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
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

    // Filtrar por ownerId se o usuário for empresário
    if (usuarioLogado.role === 'empresario') {
      query.ownerId = req.usuario.id;
    } else if (ownerId && usuarioLogado.role === 'admin') {
      // Admin pode filtrar por ownerId específico
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
    // Usar .lean() para obter um objeto JS puro, o que facilita a manipulação
    const empresa = await Empresa.findById(req.params.id).populate('matriz_id', 'nome _id cnpj').lean();

    if (!empresa) {
      return res.status(404).json({ msg: 'Empresa não encontrada' });
    }

    const usuarioLogado = await Usuario.findById(req.usuario.id);
    if (usuarioLogado.role === 'empresario' && empresa.ownerId.toString() !== req.usuario.id) {
      return res.status(403).json({ msg: 'Acesso negado. Você não tem permissão para visualizar esta empresa.' });
    }

    // Renomeia 'matriz_id' para 'matriz' para clareza no frontend
    empresa.matriz = empresa.matriz_id || null;
    // Busca as filiais SE a empresa for uma matriz
    empresa.filiais = (empresa.tipo === 'matriz' || !empresa.tipo) ? await Empresa.find({ matriz_id: req.params.id }).select('nome nome_fantasia cnpj _id').lean() : [];

    res.json(empresa);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
  }
});

// @route   DELETE api/empresa/:id
// @desc    Excluir uma empresa
// @access  Private (Apenas Admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const usuarioLogado = await Usuario.findById(req.usuario.id);
    if (!usuarioLogado || usuarioLogado.role !== 'admin') {
      // Funcionários também não podem excluir, apenas admins
      if (usuarioLogado.role === 'funcionario') {
        return res.status(403).json({ msg: 'Acesso negado. Apenas administradores podem excluir empresas.' });
      }
      // Empresários não podem excluir
      if (usuarioLogado.role === 'empresario') {
        return res.status(403).json({ msg: 'Acesso negado. Empresários não podem excluir empresas.' });
      }
      return res.status(403).json({ msg: 'Acesso negado. Apenas administradores podem excluir empresas.' });
    }

    const empresa = await Empresa.findById(req.params.id);
    if (!empresa) {
      return res.status(404).json({ msg: 'Empresa não encontrada' });
    }

    // Função auxiliar para deletar um arquivo de forma segura
    const deletarArquivo = (caminhoRelativo) => {
      if (!caminhoRelativo) return;
      const caminhoCompleto = path.join(__dirname, '..', caminhoRelativo);
      if (fs.existsSync(caminhoCompleto)) {
        fs.unlinkSync(caminhoCompleto);
        console.log(`Arquivo deletado: ${caminhoCompleto}`);
      }
    };

    // Coleta e deleta todos os arquivos associados
    if (empresa.documentos) {
      deletarArquivo(empresa.documentos.cartaoCnpj?.caminhoArquivo);
      deletarArquivo(empresa.documentos.certificadoDigital?.caminhoArquivo);
      if (empresa.documentos.contratos && empresa.documentos.contratos.length > 0) {
        empresa.documentos.contratos.forEach(contrato => deletarArquivo(contrato.caminhoArquivo));
      }
    }

    // Após deletar os arquivos, remove o registro do banco de dados
    await Empresa.findByIdAndDelete(req.params.id);

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
    // **CORREÇÃO:** Usar upload.fields para corresponder aos campos do formulário de edição
    upload.fields([
      { name: 'arquivo_cnpj', maxCount: 1 },
      { name: 'certificado_digital', maxCount: 1 },
      { name: 'contrato_social[0][arquivo]', maxCount: 1 },
      { name: 'contrato_social[1][arquivo]', maxCount: 1 },
      { name: 'contrato_social[2][arquivo]', maxCount: 1 },
      // Adicione mais campos de contrato se necessário,
      // e os novos campos de arquivo
      { name: 'alvara_arquivo', maxCount: 1 },
      { name: 'certidao_prefeitura_arquivo', maxCount: 1 },
      { name: 'certidao_receita_arquivo', maxCount: 1 },
      { name: 'certidao_fgts_arquivo', maxCount: 1 },
      { name: 'certidao_sefaz_arquivo', maxCount: 1 },
      { name: 'certidao_trabalhista_arquivo', maxCount: 1 },
      { name: 'certidao_falencia_arquivo', maxCount: 1 },
    ]),
    check('nome_empresarial', 'Nome empresarial é obrigatório').not().isEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const usuarioLogado = await Usuario.findById(req.usuario.id);
      if (usuarioLogado.role !== 'admin' && usuarioLogado.role !== 'funcionario') {
        return res.status(403).json({ msg: 'Acesso negado.' });
      }

      let empresa = await Empresa.findById(req.params.id);
      if (!empresa) {
        return res.status(404).json({ msg: 'Empresa não encontrada' });
      }

      // Atualiza os campos de texto simples
      empresa.nome = req.body.nome_empresarial;
      empresa.cnpj = req.body.cnpj;
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
        bairro: req.body['endereco.bairro'],
        cidade: req.body['endereco.cidade'],
        estado: req.body['endereco.estado']
      };

      // A lógica de upload de novos arquivos e remoção de antigos na edição
      // exigiria um tratamento mais detalhado dos `req.files`.

      // A lógica de arquivos na edição é complexa. Vamos simplificar por agora:
      // Se um novo arquivo é enviado, ele substitui o antigo.
      // A remoção de arquivos existentes precisaria de uma lógica separada.
      if (req.files) {
        if (req.files.arquivo_cnpj) {
            const file = req.files.arquivo_cnpj[0];
            empresa.documentos.cartaoCnpj = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/documentos_empresa/${file.filename}` };
        }
        if (req.files.certificado_digital) {
            const file = req.files.certificado_digital[0];
            empresa.documentos.certificadoDigital = { 
                nomeArquivo: file.originalname, 
                caminhoArquivo: `/uploads/certificados/${file.filename}`,
                dataValidade: req.body.certificado_validade,
                senha: req.body.certificado_senha // Salva a nova senha ao atualizar
            };
        }
        if (req.files.alvara_arquivo) {
            const file = req.files.alvara_arquivo[0];
            empresa.documentos.alvara = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/alvaras/${file.filename}`, ano: req.body.alvara_ano };
        }
        if (req.files.certidao_prefeitura_arquivo) {
            const file = req.files.certidao_prefeitura_arquivo[0];
            empresa.documentos.certidaoPrefeitura = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_prefeitura_validade };
        }
        if (req.files.certidao_receita_arquivo) {
            const file = req.files.certidao_receita_arquivo[0];
            empresa.documentos.certidaoReceita = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_receita_validade };
        }
        if (req.files.certidao_fgts_arquivo) {
            const file = req.files.certidao_fgts_arquivo[0];
            empresa.documentos.certidaoFGTS = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_fgts_validade };
        }
        if (req.files.certidao_sefaz_arquivo) {
            const file = req.files.certidao_sefaz_arquivo[0];
            empresa.documentos.certidaoSefaz = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_sefaz_validade };
        }
        if (req.files.certidao_trabalhista_arquivo) {
            const file = req.files.certidao_trabalhista_arquivo[0];
            empresa.documentos.certidaoTrabalhista = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_trabalhista_validade };
        }
        if (req.files.certidao_falencia_arquivo) {
            const file = req.files.certidao_falencia_arquivo[0];
            empresa.documentos.certidaoFalencia = { nomeArquivo: file.originalname, caminhoArquivo: `/uploads/certidoes/${file.filename}`, dataValidade: req.body.certidao_falencia_validade };
        }
        // A lógica para atualizar contratos seria ainda mais complexa e foi omitida para esta correção.
      }

      const empresaAtualizada = await empresa.save();
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

module.exports = router;