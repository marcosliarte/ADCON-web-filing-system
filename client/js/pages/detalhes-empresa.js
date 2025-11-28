// === detalhes-empresa.js ===
// Lógica da página de detalhes da empresa

let empresaAtual = null;
let empresaId = null;
let usuario = null;

// --- NOVO: Funções de Autenticação e Revelação de Senha ---
let senhaAutenticadaTemp = false; // Flag de autenticação temporária da sessão
let inputSenhaAtuais = []; // Rastreia inputs de senha abertos

// Função para obter usuário
async function getUsuario() {
    try {
        const response = await fetchWithAuth('/api/auth');
        if (!response || !response.ok) {
            throw new Error('Falha na autenticação');
        }
        usuario = await response.json();
    } catch (error) {
        console.error('Erro ao obter usuário:', error);
        // fetchWithAuth já redireciona para login em caso de erro 401/403
    }
}

// --- Carregamento de Dados ---
async function carregarDadosEmpresa() {
    const params = new URLSearchParams(window.location.search);
    empresaId = params.get('id');

    if (!empresaId) {
        mostrarErro('ID da empresa não fornecido.');
        return;
    }

    mostrarLoading(true);
    esconderErro();

    try {
        const response = await fetchWithAuth(`/api/empresas/${empresaId}`);

        if (!response || !response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Erro na resposta:', response.status, errorData);
            throw new Error(errorData.msg || errorData.message || `Erro ${response.status} ao carregar dados da empresa`);
        }

        empresaAtual = await response.json();
        exibirDadosEmpresa(empresaAtual);
        mostrarConteudo();
    } catch (error) {
        console.error('Erro ao carregar empresa:', error);
        mostrarErro(`Erro ao carregar dados da empresa: ${error.message}`);
    } finally {
        mostrarLoading(false);
    }
}

// --- Exibição de Dados ---
function exibirDadosEmpresa(empresa) {
    // Dados da Empresa
    document.getElementById('empresa-id').textContent = empresa._id || '';
    document.getElementById('empresa-nome').textContent = empresa.nome || '';
    document.getElementById('empresa-cnpj').textContent = formatarCNPJ(empresa.cnpj) || '';
    document.getElementById('empresa-razao').textContent = empresa.razaoSocial || '';
    document.getElementById('empresa-inscricao-municipal').textContent = empresa.inscricaoMunicipal || 'Não informado';
    document.getElementById('empresa-inscricao-estadual').textContent = empresa.inscricaoEstadual || 'Não informado';
    document.getElementById('empresa-ramo').textContent = empresa.ramoAtividade || 'Não informado';
    document.getElementById('empresa-endereco').textContent = empresa.endereco || 'Não informado';
    document.getElementById('empresa-telefone').textContent = empresa.telefone || 'Não informado';
    document.getElementById('empresa-email').textContent = empresa.email || 'Não informado';

    // Informações de Cadastro
    document.getElementById('criado-por').textContent = empresa.criadoPor || 'Sistema';
    document.getElementById('data-criacao').textContent = formatarData(empresa.dataCriacao);

    // Responsável Legal
    const responsavelLegal = empresa.responsavelLegal || {};
    document.getElementById('responsavel-nome').textContent = responsavelLegal.nome || 'Não informado';
    document.getElementById('responsavel-cpf').textContent = formatarCPF(responsavelLegal.cpf) || 'Não informado';
    document.getElementById('responsavel-rg').textContent = responsavelLegal.rg || 'Não informado';
    document.getElementById('responsavel-nascimento').textContent = formatarData(responsavelLegal.dataNascimento) || 'Não informado';
    document.getElementById('responsavel-estado-civil').textContent = formatarEstadoCivil(responsavelLegal.estadoCivil, responsavelLegal.regimeCasamento);
    document.getElementById('responsavel-telefone').textContent = responsavelLegal.telefone || 'Não informado';
    document.getElementById('responsavel-email').textContent = responsavelLegal.email || 'Não informado';
    document.getElementById('responsavel-endereco').textContent = responsavelLegal.endereco || 'Não informado';

    // Cônjuge (se aplicável)
    const conjugeSection = document.getElementById('conjuge-section');
    if (responsavelLegal.estadoCivil === 'casado' && responsavelLegal.conjuge) {
        conjugeSection.style.display = 'block';
        const conjuge = responsavelLegal.conjuge;
        document.getElementById('conjuge-nome').textContent = conjuge.nome || 'Não informado';
        document.getElementById('conjuge-cpf').textContent = formatarCPF(conjuge.cpf) || 'Não informado';
        document.getElementById('conjuge-rg').textContent = conjuge.rg || 'Não informado';
        document.getElementById('conjuge-nascimento').textContent = formatarData(conjuge.dataNascimento) || 'Não informado';
    } else {
        conjugeSection.style.display = 'none';
    }

    // Contador
    const contador = empresa.contador || {};
    document.getElementById('contador-nome').textContent = contador.nome || 'Não informado';
    document.getElementById('contador-cpf').textContent = formatarCPF(contador.cpf) || 'Não informado';
    document.getElementById('contador-crc').textContent = contador.crc || 'Não informado';
    document.getElementById('contador-telefone').textContent = contador.telefone || 'Não informado';
    document.getElementById('contador-email').textContent = contador.email || 'Não informado';

    // Sócios
    const sociosLista = document.getElementById('socios-lista');
    sociosLista.innerHTML = '';
    if (empresa.socios && empresa.socios.length > 0) {
        empresa.socios.forEach((socio, index) => {
            const socioHTML = `
                <div class="socio-item">
                    <h4>Sócio ${index + 1}</h4>
                    <p><strong>Nome:</strong> ${socio.nome || 'Não informado'}</p>
                    <p><strong>CPF:</strong> ${formatarCPF(socio.cpf) || 'Não informado'}</p>
                    <p><strong>Participação:</strong> ${socio.participacao || 'Não informado'}%</p>
                    ${socio.observacoes ? `<p><strong>Observações:</strong> ${socio.observacoes}</p>` : ''}
                </div>
            `;
            sociosLista.innerHTML += socioHTML;
        });
    } else {
        sociosLista.innerHTML = '<p style="color: #666;">Nenhum sócio cadastrado.</p>';
    }

    // Documentos
    const documentosLista = document.getElementById('documentos-lista');
    documentosLista.innerHTML = '';

    const tiposDocumentosOrdenados = [
        { tipo: 'cartaoCNPJ', label: 'Cartão CNPJ', campo: 'documentos.cartaoCNPJ' },
        { tipo: 'contratoSocial', label: 'Contrato Social', campo: 'documentos.contratoSocial' },
        { tipo: 'alteracaoContratual', label: 'Última Alteração Contratual', campo: 'documentos.alteracaoContratual' },
        { tipo: 'certidaoFazenda', label: 'Certidão Negativa Fazenda', campo: 'documentos.certidaoFazenda', validade: 'documentos.certidaoFazendaValidade' },
        { tipo: 'certidaoFederal', label: 'Certidão Negativa Federal', campo: 'documentos.certidaoFederal', validade: 'documentos.certidaoFederalValidade' },
        { tipo: 'certidaoTrabalhista', label: 'Certidão Negativa Trabalhista', campo: 'documentos.certidaoTrabalhista', validade: 'documentos.certidaoTrabalhistaValidade' },
        { tipo: 'certificadoDigital', label: 'Certificado Digital (eCNPJ)', campo: 'certificadoDigital', validade: 'certificadoDigital.validade', isCertificado: true },
        { tipo: 'rgResponsavel', label: 'RG do Responsável Legal', campo: 'documentos.rgResponsavel' },
        { tipo: 'comprovanteResidenciaResponsavel', label: 'Comprovante Residência (Responsável)', campo: 'documentos.comprovanteResidenciaResponsavel' },
        { tipo: 'rgConjuge', label: 'RG do Cônjuge', campo: 'documentos.rgConjuge', condicao: responsavelLegal.estadoCivil === 'casado' },
        { tipo: 'comprovanteResidenciaConjuge', label: 'Comprovante Residência (Cônjuge)', campo: 'documentos.comprovanteResidenciaConjuge', condicao: responsavelLegal.estadoCivil === 'casado' },
        { tipo: 'iptu', label: 'IPTU', campo: 'documentos.iptu' },
        { tipo: 'contratoLocacao', label: 'Contrato de Locação', campo: 'documentos.contratoLocacao' },
        { tipo: 'outrosDocumentos', label: 'Outros Documentos', campo: 'outrosDocumentos', isArray: true }
    ];

    tiposDocumentosOrdenados.forEach(item => {
        // Verificar condição (exemplo: documentos de cônjuge só aparecem se casado)
        if (item.condicao === false) return;

        if (item.isArray) {
            // Outros Documentos
            const outrosDocs = empresa.outrosDocumentos || [];
            if (outrosDocs.length > 0) {
                outrosDocs.forEach(doc => {
                    documentosLista.innerHTML += gerarItemDocumento(doc.nome, doc.caminho, item.tipo, null, false, doc);
                });
            }
        } else if (item.isCertificado) {
            // Certificado Digital
            const certDigital = empresa.certificadoDigital;
            if (certDigital && certDigital.arquivo) {
                const validadeFormatada = certDigital.validade ? `Validade: ${formatarData(certDigital.validade)}` : null;
                documentosLista.innerHTML += gerarItemDocumento(item.label, certDigital.arquivo, item.tipo, validadeFormatada, true, certDigital);
            }
        } else {
            // Outros campos
            const caminho = item.campo.split('.').reduce((obj, key) => obj && obj[key], empresa);
            if (caminho) {
                let validadeText = null;
                if (item.validade) {
                    const dataValidade = item.validade.split('.').reduce((obj, key) => obj && obj[key], empresa);
                    if (dataValidade) {
                        validadeText = `Validade: ${formatarData(dataValidade)}`;
                    }
                }
                documentosLista.innerHTML += gerarItemDocumento(item.label, caminho, item.tipo, validadeText, false, null);
            }
        }
    });

    if (documentosLista.innerHTML.trim() === '') {
        documentosLista.innerHTML = '<p style="color: #666;">Nenhum documento cadastrado.</p>';
    }
}

function gerarItemDocumento(label, caminho, tipo, dataValidade, isCertificado, certificadoObj) {
    const docId = `doc-${tipo}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const nomeArquivo = caminho ? caminho.split('/').pop() : 'Arquivo não disponível';
    
    const docData = JSON.stringify({
        tipo: tipo,
        nome: label,
        caminho: caminho || '',
        nomeArquivo: nomeArquivo
    }).replace(/"/g, '&quot;');
    
    // Verifica se o arquivo existe (será validado via tentativa de acesso)
    const arquivoMissing = !caminho || caminho === '/undefined' || caminho === '/';
    const statusArquivo = arquivoMissing ? '<span style="color: #dc3545; font-weight: bold;">⚠️ Arquivo não encontrado</span>' : '';
    
    let html = `<li>
            <label class="doc-label">
                <input type="checkbox" class="doc-checkbox" id="${docId}" data-doc='${docData}' ${arquivoMissing ? 'disabled' : ''}>
                <span>${label}</span>
            </label>
            <div style="flex: 1;">
                <div class="doc-info">
                    <strong>Arquivo:</strong> ${nomeArquivo} ${statusArquivo}
                    ${dataValidade ? `<br><strong>${dataValidade}</strong>` : ''}
                    <br><span class="doc-path"><strong>Caminho:</strong> ${caminho}</span>
                </div>`;
    
    // Adiciona campo de senha do certificado se aplicável
    if (isCertificado && certificadoObj && certificadoObj.senha) {
        html += `<div class="senha-certificado-container" style="margin-top: 0.5rem;">
                    <label style="font-size: 0.9rem; font-weight: bold;">Senha do Certificado:</label>
                    <input type="password" id="senha-cert-${Date.now()}" value="${certificadoObj.senha}" disabled readonly style="font-family: monospace; background-color: #f0f0f0; border: 1px solid #ccc; padding: 0.5rem; border-radius: 4px;">
                    <button type="button" class="btn-show-senha" data-action="revelar-senha">Revelar</button>
                </div>`;
    }
    
    html += `</div>
            </div>
            ${arquivoMissing ? 
                '<button class="btn-download" disabled style="opacity: 0.5; cursor: not-allowed;" title="Arquivo não disponível">Arquivo Indisponível</button>' :
                `<a href="${caminho}" target="_blank" rel="noopener noreferrer" data-caminho="${caminho}" data-nome="${nomeArquivo}" class="link-verificar-arquivo">
                    <button class="btn-download">Visualizar / Baixar</button>
                </a>`
            }
        </li>`;
    
    return html;
}

function mostrarLoading(mostrar) { document.getElementById('loading').style.display = mostrar ? 'block' : 'none'; }
function mostrarConteudo() { document.getElementById('content').style.display = 'block'; }
function esconderConteudo() { document.getElementById('content').style.display = 'none'; }
function mostrarErro(msg) {
    const errorContainer = document.getElementById('error-container');
    document.getElementById('error-message').textContent = msg;
    errorContainer.style.display = 'block';
}
function esconderErro() { document.getElementById('error-container').style.display = 'none'; }

// --- Funções de Formatação ---
function formatarCNPJ(cnpj) { return cnpj ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : ''; }
function formatarCPF(cpf) { return cpf ? cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : ''; }
function formatarData(data) { return data ? new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : ''; }
function formatarBooleano(valor) { return valor === 'sim' ? 'Sim' : 'Não'; }

function formatarEstadoCivil(estado, regime) {
    if (!estado) return 'Não informado';

    const mapaEstadoCivil = {
        'solteiro': 'Solteiro(a)',
        'casado': 'Casado(a)',
        'uniao_estavel': 'União Estável',
        'divorciado': 'Divorciado(a)',
        'viuvo': 'Viúvo(a)'
    };

    const estadoFormatado = mapaEstadoCivil[estado] || estado;
    const regimeFormatado = regime ? ` (${regime.replace(/_/g, ' ')})` : '';

    return estado === 'casado' ? `${estadoFormatado}${regimeFormatado}` : estadoFormatado;
}

// Função para verificar se arquivo existe antes de abrir
async function verificarArquivo(caminho, nomeArquivo) {
    try {
        const response = await fetch(caminho, { method: 'HEAD' });
        if (!response.ok) {
            if (typeof showToast === 'function') {
                showToast(`❌ Arquivo não encontrado: ${nomeArquivo}\n\nO arquivo pode ter sido movido ou excluído do servidor.\nCaminho: ${caminho}`, 'error', 5000);
            } else {
                alert(`❌ Arquivo não encontrado: ${nomeArquivo}\n\nO arquivo pode ter sido movido ou excluído do servidor.\nCaminho: ${caminho}`);
            }
            return false;
        }
        return true;
    } catch (error) {
        console.error('Erro ao verificar arquivo:', error);
        if (typeof showToast === 'function') {
            showToast(`⚠️ Erro ao acessar o arquivo: ${nomeArquivo}`, 'error', 5000);
        } else {
            alert(`⚠️ Erro ao acessar o arquivo: ${nomeArquivo}`);
        }
        return false;
    }
}

function revelarSenha(botao) {
    // Verifica se o usuário já se autenticou nesta sessão
    if (!senhaAutenticadaTemp) {
        abrirModalAutenticacao();
        return;
    }

    // Se já autenticado, alterna visibilidade
    const input = botao.previousElementSibling;
    if (input.type === 'password') {
        input.type = 'text';
        botao.textContent = 'Ocultar';
    } else {
        input.type = 'password';
        botao.textContent = 'Revelar';
    }
}

function abrirModalAutenticacao() {
    document.getElementById('authModalCertificado').classList.add('show');
    document.getElementById('auth-password').focus();
    document.getElementById('auth-error').style.display = 'none';
}

function fecharModalAutenticacao() {
    document.getElementById('authModalCertificado').classList.remove('show');
    document.getElementById('auth-password').value = '';
    document.getElementById('auth-error').style.display = 'none';
}

async function autenticarSenha(event) {
    event.preventDefault();
    const senha = document.getElementById('auth-password').value;
    
    try {
        // Valida a senha contra o servidor
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: usuario.email, senha: senha })
        });

        if (response.ok) {
            // Autenticação bem-sucedida
            senhaAutenticadaTemp = true;
            fecharModalAutenticacao();
            // Tenta usar showToast se disponível, caso contrário usa alert
            if (typeof showToast === 'function') {
                showToast('Autenticação bem-sucedida! Você pode visualizar a senha do certificado.', 'success', 3000);
            } else {
                alert('Autenticação bem-sucedida! Você pode visualizar a senha do certificado.');
            }
        } else {
            // Falha na autenticação
            document.getElementById('auth-error').textContent = 'Senha incorreta. Tente novamente.';
            document.getElementById('auth-error').style.display = 'block';
            document.getElementById('auth-password').value = '';
            document.getElementById('auth-password').focus();
        }
    } catch (error) {
        console.error('Erro ao autenticar:', error);
        document.getElementById('auth-error').textContent = 'Erro ao processar autenticação. Tente novamente.';
        document.getElementById('auth-error').style.display = 'block';
    }
}

// Fechar modal ao clicar fora dele
function setupModalClickHandler() {
    document.addEventListener('click', (event) => {
        const modal = document.getElementById('authModalCertificado');
        if (event.target === modal) {
            fecharModalAutenticacao();
        }
    });
}

// --- Funções de Seleção de Documentos ---
function atualizarContador() {
    const checkboxes = document.querySelectorAll('.doc-checkbox');
    const selecionados = Array.from(checkboxes).filter(cb => cb.checked);
    document.getElementById('selected-count').textContent = `${selecionados.length} documento(s) selecionado(s)`;
}

function selecionarTodos() {
    document.querySelectorAll('.doc-checkbox').forEach(cb => cb.checked = true);
    atualizarContador();
}

function desselecionarTodos() {
    document.querySelectorAll('.doc-checkbox').forEach(cb => cb.checked = false);
    atualizarContador();
}

function obterDocumentosSelecionados() {
    const checkboxes = document.querySelectorAll('.doc-checkbox:checked');
    return Array.from(checkboxes).map(cb => JSON.parse(cb.getAttribute('data-doc')));
}

// --- Funções de Download ---
async function baixarSelecionados() {
    const docs = obterDocumentosSelecionados();
    
    if (docs.length === 0) {
        alert('Selecione pelo menos um documento para baixar.');
        return;
    }

    if (typeof showToast === 'function') {
        showToast(`Iniciando download de ${docs.length} documento(s)...`, 'info');
    }

    // Baixa cada documento em uma nova aba
    docs.forEach((doc, index) => {
        setTimeout(() => {
            const link = document.createElement('a');
            link.href = doc.caminho;
            link.download = doc.nomeArquivo || '';
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }, index * 500); // Delay de 500ms entre downloads
    });
}

// --- Função de Exclusão de Documentos ---
async function excluirSelecionados() {
    const docs = obterDocumentosSelecionados();
    
    if (docs.length === 0) {
        alert('Selecione pelo menos um documento para excluir.');
        return;
    }

    // Confirmação de exclusão
    const confirmacao = confirm(
        `Tem certeza que deseja excluir ${docs.length} documento(s)?\n\n` +
        'Esta ação não pode ser desfeita!\n\n' +
        'Documentos que serão excluídos:\n' +
        docs.map((doc, i) => `${i + 1}. ${doc.nome}`).join('\n')
    );

    if (!confirmacao) {
        return;
    }

    try {
        const btnExcluir = document.querySelector('.btn-delete');
        const textoOriginal = btnExcluir.textContent;
        btnExcluir.textContent = 'Excluindo...';
        btnExcluir.disabled = true;

        // Preparar dados para envio
        const documentosParaExcluir = docs.map(doc => ({
            tipo: doc.tipo,
            caminho: doc.caminho
        }));

        // Enviar requisição de exclusão
        const response = await fetchWithAuth(`/api/empresas/${empresaId}/documentos/excluir`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ documentos: documentosParaExcluir })
        });

        if (!response || !response.ok) {
            const error = await response.json();
            throw new Error(error.msg || 'Erro ao excluir documentos');
        }

        const result = await response.json();

        // Mostrar resultado
        if (typeof showToast === 'function') {
            showToast(
                `${result.excluidos} documento(s) excluído(s) com sucesso!`,
                'success'
            );
        } else {
            alert(`${result.excluidos} documento(s) excluído(s) com sucesso!`);
        }

        // Recarregar a página para atualizar a lista
        setTimeout(() => {
            window.location.reload();
        }, 1500);

    } catch (error) {
        console.error('Erro ao excluir documentos:', error);
        alert('Erro ao excluir documentos: ' + error.message);
        
        // Restaurar botão
        const btnExcluir = document.querySelector('.btn-delete');
        if (btnExcluir) {
            btnExcluir.textContent = '🗑️ Excluir Selecionados';
            btnExcluir.disabled = false;
        }
    }
}

// --- Função para Gerar Relatório PDF Completo ---
function prepararImpressao() {
    // Atualizar data e hora da impressão
    const agora = new Date();
    const dataHora = agora.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('print-datetime').textContent = dataHora;
    
    // Mostrar rodapé apenas para impressão
    const footer = document.querySelector('.print-footer');
    if (footer) {
        footer.style.display = 'block';
    }
    
    // Imprimir
    window.print();
    
    // Ocultar rodapé após impressão
    setTimeout(() => {
        if (footer) {
            footer.style.display = 'none';
        }
    }, 100);
}

function abrirSelecionados() {
    const docs = obterDocumentosSelecionados();
    
    if (docs.length === 0) {
        alert('Selecione pelo menos um documento para abrir.');
        return;
    }

    // Filtrar apenas PDFs
    const pdfs = docs.filter(doc => doc.caminho && doc.caminho.toLowerCase().endsWith('.pdf'));

    if (pdfs.length === 0) {
        alert('Nenhum documento PDF selecionado. Apenas arquivos PDF podem ser abertos em abas.');
        return;
    }

    const confirmar = confirm(
        `Deseja abrir ${pdfs.length} documento(s) PDF em novas abas?\n\n` +
        'IMPORTANTE: Clique em "Permitir" quando o navegador solicitar permissão para abrir pop-ups.\n\n' +
        'Documentos:\n' + pdfs.map(p => `• ${p.nome}`).join('\n')
    );

    if (!confirmar) return;

    // Abrir cada PDF em nova aba com delay progressivo
    let contador = 0;
    pdfs.forEach((pdf, index) => {
        setTimeout(() => {
            const janela = window.open(pdf.caminho, '_blank');
            contador++;
            
            if (typeof showToast === 'function') {
                showToast(`Abrindo ${contador}/${pdfs.length}: ${pdf.nome}`, 'info', 2000);
            }
            
            // Se a janela foi bloqueada
            if (!janela || janela.closed || typeof janela.closed == 'undefined') {
                alert(`⚠️ Pop-up bloqueado!\n\nO navegador bloqueou a abertura de "${pdf.nome}".\n\nPor favor, clique no ícone de pop-up bloqueado na barra de endereços e permita pop-ups para este site. Depois tente novamente.`);
            }
        }, index * 800); // Delay de 800ms entre cada abertura
    });
}

function gerarRelatorioCompleto() {
    if (!empresaAtual) {
        alert('Dados da empresa não carregados.');
        return;
    }

    const opcao = confirm(
        '📄 RELATÓRIO COMPLETO\n\n' +
        'Escolha uma opção:\n\n' +
        'OK = Imprimir relatório de informações + Abrir PDFs selecionados em abas separadas\n' +
        'Cancelar = Apenas imprimir relatório de informações\n\n' +
        'Dica: Selecione os documentos que deseja incluir antes de gerar o relatório completo.'
    );

    if (opcao) {
        // Abrir PDFs selecionados primeiro
        abrirSelecionados();
        
        // Aguardar um pouco e então imprimir o relatório
        setTimeout(() => {
            if (typeof showToast === 'function') {
                showToast('Gerando relatório de informações...', 'info');
            }
            prepararImpressao();
        }, 1000);
    } else {
        // Apenas imprimir o relatório
        prepararImpressao();
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // Botões de navegação
    document.querySelectorAll('[data-action="voltar"]').forEach(btn => {
        btn.addEventListener('click', () => {
            window.history.back();
        });
    });

    // Editar empresa
    const btnEditar = document.querySelector('[data-action="editar"]');
    if (btnEditar) {
        btnEditar.addEventListener('click', () => {
            window.location.href = `editar.html?id=${empresaId}`;
        });
    }

    // Seleção de documentos
    const btnSelectAll = document.getElementById('btn-select-all');
    if (btnSelectAll) {
        btnSelectAll.addEventListener('click', selecionarTodos);
    }

    const btnDeselectAll = document.getElementById('btn-deselect-all');
    if (btnDeselectAll) {
        btnDeselectAll.addEventListener('click', desselecionarTodos);
    }

    // Ações com documentos
    const btnPrint = document.getElementById('btn-print');
    if (btnPrint) {
        btnPrint.addEventListener('click', prepararImpressao);
    }

    const btnPdf = document.getElementById('btn-pdf');
    if (btnPdf) {
        btnPdf.addEventListener('click', gerarRelatorioCompleto);
    }

    const btnDownload = document.querySelector('[data-action="baixar"]');
    if (btnDownload) {
        btnDownload.addEventListener('click', baixarSelecionados);
    }

    const btnDelete = document.querySelector('[data-action="excluir"]');
    if (btnDelete) {
        btnDelete.addEventListener('click', excluirSelecionados);
    }

    // Autenticação de senha
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', autenticarSenha);
    }

    const btnCancelAuth = document.getElementById('btn-cancel-auth');
    if (btnCancelAuth) {
        btnCancelAuth.addEventListener('click', fecharModalAutenticacao);
    }

    // Event delegation para checkboxes dinâmicos
    document.getElementById('documentos-lista').addEventListener('change', (e) => {
        if (e.target.classList.contains('doc-checkbox')) {
            atualizarContador();
        }
    });

    // Event delegation para botões de revelar senha dinâmicos
    document.getElementById('documentos-lista').addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-show-senha')) {
            revelarSenha(e.target);
        }
    });

    // Event delegation para links de verificar arquivo dinâmicos
    document.getElementById('documentos-lista').addEventListener('click', async (e) => {
        if (e.target.closest('.link-verificar-arquivo')) {
            e.preventDefault();
            const link = e.target.closest('.link-verificar-arquivo');
            const caminho = link.getAttribute('data-caminho');
            const nome = link.getAttribute('data-nome');
            const podeAbrir = await verificarArquivo(caminho, nome);
            if (podeAbrir) {
                window.open(caminho, '_blank', 'noopener,noreferrer');
            }
        }
    });

    // Setup modal click handler
    setupModalClickHandler();
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await getUsuario();
    carregarDadosEmpresa();
    setupEventListeners();
});
