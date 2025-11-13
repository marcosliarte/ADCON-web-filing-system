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

    // --- LÓGICA DE PERSONIFICAÇÃO ---
    // Decodifica o token para verificar se é uma sessão de personificação
    let impersonatorId = null;
    try {
        const payloadBase64 = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payloadBase64));
        if (decodedPayload.usuario && decodedPayload.usuario.impersonatorId) {
            impersonatorId = decodedPayload.usuario.impersonatorId;
        }
    } catch (e) {
        console.error("Erro ao decodificar token para personificação:", e);
    }

    const impersonationBanner = impersonatorId ? `<div style="background-color: #ffc107; color: #333; text-align: center; padding: 0.5rem; font-weight: bold;">Você está navegando como ${usuario.nome}. <a href="#" onclick="stopImpersonating(event)" style="color: #007bff; text-decoration: underline;">Voltar para sua conta</a>.</div>` : '';

    // Adiciona o link de Relatórios apenas para admin ou gerente
    const relatoriosLink = (usuario && ['admin', 'gerente'].includes(usuario.role))
        ? `<a href="relatorios.html"><span>📊</span> Relatórios</a>`
        : '';

    placeholder.innerHTML = `
        <div class="header">
            ${impersonationBanner}
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

/**
 * Para a sessão de personificação e retorna para a conta do admin.
 */
async function stopImpersonating(event) {
    event.preventDefault();
    try {
        const response = await fetchWithAuth('/api/auth/admin/stop-impersonating', { method: 'POST' });
        if (!response.ok) throw new Error('Falha ao retornar para a conta original.');

        const { token } = await response.json();
        localStorage.setItem('token', token);
        window.location.href = 'user-management.html'; // Volta para a tela de gerenciamento de usuários
    } catch (error) {
        alert(`Erro: ${error.message}`);
        logout(); // Em caso de erro grave, faz logout por segurança
    }
}