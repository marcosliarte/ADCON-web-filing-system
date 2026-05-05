/* ========================================
   LOGIN PAGE - JavaScript
   ======================================== */

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
        errorMessage.className = 'alert alert-danger';
        errorMessage.style.display = 'block';
        
        // Ocultar após 5 segundos
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
    
    // Função para mostrar sucesso
    function showSuccess(message) {
        errorMessage.textContent = message;
        errorMessage.className = 'alert alert-success';
        errorMessage.style.display = 'block';
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
