# 🚀 ADCON - Guia Rápido

## ⚡ INÍCIO RÁPIDO

**Dê duplo clique em:**
- `iniciar-local.bat` → Para testar localmente (MongoDB do seu PC)
- `iniciar-producao.bat` → Para trabalhar com dados reais (MongoDB Atlas)

---

## 🔧 Como Funciona

### 🌐 **PRODUÇÃO** (Configuração Atual - RECOMENDADO):
- **Servidor**: Roda no seu PC (192.168.1.10:3000)
- **Banco de Dados**: MongoDB Atlas (mesmos dados do Render)
- **Benefícios**:
  - ✅ Acessa dados reais de qualquer lugar da rede
  - ✅ Celular, tablet, outros PCs podem usar
  - ✅ Não precisa manter o Render ligado
  - ✅ Sem custos de hospedagem enquanto testa

### 💻 **LOCAL** (Apenas para testes isolados):
- **Servidor**: Roda no seu PC (192.168.1.10:3000)
- **Banco de Dados**: MongoDB instalado no PC
- **Uso**: Apenas para testes que não devem afetar produção

---

## 🔄 Como Alternar

### Para usar **PRODUÇÃO** (MongoDB Atlas - dados reais):
1. Abra o arquivo `.env`
2. Linha de PRODUÇÃO **SEM #**:
   ```
   MONGODB_URI=mongodb+srv://...
   ```
3. Linha de LOCAL **COM #**:
   ```
   # MONGODB_URI=mongodb://127.0.0.1:27017/system_adcon
   ```
4. Reinicie: `Ctrl+C` e `npm start`
5. Verá: `MongoDB conectado (produção)...`

### Para usar **LOCAL** (MongoDB do PC - testes):
1. Abra o arquivo `.env`
2. Linha de LOCAL **SEM #**:
   ```
   MONGODB_URI=mongodb://127.0.0.1:27017/system_adcon
   ```
3. Linha de PRODUÇÃO **COM #**:
   ```
   # MONGODB_URI=mongodb+srv://...
   ```
4. Reinicie: `Ctrl+C` e `npm start`
5. Verá: `MongoDB conectado (local)...`

---

## 🔍 Como Verificar qual Banco Está Conectado

1. Acesse: http://192.168.1.10:3000/admin-dashboard.html
2. Clique no botão **"🔍 Diagnóstico DB"**
3. Verifique o campo **URI** para confirmar qual banco está ativo

---

## 📦 Como Restaurar Backup de Produção no Local

⚠️ **ATENÇÃO**: Certifique-se de estar conectado ao banco correto antes de restaurar!

1. Conecte-se ao banco desejado (ver instruções acima)
2. Acesse o painel de admin
3. Use o botão **"🔍 Inspecionar"** para verificar o conteúdo do backup
4. Confirme que o backup tem dados (deve mostrar "COM DADOS")
5. Clique em **"Restaurar"**

---

## 💡 Dicas Importantes

- **Backup de Produção**: Sempre contém os dados reais dos clientes
- **Backup Local**: Contém apenas dados de teste do seu PC
- **Antes de restaurar**: SEMPRE inspecione o backup primeiro!
- **Endereços de acesso**:
  - Local: http://localhost:3000
  - Rede: http://192.168.1.10:3000

---

## 🆘 Problemas Comuns

### "MongoDB conectado (local)" mas eu quero produção
- Edite o `.env` e troque qual linha tem o `#` na frente

### Backup não restaura os dados
- Verifique se está conectado ao banco correto
- Use o botão "🔍 Diagnóstico DB" para confirmar
- Inspecione o backup antes de restaurar

### Erro ao conectar no MongoDB Atlas
- Verifique sua conexão com a internet
- Confirme se as credenciais estão corretas no `.env`
