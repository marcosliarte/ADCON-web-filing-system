document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message'); // Certifique-se de que este elemento existe no seu HTML
    if (!errorMessage) {
        console.error('Elemento de mensagem de erro (id="error-message") não encontrado no HTML.');
        return; // Impede que o script continue sem o elemento de erro
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha: password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            window.location.href = 'home.html';
        } else {
            const errorText = data.msg || (data.errors && data.errors[0]?.msg) || 'Erro ao fazer login.';
            errorMessage.textContent = errorText;
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        errorMessage.textContent = 'Erro de conexão com o servidor.';
        errorMessage.style.display = 'block';
    }
});