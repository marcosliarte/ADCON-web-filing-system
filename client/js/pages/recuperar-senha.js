document.addEventListener('DOMContentLoaded', () => {
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
            (this.value && this.value !== document.getElementById('novaSenha').value)
                ? 'block' : 'none';
    });

    document.getElementById('recover-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const email       = document.getElementById('email').value.trim();
        const recoveryKey = document.getElementById('recoveryKey').value;
        const novaSenha   = document.getElementById('novaSenha').value;
        const confirmar   = document.getElementById('confirmar').value;

        if (!email || !recoveryKey || !novaSenha) {
            showMessage('Preencha todos os campos.', 'error'); return;
        }
        if (novaSenha.length < 6) {
            showMessage('A nova senha deve ter no mínimo 6 caracteres.', 'error'); return;
        }
        if (novaSenha !== confirmar) {
            document.getElementById('pw-mismatch').style.display = 'block';
            document.getElementById('confirmar').focus();
            return;
        }

        const btn = document.getElementById('btn-recover');
        btn.disabled    = true;
        btn.textContent = 'Redefinindo...';

        try {
            const res  = await fetch('/api/auth/recover-password', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email, recoveryKey, novaSenha }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.errors?.[0]?.msg || data.msg || 'Erro ao redefinir senha.');
            }

            showMessage(data.msg + ' Redirecionando...', 'success');
            setTimeout(() => { window.location.replace('login.html'); }, 2000);

        } catch (err) {
            showMessage(err.message, 'error');
            btn.disabled    = false;
            btn.textContent = 'Redefinir senha';
        }
    });
});

function showMessage(text, type) {
    const el = document.getElementById('recover-message');
    el.textContent = text;
    el.style.cssText = `display:block;padding:.75rem 1rem;margin-top:1rem;border-radius:4px;
        font-size:.9rem;text-align:center;
        background:${type === 'success' ? '#d4edda' : '#f8d7da'};
        color:${type === 'success' ? '#155724' : '#721c24'};
        border:1px solid ${type === 'success' ? '#c3e6cb' : '#f5c6cb'};`;
}
