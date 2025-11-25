# Sistema de Compartilhamento e Download de Documentos

## 📋 Visão Geral

Sistema completo para seleção, download e compartilhamento de documentos empresariais, integrado à página de detalhes da empresa.

## 🎯 Funcionalidades Implementadas

### 1. ✅ Seleção de Documentos com Checkboxes
- Checkbox ao lado de cada documento
- Contador dinâmico de documentos selecionados
- Botões "Selecionar Todos" e "Limpar Seleção"
- Interface intuitiva e responsiva

### 2. 📥 Download em Lote
- **Baixar Selecionados**: Download múltiplo dos documentos marcados
- Download sequencial com delay de 500ms entre arquivos
- Feedback visual com toast notifications
- Suporte para múltiplos formatos (PDF, imagens, etc.)

### 2.5 🗑️ Exclusão de Documentos
- **Excluir Selecionados**: Exclui permanentemente os documentos marcados
- Confirmação detalhada antes da exclusão
- Remove arquivo físico e referência no banco de dados
- Registro de log da ação de exclusão
- Atualização automática da página após exclusão
- Feedback visual durante o processo

### 3. 📱 Compartilhamento via WhatsApp

#### a) Compartilhar Documentos Selecionados
- **Gera arquivo ZIP** com todos os documentos selecionados
- **Baixa automaticamente** o ZIP para o computador
- Abre WhatsApp com instruções de como anexar o arquivo
- Mensagem profissional com branding ADCON

**Processo:**
1. Sistema cria ZIP no servidor com documentos selecionados
2. Arquivo é baixado automaticamente (nome: `empresa_documentos_data.zip`)
3. WhatsApp Web abre com mensagem de instruções
4. Usuário anexa manualmente o ZIP no WhatsApp

**Formato da Mensagem:**
```
📄 *Documentos da Empresa [Nome]*

CNPJ: XX.XXX.XXX/XXXX-XX

*X documento(s) selecionado(s)*

O arquivo ZIP com os documentos foi baixado para o seu computador.
📦 Arquivo: empresa_documentos_2025-01-15.zip

*Para enviar pelo WhatsApp:*
1. Clique no ícone de anexo (📎)
2. Selecione "Documento"
3. Escolha o arquivo empresa_documentos_2025-01-15.zip
4. Envie para o contato desejado

_Enviado via ADCON - Sistema de Gestão Empresarial_
```

**Observação:** WhatsApp Web não permite anexos automáticos via URL, por isso o sistema baixa o arquivo e fornece instruções de anexação manual.

#### b) Compartilhar Relatório Completo
- Relatório textual completo da empresa
- Inclui todos os dados cadastrais
- Quadro societário
- Endereço e contato
- Lista de documentos disponíveis
- Link para acesso ao sistema

**Estrutura do Relatório:**
- 📊 Título e identificação
- 📌 Dados cadastrais (CNPJ, Insc. Estadual, etc.)
- 📞 Contato (email, telefone)
- 📍 Endereço completo
- 👥 Quadro societário
- 📁 Documentos disponíveis
- 🔗 Link de acesso
- Data e hora de geração

### 4. 🖨️ Geração de Relatório em PDF
- Botão "Relatório Completo (PDF)"
- Usa função de impressão do navegador
- Estilos otimizados para impressão
- Remove elementos de interface (botões, checkboxes)
- Mantém formatação profissional

## 🎨 Interface

### Cabeçalho de Seleção
Localizado acima da lista de documentos:
- Contador de selecionados
- 4 botões de ação organizados horizontalmente
- Design responsivo com wrap automático

### Botões de Ação Principal
Localizados no rodapé da página:
1. **Voltar** - Retorna à página anterior
2. **Editar** - Edita a empresa (se permissão)
3. **🖨️ Imprimir Relatório** - Impressão rápida
4. **📄 Relatório Completo (PDF)** - Gera PDF profissional
5. **📱 Compartilhar Relatório WhatsApp** - Envia relatório completo

### Cores e Ícones
- ✓ Selecionar: Azul (#17a2b8)
- ✗ Limpar: Cinza (#6c757d)
- 📥 Download: Verde (#28a745)
- 📱 WhatsApp: Verde WhatsApp (#25D366)
- 🗑️ Excluir: Vermelho (#dc3545)
- 📄 PDF: Vermelho (#dc3545)

## 💻 Implementação Técnica

### Estrutura de Dados
```javascript
// Cada documento possui:
{
  nome: "Nome do Documento (com validade se aplicável)",
  caminho: "/uploads/documentos/arquivo.pdf",
  nomeArquivo: "arquivo.pdf"
}
```

### Principais Funções

#### Seleção
```javascript
selecionarTodos()           // Marca todos os checkboxes
desselecionarTodos()        // Desmarca todos
atualizarContador()         // Atualiza contador visual
obterDocumentosSelecionados() // Retorna array de docs selecionados
```

#### Download
```javascript
baixarSelecionados()        // Baixa documentos selecionados
// - Valida se há seleção
// - Download sequencial com delay
// - Feedback via toast
```

#### Exclusão
```javascript
excluirSelecionados()       // Exclui documentos selecionados
// - Confirmação com lista de documentos
// - Envia DELETE para API
// - Remove arquivo físico + BD
// - Registra log de auditoria
// - Recarrega página após sucesso
```

#### Compartilhamento
```javascript
compartilharWhatsApp()      // Compartilha docs selecionados
// - Gera ZIP no servidor
// - Baixa arquivo automaticamente
// - Abre WhatsApp com instruções
// - Usuário anexa manualmente o ZIP

compartilharRelatorioWhatsApp() // Compartilha relatório completo
// - Gera relatório textual
// - Formata com emojis
// - Inclui todas as informações
```

#### PDF
```javascript
gerarRelatorioCompleto()    // Gera PDF
// - Usa window.print()
// - Aplica estilos @media print
// - Remove elementos de UI
```

### Variáveis Globais
```javascript
empresaAtual = null  // Armazena dados completos da empresa
usuario = null       // Dados do usuário logado
```

## 📱 Como Usar

### Para Usuários

#### Baixar Documentos Específicos
1. Na página de detalhes da empresa
2. Marque os checkboxes dos documentos desejados
3. Clique em "📥 Baixar Selecionados"
4. Os downloads iniciarão automaticamente

#### Excluir Documentos
1. Na página de detalhes da empresa
2. Marque os checkboxes dos documentos que deseja excluir
3. Clique em "🗑️ Excluir Selecionados"
4. Confirme a exclusão na janela de diálogo
5. Aguarde o processamento
6. A página será recarregada automaticamente

**⚠️ Atenção:** A exclusão é permanente e não pode ser desfeita!

#### Compartilhar via WhatsApp
1. Selecione os documentos desejados
2. Clique em "📱 Compartilhar WhatsApp"
3. O sistema gerará e baixará automaticamente um arquivo ZIP
4. WhatsApp abrirá com instruções
5. No WhatsApp:
   - Clique no ícone de anexo (📎)
   - Selecione "Documento"
   - Escolha o arquivo ZIP baixado
   - Envie para o contato desejado

#### Gerar Relatório Completo
1. Clique em "📄 Relatório Completo (PDF)"
2. Na janela de impressão:
   - Escolha "Salvar como PDF"
   - Ou selecione impressora física
3. Configure as opções e confirme

#### Compartilhar Relatório Completo
1. Clique em "📱 Compartilhar Relatório WhatsApp"
2. WhatsApp abrirá com relatório formatado
3. Escolha destinatário e envie

### Atalhos de Teclado
- **Ctrl+P** - Abre impressão rápida
- **Clicar no label** - Seleciona/deseleciona documento

## 🔒 Segurança

- Documentos protegidos por autenticação
- Links incluem URL completa do servidor
- Senhas de certificado mantêm proteção existente
- Relatórios não expõem informações sensíveis excessivas

## 🎨 Personalização

### Alterar Delay Entre Downloads
```javascript
// Em baixarSelecionados()
}, index * 500); // Altere 500 para o delay desejado em ms
```

### Customizar Mensagem WhatsApp
```javascript
// Em compartilharWhatsApp()
mensagem += `\n_Enviado via ADCON - Sistema de Gestão Empresarial_`;
// Modifique o texto conforme necessário
```

### Adicionar Campos ao Relatório
```javascript
// Em compartilharRelatorioWhatsApp()
// Adicione novos campos seguindo o padrão:
if (empresaAtual.novoCampo) {
    mensagem += `Novo Campo: ${empresaAtual.novoCampo}\n`;
}
```

## 📊 Formatação de Dados

### Funções Auxiliares
- `formatarCNPJ(cnpj)` - XX.XXX.XXX/XXXX-XX
- `formatarCPF(cpf)` - XXX.XXX.XXX-XX
- `formatarData(data)` - DD/MM/AAAA
- `formatarBooleano(valor)` - Sim/Não

## 🌐 Compatibilidade

### Navegadores
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

### Dispositivos
- ✅ Desktop
- ✅ Tablet
- ✅ Mobile (responsivo)

### WhatsApp
- ✅ WhatsApp Web
- ✅ WhatsApp Desktop
- ✅ WhatsApp Mobile (via link)

## 🐛 Troubleshooting

### Downloads não iniciam
- Verificar bloqueador de pop-ups
- Verificar permissões de download do navegador
- Testar com menos documentos simultâneos

### WhatsApp não abre
- Verificar se WhatsApp está instalado
- Testar em navegador diferente
- Verificar codificação de URL

### Relatório PDF mal formatado
- Usar Chrome/Edge para melhor resultado
- Verificar configurações de impressão
- Selecionar "Salvar como PDF" manualmente

### Contador não atualiza
- Verificar console do navegador para erros
- Recarregar página
- Limpar cache do navegador

## 📈 Melhorias Futuras Sugeridas

- [x] ✅ Compactação automática (ZIP) para múltiplos documentos
- [ ] Integração com API de WhatsApp Business (anexo automático)
- [ ] Geração de PDF server-side com layout customizado
- [ ] Preview de documentos antes de compartilhar
- [ ] Histórico de compartilhamentos
- [ ] Templates personalizáveis de mensagem
- [ ] Envio por email integrado
- [ ] QR Code para acesso rápido
- [ ] Assinatura digital de documentos
- [ ] Marca d'água em PDFs gerados

## 📝 Exemplos de Uso

### Exemplo 1: Enviar Certidões para Contador
```
1. Marcar: Certidão Receita, Certidão FGTS, Certidão Trabalhista
2. Clicar "Compartilhar WhatsApp"
3. Aguardar download do ZIP (automático)
4. No WhatsApp, clicar em anexo (📎)
5. Selecionar "Documento" e escolher o ZIP baixado
6. Selecionar contato do contador
7. Enviar
```

### Exemplo 2: Gerar Relatório para Cliente
```
1. Abrir detalhes da empresa
2. Clicar "Relatório Completo (PDF)"
3. Na janela de impressão, escolher "Salvar como PDF"
4. Salvar com nome apropriado
5. Enviar por email ou sistema
```

### Exemplo 3: Compartilhar Dados Completos
```
1. Clicar "Compartilhar Relatório WhatsApp"
2. Revisar informações na mensagem
3. Enviar para grupo de trabalho
```

## 🎓 Notas Técnicas

### Limitações do WhatsApp
- Mensagens têm limite de caracteres (~65.000)
- Relatórios muito extensos podem ser truncados
- Links funcionam melhor em WhatsApp Web

### Performance
- Downloads simultâneos limitados pelo navegador
- Delay entre downloads evita sobrecarga
- Geração de relatório é instantânea (client-side)

### Acessibilidade
- Labels associados aos checkboxes
- Feedback visual claro
- Suporte a navegação por teclado
- Mensagens de erro descritivas

---

**Desenvolvido para ADCON - Sistema de Gestão Empresarial**  
**Versão:** 1.0  
**Data:** Novembro 2025
