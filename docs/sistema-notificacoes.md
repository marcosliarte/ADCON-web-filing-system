# Sistema de Notificações - ADCON

## 📋 Visão Geral

Sistema completo de notificações que permite:
- ✅ Notificar sobre documentos vencendo ou vencidos
- ✅ Notificar sobre pagamentos recebidos
- ✅ Admin enviar mensagens para usuários
- ✅ Badge com contador de notificações não lidas
- ✅ Central de notificações completa
- ✅ Verificação automática diária de documentos

## 🎯 Tipos de Notificações

### 1. Documento Vencendo (`documento_vencendo`)
- Notifica 30, 15, 7, 3 e 1 dia antes do vencimento
- Ícone: ⏰
- Enviada para: Admin e Gerentes

### 2. Documento Vencido (`documento_vencido`)
- Notifica no dia do vencimento e após
- Ícone: ⚠️
- Enviada para: Admin e Gerentes

### 3. Pagamento Recebido (`pagamento_recebido`)
- Notifica quando um pagamento é confirmado
- Ícone: 💰
- Enviada para: Usuário específico

### 4. Mensagem do Admin (`mensagem_admin`)
- Mensagens personalizadas do administrador
- Ícone: 📢
- Enviada para: Definido pelo admin (todos, por perfil ou específicos)

### 5. Sistema (`sistema`)
- Notificações gerais do sistema
- Ícone: ℹ️
- Enviada para: Definido programaticamente

## 🔧 Componentes

### Backend

#### Modelo (`models/model-notificacao.js`)
```javascript
{
  usuarioId: ObjectId,
  tipo: String,
  titulo: String,
  mensagem: String,
  lida: Boolean,
  link: String,
  dadosAdicionais: Object,
  criadoPor: ObjectId
}
```

#### Rotas (`routes/rota-notificacoes.js`)
- `GET /api/notificacoes` - Lista notificações do usuário
- `GET /api/notificacoes/count` - Conta notificações não lidas
- `PUT /api/notificacoes/:id/ler` - Marca como lida
- `PUT /api/notificacoes/ler-todas` - Marca todas como lidas
- `DELETE /api/notificacoes/:id` - Exclui notificação
- `DELETE /api/notificacoes/limpar/lidas` - Limpa todas as lidas
- `POST /api/notificacoes/admin/enviar` - [Admin] Envia notificação
- `POST /api/notificacoes/admin/enviar-role` - [Admin] Envia por perfil

### Frontend

#### Widget no Header (`client/shared.js`)
- Badge com contador de notificações não lidas
- Dropdown com últimas 10 notificações
- Atualização automática a cada 30 segundos
- Animação e indicadores visuais

#### Central de Notificações (`client/notificacoes.html`)
- Lista completa de notificações
- Filtros por tipo e status (lida/não lida)
- Ações: marcar como lida, excluir, limpar lidas
- Design responsivo com cards coloridos

#### Painel de Envio (`client/enviar-notificacoes.html`)
- [Apenas Admin] Interface para enviar notificações
- Envio para todos, por perfil ou usuários específicos
- Campos: título, mensagem, link opcional
- Validação e feedback visual

### Scripts

#### Verificação de Documentos (`scripts/verificar-documentos.js`)
```bash
node scripts/verificar-documentos.js
```
- Verifica todos os documentos das empresas
- Cria notificações para documentos vencendo/vencidos
- Evita duplicatas (não cria se já existe nas últimas 24h)
- Deve ser executado diariamente

## ⚙️ Configuração Automática

### Windows - Task Scheduler

1. Abra o Agendador de Tarefas (Task Scheduler)
2. Criar Tarefa Básica...
3. Nome: "ADCON - Verificar Documentos"
4. Gatilho: Diariamente às 08:00
5. Ação: Iniciar um programa
   - Programa: `node`
   - Argumentos: `scripts\verificar-documentos.js`
   - Iniciar em: `C:\Users\Marcos\Documents\2 - Estudos\0 - Programação\ADCON-web-filing-system`

### Linux/Mac - Cron Job

```bash
# Editar crontab
crontab -e

# Adicionar linha (executar diariamente às 8h)
0 8 * * * cd /caminho/para/ADCON-web-filing-system && node scripts/verificar-documentos.js >> logs/verificacao.log 2>&1
```

### Alternativa - npm script

Adicione ao `package.json`:
```json
"scripts": {
  "verificar-docs": "node scripts/verificar-documentos.js"
}
```

Execute:
```bash
npm run verificar-docs
```

## 📱 Como Usar

### Para Usuários

1. **Ver notificações**: Clique no ícone 🔔 no header
2. **Abrir notificação**: Clique na notificação para abrir o link
3. **Marcar como lida**: Clique em "Marcar como lida"
4. **Ver todas**: Clique em "Ver todas as notificações"
5. **Central completa**: Acesse `/notificacoes.html`

### Para Administradores

1. **Enviar notificação**: Acesse `/enviar-notificacoes.html` ou dashboard admin
2. **Escolher destinatários**:
   - Todos os usuários
   - Por perfil (admin, gerente, funcionário, empresário)
   - Usuários específicos (selecionar da lista)
3. **Preencher formulário**:
   - Título (obrigatório, max 100 caracteres)
   - Mensagem (obrigatório, max 500 caracteres)
   - Link (opcional, ex: `/relatorios.html`)
4. **Enviar**: Clique em "Enviar Notificação"

## 🔔 Integração com Outras Funcionalidades

### Notificar sobre Pagamento Recebido

No código onde um pagamento é confirmado:

```javascript
const { criarNotificacaoPagamentoRecebido } = require('../routes/rota-notificacoes');

// Após confirmar pagamento
await criarNotificacaoPagamentoRecebido(
  usuarioId,      // ID do usuário que receberá a notificação
  empresaId,      // ID da empresa
  empresaNome,    // Nome da empresa
  pagamentoId,    // ID do pagamento
  valor           // Valor do pagamento
);
```

### Criar Notificação Personalizada

```javascript
const Notificacao = require('../models/model-notificacao');

await Notificacao.create({
  usuarioId: usuario._id,
  tipo: 'sistema',
  titulo: 'Título da Notificação',
  mensagem: 'Mensagem detalhada',
  link: '/alguma-pagina.html', // opcional
  dadosAdicionais: { // opcional
    qualquerCampo: 'valor'
  }
});
```

## 🎨 Personalização

### Alterar Dias de Alerta

Em `scripts/verificar-documentos.js`:
```javascript
const DIAS_ALERTA = [30, 15, 7, 3, 1, 0]; // Modificar conforme necessário
```

### Alterar Intervalo de Atualização do Badge

Em `client/shared.js`:
```javascript
setInterval(updateNotificationBadge, 30000); // 30 segundos (30000ms)
```

### Adicionar Novo Tipo de Notificação

1. Adicionar ao enum no modelo:
```javascript
tipo: {
  type: String,
  enum: ['documento_vencendo', 'documento_vencido', 'pagamento_recebido', 'mensagem_admin', 'sistema', 'novo_tipo'],
  required: true
}
```

2. Adicionar ícone no frontend (`shared.js` e `notificacoes.html`):
```javascript
const icones = {
  'novo_tipo': '🆕'
};
```

## 🔒 Segurança

- Usuários só veem suas próprias notificações
- Apenas admins podem enviar notificações para outros
- Rotas protegidas por middleware de autenticação
- Validação de dados no backend

## 📊 Performance

- Índices no MongoDB para consultas rápidas
- Limite de 100 notificações por consulta
- Atualização de badge não-bloqueante
- Cache de 30 segundos para evitar sobrecarga

## 🐛 Troubleshooting

### Badge não atualiza
- Verificar console do navegador
- Verificar se o token está válido
- Verificar se a rota `/api/notificacoes/count` está funcionando

### Script de verificação não cria notificações
- Verificar se existem documentos cadastrados com data de validade
- Verificar se existem usuários admin/gerente no sistema
- Executar manualmente: `node scripts/verificar-documentos.js`

### Notificações não aparecem
- Verificar se o MongoDB está rodando
- Verificar se o servidor está conectado ao banco
- Verificar console do navegador para erros

## 📝 Exemplos de Uso

### Enviar Boas-Vindas para Novo Usuário

```javascript
await Notificacao.create({
  usuarioId: novoUsuario._id,
  tipo: 'sistema',
  titulo: '👋 Bem-vindo ao ADCON!',
  mensagem: 'Sua conta foi criada com sucesso. Explore o sistema e comece a gerenciar suas empresas.',
  link: '/home.html'
});
```

### Notificar sobre Backup Criado

```javascript
const admins = await Usuario.find({ role: 'admin' });
for (const admin of admins) {
  await Notificacao.create({
    usuarioId: admin._id,
    tipo: 'sistema',
    titulo: '💾 Backup Criado',
    mensagem: `Backup automático criado com sucesso em ${new Date().toLocaleString('pt-BR')}.`
  });
}
```

## 📚 Próximas Melhorias

- [ ] Notificações em tempo real com WebSockets
- [ ] Notificações por email
- [ ] Notificações push no navegador
- [ ] Personalização de preferências de notificação por usuário
- [ ] Categorias de notificações personalizáveis
- [ ] Histórico de notificações arquivadas
