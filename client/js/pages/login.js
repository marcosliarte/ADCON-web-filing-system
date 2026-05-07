/* ========================================
   LOGIN PAGE - JavaScript
   ======================================== */

// Se nenhum admin existe ainda, redireciona para o setup inicial
(async function checkSetup() {
    try {
        const res  = await fetch('/api/auth/setup/status');
        const data = await res.json();
        if (data.setupRequired) {
            window.location.replace('setup.html');
        }
    } catch (e) { /* sem conectividade — deixa o login aparecer normalmente */ }
})();

// Aguarda o DOM carregar
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    
    // Handler do formulário de login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        // Validação básica
        if (!email || !password) {
            showError('Por favor, preencha todos os campos');
            return;
        }
        
        // Desabilitar botão durante requisição
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Entrando...';
        
        try {
            const apiUrl = '/api/auth/login';
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    email, 
                    senha: password 
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Login bem-sucedido
                localStorage.setItem('token', data.token);
                
                // Feedback visual
                showSuccess('Login realizado com sucesso!');
                
                // Redirecionar após pequeno delay
                setTimeout(() => {
                    window.location.href = 'home.html';
                }, 500);
                
            } else {
                // Erro no login
                let errorText = data.msg || 'Erro ao fazer login';
                
                if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
                    errorText = data.errors[0].msg;
                }
                
                showError(errorText);
                
                // Reabilitar botão
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
            
        } catch (error) {
            console.error('Erro na requisição:', error);
            showError('Erro de conexão com o servidor. Verifique se o servidor está rodando.');
            
            // Reabilitar botão
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
    
    // Função para mostrar erro
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.removeAttribute('class');
        errorMessage.style.cssText = 'display:block;padding:0.75rem 1rem;margin-top:1rem;background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;border-radius:4px;font-size:0.95rem;text-align:center;';

        // Ocultar após 6 segundos
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 6000);
    }

    // Função para mostrar sucesso
    function showSuccess(message) {
        errorMessage.textContent = message;
        errorMessage.removeAttribute('class');
        errorMessage.style.cssText = 'display:block;padding:0.75rem 1rem;margin-top:1rem;background:#d4edda;color:#155724;border:1px solid #c3e6cb;border-radius:4px;font-size:0.95rem;text-align:center;';
    }
    
    // Limpar mensagem de erro ao digitar
    const inputs = loginForm.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            if (errorMessage.style.display === 'block') {
                errorMessage.style.display = 'none';
            }
        });
    });
});
