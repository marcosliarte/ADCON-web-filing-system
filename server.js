require('dotenv').config(); // Carrega as variáveis de ambiente do arquivo .env
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose'); // Importe o Mongoose
const path = require('path'); // Módulo para lidar com caminhos de arquivos
const helmet = require('helmet'); // Para segurança dos cabeçalhos HTTP
const mongoSanitize = require('express-mongo-sanitize'); // Para prevenir NoSQL Injection

// Importar rotas
const authRoutes = require('./routes/rota-auth');
const empresaRoutes = require('./routes/rota-empresas');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Conectar ao MongoDB
mongoose.connect(MONGODB_URI)
.then(() => console.log('Conectado ao MongoDB'))
.catch(err => {
    console.error('Erro ao conectar ao MongoDB:', err);
    process.exit(1); // Encerra a aplicação se não conseguir conectar ao DB
});

// --- ORDEM CORRETA DOS MIDDLEWARES ---

// 1. Middlewares de Segurança primeiro
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"], // Permite <script> tags
      "script-src-attr": ["'self'", "'unsafe-inline'"], // Permite onclick="", etc.
    },
  })
);
app.use(mongoSanitize()); // Previne NoSQL Injection

// 2. Middlewares de parsing e CORS
app.use(cors());
app.use(express.json());

// 3. Middlewares de Rota
app.use('/api/auth', authRoutes);
// A linha acima já lida com todas as rotas de autenticação, incluindo /api/auth/admin/users
app.use('/api/empresas', empresaRoutes);

// 4. Middlewares para servir arquivos estáticos (frontend e uploads)
app.use(express.static('client'));
app.use('/assets', express.static(path.join(__dirname, 'client/assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`JWT_SECRET carregado: ${process.env.JWT_SECRET ? 'Sim' : 'Não'}`); // Adicionado para debug
    console.log('Acesse a aplicação em http://localhost:3000/empresas.html');
});