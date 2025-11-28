// home.js - Lógica da página inicial

let usuario;

// Função para buscar dados do usuário
async function getUsuario() {
    try {
        const response = await fetchWithAuth('/api/auth');
        if (response && response.ok) {
            usuario = await response.json();
                
            // Verificar se está em modo de personificação
            checkImpersonation();
            
            // Preenche cabeçalho e remove skeletons
            const headerEl = document.getElementById('header-user-name');
            headerEl.textContent = `Olá, ${usuario.nome.split(' ')[0]}!`;
            headerEl.classList.remove('skeleton');

            const nameEl = document.getElementById('user-name');
            nameEl.textContent = usuario.nome;
            nameEl.classList.remove('skeleton');

            const emailEl = document.getElementById('user-email');
            emailEl.textContent = usuario.email;
            emailEl.classList.remove('skeleton');

            const roleEl = document.getElementById('user-role');
            roleEl.textContent = usuario.role.charAt(0).toUpperCase() + usuario.role.slice(1);
            roleEl.classList.remove('skeleton');

            // Carrega a foto de perfil do usuário ou a imagem padrão
            const profilePicElement = document.getElementById('profile-pic');
            const defaultProfilePic = '/uploads/profile-pics/no-profile.png';
            profilePicElement.src = usuario.fotoPerfilUrl || defaultProfilePic;
            
            // Adiciona fallback se a imagem não carregar
            profilePicElement.onerror = function() {
                this.onerror = null;
                this.src = defaultProfilePic;
            };
            
            if (usuario.fotoPerfilUrl && usuario.fotoPerfilUrl !== defaultProfilePic) {
                document.getElementById('deletePicIcon').style.display = 'inline-block';
            }

            // Funcionalidades para Admin e Gerente
            if (['admin', 'gerente'].includes(usuario.role)) {
                document.getElementById('admin-links').style.display = 'block';
                document.getElementById('card-ver-relatorios').style.display = 'flex';
                document.getElementById('card-gerenciar-funcionarios').style.display = 'flex';
                document.getElementById('card-config-empresa').style.display = 'flex';
                document.getElementById('card-gerenciar-mensalidades').style.display = 'flex';
            }
            
            // Funcionalidades exclusivas para Admin
            if (usuario.role === 'admin') {
                document.getElementById('card-central-admin').style.display = 'flex';
            }
            
            // Funcionalidades para Admin, Gerente e Funcionário
            if (['admin', 'gerente', 'funcionario'].includes(usuario.role)) {
                document.getElementById('card-faturamento').style.display = 'flex';
                document.getElementById('card-alteracao-empresa').style.display = 'flex';
                document.getElementById('card-cadastrar-empresa').style.display = 'flex';
                document.getElementById('card-documentos-vencer').style.display = 'flex';
                document.getElementById('card-meus-pagamentos').style.display = 'flex';
            }
            
            // Remove placeholder skeletons do painel de funcionalidades
            const sk = document.getElementById('dashboard-skeleton');
            if (sk) sk.style.display = 'none';
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        localStorage.removeItem('token');
        window.location.replace('login.html');
    }
}

// Função de logout
function logout() {
    localStorage.removeItem('token');
    window.location.replace('login.html');
}

// Função para salvar foto de perfil
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
            
            try { 
                document.getElementById('profilePicInput').value = ''; 
            } catch (e) {}
        } else {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Falha ao salvar a foto.');
        }
    } catch (error) {
        console.error('Erro ao salvar foto:', error);
        showToast(`Erro: ${error.message}`, 'error');
    }
}

// Função para deletar foto de perfil
async function deleteProfilePic() {
    const confirmed = await openConfirmModal('Tem certeza que deseja remover sua foto de perfil?', { 
        requireTyped: false, 
        title: 'Remover Foto' 
    });
    if (!confirmed) return;
    
    try {
        const response = await fetchWithAuth('/api/auth/profile-pic', {
            method: 'DELETE'
        });
        if (response && response.ok) {
            const data = await response.json();
            showToast('Foto de perfil removida com sucesso!', 'success');
            document.getElementById('profile-pic').src = data.fotoPerfilUrl || '/uploads/profile-pics/no-profile.png';
            document.getElementById('deletePicIcon').style.display = 'none';
            document.getElementById('savePicIcon').style.display = 'none';
            document.getElementById('editPicIcon').style.display = 'inline-block';
            
            try { 
                document.getElementById('profilePicInput').value = ''; 
            } catch (e) {}
        } else {
            throw new Error('Falha ao remover a foto.');
        }
    } catch (error) {
        console.error('Erro ao remover foto:', error);
        showToast(`Erro: ${error.message}`, 'error');
    }
}

// Verificar se está em modo de personificação
function checkImpersonation() {
    let impersonatorId = null;
    const token = localStorage.getItem('token');
    
    try {
        const payloadBase64 = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payloadBase64));
        if (decodedPayload.usuario && decodedPayload.usuario.impersonatorId) {
            impersonatorId = decodedPayload.usuario.impersonatorId;
        }
    } catch (e) {
        console.error("Erro ao decodificar token para personificação:", e);
    }

    const bannerDiv = document.getElementById('impersonation-banner');
    if (impersonatorId && usuario) {
        bannerDiv.innerHTML = `
            <div style="background-color: #ffc107; color: #333; text-align: center; padding: 0.5rem; font-weight: bold;">
                Você está navegando como ${usuario.nome}. 
                <a href="#" onclick="stopImpersonating(event)" style="color: #007bff; text-decoration: underline;">Voltar para sua conta</a>.
            </div>
        `;
    } else {
        bannerDiv.innerHTML = '';
    }
}

// Parar personificação
async function stopImpersonating(event) {
    event.preventDefault();
    try {
        const response = await fetchWithAuth('/api/auth/admin/stop-impersonating', {
            method: 'POST'
        });
        if (!response || !response.ok) {
            throw new Error('Falha ao retornar para a conta original.');
        }

        const { token } = await response.json();
        localStorage.setItem('token', token);
        window.location.href = 'user-management.html';
    } catch (error) {
        console.error('Erro ao sair da personificação:', error);
        alert(`Erro: ${error.message}`);
    }
}

// Inicialização da página
document.addEventListener('DOMContentLoaded', async () => {
    await getUsuario();

    // Lógica para o menu dropdown do usuário
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenu = document.getElementById('userMenu');

    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', () => userMenu.classList.toggle('show'));
    }

    // Lógica para mostrar/esconder os formulários de configuração
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

    // Lógica para alterar senha
    document.getElementById('changePasswordForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const senhaAtual = document.getElementById('senhaAtual').value;
        const novaSenha = document.getElementById('novaSenha').value;
        const confirmarNovaSenha = document.getElementById('confirmarNovaSenha').value;

        if (novaSenha !== confirmarNovaSenha) {
            showToast('As novas senhas não coincidem.', 'error');
            return;
        }

        try {
            const response = await fetchWithAuth('/api/auth/change-password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senhaAtual, novaSenha })
            });

            if (response && response.ok) {
                const data = await response.json();
                showToast(data.msg || 'Senha alterada com sucesso!', 'success');
                this.reset();
                setTimeout(() => {
                    document.getElementById('changePasswordContainer').style.display = 'none';
                }, 1200);
            } else {
                const data = response ? await response.json().catch(() => ({msg:'Erro'})) : {msg:'Erro'};
                showToast(data.msg || 'Erro ao alterar a senha.', 'error');
            }
        } catch (error) {
            showToast(error.message || 'Erro ao alterar a senha.', 'error');
        }
    });

    // Lógica para alterar email
    document.getElementById('changeEmailForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const novoEmail = document.getElementById('novoEmail').value;
        const confirmarNovoEmail = document.getElementById('confirmarNovoEmail').value;

        if (novoEmail !== confirmarNovoEmail) {
            showToast('Os emails não coincidem.', 'error');
            return;
        }

        try {
            const response = await fetchWithAuth('/api/auth/change-email', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ novoEmail })
            });

            if (response.ok) {
                const data = await response.json();
                showToast(data.msg || 'Email alterado com sucesso!', 'success');
                document.getElementById('user-email').textContent = data.usuario.email;
                this.reset();
                setTimeout(() => { 
                    document.getElementById('changeEmailContainer').style.display = 'none'; 
                }, 1200);
            } else {
                const data = await response.json();
                showToast(data.msg || 'Erro ao alterar o email.', 'error');
            }
        } catch (error) {
            showToast(error.message || 'Erro ao alterar o email.', 'error');
        }
    });

    // Lógica para upload de foto
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
});
