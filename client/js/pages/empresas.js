let usuario; // Variável global para armazenar os dados do usuário logado
let pagina = 1;
let ordenacao = 'nome';
let direcao = 'asc';
let termoBusca = '';
let totalPaginas = 1;
 
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // CORREÇÃO: Usa o fluxo de autenticação padrão que já funciona no resto do sistema.
        const response = await fetchWithAuth('/api/auth');
        if (!response || !response.ok) {
            throw new Error('Falha na autenticação.');
        }
        
        usuario = await response.json();
        createHeader('header-placeholder', usuario);
        document.body.style.display = 'block';
 
        // A visibilidade do botão de cadastro será definida após carregar os dados
        const btnCadastrar = document.getElementById('btn-cadastrar');
        if (btnCadastrar && ['admin', 'gerente', 'funcionario'].includes(usuario.role)) {
            btnCadastrar.style.display = 'inline-block';
        }
 
        carregarEmpresas(); // CORREÇÃO: Não precisa de 'await' aqui, a função já é assíncrona.
        
        // Event Listeners - Removendo onclick inline
        setupEventListeners();
    } catch (error) {
        console.error("Erro na inicialização da página de empresas:", error);
        logout();
    }
});

function setupEventListeners() {
    // Botão de cadastrar nova empresa
    const btnCadastrar = document.getElementById('btn-cadastrar');
    if (btnCadastrar) {
        btnCadastrar.addEventListener('click', () => {
            window.location.href = 'cliente-formulario.html';
        });
    }

    // Headers de ordenação
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const sortField = th.dataset.sort;
            if (sortField) ordenarPor(sortField);
        });
    });

    // Botões de paginação
    document.getElementById('btn-anterior')?.addEventListener('click', paginaAnterior);
    document.getElementById('btn-proximo')?.addEventListener('click', proximaPagina);

    // Event delegation para botões de ação da tabela (gerados dinamicamente)
    document.getElementById('lista-empresas')?.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === 'visualizar') {
            window.location.href = `detalhes-empresa.html?id=${id}`;
        } else if (action === 'editar') {
            window.location.href = `editar.html?id=${id}`;
        } else if (action === 'excluir') {
            excluirEmpresa(id);
        }
    });
}

async function carregarEmpresas() {
    const tbody = document.getElementById('lista-empresas');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Carregando empresas...</td></tr>'; // Garante que a mensagem de carregamento esteja na tabela
    try {
        mostrarLoading(true); // Mostra o indicador de carregamento
        const response = await fetchWithAuth(`/api/empresas?pagina=${pagina}&limite=10&busca=${encodeURIComponent(termoBusca)}&ordenacao=${ordenacao}&direcao=${direcao}`);
        if (!response.ok) {
            throw new Error('Falha ao buscar empresas.');
        }
        const data = await response.json();
        const empresas = data.docs || data; // Compatibilidade com e sem paginação
        totalPaginas = data.totalPages || 1;

        tbody.innerHTML = ''; // Limpa a tabela
        atualizarPaginacao(); // Atualiza a paginação antes de popular a tabela

        if (empresas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhuma empresa encontrada.</td></tr>'; // Ajustado para 4 colunas
            return;
        }
 
        empresas.forEach(empresa => {
            const row = tbody.insertRow();
            
            row.insertCell(0).textContent = formatarCNPJ(empresa.cnpj);
            
            const nomeCell = row.insertCell(1);
            // CORREÇÃO: O link correto é para detalhes-empresa.html
            nomeCell.innerHTML = `<a href="detalhes-empresa.html?id=${empresa._id}">${empresa.nome}</a>`;
            
            // Adiciona a data de cadastro
            row.insertCell(2).textContent = new Date(empresa.dataCadastro).toLocaleDateString('pt-BR');

            const acoesCell = row.insertCell(3); // Ajusta o índice da célula de ações
            acoesCell.style.whiteSpace = 'nowrap'; // Impede que os botões quebrem linha

            // CORREÇÃO: Lógica de permissão para os botões de ação
            if (usuario && ['admin', 'gerente', 'funcionario'].includes(usuario.role)) {
                acoesCell.innerHTML = `
                    <button data-action="visualizar" data-id="${empresa._id}">Visualizar</button>
                    <button data-action="editar" data-id="${empresa._id}" style="background-color: #ffc107; color: #212529;">Editar</button>
                    <button data-action="excluir" data-id="${empresa._id}" class="delete-btn">Excluir</button>
                `;
            }
        });

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: red;">${error.message}</td></tr>`; // Exibe erro na tabela
    } finally {
        mostrarLoading(false); // Esconde o indicador de carregamento
    }
}

function buscarEmpresas() {
    termoBusca = document.getElementById('busca').value;
    pagina = 1;
    esconderAutocomplete();
    carregarEmpresas();
}

// Autocomplete para busca
let todasEmpresas = [];
let timeoutBusca;

async function carregarTodasEmpresas() {
    try {
        const response = await fetchWithAuth('/api/empresas?limite=10000');
        if (!response.ok) return;
        const data = await response.json();
        todasEmpresas = data.docs || data;
        todasEmpresas.sort((a, b) => a.nome.localeCompare(b.nome));
    } catch (error) {
        console.error('Erro ao carregar empresas para autocomplete:', error);
    }
}

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

function selecionarEmpresaAutocomplete(empresaId) {
    window.location.href = `detalhes-empresa.html?id=${empresaId}`;
}

// Adiciona evento de input ao campo de busca
document.addEventListener('DOMContentLoaded', () => {
    const inputBusca = document.getElementById('busca');
    if (inputBusca) {
        inputBusca.addEventListener('input', function(e) {
            clearTimeout(timeoutBusca);
            const termo = e.target.value.toLowerCase().trim();
            
            if (!termo) {
                esconderAutocomplete();
                return;
            }

            timeoutBusca = setTimeout(() => {
                filtrarAutocomplete(termo);
            }, 200);
        });

        inputBusca.addEventListener('focus', function() {
            if (this.value.trim()) {
                filtrarAutocomplete(this.value.toLowerCase().trim());
            }
        });
    }

    carregarTodasEmpresas();
});

function filtrarAutocomplete(termo) {
    const autocompleteList = document.getElementById('autocomplete-list');
    if (!autocompleteList) return;

    const termoNumeros = termo.replace(/\D/g, '');
    
    const empresasFiltradas = todasEmpresas.filter(empresa => {
        const nome = empresa.nome.toLowerCase();
        const cnpj = empresa.cnpj.replace(/\D/g, '');
        return nome.includes(termo) || (termoNumeros && cnpj.includes(termoNumeros));
    }).slice(0, 10); // Limita a 10 resultados

    autocompleteList.innerHTML = '';
    
    if (empresasFiltradas.length === 0) {
        autocompleteList.innerHTML = '<div class="autocomplete-empty">Nenhuma empresa encontrada</div>';
        mostrarAutocomplete();
        return;
    }

    empresasFiltradas.forEach(empresa => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerHTML = `
            <strong>${empresa.nome}</strong>
            <small>${empresa.cnpj}</small>
        `;
        item.onclick = () => selecionarEmpresaAutocomplete(empresa._id);
        autocompleteList.appendChild(item);
    });

    mostrarAutocomplete();
}

// Fechar autocomplete ao clicar fora
document.addEventListener('click', (e) => {
    const searchWrapper = document.querySelector('.search-wrapper');
    if (searchWrapper && !searchWrapper.contains(e.target)) {
        esconderAutocomplete();
    }
});

function ordenarPor(coluna) {
    if (ordenacao === coluna) {
        direcao = direcao === 'asc' ? 'desc' : 'asc';
    } else {
        ordenacao = coluna;
        direcao = 'asc';
    }
    pagina = 1;
    atualizarOrdenacaoUI(); // CORREÇÃO: Atualiza a UI antes de carregar os dados.
    carregarEmpresas();
}

function paginaAnterior() {
    if (pagina > 1) {
        pagina--;
        carregarEmpresas();
    }
}

function proximaPagina() {
    if (pagina < totalPaginas) {
        pagina++;
        carregarEmpresas();
    }
}

function atualizarPaginacao() {
    document.getElementById('pagina-atual').textContent = `Página ${pagina} de ${totalPaginas}`;
    document.getElementById('btn-anterior').disabled = pagina === 1;
    document.getElementById('btn-proximo').disabled = pagina === totalPaginas;
}

function atualizarOrdenacaoUI() {
    document.querySelectorAll('th').forEach(th => th.innerHTML = th.innerHTML.replace(/ (↑|↓)$/, ''));
    const th = document.getElementById(`th-${ordenacao}`);
    if (th) th.innerHTML += direcao === 'asc' ? ' ↑' : ' ↓';
}

async function excluirEmpresa(empresaId) {
    if (!confirm('Tem certeza que deseja excluir esta empresa? Todos os seus dados e arquivos serão removidos permanentemente.')) {
        return;
    }

    try {
        const response = await fetchWithAuth(`/api/empresas/${empresaId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Falha ao excluir a empresa.');
        }
        alert('Empresa excluída com sucesso!');
        carregarEmpresas(); // Recarrega a lista
    } catch (error) {
        alert(`Erro: ${error.message}`);
    }
}

function mostrarLoading(mostrar) {
    // CORREÇÃO: O elemento 'loading' existe e deve ser manipulado
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = mostrar ? 'inline' : 'none';
}

function formatarCNPJ(cnpj) {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}