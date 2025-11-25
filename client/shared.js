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