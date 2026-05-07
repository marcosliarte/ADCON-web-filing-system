document.addEventListener('DOMContentLoaded', async () => {
    // Verifica se setup ainda é necessário; se não, redireciona para login
    try {
        const res = await fetch('/api/auth/setup/status');
        const { setupRequired } = await res.json();
        if (!setupRequired) {
            window.location.replace('login.html');
            return;
        }
    } catch (e) {
        showMessage('Erro ao conectar com o servidor.', 'error');
        return;
    }

    const form    = document.getElementById('setup-form');
    const btnSetup = document.getElementById('btn-setup');

    // Toggle visibilidade de senha
    document.querySelectorAll('.btn-eye').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = document.getElementById(btn.dataset.target);
            const show  = input.type === 'password';
            input.type  = show ? 'text' : 'password';
            btn.textContent = show ? '🙈' : '👁';
        });
    });

    // Validação em tempo real da confirmação
    document.getElementById('confirmar').addEventListener('input', function () {
        const mismatch = document.getElementById('pw-mismatch');
        mismatch.style.display =
            (this.value && this.value !== document.getElementById('senha').value)
                ? 'block' : 'none';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nome      = document.getElementById('nome').value.trim();
        const email     = document.getElementById('email').value.trim();
        const senha     = document.getElementById('senha').value;
        const confirmar = document.getElementById('confirmar').value;

        if (!nome || !email || !senha) {
            showMessage('Preencha todos os campos.', 'error'); return;
        }
        if (senha.length < 6) {
            showMessage('A senha deve ter no mínimo 6 caracteres.', 'error'); return;
        }
        if (senha !== confirmar) {
            document.getElementById('pw-mismatch').style.display = 'block';
            document.getElementById('confirmar').focus();
            return;
        }

        btnSetup.disabled    = true;
        btnSetup.textContent = 'Criando...';

        try {
            const res  = await fetch('/api/auth/setup', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ nome, email, senha }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.errors?.[0]?.msg || data.msg || 'Erro ao criar administrador.');
            }

            showMessage('Administrador criado! Redirecionando para o login...', 'success');

            setTimeout(() => { window.location.replace('login.html'); }, 1800);

        } catch (err) {
            showMessage(err.message, 'error');
            btnSetup.disabled    = false;
            btnSetup.textContent = 'Criar administrador e entrar';
        }
    });
});

function showMessage(text, type) {
    const el = document.getElementById('setup-message');
    el.textContent = text;
    el.style.cssText = `display:block;padding:.75rem 1rem;margin-top:1rem;border-radius:4px;font-size:.9rem;text-align:center;
        background:${type === 'success' ? '#d4edda' : '#f8d7da'};
        color:${type === 'success' ? '#155724' : '#721c24'};
        border:1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};`;
}
