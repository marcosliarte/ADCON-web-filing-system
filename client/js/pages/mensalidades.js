let usuario;
let dadosCarregados = []; // cache dos dados para filtro local

document.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('token')) {
        window.location.replace('login.html');
        return;
    }

    try {
        const response = await fetchWithAuth('/api/auth');
        if (!response || !response.ok) throw new Error('Falha na autenticação.');

        usuario = await response.json();
        createHeader('header-placeholder', usuario);

        if (!['admin', 'gerente', 'funcionario'].includes(usuario.role)) {
            document.body.innerHTML = '<h1>Acesso Negado</h1><p>Você não tem permissão para ver esta página.</p>';
            document.body.style.display = 'block';
            return;
        }

        document.body.style.display = 'block';
        inicializarFiltros();
        await carregarStatusMensalidades();

        document.getElementById('modal-form').addEventListener('submit', handleFormSubmit);
        document.getElementById('btn-filtrar').addEventListener('click', carregarStatusMensalidades);
        document.getElementById('modal-close-btn').addEventListener('click', fecharModal);
        document.getElementById('modal-cancel-btn').addEventListener('click', fecharModal);

        document.getElementById('filtro-busca').addEventListener('input', () => {
            renderizarTabela(filtrarLocalmente(), parseInt(document.getElementById('filtro-mes').value), parseInt(document.getElementById('filtro-ano').value));
        });

        window.onclick = (event) => {
            if (event.target === document.getElementById('acao-modal')) fecharModal();
        };

    } catch (error) {
        console.error('Erro na inicialização:', error);
        localStorage.removeItem('token');
        window.location.replace('login.html');
    }
});

function inicializarFiltros() {
    const filtroMes = document.getElementById('filtro-mes');
    const filtroAno = document.getElementById('filtro-ano');
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    meses.forEach((nome, i) => {
        const option = document.createElement('option');
        option.value = i + 1;
        option.textContent = nome;
        if ((i + 1) === mesAtual) option.selected = true;
        filtroMes.appendChild(option);
    });

    filtroAno.value = anoAtual;
}

function filtrarLocalmente() {
    const busca = document.getElementById('filtro-busca').value.trim().toLowerCase();
    if (!busca) return dadosCarregados;
    return dadosCarregados.filter(item =>
        item.nome.toLowerCase().includes(busca) ||
        (item.cnpj && item.cnpj.includes(busca))
    );
}

async function carregarStatusMensalidades() {
    const mes = document.getElementById('filtro-mes').value;
    const ano = document.getElementById('filtro-ano').value;
    const tbody = document.querySelector('#tabela-mensalidades tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Carregando...</td></tr>';
    document.getElementById('stats-bar').style.display = 'none';

    try {
        const response = await fetchWithAuth(`/api/mensalidades/status-geral?mes=${mes}&ano=${ano}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Falha ao carregar dados.');
        }
        const dados = await response.json();
        dadosCarregados = dados.data;
        renderizarTabela(filtrarLocalmente(), parseInt(mes), parseInt(ano));
        renderizarStats(dadosCarregados);
    } catch (error) {
        console.error('Erro ao carregar mensalidades:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="error-cell">${error.message}</td></tr>`;
    }
}

function renderizarStats(dados) {
    const statsBar = document.getElementById('stats-bar');
    if (!dados || dados.length === 0) { statsBar.style.display = 'none'; return; }

    let pago = 0, pendente = 0, atrasado = 0, naoGerada = 0;
    dados.forEach(item => {
        const status = item.mensalidade?.status || 'Não Gerada';
        if (status === 'Pago') pago++;
        else if (status === 'Pendente') pendente++;
        else if (status === 'Atrasado') atrasado++;
        else naoGerada++;
    });

    document.getElementById('stat-total').textContent = dados.length;
    document.getElementById('stat-pago').textContent = pago;
    document.getElementById('stat-pendente').textContent = pendente;
    document.getElementById('stat-atrasado').textContent = atrasado;
    document.getElementById('stat-nao-gerada').textContent = naoGerada;
    statsBar.style.display = 'flex';
}

function renderizarTabela(dados, mesFiltro, anoFiltro) {
    const tbody = document.querySelector('#tabela-mensalidades tbody');
    tbody.innerHTML = '';

    if (!dados || dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Nenhuma empresa encontrada.</td></tr>';
        return;
    }

    dados.forEach(item => {
        const row = tbody.insertRow();
        const mensalidade = item.mensalidade;

        row.insertCell(0).textContent = item.nome;
        row.insertCell(1).textContent = formatarCNPJ(item.cnpj);

        const statusCell = row.insertCell(2);
        const valorCell = row.insertCell(3);
        const vencimentoCell = row.insertCell(4);
        const pagamentoCell = row.insertCell(5);
        const acoesCell = row.insertCell(6);
        acoesCell.className = 'acoes-cell';

        if (mensalidade && mensalidade._id) {
            const status = mensalidade.status;
            const statusClass = status.toLowerCase()
                .normalize('NFD').replace(/[̀-ͯ]/g, '')
                .replace(/\s+/g, '-');

            statusCell.innerHTML = `<span class="status-badge status-${statusClass}">${status}</span>`;
            valorCell.textContent = formatarMoeda(mensalidade.valor);
            vencimentoCell.textContent = formatarData(mensalidade.dataVencimento);
            pagamentoCell.textContent = status === 'Pago' ? formatarData(mensalidade.dataPagamento) : '—';

            acoesCell.innerHTML = `
                ${status !== 'Pago' ? `<button class="btn-acao btn-pagar" onclick="abrirModalPagar('${mensalidade._id}', '${mensalidade.valor}')">Pagar</button>` : ''}
                <button class="btn-acao btn-editar" onclick="abrirModalEditar('${mensalidade._id}', '${mensalidade.valor}', '${mensalidade.dataVencimento}')">Editar</button>
                <button class="btn-acao btn-excluir" onclick="excluirMensalidade('${mensalidade._id}')">Excluir</button>
            `;
        } else {
            statusCell.innerHTML = `<span class="status-badge status-nao-gerada">Não Gerada</span>`;
            valorCell.textContent = '—';
            vencimentoCell.textContent = '—';
            pagamentoCell.textContent = '—';
            acoesCell.innerHTML = `
                <button class="btn-acao btn-gerar" onclick="abrirModalGerar('${item._id}', '${item.nome}', ${mensalidade?.valor || 0})">Gerar</button>
            `;
        }
    });
}

// --- Modal ---

function abrirModalGerar(empresaId, empresaNome, valorSugerido) {
    document.getElementById('modal-titulo').textContent = `Gerar Mensalidade — ${empresaNome}`;
    document.getElementById('modal-mensalidade-id').value = '';
    document.getElementById('modal-empresa-id').value = empresaId;
    document.getElementById('modal-valor').value = valorSugerido > 0 ? parseFloat(valorSugerido).toFixed(2) : '';
    document.getElementById('modal-valor').readOnly = false;
    document.getElementById('modal-submit-btn').textContent = 'Gerar Mensalidade';
    document.getElementById('grupo-data-vencimento').style.display = 'none';
    document.getElementById('acao-modal').style.display = 'flex';
}

function abrirModalEditar(mensalidadeId, valor, dataVencimento) {
    document.getElementById('modal-titulo').textContent = 'Editar Mensalidade';
    document.getElementById('modal-mensalidade-id').value = mensalidadeId;
    document.getElementById('modal-empresa-id').value = '';
    document.getElementById('modal-valor').value = parseFloat(valor).toFixed(2);
    document.getElementById('modal-valor').readOnly = false;
    document.getElementById('modal-data-vencimento').value = dataVencimento
        ? new Date(dataVencimento).toISOString().split('T')[0]
        : '';
    document.getElementById('grupo-data-vencimento').style.display = 'block';
    document.getElementById('modal-submit-btn').textContent = 'Salvar Alterações';
    document.getElementById('acao-modal').style.display = 'flex';
}

function abrirModalPagar(mensalidadeId, valor) {
    if (!confirm(`Confirmar pagamento no valor de ${formatarMoeda(valor)}?`)) return;
    handlePagamento(mensalidadeId);
}

async function handlePagamento(mensalidadeId) {
    try {
        const response = await fetchWithAuth(`/api/mensalidades/${mensalidadeId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'Pago', dataPagamento: new Date().toISOString() })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Erro ao confirmar o pagamento.');
        }

        showToast('Pagamento confirmado com sucesso!', 'success');
        await carregarStatusMensalidades();
    } catch (error) {
        showToast(`Erro: ${error.message}`, 'error');
    }
}

function fecharModal() {
    document.getElementById('acao-modal').style.display = 'none';
    document.getElementById('modal-form').reset();
    document.getElementById('grupo-data-vencimento').style.display = 'none';
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const mensalidadeId = document.getElementById('modal-mensalidade-id').value;
    const empresaId = document.getElementById('modal-empresa-id').value;
    const valor = document.getElementById('modal-valor').value;
    const dataVencimento = document.getElementById('modal-data-vencimento').value;

    const isEditing = !!mensalidadeId;
    const url = isEditing ? `/api/mensalidades/${mensalidadeId}` : '/api/mensalidades';
    const method = isEditing ? 'PUT' : 'POST';

    const body = isEditing
        ? { valor, dataVencimento }
        : { empresaId, valor, mes: document.getElementById('filtro-mes').value, ano: document.getElementById('filtro-ano').value };

    const submitBtn = document.getElementById('modal-submit-btn');
    submitBtn.disabled = true;

    try {
        const response = await fetchWithAuth(url, { method, body: JSON.stringify(body) });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Erro ao salvar.');
        }

        showToast(`Operação realizada com sucesso!`, 'success');
        fecharModal();
        await carregarStatusMensalidades();
    } catch (error) {
        showToast(`Erro: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
    }
}

async function excluirMensalidade(mensalidadeId) {
    const confirmado = await openConfirmModal('Tem certeza que deseja excluir esta mensalidade? Esta ação não pode ser desfeita.', {
        title: 'Excluir Mensalidade'
    });
    if (!confirmado) return;

    try {
        const response = await fetchWithAuth(`/api/mensalidades/${mensalidadeId}`, { method: 'DELETE' });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Falha ao excluir.');
        }

        showToast('Mensalidade excluída com sucesso!', 'success');
        await carregarStatusMensalidades();
    } catch (error) {
        showToast(`Erro: ${error.message}`, 'error');
    }
}

// --- Auxiliares ---

function formatarMoeda(valor) {
    return parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarCNPJ(cnpj) {
    if (!cnpj) return '';
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatarData(dataISO) {
    if (!dataISO) return '';
    const data = new Date(dataISO);
    const offset = data.getTimezoneOffset();
    return new Date(data.getTime() + offset * 60 * 1000).toLocaleDateString('pt-BR');
}
