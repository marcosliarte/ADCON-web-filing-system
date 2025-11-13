document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.replace('login.html');
        return;
    }

    // 1. Buscar dados do usuário e criar o cabeçalho
    try {
        const response = await fetchWithAuth('/api/auth');
        if (response && response.ok) {
            const usuario = await response.json();
            // CORREÇÃO: Verifica se o usuário tem permissão para ver a página.
            if (!['admin', 'gerente'].includes(usuario.role)) {
                document.body.innerHTML = `<h1>Acesso Negado</h1><p>Você não tem permissão para acessar esta página.</p><a href="home.html">Voltar para o Início</a>`;
                document.body.style.display = 'block';
                return;
            }
            createHeader('header-placeholder', usuario);
        } else {
            logout();
        }
    } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
        logout();
    }

    // 2. Referências aos elementos do DOM
    const formNovoFuncionario = document.getElementById('form-novo-funcionario');
    const tabelaFuncionariosBody = document.querySelector('#tabela-funcionarios tbody');
    const modal = document.getElementById('modal-pagamento');
    const closeModalBtn = document.querySelector('.close-button');
    const modalTituloPagamento = document.getElementById('modal-titulo-pagamento');
    const modalNomeFuncionario = document.getElementById('modal-nome-funcionario');
    const mesPagamentoSelect = document.getElementById('mes-pagamento');
    const anoPagamentoInput = document.getElementById('ano-pagamento');
    const btnGerarDemonstrativo = document.getElementById('btn-gerar-demonstrativo');
    const descontosContainer = document.getElementById('descontos-container');
    const btnAddDesconto = document.getElementById('btn-add-desconto');
    const btnSalvarFuncionario = document.getElementById('btn-salvar-funcionario');
    const btnCancelarEdicao = document.getElementById('btn-cancelar-edicao');

    // 3. Carregar funcionários existentes
    await carregarFuncionarios();

    // 4. Event Listener para o formulário de cadastro
    formNovoFuncionario.addEventListener('submit', async (e) => {
        e.preventDefault();

        const funcionarioId = document.getElementById('funcionarioId').value;
        const nome = document.getElementById('nome').value;
        const cargo = document.getElementById('cargo').value;
        const salarioBruto = parseFloat(document.getElementById('salarioBruto').value);
        
        const descontos = [];
        const descontoItems = document.querySelectorAll('.desconto-item');
        descontoItems.forEach(item => {
            const descricao = item.querySelector('[name="desconto-descricao"]').value;
            const valor = parseFloat(item.querySelector('[name="desconto-valor"]').value);
            const mesInicio = parseInt(item.querySelector('[name="desconto-mes-inicio"]').value) || null;
            const anoInicio = parseInt(item.querySelector('[name="desconto-ano-inicio"]').value) || null;
            
            // CORREÇÃO: Se o campo de duração estiver vazio, considera-se -1 (permanente).
            let mesesDuracao = parseInt(item.querySelector('[name="desconto-duracao"]').value);
            if (isNaN(mesesDuracao)) {
                mesesDuracao = -1;
            }

            if (descricao && valor > 0) {
                // Se mesInicio/anoInicio não forem fornecidos, usa o mês/ano atual
                const hoje = new Date();
                // Garante que descontos permanentes sem data de início não tenham data de início.
                descontos.push({ descricao, valor, mesInicio: (mesesDuracao !== -1 ? (mesInicio || hoje.getMonth() + 1) : null), anoInicio: (mesesDuracao !== -1 ? (anoInicio || hoje.getFullYear()) : null), mesesDuracao });
            }
        });

        const url = funcionarioId 
            ? `/api/configuracao/funcionarios/${funcionarioId}` 
            : '/api/configuracao/funcionarios';
        
        const method = funcionarioId ? 'PUT' : 'POST';

        try {
            const response = await fetchWithAuth(url, {
                method: method,
                body: JSON.stringify({ nome, cargo, salarioBruto, descontos })
            });

            if (response.ok) {
                alert(`Funcionário ${funcionarioId ? 'atualizado' : 'cadastrado'} com sucesso!`);
                resetarFormulario();
                await carregarFuncionarios(); // Recarrega a lista
            } else {
                const erro = await response.json().catch(() => ({ message: 'Erro desconhecido ao salvar.' }));
                alert(`Erro ao salvar: ${erro.message}`);
            }
        } catch (error) {
            console.error('Erro ao cadastrar funcionário:', error);
            alert('Falha na conexão. Tente novamente.');
        }
    });

    // Event listener para adicionar campo de desconto
    btnAddDesconto.addEventListener('click', () => {
        const novoDesconto = document.createElement('div');
        novoDesconto.classList.add('desconto-item');
        novoDesconto.innerHTML = `
            <input type="text" name="desconto-descricao" placeholder="Descrição" required>
            <input type="number" name="desconto-valor" placeholder="Valor (R$)" step="0.01" required>
            <input type="number" name="desconto-mes-inicio" placeholder="Mês Início (opc)" min="1" max="12">
            <input type="number" name="desconto-ano-inicio" placeholder="Ano Início (opc)">
            <input type="number" name="desconto-duracao" placeholder="Duração (meses, vazio p/ sempre)" min="1">
            <button type="button" class="btn-remover btn-sm">Remover</button>
        `;
        descontosContainer.appendChild(novoDesconto);
    });

    // Event listener para remover campo de desconto (usando delegação de evento)
    descontosContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remover')) {
            e.target.closest('.desconto-item').remove();
        }
    });

    // Limpa os campos de desconto ao resetar o formulário
    formNovoFuncionario.addEventListener('reset', () => {
        descontosContainer.innerHTML = '';
    });

    // 5. Funções auxiliares

    /**
     * Busca os funcionários da API e os exibe na tabela.
     */
    async function carregarFuncionarios() {
        try {
            const response = await fetchWithAuth('/api/configuracao/funcionarios');
            if (!response.ok) {
                throw new Error('Não foi possível carregar os funcionários.');
            }
            const funcionarios = await response.json();

            tabelaFuncionariosBody.innerHTML = ''; // Limpa a tabela

            if (funcionarios.length === 0) {
                tabelaFuncionariosBody.innerHTML = '<tr><td colspan="6">Nenhum funcionário cadastrado.</td></tr>';
                return;
            }

            funcionarios.forEach(func => {
                const tr = document.createElement('tr');
                tr.dataset.funcionarioId = func._id; // Usando _id que vem do MongoDB
                tr.innerHTML = `
                    <td>${func.nome}</td>
                    <td>${func.cargo}</td>
                    <td>${func.salarioBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td>${
                        getDescontosFixosAtivos(func, new Date().getMonth() + 1, new Date().getFullYear())
                        .reduce((acc, d) => acc + d.valor, 0)
                        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    }</td>
                    <td><span class="status-badge status-${func.statusPagamentoMesAtual.toLowerCase().replace(' ', '-')}">${func.statusPagamentoMesAtual}</span></td>
                    <td class="actions-cell">
                        <button class="btn-sm btn-ver-pagamento" title="Ver Pagamento">📄</button>
                        <button class="btn-sm btn-edit btn-editar-funcionario" title="Editar">✏️</button>
                        <button class="btn-sm btn-danger btn-excluir-funcionario" title="Excluir">🗑️</button>
                    </td> 
                `;
                tabelaFuncionariosBody.appendChild(tr);
            });

        } catch (error) {
            console.error('Erro ao carregar funcionários:', error);
            tabelaFuncionariosBody.innerHTML = '<tr><td colspan="6">Erro ao carregar dados.</td></tr>';
        }
    }

    /**
     * Preenche o formulário para edição de um funcionário.
     */
    async function preencherFormularioParaEdicao(id) {
        try {
            const response = await fetchWithAuth(`/api/configuracao/funcionarios/${id}`);
            if (!response.ok) throw new Error('Não foi possível carregar os dados do funcionário.');

            const funcionario = await response.json();

            document.getElementById('funcionarioId').value = funcionario._id;
            document.getElementById('nome').value = funcionario.nome;
            document.getElementById('cargo').value = funcionario.cargo;
            document.getElementById('salarioBruto').value = funcionario.salarioBruto;

            descontosContainer.innerHTML = ''; // Limpa descontos existentes
            if (funcionario.descontos && funcionario.descontos.length > 0) {
                funcionario.descontos.forEach(desconto => {
                    const novoDesconto = document.createElement('div');
                    // CORREÇÃO: Não exibe -1 no campo de duração.
                    const duracaoParaExibir = (desconto.mesesDuracao === -1 || desconto.mesesDuracao === undefined) ? '' : desconto.mesesDuracao;

                    novoDesconto.classList.add('desconto-item');
                    novoDesconto.innerHTML = `
                        <input type="text" name="desconto-descricao" placeholder="Descrição" value="${desconto.descricao || ''}" required>
                        <input type="number" name="desconto-valor" placeholder="Valor (R$)" step="0.01" value="${desconto.valor || ''}" required>
                        <input type="number" name="desconto-mes-inicio" placeholder="Mês Início (opc)" min="1" max="12" value="${desconto.mesInicio || ''}">
                        <input type="number" name="desconto-ano-inicio" placeholder="Ano Início (opc)" value="${desconto.anoInicio || ''}">
                        <input type="number" name="desconto-duracao" placeholder="Duração (meses, vazio p/ sempre)" min="1" value="${duracaoParaExibir}">
                        <button type="button" class="btn-remover btn-sm">Remover</button>
                    `;
                    descontosContainer.appendChild(novoDesconto);
                });
            }

            btnSalvarFuncionario.textContent = 'Salvar Alterações';
            btnCancelarEdicao.style.display = 'inline-block';
            window.scrollTo(0, 0); // Rola a página para o topo para ver o formulário

        } catch (error) {
            alert(error.message);
        }
    }

    /**
     * Exclui um funcionário.
     */
    async function excluirFuncionario(id) {
        if (!confirm('Tem certeza que deseja excluir este funcionário?')) return;

        try {
            const response = await fetchWithAuth(`/api/configuracao/funcionarios/${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                alert('Funcionário excluído com sucesso!');
                await carregarFuncionarios();
            } else {
                const erro = await response.json().catch(() => ({ message: 'Erro ao excluir.' }));
                alert(`Erro: ${erro.message}`);
            }
        } catch (error) {
            console.error('Erro ao excluir funcionário:', error);
            alert('Falha na conexão ao tentar excluir.');
        }
    }

    // --- NOVA LÓGICA DO MODAL DE PAGAMENTO ---

    function inicializarModalPagamento(funcionario) {
        modalNomeFuncionario.textContent = funcionario.nome;
        modalTituloPagamento.textContent = 'Demonstrativo de Pagamento'; // Reseta o título
        btnGerarDemonstrativo.dataset.funcionarioId = funcionario._id;

        // Preenche o seletor de mês e ano
        const hoje = new Date();
        const mesAtual = hoje.getMonth() + 1;
        const anoAtual = hoje.getFullYear();
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        
        mesPagamentoSelect.innerHTML = '';
        for (let i = 0; i < 12; i++) {
            const option = document.createElement('option');
            option.value = i + 1;
            option.textContent = meses[i];
            if ((i + 1) === mesAtual) option.selected = true;
            mesPagamentoSelect.appendChild(option);
        }
        anoPagamentoInput.value = anoAtual;

        // Limpa o corpo e exibe o histórico
        document.getElementById('demonstrativo-corpo').innerHTML = '<p>Selecione o período e clique em "Gerar Demonstrativo".</p>';
        exibirHistoricoPagamentos(funcionario.historicoPagamentos || []);
        modal.style.display = 'block';
    }

    btnGerarDemonstrativo.addEventListener('click', async (e) => {
        const funcionarioId = e.target.dataset.funcionarioId;
        const mes = parseInt(mesPagamentoSelect.value);
        const ano = parseInt(anoPagamentoInput.value);

        // Atualiza o título do modal para refletir o período selecionado
        modalTituloPagamento.textContent = `Demonstrativo - ${mesPagamentoSelect.options[mesPagamentoSelect.selectedIndex].text}/${ano}`;

        const response = await fetchWithAuth(`/api/configuracao/funcionarios/${funcionarioId}`);
        const funcionario = await response.json();

        const pagamentoExistente = (funcionario.historicoPagamentos || []).find(p => p.mes === mes && p.ano === ano);

        if (pagamentoExistente) {
            renderizarDemonstrativo(pagamentoExistente, true);
        } else {
            renderizarDemonstrativo(funcionario, false, mes, ano);
        }
    });

    /**
     * Filtra os descontos fixos de um funcionário para um mês/ano específico,
     * considerando a duração e o mês de início.
     */
    function getDescontosFixosAtivos(funcionario, mes, ano) {
        return (funcionario.descontos || []).filter(d => {
            if (d.mesesDuracao === -1) { // Desconto permanente
                return true;
            }
            // Se não tem data de início definida, não é um desconto com duração.
            if (!d.mesInicio || !d.anoInicio) {
                return false;
            }

            // CORREÇÃO: Lógica de comparação de datas
            const dataInicioDesconto = new Date(d.anoInicio, d.mesInicio - 1); // Mês é base 0
            const dataDemonstrativo = new Date(ano, mes - 1);
            
            // Calcula a data final do desconto
            const dataFimDesconto = new Date(dataInicioDesconto);
            dataFimDesconto.setMonth(dataFimDesconto.getMonth() + d.mesesDuracao);

            return dataDemonstrativo >= dataInicioDesconto && dataDemonstrativo < dataFimDesconto;
        });
    }

    function renderizarDemonstrativo(dados, isPago, mes, ano) {
        const corpo = document.getElementById('demonstrativo-corpo');
        // CORREÇÃO: Limpa completamente o conteúdo e os event listeners antigos antes de renderizar o novo.
        corpo.innerHTML = '';

        const salarioBase = isPago ? dados.salarioBase : dados.salarioBruto;
        const descontosFixosAtivos = isPago ? dados.descontosFixos : getDescontosFixosAtivos(dados, mes, ano);

        let html = `
            <div class="demonstrativo-tabela" id="demonstrativo-print-area">
                <div class="demonstrativo-section coluna-proventos">
                    <h4>Proventos</h4>
                    <div class="item-calculo"><span>Salário Base</span><span class="valor-positivo">${salarioBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    <div id="adicionais-container"></div>
                    ${!isPago ? '<button type="button" id="btn-add-adicional" class="btn-sm">+ Adicional</button>' : ''}
                </div>
                <div class="demonstrativo-section coluna-descontos"> 
                    <h4>Descontos</h4>
                    ${descontosFixosAtivos.map(d => `<div class="item-calculo"><span>${d.descricao}</span><span class="valor-negativo">- ${d.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>`).join('')}
                    <div id="descontos-variaveis-container"></div>
                    ${!isPago ? '<button type="button" id="btn-add-desconto-variavel" class="btn-sm">+ Desconto</button>' : ''}
                </div>
            </div>
            <div id="resumo-pagamento" style="margin-top: 1.5rem;"></div>
            <div class="action-buttons demonstrativo-actions">
                ${isPago ? `<p><strong>Pagamento realizado em: ${new Date(dados.dataPagamento).toLocaleDateString('pt-BR')}</strong></p>` : `<button id="btn-registrar-pagamento" class="btn btn-success">Registrar Pagamento</button>`}
                <button id="btn-imprimir-demonstrativo" class="btn btn-secondary">Imprimir</button>
            </div>
        `;
        corpo.innerHTML = html;

        document.getElementById('btn-imprimir-demonstrativo').addEventListener('click', () => window.print());
        
        if (!isPago) {
            document.getElementById('btn-add-adicional').addEventListener('click', () => adicionarCampoVariavel('adicionais-container', 'adicional', 'Descrição do Adicional'));
            document.getElementById('btn-add-desconto-variavel').addEventListener('click', () => adicionarCampoVariavel('descontos-variaveis-container', 'desconto-variavel', 'Descrição do Desconto'));
            document.getElementById('btn-registrar-pagamento').addEventListener('click', () => registrarPagamento(dados, mes, ano));
            corpo.addEventListener('input', () => calcularResumo(salarioBase, descontosFixosAtivos));
        }
        
        calcularResumo(salarioBase, descontosFixosAtivos);
    }

    function adicionarCampoVariavel(containerId, tipo, placeholder) {
        const container = document.getElementById(containerId);
        const item = document.createElement('div');
        item.className = 'campo-variavel';
        item.innerHTML = `
            <input type="text" data-tipo="${tipo}" data-campo="descricao" placeholder="${placeholder}">
            <input type="number" data-tipo="${tipo}" data-campo="valor" placeholder="Valor (R$)" step="0.01">
        `;
        container.appendChild(item);
    }

    function calcularResumo(salarioBase, descontosFixos) {
        const resumoContainer = document.getElementById('resumo-pagamento');
        
        const adicionais = Array.from(document.querySelectorAll('[data-tipo="adicional"]'))
            .reduce((acc, input) => {
                const valor = parseFloat(input.closest('.campo-variavel').querySelector('[data-campo="valor"]').value) || 0;
                if (input.dataset.campo === 'valor') acc += valor;
                return acc;
            }, 0);

        const totalDescontosFixos = descontosFixos.reduce((acc, d) => acc + d.valor, 0); // Já são os ativos

        const descontosVariaveis = Array.from(document.querySelectorAll('[data-tipo="desconto-variavel"]'))
            .reduce((acc, input) => {
                const valor = parseFloat(input.closest('.campo-variavel').querySelector('[data-campo="valor"]').value) || 0;
                if (input.dataset.campo === 'valor') acc += valor;
                return acc;
            }, 0);

        const totalProventos = salarioBase + adicionais;
        const totalDescontos = totalDescontosFixos + descontosVariaveis;
        const salarioLiquido = totalProventos - totalDescontos;

        resumoContainer.innerHTML = `
            <div class="demonstrativo-tabela" style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                <div class="item-calculo total"><span>Total Proventos</span><span class="valor-positivo">${totalProventos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                <div class="item-calculo total"><span>Total Descontos</span><span class="valor-negativo">- ${totalDescontos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
            </div>
            <div class="item-calculo liquido" style="justify-content: flex-end;"><span>Salário Líquido: ${salarioLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
        `;
    }

    async function registrarPagamento(funcionario, mes, ano) {
        const getVariaveis = (tipo) => {
            return Array.from(document.querySelectorAll(`.campo-variavel [data-tipo="${tipo}"]`))
                .map(input => input.closest('.campo-variavel'))
                .filter((item, index, self) => self.indexOf(item) === index) // Remove duplicatas
                .map(item => ({
                    descricao: item.querySelector('[data-campo="descricao"]').value,
                    valor: parseFloat(item.querySelector('[data-campo="valor"]').value) || 0
                }))
                .filter(item => item.descricao && item.valor > 0);
        };

        const adicionais = getVariaveis('adicional');
        const descontosVariaveis = getVariaveis('desconto-variavel');
        const descontosFixosAtivosParaRegistro = getDescontosFixosAtivos(funcionario, mes, ano); // Filtra para o mês do registro
        const totalProventos = funcionario.salarioBruto + adicionais.reduce((acc, item) => acc + item.valor, 0);
        const totalDescontos = descontosFixosAtivosParaRegistro.reduce((acc, item) => acc + item.valor, 0) + descontosVariaveis.reduce((acc, item) => acc + item.valor, 0);

        const payload = {
            mes, ano,
            salarioBase: funcionario.salarioBruto,
            adicionais,
            descontosFixos: descontosFixosAtivosParaRegistro, // Salva APENAS os descontos ativos para este mês
            descontosVariaveis,
            totalProventos,
            totalDescontos,
            salarioLiquido: totalProventos - totalDescontos
        };

        try {
            const response = await fetchWithAuth(`/api/configuracao/funcionarios/${funcionario._id}/pagamentos`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Erro ao registrar pagamento.');
            }
            alert('Pagamento registrado com sucesso!');
            fecharModal();
            await carregarFuncionarios(); // Recarrega a tabela para atualizar o status
        } catch (error) {
            alert(`Erro: ${error.message}`);
        }
    }

    function exibirHistoricoPagamentos(historico) {
        const lista = document.getElementById('lista-historico-pagamentos');
        lista.innerHTML = '';
        if (historico.length === 0) {
            lista.innerHTML = '<li>Nenhum pagamento registrado.</li>';
            return;
        }
        historico.sort((a, b) => new Date(b.ano, b.mes - 1) - new Date(a.ano, a.mes - 1)).forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${String(p.mes).padStart(2, '0')}/${p.ano}</span>
                <span>${p.salarioLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                <span>Pago em: ${new Date(p.dataPagamento).toLocaleDateString('pt-BR')}</span>
            `;
            lista.appendChild(li);
        });
    }

    /**
     * Fecha o modal de pagamento.
     */
    function fecharModal() {
        modal.style.display = 'none';
    }

    // 6. Event Listeners para o Modal e botões de ação
    closeModalBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });

    /**
     * Reseta o formulário para o estado inicial de cadastro.
     */
    function resetarFormulario() {
        formNovoFuncionario.reset();
        document.getElementById('funcionarioId').value = '';
        descontosContainer.innerHTML = '';
        btnSalvarFuncionario.textContent = 'Cadastrar';
        btnCancelarEdicao.style.display = 'none';
    }


    tabelaFuncionariosBody.addEventListener('click', async (event) => {
        const target = event.target;
        const tr = target.closest('tr');
        if (!tr) return;
        const funcionarioId = tr.dataset.funcionarioId;

        if (target.matches('.btn-ver-pagamento')) {
            try {
                const response = await fetchWithAuth(`/api/configuracao/funcionarios/${funcionarioId}`);
                if (!response.ok) throw new Error('Funcionário não encontrado');
                const funcionario = await response.json(); 
                inicializarModalPagamento(funcionario);
            } catch (error) {
                alert('Não foi possível obter os detalhes do funcionário.');
                console.error(error);
            }
        } else if (target.matches('.btn-excluir-funcionario')) {
            excluirFuncionario(funcionarioId);
        } else if (target.matches('.btn-editar-funcionario')) {
            preencherFormularioParaEdicao(funcionarioId);
        }
    });
});