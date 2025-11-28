# 🔒 GUIA DE SEGURANÇA - ADCON WEB FILING SYSTEM

## ⚠️ AÇÕES URGENTES ANTES DE FAZER DEPLOY

### 1. 🚨 REMOVER CREDENCIAIS EXPOSTAS

**PROBLEMA CRÍTICO:** O arquivo `.env` atual contém credenciais reais do MongoDB Atlas em texto plano.

**AÇÃO IMEDIATA:**
```powershell
# 1. Gerar JWT_SECRET forte
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 2. Copiar .env.example para .env
Copy-Item .env.example .env

# 3. Editar .env e adicionar:
#    - JWT_SECRET gerado acima
#    - Credenciais reais do MongoDB (NUNCA fazer commit)
```

### 2. 🔑 TROCAR SENHA DO MONGODB ATLAS

Como a senha foi exposta publicamente, você DEVE:

1. Acessar [MongoDB Atlas](https://cloud.mongodb.com)
2. Database Access → Editar usuário `marcosliarteneves`
3. **Alterar a senha imediatamente**
4. Atualizar a senha APENAS no arquivo `.env` local (NUNCA commitar)

### 3. 📦 INSTALAR DEPENDÊNCIAS DE SEGURANÇA

```powershell
npm install helmet express-mongo-sanitize express-rate-limit cors dotenv --save
```

### 4. ✅ VERIFICAR .gitignore

Confirme que `.env` está no `.gitignore` (já está configurado).

---

## 🛡️ MELHORIAS DE SEGURANÇA IMPLEMENTADAS

### ✅ Proteção contra Command Injection
- Sanitização de paths em operações de backup/restore
- Validação de nomes de arquivos

### ✅ Rate Limiting
- Login: 5 tentativas por 15 minutos
- APIs gerais: 100 requisições por 15 minutos

### ✅ Validação de Uploads
- Whitelist de extensões permitidas
- Limite de tamanho configurável
- Verificação de MIME type

### ✅ Headers de Segurança (Helmet)
- Content Security Policy
- X-Frame-Options
- HSTS
- X-Content-Type-Options

### ✅ Sanitização de Inputs
- Proteção contra NoSQL Injection
- Validação com express-validator

---

## 📋 CHECKLIST DE DEPLOY

- [ ] `.env` contém credenciais reais (não .env.example)
- [ ] JWT_SECRET com 64+ caracteres aleatórios
- [ ] Senha do MongoDB Atlas foi alterada
- [ ] `.env` NÃO foi commitado no Git
- [ ] Dependências de segurança instaladas
- [ ] Servidor testado localmente
- [ ] CORS configurado com domínios permitidos
- [ ] Logs não expõem dados sensíveis

---

## 🔒 BOAS PRÁTICAS PARA A EQUIPE

1. **NUNCA** commitar o arquivo `.env`
2. **SEMPRE** usar `.env.example` como referência
3. **TROCAR** JWT_SECRET a cada 90 dias
4. **REVISAR** logs regularmente
5. **ATUALIZAR** dependências mensalmente: `npm audit fix`
6. **FAZER BACKUP** antes de atualizar produção
7. **TESTAR** em ambiente local antes de deploy

---

## 🆘 EM CASO DE VAZAMENTO DE CREDENCIAIS

1. **IMEDIATAMENTE** trocar todas as senhas
2. **REVOGAR** tokens JWT antigos
3. **REVISAR** logs de acesso suspeito
4. **REMOVER** commits com credenciais do histórico Git
5. **NOTIFICAR** a equipe

---

## 📞 SUPORTE

Para dúvidas sobre segurança, consulte:
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [MongoDB Security Checklist](https://www.mongodb.com/docs/manual/administration/security-checklist/)
