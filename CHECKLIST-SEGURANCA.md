# ✅ CHECKLIST DE SEGURANÇA - ADCON WEB FILING SYSTEM

## 🚨 URGENTE - FAZER IMEDIATAMENTE

- [ ] **Executar script de instalação**
  ```powershell
  .\instalar-seguranca.ps1
  ```

- [ ] **Trocar senha do MongoDB Atlas**
  - A senha atual foi exposta: `Rokku281093!`
  - Acessar: https://cloud.mongodb.com
  - Database Access → Editar usuário `marcosliarteneves`
  - Gerar senha forte e salvar em local seguro

- [ ] **Configurar JWT_SECRET no .env**
  ```powershell
  # Gerar:
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  
  # Adicionar ao .env:
  JWT_SECRET=<valor_gerado_acima>
  ```

- [ ] **Atualizar MONGODB_URI no .env**
  - Substituir senha antiga pela nova
  - Verificar que está usando a URI correta (local ou Atlas)

- [ ] **Verificar que .env NÃO está no Git**
  ```powershell
  git status
  # .env NÃO deve aparecer como "modified" ou "untracked"
  ```

---

## 🔧 CONFIGURAÇÃO INICIAL

- [ ] Instalar dependências de segurança
  ```powershell
  npm install helmet express-mongo-sanitize express-rate-limit cors dotenv --save
  ```

- [ ] Copiar `.env.example` para `.env` (se não existe)
  ```powershell
  Copy-Item .env.example .env
  ```

- [ ] Configurar variáveis no `.env`:
  - [ ] `JWT_SECRET` (64+ caracteres)
  - [ ] `JWT_EXPIRES_IN` (padrão: 24h)
  - [ ] `MONGODB_URI` (local ou Atlas com nova senha)
  - [ ] `PORT` (padrão: 3000)
  - [ ] `MONGODUMP_PATH` (se no Windows)
  - [ ] `MONGORESTORE_PATH` (se no Windows)
  - [ ] `MAX_FILE_SIZE_MB` (padrão: 50)

- [ ] Testar conexão local
  ```powershell
  node server.js
  ```

---

## 🧪 TESTES DE SEGURANÇA

### Teste 1: Validação de JWT_SECRET
- [ ] Tentar iniciar servidor sem JWT_SECRET
  - Deve parar com erro claro

### Teste 2: Rate Limiting
- [ ] Fazer 110 requisições rápidas para `/api/empresas`
  - A partir da 101ª deve retornar HTTP 429

### Teste 3: Upload de Arquivo Inválido
- [ ] Tentar fazer upload de arquivo .exe ou .sh
  - Deve ser rejeitado com erro claro

### Teste 4: Upload de Arquivo Grande
- [ ] Tentar upload de arquivo > 50MB
  - Deve ser rejeitado

### Teste 5: NoSQL Injection
- [ ] Tentar login com payload:
  ```json
  {
    "email": {"$ne": null},
    "senha": {"$ne": null}
  }
  ```
  - Deve falhar (sanitizado automaticamente)

### Teste 6: Path Traversal em Upload
- [ ] Tentar upload com filename: `../../etc/passwd`
  - Deve ser sanitizado automaticamente

### Teste 7: Command Injection (após atualizar rotas)
- [ ] Criar backup com nome: `test; rm -rf /`
  - Não deve executar comando adicional

### Teste 8: Erros não expõem stack trace
- [ ] Gerar erro proposital (ex: ID inválido)
  - Resposta não deve conter stack trace (exceto em dev)

---

## 📝 ATUALIZAÇÕES DE CÓDIGO PENDENTES

### Prioridade ALTA

- [ ] **routes/rota-admin.js** - Substituir exec() por spawn()
  ```javascript
  // Trocar:
  exec(`"${mongodumpExecutable}" ...`)
  
  // Por:
  const { executeMongodump } = require('../utils/mongodbCommands');
  await executeMongodump({ uri, outputPath });
  ```

- [ ] **routes/rota-auth.js** - Usar validadores centralizados
  ```javascript
  const { authValidators } = require('../middleware/validators');
  router.post('/register', authValidators.register, async (req, res) => {
    // ...
  });
  ```

- [ ] **routes/rota-auth.js** - Usar upload seguro
  ```javascript
  const { uploadPresets } = require('../utils/fileUploadSecurity');
  router.post('/profile-pic', auth, uploadPresets.profilePic.single('profilePic'), ...);
  ```

### Prioridade MÉDIA

- [ ] **routes/rota-empresas.js** - Usar validadores
- [ ] **routes/rota-funcionarios.js** - Usar asyncHandler
- [ ] **routes/rota-mensalidades.js** - Validar inputs
- [ ] **routes/rota-pagamentos.js** - Usar validateObjectId

### Prioridade BAIXA

- [ ] Todas as rotas - Substituir try-catch por asyncHandler
- [ ] Todas as rotas - Padronizar mensagens de erro
- [ ] Adicionar testes automatizados

---

## 🔍 AUDITORIA PERIÓDICA

### Semanal
- [ ] Executar `npm audit`
- [ ] Revisar logs de rate limiting
- [ ] Verificar backups estão sendo criados corretamente

### Mensal
- [ ] Atualizar dependências
  ```powershell
  npm update
  npm audit fix
  ```
- [ ] Revisar logs de erros
- [ ] Verificar uso de disco (backups)

### Trimestral
- [ ] Trocar JWT_SECRET
- [ ] Revisar permissões de usuários
- [ ] Testar restore de backup

---

## 📊 MÉTRICAS DE SEGURANÇA

Após implementar todas as melhorias, você terá:

| Métrica | Valor |
|---------|-------|
| Vulnerabilidades conhecidas | 0 |
| Command Injection | ✅ Protegido |
| NoSQL Injection | ✅ Protegido |
| XSS | ✅ Protegido (Helmet) |
| CSRF | ⚠️ Considerar tokens |
| Rate Limiting | ✅ Ativo |
| Validação de Inputs | ✅ Completa |
| Erros seguros | ✅ Sim |

---

## 🆘 TROUBLESHOOTING

### Erro: "JWT_SECRET não configurado"
- Verifique que `.env` existe
- Verifique que `JWT_SECRET` está no `.env`
- Verifique que tem 32+ caracteres

### Erro: "MongoDB connection failed"
- Verifique que MongoDB está rodando (se local)
- Verifique credenciais do Atlas (se remoto)
- Verifique que trocou a senha exposta

### Erro: "Cannot find module 'helmet'"
- Execute: `npm install`
- Se persistir: `npm install helmet --save`

### Upload não funciona
- Verifique que pasta `uploads/` existe
- Verifique permissões da pasta
- Verifique tamanho do arquivo

---

## 📞 SUPORTE

Para dúvidas ou problemas:

1. Leia **SEGURANÇA.md** - Guia completo
2. Leia **REFATORACAO-RESUMO.md** - Detalhes técnicos
3. Execute `npm audit` para vulnerabilidades
4. Revise logs do servidor

---

**Última atualização:** 2025
**Versão do checklist:** 1.0
