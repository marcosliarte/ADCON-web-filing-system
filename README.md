# ADCON Web Filing System

Sistema de gestão documental e administrativa para escritórios de contabilidade. Gerencia empresas clientes, documentos com controle de vencimento, mensalidades, funcionários, faturamento e notificações — tudo em uma interface web.

---

## Sumário

- [Requisitos](#requisitos)
- [Instalação e Configuração](#instalação-e-configuração)
- [Rodando Localmente](#rodando-localmente)
- [Variáveis de Ambiente (.env)](#variáveis-de-ambiente-env)
- [Perfis de Acesso](#perfis-de-acesso)
- [Funcionalidades](#funcionalidades)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [API — Endpoints](#api--endpoints)
- [Deploy em Produção (Render.com)](#deploy-em-produção-rendercom)
- [Backup e Restauração](#backup-e-restauração)
- [Segurança](#segurança)

---

## Requisitos

| Ferramenta | Versão mínima |
|---|---|
| [Node.js](https://nodejs.org) | 18.x ou superior |
| [MongoDB](https://www.mongodb.com/try/download/community) | 6.x ou superior |
| [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools) | 100.x (para backup/restore) |

---

## Instalação e Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/marcosliarte/ADCON-web-filing-system.git
cd ADCON-web-filing-system
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure o arquivo `.env`

Copie o arquivo de exemplo e preencha com seus valores:

```bash
cp .env.example .env
```

Edite o `.env` conforme a seção [Variáveis de Ambiente](#variáveis-de-ambiente-env) abaixo.

### 4. Certifique-se de que o MongoDB está rodando

- **Windows (local):** o serviço `MongoDB` deve estar iniciado (via Services ou MongoDB Compass).
- **Atlas (nuvem):** use a URI de conexão do painel do Atlas no campo `MONGODB_URI`.

---

## Rodando Localmente

### Opção A — Script automático (recomendado no Windows)

Dê duplo clique em **`start.bat`**. Ele irá:

1. Solicitar permissão de Administrador (UAC) — necessário para registrar o domínio no hosts.
2. Registrar `adcon` no arquivo `hosts` do Windows (apenas na primeira execução).
3. Encerrar qualquer processo que esteja usando a porta configurada.
4. Iniciar o servidor Node.js.

Após iniciar, acesse: `http://adcon:3000/login.html`

### Opção B — Manual

```bash
node server.js
```

Acesse: `http://localhost:3000/login.html`

---

## Variáveis de Ambiente (.env)

| Variável | Obrigatório | Descrição |
|---|---|---|
| `MONGODB_URI` | Sim | URI de conexão com o MongoDB |
| `JWT_SECRET` | Sim | Chave secreta para assinar tokens JWT (mínimo 64 chars) |
| `ENCRYPTION_KEY` | Sim | Chave AES-256 em hex (64 chars) para criptografar senhas de certificados digitais |
| `PORT` | Não | Porta do servidor (padrão: `3000`) |
| `MONGODUMP_PATH` | Não | Caminho do executável `mongodump` (para backups) |
| `MONGORESTORE_PATH` | Não | Caminho do executável `mongorestore` (para restauração) |
| `CORS_ORIGIN` | Não | Domínio(s) permitidos no CORS em produção (ex: `https://meudominio.com`) |
| `RATE_LIMIT_MAX_REQUESTS` | Não | Máximo de requisições por janela de tempo (padrão: `1000`) |
| `RATE_LIMIT_LOGIN_MAX` | Não | Máximo de tentativas de login (padrão: `5`) |
| `MAX_FILE_SIZE_MB` | Não | Limite de tamanho de upload em MB (padrão: `50`) |
| `JWT_EXPIRES_IN` | Não | Expiração do token JWT (padrão: `24h`) |
| `NODE_ENV` | Não | `production` ativa HSTS e CSP; ausente = modo desenvolvimento |

### Gerando chaves seguras

```bash
# JWT_SECRET (64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ENCRYPTION_KEY (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Atenção:** Nunca altere `ENCRYPTION_KEY` após cadastrar empresas. Os dados de certificados digitais existentes ficam ilegíveis.

---

## Perfis de Acesso

| Perfil | Descrição | Permissões principais |
|---|---|---|
| `admin` | Administrador do sistema | Acesso total: usuários, backups, logs, configurações, notificações |
| `gerente` | Gerente | Empresas, mensalidades, funcionários, relatórios |
| `funcionario` | Funcionário interno | Empresas, mensalidades (consulta) |
| `empresario` | Cliente/empresário | Acesso restrito às próprias informações |

O primeiro usuário deve ser criado via `POST /api/auth/register` e depois ter o role alterado para `admin` diretamente no banco ou via painel admin.

---

## Funcionalidades

### Gestão de Empresas
- Cadastro completo com CNPJ, sócios, filiais, endereço e natureza jurídica
- Consulta automática de CEP (ViaCEP) e CNAE (IBGE) ao digitar
- Upload de documentos por categoria: contrato social, alvarás, certidões, balanços, certificado digital, etc.
- Controle de validade por documento com alertas de vencimento
- Gerenciamento de filiais vinculadas à matriz

### Documentos com Vencimento
- Painel dedicado listando todos os documentos que vencem nos próximos 30 dias
- Alertas automáticos por notificação interna

### Mensalidades
- Geração de cobranças mensais por empresa com valor e data de vencimento configuráveis
- Status: **Não Gerada**, **Pendente**, **Pago**, **Atrasada**
- Filtros por mês/ano, status e busca por nome ou CNPJ
- Cards de resumo (total, pagas, pendentes, atrasadas, não geradas)
- Edição e exclusão de mensalidades

### Faturamento
- Registro do valor faturado por empresa por mês
- Histórico dos últimos N meses por empresa
- Geração de relatório de faturamento

### Funcionários e Folha de Pagamento
- Cadastro de funcionários com cargo, salário bruto, descontos fixos e chave Pix
- Registro mensal de pagamentos com adicionais e descontos variáveis
- Cálculo automático de salário líquido
- Histórico de pagamentos por funcionário
- Página "Meus Pagamentos" para o próprio funcionário consultar seus holerites

### Notificações
- Sistema de notificações internas por usuário
- Tipos: documento vencendo, documento vencido, pagamento recebido, mensagem admin, sistema
- Badge de contagem não lidas no cabeçalho (atualização a cada 60 segundos)
- Admin pode enviar notificações para usuários específicos ou por perfil

### Painel Administrativo
- Dashboard com status do sistema (banco de dados, memória, disco)
- Estatísticas: usuários por perfil, empresas por estado
- Documentos vencendo nos próximos 30 dias
- Logs de atividade com exportação CSV
- Gerenciamento de usuários: criar, editar, excluir, trocar role, resetar senha
- Impersonação de usuário (admin assume sessão de outro usuário)
- Lista de usuários online (ativos nos últimos 5 minutos)
- Exportação de usuários como CSV

### Backup e Restauração
- Criação de backup completo (dump do MongoDB + pasta `/uploads/`) em arquivo ZIP
- Lista de backups com tamanho e data
- Análise do conteúdo de um backup antes de restaurar
- Restauração com um clique
- Upload de backup externo para restauração
- Download do arquivo de backup

### Configuração da Empresa
- Dados do escritório (nome, CNPJ, endereço, contato)
- Upload de logotipo

### Conta e Segurança
- Alteração de senha com confirmação da senha atual
- Troca de e-mail com verificação por token
- Upload ou seleção de ícone de perfil

---

## Estrutura do Projeto

```
ADCON-web-filing-system/
├── server.js                  # Entry point do servidor Express
├── start.bat                  # Script de inicialização Windows (com elevação UAC)
├── render.yaml                # Configuração de deploy no Render.com
├── .env                       # Variáveis de ambiente (não versionar)
├── .env.example               # Modelo do .env
│
├── config/
│   ├── db.js                  # Conexão com MongoDB
│   └── security.js            # JWT, rate limit, CORS, uploads
│
├── middleware/
│   ├── auth.js                # Validação de JWT
│   ├── adminAuth.js           # Verificação de permissão admin/gerente
│   ├── errorHandler.js        # Handler global de erros
│   └── validators.js          # Regras de validação de entrada
│
├── models/
│   ├── model-usuario.js       # Usuários do sistema
│   ├── model-empresa.js       # Empresas clientes (com documentos embutidos)
│   ├── model-mensalidade.js   # Mensalidades por empresa/mês/ano
│   ├── model-funcionario.js   # Funcionários e histórico de pagamentos
│   ├── model-notificacao.js   # Notificações internas
│   ├── model-faturamento.js   # Faturamento mensal por empresa
│   ├── model-configuracao.js  # Configuração do escritório
│   ├── model-despesa.js       # Registro de despesas
│   └── model-receita.js       # Registro de receitas
│
├── routes/
│   ├── rota-auth.js           # Autenticação e gerenciamento de usuários
│   ├── rota-empresas.js       # CRUD de empresas e documentos
│   ├── rota-mensalidades.js   # Mensalidades
│   ├── rota-funcionarios.js   # Funcionários e pagamentos
│   ├── rota-faturamento.js    # Faturamento
│   ├── rota-relatorios.js     # Relatórios gerenciais
│   ├── rota-notificacoes.js   # Notificações
│   ├── rota-admin.js          # Dashboard admin e backups
│   ├── rota-configuracao.js   # Configuração da empresa
│   └── rota-pagamentos.js     # Histórico de pagamentos do funcionário
│
├── client/                    # Frontend estático
│   ├── login.html
│   ├── home.html
│   ├── empresas.html
│   ├── cadastrar-empresa.html
│   ├── detalhes-empresa.html
│   ├── documentos-vencendo.html
│   ├── mensalidades.html
│   ├── faturamento.html
│   ├── relatorios.html
│   ├── funcionarios-pagamentos.html
│   ├── meus-pagamentos.html
│   ├── notificacoes.html
│   ├── enviar-notificacoes.html
│   ├── user-management.html
│   ├── admin-dashboard.html
│   ├── configuracao-empresa.html
│   ├── configuracoes-conta.html
│   ├── logs.html
│   ├── shared.js              # Utilitários globais (auth, header, footer, toast)
│   ├── css/
│   └── js/pages/              # Scripts de cada página
│
├── uploads/                   # Arquivos enviados (documentos, logos, fotos)
└── _backups/                  # Arquivos de backup gerados
```

---

## API — Endpoints

Todas as rotas protegidas exigem o header:

```
x-auth-token: <seu_jwt_token>
```

O token é retornado no campo `token` da resposta do `POST /api/auth/login`.

### Autenticação (`/api/auth`)

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/auth/register` | Público | Registrar novo usuário |
| POST | `/api/auth/login` | Público | Login — retorna token JWT |
| POST | `/api/auth/logout` | Privado | Revogar token |
| GET | `/api/auth` | Privado | Dados do usuário logado |
| PUT | `/api/auth/change-password` | Privado | Alterar senha |
| PUT | `/api/auth/change-email` | Privado | Solicitar troca de e-mail |
| POST | `/api/auth/verify-email` | Privado | Confirmar troca de e-mail |
| POST | `/api/auth/profile-pic` | Privado | Upload de foto de perfil |
| PUT | `/api/auth/profile-icon` | Privado | Selecionar ícone de perfil |
| DELETE | `/api/auth/profile-pic` | Privado | Remover foto de perfil |

### Gerenciamento de Usuários (`/api/auth/admin`)

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/auth/admin/users` | Admin | Criar usuário |
| GET | `/api/auth/admin/users` | Admin | Listar usuários (paginado) |
| PUT | `/api/auth/admin/users/:id` | Admin | Editar nome/e-mail |
| PUT | `/api/auth/admin/users/:id/role` | Admin | Alterar perfil do usuário |
| DELETE | `/api/auth/admin/users/:id` | Admin | Excluir usuário |
| POST | `/api/auth/admin/users/:id/reset-password` | Admin | Resetar senha |
| POST | `/api/auth/admin/impersonate/:id` | Admin | Impersonar usuário |
| POST | `/api/auth/admin/stop-impersonating` | Admin | Parar impersonação |
| GET | `/api/auth/admin/online-users` | Admin | Usuários online (últimos 5 min) |
| GET | `/api/auth/admin/unlinked-users` | Admin | Usuários sem funcionário vinculado |
| GET | `/api/auth/admin/logs` | Admin | Logs de atividade |
| GET | `/api/auth/admin/logs.csv` | Admin | Exportar logs como CSV |
| GET | `/api/auth/admin/users.csv` | Admin | Exportar usuários como CSV |

### Empresas (`/api/empresas`)

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/empresa` | Privado | Cadastrar empresa |
| GET | `/api/empresas` | Privado | Listar empresas (busca + paginação) |
| GET | `/api/empresa/:id` | Privado | Detalhes da empresa |
| PUT | `/api/empresa/:id` | Privado | Atualizar empresa |
| DELETE | `/api/empresa/:id` | Privado | Excluir empresa |
| GET | `/api/empresas/cep/:cep` | Privado | Consultar CEP (proxy ViaCEP) |
| GET | `/api/empresas/cnae/:codigo` | Privado | Consultar CNAE (proxy IBGE) |
| GET | `/api/empresas/cnpj/:cnpj` | Privado | Buscar empresa por CNPJ |
| GET | `/api/empresas/documentos/vencendo` | Privado | Documentos vencendo em 30 dias |
| DELETE | `/api/empresas/:id/documentos/excluir` | Privado | Excluir documentos selecionados |

### Mensalidades (`/api/mensalidades`)

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/mensalidades/status-geral` | Admin/Gerente/Funcionário | Status de todas as empresas no mês/ano |
| POST | `/api/mensalidades` | Admin/Gerente/Funcionário | Criar mensalidade |
| PUT | `/api/mensalidades/:id` | Admin/Gerente/Funcionário | Atualizar (pagar, editar valor/vencimento) |
| DELETE | `/api/mensalidades/:id` | Admin/Gerente/Funcionário | Excluir mensalidade |

### Funcionários (`/api/funcionarios`)

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/funcionarios` | Admin/Gerente | Cadastrar funcionário |
| GET | `/api/funcionarios` | Admin/Gerente | Listar funcionários |
| GET | `/api/funcionarios/:id` | Admin/Gerente | Detalhes do funcionário |
| PUT | `/api/funcionarios/:id` | Admin/Gerente | Atualizar funcionário |
| DELETE | `/api/funcionarios/:id` | Admin/Gerente | Excluir funcionário |
| POST | `/api/funcionarios/:id/pagamentos` | Admin/Gerente | Registrar pagamento mensal |
| DELETE | `/api/funcionarios/:id/pagamentos/:pagamentoId` | Admin/Gerente | Excluir registro de pagamento |
| PUT | `/api/funcionarios/:id/vincular-usuario` | Admin | Vincular usuário ao funcionário |
| GET | `/api/pagamentos/meus-pagamentos` | Funcionário | Ver próprios pagamentos/holerites |

### Faturamento (`/api/faturamento`)

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/faturamento` | Privado | Salvar faturamento do mês |
| GET | `/api/faturamento/:empresaId` | Privado | Histórico completo de faturamento |
| GET | `/api/faturamento/:empresaId/ultimos/:n` | Privado | Últimos N meses |
| DELETE | `/api/faturamento/:empresaId/:ano/:mes` | Privado | Excluir faturamento do mês |

### Notificações (`/api/notificacoes`)

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/notificacoes` | Privado | Listar notificações do usuário |
| GET | `/api/notificacoes/count` | Privado | Contar notificações não lidas |
| PUT | `/api/notificacoes/:id/ler` | Privado | Marcar como lida |
| PUT | `/api/notificacoes/ler-todas` | Privado | Marcar todas como lidas |
| DELETE | `/api/notificacoes/:id` | Privado | Excluir notificação |
| DELETE | `/api/notificacoes/limpar/lidas` | Privado | Excluir todas as lidas |
| POST | `/api/notificacoes/admin/enviar` | Admin | Enviar para usuários específicos |
| POST | `/api/notificacoes/admin/enviar-role` | Admin | Enviar para todos de um perfil |

### Painel Admin (`/api/admin`)

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/admin/dashboard/status` | Admin | Status do sistema (DB, memória, disco) |
| GET | `/api/admin/dashboard/stats` | Admin | Estatísticas gerais |
| GET | `/api/admin/dashboard/expiring-docs` | Admin | Documentos vencendo em 30 dias |
| GET | `/api/admin/logs/recent` | Admin | 5 logs mais recentes |
| POST | `/api/admin/backup/create` | Admin | Criar backup completo |
| GET | `/api/admin/backup/list` | Admin | Listar backups disponíveis |
| GET | `/api/admin/backup/analyze/:filename` | Admin | Analisar conteúdo de um backup |
| POST | `/api/admin/backup/restore` | Admin | Restaurar backup |
| GET | `/api/admin/backup/download/:filename` | Admin | Baixar arquivo de backup |
| DELETE | `/api/admin/backup/delete/:filename` | Admin | Excluir backup |
| POST | `/api/admin/backup/upload` | Admin | Enviar backup externo e restaurar |

### Configuração e Relatórios

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/configuracao` | Privado | Dados do escritório |
| PUT | `/api/configuracao` | Admin | Atualizar dados do escritório |
| POST | `/api/configuracao/logotipo` | Admin | Upload de logotipo |
| GET | `/api/relatorios/geral` | Admin | Relatório geral |
| POST | `/api/relatorios/despesas` | Admin | Registrar despesa |
| POST | `/api/relatorios/receitas` | Admin | Registrar receita |

---

## Deploy em Produção (Render.com)

O projeto inclui `render.yaml` configurado. Para fazer deploy:

1. Crie uma conta em [render.com](https://render.com) e conecte o repositório GitHub.
2. O Render detecta o `render.yaml` automaticamente e configura o serviço.
3. No painel do Render, preencha manualmente as variáveis secretas (aba **Environment**):
   - `MONGODB_URI` — URI do MongoDB Atlas
   - `JWT_SECRET` — chave JWT gerada
   - `ENCRYPTION_KEY` — chave AES-256 gerada
   - `CORS_ORIGIN` — domínio do app (ex: `https://adcon.onrender.com`)
4. Clique em **Deploy**. O servidor sobe na porta `10000`.

> O servidor detecta automaticamente `NODE_ENV=production` e ativa HSTS e CSP.

---

## Backup e Restauração

### Criar backup

No **Painel Admin > Backups**, clique em **Criar Backup**. O sistema gera um `.zip` contendo:
- Dump do banco de dados MongoDB (comprimido)
- Pasta `/uploads/` com todos os arquivos enviados

### Restaurar backup

1. Na lista de backups, clique em **Restaurar** (ou faça upload de um `.zip` externo).
2. O sistema faz o drop das coleções existentes e reimporta os dados.
3. Os arquivos de uploads são restaurados automaticamente.

> **Atenção:** a restauração substitui todos os dados atuais. Sempre crie um backup antes de restaurar.

### Requisitos para backup

Os executáveis `mongodump` e `mongorestore` devem estar instalados. Configure os caminhos no `.env`:

```env
MONGODUMP_PATH="C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe"
MONGORESTORE_PATH="C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe"
```

---

## Segurança

- **JWT** com blacklist de tokens (logout real, token invalidado no servidor)
- **Helmet** com CSP e HSTS ativados em produção
- **Rate limiting**: 1000 req/15min geral, 5 tentativas de login por IP
- **express-mongo-sanitize**: proteção contra NoSQL Injection
- **bcryptjs**: senhas com salt de 10 rounds
- **AES-256**: senhas de certificados digitais criptografadas no banco de dados
- **CORS** configurável por domínio em produção
- **Logs de auditoria** com TTL de 90 dias para todas as ações críticas
