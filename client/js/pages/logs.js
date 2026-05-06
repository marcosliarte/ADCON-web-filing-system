// === logs.js ===
// Lógica da página de logs do sistema

document.addEventListener('DOMContentLoaded', async () => {
    const userResponse = await fetchWithAuth('/api/auth');
    if (!userResponse) return;

    const usuario = await userResponse.json();
    createHeader('header-placeholder', usuario);

    if (usuario.role !== 'admin') {
        document.querySelector('.container').innerHTML = '<h1>Acesso Negado</h1><p>Apenas administradores podem visualizar os logs do sistema.</p>';
        document.body.style.display = 'block';
        return;
    }

    document.body.style.display = 'block';
    carregarLogs();
    setupEventListeners();
});

async function carregarLogs() {
    const tbody = document.querySelector('#tabela-logs tbody');
    tbody.innerHTML = '<tr><td colspan="4">Carregando logs...</td></tr>';

    const params = new URLSearchParams();
    const usuario = document.getElementById('filtro-usuario').value;
    const entidade = document.getElementById('filtro-entidade').value;
    const acao = document.getElementById('filtro-acao').value;
    const dataInicio = document.getElementById('filtro-data-inicio').value;
    const dataFim = document.getElementById('filtro-data-fim').value;

    if (usuario) params.append('usuario', usuario);
    if (entidade) params.append('entidadeNome', entidade);
    if (acao) params.append('acao', acao);
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);

    try {
        const response = await fetchWithAuth(`/api/auth/admin/logs?${params.toString()}`);
        if (!response.ok) throw new Error('Falha ao carregar logs.');

        const { data: logs } = await response.json();

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">Nenhum registro de log encontrado.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        logs.forEach(log => {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = new Date(log.createdAt).toLocaleString('pt-BR');
            row.insertCell(1).textContent = log.usuarioNome;
            row.insertCell(2).textContent = log.acao;
            row.insertCell(3).textContent = `${log.entidadeNome || 'N/A'} (${log.entidade})`;
        });

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" style="color: red;">${error.message}</td></tr>`;
    }
}

function setupEventListeners() {
    const btnFiltrar = document.querySelector('.filters button');
    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', carregarLogs);
    }
}
