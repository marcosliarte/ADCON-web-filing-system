require('dotenv').config(); // Carrega .env localmente, se existir
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
const notificacoesRoutes = require('./routes/rota-notificacoes');
const compartilhamentoRoutes = require('./routes/rota-compartilhamento');
const faturamentoRoutes = require('./routes/rota-faturamento');

const app = express();

// ⚠️ Necessário para o Render (proxy reverse)
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;

// -----------------------------
//       CONFIGURAÇÃO DO MONGODB
// -----------------------------
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;

if (!MONGODB_URI) {
    console.error('Erro: MONGODB_URI não está definida!');
    process.exit(1);
}

// Conectar ao MongoDB (versão moderna, sem warnings)
mongoose.connect(MONGODB_URI)
.then(() => console.log(`MongoDB conectado (${MONGODB_URI.includes('127.0.0.1') ? 'local' : 'produção'})...`))
.catch(err => {
    console.error('Erro ao conectar ao MongoDB:', err);
    process.exit(1);
});

// -----------------------------
//       MIDDLEWARES
// -----------------------------

// Encontra o IP local para adicionar à CSP em ambiente de desenvolvimento
const interfaces = os.networkInterfaces();
let localIpAddress = 'localhost';
for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
        if ('IPv4' !== iface.family || iface.internal !== false) continue;
        localIpAddress = iface.address;
        break;
    }
}

// Configuração de segurança simplificada para desenvolvimento.
// Apenas desativa o HSTS para impedir que o navegador force HTTPS.
app.use(helmet({
  hsts: false,
  contentSecurityPolicy: false, // Desativa a CSP para simplificar o diagnóstico.
}));

app.use(mongoSanitize());
app.use(cors());
app.use(express.json());

// Middleware para logar todas as requisições recebidas
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleString('pt-BR')}] Requisição recebida: ${req.method} ${req.originalUrl} de ${req.ip}`);
  next();
});

// -----------------------------
//       ROTAS DA API
// -----------------------------
app.use('/api/auth', authRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/mensalidades', mensalidadeRoutes);
app.use('/api/relatorios', relatoriosRoutes);
app.use('/api/configuracao', configuracaoRoutes);
app.use('/api/funcionarios', funcionarioRoutes);
app.use('/api/pagamentos', pagamentosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notificacoes', notificacoesRoutes);
app.use('/api/faturamento', faturamentoRoutes);
// app.use('/api/compartilhamento', compartilhamentoRoutes); // Desativado - funcionalidade removida

// -----------------------------
//       ARQUIVOS ESTÁTICOS
// -----------------------------
app.use(express.static('client'));
app.use('/assets', express.static(path.join(__dirname, 'client/assets')));
app.use('/js/config.js', express.static(path.join(__dirname, 'config.js')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // ⚠️ Apenas temporário no Render

// -----------------------------
//       ROTAS ADICIONAIS
// -----------------------------
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/login.html'));
});

app.get('/healthz', (req, res) => res.status(200).send('OK'));

// -----------------------------
//       INICIAR SERVIDOR
// -----------------------------
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`JWT_SECRET carregado: ${process.env.JWT_SECRET ? 'Sim' : 'Não'}`);

    // O IP local já é detectado acima para a CSP
    console.log(`\nAcesse localmente: http://localhost:${PORT}/login.html`);
    console.log(`Acesse na rede:    http://${localIpAddress}:${PORT}/login.html\n`);

    if (process.env.RENDER_EXTERNAL_URL) {
        console.log(`Disponível online: ${process.env.RENDER_EXTERNAL_URL}\n`);
    }

    console.log("⚠️ Lembre-se: uploads em /uploads não persistem após reinícios no Render. Use S3 ou storage externo se necessário.\n");
});
