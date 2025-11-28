# 📁 ADCON Web Filing System

Sistema de gerenciamento de arquivos e documentos para o escritório ADCON.

## 🚀 Início Rápido

### 1. Instalação

```powershell
# Clonar repositório
git clone <url-do-repositorio>
cd ADCON-web-filing-system

# Instalar dependências
npm install

# Instalar melhorias de segurança
.\instalar-seguranca.ps1
```

### 2. Configuração

```powershell
# Copiar arquivo de configuração
Copy-Item .env.example .env

# Editar .env e configurar:
# - JWT_SECRET (gerar com o comando abaixo)
# - MONGODB_URI (suas credenciais)
notepad .env
```

**Gerar JWT_SECRET forte:**
```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Executar

```powershell
# Iniciar servidor
node server.js

# Ou usar nodemon para desenvolvimento
npm install -g nodemon
nodemon server.js
```

Acesse: `http://localhost:3000/login.html`

---

## 📋 Funcionalidades

- ✅ **Gestão de Empresas** - Cadastro, edição e exclusão
- ✅ **Documentos** - Upload e organização por tipo
- ✅ **Vencimentos** - Alertas de documentos vencendo
- ✅ **Usuários** - Controle de acesso (admin, gerente, funcionário)
- ✅ **Mensalidades** - Controle de pagamentos
- ✅ **Backup/Restore** - Sistema automatizado
- ✅ **Relatórios** - Dashboards e análises
- ✅ **Notificações** - Sistema de alertas

---

## 🔒 Segurança

Este sistema implementa as melhores práticas de segurança:

- 🛡️ **Proteção contra Command Injection** (spawn ao invés de exec)
- 🛡️ **Proteção contra NoSQL Injection** (express-mongo-sanitize)
- 🛡️ **Proteção contra XSS** (Helmet + CSP)
- 🛡️ **Rate Limiting** (proteção contra força bruta)
- 🛡️ **Validação rigorosa de uploads** (MIME type + extensão)
- 🛡️ **JWT com expiração** (tokens seguros)
- 🛡️ **Tratamento seguro de erros** (sem stack traces em produção)

### 🚨 Importante

⚠️ **NUNCA** commite o arquivo `.env` para o Git!  
⚠️ **SEMPRE** use senhas fortes (64+ caracteres para JWT_SECRET)  
⚠️ **LEIA** o arquivo `SEGURANÇA.md` antes de fazer deploy

📖 **Documentação de Segurança:**
- [SEGURANÇA.md](SEGURANÇA.md) - Guia completo de segurança
- [REFATORACAO-RESUMO.md](REFATORACAO-RESUMO.md) - Detalhes técnicos
- [CHECKLIST-SEGURANCA.md](CHECKLIST-SEGURANCA.md) - Checklist de verificação

---

## 📦 Dependências Principais

```json
{
  "express": "^4.x",
  "mongoose": "^8.x",
  "bcryptjs": "^2.x",
  "jsonwebtoken": "^9.x",
  "helmet": "^7.x",
  "express-rate-limit": "^7.x",
  "express-mongo-sanitize": "^2.x",
  "multer": "^1.x",
  "cors": "^2.x"
}
```

---

## 🗂️ Estrutura do Projeto

```
ADCON-web-filing-system/
├── client/              # Frontend (HTML, CSS, JS)
├── routes/              # Rotas da API
├── models/              # Modelos do MongoDB
├── middleware/          # Middlewares (auth, validação, erros)
├── config/              # Configurações (db, segurança)
├── utils/               # Utilitários (uploads, comandos MongoDB)
├── uploads/             # Arquivos enviados pelos usuários
├── _backups/            # Backups do sistema
├── .env.example         # Template de configuração
├── server.js            # Ponto de entrada
└── package.json         # Dependências
```

---

## 🔧 Configuração Avançada

### Variáveis de Ambiente (.env)

```bash
# MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/system_adcon  # ou MongoDB Atlas

# JWT
JWT_SECRET=<64_caracteres_aleatorios>
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Servidor
PORT=3000
NODE_ENV=development  # ou production

# MongoDB Tools (Windows)
MONGODUMP_PATH=C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe
MONGORESTORE_PATH=C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000      # 15 minutos
RATE_LIMIT_MAX_REQUESTS=100       # 100 requisições
RATE_LIMIT_LOGIN_MAX=5            # 5 tentativas de login

# Uploads
MAX_FILE_SIZE_MB=50               # Tamanho máximo de arquivo
```

### CORS (Produção)

Em produção, configure domínios permitidos no `.env`:

```bash
CORS_ORIGIN=https://seu-dominio.com,https://www.seu-dominio.com
```

---

## 🧪 Testes

```powershell
# Executar auditoriacomo de segurança
npm audit

# Corrigir vulnerabilidades automaticamente
npm audit fix

# Testar servidor
node server.js
# Deve exibir:
# ✅ MongoDB conectado
# ✅ Helmet ativado
# ✅ Rate limiting ativado
```

---

## 📖 Uso da API

### Autenticação

```javascript
// Login
POST /api/auth/login
Body: { "email": "user@example.com", "senha": "senha123" }
Response: { "token": "jwt_token_here" }

// Usar token nas requisições
Headers: { "x-auth-token": "jwt_token_here" }
```

### Empresas

```javascript
// Listar empresas
GET /api/empresas
Headers: { "x-auth-token": "token" }

// Criar empresa
POST /api/empresas
Headers: { "x-auth-token": "token" }
Body: { "nome": "Empresa XYZ", "cnpj": "00.000.000/0000-00", ... }
```

### Upload de Arquivos

```javascript
// Upload de foto de perfil
POST /api/auth/profile-pic
Headers: { "x-auth-token": "token" }
Body: FormData com campo "profilePic"
```

📚 **Documentação completa da API:** (em desenvolvimento)

---

## 🔄 Backup e Restore

### Criar Backup

```javascript
POST /api/admin/backup/create
Headers: { "x-auth-token": "admin_token" }
```

Backup inclui:
- ✅ Dados do MongoDB (compactado .gz)
- ✅ Arquivos da pasta `uploads/`
- ✅ Gerado em `_backups/backup-YYYYMMDD-HHMMSS.zip`

### Restaurar Backup

```javascript
POST /api/admin/backup/upload
Headers: { "x-auth-token": "admin_token" }
Body: FormData com arquivo .zip
```

⚠️ **ATENÇÃO:** Restore sobrescreve dados existentes!

---

## 🚀 Deploy

### Render / Heroku

1. Configure variáveis de ambiente no painel
2. Adicione MongoDB Atlas URI
3. Configure `NODE_ENV=production`
4. Deploy!

### VPS (Linux)

```bash
# Instalar Node.js e MongoDB
sudo apt update
sudo apt install nodejs npm mongodb

# Clonar e configurar
git clone <repo>
cd ADCON-web-filing-system
npm install
cp .env.example .env
nano .env  # Configurar

# Usar PM2 para manter rodando
npm install -g pm2
pm2 start server.js --name adcon
pm2 startup
pm2 save
```

---

## 🐛 Troubleshooting

### "JWT_SECRET não configurado"
- Verifique que `.env` existe e tem `JWT_SECRET` com 32+ caracteres

### "MongoDB connection failed"
- MongoDB local: Verifique se está rodando (`mongod`)
- MongoDB Atlas: Verifique credenciais e whitelist de IP

### "Arquivo muito grande"
- Aumente `MAX_FILE_SIZE_MB` no `.env`

### Uploads não funcionam
- Verifique permissões da pasta `uploads/`
- Windows: `icacls uploads /grant Everyone:F`
- Linux: `chmod -R 777 uploads/`

---

## 📞 Suporte

- 📧 Email: suporte@adcon.com.br
- 📖 Wiki: (em desenvolvimento)
- 🐛 Issues: Use o GitHub Issues

---

## 📄 Licença

Propriedade de ADCON - Todos os direitos reservados

---

## 👥 Contribuidores

- **Marcos Liarte Neves** - Desenvolvimento inicial

---

## 🔖 Versão

**v2.0.0** - Refatoração de segurança completa (2025)

### Changelog

#### v2.0.0 (2025)
- ✅ Refatoração completa de segurança
- ✅ Proteção contra command injection (spawn)
- ✅ Proteção contra NoSQL injection
- ✅ Rate limiting global
- ✅ Validação rigorosa de uploads
- ✅ Tratamento centralizado de erros
- ✅ Helmet com CSP e HSTS
- ✅ Documentação de segurança

#### v1.0.0
- ✅ Sistema base funcional
- ✅ CRUD de empresas e documentos
- ✅ Sistema de backup/restore
- ✅ Autenticação JWT
