require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const os = require('os');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');

// Importar rotas
const authRoutes = require('./routes/rota-auth');
const empresaRoutes = require('./routes/rota-empresas');
const mensalidadeRoutes = require('./routes/rota-mensalidades');
const relatoriosRoutes = require('./routes/rota-relatorios');
const configuracaoRoutes = require('./routes/rota-configuracao');
const funcionarioRoutes = require('./routes/rota-funcionarios');
const pagamentosRoutes = require('./routes/rota-pagamentos');
const adminRoutes = require('./routes/rota-admin');

const app = express();

// ⚠️ Necessário para o Render (proxy reverse)
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;

// Escolher URI dependendo do ambiente
let MONGODB_URI;
if (process.env.NODE_ENV === 'production') {
    MONGODB_URI = process.env.MONGODB_URI_PROD;
} else {
    MONGODB_URI = process.env.MONGODB_URI_LOCAL;
}

if (!MONGODB_URI) {
    console.error('Erro: MONGODB_URI não está definida!');
    process.exit(1);
}

// Conectar ao MongoDB
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log(`MongoDB conectado (${process.env.NODE_ENV === 'production' ? 'produção' : 'local'})...`))
.catch(err => {
    console.error('Erro ao conectar ao MongoDB:', err);
    process.exit(1);
});

// -----------------------------
//       MIDDLEWARES
// -----------------------------
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"],
      "connect-src": ["'self'", "https://viacep.com.br", "https://servicodados.ibge.gov.br"],
      "script-src-attr": ["'self'", "'unsafe-inline'"]
    }
  })
);

app.use(mongoSanitize());
app.use(cors());
app.use(express.json());

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/mensalidades', mensalidadeRoutes);
app.use('/api/relatorios', relatoriosRoutes);
app.use('/api/configuracao', configuracaoRoutes);
app.use('/api/funcionarios', funcionarioRoutes);
app.use('/api/pagamentos', pagamentosRoutes);
app.use('/api/admin', adminRoutes);

// Arquivos estáticos
app.use(express.static('client'));
app.use('/assets', express.static(path.join(__dirname, 'client/assets')));
app.use('/js/config.js', express.static(path.join(__dirname, 'config.js')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rotas adicionais
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/login.html'));
});

app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

// -----------------------------
//       INICIAR SERVIDOR
// -----------------------------
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`JWT_SECRET carregado: ${process.env.JWT_SECRET ? 'Sim' : 'Não'}`);

    const interfaces = os.networkInterfaces();
    let ipAddress = 'localhost';
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if ('IPv4' !== iface.family || iface.internal !== false) continue;
            ipAddress = iface.address;
            break;
        }
    }

    console.log(`\nAcesse localmente: http://localhost:${PORT}/login.html`);
    console.log(`Acesse na rede:    http://${ipAddress}:${PORT}/login.html\n`);
});
