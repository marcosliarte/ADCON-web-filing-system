# Sistema de Backup e Restauração

## Visão Geral

O sistema possui funcionalidades completas de backup e restauração que permitem:
- Criar backups automáticos do banco de dados e arquivos
- Restaurar backups existentes
- Fazer upload de backups externos
- Gerenciar múltiplos pontos de restauração

---

## Componentes do Sistema

### 1. Estrutura de Backup

Um backup completo inclui:
- **Banco de dados MongoDB** (arquivo `.gz` compactado)
- **Pasta uploads/** (todos os arquivos enviados pelos usuários)

Formato final: `backup-completo-YYYY-MM-DDTHH-MM-SS.zip`

### 2. Pastas Utilizadas

```
ADCON-web-filing-system/
├── _backups/              # Backups criados pelo sistema
├── _temp_uploads/         # Upload temporário de backups externos
├── uploads/               # Arquivos do sistema atual
└── uploads_old_*/         # Backups automáticos da pasta uploads
```

---

## Funcionalidades

### 1. Criar Backup

**Como usar:**
1. Acesse **Central do Administrador** (admin-dashboard.html)
2. Clique em "Criar Backup Agora"
3. Aguarde o processo (pode levar alguns minutos)

**O que acontece:**
- `mongodump` exporta todo o banco MongoDB para arquivo `.gz`
- Sistema cria arquivo ZIP contendo:
  - Dump do banco de dados
  - Cópia completa da pasta `uploads/`
- Arquivo salvo em `_backups/`

**Requisitos:**
- MongoDB Tools instalado (mongodump/mongorestore)
- Variável de ambiente `MONGODUMP_PATH` configurada no `.env`
- Permissões de escrita nas pastas do sistema

---

### 2. Restaurar Backup Existente

**Como usar:**
1. Na lista "Backups Disponíveis", localize o backup desejado
2. Clique em "Restaurar"
3. Digite **RESTAURAR** para confirmar
4. Aguarde o processo

**⚠️ ATENÇÃO:**
- **Substitui TODO o banco de dados atual**
- Arquivos de upload são **mesclados** (preserva arquivos atuais)
- Processo é **irreversível** para o banco de dados

**O que acontece:**
1. Extrai o arquivo ZIP para pasta temporária
2. Localiza o dump `.gz` do banco
3. Executa `mongorestore --drop` (apaga e restaura o banco)
4. Mescla arquivos da pasta `uploads/` do backup com os atuais
5. Remove arquivos temporários

---

### 3. Carregar e Restaurar Backup Externo

**Como usar:**
1. Clique em "Escolher arquivo" na seção de upload
2. Selecione um arquivo `.zip` de backup
3. Clique em "Carregar e Restaurar"
4. Digite **RESTAURAR** para confirmar
5. Aguarde o processo (pode ser longo dependendo do tamanho)

**Melhorias implementadas:**
- ✅ Logs detalhados no console do servidor
- ✅ Feedback visual com tamanho do arquivo e progresso
- ✅ Backup automático da pasta `uploads/` atual antes de substituir
- ✅ Tratamento robusto de erros com mensagens claras
- ✅ Limpeza automática de arquivos temporários

**⚠️ IMPORTANTE:**
- Substitui o banco de dados completamente
- Cria backup de segurança em `uploads_old_[timestamp]/`
- Usa mais espaço em disco temporariamente

---

### 4. Baixar Backup

**Como usar:**
1. Na lista de backups, clique em "Baixar"
2. O arquivo será salvo no seu computador

**Uso:**
- Criar cópias de segurança externas
- Transferir dados entre ambientes
- Manter histórico de versões

---

### 5. Excluir Backup

**Como usar:**
1. Clique em "Excluir" ao lado do backup desejado
2. Confirme a ação

**⚠️ CUIDADO:**
- Ação irreversível
- Libera espaço em disco
- Recomenda-se fazer download antes de excluir

---

## Solução de Problemas

### Erro: "Cannot POST /api/admin/backup/upload"
**Causa:** Rota não configurada no servidor ou servidor não iniciado  
**Solução:** Verifique se o servidor está rodando e reinicie-o

### Erro: "Falha ao criar o backup do banco de dados"
**Causa:** mongodump não encontrado ou URI do MongoDB incorreta  
**Solução:** 
1. Verifique `MONGODUMP_PATH` no `.env`
2. Teste executar no PowerShell: `& "C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe" --version`
3. Verifique `MONGODB_URI` no `.env`

### Erro: "Arquivo de dump (.gz) não encontrado dentro do backup"
**Causa:** Arquivo ZIP corrompido ou formato incorreto  
**Solução:** 
- Use apenas backups criados pelo sistema
- Verifique integridade do arquivo ZIP

### Erro: "Falha ao restaurar o banco de dados"
**Causa:** mongorestore falhou ou banco de dados em uso  
**Solução:**
1. Verifique logs do servidor (console)
2. Certifique-se que nenhum outro processo está usando o MongoDB
3. Verifique permissões de acesso ao banco

### Upload fica travado ou não responde
**Causa:** Arquivo muito grande ou timeout do servidor  
**Solução:**
1. Para arquivos grandes (>100MB), aumente timeout no servidor
2. Verifique conexão de rede
3. Use backups menores quando possível

---

## Logs e Debugging

### Logs do Backend
O sistema agora gera logs detalhados com prefixo `[BACKUP UPLOAD]`:

```
[BACKUP UPLOAD] Iniciando processo de upload e restauração...
[BACKUP UPLOAD] Arquivo recebido: backup-completo-2025-11-26.zip Tamanho: 15728640 bytes
[BACKUP UPLOAD] Diretório temporário criado: C:\...\temp-restore-1234567890
[BACKUP UPLOAD] Iniciando descompactação...
[BACKUP UPLOAD] Descompactação concluída
[BACKUP UPLOAD] Arquivos extraídos: [ 'db-dump-2025-11-26.gz', 'uploads' ]
[BACKUP UPLOAD] Arquivo de dump encontrado: db-dump-2025-11-26.gz
[BACKUP UPLOAD] Executando mongorestore...
[BACKUP UPLOAD] Banco de dados restaurado com sucesso
[BACKUP UPLOAD] Restaurando arquivos de upload...
[BACKUP UPLOAD] Backup da pasta uploads atual criado: uploads_old_1234567890
[BACKUP UPLOAD] Arquivos de upload restaurados
[BACKUP UPLOAD] Pasta temporária removida
[BACKUP UPLOAD] Processo concluído com sucesso!
```

### Logs do Frontend
Abra o Console do Navegador (F12) para ver:
- Status do upload
- Tamanho do arquivo enviado
- Resposta do servidor
- Erros detalhados

---

## Boas Práticas

### ✅ Recomendações

1. **Backups Regulares**
   - Crie backups diários (idealmente automatizados via cron/task scheduler)
   - Mantenha pelo menos 7 dias de backups recentes

2. **Backups Externos**
   - Baixe backups importantes para armazenamento externo
   - Use cloud storage (Google Drive, Dropbox) para backups críticos

3. **Antes de Atualizações**
   - Sempre crie backup antes de atualizar o sistema
   - Teste a restauração em ambiente de desenvolvimento

4. **Gerenciamento de Espaço**
   - Monitore tamanho da pasta `_backups/`
   - Exclua backups antigos regularmente (após fazer download)
   - Use compressão máxima (já implementada)

5. **Segurança**
   - Proteja arquivos de backup (contêm dados sensíveis)
   - Não compartilhe backups publicamente
   - Use criptografia para backups armazenados externamente

### ❌ Evite

1. ❌ Restaurar backups em produção sem testar antes
2. ❌ Excluir todos os backups de uma vez
3. ❌ Ignorar mensagens de erro durante backup/restauração
4. ❌ Modificar manualmente arquivos dentro do ZIP
5. ❌ Usar backups de versões muito antigas do sistema

---

## Configuração Técnica

### Variáveis de Ambiente (.env)

```env
# Obrigatório para backups funcionarem
MONGODB_URI=mongodb://localhost:27017/seu_banco
MONGODUMP_PATH="C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe"
```

### Permissões de Pasta

O sistema precisa de:
- **Leitura/Escrita** em `_backups/`
- **Leitura/Escrita** em `_temp_uploads/`
- **Leitura/Escrita** em `uploads/`

### Limites de Tamanho

Por padrão:
- Upload máximo: configurado pelo `multer` (sem limite explícito)
- Recomendado: backups até 500MB para melhor performance

---

## Arquitetura do Código

### Backend (rota-admin.js)

#### Criar Backup
```javascript
POST /api/admin/backup/create
├─ Executa mongodump
├─ Cria arquivo .gz do banco
├─ Compacta .gz + uploads/ em .zip
└─ Salva em _backups/
```

#### Upload e Restauração
```javascript
POST /api/admin/backup/upload
├─ Recebe arquivo via multer
├─ Valida formato (.zip)
├─ Extrai para pasta temporária
├─ Localiza dump .gz
├─ Executa mongorestore --drop
├─ Faz backup de uploads/ atual
├─ Copia uploads/ do backup
└─ Remove arquivos temporários
```

### Frontend (admin-dashboard.html)

```javascript
carregarBackup()
├─ Valida arquivo selecionado
├─ Mostra modal de confirmação
├─ Cria FormData com arquivo
├─ Envia via fetchWithAuth
├─ Exibe progresso e erros
└─ Recarrega página em sucesso
```

---

## Changelog

### Versão 2.0 (26/11/2025)
- ✅ Reescrito sistema de upload com async/await
- ✅ Adicionados logs detalhados para debugging
- ✅ Backup automático de uploads/ antes de restaurar
- ✅ Melhorado tratamento de erros
- ✅ Feedback visual aprimorado no frontend
- ✅ Prevenção de múltiplas respostas HTTP
- ✅ Cleanup robusto de arquivos temporários

### Versão 1.0
- Funcionalidade básica de backup e restauração
- Interface na Central do Administrador
- Criação, download e exclusão de backups

---

## Suporte

Em caso de problemas:
1. Verifique os logs do servidor (console)
2. Verifique os logs do navegador (F12 > Console)
3. Confirme que MongoDB Tools está instalado
4. Verifique permissões de arquivos e pastas
5. Teste com arquivo de backup pequeno primeiro

---

**Última atualização:** 26 de novembro de 2025
