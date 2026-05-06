let usuarios = [];

document.addEventListener('DOMContentLoaded', async () => {
    const userResponse = await fetchWithAuth('/api/auth');
    if (!userResponse || !userResponse.ok) {
        window.location.replace('login.html');
        return;
    }

    const usuario = await userResponse.json();

    if (usuario.role !== 'admin') {
        document.body.innerHTML = '<div class="container"><h1>Acesso Negado</h1><p>Apenas administradores podem acessar esta página.</p></div>';
        document.body.style.display = 'block';
        return;
    }

    createHeader('header-placeholder', usuario);
    document.body.style.display = 'block';

    setupEventListeners();
    carregarUsuarios();
});

async function carregarUsuarios() {
    try {
        const response = await fetchWithAuth('/api/auth/admin/users?limit=100');
        if (!response.ok) throw new Error('Falha ao carregar usuários');

        const data = await response.json();
        usuarios = data.usuarios || data;

        renderizarListaUsuarios();
    } catch (err) {
        console.error('Erro ao carregar usuários:', err);
        const container = document.getElementById('userSelection');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #dc3545;">Erro ao carregar usuários. Tente recarregar a página.</p>';
        }
    }
}

function renderizarListaUsuarios() {
    const container = document.getElementById('userSelection');
    
    if (usuarios.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">Nenhum usuário encontrado</p>';
        return;
    }

    const roleNames = {
        'admin': 'Administrador',
        'gerente': 'Gerente',
        'funcionario': 'Funcionário',
        'empresario': 'Empresário'
    };

    container.innerHTML = `
        <div style="padding: 0.5rem; border-bottom: 1px solid #ddd; background: #f8f9fa;">
            <label style="font-weight: 600; cursor: pointer;">
                <input type="checkbox" id="selectAll">
                Selecionar todos
            </label>
        </div>
        ${usuarios.map(u => `
            <div class="user-item">
                <input type="checkbox" id="user_${u._id}" value="${u._id}" class="user-checkbox">
                <label for="user_${u._id}">
                    ${u.nome} 
                    <small style="color: #666;">(${roleNames[u.role] || u.role}) - ${u.email}</small>
                </label>
            </div>
        `).join('')}
    `;
}

function selecionarTodos() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.user-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
}

function alterarDestinatarios() {
    const tipo = document.querySelector('input[name="destinatarios"]:checked').value;
    
    document.getElementById('roleSelect').style.display = tipo === 'role' ? 'block' : 'none';
    document.getElementById('usuariosList').style.display = tipo === 'especificos' ? 'block' : 'none';
}

async function enviarNotificacao(e) {
    e.preventDefault();
    
    const tipo = document.querySelector('input[name="destinatarios"]:checked').value;
    const titulo = document.getElementById('titulo').value.trim();
    const mensagem = document.getElementById('mensagem').value.trim();
    const link = document.getElementById('link').value.trim();
    
    if (!titulo || !mensagem) {
        mostrarMensagem('Título e mensagem são obrigatórios', 'error');
        return;
    }

    const btnEnviar = document.getElementById('btnEnviar');
    const spinner = document.getElementById('loadingSpinner');
    
    btnEnviar.disabled = true;
    spinner.style.display = 'inline';

    try {
        let response;
        
        if (tipo === 'todos') {
            response = await fetchWithAuth('/api/notificacoes/admin/enviar', {
                method: 'POST',
                body: JSON.stringify({ destinatarios: 'todos', titulo, mensagem, link })
            });
        } else if (tipo === 'role') {
            const role = document.getElementById('role').value;
            if (!role) {
                mostrarMensagem('Selecione um perfil', 'error');
                btnEnviar.disabled = false;
                spinner.style.display = 'none';
                return;
            }
            response = await fetchWithAuth('/api/notificacoes/admin/enviar-role', {
                method: 'POST',
                body: JSON.stringify({ role, titulo, mensagem, link })
            });
        } else {
            const checkboxes = document.querySelectorAll('.user-checkbox:checked');
            if (checkboxes.length === 0) {
                mostrarMensagem('Selecione pelo menos um usuário', 'error');
                btnEnviar.disabled = false;
                spinner.style.display = 'none';
                return;
            }
            const destinatarios = Array.from(checkboxes).map(cb => cb.value);
            response = await fetchWithAuth('/api/notificacoes/admin/enviar', {
                method: 'POST',
                body: JSON.stringify({ destinatarios, titulo, mensagem, link })
            });
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.msg || 'Erro ao enviar notificação');
        }

        const result = await response.json();
        mostrarMensagem(`Notificação enviada para ${result.count} usuário(s) com sucesso!`, 'success');
        limparFormulario();
        
    } catch (err) {
        mostrarMensagem(`Erro: ${err.message}`, 'error');
    } finally {
        btnEnviar.disabled = false;
        spinner.style.display = 'none';
    }
}

function limparFormulario() {
    document.getElementById('notificationForm').reset();
    document.querySelectorAll('.user-checkbox').forEach(cb => cb.checked = false);
    const selectAll = document.getElementById('selectAll');
    if (selectAll) selectAll.checked = false;
    alterarDestinatarios();
}

function mostrarMensagem(texto, tipo) {
    const statusDiv = document.getElementById('messageStatus');
    statusDiv.className = tipo === 'success' ? 'success-message' : 'error-message';
    statusDiv.textContent = texto;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

function setupEventListeners() {
    document.querySelectorAll('input[name="destinatarios"]').forEach(radio => {
        radio.addEventListener('change', alterarDestinatarios);
    });

    document.getElementById('btnLimpar').addEventListener('click', limparFormulario);
    document.getElementById('notificationForm').addEventListener('submit', enviarNotificacao);

    // Delegação pois #selectAll é criado dinamicamente
    document.addEventListener('change', (e) => {
        if (e.target.id === 'selectAll') selecionarTodos();
    });

    alterarDestinatarios();
}
