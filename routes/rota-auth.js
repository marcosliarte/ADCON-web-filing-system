const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
// Importe o modelo de usuário
const Usuario = require('../models/model-usuario');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const adminAuth = require('../middleware/adminAuth'); // Novo middleware
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose'); // Adicionado para definir o Schema
const fs = require('fs');

// --- CENTRALIZANDO O MODELO DE LOG ---
const LogAcaoSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  usuarioNome: { type: String, required: true },
  acao: { type: String, required: true },
  entidade: { type: String, default: 'Empresa' },
  entidadeId: { type: mongoose.Schema.Types.ObjectId },
  entidadeNome: { type: String },
}, { timestamps: true });
mongoose.model('LogAcao', LogAcaoSchema); // Compila o modelo para uso global

// --- NOVA: Função Auxiliar para Registrar Log de Ações de Usuário ---
async function registrarLogUsuario(usuarioExecutorId, acao, usuarioAlvo) {
  const LogAcao = mongoose.model('LogAcao');
  const usuarioExecutor = await Usuario.findById(usuarioExecutorId).select('nome');
  // Cria o log com a entidade 'Usuário'
  const log = new LogAcao({ usuarioId: usuarioExecutorId, usuarioNome: usuarioExecutor.nome, acao, entidade: 'Usuário', entidadeId: usuarioAlvo._id, entidadeNome: usuarioAlvo.nome });
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
  limits: { fileSize: 2 * 1024 * 1024 }, // Limite de 2MB
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
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
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

    // Remove o arquivo físico se for um upload
    if (usuario.fotoPerfilUrl && usuario.fotoPerfilUrl.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', usuario.fotoPerfilUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Define a foto para o padrão
    usuario.fotoPerfilUrl = 'assets/profile-icon.svg';
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
// @desc    Alterar o email do usuário logado
// @access  Private
router.put(
  '/change-email',
  [auth, check('novoEmail', 'Por favor, inclua um email válido').isEmail()],
  async (req, res) => {
    // Lógica para alterar email (simplificada)
    // Em um sistema de produção, você enviaria um email de confirmação para o novo endereço.
    const { novoEmail } = req.body;
    try {
      const usuario = await Usuario.findByIdAndUpdate(req.usuario.id, { email: novoEmail }, { new: true }).select('-senha');
      res.json({ msg: 'Email alterado com sucesso!', usuario });
    } catch (err) { // Loga o erro
      res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
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
      await registrarLogUsuario(req.usuario.id, `Criação de Usuário: ${usuario.role}`, usuario);

      res.status(201).json(usuarioCriado);

    } catch (err) {
      console.error(err.message); // Loga o erro
      res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
    }
  }
);

// @route   GET api/auth/admin/users
// @desc    Listar todos os usuários (por um admin)
// @access  Private (Admin)
router.get('/admin/users', [auth, adminAuth], async (req, res) => {
  try {
    // Retorna todos os usuários, exceto a senha, ordenados por nome
    const usuarios = await Usuario.find().select('-senha').sort({ nome: 1 });
    res.json(usuarios);
  } catch (err) {
    console.error(err.message); // Loga o erro
    res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
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
    await registrarLogUsuario(req.usuario.id, 'Exclusão de Usuário', usuario);

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
        await registrarLogUsuario(req.usuario.id, `Alteração de Perfil para: ${role}`, targetUser);

        res.json({ msg: `Perfil de ${targetUser.nome} atualizado para ${role} com sucesso.` });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Erro no servidor ao atualizar perfil.' });
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
    if (acao) query.acao = acao;
    if (entidadeNome) query.entidadeNome = new RegExp(entidadeNome, 'i');

    if (dataInicio && dataFim) {
      query.createdAt = { $gte: new Date(dataInicio), $lte: new Date(dataFim + 'T23:59:59') };
    } else if (dataInicio) {
      query.createdAt = { $gte: new Date(dataInicio) };
    } else if (dataFim) {
      query.createdAt = { $lte: new Date(dataFim + 'T23:59:59') };
    }

    const LogAcao = mongoose.model('LogAcao');
    const logs = await LogAcao.find(query)
      .sort({ createdAt: -1 }) // Ordena dos mais recentes para os mais antigos
      .limit(500); // Aumenta o limite para 500 registros

    res.json(logs);
  } catch (err) {
    res.status(500).json({ msg: 'Erro no servidor ao buscar logs.' });
  }
});

module.exports = router;
