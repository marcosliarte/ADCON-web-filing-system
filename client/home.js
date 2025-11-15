let usuario;

// Função para carregar os dados do usuário e atualizar a UI
async function getUsuario() {
    try {
        const response = await fetchWithAuth('/api/auth');
        if (response) {
            usuario = await response.json();
            // Cria o cabeçalho usando a função de shared.js
            createHeader('header-placeholder', usuario); 

            // Popula os dados do usuário na sidebar
            document.getElementById('user-name').textContent = usuario.nome;
            document.getElementById('user-email').textContent = usuario.email;
            document.getElementById('user-role').textContent = usuario.role.charAt(0).toUpperCase() + usuario.role.slice(1);
            const profilePicElement = document.getElementById('profile-pic');
            profilePicElement.src = usuario.fotoPerfilUrl || 'assets/profile-icon.svg';
            if (usuario.fotoPerfilUrl && usuario.fotoPerfilUrl !== 'assets/profile-icon.svg') {
                document.getElementById('deletePicIcon').style.display = 'inline-block';
            }

            // --- LÓGICA DE PERMISSÕES CENTRALIZADA ---
            const userRole = usuario.role;
            const getCard = (id) => document.getElementById(id);

            // Funcionalidades para TODOS os usuários
            if (getCard('card-nova-funcionalidade')) getCard('card-nova-funcionalidade').style.display = 'flex';

            // Funcionalidades para Admin e Gerente
            if (userRole === 'admin' || userRole === 'gerente') {
                if (getCard('card-gerenciar-mensalidades')) getCard('card-gerenciar-mensalidades').style.display = 'flex';
                if (getCard('card-ver-relatorios')) getCard('card-ver-relatorios').style.display = 'flex';
                if (getCard('card-config-empresa')) getCard('card-config-empresa').style.display = 'flex';
                if (getCard('card-gerenciar-funcionarios')) getCard('card-gerenciar-funcionarios').style.display = 'flex';
                
                // Gerenciar Usuários é visível para Admin e Gerente
                const adminLinks = getCard('admin-links');
                if (adminLinks) adminLinks.style.display = 'block';
            }

            // CORREÇÃO: O card "Cadastrar Empresa" agora é visível para Admin, Gerente e Funcionário.
            if (userRole === 'admin' || userRole === 'gerente' || userRole === 'funcionario') {
                if (getCard('card-cadastrar-empresa')) getCard('card-cadastrar-empresa').style.display = 'flex';
            }

            // Funcionalidades apenas para Admin
            if (userRole === 'admin') {
                // Se houver alguma funcionalidade exclusiva do admin no futuro,
                // ela será adicionada aqui.
            }
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        localStorage.removeItem('token');
        window.location.replace('login.html');
    }
}

// Funções de manipulação de foto de perfil
document.getElementById('profilePicInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profile-pic').src = e.target.result;
            document.getElementById('savePicIcon').style.display = 'inline-block';
            document.getElementById('editPicIcon').style.display = 'none';
            document.getElementById('deletePicIcon').style.display = 'none';
        }
        reader.readAsDataURL(file);
    }
});

async function saveProfilePic() {
    const input = document.getElementById('profilePicInput');
    const file = input.files[0];
    if (!file) {
        showToast('Por favor, selecione um arquivo primeiro.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('profilePic', file);

    try {
        const response = await fetchWithAuth('/api/auth/profile-pic', {
            method: 'POST',
            body: formData,
        });

        if (response && response.ok) {
            const data = await response.json();
            document.getElementById('profile-pic').src = data.fotoPerfilUrl;
            showToast('Foto de perfil atualizada com sucesso!', 'success');
            document.getElementById('savePicIcon').style.display = 'none';
            document.getElementById('editPicIcon').style.display = 'inline-block';
            document.getElementById('deletePicIcon').style.display = 'inline-block';
        } else {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Falha ao salvar a foto.');
        }
    } catch (error) {
        console.error('Erro ao salvar foto:', error);
        showToast(`Erro: ${error.message}`, 'error');
    }
}

async function deleteProfilePic() {
    const confirmed = await showConfirmationDialog('Tem certeza que deseja remover sua foto de perfil?');
    if (!confirmed) return;
    
    try {
        const response = await fetchWithAuth('/api/auth/profile-pic', {
            method: 'DELETE'
        });
        if (response && response.ok) {
            const data = await response.json();
            showToast('Foto de perfil removida com sucesso!', 'success');
            document.getElementById('profile-pic').src = data.fotoPerfilUrl;
            document.getElementById('deletePicIcon').style.display = 'none';
        } else {
            throw new Error('Falha ao remover a foto.');
        }
    } catch (error) {
        console.error('Erro ao remover foto:', error);
        showToast(`Erro: ${error.message}`, 'error');
    }
}

// Funções de alteração de senha e email
document.getElementById('changePasswordForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const senhaAtual = document.getElementById('senhaAtual').value;
    const novaSenha = document.getElementById('novaSenha').value;
    const confirmarNovaSenha = document.getElementById('confirmarNovaSenha').value;
    const passwordMessage = document.getElementById('passwordMessage');

    if (novaSenha !== confirmarNovaSenha) {
        passwordMessage.textContent = 'As novas senhas não coincidem.';
        passwordMessage.style.color = 'red';
        return;
    }

    try {
        const response = await fetchWithAuth('/api/auth/change-password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senhaAtual, novaSenha })
        });

        const data = await response.json();

        if (response.ok) {
            passwordMessage.textContent = data.msg;
            passwordMessage.style.color = 'green';
            this.reset();
            setTimeout(() => {
                document.getElementById('changePasswordContainer').style.display = 'none';
            }, 2000);
        } else {
            throw new Error(data.msg || 'Erro ao alterar a senha.');
        }
    } catch (error) {
        passwordMessage.textContent = error.message;
        passwordMessage.style.color = 'red';
    }
});

// Funções de alteração de email
document.getElementById('changeEmailForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const novoEmail = document.getElementById('novoEmail').value;
    const confirmarNovoEmail = document.getElementById('confirmarNovoEmail').value;
    const emailMessage = document.getElementById('emailMessage');

    if (novoEmail !== confirmarNovoEmail) {
        emailMessage.textContent = 'Os emails não coincidem.';
        emailMessage.style.color = 'red';
        return;
    }

    try {
        const response = await fetchWithAuth('/api/auth/change-email', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ novoEmail })
        });

        const data = await response.json();

        if (response.ok) {
            emailMessage.textContent = data.msg;
            emailMessage.style.color = 'green';
            document.getElementById('user-email').textContent = data.usuario.email;
            this.reset();
            setTimeout(() => {
                document.getElementById('changeEmailContainer').style.display = 'none';
            }, 2000);
        } else {
            throw new Error(data.msg || 'Erro ao alterar o email.');
        }
    } catch (error) {
        emailMessage.textContent = error.message;
        emailMessage.style.color = 'red';
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    await initializeHome(); // Chama a função initializeHome ao carregar o DOM

    document.getElementById('editPicIcon').addEventListener('click', () => document.getElementById('profilePicInput').click());
    document.getElementById('savePicIcon').addEventListener('click', saveProfilePic);
    document.getElementById('deletePicIcon').addEventListener('click', deleteProfilePic);

    document.getElementById('togglePasswordBtn').addEventListener('click', (e) => {
        e.preventDefault();
        const container = document.getElementById('changePasswordContainer');
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('toggleEmailBtn').addEventListener('click', (e) => {
        e.preventDefault();
        const container = document.getElementById('changeEmailContainer');
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
    });
});