# Widget de Usuários Online

## Descrição
O widget de usuários online mostra em tempo real quais usuários estão ativos no sistema. Um usuário é considerado online se realizou alguma atividade nos últimos 5 minutos.

## Funcionalidades

### 1. Rastreamento de Atividade
- Cada requisição autenticada atualiza automaticamente o campo `lastActivity` do usuário
- O rastreamento é feito de forma não-bloqueante no middleware de autenticação
- Não impacta a performance do sistema

### 2. Widget no Dashboard
- Exibe lista de usuários ativos nos últimos 5 minutos
- Mostra nome, perfil (role) e tempo desde a última atividade
- Atualização automática a cada 30 segundos
- Indicador visual animado de status online
- Design responsivo com scroll para muitos usuários

### 3. Endpoint da API
**GET** `/api/auth/admin/online-users`
- Acesso: Apenas administradores
- Retorna: Array de usuários online com informações básicas
- Critério: Usuários com atividade nos últimos 5 minutos

## Estrutura Técnica

### Modelo de Dados
```javascript
// Campo adicionado ao modelo Usuario
lastActivity: {
  type: Date,
  default: Date.now,
}
```

### Middleware de Autenticação
O middleware `auth.js` foi modificado para atualizar o `lastActivity` automaticamente:
```javascript
Usuario.findByIdAndUpdate(req.usuario.id, { 
  lastActivity: new Date() 
}).catch(err => {
  console.error('Erro ao atualizar lastActivity:', err.message);
});
```

### Frontend
- Widget localizado em `admin-dashboard.html`
- Função `loadOnlineUsers()` carrega e exibe os dados
- Atualização automática via `setInterval(loadOnlineUsers, 30000)`
- Estilos CSS incluem animação de pulso no indicador verde

## Migração
Para adicionar o campo aos usuários existentes:
```bash
node migrations/add-last-activity.js
```

## Personalização

### Alterar o tempo de "online"
No arquivo `routes/rota-auth.js`, modifique:
```javascript
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); // 5 minutos
```

### Alterar intervalo de atualização
No arquivo `client/admin-dashboard.html`, modifique:
```javascript
setInterval(loadOnlineUsers, 30000); // 30 segundos
```

## Segurança
- Apenas administradores podem visualizar usuários online
- O endpoint é protegido pelos middlewares `auth` e `adminAuth`
- Não expõe informações sensíveis dos usuários

## Performance
- Atualização do `lastActivity` é não-bloqueante
- Query otimizada com índice no campo `lastActivity`
- Widget usa scroll para grandes quantidades de usuários
- Atualização automática limitada a 30 segundos
