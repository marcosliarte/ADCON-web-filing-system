# Refatoração: Remoção de JavaScript Inline

## Objetivo
Remover todo JavaScript inline (onclick, onchange, onsubmit, etc.) dos arquivos HTML do sistema, seguindo boas práticas de programação e separação de concerns.

## Progresso

### ✅ Concluído
- [x] `home.html` + `home.js` - 5 ocorrências removidas
- [x] `configuracoes-conta.html` + `account-settings.js` - 1 ocorrência removida
- [x] `empresas.html` + `empresas.js` - 7 ocorrências removidas (4 HTML + 3 JS dinâmico)
- [x] `admin-dashboard.html` - 10 ocorrências removidas (modais, filtros, backups)
- [x] `detalhes-empresa.html` + `detalhes-empresa.js` - 14 ocorrências removidas (script inline extraído para JS separado)
- [x] `server.js` - Graceful shutdown do Mongoose corrigido

### ⏳ Em Andamento

Nenhum arquivo em progresso no momento.

### 📋 Pendente (47 ocorrências restantes)

#### Média Prioridade (formulários complexos)
- [x] `cliente-formulario.html` + `cliente-formulario.js` - 13 ocorrências removidas ✅

- [ ] `editar.html` - 10 ocorrências
  - Similar ao cliente-formulario
  - Cancelar edição

#### Média Prioridade (relatórios e gestão)
- [ ] `relatorios.html` - 8 ocorrências
  - Gerar/imprimir relatório
  - Toggle filtros
  - Editar/excluir lançamentos
  - Marcar como paga
  - Modal de edição
  - Form de receita

- [ ] `faturamento.html` - 7 ocorrências
  - Selecionar empresa
  - Atualizar período
  - Gerar/salvar faturamento
  - Imprimir/limpar

- [ ] `notificacoes.html` - 7 ocorrências
  - Filtros
  - Marcar como lida/lidas
  - Limpar/excluir
  - Abrir notificação
  - Stop propagation

#### Baixa Prioridade (páginas simples)
- [ ] `enviar-notificacoes.html` - 4 ocorrências
  - Alterar destinatários
  - Limpar formulário
  - Selecionar todos

- [ ] `configuracao-empresa.html` - 3 ocorrências
  - Upload/remover logo

- [ ] `mensalidades.html` - 2 ocorrências
  - Carregar status
  - Fechar modal

- [ ] `funcionarios-pagamentos.html` - 1 ocorrência
  - Remover campo de desconto

- [ ] `logs.html` - 1 ocorrência
  - Carregar logs

## Benefícios
1. **Separação de Concerns**: HTML estrutura, CSS apresentação, JS comportamento
2. **Manutenibilidade**: Código mais organizado e fácil de manter
3. **Segurança**: Facilita implementação de CSP (Content Security Policy)
4. **Testabilidade**: Event listeners são mais fáceis de testar
5. **Debugging**: Stack traces mais claros
6. **Reutilização**: Funções centralizadas nos arquivos JS

## Estratégia de Implementação
1. Identificar todos os event handlers inline
2. Criar/atualizar arquivos JS correspondentes em `client/js/pages/`
3. Substituir `onclick="funcao()"` por `data-action="action-name"` ou IDs
4. Adicionar event listeners no DOMContentLoaded
5. Para elementos dinâmicos, usar event delegation
6. Testar cada página após refatoração
7. Commit por grupo de páginas relacionadas

## Padrões Adotados
- Event listeners em `DOMContentLoaded`
- `data-*` attributes para ações personalizadas
- Event delegation para elementos dinâmicos
- IDs específicos para elementos únicos
- Classes para elementos repetidos

## Status Atual
- **Total**: 87 ocorrências identificadas
- **Removidas**: 10 (11.5%)
- **Restantes**: 77 (88.5%)
- **Arquivos completos**: 3 de 16 (18.75%)
