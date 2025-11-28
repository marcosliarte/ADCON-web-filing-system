// === editar.js ===
// Lógica do formulário de edição de empresa (similar a cliente-formulario.js)

// Verificar autenticação antes de carregar a página
if (!localStorage.getItem('token')) {
    window.location.replace('login.html');
}

let socioIndex = 0;
let contratoIndex = 0;
const urlParams = new URLSearchParams(window.location.search);
const empresaId = urlParams.get('id');

// Reutiliza funções de máscara do cliente-formulario.js
const maskCpf = (value) => value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14);
const maskCep = (value) => value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 9);

function formatInput(input, maskFunction) {
    input.addEventListener('input', (e) => {
        e.target.value = maskFunction(e.target.value);
    });
}

// === CARREGAR DADOS DA EMPRESA ===
async function loadEmpresa() {
    if (!empresaId) {
        showMessage('ID da empresa não fornecido.', 'error');
        return;
    }

    try {
        const response = await fetchWithAuth(`/api/empresas/${empresaId}`);
        if (!response || !response.ok) throw new Error('Falha ao carregar dados da empresa.');
        
        const data = await response.json();

        // Preencher campos básicos
        document.getElementById('cnpj').value = data.cnpj || '';
        document.getElementById('inscricao_estadual').value = data.inscricao_estadual || '';
        document.getElementById('data_abertura').value = data.data_abertura ? data.data_abertura.split('T')[0] : '';
        document.getElementById('nome_empresarial').value = data.nome || '';
        document.getElementById('nome_fantasia').value = data.nome_fantasia || '';
        document.getElementById('nire').value = data.nire || '';
        document.getElementById('capital_social').value = data.capital_social || '';
        document.getElementById('atividade_principal').value = data.atividade_principal || '';
        document.getElementById('atividade_principal_descricao').value = data.atividade_principal_descricao || '';
        document.getElementById('email').value = data.email || '';
        document.getElementById('telefone').value = data.telefone || '';

        // Radio buttons
        if (data.porte) document.querySelector(`input[name="porte"][value="${data.porte}"]`).checked = true;
        if (data.natureza_juridica) document.querySelector(`input[name="natureza_juridica"][value="${data.natureza_juridica}"]`).checked = true;

        // Endereço
        if (data.endereco) {
            document.getElementById('cep').value = data.endereco.cep || '';
            document.getElementById('rua').value = data.endereco.rua || '';
            document.getElementById('numero').value = data.endereco.numero || '';
            document.getElementById('bairro').value = data.endereco.bairro || '';
            document.getElementById('cidade').value = data.endereco.cidade || '';
            document.getElementById('estado').value = data.endereco.estado || '';
        }

        // Sócios
        if (data.socios && data.socios.length > 0) {
            data.socios.forEach(socio => adicionarSocio(socio));
        }

        // Documentos - criar info de arquivo existente
        if (data.documentos) {
            const criarInfoArquivo = (doc, infoDivId, hiddenInputName) => {
                if (doc && doc.caminhoArquivo) {
                    const infoDiv = document.getElementById(infoDivId);
                    infoDiv.innerHTML = `Arquivo atual: <a href="${doc.caminhoArquivo}" target="_blank">${doc.nomeArquivo}</a> <button type="button" class="btn-remover">Remover Arquivo</button>`;
                    infoDiv.querySelector('.btn-remover').addEventListener('click', () => {
                        infoDiv.innerHTML = '<span style="color: #dc3545;">Arquivo será removido ao salvar.</span>';
                        document.querySelector(`input[name="${hiddenInputName}"]`).value = 'true';
                    });
                }
            };

            criarInfoArquivo(data.documentos.cartaoCnpj, 'info_arquivo_cnpj', 'remover_arquivo_cnpj');
            criarInfoArquivo(data.documentos.certificadoDigital, 'info_certificado_digital', 'remover_certificado_digital');
            criarInfoArquivo(data.documentos.alvara, 'info_alvara_arquivo', 'remover_alvara_arquivo');
            criarInfoArquivo(data.documentos.certidaoPrefeitura, 'info_certidao_prefeitura_arquivo', 'remover_certidao_prefeitura_arquivo');
            criarInfoArquivo(data.documentos.certidaoReceita, 'info_certidao_receita_arquivo', 'remover_certidao_receita_arquivo');
            criarInfoArquivo(data.documentos.certidaoFGTS, 'info_certidao_fgts_arquivo', 'remover_certidao_fgts_arquivo');
            criarInfoArquivo(data.documentos.certidaoTrabalhista, 'info_certidao_trabalhista_arquivo', 'remover_certidao_trabalhista_arquivo');
            criarInfoArquivo(data.documentos.inscricaoEstadual, 'info_inscricao_estadual_arquivo', 'remover_inscricao_estadual_arquivo');
            criarInfoArquivo(data.documentos.certidaoSefaz, 'info_certidao_sefaz_arquivo', 'remover_certidao_sefaz_arquivo');
            criarInfoArquivo(data.documentos.certidaoFalencia, 'info_certidao_falencia_arquivo', 'remover_certidao_falencia_arquivo');
        }

        // Contratos
        if (data.documentos && data.documentos.contratos && data.documentos.contratos.length > 0) {
            data.documentos.contratos.forEach(contrato => adicionarAlteracaoContrato(contrato));
        }

        atualizarLabelsSocios();
    } catch (error) {
        console.error('Erro ao carregar empresa:', error);
        showMessage('Erro ao carregar dados da empresa.', 'error');
    }
}

// === NATUREZA JURÍDICA E SÓCIOS ===
function atualizarLabelsSocios() {
    const natureza = document.querySelector('input[name="natureza_juridica"]:checked')?.value;
    const isIndividual = natureza === 'Individual';
    
    document.querySelectorAll('.label-socio-tipo').forEach(label => {
        label.textContent = isIndividual ? 'Titular da Empresa' : 'Sócio Administrador?';
    });
    
    document.querySelectorAll('.select-socio-tipo').forEach(select => {
        const valorAtual = select.value;
        if (isIndividual) {
            select.innerHTML = '<option value="sim">Sim, é o Titular</option>';
            select.value = 'sim';
        } else {
            select.innerHTML = '<option value="nao">Não</option><option value="sim">Sim</option>';
            select.value = valorAtual;
        }
    });
}

function adicionarSocio(socio = null) {
    const template = document.getElementById('socio-template').innerHTML;
    const container = document.getElementById('socios-container');
    const newSocioDiv = document.createElement('div');
    newSocioDiv.innerHTML = template.replace(/INDEX/g, socioIndex);
    
    if (socio) {
        newSocioDiv.querySelector(`input[name="socios[${socioIndex}][nome]"]`).value = socio.nome || '';
        newSocioDiv.querySelector(`input[name="socios[${socioIndex}][cpf]"]`).value = socio.cpf || '';
        newSocioDiv.querySelector(`input[name="socios[${socioIndex}][rg]"]`).value = socio.rg || '';
        newSocioDiv.querySelector(`input[name="socios[${socioIndex}][orgao_emissor]"]`).value = socio.orgao_emissor || '';
        newSocioDiv.querySelector(`input[name="socios[${socioIndex}][estado_emissor]"]`).value = socio.estado_emissor || '';
        newSocioDiv.querySelector(`input[name="socios[${socioIndex}][data_nascimento]"]`).value = socio.data_nascimento ? socio.data_nascimento.split('T')[0] : '';
        newSocioDiv.querySelector(`select[name="socios[${socioIndex}][genero]"]`).value = socio.genero || 'masculino';
        newSocioDiv.querySelector(`select[name="socios[${socioIndex}][is_admin]"]`).value = socio.is_admin || 'nao';

        const estadoCivilSelect = newSocioDiv.querySelector(`select[name="socios[${socioIndex}][estado_civil]"]`);
        if (socio.estado_civil) {
            estadoCivilSelect.value = socio.estado_civil;
            toggleRegimeCasamento(estadoCivilSelect);
            newSocioDiv.querySelector(`select[name="socios[${socioIndex}][regime_casamento]"]`).value = socio.regime_casamento || 'comunhao_parcial';
        }

        if (socio.endereco) {
            newSocioDiv.querySelector(`input[name="socios[${socioIndex}][endereco][cep]"]`).value = socio.endereco.cep || '';
            newSocioDiv.querySelector(`input[name="socios[${socioIndex}][endereco][rua]"]`).value = socio.endereco.rua || '';
            newSocioDiv.querySelector(`input[name="socios[${socioIndex}][endereco][numero]"]`).value = socio.endereco.numero || '';
            newSocioDiv.querySelector(`input[name="socios[${socioIndex}][endereco][complemento]"]`).value = socio.endereco.complemento || '';
            newSocioDiv.querySelector(`input[name="socios[${socioIndex}][endereco][bairro]"]`).value = socio.endereco.bairro || '';
            newSocioDiv.querySelector(`input[name="socios[${socioIndex}][endereco][cidade]"]`).value = socio.endereco.cidade || '';
            newSocioDiv.querySelector(`input[name="socios[${socioIndex}][endereco][estado]"]`).value = socio.endereco.estado || '';
        }
    }

    container.appendChild(newSocioDiv);
    
    // Aplicar máscaras
    const cpfInput = newSocioDiv.querySelector(`input[name="socios[${socioIndex}][cpf]"]`);
    const cepInput = newSocioDiv.querySelector(`input[name="socios[${socioIndex}][endereco][cep]"]`);
    if (cpfInput) formatInput(cpfInput, maskCpf);
    if (cepInput) formatInput(cepInput, maskCep);
    
    socioIndex++;
    atualizarLabelsSocios();
}

function adicionarAlteracaoContrato(contrato = null) {
    const template = document.getElementById('contrato-template').innerHTML;
    const container = document.getElementById('contratos-container');
    const newContratoDiv = document.createElement('div');
    newContratoDiv.innerHTML = template.replace(/INDEX/g, contratoIndex);

    if (contrato) {
        newContratoDiv.querySelector(`input[name="contrato_social[${contratoIndex}][data]"]`).value = contrato.dataAlteracao ? contrato.dataAlteracao.split('T')[0] : '';
        const fileInfo = newContratoDiv.querySelector('.file-info');
        if (contrato.caminhoArquivo) {
            fileInfo.innerHTML = `Arquivo atual: <a href="${contrato.caminhoArquivo}" target="_blank">${contrato.nomeArquivo}</a>`;
        }
    }

    container.appendChild(newContratoDiv);
    contratoIndex++;
}

function toggleRegimeCasamento(select) {
    const regimeDiv = select.closest('.form-group').nextElementSibling;
    regimeDiv.style.display = select.value === 'casado' ? 'block' : 'none';
}

// === MENSAGENS ===
function showMessage(text, type) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.style.display = 'block';
}

// === EVENT LISTENERS ===
function setupEventListeners() {
    // Natureza jurídica
    document.querySelectorAll('input[name="natureza_juridica"]').forEach(radio => {
        radio.addEventListener('change', atualizarLabelsSocios);
    });

    // Adicionar sócio
    const btnAddSocio = document.querySelector('.btn-add');
    if (btnAddSocio && btnAddSocio.textContent.includes('Sócio')) {
        btnAddSocio.addEventListener('click', () => adicionarSocio());
    }

    // Adicionar alteração contratual
    const btnAddContrato = document.querySelectorAll('.btn-add')[1];
    if (btnAddContrato) {
        btnAddContrato.addEventListener('click', () => adicionarAlteracaoContrato());
    }

    // Botão cancelar
    document.querySelector('.btn-secondary').addEventListener('click', () => {
        window.location.href = 'empresas.html';
    });

    // Event delegation para remover sócio/alteração
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remover')) {
            const card = e.target.closest('.socio-card') || e.target.closest('.alteracao-card');
            if (card && !e.target.closest('[id^="info_"]')) {
                card.remove();
            }
        }
    });

    // Event delegation para estado civil
    document.addEventListener('change', (e) => {
        if (e.target.name && e.target.name.includes('[estado_civil]')) {
            toggleRegimeCasamento(e.target);
        }
    });

    // Formulário
    document.getElementById('formulario-empresa').addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Salvando...';

        const formData = new FormData(this);

        try {
            const response = await fetchWithAuth(`/api/empresas/${empresaId}`, {
                method: 'PUT',
                body: formData
            });

            if (response && response.ok) {
                showMessage('Empresa atualizada com sucesso!', 'success');
                setTimeout(() => window.location.href = 'empresas.html', 2000);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.msg || 'Erro ao atualizar empresa.');
            }
        } catch (error) {
            showMessage(`Erro: ${error.message}`, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Salvar Alterações';
        }
    });
}

// === INICIALIZAÇÃO ===
document.addEventListener('DOMContentLoaded', async () => {
    // Carregar cabeçalho
    const response = await fetchWithAuth('/api/auth');
    if (response) {
        const usuario = await response.json();
        createHeader('header-placeholder', usuario);
    }

    await loadEmpresa();
    setupEventListeners();
});
