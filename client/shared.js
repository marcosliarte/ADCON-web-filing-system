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
    const token = localStorage.getItem('token'); // CORREÇÃO: Busca o token do localStorage
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
        <style>
            .notification-icon { position: relative; margin-right: 1rem; cursor: pointer; }
            .notification-badge { position: absolute; top: -8px; right: -8px; background: #dc3545; color: white; 
                border-radius: 10px; padding: 2px 6px; font-size: 0.7rem; font-weight: bold; min-width: 18px; text-align: center; }
            .notification-dropdown { display: none; position: absolute; right: 0; top: 45px; background: white; 
                min-width: 350px; max-width: 400px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); border-radius: 8px; 
                z-index: 1000; max-height: 500px; overflow-y: auto; }
            .notification-dropdown.show { display: block; }
            .notification-header { padding: 1rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
            .notification-header h4 { margin: 0; font-size: 1rem; color: #333; }
            .notification-item { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f1f1; cursor: pointer; transition: background 0.2s; }
            .notification-item:hover { background: #f8f9fa; }
            .notification-item.unread { background: #e7f3ff; }
            .notification-title { font-weight: 600; font-size: 0.9rem; margin-bottom: 0.25rem; color: #333; }
            .notification-message { font-size: 0.85rem; color: #666; margin-bottom: 0.25rem; }
            .notification-time { font-size: 0.75rem; color: #999; }
            .notification-empty { padding: 2rem; text-align: center; color: #999; }
            .notification-footer { padding: 0.75rem; text-align: center; border-top: 1px solid #eee; }
            .notification-footer a { color: #007bff; text-decoration: none; font-size: 0.9rem; }
        </style>
        <div class="header">
            ${impersonationBanner}
            <h1><a href="home.html" style="color: white; text-decoration: none;">${nomeFantasia}</a></h1>
            <div style="display: flex; align-items: center;">
                <div class="notification-icon" id="notificationIcon">
                    <span style="font-size: 1.5rem;">🔔</span>
                    <span class="notification-badge" id="notificationBadge" style="display: none;">0</span>
                    <div class="notification-dropdown" id="notificationDropdown">
                        <div class="notification-header">
                            <h4>Notificações</h4>
                            <a href="#" onclick="marcarTodasLidas(event)" style="font-size: 0.85rem; color: #007bff; text-decoration: none;">Marcar todas como lidas</a>
                        </div>
                        <div id="notificationList">
                            <div class="notification-empty">Carregando...</div>
                        </div>
                        <div class="notification-footer">
                            <a href="notificacoes.html">Ver todas as notificações</a>
                        </div>
                    </div>
                </div>
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
        </div>
    `;

    // Adiciona a lógica do dropdown do menu de usuário
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenu = document.getElementById('userMenu');
    userMenuBtn.addEventListener('click', () => {
        userMenu.classList.toggle('show');
        document.getElementById('notificationDropdown').classList.remove('show');
    });

    // Adiciona a lógica do dropdown de notificações
    const notificationIcon = document.getElementById('notificationIcon');
    const notificationDropdown = document.getElementById('notificationDropdown');
    notificationIcon.addEventListener('click', () => {
        notificationDropdown.classList.toggle('show');
        userMenu.classList.remove('show');
        if (notificationDropdown.classList.contains('show')) {
            loadNotifications();
        }
    });

    // Fecha dropdowns ao clicar fora
    document.addEventListener('click', (e) => {
        if (!notificationIcon.contains(e.target)) {
            notificationDropdown.classList.remove('show');
        }
        if (!userMenuBtn.contains(e.target)) {
            userMenu.classList.remove('show');
        }
    });

    // Carrega contagem inicial de notificações
    updateNotificationBadge();
    
    // Atualiza contagem a cada 30 segundos
    setInterval(updateNotificationBadge, 30000);
}

/**
 * Atualiza o badge de notificações não lidas
 */
async function updateNotificationBadge() {
    try {
        const response = await fetchWithAuth('/api/notificacoes/count');
        if (!response || !response.ok) return;
        
        const { count } = await response.json();
        const badge = document.getElementById('notificationBadge');
        
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('Erro ao atualizar badge de notificações:', err);
    }
}

/**
 * Carrega as notificações recentes
 */
async function loadNotifications() {
    try {
        const response = await fetchWithAuth('/api/notificacoes?limit=10');
        if (!response || !response.ok) throw new Error('Falha ao carregar notificações');
        
        const { notificacoes } = await response.json();
        const list = document.getElementById('notificationList');
        
        if (!list) return;

        if (notificacoes.length === 0) {
            list.innerHTML = '<div class="notification-empty">Nenhuma notificação</div>';
            return;
        }

        const icones = {
            'documento_vencendo': '⏰',
            'documento_vencido': '⚠️',
            'pagamento_recebido': '💰',
            'mensagem_admin': '📢',
            'sistema': 'ℹ️'
        };

        list.innerHTML = notificacoes.map(n => {
            const tempo = formatarTempo(new Date(n.createdAt));
            const icone = icones[n.tipo] || '📌';
            const unreadClass = n.lida ? '' : 'unread';
            
            return `
                <div class="notification-item ${unreadClass}" onclick="abrirNotificacao('${n._id}', '${n.link || '#'}')">
                    <div class="notification-title">${icone} ${n.titulo}</div>
                    <div class="notification-message">${n.mensagem}</div>
                    <div class="notification-time">${tempo}</div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Erro ao carregar notificações:', err);
        document.getElementById('notificationList').innerHTML = 
            '<div class="notification-empty">Erro ao carregar</div>';
    }
}

/**
 * Abre uma notificação e marca como lida
 */
async function abrirNotificacao(id, link) {
    try {
        await fetchWithAuth(`/api/notificacoes/${id}/ler`, { method: 'PUT' });
        updateNotificationBadge();
        
        if (link && link !== '#') {
            window.location.href = link;
        }
    } catch (err) {
        console.error('Erro ao abrir notificação:', err);
    }
}

/**
 * Marca todas as notificações como lidas
 */
async function marcarTodasLidas(event) {
    event.preventDefault();
    event.stopPropagation();
    
    try {
        const response = await fetchWithAuth('/api/notificacoes/ler-todas', { method: 'PUT' });
        if (!response || !response.ok) throw new Error('Falha ao marcar notificações');
        
        showToast('Todas as notificações foram marcadas como lidas', 'success');
        updateNotificationBadge();
        loadNotifications();
    } catch (err) {
        showToast('Erro ao marcar notificações como lidas', 'error');
    }
}

/**
 * Formata tempo relativo (ex: "há 5 minutos")
 */
function formatarTempo(data) {
    const agora = new Date();
    const diff = Math.floor((agora - data) / 1000); // diferença em segundos
    
    if (diff < 60) return 'Agora mesmo';
    if (diff < 3600) return `Há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Há ${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `Há ${Math.floor(diff / 86400)} dia(s)`;
    return data.toLocaleDateString('pt-BR');
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

// --- UI Utilities: Toasts e Modal de confirmação ---
function ensureToastContainer() {
    if (document.getElementById('toast-container')) return;
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.right = '16px';
    container.style.bottom = '16px';
    container.style.zIndex = '99999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    document.body.appendChild(container);
}

function showToast(message, type = 'info', timeout = 4500) {
    ensureToastContainer();
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.minWidth = '220px';
    toast.style.padding = '10px 12px';
    toast.style.borderRadius = '6px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
    toast.style.background = type === 'error' ? '#dc3545' : (type === 'success' ? '#28a745' : '#343a40');
    toast.style.color = 'white';
    toast.style.fontSize = '0.95rem';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 220ms ease, transform 220ms ease';
    toast.textContent = message;

    container.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    const remover = () => {
        toast.style.opacity = '0';
        setTimeout(() => { try { container.removeChild(toast); } catch (e) {} }, 300);
    };

    const timer = setTimeout(remover, timeout);
    toast.addEventListener('click', () => { clearTimeout(timer); remover(); });
}

// Confirm modal util (returns Promise<boolean>)
function ensureConfirmModal() {
    if (document.getElementById('globalConfirmModal')) return;
    const modal = document.createElement('div');
    modal.id = 'globalConfirmModal';
    modal.style.display = 'none';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.background = 'rgba(0,0,0,0.4)';
    modal.style.zIndex = '99998';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';

    modal.innerHTML = `
        <div style="background:white; border-radius:8px; width:90%; max-width:520px; padding:1rem; box-shadow:0 8px 24px rgba(0,0,0,0.2);">
            <h3 id="globalConfirmTitle" style="margin-top:0; color:#007bff">Confirmação</h3>
            <p id="globalConfirmMessage">Mensagem...</p>
            <div id="globalConfirmTypedContainer" style="display:none; margin-top:0.5rem;">
                <label style="font-size:0.9rem;">Digite para confirmar: <input id="globalConfirmTypedInput" style="width:60%; margin-left:8px; padding:4px;" /></label>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:1rem;">
                <button id="globalConfirmCancel" style="padding:6px 10px; border-radius:4px; border:none; background:#6c757d; color:white">Cancelar</button>
                <button id="globalConfirmOk" style="padding:6px 10px; border-radius:4px; border:none; background:#007bff; color:white">Confirmar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function openConfirmModal(message, options = {}) {
    ensureConfirmModal();
    return new Promise((resolve) => {
        const modal = document.getElementById('globalConfirmModal');
        const titleEl = document.getElementById('globalConfirmTitle');
        const msgEl = document.getElementById('globalConfirmMessage');
        const typedContainer = document.getElementById('globalConfirmTypedContainer');
        const typedInput = document.getElementById('globalConfirmTypedInput');
        const btnOk = document.getElementById('globalConfirmOk');
        const btnCancel = document.getElementById('globalConfirmCancel');

        titleEl.textContent = options.title || 'Confirmação';
        msgEl.textContent = message || '';

        if (options.requireTyped) {
            typedContainer.style.display = 'block';
            typedInput.value = '';
        } else {
            typedContainer.style.display = 'none';
        }

        modal.style.display = 'flex';

        const cleanup = (result) => {
            modal.style.display = 'none';
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
            resolve(result);
        };

        const onOk = () => {
            if (options.requireTyped) {
                const expected = (options.expectedText || '').toString();
                if (typedInput.value.trim() === expected) {
                    cleanup(true);
                } else {
                    showToast(`Texto de confirmação incorreto. Digite: ${expected}`, 'error');
                }
            } else {
                cleanup(true);
            }
        };

        const onCancel = () => cleanup(false);

        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
    });
}