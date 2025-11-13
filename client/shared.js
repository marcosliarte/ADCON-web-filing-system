/**
 * Função para fazer requisições à API com o token de autenticação.
 * Lida com redirecionamento para login se o token for inválido ou expirar.
 */
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.replace('login.html');
        return;
    }

    const headers = {
        ...options.headers,
        'x-auth-token': token
    };

    // Adiciona o 'Content-Type' apenas se houver um corpo e ele não for FormData
    // Isso corrige o erro em requisições GET, que não têm corpo.
    // CORREÇÃO: A verificação `options.body` já é segura contra `undefined`.
    if (options && options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'; // Garante que o cabeçalho seja adicionado apenas quando necessário.
    }

    try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            window.location.replace('login.html');
            return;
        }

        return response;
    } catch (error) {
        console.error('Erro de conexão:', error);
        // Opcional: mostrar uma mensagem de erro de conexão na tela
    }
}

/**
 * Cria e insere o cabeçalho padrão em um elemento placeholder.
 * @param {string} placeholderId - O ID do elemento onde o cabeçalho será inserido.
 * @param {object} usuario - O objeto do usuário logado.
 */
async function createHeader(placeholderId, usuario) {
    const placeholder = document.getElementById(placeholderId);
    if (!placeholder) return;

    const nomeAbreviado = usuario ? `Olá, ${usuario.nome.split(' ')[0]}!` : '';

    // --- NOVA FUNCIONALIDADE: Busca o nome da empresa para o cabeçalho ---
    let nomeFantasia = 'ADCON - Painel'; // Nome padrão
    // CORREÇÃO: Apenas admin e gerente podem acessar a rota de configuração.
    if (usuario && ['admin', 'gerente'].includes(usuario.role)) {
        try {
            const configResponse = await fetchWithAuth('/api/configuracao');
            if (configResponse && configResponse.ok) {
                const configData = await configResponse.json();
                if (configData && configData.nome_fantasia) {
                    nomeFantasia = configData.nome_fantasia;
                }
            }
        } catch (e) {
            console.error("Não foi possível carregar o nome da empresa para o cabeçalho.", e);
        }
    }

    // Adiciona o link de Relatórios apenas para admin ou gerente
    const relatoriosLink = (usuario && ['admin', 'gerente'].includes(usuario.role))
        ? `<a href="relatorios.html"><span>📊</span> Relatórios</a>`
        : '';

    placeholder.innerHTML = `
        <div class="header">
            <h1><a href="home.html" style="color: white; text-decoration: none;">${nomeFantasia}</a></h1>
            <div class="user-actions dropdown">
                <button class="dropdown-toggle" id="userMenuBtn">
                    <span style="margin-right: 0.5rem;">${nomeAbreviado}</span>
                    <span>👤</span>
                </button>
                <div id="userMenu" class="dropdown-content">
                    <a href="home.html"><span>🏠</span> Início</a>
                    ${relatoriosLink}
                    <hr style="margin: 0;">
                    <a href="#" onclick="logout()"><span>⏻</span> Sair</a>
                </div>
            </div>
        </div>
    `;

    // Adiciona a lógica do dropdown
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenu = document.getElementById('userMenu');
    userMenuBtn.addEventListener('click', () => {
        userMenu.classList.toggle('show');
    });
}

/**
 * Função de logout.
 */
function logout() {
    localStorage.removeItem('token');
    window.location.replace('login.html');
}