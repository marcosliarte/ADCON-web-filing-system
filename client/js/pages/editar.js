// === editar.js ===
// Lógica do formulário de edição de empresa (similar a cliente-formulario.js)

// Verificar autenticação antes de carregar a página
if (!localStorage.getItem('token')) {
    window.location.replace('login.html');
}

let socioIndex = 0;
let contratoIndex = 0;
let balancoIndex = 0;
let diversoIndex = 0;
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
        console.log('Carregando empresa ID:', empresaId);
        const response = await fetchWithAuth(`/api/empresas/${empresaId}`);
        if (!response || !response.ok) {
            const errorText = await response.text();
            console.error('Erro na resposta:', response.status, errorText);
            throw new Error('Falha ao carregar dados da empresa.');
        }
        
        const data = await response.json();
        console.log('Dados da empresa recebidos:', data);

        // Helper para setar valores com segurança
        const setValue = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.value = value || '';
            } else {
                console.warn(`Elemento não encontrado: ${id}`);
            }
        };

        // Preencher campos básicos
        setValue('cnpj', data.cnpj);
        setValue('inscricao_estadual', data.inscricao_estadual);
        setValue('data_abertura', data.data_abertura ? data.data_abertura.split('T')[0] : '');
        setValue('nome_empresarial', data.nome);
        setValue('nome_fantasia', data.nome_fantasia);
        setValue('nire', data.nire);
        setValue('capital_social', data.capital_social);
        setValue('atividade_principal', data.atividade_principal);
        setValue('atividade_principal_descricao', data.atividade_principal_descricao);
        setValue('email', data.email);
        setValue('telefone', data.telefone);

        // Radio buttons
        if (data.porte) {
            const porteRadio = document.querySelector(`input[name="porte"][value="${data.porte}"]`);
            if (porteRadio) porteRadio.checked = true;
        }
        if (data.natureza_juridica) {
            const naturezaRadio = document.querySelector(`input[name="natureza_juridica"][value="${data.natureza_juridica}"]`);
            if (naturezaRadio) naturezaRadio.checked = true;
        }
        if (data.simples_nacional) {
            const simplesRadio = document.querySelector(`input[name="simples_nacional"][value="${data.simples_nacional}"]`);
            if (simplesRadio) simplesRadio.checked = true;
        }
        if (data.possui_filial) {
            const possuiFilialRadio = document.querySelector(`input[name="possui_filial"][value="${data.possui_filial}"]`);
            if (possuiFilialRadio) possuiFilialRadio.checked = true;
        }

        // Tipo de empresa (matriz/filial)
        if (data.tipo) {
            const tipoRadio = document.querySelector(`input[name="tipo"][value="${data.tipo}"]`);
            if (tipoRadio) {
                tipoRadio.checked = true;
                toggleMatrizFields();
                togglePossuiFilialField();
            }
        }
        
        // Dados da matriz (se for filial)
        if (data.tipo === 'filial' && data.matriz_id) {
            if (typeof data.matriz_id === 'object' && data.matriz_id._id) {
                setValue('matriz_id', data.matriz_id._id);
                setValue('matriz_nome', data.matriz_id.nome);
                setValue('matriz_cnpj', data.matriz_id.cnpj);
            } else {
                setValue('matriz_id', data.matriz_id);
            }
        }

        // Endereço
        if (data.endereco) {
            setValue('cep', data.endereco.cep);
            setValue('rua', data.endereco.rua);
            setValue('numero', data.endereco.numero);
            setValue('complemento', data.endereco.complemento);
            setValue('bairro', data.endereco.bairro);
            setValue('cidade', data.endereco.cidade);
            setValue('estado', data.endereco.estado);
        }

        // Sócios
        console.log('Carregando sócios:', data.socios);
        if (data.socios && data.socios.length > 0) {
            data.socios.forEach(socio => {
                try {
                    adicionarSocio(socio);
                } catch (err) {
                    console.error('Erro ao adicionar sócio:', err, socio);
                }
            });
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
        console.log('Carregando contratos:', data.documentos?.contratos);
        if (data.documentos && data.documentos.contratos && data.documentos.contratos.length > 0) {
            data.documentos.contratos.forEach(contrato => {
                try {
                    adicionarAlteracaoContrato(contrato);
                } catch (err) {
                    console.error('Erro ao adicionar contrato:', err, contrato);
                }
            });
        }

        // Balanços Patrimoniais
        console.log('Carregando balanços patrimoniais:', data.documentos?.balancosPatrimoniais);
        if (data.documentos && data.documentos.balancosPatrimoniais && data.documentos.balancosPatrimoniais.length > 0) {
            data.documentos.balancosPatrimoniais.forEach(balanco => {
                try {
                    adicionarBalancoPatrimonial(balanco);
                } catch (err) {
                    console.error('Erro ao adicionar balanço:', err, balanco);
                }
            });
        }

        // Documentos Diversos
        console.log('Carregando documentos diversos:', data.documentos?.documentosDiversos);
        if (data.documentos && data.documentos.documentosDiversos && data.documentos.documentosDiversos.length > 0) {
            data.documentos.documentosDiversos.forEach(documento => {
                try {
                    adicionarDocumentoDiverso(documento);
                } catch (err) {
                    console.error('Erro ao adicionar documento diverso:', err, documento);
                }
            });
        }

        atualizarLabelsSocios();
        console.log('Empresa carregada com sucesso!');
    } catch (error) {
        console.error('Erro ao carregar empresa:', error);
        showMessage(`Erro ao carregar dados da empresa: ${error.message}`, 'error');
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
    console.log('Adicionando sócio:', socio);
    const template = document.getElementById('socio-template');
    const container = document.getElementById('socios-container');
    
    if (!template || !container) {
        console.error('Template ou container de sócios não encontrado');
        return;
    }
    
    const newSocioDiv = document.createElement('div');
    newSocioDiv.innerHTML = template.innerHTML.replace(/INDEX/g, socioIndex);
    
    if (socio) {
        const setInputValue = (name, value) => {
            const input = newSocioDiv.querySelector(`[name="${name}"]`);
            if (input) {
                input.value = value || '';
            } else {
                console.warn(`Input não encontrado: ${name}`);
            }
        };
        
        setInputValue(`socios[${socioIndex}][nome]`, socio.nome);
        setInputValue(`socios[${socioIndex}][cpf]`, socio.cpf);
        setInputValue(`socios[${socioIndex}][rg]`, socio.rg);
        setInputValue(`socios[${socioIndex}][orgao_emissor]`, socio.orgao_emissor);
        setInputValue(`socios[${socioIndex}][estado_emissor]`, socio.estado_emissor);
        setInputValue(`socios[${socioIndex}][data_nascimento]`, socio.data_nascimento ? socio.data_nascimento.split('T')[0] : '');
        setInputValue(`socios[${socioIndex}][genero]`, socio.genero || 'masculino');
        setInputValue(`socios[${socioIndex}][is_admin]`, socio.is_admin || 'nao');

        const estadoCivilSelect = newSocioDiv.querySelector(`select[name="socios[${socioIndex}][estado_civil]"]`);
        if (estadoCivilSelect && socio.estado_civil) {
            estadoCivilSelect.value = socio.estado_civil;
            toggleRegimeCasamento(estadoCivilSelect);
            setInputValue(`socios[${socioIndex}][regime_casamento]`, socio.regime_casamento || 'comunhao_parcial');
        }

        if (socio.endereco) {
            setInputValue(`socios[${socioIndex}][endereco][cep]`, socio.endereco.cep);
            setInputValue(`socios[${socioIndex}][endereco][rua]`, socio.endereco.rua);
            setInputValue(`socios[${socioIndex}][endereco][numero]`, socio.endereco.numero);
            setInputValue(`socios[${socioIndex}][endereco][complemento]`, socio.endereco.complemento);
            setInputValue(`socios[${socioIndex}][endereco][bairro]`, socio.endereco.bairro);
            setInputValue(`socios[${socioIndex}][endereco][cidade]`, socio.endereco.cidade);
            setInputValue(`socios[${socioIndex}][endereco][estado]`, socio.endereco.estado);
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

function adicionarBalancoPatrimonial(balanco = null) {
    const template = document.getElementById('balanco-template').innerHTML;
    const container = document.getElementById('balancos-container');
    const newBalancoDiv = document.createElement('div');
    newBalancoDiv.innerHTML = template.replace(/INDEX/g, balancoIndex);

    if (balanco) {
        newBalancoDiv.querySelector(`input[name="balanco_patrimonial[${balancoIndex}][ano]"]`).value = balanco.ano || '';
        const fileInfo = newBalancoDiv.querySelector('.file-info');
        if (balanco.caminhoArquivo) {
            fileInfo.innerHTML = `Arquivo atual: <a href="${balanco.caminhoArquivo}" target="_blank">${balanco.nomeArquivo}</a>`;
        }
    }

    container.appendChild(newBalancoDiv);
    balancoIndex++;
}

function adicionarDocumentoDiverso(documento = null) {
    if (diversoIndex >= 50) {
        alert('Limite máximo de 50 documentos atingido.');
        return;
    }
    const template = document.getElementById('diverso-template').innerHTML;
    const container = document.getElementById('diversos-container');
    const newDiversoDiv = document.createElement('div');
    newDiversoDiv.innerHTML = template.replace(/INDEX/g, diversoIndex);

    if (documento) {
        const nomeInput = newDiversoDiv.querySelector(`input[name="documento_diverso[${diversoIndex}][nome]"]`);
        if (nomeInput) nomeInput.value = documento.nomeDocumento || '';

        if (documento.dataValidade) {
            const validadeInput = newDiversoDiv.querySelector(`input[name="documento_diverso[${diversoIndex}][validade]"]`);
            if (validadeInput) validadeInput.value = documento.dataValidade.split('T')[0];
        }

        const fileInfo = newDiversoDiv.querySelector('.file-info');
        if (documento.caminhoArquivo && fileInfo) {
            fileInfo.innerHTML = `Arquivo atual: <a href="${documento.caminhoArquivo}" target="_blank">${documento.nomeArquivo}</a>`;
        }

        const fileInput = newDiversoDiv.querySelector(`input[name="documento_diverso[${diversoIndex}][arquivo]"]`);
        if (fileInput) fileInput.removeAttribute('required');
    }

    container.appendChild(newDiversoDiv);
    diversoIndex++;
}

async function fetchCep(cep) {
    try {
        const response = await fetchWithAuth(`/api/empresas/cep/${cep}`);
        if (!response || !response.ok) throw new Error('CEP não encontrado.');
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
    // Tipo de empresa (matriz/filial)
    document.querySelectorAll('input[name="tipo"]').forEach(radio => {
        radio.addEventListener('change', () => {
            toggleMatrizFields();
            togglePossuiFilialField();
        });
    });
    
    // Botão buscar matriz
    const btnBuscarMatriz = document.getElementById('btn-buscar-matriz');
    if (btnBuscarMatriz) {
        btnBuscarMatriz.addEventListener('click', buscarMatriz);
    }
    
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

    // Adicionar balanço patrimonial
    const btnAddBalanco = document.getElementById('btn-add-balanco');
    if (btnAddBalanco) {
        btnAddBalanco.addEventListener('click', adicionarBalancoPatrimonial);
    }

    // Adicionar documento diverso
    const btnAddDiverso = document.getElementById('btn-add-diverso');
    if (btnAddDiverso) {
        btnAddDiverso.addEventListener('click', adicionarDocumentoDiverso);
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

// === TIPO DE EMPRESA E MATRIZ ===
function toggleMatrizFields() {
    const tipoFilial = document.getElementById('tipo_filial');
    const matrizFieldsContainer = document.getElementById('matriz-fields-container');
    
    if (tipoFilial && matrizFieldsContainer) {
        matrizFieldsContainer.style.display = tipoFilial.checked ? 'block' : 'none';
    }
}

function togglePossuiFilialField() {
    const tipoMatriz = document.getElementById('tipo_matriz');
    const possuiFilialGroup = document.getElementById('possui-filial-group');
    
    if (tipoMatriz && possuiFilialGroup) {
        // Só mostra "Possui Filial?" se for tipo Matriz
        possuiFilialGroup.style.display = tipoMatriz.checked ? 'block' : 'none';
        
        // Se for filial, limpar a seleção de possui_filial
        if (!tipoMatriz.checked) {
            const possuiFilialRadios = document.querySelectorAll('input[name="possui_filial"]');
            possuiFilialRadios.forEach(radio => radio.checked = false);
        }
    }
}

async function buscarMatriz() {
    const cnpjMatriz = document.getElementById('matriz_cnpj').value.replace(/\D/g, '');
    
    if (!cnpjMatriz || cnpjMatriz.length !== 14) {
        showMessage('Digite um CNPJ válido da matriz.', 'error');
        return;
    }
    
    try {
        const response = await fetchWithAuth(`/api/empresas?cnpj=${cnpjMatriz}`);
        const data = await response.json();
        
        if (data.empresas && data.empresas.length > 0) {
            const matriz = data.empresas[0];
            document.getElementById('matriz_nome').value = matriz.nome;
            document.getElementById('matriz_id').value = matriz._id;
            showMessage('Matriz encontrada com sucesso!', 'success');
        } else {
            showMessage('Matriz não encontrada. Você pode cadastrá-la sem vincular a uma matriz.', 'warning');
            document.getElementById('matriz_nome').value = '';
            document.getElementById('matriz_id').value = '';
        }
    } catch (error) {
        showMessage('Erro ao buscar matriz: ' + error.message, 'error');
    }
}

// === ACORDEÕES ===
function inicializarAcordeoes() {
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    
    accordionHeaders.forEach(header => {
        // Abrir o primeiro acordeão por padrão
        if (header === accordionHeaders[0]) {
            const content = header.nextElementSibling;
            if (content) content.classList.add('show');
        }

        header.addEventListener('click', function() {
            const content = this.nextElementSibling;
            
            if (content.classList.contains('show')) {
                content.classList.remove('show');
            } else {
                content.classList.add('show');
            }
        });
    });
}

// === INICIALIZAÇÃO ===
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded - Iniciando...');
    
    // Inicializar acordeões PRIMEIRO
    inicializarAcordeoes();
    
    // Carregar cabeçalho
    const response = await fetchWithAuth('/api/auth');
    if (response) {
        const usuario = await response.json();
        createHeader('header-placeholder', usuario);
    }

    await loadEmpresa();
    setupEventListeners();
    
    console.log('Página carregada e dados preenchidos!');
});
