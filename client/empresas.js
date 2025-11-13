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
    } catch (error) {
        console.error("Erro na inicialização da página de empresas:", error);
        logout();
    }
});

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
                    <button onclick="window.location.href='detalhes-empresa.html?id=${empresa._id}'">Visualizar</button>
                    <button onclick="window.location.href='editar.html?id=${empresa._id}'" style="background-color: #ffc107; color: #212529;">Editar</button>
                    <button onclick="excluirEmpresa('${empresa._id}')" class="delete-btn">Excluir</button>
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
    carregarEmpresas();
}

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