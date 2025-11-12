checkAuth(); // Verifica se o usuário está autenticado

/**
 * Busca os dados do usuário logado na API.
 * @returns {object|null} O objeto do usuário ou null em caso de erro.
 */
async function getUsuario() {
    try {
        const response = await fetchWithAuth('/api/auth');
        if (response && response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error("Não foi possível obter os dados do usuário:", error);
    }
    return null; // Retorna null se houver qualquer falha
}

document.addEventListener('DOMContentLoaded', async () => {
    // Busca os dados do usuário logado para criar o cabeçalho da página
    const usuario = await getUsuario();
    if (usuario) {
        createHeader('header-placeholder', usuario);
        document.body.style.display = 'block'; // Mostra o conteúdo da página
    } else {
        logout(); // Se não encontrar o usuário, desloga por segurança
    }

    // Adiciona o listener para o evento de submit do formulário
    document.getElementById('form-empresa').addEventListener('submit', async function(e) {
        e.preventDefault(); // Impede o recarregamento da página
        
        const messageEl = document.getElementById('message');
        messageEl.className = 'message loading';
        messageEl.textContent = 'Cadastrando empresa...';
        messageEl.style.display = 'block';

        // Usa FormData para enviar dados de texto e arquivo
        const formData = new FormData(this);

        try {
            const response = await fetchWithAuth('/api/empresas', {
                method: 'POST',
                body: formData // Envia o FormData
            });

            // A função fetchWithAuth já trata erros de conexão e autenticação.
            // Agora, tratamos a resposta do servidor.
            if (response) { // Garante que a resposta não é undefined
                if (response.ok) {
                    // Se a requisição foi bem-sucedida (status 2xx)
                    const result = await response.json();
                    messageEl.className = 'message success';
                    messageEl.textContent = result.msg;
                    this.reset(); // Limpa o formulário
                } else {
                    // Se a requisição falhou (status 4xx, 5xx)
                    const errorResult = await response.json();
                    const errorMsg = errorResult.msg || (errorResult.errors ? errorResult.errors.map(err => err.msg).join(', ') : 'Ocorreu um erro desconhecido.');
                    throw new Error(errorMsg);
                }
            }
        } catch (error) {
            messageEl.className = 'message error';
            messageEl.textContent = `Erro: ${error.message}`;
        }
    });
});