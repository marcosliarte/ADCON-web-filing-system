const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { check, validationResult } = require('express-validator');
const Usuario = require('../models/model-usuario');
const Funcionario = require('../models/model-funcionario');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const adminAuth = require('../middleware/adminAuth');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');

const tokenBlacklist = require('../utils/tokenBlacklist');

// --- CENTRALIZANDO O MODELO DE LOG ---
const LogAcaoSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  usuarioNome: { type: String, required: true },
  acao: { type: String, required: true },
  entidade: { type: String, default: 'Empresa' },
  entidadeId: { type: mongoose.Schema.Types.ObjectId },
  entidadeNome: { type: String },
  dispositivo: { type: String },
}, { timestamps: true });

// TTL automático: logs expiram após 90 dias
LogAcaoSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

mongoose.model('LogAcao', LogAcaoSchema);


// --- NOVA: Função Auxiliar para Registrar Log de Ações de Usuário ---
async function registrarLogUsuario(req, acao, usuarioAlvo) {
  const LogAcao = mongoose.model('LogAcao');
  const usuarioExecutor = await Usuario.findById(req.usuario.id).select('nome');
  // Cria o log com a entidade 'Usuário'
  const log = new LogAcao({
    usuarioId: req.usuario.id,
    usuarioNome: usuarioExecutor.nome,
    acao,
    dispositivo: req.headers['user-agent'], // Captura o dispositivo da requisição
    entidade: 'Usuário',
    entidadeId: usuarioAlvo._id,
    entidadeNome: usuarioAlvo.nome
  });
  await log.save();
}

// --- NOVA: Função Auxiliar para Registrar Log de Sistema (Login, etc.) ---
async function registrarLogSistema(req, acao, usuario) {
  const LogAcao = mongoose.model('LogAcao');
  // Cria o log sem uma entidade específica, apenas a ação do usuário.
  const log = new LogAcao({
    usuarioId: usuario._id,
    usuarioNome: usuario.nome,
    acao,
    dispositivo: req.headers['user-agent'], // Captura o dispositivo da requisição
    entidade: 'Sistema', // Indica que é uma ação de sistema
    entidadeNome: 'Login'
  });
  await log.save();
}

// Configuração do Multer para upload de fotos de perfil
const profilePicStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/profile-pics');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const sanitizedFilename = `${req.usuario.id}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, sanitizedFilename);
  },
});

const uploadProfilePic = multer({
  storage: profilePicStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // Aumentado para 20MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Erro: Apenas imagens são permitidas (jpeg, jpg, png, gif)!'));
  },
});

// Limita as tentativas de login/registro para prevenir ataques de força bruta
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Limita cada IP a 10 requisições por janela
  message: 'Muitas tentativas de autenticação a partir deste IP, por favor, tente novamente após 15 minutos',
  standardHeaders: true,
  legacyHeaders: false,
});

// @route   POST api/auth/register
// @desc    Registrar um usuário
// @access  Public
router.post(
  '/register',
  [
    authLimiter,
    check('nome', 'O nome é obrigatório').not().isEmpty(),
    check('email', 'Por favor, inclua um email válido').isEmail(),
    check('senha', 'Por favor, insira uma senha com 6 ou mais caracteres').isLength({ min: 6 }),
    check('role', 'O tipo de usuário é obrigatório').isIn(['admin', 'funcionario', 'empresario']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nome, email, senha } = req.body; // Removido 'role' daqui

    try {
      let usuario = await Usuario.findOne({ email });

      if (usuario) {
        return res.status(400).json({ msg: 'Usuário já existe' });
      }

      usuario = new Usuario({
        nome,
        email,
        senha,
        role: 'funcionario', // Padrão para novo registro público
      });

      await usuario.save();

      const payload = {
        usuario: {
          id: usuario.id,
          role: usuario.role,
        },
      };

      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: 3600 },
        (err, token) => {
          if (err) throw err;
          res.json({ token });
        }
      );
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
    }
  }
);

// @route   POST api/auth/login
// @desc    Autenticar usuário e obter token
// @access  Public
router.post(
  '/login',
  [
    authLimiter,
    check('email', 'Por favor, inclua um email válido').isEmail(),
    check('senha', 'A senha é obrigatória').exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, senha } = req.body;

    try {
      let usuario = await Usuario.findOne({ email });

      if (!usuario) {
        return res.status(400).json({ msg: 'Credenciais inválidas' });
      }

      const isMatch = await usuario.comparePassword(senha);

      if (!isMatch) {
        return res.status(400).json({ msg: 'Credenciais inválidas' });
      }

      // REGISTRA O LOG DE LOGIN BEM-SUCEDIDO
      await registrarLogSistema(req, 'Login bem-sucedido', usuario);

      const payload = {
        usuario: {
          id: usuario.id,
          role: usuario.role,
        },
      };

      jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: 3600 },
        (err, token) => {
          if (err) throw err;
          res.json({ token });
        }
      );
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
    }
  }
);

// @route   GET api/auth
// @desc    Obter usuário logado
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario.id).select('-senha'); // req.usuario é definido pelo middleware 'auth'
    res.json(usuario);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
  }
});

// @route   POST api/auth/profile-pic
// @desc    Fazer upload da foto de perfil
// @access  Private
router.post(
  '/profile-pic',
  [auth, uploadProfilePic.single('profilePic')],
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ msg: 'Nenhum arquivo enviado.' });
      }

      const usuario = await Usuario.findById(req.usuario.id);
      if (!usuario) {
        return res.status(404).json({ msg: 'Usuário não encontrado.' });
      }

      // Remove a foto antiga, se existir e não for um ícone pré-definido
      if (usuario.fotoPerfilUrl && usuario.fotoPerfilUrl.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '..', usuario.fotoPerfilUrl);
        fs.promises.unlink(oldPath).catch(() => {}); // não bloqueia se o arquivo já não existir
      }

      const newFotoUrl = `/uploads/profile-pics/${req.file.filename}`;
      usuario.fotoPerfilUrl = newFotoUrl;
      await usuario.save();

      res.json({ fotoPerfilUrl: newFotoUrl });
    } catch (err) {
      console.error(err.message); // Loga o erro
      res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
    }
  }
);

// @route   PUT api/auth/profile-icon
// @desc    Atualizar com um ícone pré-definido
// @access  Private
router.put('/profile-icon', auth, async (req, res) => {
    const { iconUrl } = req.body;
    const usuario = await Usuario.findByIdAndUpdate(req.usuario.id, { fotoPerfilUrl: iconUrl }, { new: true });
    res.json({ fotoPerfilUrl: usuario.fotoPerfilUrl });
});

// @route   DELETE api/auth/profile-pic
// @desc    Remover a foto de perfil do usuário
// @access  Private
router.delete('/profile-pic', auth, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario.id);
    if (!usuario) {
      return res.status(404).json({ msg: 'Usuário não encontrado.' });
    }

    // Remove o arquivo físico se for um upload (mas não remove no-profile.png)
    if (usuario.fotoPerfilUrl && usuario.fotoPerfilUrl.startsWith('/uploads/') && !usuario.fotoPerfilUrl.includes('no-profile.png')) {
      const oldPath = path.join(__dirname, '..', usuario.fotoPerfilUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Define a foto para o padrão
    usuario.fotoPerfilUrl = '/uploads/profile-pics/no-profile.png';
    await usuario.save();

    res.json({ msg: 'Foto de perfil removida com sucesso.', fotoPerfilUrl: usuario.fotoPerfilUrl });
  } catch (err) {
    console.error(err.message); // Loga o erro
    res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
  }
});

// @route   PUT api/auth/change-password
// @desc    Alterar a senha do usuário logado
// @access  Private
router.put(
  '/change-password',
  [
    auth,
    check('senhaAtual', 'A senha atual é obrigatória').not().isEmpty(),
    check('novaSenha', 'A nova senha deve ter 6 ou mais caracteres').isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { senhaAtual, novaSenha } = req.body;

    try {
      const usuario = await Usuario.findById(req.usuario.id);
      const isMatch = await usuario.comparePassword(senhaAtual);

      if (!isMatch) {
        return res.status(400).json({ msg: 'A senha atual está incorreta.' });
      }

      usuario.senha = novaSenha; // O hook 'pre-save' no modelo irá hashear a nova senha
      await usuario.save();

      res.json({ msg: 'Senha alterada com sucesso!' });
    } catch (err) {
      console.error(err.message); // Loga o erro
      res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
    }
  }
);

// @route   PUT api/auth/change-email
// @desc    Solicitar mudança de e-mail — gera token de verificação (expira em 1h)
// @access  Private
router.put(
  '/change-email',
  [
    auth,
    check('novoEmail', 'Por favor, inclua um email válido').isEmail().normalizeEmail(),
    check('senhaAtual', 'Senha atual é obrigatória').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { novoEmail, senhaAtual } = req.body;
    try {
      const usuario = await Usuario.findById(req.usuario.id);
      if (!usuario) return res.status(404).json({ msg: 'Usuário não encontrado.' });

      const senhaOk = await usuario.comparePassword(senhaAtual);
      if (!senhaOk) return res.status(400).json({ msg: 'Senha atual incorreta.' });

      const emailEmUso = await Usuario.findOne({ email: novoEmail });
      if (emailEmUso) return res.status(400).json({ msg: 'Este e-mail já está em uso.' });

      // Gera token de 6 dígitos e armazena seu hash
      const token = crypto.randomInt(100000, 999999).toString();
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      usuario.emailPendente = novoEmail;
      usuario.emailVerificacaoToken = tokenHash;
      usuario.emailVerificacaoExpira = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
      await usuario.save();

      // Em produção: envie 'token' por e-mail para novoEmail.
      // Por ora, retorna o código para o admin entregar manualmente.
      res.json({
        msg: `Código de verificação gerado. Entregue ao usuário: ${token}. Válido por 1 hora.`,
        codigoVerificacao: token,
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ msg: 'Erro no servidor' });
    }
  }
);

// @route   POST api/auth/verify-email
// @desc    Confirmar mudança de e-mail com o código recebido
// @access  Private
router.post(
  '/verify-email',
  [auth, check('codigo', 'Código de verificação é obrigatório').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { codigo } = req.body;
    try {
      const usuario = await Usuario.findById(req.usuario.id);
      if (!usuario || !usuario.emailPendente || !usuario.emailVerificacaoToken) {
        return res.status(400).json({ msg: 'Nenhuma mudança de e-mail pendente.' });
      }
      if (usuario.emailVerificacaoExpira < new Date()) {
        usuario.emailPendente = null;
        usuario.emailVerificacaoToken = null;
        usuario.emailVerificacaoExpira = null;
        await usuario.save();
        return res.status(400).json({ msg: 'Código expirado. Solicite uma nova mudança de e-mail.' });
      }

      const codigoHash = crypto.createHash('sha256').update(codigo.trim()).digest('hex');
      if (codigoHash !== usuario.emailVerificacaoToken) {
        return res.status(400).json({ msg: 'Código inválido.' });
      }

      usuario.email = usuario.emailPendente;
      usuario.emailPendente = null;
      usuario.emailVerificacaoToken = null;
      usuario.emailVerificacaoExpira = null;
      await usuario.save();

      res.json({ msg: 'E-mail alterado com sucesso!' });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ msg: 'Erro no servidor' });
    }
  }
);

// --- ROTAS DE ADMINISTRAÇÃO DE USUÁRIOS ---
// Acessíveis apenas para usuários com role 'admin'

// @route   POST api/auth/admin/users
// @desc    Criar um novo usuário (por um admin)
// @access  Private (Admin)
router.post(
  '/admin/users',
  [
    auth,
    adminAuth,
    check('nome', 'O nome é obrigatório').not().isEmpty(),
    check('email', 'Por favor, inclua um email válido').isEmail(),
    check('senha', 'Por favor, insira uma senha com 6 ou mais caracteres').isLength({ min: 6 }),
    check('role', 'O tipo de usuário é obrigatório').isIn(['admin', 'gerente', 'funcionario', 'empresario']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nome, email, senha, role } = req.body;
    const criador = await Usuario.findById(req.usuario.id);

    // Regra: Gerente não pode criar Admin
    if (criador.role === 'gerente' && role === 'admin') {
      return res.status(403).json({ msg: 'Acesso negado. Gerentes não podem criar administradores.' });
    }

    try {
      let usuario = await Usuario.findOne({ email });
      if (usuario) {
        return res.status(400).json({ msg: 'Usuário com este email já existe' });
      }

      usuario = new Usuario({ nome, email, senha, role });
      await usuario.save();

      // Retorna o usuário criado (sem a senha) para confirmação
      const usuarioCriado = usuario.toObject();
      delete usuarioCriado.senha;

      // REGISTRA O LOG
      await registrarLogUsuario(req, `Criação de Usuário: ${usuario.role}`, usuario);

      res.status(201).json(usuarioCriado);

    } catch (err) {
      console.error(err.message); // Loga o erro
      res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
    }
  }
);

// @route   GET api/auth/admin/users
// @desc    Listar todos os usuários (por um admin) com paginação
// @access  Private (Admin)
router.get('/admin/users', [auth, adminAuth], async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 50)); // Máximo 100 por página
    const skip = (page - 1) * limit;

    // Busca total de usuários para calcular paginação
    const total = await Usuario.countDocuments();
    const usuarios = await Usuario.find()
      .select('-senha')
      .sort({ nome: 1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(total / limit);

    res.json({
      usuarios,
      paginacao: {
        paginaAtual: page,
        limitePorPagina: limit,
        totalUsuarios: total,
        totalPaginas: totalPages,
        temProxima: page < totalPages,
        temAnterior: page > 1
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor' });
  }
});

// @route   DELETE api/auth/admin/users/:id
// @desc    Deletar um usuário (por um admin)
// @access  Private (Admin)
router.delete('/admin/users/:id', [auth, adminAuth], async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.id);

    if (!usuario) {
      return res.status(404).json({ msg: 'Usuário não encontrado' });
    }

    // CORREÇÃO: Adiciona regra de negócio para impedir que gerentes excluam administradores.
    const criador = await Usuario.findById(req.usuario.id);

    if (criador.role === 'gerente' && usuario.role === 'admin') {
      return res.status(403).json({ msg: 'Acesso negado. Gerentes não podem excluir administradores.' });
    }

    // Impede que um admin se auto-delete através da API
    if (req.usuario.id === req.params.id) {
      return res.status(400).json({ msg: 'Você não pode excluir sua própria conta de administrador.' });
    }

    await Usuario.findByIdAndDelete(req.params.id);

    // REGISTRA O LOG
    await registrarLogUsuario(req, 'Exclusão de Usuário', usuario);

    res.json({ msg: 'Usuário removido com sucesso' });
  } catch (err) {
    console.error(err.message); // Loga o erro
    res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
  }
});

// @route   PUT api/auth/admin/users/:id/role
// @desc    Atualizar o perfil de um usuário (por um admin/gerente)
// @access  Private (Admin/Gerente)
router.put('/admin/users/:id/role', [auth, adminAuth], async (req, res) => {
    const { role } = req.body;
    const { id: targetUserId } = req.params;
    const modifierUserId = req.usuario.id;

    // Regra 1: Ninguém pode alterar o próprio perfil.
    if (targetUserId === modifierUserId) {
        return res.status(400).json({ msg: 'Você não pode alterar seu próprio perfil.' });
    }

    // Validação do perfil enviado
    if (!['admin', 'gerente', 'funcionario', 'empresario'].includes(role)) {
        return res.status(400).json({ msg: 'Perfil inválido.' });
    }

    try {
      const targetUser = await Usuario.findById(targetUserId);
        const modifierUser = await Usuario.findById(modifierUserId);

        if (!targetUser) {
            return res.status(404).json({ msg: 'Usuário alvo não encontrado.' });
        }

        // Regra 2: Gerente não pode modificar admins ou outros gerentes, nem promover ninguém a admin.
        if (modifierUser.role === 'gerente' && (targetUser.role === 'admin' || targetUser.role === 'gerente' || role === 'admin')) {
            return res.status(403).json({ msg: 'Acesso negado. Gerentes não têm permissão para esta ação.' });
        }

        targetUser.role = role;
        await targetUser.save();

        // REGISTRA O LOG
        await registrarLogUsuario(req, `Alteração de Perfil para: ${role}`, targetUser);

        res.json({ msg: `Perfil de ${targetUser.nome} atualizado para ${role} com sucesso.` });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao atualizar perfil.' });
    }
});

// @route   PUT api/auth/admin/users/:id
// @desc    Atualizar nome e email de um usuário (por admin/gerente)
// @access  Private (Admin/Gerente)
router.put('/admin/users/:id', [auth, adminAuth], async (req, res) => {
  const { id: targetUserId } = req.params;
  const { nome, email } = req.body;

  if (!nome || !email) {
    return res.status(400).json({ msg: 'Nome e email são obrigatórios.' });
  }

  try {
    const targetUser = await Usuario.findById(targetUserId);
    const modifierUser = await Usuario.findById(req.usuario.id);

    if (!targetUser) return res.status(404).json({ msg: 'Usuário não encontrado.' });

    // Gerente não pode editar admin
    if (modifierUser.role === 'gerente' && targetUser.role === 'admin') {
      return res.status(403).json({ msg: 'Acesso negado. Gerentes não podem editar administradores.' });
    }

    // Verifica se o email já está em uso por outro usuário
    const existing = await Usuario.findOne({ email });
    if (existing && existing._id.toString() !== targetUserId) {
      return res.status(400).json({ msg: 'Email já está em uso por outro usuário.' });
    }

    targetUser.nome = nome;
    targetUser.email = email;
    await targetUser.save();

    // REGISTRA O LOG
    await registrarLogUsuario(req, 'Edição de Usuário', targetUser);

    const userObj = targetUser.toObject();
    delete userObj.senha;
    res.json({ msg: 'Usuário atualizado com sucesso.', usuario: userObj });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor ao atualizar usuário.' });
  }
});

// @route   GET api/auth/admin/logs
// @desc    Listar todos os logs de ações (por um admin)
// @access  Private (Admin)
router.get('/admin/logs', [auth, adminAuth], async (req, res) => {
  try {
    const { usuario, acao, dataInicio, dataFim, entidadeNome } = req.query;
    const query = {};

    if (usuario) query.usuarioNome = new RegExp(usuario, 'i');
    if (acao) query.acao = new RegExp(acao, 'i'); // Busca flexível (case-insensitive)
    if (entidadeNome) query.entidadeNome = new RegExp(entidadeNome, 'i');

    if (dataInicio && dataFim) {
      query.createdAt = { $gte: new Date(dataInicio), $lte: new Date(dataFim + 'T23:59:59') };
    } else if (dataInicio) {
      query.createdAt = { $gte: new Date(dataInicio) };
    } else if (dataFim) {
      query.createdAt = { $lte: new Date(dataFim + 'T23:59:59') };
    }

    const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
    const limite = Math.min(200, Math.max(1, parseInt(req.query.limite) || 50));
    const skip = (pagina - 1) * limite;

    const LogAcao = mongoose.model('LogAcao');
    const [total, logs] = await Promise.all([
      LogAcao.countDocuments(query),
      LogAcao.find(query).sort({ createdAt: -1 }).skip(skip).limit(limite),
    ]);

    res.json({ data: logs, paginacao: { total, pagina, limite, totalPaginas: Math.ceil(total / limite) } });
  } catch (err) {
    res.status(500).json({ msg: 'Erro no servidor ao buscar logs.' });
  }
});

// @route   POST api/auth/admin/impersonate/:id
// @desc    Permite que um admin personifique outro usuário
// @access  Private (Admin)
router.post('/admin/impersonate/:id', [auth, adminAuth], async (req, res) => {
    try {
        // Impede personificação encadeada (admin personificando já está personificando alguém)
        if (req.usuario.impersonatorId) {
            return res.status(400).json({ msg: 'Encerre a personificação atual antes de iniciar outra.' });
        }

        const adminId = req.usuario.id;
        const targetUserId = req.params.id;

        if (adminId === targetUserId) {
            return res.status(400).json({ msg: 'Você não pode personificar a si mesmo.' });
        }

        const targetUser = await Usuario.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ msg: 'Usuário alvo não encontrado.' });
        }

        // Cria um novo token para o usuário alvo, mas com uma "lembrança" de quem é o admin original
        const payload = {
            usuario: {
                id: targetUser.id,
                role: targetUser.role,
                impersonatorId: adminId // ID do admin que está personificando
            },
        };

        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao tentar personificar usuário.' });
    }
});

// @route   POST api/auth/admin/stop-impersonating
// @desc    Para a personificação e retorna para a conta do admin
// @access  Private (Durante a personificação)
router.post('/admin/stop-impersonating', auth, async (req, res) => {
    try {
        const impersonatorId = req.usuario.impersonatorId; // Este campo só existe no token de personificação

        if (!impersonatorId) {
            return res.status(400).json({ msg: 'Esta não é uma sessão de personificação.' });
        }

        const adminUser = await Usuario.findById(impersonatorId);
        if (!adminUser) {
            return res.status(404).json({ msg: 'Conta do administrador original não encontrada.' });
        }

        // Gera um novo token para o admin original
        const payload = {
            usuario: {
                id: adminUser.id,
                role: adminUser.role,
            },
        };

        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 3600 }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao parar a personificação.' });
    }
});

// @route   POST api/auth/admin/users/:id/reset-password
// @desc    Reseta a senha de um usuário e retorna a nova senha temporária
// @access  Private (Admin)
router.post('/admin/users/:id/reset-password', [auth, adminAuth], async (req, res) => {
    try {
        const targetUser = await Usuario.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ msg: 'Usuário não encontrado.' });

        // Gera senha temporária segura (criptograficamente aleatória)
        const tempPassword = crypto.randomBytes(8).toString('base64url').slice(0, 12);
        targetUser.senha = tempPassword; // O hook pre-save irá hashear
        await targetUser.save();

        res.json({ msg: `A senha de ${targetUser.nome} foi resetada.`, tempPassword });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao resetar a senha.' });
    }
});


// @route   GET api/auth/admin/unlinked-users
// @desc    Listar usuários que ainda não foram vinculados a um funcionário
// @access  Private (Admin/Gerente)
router.get('/admin/unlinked-users', [auth, adminAuth], async (req, res) => {
  try {
    // 1. Encontra todos os IDs de usuários que já estão na coleção de funcionários
    const linkedUsers = await Funcionario.find({ usuario: { $exists: true } }).select('usuario');
    const linkedUserIds = linkedUsers.map(func => func.usuario);

    // 2. Busca todos os usuários cujo ID não está na lista de IDs vinculados
    const unlinkedUsers = await Usuario.find({
      _id: { $nin: linkedUserIds }
    }).select('-senha').sort({ nome: 1 });

    res.json(unlinkedUsers);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor ao buscar usuários não vinculados.' });
  }
});

// @route   GET api/auth/admin/users.csv
// @desc    Exportar todos os usuários como CSV (streaming)
// @access  Private (Admin)
router.get('/admin/users.csv', [auth, adminAuth], async (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="usuarios-export-${new Date().toISOString().slice(0, 10)}.csv"`);

    // Escreve header CSV
    res.write('Nome,Email,Perfil,Data de Registro\n');

    // Usa cursor para evitar carregar todos os usuários em memória
    const cursor = Usuario.find().select('nome email role dataRegistro').sort({ nome: 1 }).cursor();

    let count = 0;
    cursor.on('data', (doc) => {
      const row = [
        `"${(doc.nome || '').replace(/"/g, '""')}"`,
        `"${(doc.email || '').replace(/"/g, '""')}"`,
        `"${(doc.role || '').replace(/"/g, '""')}"`,
        `"${doc.dataRegistro ? new Date(doc.dataRegistro).toLocaleString('pt-BR') : ''}"`
      ].join(',');
      res.write(row + '\n');
      count++;
    });

    cursor.on('end', () => {
      res.end();
    });

    cursor.on('error', (err) => {
      console.error('Erro no cursor de usuários:', err.message);
      res.status(500).end('Erro ao exportar usuários.');
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor ao exportar usuários.' });
  }
});

// @route   GET api/auth/admin/online-users
// @desc    Listar usuários online (ativos nos últimos 5 minutos)
// @access  Private (Admin)
router.get('/admin/online-users', [auth, adminAuth], async (req, res) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const onlineUsers = await Usuario.find({
      lastActivity: { $gte: fiveMinutesAgo }
    })
    .select('nome email role lastActivity')
    .sort({ lastActivity: -1 });
    
    res.json(onlineUsers);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor ao buscar usuários online.' });
  }
});

// @route   GET api/auth/admin/logs.csv
// @desc    Exportar logs como CSV (streaming) com filtros opcionais
// @access  Private (Admin)
router.get('/admin/logs.csv', [auth, adminAuth], async (req, res) => {
  try {
    const { usuario, acao, dataInicio, dataFim } = req.query;
    const query = {};

    if (usuario) query.usuarioNome = new RegExp(usuario, 'i');
    if (acao) query.acao = new RegExp(acao, 'i');
    if (dataInicio && dataFim) {
      query.createdAt = { $gte: new Date(dataInicio), $lte: new Date(dataFim + 'T23:59:59') };
    } else if (dataInicio) {
      query.createdAt = { $gte: new Date(dataInicio) };
    } else if (dataFim) {
      query.createdAt = { $lte: new Date(dataFim + 'T23:59:59') };
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="logs-export-${new Date().toISOString().slice(0, 10)}.csv"`);

    // Header CSV
    res.write('Data e Hora,Usuário,Ação,Entidade,Nome da Entidade,Dispositivo\n');

    const LogAcao = mongoose.model('LogAcao');
    const cursor = LogAcao.find(query).sort({ createdAt: -1 }).cursor();

    cursor.on('data', (doc) => {
      const row = [
        `"${new Date(doc.createdAt).toLocaleString('pt-BR')}"`,
        `"${(doc.usuarioNome || '').replace(/"/g, '""')}"`,
        `"${(doc.acao || '').replace(/"/g, '""')}"`,
        `"${(doc.entidade || '').replace(/"/g, '""')}"`,
        `"${(doc.entidadeNome || '').replace(/"/g, '""')}"`,
        `"${(doc.dispositivo || '').replace(/"/g, '""')}"`
      ].join(',');
      res.write(row + '\n');
    });

    cursor.on('end', () => {
      res.end();
    });

    cursor.on('error', (err) => {
      console.error('Erro no cursor de logs:', err.message);
      res.status(500).end('Erro ao exportar logs.');
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Erro no servidor ao exportar logs.' });
  }
});

// @route   POST api/auth/logout
// @desc    Revoga o token atual (adiciona à blacklist)
// @access  Private
router.post('/logout', auth, (req, res) => {
    const token = req.header('x-auth-token');
    if (token) tokenBlacklist.add(token);
    res.json({ msg: 'Logout realizado com sucesso.' });
});

module.exports = router;
