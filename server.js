require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const mongoose = require('mongoose');
const path = require('path');
const os = require('os');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

// Importar configurações de segurança
const securityConfig = require('./config/security');
const { errorHandler, notFound } = require('./middleware/errorHandler');

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

// Validação crítica do JWT_SECRET
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('❌ ERRO CRÍTICO: JWT_SECRET não configurado ou muito fraco!');
    console.error('   Gere um com: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    process.exit(1);
}

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

// -----------------------------
//    SEGURANÇA - HELMET
// -----------------------------
const isDevelopment = process.env.NODE_ENV !== 'production';

app.use(helmet({
  hsts: !isDevelopment, // HSTS apenas em produção
  contentSecurityPolicy: isDevelopment ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Considere remover unsafe-inline em produção
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  frameguard: { action: 'deny' }, // Previne clickjacking
  noSniff: true, // Previne MIME sniffing
  xssFilter: true, // XSS protection
}));

// -----------------------------
//    SEGURANÇA - SANITIZAÇÃO
// -----------------------------
// Previne NoSQL Injection removendo $ e . de req.body, req.query, req.params
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`⚠️ Tentativa de NoSQL Injection detectada: ${key} em ${req.path}`);
  },
}));

// -----------------------------
//    SEGURANÇA - RATE LIMITING
// -----------------------------
const generalLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs,
  max: securityConfig.rateLimit.max,
  message: 'Muitas requisições deste IP, tente novamente mais tarde',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit excedido: ${req.ip} em ${req.path}`);
    res.status(429).json({
      msg: 'Muitas requisições deste IP, tente novamente em 15 minutos',
    });
  },
});

app.use(generalLimiter);

// -----------------------------
//    COMPRESSÃO HTTP (gzip/brotli)
// -----------------------------
app.use(compression());

// -----------------------------
//    CORS E PARSING
// -----------------------------
app.use(cors(securityConfig.cors));
app.use(express.json({ limit: '10mb' })); // Limite de tamanho do payload JSON
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
//    TRATAMENTO DE ERROS
// -----------------------------
// Rota não encontrada (404) - deve vir ANTES do errorHandler
app.use(notFound);

// Handler centralizado de erros - deve ser o ÚLTIMO middleware
app.use(errorHandler);

// -----------------------------
//       INICIAR SERVIDOR
// -----------------------------
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 ADCON WEB FILING SYSTEM - SERVIDOR INICIADO');
    console.log('='.repeat(60));
    console.log(`📅 Data/Hora: ${new Date().toLocaleString('pt-BR')}`);
    console.log(`🌍 Ambiente: ${isDevelopment ? 'DESENVOLVIMENTO' : 'PRODUÇÃO'}`);
    console.log(`🔌 Porta: ${PORT}`);
    console.log(`🔐 JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Configurado' : '❌ NÃO CONFIGURADO'}`);
    console.log(`💾 MongoDB: ${MONGODB_URI.includes('127.0.0.1') ? '🏠 Local' : '☁️ Atlas'}`);
    
    console.log('\n📡 URLs de Acesso:');
    console.log(`   Local:  http://localhost:${PORT}/login.html`);
    console.log(`   Rede:   http://${localIpAddress}:${PORT}/login.html`);
    
    if (process.env.RENDER_EXTERNAL_URL) {
        console.log(`   Online: ${process.env.RENDER_EXTERNAL_URL}`);
    }
    
    console.log('\n🔒 Segurança:');
    console.log(`   ✅ Helmet ativado`);
    console.log(`   ✅ Rate limiting ativado (${securityConfig.rateLimit.max} req/${securityConfig.rateLimit.windowMs}ms)`);
    console.log(`   ✅ NoSQL Injection protection`);
    console.log(`   ✅ CORS configurado`);
    
    if (!isDevelopment) {
        console.log(`   ✅ HSTS ativado`);
        console.log(`   ✅ CSP ativado`);
    } else {
        console.log(`   ⚠️ HSTS desativado (desenvolvimento)`);
        console.log(`   ⚠️ CSP desativado (desenvolvimento)`);
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recebido, encerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor encerrado');
    (async () => {
      try {
        await mongoose.connection.close();
        console.log('✅ MongoDB desconectado');
      } catch (err) {
        console.error('❌ Erro ao desconectar MongoDB:', err);
      } finally {
        process.exit(0);
      }
    })();
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT recebido, encerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor encerrado');
    (async () => {
      try {
        await mongoose.connection.close();
        console.log('✅ MongoDB desconectado');
      } catch (err) {
        console.error('❌ Erro ao desconectar MongoDB:', err);
      } finally {
        process.exit(0);
      }
    })();
  });
});
