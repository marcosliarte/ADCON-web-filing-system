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
const fs = require('fs');

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
    check('role', 'O tipo de usuário é obrigatório').isIn(['admin', 'funcionario', 'empresario']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nome, email, senha, role } = req.body;

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

    // Impede que um admin se auto-delete através da API
    if (req.usuario.id === req.params.id) {
      return res.status(400).json({ msg: 'Você não pode excluir sua própria conta de administrador.' });
    }

    await Usuario.findByIdAndDelete(req.params.id);

    res.json({ msg: 'Usuário removido com sucesso' });
  } catch (err) {
    console.error(err.message); // Loga o erro
    res.status(500).json({ msg: 'Erro no servidor' }); // Padronizado para JSON
  }
});

module.exports = router;
