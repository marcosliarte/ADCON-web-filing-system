checkAuth();

let currentUser; // Usuário logado (admin)

async function setupPage() {
    const response = await fetchWithAuth('/api/auth');
    if (response) {
        currentUser = await response.json();
        createHeader('header-placeholder', currentUser);
        if (currentUser.role !== 'admin') {
            alert('Acesso negado. Apenas administradores podem gerenciar usuários.');
            window.location.href = 'home.html';
            return;
        }
        document.body.style.display = 'block';
        loadUsers();
    }
}

async function loadUsers() {
    try {
        const response = await fetchWithAuth('/api/auth/admin/users');
        if (response && response.ok) {
            const users = await response.json();
            const tbody = document.querySelector('#usersTable tbody');
            tbody.innerHTML = '';
            users.forEach(user => {
                const row = tbody.insertRow();
                row.dataset.userId = user._id; // Adiciona o ID à linha
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

                if (podeExcluir) {
                    actionsCell.innerHTML = `<button class="delete-btn">Excluir</button>`;
                } else {
                    actionsCell.textContent = (user._id === currentUser._id) ? 'Você' : 'Ação não permitida';
                }
            });
        }
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        alert('Erro ao carregar usuários.');
    }
}

async function deleteUser(userId) {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
        const response = await fetchWithAuth(`/api/auth/admin/users/${userId}`, { method: 'DELETE' });
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

document.getElementById('createUserForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const nome = document.getElementById('nome').value;
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const role = document.getElementById('role').value;
    const createMessage = document.getElementById('createMessage');

    try {
        const response = await fetchWithAuth('/api/auth/admin/users', {
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
    }
});

document.addEventListener('DOMContentLoaded', setupPage);