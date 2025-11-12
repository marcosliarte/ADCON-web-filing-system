checkAuth(); // Verifica se o usuário está autenticado

document.addEventListener('DOMContentLoaded', async () => {
    // Busca os dados do usuário logado para criar o cabeçalho da página
    const usuario = await getUsuario();
    if (usuario) {
        createHeader('header-placeholder', usuario);
        document.body.style.display = 'block'; // Mostra o conteúdo da página
        carregarEmpresas(); // Carrega a lista de empresas
    } else {
        logout(); // Se não encontrar o usuário, desloga por segurança
    }
});

async function carregarEmpresas() {
    const tbody = document.getElementById('lista-empresas');
    try {
        const response = await fetchWithAuth('/api/empresas');
        if (!response.ok) {
            throw new Error('Falha ao buscar empresas.');
        }
        const empresas = await response.json();

        tbody.innerHTML = ''; // Limpa a mensagem de "Carregando..."

        if (empresas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Nenhuma empresa cadastrada.</td></tr>';
            return;
        }

        empresas.forEach(empresa => {
            const row = tbody.insertRow();
            const dataCadastro = new Date(empresa.dataCadastro).toLocaleDateString('pt-BR');

            row.insertCell(0).textContent = formatarCNPJ(empresa.cnpj);
            row.insertCell(1).textContent = empresa.nome;
            row.insertCell(2).textContent = dataCadastro;
        });

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: red;">${error.message}</td></tr>`;
    }
}

function formatarCNPJ(cnpj) {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}