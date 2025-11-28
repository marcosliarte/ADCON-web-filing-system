// === cliente-formulario.js ===
// Lógica do formulário de cadastro de empresa

let currentStep = 1;
const totalSteps = 3;
let socioIndex = 0;
let contratoIndex = 1;

// === MÁSCARAS ===
const maskCnpj = (value) => value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d)/, '$1-$2').slice(0, 18);
const maskCpf = (value) => value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14);
const maskCep = (value) => value.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 9);
const maskPhone = (value) => value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 15);
const maskCnae = (value) => value.replace(/\D/g, '').replace(/^(\d{4})(\d)/, '$1-$2').replace(/-(\d{1})(\d)/, '-$1/$2').slice(0, 9);
const maskCurrency = (value) => {
    let v = value.replace(/\D/g, '');
    v = (v / 100).toFixed(2) + '';
    v = v.replace(".", ",");
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    return 'R$ ' + v;
};

function formatInput(input, maskFunction) {
    input.addEventListener('input', (e) => {
        e.target.value = maskFunction(e.target.value);
    });
}

function setupInitialMasks() {
    formatInput(document.getElementById('cnpj'), maskCnpj);
    formatInput(document.getElementById('matriz_cnpj'), maskCnpj);
    formatInput(document.getElementById('cep'), maskCep);
    formatInput(document.getElementById('telefone'), maskPhone);
    formatInput(document.getElementById('atividade_principal'), maskCnae);
    formatInput(document.getElementById('capital_social'), maskCurrency);
}

function applyMasks(container) {
    formatInput(container.querySelector('input[name$="[cpf]"]'), maskCpf);
    formatInput(container.querySelector('input[name$="[endereco][cep]"]'), maskCep);
}

// === NAVEGAÇÃO DE ETAPAS ===
function showStep(step) {
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');

    document.getElementById('prevBtn').style.display = step === 1 ? 'none' : 'inline-block';
    document.getElementById('nextBtn').style.display = step === totalSteps ? 'none' : 'inline-block';
    document.getElementById('submitBtn').style.display = step === totalSteps ? 'inline-block' : 'none';
}

function mudarEtapa(n) {
    if (n > 0 && !validateStep(currentStep)) {
        alert('Por favor, preencha todos os campos obrigatórios antes de avançar.');
        return;
    }
    currentStep += n;
    showStep(currentStep);
}

function validateStep(step) {
    const currentStepDiv = document.getElementById(`step-${step}`);
    const inputs = currentStepDiv.querySelectorAll('input[required], select[required]');
    for (const input of inputs) {
        if (!input.value.trim()) {
            input.style.borderColor = 'red';
            return false;
        }
        input.style.borderColor = '#ccc';
    }
    return true;
}

// === TIPO DE EMPRESA ===
function toggleMatrizSelect() {
    const tipo = document.querySelector('input[name="tipo"]:checked').value;
    const container = document.getElementById('matriz-fields-container');

    if (tipo === 'filial') {
        container.style.display = 'grid';
    } else {
        container.style.display = 'none';
    }
}

async function buscarMatrizPeloBotao() {
    const cnpjInput = document.getElementById('matriz_cnpj');
    const cnpj = cnpjInput.value.replace(/\D/g, '');
    await buscarMatrizPorCnpj(cnpj);
}

async function buscarMatrizPorCnpj(cnpj) {
    const nomeInput = document.getElementById('matriz_nome');
    const matrizIdInput = document.getElementById('matriz_id');

    if (cnpj.length !== 14) {
        alert('Por favor, digite um CNPJ válido com 14 dígitos.');
        nomeInput.readOnly = false;
        nomeInput.placeholder = 'Digite o nome da matriz manualmente';
        nomeInput.style.backgroundColor = 'white';
        if (matrizIdInput) matrizIdInput.value = '';
        return;
    }

    try {
        const response = await fetchWithAuth(`/api/empresas/cnpj/${cnpj}`);
        if (response && response.ok) {
            const empresa = await response.json();
            nomeInput.value = empresa.nome;
            nomeInput.placeholder = '';
            nomeInput.readOnly = true;
            nomeInput.style.backgroundColor = '#e9ecef';
            if (matrizIdInput) matrizIdInput.value = empresa._id;
        } else {
            nomeInput.value = '';
            nomeInput.placeholder = 'Matriz não encontrada. Digite o nome aqui.';
            nomeInput.readOnly = false;
            nomeInput.style.backgroundColor = 'white';
            if (matrizIdInput) matrizIdInput.value = '';
        }
    } catch (error) {
        console.error('Erro ao buscar matriz por CNPJ:', error);
        nomeInput.value = 'Erro ao buscar. Tente novamente.';
        nomeInput.readOnly = true;
        nomeInput.style.backgroundColor = '#e9ecef';
        if (matrizIdInput) matrizIdInput.value = '';
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

function adicionarSocio() {
    const template = document.getElementById('socio-template').innerHTML;
    const container = document.getElementById('socios-container');
    const newSocio = document.createElement('div');
    newSocio.innerHTML = template.replace(/INDEX/g, socioIndex);
    container.appendChild(newSocio);
    applyMasks(newSocio);
    socioIndex++;
    atualizarLabelsSocios();
}

function adicionarAlteracaoContrato() {
    if (contratoIndex >= 50) {
        alert('Limite máximo de 50 contratos atingido. Se precisar adicionar mais, entre em contato com o suporte.');
        return;
    }
    const template = document.getElementById('contrato-template').innerHTML;
    const container = document.getElementById('contratos-container');
    const newContrato = document.createElement('div');
    newContrato.innerHTML = template.replace(/INDEX/g, contratoIndex);
    container.appendChild(newContrato);
    contratoIndex++;
}

function toggleRegimeCasamento(select) {
    const regimeDiv = select.closest('.form-group').nextElementSibling;
    regimeDiv.style.display = select.value === 'casado' ? 'block' : 'none';
}

// === BUSCA CEP ===
async function fetchCep(cep) {
    try {
        const response = await fetchWithAuth(`/api/empresas/cep/${cep}`);
        if (!response || !response.ok) throw new Error('CEP não encontrado ou falha na consulta.');
        const data = await response.json();
        if (data.erro) throw new Error('CEP inválido');
        return data;
    } catch (error) {
        alert(error.message);
        return null;
    }
}

async function buscarCepSocio(cepInput) {
    const cep = cepInput.value.replace(/\D/g, '');
    if (cep.length === 8) {
        const data = await fetchCep(cep);
        if (data) {
            const socioCard = cepInput.closest('.socio-card');
            socioCard.querySelector('input[name$="[endereco][rua]"]').value = data.logradouro;
            socioCard.querySelector('input[name$="[endereco][bairro]"]').value = data.bairro;
            socioCard.querySelector('input[name$="[endereco][cidade]"]').value = data.localidade;
            socioCard.querySelector('input[name$="[endereco][estado]"]').value = data.uf;
        }
    }
}

// === BUSCA CNAE ===
async function buscarCnae() {
    const cnaeInput = document.getElementById('atividade_principal');
    const cnaeCode = cnaeInput.value.replace(/\D/g, '');
    const descInput = document.getElementById('atividade_principal_descricao');

    if (cnaeCode.length === 7) {
        try {
            const response = await fetchWithAuth(`/api/empresas/cnae/${cnaeCode}`);
            const data = await response.json();
            if (data && data.descricao) {
                descInput.value = data.descricao;
            } else {
                descInput.value = 'Código CNAE não encontrado.';
            }
        } catch (error) {
            descInput.value = 'Erro ao buscar descrição do CNAE.';
        }
    }
}

// === ACORDEÃO ===
function setupAccordion() {
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const isActive = header.classList.contains('active');
            
            document.querySelectorAll('.accordion-header').forEach(h => h.classList.remove('active'));
            document.querySelectorAll('.accordion-content').forEach(c => c.style.display = 'none');
            
            if (!isActive) {
                header.classList.add('active');
                content.style.display = 'block';
            }
        });
    });
}

// === EVENT LISTENERS ===
function setupEventListeners() {
    // Tipo de empresa (matriz/filial)
    document.querySelectorAll('input[name="tipo"]').forEach(radio => {
        radio.addEventListener('change', toggleMatrizSelect);
    });

    // Buscar matriz
    const btnBuscarMatriz = document.querySelector('#matriz-fields-container button[type="button"]');
    if (btnBuscarMatriz) {
        btnBuscarMatriz.addEventListener('click', buscarMatrizPeloBotao);
    }

    // Natureza jurídica
    document.querySelectorAll('input[name="natureza_juridica"]').forEach(radio => {
        radio.addEventListener('change', atualizarLabelsSocios);
    });

    // Adicionar sócio
    const btnAddSocio = document.querySelector('.btn-add');
    if (btnAddSocio && btnAddSocio.textContent.includes('Sócio')) {
        btnAddSocio.addEventListener('click', adicionarSocio);
    }

    // Adicionar alteração contratual
    const btnAddContrato = document.querySelectorAll('.btn-add')[1];
    if (btnAddContrato) {
        btnAddContrato.addEventListener('click', adicionarAlteracaoContrato);
    }

    // Navegação de etapas
    document.getElementById('prevBtn').addEventListener('click', () => mudarEtapa(-1));
    document.getElementById('nextBtn').addEventListener('click', () => mudarEtapa(1));

    // Event delegation para botões de remover sócio/alteração
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remover')) {
            const card = e.target.closest('.socio-card') || e.target.closest('.alteracao-card');
            if (card) card.remove();
        }
    });

    // Event delegation para estado civil dos sócios
    document.addEventListener('change', (e) => {
        if (e.target.name && e.target.name.includes('[estado_civil]')) {
            toggleRegimeCasamento(e.target);
        }
    });

    // CEP da empresa
    document.getElementById('cep').addEventListener('blur', async (e) => {
        const cep = e.target.value.replace(/\D/g, '');
        if (cep.length === 8) {
            const data = await fetchCep(cep);
            if (data) {
                document.getElementById('rua').value = data.logradouro;
                document.getElementById('bairro').value = data.bairro;
                document.getElementById('cidade').value = data.localidade;
                document.getElementById('estado').value = data.uf;
                document.getElementById('numero').focus();
            }
        }
    });

    // CNAE
    document.getElementById('atividade_principal').addEventListener('blur', buscarCnae);

    // Formulário
    document.getElementById('formulario-empresa').addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!validateStep(currentStep)) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';

        const formData = new FormData(this);
        const mensagemDiv = document.getElementById('mensagem');

        try {
            const response = await fetchWithAuth('/api/empresas', {
                method: 'POST',
                body: formData
            });

            if (response && response.ok) {
                const result = await response.json();
                mensagemDiv.textContent = 'Empresa cadastrada com sucesso!';
                mensagemDiv.className = 'success';
                mensagemDiv.style.display = 'block';
                setTimeout(() => window.location.href = 'empresas.html', 2000);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.msg || 'Erro ao cadastrar empresa.');
            }
        } catch (error) {
            mensagemDiv.textContent = `Erro: ${error.message}`;
            mensagemDiv.className = 'error';
            mensagemDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Finalizar Cadastro';
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

    showStep(currentStep);
    toggleMatrizSelect();
    adicionarSocio(); // Adiciona o primeiro sócio por padrão
    atualizarLabelsSocios();

    setupInitialMasks();
    setupAccordion();
    setupEventListeners();
});
