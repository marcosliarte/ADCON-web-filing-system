require('dotenv').config(); // Carrega as variáveis de ambiente do arquivo .env
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose'); // Importe o Mongoose
const path = require('path'); // Módulo para lidar com caminhos de arquivos
const os = require('os'); // Módulo para obter informações do sistema operacional, como o IP
const helmet = require('helmet'); // Para segurança dos cabeçalhos HTTP
const mongoSanitize = require('express-mongo-sanitize'); // Para prevenir NoSQL Injection

// Importar rotas
const authRoutes = require('./routes/rota-auth');
const empresaRoutes = require('./routes/rota-empresas');
const mensalidadeRoutes = require('./routes/rota-mensalidades');
const relatoriosRoutes = require('./routes/rota-relatorios'); // ROTA DE RELATÓRIOS
const notificacaoRoutes = require('./routes/rota-notificacoes'); // ROTA DE NOTIFICAÇÕES
const configuracaoRoutes = require('./routes/rota-configuracao'); // NOVA ROTA
const adminNotificacaoRoutes = require('./routes/rota-admin-notificacoes'); // ROTA PARA ADMIN ENVIAR NOTIFICAÇÕES
const adminRoutes = require('./routes/rota-admin'); // ROTA PARA DASHBOARD DO ADMIN

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
      "connect-src": ["'self'", "https://viacep.com.br", "https://servicodados.ibge.gov.br"], // Permite conexão com ViaCEP e IBGE
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
app.use('/api/mensalidades', mensalidadeRoutes); // ROTA REGISTRADA
app.use('/api/notificacoes', notificacaoRoutes); // REGISTRO DA ROTA DE NOTIFICAÇÕES
app.use('/api/relatorios', relatoriosRoutes); // REGISTRANDO ROTA DE RELATÓRIOS
app.use('/api/configuracao', configuracaoRoutes); // REGISTRANDO NOVA ROTA
app.use('/api/admin/notificacoes', adminNotificacaoRoutes); // REGISTRO DA ROTA DE ENVIO DE NOTIFICAÇÕES
app.use('/api/admin', adminRoutes); // REGISTRANDO ROTA DO ADMIN

// 4. Middlewares para servir arquivos estáticos (frontend e uploads)
app.use(express.static('client'));
app.use('/assets', express.static(path.join(__dirname, 'client/assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando!`);
    console.log(`JWT_SECRET carregado: ${process.env.JWT_SECRET ? 'Sim' : 'Não'}`); // Adicionado para debug
    
    // Função para encontrar o endereço IP local
    const interfaces = os.networkInterfaces();
    let ipAddress = 'localhost';
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Pula endereços internos (ex: 127.0.0.1) e não-ipv4
            if ('IPv4' !== iface.family || iface.internal !== false) {
                continue;
            }
            ipAddress = iface.address;
            break;
        }
    }

    console.log(`\nAcesse a aplicação localmente em: http://localhost:${PORT}/login.html`);
    console.log(`Acesse na sua rede em:          http://${ipAddress}:${PORT}/login.html\n`);
});