// === faturamento.js ===
// Lógica da página de faturamento

let empresas = [];

// === INICIALIZAÇÃO ===
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetchWithAuth('/api/auth');
        if (!response || !response.ok) {
            throw new Error('Falha na autenticação.');
        }
        
        const usuario = await response.json();
        createHeader('header-placeholder', usuario);
        
        if (!['admin', 'gerente', 'funcionario'].includes(usuario.role)) {
            mostrarErro('Acesso negado. Você não tem permissão para acessar esta funcionalidade.');
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 2000);
            return;
        }
        
        carregarEmpresas();
        document.getElementById('periodo-select').value = '6';
        atualizarPeriodo();
        setupEventListeners();
    } catch (error) {
        console.error("Erro na inicialização:", error);
        logout();
    }
});

// === CARREGAR EMPRESAS ===
async function carregarEmpresas() {
    try {
        const response = await fetchWithAuth('/api/empresas?limite=1000');

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Erro ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        empresas = data.docs || data.empresas || data;
        
        if (!Array.isArray(empresas)) {
            console.error('Resposta da API não é um array:', data);
            throw new Error('Formato de resposta inválido');
        }

        const select = document.getElementById('empresa-select');
        
        if (empresas.length === 0) {
            select.innerHTML = '<option value="">Nenhuma empresa cadastrada</option>';
            return;
        }

        empresas.sort((a, b) => a.nome.localeCompare(b.nome));
        preencherSelectEmpresas(empresas);
    } catch (error) {
        console.error('Erro detalhado:', error);
        mostrarErro('Erro ao carregar empresas: ' + error.message);
        const select = document.getElementById('empresa-select');
        if (select) {
            select.innerHTML = '<option value="">Erro ao carregar empresas</option>';
        }
    }
}

function preencherSelectEmpresas(listaEmpresas) {
    const select = document.getElementById('empresa-select');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione uma empresa</option>';
    
    listaEmpresas.forEach(empresa => {
        const option = document.createElement('option');
        option.value = empresa._id;
        option.textContent = `${empresa.nome} - ${empresa.cnpj}`;
        option.dataset.nome = empresa.nome;
        option.dataset.cnpj = empresa.cnpj;
        select.appendChild(option);
    });
}

// === SELEÇÃO DE EMPRESA ===
function selecionarEmpresaDaLista() {
    const select = document.getElementById('empresa-select');
    const searchInput = document.getElementById('empresa-search');
    const empresaIdInput = document.getElementById('empresa-id');
    
    if (!select || !select.value) return;

    const selectedOption = select.options[select.selectedIndex];
    const nome = selectedOption.dataset.nome;
    const cnpj = selectedOption.dataset.cnpj;
    
    if (searchInput && nome && cnpj) {
        searchInput.value = `${nome} - ${cnpj}`;
    }
    if (empresaIdInput) {
        empresaIdInput.value = select.value;
    }
    
    esconderAutocomplete();
}

function selecionarEmpresa(empresa) {
    const searchInput = document.getElementById('empresa-search');
    const empresaIdInput = document.getElementById('empresa-id');
    
    if (searchInput) {
        searchInput.value = `${empresa.nome} - ${empresa.cnpj}`;
    }
    if (empresaIdInput) {
        empresaIdInput.value = empresa._id;
    }
    
    esconderAutocomplete();
}

// === AUTOCOMPLETE ===
function mostrarAutocomplete() {
    const autocompleteList = document.getElementById('autocomplete-list');
    if (autocompleteList) {
        autocompleteList.classList.add('active');
    }
}

function esconderAutocomplete() {
    const autocompleteList = document.getElementById('autocomplete-list');
    if (autocompleteList) {
        autocompleteList.classList.remove('active');
    }
}

function filtrarEmpresas() {
    const searchInput = document.getElementById('empresa-search');
    const autocompleteList = document.getElementById('autocomplete-list');
    
    if (!searchInput || !autocompleteList) {
        return;
    }
    
    const termo = searchInput.value.toLowerCase().trim();
    
    const empresaIdInput = document.getElementById('empresa-id');
    if (empresaIdInput) {
        empresaIdInput.value = '';
    }
    
    if (!termo) {
        autocompleteList.innerHTML = '';
        esconderAutocomplete();
        return;
    }

    const termoNumeros = termo.replace(/\D/g, '');
    
    const empresasFiltradas = empresas.filter(empresa => {
        const nome = empresa.nome.toLowerCase();
        const cnpj = empresa.cnpj.replace(/\D/g, '');
        
        return nome.includes(termo) || (termoNumeros && cnpj.includes(termoNumeros));
    });

    autocompleteList.innerHTML = '';
    
    if (empresasFiltradas.length === 0) {
        autocompleteList.innerHTML = '<div class="autocomplete-empty">Nenhuma empresa encontrada</div>';
        mostrarAutocomplete();
        return;
    }

    empresasFiltradas.forEach(empresa => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = `${empresa.nome} - ${empresa.cnpj}`;
        item.onclick = () => selecionarEmpresa(empresa);
        autocompleteList.appendChild(item);
    });

    mostrarAutocomplete();
}

// === PERÍODO ===
function atualizarPeriodo() {
    const periodo = document.getElementById('periodo-select').value;
    const customRange = document.getElementById('custom-range');
    
    if (periodo === 'custom') {
        customRange.style.display = 'grid';
    } else {
        customRange.style.display = 'none';
        
        const hoje = new Date();
        const mesFim = `${hoje.getFullYear()}-${(hoje.getMonth() + 1).toString().padStart(2, '0')}`;
        
        const mesesAtras = parseInt(periodo);
        const dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - mesesAtras + 1, 1);
        const mesInicio = `${dataInicio.getFullYear()}-${(dataInicio.getMonth() + 1).toString().padStart(2, '0')}`;
        
        document.getElementById('mes-inicio').value = mesInicio;
        document.getElementById('mes-fim').value = mesFim;
    }
}

function gerarMeses(inicio, fim) {
    const meses = [];
    const [anoInicio, mesInicio] = inicio.split('-').map(Number);
    const [anoFim, mesFim] = fim.split('-').map(Number);

    let anoAtual = anoInicio;
    let mesAtual = mesInicio;

    while (anoAtual < anoFim || (anoAtual === anoFim && mesAtual <= mesFim)) {
        meses.push({
            ano: anoAtual,
            mes: mesAtual,
            label: `${mesAtual.toString().padStart(2, '0')}/${anoAtual}`
        });

        mesAtual++;
        if (mesAtual > 12) {
            mesAtual = 1;
            anoAtual++;
        }
    }

    return meses;
}

function validarPeriodo(inicio, fim) {
    const [anoInicio, mesInicio] = inicio.split('-').map(Number);
    const [anoFim, mesFim] = fim.split('-').map(Number);

    const dataInicio = new Date(anoInicio, mesInicio - 1);
    const dataFim = new Date(anoFim, mesFim - 1);

    const meses = (dataFim.getFullYear() - dataInicio.getFullYear()) * 12 + 
                 (dataFim.getMonth() - dataInicio.getMonth()) + 1;

    if (meses < 6) {
        mostrarErro('O período mínimo é de 6 meses.');
        return false;
    }

    if (meses > 24) {
        mostrarErro('O período máximo é de 24 meses.');
        return false;
    }

    if (dataInicio > dataFim) {
        mostrarErro('O mês inicial não pode ser posterior ao mês final.');
        return false;
    }

    return true;
}

// === GERAR FATURAMENTO ===
async function gerarFaturamento() {
    try {
        const empresaId = document.getElementById('empresa-id').value;
        const mesInicio = document.getElementById('mes-inicio').value;
        const mesFim = document.getElementById('mes-fim').value;

        if (!empresaId) {
            mostrarErro('Por favor, selecione uma empresa.');
            return;
        }

        if (!mesInicio || !mesFim) {
            mostrarErro('Por favor, selecione o período (mês inicial e final).');
            return;
        }

        if (!validarPeriodo(mesInicio, mesFim)) {
            return;
        }

        const empresa = empresas.find(e => e._id === empresaId);
        if (!empresa) {
            mostrarErro('Empresa não encontrada.');
            return;
        }

        const meses = gerarMeses(mesInicio, mesFim);

        const [anoInicio, mesInicioNum] = mesInicio.split('-');
        const [anoFim, mesFimNum] = mesFim.split('-');
        const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                           'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const periodoTexto = `${mesesNomes[parseInt(mesInicioNum) - 1]}/${anoInicio} a ${mesesNomes[parseInt(mesFimNum) - 1]}/${anoFim}`;
        
        const periodoDisplay = document.getElementById('periodo-display');
        if (periodoDisplay) {
            periodoDisplay.textContent = `Período: ${periodoTexto}`;
        }

        const empresaInfo = document.getElementById('empresa-info');
        if (!empresaInfo) {
            throw new Error('Elemento empresa-info não encontrado');
        }
        empresaInfo.innerHTML = `
            <p><strong>Nome Empresarial:</strong> ${empresa.nome}</p>
            <p><strong>Nome Fantasia:</strong> ${empresa.nome_fantasia || 'Não informado'}</p>
            <p><strong>CNPJ:</strong> ${empresa.cnpj}</p>
            <p><strong>Endereço:</strong> ${empresa.endereco.rua}, ${empresa.endereco.numero}${empresa.endereco.complemento ? ' - ' + empresa.endereco.complemento : ''}</p>
            <p><strong>Cidade/Estado:</strong> ${empresa.endereco.cidade}/${empresa.endereco.estado}</p>
        `;

        const historico = await carregarHistorico(empresaId, mesInicio, mesFim);

        const tableBody = document.getElementById('table-body');
        if (!tableBody) {
            throw new Error('Elemento table-body não encontrado');
        }
        tableBody.innerHTML = '';

        meses.forEach(mes => {
            const historicoMes = historico.find(h => h.mes === mes.mes && h.ano === mes.ano);
            const valorFormatado = historicoMes ? 
                historicoMes.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${mes.label}</td>
                <td><input type="text" class="input-valor" placeholder="R$ 0,00" value="${valorFormatado}" data-mes="${mes.mes}" data-ano="${mes.ano}"></td>
            `;
            tableBody.appendChild(row);
        });
        
        const totalRow = document.createElement('tr');
        totalRow.className = 'total-row';
        totalRow.innerHTML = `
            <td><strong>TOTAL</strong></td>
            <td><strong id="total-value">R$ 0,00</strong></td>
        `;
        tableBody.appendChild(totalRow);

        document.querySelectorAll('.input-valor').forEach(input => {
            input.addEventListener('input', formatarMoeda);
            input.addEventListener('blur', calcularTotal);
        });

        calcularTotal();

        let responsavel = null;
        if (empresa.socios && empresa.socios.length > 0) {
            responsavel = empresa.socios.find(s => s.is_admin === 'sim');
            if (!responsavel) {
                responsavel = empresa.socios[0];
            }
        }

        const signatureBox = document.getElementById('signature-box');
        if (responsavel) {
            const generoFeminino = responsavel.genero === 'feminino';
            let cargo;
            
            if (empresa.natureza_juridica === 'Individual') {
                cargo = 'Titular';
            } else if (responsavel.is_admin === 'sim') {
                cargo = generoFeminino ? 'Sócia Administradora' : 'Sócio Administrador';
            } else {
                cargo = generoFeminino ? 'Sócia' : 'Sócio';
            }
            
            signatureBox.innerHTML = `
                <div class="signature-line"></div>
                <div class="signature-name">${responsavel.nome}</div>
                <div class="signature-role">${cargo}</div>
            `;
        } else {
            signatureBox.innerHTML = `
                <div class="signature-line"></div>
                <div class="signature-name">Responsável Legal</div>
                <div class="signature-role">Empresa</div>
            `;
        }

        document.getElementById('print-area').classList.add('active');
        document.getElementById('btn-salvar').style.display = 'inline-block';
        document.getElementById('print-area').scrollIntoView({ behavior: 'smooth', block: 'start' });

        limparMensagens();
    } catch (error) {
        console.error('Erro ao gerar faturamento:', error);
        mostrarErro('Erro ao gerar faturamento: ' + error.message);
    }
}

// === FORMATAÇÃO E CÁLCULOS ===
function formatarMoeda(e) {
    let valor = e.target.value;
    valor = valor.replace(/\D/g, '');
    valor = (parseInt(valor) || 0) / 100;
    
    e.target.value = valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function extrairValor(valorFormatado) {
    if (!valorFormatado) return 0;
    return parseFloat(valorFormatado.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}

function calcularTotal() {
    const inputs = document.querySelectorAll('#table-body .input-valor');
    let total = 0;

    inputs.forEach(input => {
        const valor = extrairValor(input.value);
        total += valor;
    });

    document.getElementById('total-value').textContent = total.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

// === HISTÓRICO ===
async function carregarHistorico(empresaId, mesInicio, mesFim) {
    try {
        const [anoInicio, mesInicioNum] = mesInicio.split('-');
        const [anoFim, mesFimNum] = mesFim.split('-');
        
        const response = await fetchWithAuth(
            `/api/faturamento/${empresaId}?mesInicio=${mesInicioNum}&anoInicio=${anoInicio}&mesFim=${mesFimNum}&anoFim=${anoFim}`
        );

        if (!response.ok) {
            console.warn('Histórico não encontrado, usando valores vazios');
            return [];
        }

        const data = await response.json();
        return data.meses || [];
    } catch (error) {
        console.warn('Erro ao carregar histórico (continuando sem histórico):', error);
        return [];
    }
}

// === SALVAR FATURAMENTO ===
async function salvarFaturamento() {
    try {
        const empresaId = document.getElementById('empresa-id').value;
        if (!empresaId) {
            mostrarErro('Selecione uma empresa primeiro');
            return;
        }

        const inputs = document.querySelectorAll('#table-body .input-valor');
        const faturamentos = [];

        inputs.forEach(input => {
            const mes = parseInt(input.dataset.mes);
            const ano = parseInt(input.dataset.ano);
            const valor = extrairValor(input.value);

            if (valor > 0) {
                faturamentos.push({ mes, ano, valor });
            }
        });

        if (faturamentos.length === 0) {
            mostrarErro('Adicione pelo menos um valor antes de salvar');
            return;
        }

        const response = await fetchWithAuth('/api/faturamento', {
            method: 'POST',
            body: JSON.stringify({ empresaId, faturamentos })
        });

        if (!response || !response.ok) {
            const error = response ? await response.json() : { msg: 'Erro de conexão' };
            throw new Error(error.msg || 'Erro ao salvar');
        }

        mostrarSucesso('Faturamento salvo com sucesso! O histórico foi atualizado.');
    } catch (error) {
        console.error('Erro ao salvar:', error);
        mostrarErro('Erro ao salvar faturamento: ' + error.message);
    }
}

// === LIMPAR FATURAMENTO ===
function limparFaturamento() {
    document.getElementById('print-area').classList.remove('active');
    document.getElementById('btn-salvar').style.display = 'none';
    document.getElementById('empresa-search').value = '';
    document.getElementById('empresa-id').value = '';
    document.getElementById('periodo-select').value = '6';
    document.getElementById('custom-range').style.display = 'none';
    atualizarPeriodo();
    limparMensagens();
}

// === MENSAGENS ===
function mostrarErro(mensagem) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = mensagem;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function mostrarSucesso(mensagem) {
    const successDiv = document.getElementById('success-message');
    successDiv.textContent = mensagem;
    successDiv.style.display = 'block';
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}

function limparMensagens() {
    document.getElementById('error-message').style.display = 'none';
    document.getElementById('success-message').style.display = 'none';
}

// === LOGOUT ===
function logout() {
    localStorage.removeItem('token');
    window.location.replace('login.html');
}

// === EVENT LISTENERS ===
function setupEventListeners() {
    document.getElementById('empresa-select').addEventListener('change', selecionarEmpresaDaLista);
    document.getElementById('periodo-select').addEventListener('change', atualizarPeriodo);

    // Botões da seção de filtros/ações superiores
    const btnGerar = document.getElementById('btn-gerar');
    if (btnGerar) btnGerar.addEventListener('click', gerarFaturamento);

    const btnSalvar = document.getElementById('btn-salvar');
    if (btnSalvar) btnSalvar.addEventListener('click', salvarFaturamento);
    
    const printAreaButtons = document.querySelectorAll('.print-area button');
    if (printAreaButtons[0]) {
        printAreaButtons[0].addEventListener('click', () => window.print());
    }
    if (printAreaButtons[1]) {
        printAreaButtons[1].addEventListener('click', limparFaturamento);
    }
    
    document.addEventListener('click', (e) => {
        const searchWrapper = document.getElementById('empresa-search-wrapper');
        if (searchWrapper && !searchWrapper.contains(e.target)) {
            esconderAutocomplete();
        }
    });
}
