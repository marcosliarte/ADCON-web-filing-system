let currentUser;
let loadedUsers = [];
let editingUserId = null;
let empresasList = [];

const roleLabels = {
    admin: 'Administrador',
    gerente: 'Gerente',
    funcionario: 'Funcionário',
    empresario: 'Empresário'
};

function roleBadge(role) {
    return `<span class="role-badge role-${role}">${roleLabels[role] || role}</span>`;
}

async function setupPage() {
    try {
        const response = await fetchWithAuth('/api/auth');
        if (!response) return;

        currentUser = await response.json();
        createHeader('header-placeholder', currentUser);

        if (currentUser.role !== 'admin') {
            showToast('Acesso negado. Apenas administradores podem gerenciar usuários.', 'error');
            setTimeout(() => { window.location.href = 'home.html'; }, 1500);
            return;
        }

        await loadEmpresas();
        loadUsers();
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
    }
}

async function loadEmpresas() {
    try {
        const r = await fetchWithAuth('/api/empresas?limite=200&ordenacao=nome&direcao=asc');
        if (r && r.ok) {
            const data = await r.json();
            empresasList = data.docs || data.empresas || [];
            populateEmpresaSelects();
        }
    } catch (e) { /* silencioso — não bloqueia o restante da página */ }
}

function populateEmpresaSelects(selectedId = '') {
    const options = empresasList.map(e =>
        `<option value="${e._id}" ${e._id === selectedId ? 'selected' : ''}>${e.nome}</option>`
    ).join('');
    const placeholder = '<option value="">Selecione a empresa...</option>';
    document.getElementById('empresaId').innerHTML = placeholder + options;
    document.getElementById('modal-empresaId').innerHTML = placeholder + options;
}

function toggleEmpresaField(role, grupoId, selectId, selectedId = '') {
    const grupo = document.getElementById(grupoId);
    grupo.style.display = role === 'empresario' ? 'block' : 'none';
    if (role === 'empresario' && selectedId) {
        document.getElementById(selectId).value = selectedId;
    }
}

async function loadUsers() {
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Carregando...</td></tr>';

    try {
        const response = await fetchWithAuth('/api/auth/admin/users');
        if (!response || !response.ok) throw new Error('Falha ao carregar usuários');

        const data = await response.json();
        loadedUsers = data.usuarios || data;

        const countBadge = document.getElementById('userCount');
        countBadge.textContent = loadedUsers.length;
        countBadge.style.display = loadedUsers.length ? 'inline' : 'none';

        if (loadedUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Nenhum usuário cadastrado</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        loadedUsers.forEach(user => {
            const isSelf = user._id === currentUser._id;
            const podeExcluir = !isSelf;

            const empresaVinculada = user.empresaId
                ? (empresasList.find(e => e._id === (user.empresaId?._id || user.empresaId))?.nome || '')
                : '';

            let actions;
            if (isSelf) {
                actions = '<span class="you-badge">Você</span>';
            } else {
                actions = `
                    <div class="table-actions">
                        <button class="btn-action btn-edit edit-btn"
                            data-id="${user._id}"
                            data-nome="${user.nome.replace(/"/g, '&quot;')}"
                            data-email="${user.email.replace(/"/g, '&quot;')}"
                            data-role="${user.role}"
                            data-empresa-id="${user.empresaId || ''}">✏️ Editar</button>
                        <button class="btn-action btn-impersonate impersonate-btn" data-id="${user._id}">👁️ Personificar</button>
                        <button class="btn-action btn-reset reset-btn" data-id="${user._id}" data-nome="${user.nome.replace(/"/g, '&quot;')}">🔑 Resetar Senha</button>
                        ${podeExcluir ? `<button class="btn-action btn-delete delete-btn" data-id="${user._id}">🗑️ Excluir</button>` : ''}
                    </div>`;
            }

            const tr = document.createElement('tr');
            tr.dataset.userId = user._id;
            tr.innerHTML = `
                <td>
                    <div class="user-name">${user.nome}</div>
                    ${empresaVinculada ? `<div class="user-email">${empresaVinculada}</div>` : ''}
                </td>
                <td>
                    <div class="user-email">${user.email}</div>
                </td>
                <td>${roleBadge(user.role)}</td>
                <td>${actions}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        showToast('Erro ao carregar usuários', 'error');
        tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Erro ao carregar usuários</td></tr>';
    }
}

function openEditModal(btn) {
    editingUserId = btn.dataset.id;
    document.getElementById('modal-nome').value = btn.dataset.nome;
    document.getElementById('modal-email').value = btn.dataset.email;
    const role = btn.dataset.role;
    document.getElementById('modal-role').value = role;
    const empresaId = btn.dataset.empresaId || '';
    toggleEmpresaField(role, 'grupo-empresa-editar', 'modal-empresaId', empresaId);
    document.getElementById('editUserModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editUserModal').style.display = 'none';
    editingUserId = null;
}

async function saveEdit() {
    if (!editingUserId) return;

    const nome = document.getElementById('modal-nome').value.trim();
    const email = document.getElementById('modal-email').value.trim();
    const newRole = document.getElementById('modal-role').value;
    const empresaId = document.getElementById('modal-empresaId').value || null;

    if (!nome || !email) {
        showToast('Nome e email são obrigatórios', 'error');
        return;
    }

    const original = loadedUsers.find(u => u._id === editingUserId);
    const savBtn = document.getElementById('modal-save');
    savBtn.disabled = true;
    savBtn.textContent = 'Salvando...';

    try {
        // Atualiza nome, email e (se empresário) empresaId
        const bodyNome = { nome, email };
        if (newRole === 'empresario') bodyNome.empresaId = empresaId;
        else bodyNome.empresaId = null;

        const resNome = await fetchWithAuth(`/api/auth/admin/users/${editingUserId}`, {
            method: 'PUT',
            body: JSON.stringify(bodyNome)
        });
        if (!resNome.ok) {
            const err = await resNome.json();
            throw new Error(err.msg || 'Erro ao atualizar nome/email');
        }

        // Atualiza perfil se mudou
        if (original && newRole !== original.role) {
            const resRole = await fetchWithAuth(`/api/auth/admin/users/${editingUserId}/role`, {
                method: 'PUT',
                body: JSON.stringify({ role: newRole })
            });
            if (!resRole.ok) {
                const err = await resRole.json();
                throw new Error(err.msg || 'Erro ao atualizar perfil');
            }
        }

        showToast('Usuário atualizado com sucesso!', 'success');
        closeEditModal();
        loadUsers();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        savBtn.disabled = false;
        savBtn.textContent = 'Salvar Alterações';
    }
}

async function deleteUser(userId) {
    const confirmed = await showConfirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.');
    if (!confirmed) return;

    try {
        const response = await fetchWithAuth(`/api/auth/admin/users/${userId}`, { method: 'DELETE' });
        if (response && response.ok) {
            showToast('Usuário excluído com sucesso!', 'success');
            loadUsers();
        } else {
            const err = await response.json();
            throw new Error(err.msg || 'Falha ao excluir usuário');
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function resetPassword(userId, nomeUsuario) {
    const confirmed = await showConfirm(`Resetar a senha de "${nomeUsuario}"? Uma senha temporária será gerada e exibida uma única vez.`, { title: 'Resetar Senha' });
    if (!confirmed) return;

    try {
        const response = await fetchWithAuth(`/api/auth/admin/users/${userId}/reset-password`, { method: 'POST' });
        if (!response || !response.ok) {
            const err = await response.json();
            throw new Error(err.msg || 'Falha ao resetar senha');
        }
        const { tempPassword } = await response.json();
        showResetResult(nomeUsuario, tempPassword);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function showResetResult(nome, tempPassword) {
    document.getElementById('resetResultNome').textContent = nome;
    document.getElementById('resetResultSenha').value = tempPassword;
    document.getElementById('resetPasswordModal').style.display = 'flex';
}

async function impersonateUser(userId) {
    const confirmed = await showConfirm('Deseja personificar este usuário? Você será redirecionado como ele.');
    if (!confirmed) return;

    try {
        const response = await fetchWithAuth(`/api/auth/admin/impersonate/${userId}`, { method: 'POST' });
        if (response && response.ok) {
            const { token } = await response.json();
            localStorage.setItem('token', token);
            window.location.href = 'home.html';
        } else {
            const err = await response.json();
            throw new Error(err.msg || 'Falha ao personificar usuário');
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Event delegation na tabela
document.querySelector('#usersTable tbody').addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('delete-btn')) deleteUser(id);
    else if (btn.classList.contains('impersonate-btn')) impersonateUser(id);
    else if (btn.classList.contains('edit-btn')) openEditModal(btn);
    else if (btn.classList.contains('reset-btn')) resetPassword(id, btn.dataset.nome);
});

// Formulário de criação
document.getElementById('createUserForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const nome = document.getElementById('nome').value;
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const role = document.getElementById('role').value;
    const empresaId = document.getElementById('empresaId').value || null;
    const createMessage = document.getElementById('createMessage');
    const btnCriar = document.getElementById('btnCriar');

    btnCriar.disabled = true;
    btnCriar.textContent = 'Criando...';
    createMessage.className = 'form-message';
    createMessage.textContent = '';

    try {
        const body = { nome, email, senha, role };
        if (role === 'empresario' && empresaId) body.empresaId = empresaId;

        const response = await fetchWithAuth('/api/auth/admin/users', {
            method: 'POST',
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (response.ok) {
            createMessage.className = 'form-message success';
            createMessage.textContent = 'Usuário criado com sucesso!';
            this.reset();
            loadUsers();
        } else {
            throw new Error(data.msg || data.errors?.[0]?.msg || 'Erro ao criar usuário');
        }
    } catch (error) {
        createMessage.className = 'form-message error';
        createMessage.textContent = error.message;
    } finally {
        btnCriar.disabled = false;
        btnCriar.textContent = 'Criar Usuário';
    }
});

// Modal
document.getElementById('modal-close-x').addEventListener('click', closeEditModal);
document.getElementById('modal-cancel-btn').addEventListener('click', closeEditModal);
document.getElementById('modal-save').addEventListener('click', saveEdit);
document.getElementById('editUserModal').addEventListener('click', function(e) {
    if (e.target === this) closeEditModal();
});

function copiarSenha() {
    const input = document.getElementById('resetResultSenha');
    input.select();
    document.execCommand('copy');
    showToast('Senha copiada!', 'success');
}

function closeResetModal() {
    document.getElementById('resetPasswordModal').style.display = 'none';
}

document.getElementById('reset-modal-close-x').addEventListener('click', closeResetModal);
document.getElementById('reset-modal-ok').addEventListener('click', closeResetModal);
document.getElementById('resetPasswordModal').addEventListener('click', function(e) {
    if (e.target === this) closeResetModal();
});

// Mostrar/ocultar campo de empresa conforme perfil selecionado
document.getElementById('role').addEventListener('change', function() {
    toggleEmpresaField(this.value, 'grupo-empresa-criar', 'empresaId');
});
document.getElementById('modal-role').addEventListener('change', function() {
    toggleEmpresaField(this.value, 'grupo-empresa-editar', 'modal-empresaId');
});

document.addEventListener('DOMContentLoaded', setupPage);
