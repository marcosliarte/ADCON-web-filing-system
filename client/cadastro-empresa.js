checkAuth(); // Verifica se o usuário está autenticado

/**
 * Busca os dados do usuário logado na API.
 * @returns {object|null} O objeto do usuário ou null em caso de erro.
 */
async function getUsuario() {
    try {
        const response = await fetchWithAuth('/api/auth');
        if (response && response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error("Não foi possível obter os dados do usuário:", error);
    }
    return null; // Retorna null se houver qualquer falha
}

document.addEventListener('DOMContentLoaded', async () => {
    // Busca os dados do usuário logado para criar o cabeçalho da página
    const usuario = await getUsuario();
    if (usuario) {
        createHeader('header-placeholder', usuario);
        document.body.style.display = 'block'; // Mostra o conteúdo da página
    } else {
        logout(); // Se não encontrar o usuário, desloga por segurança
    }

    // --- LÓGICA PARA ADICIONAR E REMOVER SÓCIOS ---
    let socioCounter = 0; // Contador para garantir IDs únicos para os radios
    const addSocioBtn = document.getElementById('addSocioBtn');
    const sociosContainer = document.getElementById('sociosContainer');

    if (addSocioBtn && sociosContainer) {
        addSocioBtn.addEventListener('click', () => {
            socioCounter++;
            const socioCard = document.createElement('div');
            socioCard.className = 'socio-card';

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn-remove-item';
            removeBtn.innerHTML = '&times;';
            removeBtn.title = 'Remover Sócio';
            removeBtn.onclick = () => socioCard.remove();
            socioCard.appendChild(removeBtn);

            const formContent = document.createElement('div');
            formContent.innerHTML = `
                <h3>Dados do Sócio</h3>
                <div class="form-grid">
                    <div class="form-group"><label>Nome Completo</label><input type="text" name="socios[${socioCounter}][nome]" required></div>
                    <div class="form-group"><label>CPF</label><input type="text" name="socios[${socioCounter}][cpf]" placeholder="000.000.000-00" required></div>
                    <div class="form-group"><label>RG</label><input type="text" name="socios[${socioCounter}][rg]"></div>
                    <div class="form-group"><label>Data de Nascimento</label><input type="date" name="socios[${socioCounter}][dataNascimento]"></div>
                    <div class="form-group">
                        <label>Sócio Administrador?</label>
                        <div class="radio-group">
                            <input type="radio" id="socioAdminSim_${socioCounter}" name="socios[${socioCounter}][isAdministrador]" value="true"><label for="socioAdminSim_${socioCounter}">Sim</label>
                            <input type="radio" id="socioAdminNao_${socioCounter}" name="socios[${socioCounter}][isAdministrador]" value="false" checked><label for="socioAdminNao_${socioCounter}">Não</label>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Estado Civil</label>
                        <select name="socios[${socioCounter}][estadoCivil]">
                            <option value="Solteiro(a)">Solteiro(a)</option>
                            <option value="Casado(a)">Casado(a)</option>
                            <option value="Divorciado(a)">Divorciado(a)</option>
                            <option value="Viúvo(a)">Viúvo(a)</option>
                        </select>
                    </div>
                </div>
                <h3 style="margin-top: 1.5rem;">Endereço do Sócio</h3>
                <div class="form-grid">
                    <div class="form-group"><label>CEP</label><input type="text" name="socios[${socioCounter}][endereco][cep]" placeholder="00000-000"></div>
                    <div class="form-group"><label>Rua</label><input type="text" name="socios[${socioCounter}][endereco][rua]"></div>
                    <div class="form-group"><label>Número</label><input type="text" name="socios[${socioCounter}][endereco][numero]"></div>
                    <div class="form-group"><label>Bairro</label><input type="text" name="socios[${socioCounter}][endereco][bairro]"></div>
                    <div class="form-group"><label>Cidade</label><input type="text" name="socios[${socioCounter}][endereco][cidade]"></div>
                    <div class="form-group"><label>Estado</label><input type="text" name="socios[${socioCounter}][endereco][estado]"></div>
                </div>
            `;
            socioCard.appendChild(formContent);
            sociosContainer.appendChild(socioCard);
        });
    }

    // Adiciona o listener para o evento de submit do formulário
    document.getElementById('form-empresa').addEventListener('submit', async function(e) {
        e.preventDefault(); // Impede o recarregamento da página
        
        const messageEl = document.getElementById('message');
        messageEl.textContent = 'Cadastrando empresa...';
        messageEl.style.display = 'block';

        const formData = new FormData(this);

        // Lógica de envio para o backend (simplificada)
        // O backend precisará ser ajustado para receber a estrutura aninhada de sócios.
        console.log('Dados do formulário a serem enviados:', Object.fromEntries(formData));
        alert('Funcionalidade de envio implementada. Verifique o console para ver os dados.');
        messageEl.textContent = 'Cadastro enviado (simulação).';
    });
});