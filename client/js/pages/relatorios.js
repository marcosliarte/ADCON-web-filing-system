// === relatorios.js ===
// Lógica da página de relatórios financeiros

let currentUser;

// === INICIALIZAÇÃO ===
document.addEventListener('DOMContentLoaded', async () => {
    const userResponse = await fetchWithAuth('/api/auth');
    if (!userResponse) return;

    currentUser = await userResponse.json();
    createHeader('header-placeholder', currentUser);

    if (!['admin', 'gerente'].includes(currentUser.role)) {
        alert('Acesso negado. Apenas administradores e gerentes podem ver os relatórios.');
        document.querySelector('.container').innerHTML = '<h1>Acesso Negado</h1><p>Você não tem permissão para visualizar esta página.</p>';
    } else {
        document.body.style.display = 'block';
        setupFilters();
        gerarRelatorioGeral();
        toggleFilters();
        setupExpenseForm();
        setupEventListeners();
        gerarRelatorio(); // Carrega o relatório do mês atual automaticamente
    }
});

// === FILTROS ===
function setupFilters() {
    const mesSelect = document.getElementById('mes');
    const anoInput = document.getElementById('ano');
    const anoAtual = new Date().getFullYear();
    anoInput.value = anoAtual;

    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    meses.forEach((mes, index) => {
        mesSelect.options.add(new Option(mes, index + 1));
    });

    mesSelect.value = new Date().getMonth() + 1;
}

function toggleFilters() {
    const reportType = document.getElementById('reportType').value;
    document.getElementById('mes').style.display = reportType === 'mensal' ? 'inline-block' : 'none';
}

// === LOADING E MENSAGENS ===
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    document.getElementById('monthlyReport').style.display = 'none';
    document.getElementById('annualReport').style.display = 'none';
    document.getElementById('error').style.display = 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function showStatus(message, isError = false) {
    const statusDiv = document.getElementById('lancamentoStatus');
    statusDiv.textContent = message;
    statusDiv.className = isError ? 'error' : 'success';
    statusDiv.style.display = 'block';
    setTimeout(() => { statusDiv.style.display = 'none'; }, 4000);
}

// === RELATÓRIO GERAL ===
async function gerarRelatorioGeral() {
    const summaryContainer = document.getElementById('generalSummary');
    summaryContainer.innerHTML = `<p>Carregando visão geral...</p>`;
    try {
        const response = await fetchWithAuth('/api/relatorios/geral');
        if (!response.ok) throw new Error('Falha ao carregar visão geral.');
        const data = await response.json();

        summaryContainer.innerHTML = `
            <div class="summary-card"><h3>Empresas Cadastradas</h3><p>${data.totalClientes}</p></div>
            <div class="summary-card"><h3>Empresas Pagantes</h3><p>${data.clientesPagantes}</p></div>
        `;
    } catch (err) {
        summaryContainer.innerHTML = `<p class="error">${err.message}</p>`;
    }
}

// === FORMULÁRIO DE DESPESAS ===
function setupExpenseForm() {
    const form = document.getElementById('form-nova-despesa');
    const tipoSelect = document.getElementById('despesa-tipo');

    const campos = {
        unica: document.getElementById('campo-data-unica'),
        inicio: document.getElementById('campo-data-inicio'),
        vencimento: document.getElementById('campo-dia-vencimento'),
        parcelas: document.getElementById('campo-total-parcelas')
    };

    const atualizarCamposVisiveis = () => {
        const tipo = tipoSelect.value;
        Object.values(campos).forEach(c => c.style.display = 'none');

        if (tipo === 'unica') {
            campos.unica.style.display = 'block';
        } else {
            campos.inicio.style.display = 'block';
            campos.vencimento.style.display = 'block';
            if (tipo === 'parcelada') {
                campos.parcelas.style.display = 'block';
            }
        }
    };

    tipoSelect.addEventListener('change', atualizarCamposVisiveis);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const tipo = tipoSelect.value;
        const payload = {
            descricao: document.getElementById('despesa-descricao').value,
            valor: parseFloat(document.getElementById('despesa-valor').value),
            tipo: tipo
        };

        if (tipo === 'unica') {
            const dataInput = document.getElementById('despesa-data').value;
            if (dataInput) payload.data = dataInput;
        } else {
            const dataInicioInput = document.getElementById('despesa-data-inicio').value;
            if (dataInicioInput) payload.dataInicio = dataInicioInput;
            payload.diaVencimento = parseInt(document.getElementById('despesa-dia-vencimento').value);
            if (tipo === 'parcelada') {
                payload.totalParcelas = parseInt(document.getElementById('despesa-total-parcelas').value);
            }
        }

        try {
            const response = await fetchWithAuth('/api/relatorios/despesas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.msg || 'Falha ao lançar despesa.');
            }
            showStatus('Despesa lançada com sucesso!');
            form.reset();
            atualizarCamposVisiveis();
            gerarRelatorio();
        } catch (err) {
            showStatus(err.message, true);
        }
    });

    atualizarCamposVisiveis();
}

// === LANÇAR RECEITA ===
async function lancarReceita(event) {
    event.preventDefault();
    const descricao = document.getElementById('receitaDescricao').value;
    const valor = parseFloat(document.getElementById('receitaValor').value);

    try {
        const response = await fetchWithAuth('/api/relatorios/receitas', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ descricao, valor, data: new Date() }) 
        });
        if (!response.ok) throw new Error('Falha ao lançar receita.');
        showStatus('Receita lançada com sucesso!');
        document.getElementById('formReceita').reset();
        gerarRelatorio();
    } catch (err) {
        showStatus(err.message, true);
    }
}

// === EXCLUIR LANÇAMENTO ===
async function excluirLancamento(tipo, id) {
    if (!confirm(`Tem certeza que deseja excluir este lançamento?`)) return;

    const url = tipo === 'despesa' ? `/api/relatorios/despesas/${id}` : `/api/relatorios/receitas/${id}`;
    
    try {
        const response = await fetchWithAuth(url, { method: 'DELETE' });
        if (!response || !response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || `Falha ao excluir ${tipo}.`);
        }
        showStatus(`${tipo.charAt(0).toUpperCase() + tipo.slice(1)} excluída com sucesso!`);
        gerarRelatorio();
    } catch (err) {
        showStatus(err.message, true);
    }
}

// === MODAL DE EDIÇÃO ===
const modal = document.getElementById('edit-modal');

async function abrirModalEdicao(tipoLancamento, id) {
    const form = document.getElementById('modal-edit-form');
    form.reset();

    document.getElementById('modal-edit-campos-despesa').style.display = 'none';
    document.getElementById('modal-edit-campo-data-pagamento').style.display = 'none';
    document.getElementById('modal-edit-campo-data-referencia').style.display = 'none';
    document.getElementById('modal-edit-campo-data-inicio').style.display = 'none';
    document.getElementById('modal-edit-campo-dia-vencimento').style.display = 'none';
    document.getElementById('modal-edit-campo-total-parcelas').style.display = 'none';

    document.getElementById('modal-edit-id').value = id;
    document.getElementById('modal-edit-tipo-original').value = tipoLancamento;

    try {
        const url = tipoLancamento === 'despesa' ? `/api/relatorios/despesas/${id}` : `/api/relatorios/receitas/${id}`;
        const response = await fetchWithAuth(url);
        if (!response || !response.ok) throw new Error('Falha ao buscar dados do lançamento.');
        
        const data = await response.json();
        document.getElementById('modal-edit-descricao').value = data.descricao;
        document.getElementById('modal-edit-valor').value = data.valor;

        if (tipoLancamento === 'despesa') {
            document.getElementById('modal-edit-campos-despesa').style.display = 'block';
            document.getElementById('modal-edit-campo-data-pagamento').style.display = 'block';
            document.getElementById('modal-edit-data-pagamento').value = data.dataPagamento ? new Date(data.dataPagamento).toISOString().split('T')[0] : '';
            
            if (data.tipo === 'unica') {
                document.getElementById('modal-edit-campo-data-referencia').style.display = 'block';
                document.getElementById('modal-edit-data').value = data.data ? new Date(data.data).toISOString().split('T')[0] : '';
            } else {
                document.getElementById('modal-edit-campo-data-inicio').style.display = 'block';
                document.getElementById('modal-edit-campo-dia-vencimento').style.display = 'block';
                document.getElementById('modal-edit-data-inicio').value = data.dataInicio ? new Date(data.dataInicio).toISOString().split('T')[0] : '';
                document.getElementById('modal-edit-dia-vencimento').value = data.diaVencimento || '';
                if (data.tipo === 'parcelada') {
                    document.getElementById('modal-edit-campo-total-parcelas').style.display = 'block';
                    document.getElementById('modal-edit-total-parcelas').value = data.totalParcelas || '';
                }
            }
        }

        modal.style.display = 'block';
    } catch (err) {
        showStatus(err.message, true);
    }
}

function fecharModalEdicao() {
    modal.style.display = 'none';
}

// === MARCAR COMO PAGA ===
async function marcarComoPaga(id) {
    if (!confirm('Deseja marcar esta despesa como paga na data de hoje?')) return;

    const url = `/api/relatorios/despesas/${id}/pagar`;

    try {
        const response = await fetchWithAuth(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response || !response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Falha ao marcar como paga.');
        }
        showStatus('Despesa marcada como paga com sucesso!');
        gerarRelatorio();
    } catch (err) {
        showStatus(err.message, true);
    }
}

// === IMPRESSÃO ===
async function imprimirRelatorio() {
    const printHeader = document.getElementById('print-header');
    const printLogo = document.getElementById('print-logo');
    const printCompanyName = document.getElementById('print-company-name');
    const printCompanyDetails = document.getElementById('print-company-details');

    try {
        const response = await fetchWithAuth('/api/configuracao');
        if (!response || !response.ok) throw new Error('Não foi possível carregar os dados da empresa para o cabeçalho.');
        
        const config = await response.json();

        printCompanyName.textContent = config.nome_fantasia || config.nome_empresarial || 'Relatório Financeiro';
        
        let details = [];
        if (config.cnpj) details.push(`CNPJ: ${formatarCNPJ(config.cnpj)}`);
        if (config.contato?.email) details.push(`Email: ${config.contato.email}`);
        if (config.contato?.telefone) details.push(`Telefone: ${config.contato.telefone}`);
        printCompanyDetails.innerHTML = details.join(' &nbsp;|&nbsp; ');

        printLogo.src = config.logotipoUrl || '';
        printLogo.style.display = config.logotipoUrl ? 'block' : 'none';

        window.print();
    } catch (error) {
        alert(error.message);
    }
}

// === GERAR RELATÓRIO ===
async function gerarRelatorio() {
    showLoading(true);
    const reportType = document.getElementById('reportType').value;
    const ano = document.getElementById('ano').value;

    try {
        if (reportType === 'mensal') {
            const mes = document.getElementById('mes').value;
            if (!mes || !ano) throw new Error("Mês e Ano são obrigatórios para o relatório mensal.");
            const response = await fetchWithAuth(`/api/relatorios/mensal?mes=${mes}&ano=${ano}`);
            if (!response.ok) throw new Error((await response.json()).msg || 'Erro ao buscar relatório mensal.');
            const data = await response.json();
            renderMonthlyReport(data);
        } else {
            if (!ano) throw new Error("O Ano é obrigatório para o relatório anual.");
            const response = await fetchWithAuth(`/api/relatorios/anual?ano=${ano}`);
            if (!response.ok) throw new Error((await response.json()).msg || 'Erro ao buscar relatório anual.');
            const data = await response.json();
            renderAnnualReport(data, ano);
        }
    } catch (err) {
        showError(err.message);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

// === RENDERIZAR RELATÓRIOS ===
function renderMonthlyReport(data) {
    document.getElementById('monthlyReport').style.display = 'block';
    document.getElementById('monthlyTitle').textContent = `Relatório de ${document.getElementById('mes').options[document.getElementById('mes').selectedIndex].text} de ${data.periodo.ano}`;

    const summary = document.getElementById('monthlySummary');
    summary.innerHTML = `
        <div class="summary-card"><h3>Receita Total</h3><p>${formatarMoeda(data.receita)}</p></div>
        <div class="summary-card despesa"><h3>Total Despesas</h3><p>${formatarMoeda(data.totalDespesas)}</p></div>
        <div class="summary-card lucro"><h3>Lucro Líquido</h3><p>${formatarMoeda(data.lucroLiquido)}</p></div>
        <div class="summary-card"><h3>Mensalidades Pagas</h3><p>${data.pagas.quantidade}</p></div>
        <div class="summary-card"><h3>Pendentes</h3><p>${data.pendentes.quantidade}</p></div>
        <div class="summary-card"><h3>Atrasadas</h3><p>${data.atrasadas.quantidade}</p></div>
    `;

    populateTable('paidTable', data.pagas.lista, ['empresa.nome', 'empresa.cnpj', 'valor', 'dataPagamento']);
    populateTable('pendingTable', data.pendentes.lista, ['empresa.nome', 'empresa.cnpj', 'valor', 'dataVencimento']);
    populateTable('overdueTable', data.atrasadas.lista, ['empresa.nome', 'empresa.cnpj', 'valor', 'dataVencimento']);
    populateTable('otherRevenuesTable', data.outrasReceitas || [], ['descricao', 'valor', 'data'], 'receita');
    populateTable('expensesTable', data.despesasManuais || [], ['descricao', 'valor', 'vencimento', 'pagamento'], 'despesa');
}

function renderAnnualReport(data, ano) {
    document.getElementById('annualReport').style.display = 'block';
    document.getElementById('annualTitle').textContent = `Relatório Anual de ${ano}`;
    
    const totalReceitaMensalidades = data.receitaMensalidades.reduce((acc, item) => acc + item.receitaTotal, 0);
    const totalOutrasReceitas = data.outrasReceitas.reduce((acc, item) => acc + item.total, 0);
    const totalDespesasFolha = data.despesasFolha.reduce((acc, item) => acc + item.despesaTotal, 0);
    const totalDespesasManuais = data.despesasManuais.reduce((acc, item) => acc + item.total, 0);

    const totalReceitaAno = totalReceitaMensalidades + totalOutrasReceitas;
    const totalDespesaAno = totalDespesasFolha + totalDespesasManuais;

    document.getElementById('annualSummary').innerHTML = `
        <div class="summary-card"><h3>Receita Total do Ano</h3><p>${formatarMoeda(totalReceitaAno)}</p></div>
        <div class="summary-card despesa"><h3>Despesa Total do Ano</h3><p>${formatarMoeda(totalDespesaAno)}</p></div>
        <div class="summary-card lucro"><h3>Lucro Líquido do Ano</h3><p>${formatarMoeda(totalReceitaAno - totalDespesaAno)}</p></div>
    `;

    const tableBody = document.getElementById('annualTableBody');
    tableBody.innerHTML = '';
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    const receitaMensalidadesMap = new Map(data.receitaMensalidades.map(item => [item._id, item.receitaTotal]));
    const outrasReceitasMap = new Map(data.outrasReceitas.map(item => [item._id, item.total]));
    const despesasFolhaMap = new Map(data.despesasFolha.map(item => [item._id, item.despesaTotal]));
    const despesasManuaisMap = new Map(data.despesasManuais.map(item => [item._id, item.total]));

    for (let i = 1; i <= 12; i++) {
        const receita = (receitaMensalidadesMap.get(i) || 0) + (outrasReceitasMap.get(i) || 0);
        const despesa = (despesasFolhaMap.get(i) || 0) + (despesasManuaisMap.get(i) || 0);
        const lucro = receita - despesa;
        const row = tableBody.insertRow();
        row.insertCell(0).textContent = meses[i - 1];
        row.insertCell(1).textContent = formatarMoeda(receita);
        row.insertCell(2).textContent = formatarMoeda(despesa);
        row.insertCell(3).textContent = formatarMoeda(lucro);
    }
}

function populateTable(tableId, data, columns, tipoLancamento = null) {
    const tableSection = document.getElementById(tableId).parentElement;
    const tbody = document.getElementById(tableId).querySelector('tbody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tableSection.style.display = 'none';
        return;
    }
    tableSection.style.display = 'block';

    data.forEach(item => {
        const row = tbody.insertRow();
        columns.forEach(col => {
            let cellValue = '';
            if (col === 'vencimento') {
                if (item.diaVencimento) {
                    const mesAtual = document.getElementById('mes').value;
                    const anoAtual = document.getElementById('ano').value;
                    cellValue = `${String(item.diaVencimento).padStart(2, '0')}/${String(mesAtual).padStart(2, '0')}/${anoAtual}`;
                } else {
                    cellValue = item.isSalario ? 'N/A' : (item.data ? formatarData(item.data) : 'N/A');
                }
            } else if (col === 'pagamento') {
                cellValue = item.dataPagamento ? formatarData(item.dataPagamento) : (item.isSalario ? formatarData(item.data) : 'Pendente');
            } else {
                cellValue = col.split('.').reduce((o, i) => o ? o[i] : '', item);
                if (col.toLowerCase().includes('data')) {
                    cellValue = cellValue ? formatarData(cellValue) : 'N/A';
                }
            }

            if (typeof cellValue === 'number') {
                cellValue = formatarMoeda(cellValue);
            }
            row.insertCell().textContent = cellValue || 'N/A';
        });

        if (tipoLancamento) {
            const actionsCell = row.insertCell();
            actionsCell.className = 'actions';
            
            if (item.isSalario) {
                actionsCell.innerHTML = `<span>(Automático)</span>`;
            } else {
                let btnPagar = '';
                if (tipoLancamento === 'despesa' && !item.dataPagamento) {
                    btnPagar = `<button class="btn-edit btn-pagar" style="background-color: #28a745;" data-id="${item._id}">Pagar</button>`;
                }

                actionsCell.innerHTML = `
                    <button class="btn-edit btn-editar-lancamento" data-tipo="${tipoLancamento}" data-id="${item._id}">Editar</button>
                    <button class="btn-delete btn-excluir-lancamento" data-tipo="${tipoLancamento}" data-id="${item._id}">Excluir</button>
                    ${btnPagar} 
                `;
            }
        }

        if (item.tipo === 'fixa' && item.status === 'cancelada') {
            row.style.textDecoration = 'line-through';
            row.style.color = '#888';
        }
    });
}

// === FORMATAÇÃO ===
function formatarMoeda(valor) {
    return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarCNPJ(cnpj) {
    return cnpj ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '';
}

function formatarData(dataISO) {
    return dataISO ? new Date(dataISO).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '';
}

// === EVENT LISTENERS ===
function setupEventListeners() {
    // Tipo de relatório
    document.getElementById('reportType').addEventListener('change', toggleFilters);

    // Botões de ação
    document.querySelectorAll('.filters button').forEach((btn, index) => {
        if (index === 0) btn.addEventListener('click', gerarRelatorio);
        if (index === 1) btn.addEventListener('click', imprimirRelatorio);
    });

    // Formulário de receita
    document.getElementById('formReceita').addEventListener('submit', lancarReceita);

    // Modal de edição
    document.getElementById('modal-edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('modal-edit-id').value;
        const tipoLancamento = document.getElementById('modal-edit-tipo-original').value;
        
        const payload = {
            descricao: document.getElementById('modal-edit-descricao').value,
            valor: parseFloat(document.getElementById('modal-edit-valor').value)
        };

        if (tipoLancamento === 'despesa') {
            const dataPagamento = document.getElementById('modal-edit-data-pagamento').value;
            const dataReferencia = document.getElementById('modal-edit-data').value;
            const dataInicio = document.getElementById('modal-edit-data-inicio').value;
            const diaVencimento = document.getElementById('modal-edit-dia-vencimento').value;
            const totalParcelas = document.getElementById('modal-edit-total-parcelas').value;

            if (dataPagamento) payload.dataPagamento = dataPagamento;
            if (dataReferencia) payload.data = dataReferencia;
            if (dataInicio) payload.dataInicio = dataInicio;
            if (diaVencimento) payload.diaVencimento = parseInt(diaVencimento);
            if (totalParcelas) payload.totalParcelas = parseInt(totalParcelas);
        }

        const url = tipoLancamento === 'despesa' ? `/api/relatorios/despesas/${id}` : `/api/relatorios/receitas/${id}`;

        try {
            const response = await fetchWithAuth(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response || !response.ok) throw new Error('Falha ao salvar alterações.');

            showStatus('Lançamento atualizado com sucesso!');
            fecharModalEdicao();
            gerarRelatorio();
        } catch (err) {
            showStatus(err.message, true);
        }
    });

    // Fechar modal
    document.querySelector('.close-btn').addEventListener('click', fecharModalEdicao);
    
    window.onclick = function(event) {
        if (event.target == modal) fecharModalEdicao();
    }

    // Event delegation para botões dinâmicos
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-editar-lancamento')) {
            const tipo = e.target.getAttribute('data-tipo');
            const id = e.target.getAttribute('data-id');
            abrirModalEdicao(tipo, id);
        }
        
        if (e.target.classList.contains('btn-excluir-lancamento')) {
            const tipo = e.target.getAttribute('data-tipo');
            const id = e.target.getAttribute('data-id');
            excluirLancamento(tipo, id);
        }
        
        if (e.target.classList.contains('btn-pagar')) {
            const id = e.target.getAttribute('data-id');
            marcarComoPaga(id);
        }
    });
}
