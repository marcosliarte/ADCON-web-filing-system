let usuario; // CORREÇÃO: Declara a variável de usuário em um escopo global

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
async function createHeader(placeholderId, usuarioData) {
    // CORREÇÃO: Atribui os dados recebidos à variável global 'usuario'
    usuario = usuarioData;

    const placeholder = document.getElementById(placeholderId);
    if (!placeholder) return;

    const nomeAbreviado = usuario ? `Olá, ${usuario.nome.split(' ')[0]}!` : '';

    // --- NOVA FUNCIONALIDADE: Busca o nome da empresa para o cabeçalho ---
    let nomeFantasia = 'ADCON - Painel'; // Nome padrão
    // CORREÇÃO: Apenas admin e gerente podem acessar a rota de configuração.
    if (usuario && ['admin', 'gerente'].includes(usuario.role)) { // Agora 'usuario' é a variável global
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
    let impersonatorId = null; const token = localStorage.getItem('token');
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
            <div class="header-actions">
                <!-- Dropdown de Notificações -->
                <div class="dropdown">
                    <div class="notification-bell" id="notificationBellBtn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                        <span id="notification-badge" class="notification-badge"></span>
                    </div>
                    <div id="notificationMenu" class="notification-dropdown">
                        <div class="notification-header">
                            <strong>Notificações</strong>
                            <a href="#" onclick="markAllNotificationsAsRead(event)" style="font-size: 0.8rem; color: #007bff;">Marcar todas como lidas</a>
                        </div>
                        <div class="notification-list" id="notification-list">
                            <div style="padding: 16px; text-align: center;">Carregando...</div>
                        </div>
                        <div class="notification-footer">
                            <a href="notificacoes.html">Ver todas</a>
                        </div>
                    </div>
                </div>

                <!-- Dropdown do Usuário -->
                <div class="dropdown">
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
        </div>
    `;

    // Adiciona a lógica do dropdown
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenu = document.getElementById('userMenu');
    const notificationBellBtn = document.getElementById('notificationBellBtn');
    const notificationMenu = document.getElementById('notificationMenu');

    userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationMenu.classList.remove('show');
        userMenu.classList.toggle('show');
    });

    notificationBellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userMenu.classList.remove('show');
        notificationMenu.classList.toggle('show');
        if (notificationMenu.classList.contains('show')) {
            loadNotifications();
        }
    });

    startNotificationPolling(); // Inicia a busca por notificações
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

// --- LÓGICA DO SISTEMA DE NOTIFICAÇÕES ---

function startNotificationPolling() {
    updateNotificationCount();
    setInterval(updateNotificationCount, 60000); // Verifica a cada 60 segundos
}

async function updateNotificationCount() {
    try {
        const response = await fetchWithAuth('/api/notificacoes/contagem-nao-lidas');
        if (!response || !response.ok) return;

        const data = await response.json();
        const badge = document.getElementById('notification-badge');

        if (data.count > 0) {
            badge.textContent = data.count > 9 ? '9+' : data.count;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Falha ao buscar contagem de notificações:', error);
    }
}

async function loadNotifications() {
    const list = document.getElementById('notification-list');
    list.innerHTML = '<div style="padding: 16px; text-align: center;">Carregando...</div>';

    try {
        const response = await fetchWithAuth('/api/notificacoes');
        if (!response || !response.ok) throw new Error('Falha ao carregar.');

        const notifications = await response.json();

        if (notifications.length === 0) {
            list.innerHTML = '<div style="padding: 16px; text-align: center; color: #6c757d;">Nenhuma notificação nova.</div>';
            return;
        }

        // Verifica se o usuário logado é admin para mudar o comportamento do botão de exclusão
        const isAdmin = usuario && usuario.role === 'admin';

        list.innerHTML = notifications.map(n => `
            <a href="notificacao-detalhes.html?id=${n._id}" class="notification-item ${!n.lida ? 'unread' : ''}" id="notification-${n._id}">
                <div class="notification-item-content">
                    <p style="margin: 0; font-size: 0.9rem; white-space: normal;">${n.mensagem}</p>
                    <small style="color: #6c757d;">${new Date(n.criado_em).toLocaleString('pt-BR')}</small>
                </div>
            </a>
        `).join('');

    } catch (error) {
        list.innerHTML = `<div style="padding: 16px; text-align: center; color: red;">${error.message}</div>`;
    }
}

async function markAllNotificationsAsRead(event) {
    event.preventDefault();
    event.stopPropagation();
    try {
        const response = await fetchWithAuth('/api/notificacoes/marcar-como-lidas', { method: 'POST' });
        if (!response || !response.ok) throw new Error('Falha ao marcar como lidas.');

        document.getElementById('notification-badge').style.display = 'none';
        
        const items = document.querySelectorAll('.notification-item.unread');
        items.forEach(item => item.classList.remove('unread'));

    } catch (error) {
        console.error(error.message);
        alert('Não foi possível marcar as notificações como lidas.');
    }
}

// Fecha os dropdowns se o usuário clicar fora deles
window.addEventListener('click', function(event) {
    const userMenu = document.getElementById('userMenu');
    const notificationMenu = document.getElementById('notificationMenu');
    
    if (userMenu && !userMenu.contains(event.target) && !document.getElementById('userMenuBtn').contains(event.target)) {
        userMenu.classList.remove('show');
    }
    if (notificationMenu && !notificationMenu.contains(event.target) && !document.getElementById('notificationBellBtn').contains(event.target)) {
        notificationMenu.classList.remove('show');
    }
});