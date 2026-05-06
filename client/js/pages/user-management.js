let currentUser; // Usuário logado (admin)

async function setupPage() {
    console.log('🔍 setupPage called');
    console.log('🔑 Token exists:', !!localStorage.getItem('token'));
    console.log('🌐 API_BASE_URL:', API_BASE_URL);

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/auth`);
        console.log('📡 fetchWithAuth response:', response);

        if (response) {
            currentUser = await response.json();
            console.log('👤 currentUser:', currentUser);
            console.log('🔒 User role:', currentUser.role);

            createHeader('header-placeholder', currentUser);

            if (currentUser.role !== 'admin') {
                console.log('❌ User is not admin, redirecting');
                alert('Acesso negado. Apenas administradores podem gerenciar usuários.');
                window.location.href = 'home.html';
                return;
            }

            console.log('✅ User is admin, showing page');
            document.body.style.display = 'block';
            console.log('📋 Calling loadUsers');
            await loadUsers();
        } else {
            console.error('❌ No response from fetchWithAuth');
        }
    } catch (error) {
        console.error('💥 Error in setupPage:', error);
        alert('Erro ao carregar dados do usuário. Verifique sua conexão.');
    }
}

async function loadUsers() {
    console.log('📋 loadUsers called');

    try {
        const url = `${API_BASE_URL}/api/auth/admin/users`;
        console.log('🔗 Fetching URL:', url);

        const response = await fetchWithAuth(url);
        console.log('📡 loadUsers response:', response);
        console.log('📊 Response status:', response.status);
        console.log('📝 Response ok:', response.ok);

        if (response && response.ok) {
            const data = await response.json();
            console.log('📦 Raw data received:', data);

            // A API retorna { usuarios: [], paginacao: {...} }
            const users = data.usuarios || data;
            console.log('👥 Users array:', users);
            console.log('📊 Users type:', typeof users);
            console.log('📏 Users length:', Array.isArray(users) ? users.length : 'not array');

            const tbody = document.querySelector('#usersTable tbody');
            console.log('📋 Table body found:', !!tbody);

            if (!Array.isArray(users)) {
                console.error('❌ users is not an array:', typeof users, users);
                alert('Erro: resposta da API inválida');
                return;
            }

            tbody.innerHTML = '';

            users.forEach((user, index) => {
                console.log(`👤 Processing user ${index}:`, user);
                const row = tbody.insertRow();
                row.dataset.userId = user._id;
                row.insertCell(0).textContent = user.nome;
                row.insertCell(1).textContent = user.email;
                row.insertCell(2).textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
                const actionsCell = row.insertCell(3);

                // CORREÇÃO: Define a condição para mostrar o botão de exclusão.
                const podeExcluir =
                    // 1. Não pode excluir a si mesmo.
                    user._id !== currentUser._id &&
                    // 2. Um gerente não pode excluir um administrador.
                    !(currentUser.role === 'gerente' && user.role === 'admin');

                // Um admin não pode personificar a si mesmo.
                const podePersonificar = user._id !== currentUser._id;

                let buttonsHtml = '';
                if (podePersonificar) {
                    buttonsHtml += `<button class="impersonate-btn">Personificar</button>`;
                }
                if (podeExcluir) {
                    buttonsHtml += `<button class="delete-btn">Excluir</button>`;
                }
                actionsCell.innerHTML = buttonsHtml || ((user._id === currentUser._id) ? 'Você' : 'Ação não permitida');
            });

            console.log('✅ Users table loaded successfully');
        } else {
            console.error('❌ Response not ok:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('❌ Error response:', errorText);
        }
    } catch (error) {
        console.error('💥 Error in loadUsers:', error);
        alert('Erro ao carregar usuários: ' + error.message);
    }
}

async function deleteUser(userId) {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/auth/admin/users/${userId}`, { method: 'DELETE' });
        if (response && response.ok) {
            alert('Usuário excluído com sucesso!');
            loadUsers();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Falha ao excluir usuário.');
        }
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        alert(`Erro: ${error.message}`);
    }
}

async function impersonateUser(userId) {
    if (!confirm('Tem certeza que deseja personificar este usuário? Você será redirecionado para a página inicial como se fosse ele.')) return;

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/auth/admin/impersonate/${userId}`, {
            method: 'POST'
        });

        if (response && response.ok) {
            const { token } = await response.json();
            localStorage.setItem('token', token); // Substitui o token atual pelo token de personificação
            window.location.href = 'home.html'; // Redireciona para a home
        } else {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Falha ao tentar personificar o usuário.');
        }
    } catch (error) {
        console.error('Erro ao personificar usuário:', error);
        alert(`Erro: ${error.message}`);
    }
}


document.getElementById('createUserForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const nome = document.getElementById('nome').value;
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const role = document.getElementById('role').value;
    const createMessage = document.getElementById('createMessage');

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/auth/admin/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha, role })
        });
        const data = await response.json();
        if (response.ok) {
            createMessage.className = 'message success';
            createMessage.textContent = 'Usuário criado com sucesso!';
            this.reset();
            loadUsers();
        } else {
            throw new Error(data.msg || data.errors?.[0]?.msg || 'Erro ao criar usuário.');
        }
    } catch (error) {
        createMessage.className = 'message error';
        createMessage.textContent = error.message;
    }
});

document.querySelector('#usersTable tbody').addEventListener('click', function(e) {
    if (e.target.classList.contains('delete-btn')) {
        const userId = e.target.closest('tr').dataset.userId;
        deleteUser(userId);
    } else if (e.target.classList.contains('impersonate-btn')) {
        const userId = e.target.closest('tr').dataset.userId;
        impersonateUser(userId);
    }
});

document.addEventListener('DOMContentLoaded', setupPage);