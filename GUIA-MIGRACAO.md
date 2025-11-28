# 🔄 GUIA DE MIGRAÇÃO PARA V2.0 (SEGURANÇA)

## ⚠️ LEIA ANTES DE ATUALIZAR

Este guia ajuda a migrar do sistema antigo (v1.x) para a versão v2.0 com melhorias de segurança.

---

## 🚨 PRÉ-REQUISITOS

- [ ] **Fazer backup completo** antes de iniciar
- [ ] Node.js 14+ instalado
- [ ] MongoDB local ou Atlas configurado
- [ ] Acesso ao código-fonte
- [ ] 15-30 minutos disponíveis

---

## 📋 PASSO A PASSO

### PASSO 1: Backup do Sistema Atual

```powershell
# 1. Criar backup via interface web
# Acesse: http://localhost:3000/admin-dashboard.html
# Clique em "Criar Backup"
# Salve o arquivo .zip em local seguro

# 2. OU fazer backup manual
cd C:\Users\Marcos\Documents\2 - Estudos\0 - Programação\ADCON-web-filing-system
Copy-Item -Recurse . ..\ADCON-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')

# 3. Backup do MongoDB (se local)
mongodump --uri="mongodb://127.0.0.1:27017/system_adcon" --archive="backup-db-$(Get-Date -Format 'yyyyMMdd-HHmmss').gz" --gzip
```

✅ **Checkpoint:** Você tem pelo menos 1 backup completo em local seguro?

---

### PASSO 2: Instalar Novas Dependências

```powershell
# Navegar até o diretório do projeto
cd C:\Users\Marcos\Documents\2 - Estudos\0 - Programação\ADCON-web-filing-system

# Instalar dependências de segurança
npm install helmet express-mongo-sanitize express-rate-limit cors dotenv --save

# Verificar instalação
npm list helmet express-mongo-sanitize express-rate-limit
```

✅ **Checkpoint:** Todas as dependências instaladas sem erros?

---

### PASSO 3: Configurar Variáveis de Ambiente

```powershell
# 1. Gerar JWT_SECRET forte
$jwtSecret = node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
Write-Host "Seu JWT_SECRET: $jwtSecret"

# 2. Copiar .env.example para .env (se ainda não existe)
if (!(Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host ".env criado"
}

# 3. Editar .env
notepad .env
```

**No arquivo .env, configure:**

```bash
# JWT - USE O VALOR GERADO ACIMA!
JWT_SECRET=<cole_o_valor_gerado>
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# MongoDB - ESCOLHA UMA OPÇÃO:

# OPÇÃO 1: Local (desenvolvimento)
MONGODB_URI=mongodb://127.0.0.1:27017/system_adcon

# OPÇÃO 2: Atlas (produção) - TROCAR SENHA!
# MONGODB_URI=mongodb+srv://SEU_USUARIO:NOVA_SENHA_AQUI@SEU_CLUSTER.mongodb.net/?appName=adcon

# Servidor
PORT=3000
NODE_ENV=development

# MongoDB Tools (Windows - ajustar caminho se diferente)
MONGODUMP_PATH=C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe
MONGORESTORE_PATH=C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe

# Segurança
MAX_FILE_SIZE_MB=50
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_LOGIN_MAX=5
```

✅ **Checkpoint:** Arquivo .env configurado corretamente?

---

### PASSO 4: Trocar Senha do MongoDB Atlas (SE USAR ATLAS)

🚨 **CRÍTICO:** A senha antiga foi exposta no código. DEVE SER ALTERADA!

```
1. Acesse: https://cloud.mongodb.com
2. Database Access → Usuário "marcosliarteneves"
3. Clique em "Edit"
4. Clique em "Edit Password"
5. Gere uma senha forte (ou use o gerador do Atlas)
6. Salve a senha em um gerenciador seguro
7. Atualize MONGODB_URI no .env com a nova senha
```

✅ **Checkpoint:** Senha do Atlas alterada e .env atualizado?

---

### PASSO 5: Testar Servidor

```powershell
# Iniciar servidor
node server.js

# Você deve ver:
# ✅ JWT_SECRET: Configurado
# ✅ MongoDB conectado [LOCAL ou REMOTO]
# ✅ Helmet ativado
# ✅ Rate limiting ativado
# ✅ NoSQL Injection protection
```

**Se houver erros:**

| Erro | Solução |
|------|---------|
| "JWT_SECRET não configurado" | Verifique .env tem JWT_SECRET com 32+ chars |
| "MongoDB connection failed" | Verifique MONGODB_URI, senha correta, MongoDB rodando |
| "Cannot find module 'helmet'" | Execute `npm install` novamente |

✅ **Checkpoint:** Servidor iniciou sem erros?

---

### PASSO 6: Testar Funcionalidades Básicas

1. **Abrir navegador:** `http://localhost:3000/login.html`

2. **Testar login:**
   - Email: seu email de admin
   - Senha: sua senha
   - Deve logar com sucesso

3. **Testar listagem de empresas:**
   - Clicar em "Empresas"
   - Deve mostrar empresas cadastradas

4. **Testar upload:**
   - Editar uma empresa
   - Fazer upload de um documento
   - Deve funcionar normalmente

5. **Testar backup:**
   - Ir em Admin Dashboard
   - Clicar "Criar Backup"
   - Deve gerar backup com sucesso

✅ **Checkpoint:** Todas as funcionalidades básicas funcionam?

---

### PASSO 7: Verificar Segurança

```powershell
# 1. Auditar vulnerabilidades
npm audit

# Se houver vulnerabilidades CRÍTICAS ou ALTAS:
npm audit fix

# 2. Verificar .env não está no Git
git status
# .env NÃO DEVE aparecer

# 3. Verificar JWT_SECRET é forte
# Abrir .env e contar caracteres do JWT_SECRET
# Deve ter pelo menos 64 caracteres
```

✅ **Checkpoint:** Sem vulnerabilidades críticas e .env protegido?

---

### PASSO 8: Documentação

```powershell
# Ler documentos importantes:
notepad SEGURANÇA.md              # Guia de segurança
notepad REFATORACAO-RESUMO.md     # Detalhes técnicos
notepad CHECKLIST-SEGURANCA.md    # Checklist completo
```

✅ **Checkpoint:** Você leu e entendeu os documentos de segurança?

---

## 🎉 MIGRAÇÃO CONCLUÍDA!

Parabéns! Você migrou com sucesso para a versão v2.0 com melhorias de segurança.

---

## 🔄 PRÓXIMOS PASSOS (OPCIONAL)

Para aproveitar 100% das melhorias, considere:

1. **Atualizar routes/rota-admin.js**
   - Substituir `exec()` por `executeMongodump()` e `executeMongorestore()`
   - Usar funções do `utils/mongodbCommands.js`

2. **Atualizar routes/rota-auth.js**
   - Usar `authValidators` do `middleware/validators.js`
   - Usar `uploadPresets.profilePic` do `utils/fileUploadSecurity.js`

3. **Atualizar outras rotas**
   - Aplicar `asyncHandler()` para eliminar try-catch
   - Usar `validateObjectId()` em rotas com `:id`

4. **Deploy em produção**
   - Configurar `NODE_ENV=production`
   - Usar MongoDB Atlas
   - Configurar CORS com domínio específico

---

## 🐛 PROBLEMAS COMUNS

### "Não consigo fazer login após migração"

**Causa:** Tokens antigos podem ser inválidos com novo JWT_SECRET

**Solução:**
1. Limpar localStorage do navegador (F12 → Application → Local Storage → Clear)
2. Fazer login novamente

### "Upload de arquivos não funciona"

**Causa:** Permissões da pasta uploads/

**Solução (Windows):**
```powershell
icacls uploads /grant Everyone:F /T
```

**Solução (Linux):**
```bash
chmod -R 755 uploads
chown -R $USER:$USER uploads
```

### "Rate limit muito restritivo"

**Causa:** Configuração padrão é conservadora

**Solução:** Ajustar no .env:
```bash
RATE_LIMIT_MAX_REQUESTS=200  # Aumentar limite
RATE_LIMIT_LOGIN_MAX=10       # Mais tentativas de login
```

### "Backup não está funcionando"

**Causa:** Caminho do mongodump incorreto

**Solução:** Verificar no .env:
```bash
# Windows - ajustar caminho se necessário
MONGODUMP_PATH=C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe

# Ou usar PATH do sistema
MONGODUMP_PATH=mongodump
```

---

## ↩️ ROLLBACK (SE NECESSÁRIO)

Se algo der errado e precisar voltar à versão antiga:

```powershell
# 1. Parar servidor (Ctrl+C)

# 2. Restaurar backup
# Opção A: Via interface (se servidor funcionar)
# Acesse admin dashboard e faça upload do backup

# Opção B: Manual
cd C:\Users\Marcos\Documents\2 - Estudos\0 - Programação
Remove-Item -Recurse ADCON-web-filing-system
Copy-Item -Recurse ADCON-backup-20250101-120000 ADCON-web-filing-system

# 3. Restaurar banco de dados
mongorestore --uri="mongodb://127.0.0.1:27017/system_adcon" --archive="backup-db-20250101-120000.gz" --gzip --drop

# 4. Reiniciar servidor
cd ADCON-web-filing-system
node server.js
```

---

## 📞 SUPORTE

Se tiver problemas durante a migração:

1. ✅ Consulte [TROUBLESHOOTING](#-problemas-comuns) acima
2. ✅ Leia `CHECKLIST-SEGURANCA.md`
3. ✅ Verifique logs do servidor para erros específicos
4. ✅ Execute `npm audit` para verificar dependências

---

## ✅ CHECKLIST FINAL

Antes de considerar a migração completa, verifique:

- [ ] Backup completo salvo em local seguro
- [ ] Todas as dependências instaladas (`npm list`)
- [ ] Arquivo `.env` configurado corretamente
- [ ] JWT_SECRET forte (64+ caracteres)
- [ ] Senha do MongoDB Atlas alterada (se usar Atlas)
- [ ] Servidor inicia sem erros
- [ ] Login funciona
- [ ] Listagem de empresas funciona
- [ ] Upload de arquivos funciona
- [ ] Backup/restore funciona
- [ ] `npm audit` sem vulnerabilidades críticas
- [ ] `.env` não está no Git (`git status`)
- [ ] Documentação de segurança lida

---

**Última atualização:** 2025
**Versão do guia:** 1.0
