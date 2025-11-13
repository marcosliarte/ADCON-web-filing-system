let usuario; // Armazena os dados do usuário logado

document.addEventListener('DOMContentLoaded', async () => {
    // Garante que o corpo da página só seja exibido se o usuário estiver logado
    if (!localStorage.getItem('token')) {
        window.location.replace('login.html');
        return;
    }

    try {
        const response = await fetchWithAuth('/api/auth');
        if (!response || !response.ok) throw new Error('Falha na autenticação.');
        
        usuario = await response.json();
        createHeader('header-placeholder', usuario);

        // Apenas admin e gerente podem ver esta página
        if (!['admin', 'gerente'].includes(usuario.role)) {
            document.body.innerHTML = '<h1>Acesso Negado</h1><p>Você não tem permissão para ver esta página.</p>';
            document.body.style.display = 'block';
            return;
        }
        
        // Se o usuário tem permissão, exibe o corpo e inicializa a página
        document.body.style.display = 'block';
        inicializarFiltros();
        await carregarStatusMensalidades();

        // Adiciona listeners aos elementos do modal
        document.getElementById('modal-form').addEventListener('submit', handleFormSubmit);
        window.onclick = (event) => {
            const modal = document.getElementById('acao-modal');
            if (event.target == modal) fecharModal();
        };

    } catch (error) {
        console.error("Erro na inicialização:", error);
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

    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    for (let i = 0; i < 12; i++) {
        const option = document.createElement('option');
        option.value = i + 1;
        option.textContent = meses[i];
        if ((i + 1) === mesAtual) option.selected = true;
        filtroMes.appendChild(option);
    }

    filtroAno.value = anoAtual;
}

async function carregarStatusMensalidades() {
    const mes = document.getElementById('filtro-mes').value;
    const ano = document.getElementById('filtro-ano').value;
    const tbody = document.querySelector('#tabela-mensalidades tbody');
    tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';

    try {
        const response = await fetchWithAuth(`/api/mensalidades/status-geral?mes=${mes}&ano=${ano}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Falha ao carregar dados.');
        }
        const dados = await response.json();
        renderizarTabela(dados, parseInt(mes), parseInt(ano));
    } catch (error) {
        console.error('Erro ao carregar mensalidades:', error);
        tbody.innerHTML = `<tr><td colspan="6" style="color: red;">${error.message}</td></tr>`;
    }
}

function renderizarTabela(dados, mesFiltro, anoFiltro) {
    const tbody = document.querySelector('#tabela-mensalidades tbody');
    tbody.innerHTML = '';

    if (dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">Nenhuma empresa encontrada.</td></tr>';
        return;
    }

    dados.forEach(item => {
        const row = tbody.insertRow();
        const mensalidade = item.mensalidade;

        row.insertCell(0).textContent = item.nome;
        row.insertCell(1).textContent = formatarCNPJ(item.cnpj);

        const statusCell = row.insertCell(2);
        const valorCell = row.insertCell(3);
        const vencimentoCell = row.insertCell(4); // Nova célula para o vencimento
        const pagamentoCell = row.insertCell(5);
        const acoesCell = row.insertCell(6);

        if (mensalidade && mensalidade._id) { // Mensalidade real, gerada no banco
            const status = mensalidade.status;

            statusCell.innerHTML = `<span class="status-${status.toLowerCase().replace(' ', '-')}">${status}</span>`;
            valorCell.textContent = `R$ ${mensalidade.valor.toFixed(2)}`;
            vencimentoCell.textContent = formatarData(mensalidade.dataVencimento);
            pagamentoCell.textContent = status === 'Pago' ? formatarData(mensalidade.dataPagamento) : 'N/A';
            acoesCell.innerHTML = `
                ${status !== 'Pago' ? `<button class="btn-acao btn-pagar" onclick="abrirModalPagar('${mensalidade._id}', '${mensalidade.valor}')">Pagar</button>` : ''}
                <button class="btn-acao btn-editar" onclick="abrirModalEditar('${mensalidade._id}', '${mensalidade.valor}', '${mensalidade.dataVencimento}')">Editar</button>
                <button class="btn-acao btn-excluir" onclick="excluirMensalidade('${mensalidade._id}')">Excluir</button>
            `;
        } else { // Mensalidade "virtual", não gerada
            statusCell.innerHTML = `<span class="status-não-gerada">Não Gerada</span>`;
            valorCell.textContent = mensalidade.valor ? `R$ ${mensalidade.valor.toFixed(2)}` : 'N/A';
            vencimentoCell.textContent = 'N/A';
            pagamentoCell.textContent = 'N/A';
            acoesCell.innerHTML = `
                <button class="btn-acao btn-gerar" onclick="abrirModalGerar('${item._id}', '${item.nome}', ${mensalidade.valor || 0})">Gerar</button>
            `;
        }
    });
}

// --- Funções do Modal ---

function abrirModalGerar(empresaId, empresaNome, valorSugerido) {
    document.getElementById('modal-titulo').textContent = `Gerar Mensalidade para ${empresaNome}`;
    document.getElementById('modal-mensalidade-id').value = '';
    document.getElementById('modal-empresa-id').value = empresaId;
    document.getElementById('modal-valor').value = valorSugerido > 0 ? valorSugerido.toFixed(2) : '';
    document.getElementById('modal-valor').readOnly = false;
    document.getElementById('modal-submit-btn').textContent = 'Gerar Mensalidade';
    // Limpa e esconde o campo de data de vencimento, pois ele é definido no backend ao gerar
    document.getElementById('modal-data-vencimento').value = '';
    document.getElementById('modal-data-vencimento').closest('.form-group').style.display = 'none';
    document.getElementById('acao-modal').style.display = 'block';
}

function abrirModalEditar(mensalidadeId, valor, dataVencimento) {
    document.getElementById('modal-titulo').textContent = `Editar Mensalidade`;
    document.getElementById('modal-mensalidade-id').value = mensalidadeId;
    document.getElementById('modal-empresa-id').value = ''; // Limpa o ID da empresa, pois não estamos gerando
    document.getElementById('modal-valor').value = parseFloat(valor).toFixed(2);
    document.getElementById('modal-data-vencimento').value = dataVencimento ? new Date(dataVencimento).toISOString().split('T')[0] : ''; // Garante formato YYYY-MM-DD
    document.getElementById('modal-data-vencimento').closest('.form-group').style.display = 'block';
    document.getElementById('modal-submit-btn').textContent = 'Salvar Alterações';
    document.getElementById('acao-modal').style.display = 'block';
}

function abrirModalPagar(mensalidadeId, valor) {
    if (!confirm(`Confirmar pagamento no valor de R$ ${parseFloat(valor).toFixed(2)}?`)) return;

    handlePagamento(mensalidadeId);
}

async function handlePagamento(mensalidadeId) {
    try {
        const response = await fetchWithAuth(`/api/mensalidades/${mensalidadeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'Pago',
                dataPagamento: new Date().toISOString()
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Ocorreu um erro ao confirmar o pagamento.');
        }

        alert('Pagamento confirmado com sucesso!');
        await carregarStatusMensalidades();

    } catch (error) {
        alert(`Erro: ${error.message}`);
    }
}

function fecharModal() {
    document.getElementById('acao-modal').style.display = 'none';
    document.getElementById('modal-form').reset();
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

    let body = {};
    if (isEditing) {
        body = { valor, dataVencimento };
    } else {
        const mesFiltro = document.getElementById('filtro-mes').value;
        const anoFiltro = document.getElementById('filtro-ano').value;
        body = { empresaId, valor, mes: mesFiltro, ano: anoFiltro };
    }

    try {
        const response = await fetchWithAuth(url, {
            method: method,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || `Ocorreu um erro ao ${isEditing ? 'salvar as alterações' : 'gerar a mensalidade'}.`);
        }

        alert(`Operação realizada com sucesso!`);
        fecharModal();
        await carregarStatusMensalidades();

    } catch (error) {
        alert(`Erro: ${error.message}`);
    }
}

async function excluirMensalidade(mensalidadeId) {
    if (!confirm('Tem certeza que deseja excluir esta mensalidade? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        const response = await fetchWithAuth(`/api/mensalidades/${mensalidadeId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Falha ao excluir.');
        }

        alert('Mensalidade excluída com sucesso!');
        await carregarStatusMensalidades();

    } catch (error) {
        alert(`Erro: ${error.message}`);
    }
}

// --- Funções Auxiliares ---

function formatarCNPJ(cnpj) {
    if (!cnpj) return '';
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatarData(dataISO) {
    if (!dataISO) return '';
    const data = new Date(dataISO);
    // Adiciona o fuso horário para corrigir a data que pode vir um dia antes
    const offset = data.getTimezoneOffset();
    const dataCorrigida = new Date(data.getTime() + offset * 60 * 1000);
    return dataCorrigida.toLocaleDateString('pt-BR');
}