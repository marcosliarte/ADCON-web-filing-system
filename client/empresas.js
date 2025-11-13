checkAuth(); // Verifica se o usuário está autenticado

let usuario; // Variável global para armazenar os dados do usuário logado
let pagina = 1;
let ordenacao = 'nome';
let direcao = 'asc';
let termoBusca = '';
let totalPaginas = 1;

document.addEventListener('DOMContentLoaded', async () => {
    usuario = await getUsuario(); // Agora getUsuario vem de shared.js
    if (usuario) {
        createHeader('header-placeholder', usuario); // Cria o cabeçalho
        document.body.style.display = 'block'; // Mostra o conteúdo da página

        // CORREÇÃO: O botão "Cadastrar Nova Empresa" agora é visível para TODOS os perfis.
        const btnCadastrar = document.getElementById('btn-cadastrar');
        if (btnCadastrar) btnCadastrar.style.display = 'inline-block';

        carregarEmpresas(); // Carrega a lista de empresas
    } else {
        logout(); // Se não encontrar o usuário, desloga por segurança
    }
});

async function carregarEmpresas() {
    const tbody = document.getElementById('lista-empresas');
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

        if (empresas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhuma empresa encontrada.</td></tr>'; // Mensagem de tabela vazia
            return;
        }

        atualizarPaginacao();
        atualizarOrdenacaoUI();

        empresas.forEach(empresa => {
            const row = tbody.insertRow();
            const dataCadastro = new Date(empresa.dataCadastro).toLocaleDateString('pt-BR');

            row.insertCell(0).textContent = formatarCNPJ(empresa.cnpj);
            const nomeCell = row.insertCell(1);
            nomeCell.innerHTML = `<a href="empresa-detalhes.html?id=${empresa._id}">${empresa.nome}</a>`;
            row.insertCell(2).textContent = dataCadastro;
            
            // CORREÇÃO: Usa a variável 'usuario' global para verificar a permissão
            const acoesCell = row.insertCell(3);
            if (usuario && ['admin', 'gerente', 'funcionario'].includes(usuario.role)) {
                acoesCell.innerHTML = `
                    <a href="empresa-editar.html?id=${empresa._id}" class="btn btn-sm btn-edit" title="Editar">✏️</a>
                    <button onclick="excluirEmpresa('${empresa._id}')" class="btn btn-sm btn-danger" title="Excluir">🗑️</button>
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
    document.getElementById('loading').style.display = mostrar ? 'inline' : 'none';
}

function formatarCNPJ(cnpj) {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}