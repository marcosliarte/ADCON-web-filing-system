// Este código é uma versão resumida e deve ser colocado em client/funcionarios-pagamentos.js
// A implementação completa é muito extensa para este formato, mas esta é a estrutura principal.

document.addEventListener('DOMContentLoaded', async () => {
    // Lógica de autenticação e permissão (verificar se é admin/gerente)
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.replace('login.html');
        return;
    }

    try {
        const response = await fetchWithAuth('/api/auth');
        if (response && response.ok) {
            const usuario = await response.json();
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

    // Referências aos elementos do DOM
    const usuarioSelect = document.getElementById('usuario-vinculado');
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

    // Carregar funcionários na tabela
    await carregarFuncionarios();
    await carregarUsuariosDisponiveis();

    // Listener para o formulário de cadastro/edição
    formNovoFuncionario.addEventListener('submit', handleFuncionarioSubmit);

    // Listener para adicionar descontos dinamicamente
    btnAddDesconto.addEventListener('click', adicionarCampoDescontoFixo);

    // Listeners do modal de pagamento
    closeModalBtn.addEventListener('click', fecharModal);
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            fecharModal();
        }
    });
    btnGerarDemonstrativo.addEventListener('click', gerarDemonstrativo);
});

async function carregarUsuariosDisponiveis() {
    const usuarioSelect = document.getElementById('usuario-vinculado');
    try {
        const response = await fetchWithAuth('/api/auth/admin/unlinked-users');
        if (!response.ok) throw new Error('Falha ao carregar usuários.');

        const usuarios = await response.json();
        usuarioSelect.innerHTML = '<option value="">Selecione um usuário</option>'; // Limpa e adiciona a opção padrão

        if (usuarios.length === 0) {
            usuarioSelect.innerHTML = '<option value="">Nenhum usuário disponível para vínculo</option>';
            usuarioSelect.disabled = true;
            return;
        }

        usuarios.forEach(user => {
            const option = new Option(`${user.nome} (${user.email})`, user._id);
            usuarioSelect.appendChild(option);
        });
        usuarioSelect.disabled = false;
    } catch (error) {
        usuarioSelect.innerHTML = `<option value="">Erro ao carregar usuários</option>`;
        console.error(error);
    }
}

async function carregarFuncionarios() {
    const tabelaFuncionariosBody = document.querySelector('#tabela-funcionarios tbody');
    try {
        const response = await fetchWithAuth('/api/funcionarios');
        if (!response.ok) throw new Error('Falha ao carregar funcionários.');
        const funcionarios = await response.json();

        tabelaFuncionariosBody.innerHTML = '';
        if (funcionarios.length === 0) {
            tabelaFuncionariosBody.innerHTML = '<tr><td colspan="6">Nenhum funcionário cadastrado.</td></tr>';
            return;
        }

        funcionarios.forEach(func => {
            const tr = document.createElement('tr');
            tr.dataset.funcionarioId = func._id;
            tr.innerHTML = `
                <td>${func.nome}<br><small style="color: #6c757d;">Usuário: ${func.usuario ? func.usuario.email : 'Não vinculado'}</small></td>
                <td>${func.cargo}</td>
                <td>${func.salarioBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td>${func.chavePix || 'Não cadastrada'}</td> <!-- CORREÇÃO: Garante que o campo seja exibido -->
                <td><span class="status-badge status-${func.statusPagamentoMesAtual.toLowerCase().replace(' ', '-')}">${func.statusPagamentoMesAtual}</span></td>
                <td class="actions-cell">
                    <button class="btn-sm btn-ver-pagamento" title="Ver Pagamento">📄</button>
                    <button class="btn-sm btn-edit btn-editar-funcionario" title="Editar">✏️</button>
                    <button class="btn-sm btn-danger btn-excluir-funcionario" title="Excluir">🗑️</button>
                </td>
            `;
            tabelaFuncionariosBody.appendChild(tr);
        });

        // Adiciona listeners aos botões de ação
        tabelaFuncionariosBody.querySelectorAll('.btn-ver-pagamento').forEach(btn => btn.addEventListener('click', (e) => abrirModalPagamento(e.target.closest('tr').dataset.funcionarioId)));
        tabelaFuncionariosBody.querySelectorAll('.btn-editar-funcionario').forEach(btn => btn.addEventListener('click', (e) => preencherFormularioParaEdicao(e.target.closest('tr').dataset.funcionarioId)));
        tabelaFuncionariosBody.querySelectorAll('.btn-excluir-funcionario').forEach(btn => btn.addEventListener('click', (e) => excluirFuncionario(e.target.closest('tr').dataset.funcionarioId)));

    } catch (error) {
        console.error(error);
        tabelaFuncionariosBody.innerHTML = '<tr><td colspan="6" style="color: red;">Erro ao carregar funcionários.</td></tr>';
    }
}

async function handleFuncionarioSubmit(e) {
    e.preventDefault();
    const funcionarioId = document.getElementById('funcionarioId').value;
    const nome = document.getElementById('nome').value;
    const cargo = document.getElementById('cargo').value;
    const salarioBruto = parseFloat(document.getElementById('salarioBruto').value);
    const chavePix = document.getElementById('chavePix').value;
    const usuarioId = document.getElementById('usuario-vinculado').value;
    const usuarioOriginalId = document.getElementById('usuario-vinculado').dataset.originalValue;

    const descontos = Array.from(document.querySelectorAll('#descontos-container .desconto-item')).map(item => {
        const descricao = item.querySelector('[name="desconto-descricao"]').value;
        const valor = parseFloat(item.querySelector('[name="desconto-valor"]').value);
        const mesInicio = parseInt(item.querySelector('[name="desconto-mes-inicio"]').value) || null;
        const anoInicio = parseInt(item.querySelector('[name="desconto-ano-inicio"]').value) || null;
        let mesesDuracao = parseInt(item.querySelector('[name="desconto-duracao"]').value);
        if (isNaN(mesesDuracao)) mesesDuracao = -1;

        return { descricao, valor, mesInicio, anoInicio, mesesDuracao };
    }).filter(d => d.descricao && d.valor > 0);

    const url = funcionarioId ? `/api/funcionarios/${funcionarioId}` : '/api/funcionarios';
    const method = funcionarioId ? 'PUT' : 'POST';

    const payload = { nome, cargo, salarioBruto, chavePix, descontos };
    // Adiciona o ID do usuário ao payload apenas se for um novo cadastro
    if (!funcionarioId) {
        payload.usuario = usuarioId;
    }

    try {
        const response = await fetchWithAuth(url, {
            method: method,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.msg || 'Erro ao salvar funcionário.');
        }

        // --- CORREÇÃO: Lógica para atualizar o vínculo do usuário ---
        // Se estiver editando E o ID do usuário mudou, chama a rota específica.
        if (funcionarioId && usuarioId !== usuarioOriginalId) {
            const vincularResponse = await fetchWithAuth(`/api/funcionarios/${funcionarioId}/vincular-usuario`, {
                method: 'PUT',
                body: JSON.stringify({ novoUsuarioId: usuarioId })
            });
            if (!vincularResponse.ok) {
                const err = await vincularResponse.json();
                throw new Error(err.msg || 'Erro ao atualizar o vínculo do usuário.');
            }
        }

        alert(`Funcionário ${funcionarioId ? 'atualizado' : 'cadastrado'} com sucesso!`);
        resetarFormulario();
        await carregarFuncionarios();
        await carregarUsuariosDisponiveis(); // Recarrega a lista de usuários após o cadastro
    } catch (error) {
        alert(`Erro: ${error.message}`);
    }
}

function adicionarCampoDescontoFixo(desconto = {}) {
    const container = document.getElementById('descontos-container');
    const item = document.createElement('div'); 
    item.className = 'desconto-item';
    const duracao = (desconto.mesesDuracao === -1 || desconto.mesesDuracao === undefined) ? '' : desconto.mesesDuracao;

    item.innerHTML = `
        <input type="text" name="desconto-descricao" placeholder="Descrição" value="${desconto.descricao || ''}" required>
        <input type="number" name="desconto-valor" placeholder="Valor (R$)" step="0.01" value="${desconto.valor || ''}" required>
        <input type="number" name="desconto-mes-inicio" placeholder="Mês Início (opc)" min="1" max="12" value="${desconto.mesInicio || ''}">
        <input type="number" name="desconto-ano-inicio" placeholder="Ano Início (opc)" value="${desconto.anoInicio || ''}">
        <input type="number" name="desconto-duracao" placeholder="Duração (meses, vazio p/ sempre)" min="1" value="${duracao}">
        <button type="button" class="btn-remover btn-sm" onclick="this.closest('.desconto-item').remove()">Remover</button>
    `;
    container.appendChild(item);
}

async function preencherFormularioParaEdicao(id) {
    try {
        const response = await fetchWithAuth(`/api/funcionarios/${id}`);
        if (!response.ok) throw new Error('Não foi possível carregar os dados do funcionário.');

        const funcionario = await response.json();

        document.getElementById('funcionarioId').value = funcionario._id;
        document.getElementById('nome').value = funcionario.nome;
        document.getElementById('cargo').value = funcionario.cargo;
        document.getElementById('salarioBruto').value = funcionario.salarioBruto;
        document.getElementById('chavePix').value = funcionario.chavePix || '';

        document.getElementById('descontos-container').innerHTML = '';
        if (funcionario.descontos && funcionario.descontos.length > 0) {
            funcionario.descontos.forEach(desconto => adicionarCampoDescontoFixo(desconto));
        }

        // Habilita a edição do usuário vinculado
        const usuarioSelect = document.getElementById('usuario-vinculado');
        usuarioSelect.disabled = false; // Habilita o select

        // Carrega os usuários não vinculados
        const responseUsuarios = await fetchWithAuth('/api/auth/admin/unlinked-users');
        const usuariosDisponiveis = await responseUsuarios.json();

        usuarioSelect.innerHTML = ''; // Limpa as opções

        // Adiciona o usuário atual do funcionário como a primeira opção selecionada
        const currentUserOption = new Option(`${funcionario.usuario.nome} (Atual)`, funcionario.usuario._id, true, true);
        usuarioSelect.dataset.originalValue = funcionario.usuario._id; // Armazena o valor original
        usuarioSelect.appendChild(currentUserOption);

        // Adiciona os outros usuários disponíveis
        usuariosDisponiveis.forEach(user => {
            const option = new Option(`${user.nome} (${user.email})`, user._id);
            usuarioSelect.appendChild(option);
        });

        document.getElementById('btn-salvar-funcionario').textContent = 'Salvar Alterações';
        document.getElementById('btn-cancelar-edicao').style.display = 'inline-block';
        window.scrollTo(0, 0);

    } catch (error) {
        alert(error.message);
    }
}

function resetarFormulario() {
    document.getElementById('form-novo-funcionario').reset();
    document.getElementById('funcionarioId').value = '';
    document.getElementById('descontos-container').innerHTML = '';
    document.getElementById('btn-salvar-funcionario').textContent = 'Cadastrar';
    delete document.getElementById('usuario-vinculado').dataset.originalValue; // Limpa o valor original
    document.getElementById('usuario-vinculado').disabled = false; // Garante que o select esteja habilitado
    document.getElementById('btn-cancelar-edicao').style.display = 'none';
    document.getElementById('usuario-vinculado').disabled = false; // Reabilita o select
    carregarUsuariosDisponiveis(); // Recarrega a lista de usuários
}

async function excluirFuncionario(id) {
    if (!confirm('Tem certeza que deseja excluir este funcionário?')) return;
    // A lógica de exclusão seria implementada aqui, chamando a API DELETE.
    // Por simplicidade, esta parte foi omitida, mas seguiria o padrão de outras funções de exclusão.
    // alert('Funcionalidade de exclusão a ser implementada.');
     try {
         const response = await fetchWithAuth(`/api/funcionarios/${id}`, {
             method: 'DELETE'
         });
         if (!response.ok) {
             const err = await response.json();
             throw new Error(err.msg || 'Erro ao excluir funcionário.');
         }
         alert('Funcionário excluído com sucesso!');
         await carregarFuncionarios();
         await carregarUsuariosDisponiveis(); // Recarrega a lista de usuários
     } catch (error) {
         alert(`Erro: ${error.message}`);
     }
}

async function abrirModalPagamento(funcionarioId) {
    const modal = document.getElementById('modal-pagamento');
    try {
        const response = await fetchWithAuth(`/api/funcionarios/${funcionarioId}`);
        if (!response.ok) throw new Error('Funcionário não encontrado.');
        const funcionario = await response.json();

        document.getElementById('modal-nome-funcionario').textContent = funcionario.nome;
        document.getElementById('btn-gerar-demonstrativo').dataset.funcionarioId = funcionario._id;

        const hoje = new Date();
        const mesAtual = hoje.getMonth() + 1;
        const anoAtual = hoje.getFullYear();
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        
        const mesPagamentoSelect = document.getElementById('mes-pagamento');
        mesPagamentoSelect.innerHTML = '';
        for (let i = 0; i < 12; i++) {
            const option = document.createElement('option');
            option.value = i + 1;
            option.textContent = meses[i];
            if ((i + 1) === mesAtual) option.selected = true;
            mesPagamentoSelect.appendChild(option);
        }
        document.getElementById('ano-pagamento').value = anoAtual;

        document.getElementById('demonstrativo-corpo').innerHTML = '<p>Selecione o período e clique em "Gerar Demonstrativo".</p>';
        exibirHistoricoPagamentos(funcionario.historicoPagamentos || []);
        modal.style.display = 'flex'; // CORREÇÃO: Usa 'flex' para centralizar o modal.
    } catch (error) {
        alert(error.message);
    }
}

async function gerarDemonstrativo() {
    const funcionarioId = document.getElementById('btn-gerar-demonstrativo').dataset.funcionarioId;
    const mes = parseInt(document.getElementById('mes-pagamento').value);
    const ano = parseInt(document.getElementById('ano-pagamento').value);

    document.getElementById('modal-titulo-pagamento').textContent = `Demonstrativo - ${document.getElementById('mes-pagamento').options[document.getElementById('mes-pagamento').selectedIndex].text}/${ano}`;

    const response = await fetchWithAuth(`/api/funcionarios/${funcionarioId}`);
    const funcionario = await response.json();

    const pagamentoExistente = (funcionario.historicoPagamentos || []).find(p => p.mes === mes && p.ano === ano);

    if (pagamentoExistente) {
        renderizarDemonstrativo(pagamentoExistente, true, mes, ano, funcionario);
    } else {
        renderizarDemonstrativo(funcionario, false, mes, ano, funcionario);
    }
}

function getDescontosFixosAtivos(funcionario, mes, ano) {
    // CORREÇÃO: O campo correto é 'descontos', não 'descontosFixos'.
    return (funcionario.descontos || []).filter(d => {
        if (d.mesesDuracao === -1) return true;
        if (!d.mesInicio || !d.anoInicio) return false;

        const dataInicioDesconto = new Date(d.anoInicio, d.mesInicio - 1);
        const dataDemonstrativo = new Date(ano, mes - 1);
        const dataFimDesconto = new Date(dataInicioDesconto);
        dataFimDesconto.setMonth(dataFimDesconto.getMonth() + d.mesesDuracao);

        return dataDemonstrativo >= dataInicioDesconto && dataDemonstrativo < dataFimDesconto;
    });
}

function renderizarDemonstrativo(dados, isPago, mes, ano, dadosFuncionario) {
    const corpo = document.getElementById('demonstrativo-corpo');
    corpo.innerHTML = '';

    const salarioBase = isPago ? dados.salarioBase : dados.salarioBruto;
    const descontosFixosAtivos = isPago ? dados.descontosFixos : getDescontosFixosAtivos(dadosFuncionario, mes, ano);
    // Busca os adicionais e descontos variáveis se o pagamento já foi feito
    const adicionaisPagos = isPago ? (dados.adicionais || []) : [];
    const descontosVariaveisPagos = isPago ? (dados.descontosVariaveis || []) : [];

    // --- MELHORIA: Adiciona os detalhes do pagamento ---
    let detalhesPagamentoHtml = '';
    if (isPago) {
        detalhesPagamentoHtml = `<p><strong>Forma de Pagamento:</strong> ${dados.formaPagamento || 'Não informado'}</p>`;
        if (dados.formaPagamento === 'pix' && dados.chavePix) {
            detalhesPagamentoHtml += `<p><strong>Chave PIX:</strong> ${dados.chavePix}</p>`;
        }
    } else {
        // Se o pagamento não foi feito, mostra o seletor
        detalhesPagamentoHtml = `
            <label for="formaPagamentoDemonstrativo">Forma de Pagamento:</label>
            <select id="formaPagamentoDemonstrativo">
                <option value="pix" selected>PIX</option><option value="dinheiro">Dinheiro Físico</option><option value="outro">Outro</option>
            </select>
            <p style="margin-top: 5px;"><strong>Chave PIX (se aplicável):</strong> ${dadosFuncionario.chavePix || 'Não cadastrada'}</p>`;
    }

    // --- MELHORIA DE DESIGN: Gera uma tabela em vez de divs ---
    let html = `
        <table class="demonstrativo-tabela" id="demonstrativo-print-area">
            <thead>
                <tr>
                    <th>Descrição</th>
                    <th class="valor-coluna">Proventos</th>
                    <th class="valor-coluna">Descontos</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Salário Base</td>
                    <td class="valor-coluna valor-positivo">${salarioBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td class="valor-coluna"></td>
                </tr>
                ${adicionaisPagos.map(a => `
                    <tr>
                        <td>${a.descricao}</td>
                        <td class="valor-coluna valor-positivo">${a.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td class="valor-coluna"></td>
                    </tr>
                `).join('')}
                <!-- Placeholder para novos adicionais (só aparece se não for pago) -->
                ${!isPago ? '<tr id="adicionais-placeholder"></tr>' : ''}
                ${descontosFixosAtivos.map(d => `
                    <tr>
                        <td>${d.descricao}</td>
                        <td class="valor-coluna"></td>
                        <td class="valor-coluna valor-negativo">${d.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                `).join('')}
                ${descontosVariaveisPagos.map(d => `
                    <tr>
                        <td>${d.descricao}</td>
                        <td class="valor-coluna"></td>
                        <td class="valor-coluna valor-negativo">${d.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                `).join('')}
                <!-- Placeholder para novos descontos (só aparece se não for pago) -->
                ${!isPago ? '<tr id="descontos-variaveis-placeholder"></tr>' : ''}
            </tbody>
        </table>
        <div class="resumo-pagamento" id="resumo-pagamento">
            <!-- O resumo será calculado e inserido aqui -->
        </div>
        <div class="detalhes-pagamento" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #eee;">
            <h4>Detalhes para Pagamento</h4>
            ${detalhesPagamentoHtml}
        </div>
        <div class="action-buttons demonstrativo-actions">
            ${isPago ? `<p><strong>Pagamento realizado em: ${new Date(dados.dataPagamento).toLocaleDateString('pt-BR')}</strong></p>` : `<button id="btn-registrar-pagamento" class="btn btn-success">Registrar Pagamento</button>`}
            <button id="btn-imprimir-demonstrativo" class="btn btn-secondary">Imprimir</button>
            ${!isPago ? `
                <div class="variaveis-container" style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #eee;">
                    <h4>Adicionais e Descontos do Mês</h4>
                    <p>Use os botões abaixo para adicionar valores que se aplicam apenas a este mês.</p>
                    <button type="button" id="btn-add-adicional" class="btn-sm" style="background-color: #28a745;">+ Adicional</button>
                    <button type="button" id="btn-add-desconto-variavel" class="btn-sm" style="background-color: #ffc107; color: #212529;">+ Desconto</button>
                </div>
            ` : ''}
        </div>
    `;
    corpo.innerHTML = html;

    document.getElementById('btn-imprimir-demonstrativo').addEventListener('click', () => window.print());
    
    if (!isPago) {
        document.getElementById('btn-add-adicional').addEventListener('click', () => adicionarCampoVariavel('adicional'));
        document.getElementById('btn-add-desconto-variavel').addEventListener('click', () => adicionarCampoVariavel('desconto-variavel'));
        document.getElementById('btn-registrar-pagamento').addEventListener('click', () => registrarPagamento(dados, mes, ano));
        corpo.addEventListener('input', () => calcularResumo(salarioBase, descontosFixosAtivos));
    }
    
    calcularResumo(salarioBase, descontosFixosAtivos);
}

function adicionarCampoVariavel(tipo) {
    const placeholderId = tipo === 'adicional' ? 'adicionais-placeholder' : 'descontos-variaveis-placeholder';
    const placeholder = document.getElementById(placeholderId);
    
    const newRow = document.createElement('tr');
    newRow.className = 'campo-variavel';
    newRow.innerHTML = `
        <td><input type="text" data-tipo="${tipo}" data-campo="descricao" placeholder="Descrição do ${tipo}" style="width: 95%;"></td>
        <td class="valor-coluna ${tipo === 'adicional' ? 'valor-positivo' : ''}"><input type="number" data-tipo="${tipo}" data-campo="valor" placeholder="Valor" step="0.01" style="width: 80px; text-align: right;"></td>
        <td class="valor-coluna ${tipo === 'desconto-variavel' ? 'valor-negativo' : ''}"></td>
    `;
    
    // Insere a nova linha antes do placeholder
    placeholder.parentNode.insertBefore(newRow, placeholder);
}

function calcularResumo(salarioBase, descontosFixos) {
    const resumoContainer = document.getElementById('resumo-pagamento');
    
    const getSomaVariaveis = (tipo) => {
        return Array.from(document.querySelectorAll(`tr.campo-variavel input[data-tipo="${tipo}"][data-campo="valor"]`))
            .reduce((acc, input) => acc + (parseFloat(input.value) || 0), 0);
    };

    const totalAdicionais = getSomaVariaveis('adicional');
    const totalDescontosVariaveis = getSomaVariaveis('desconto-variavel');

    const totalDescontosFixos = descontosFixos.reduce((acc, d) => acc + d.valor, 0);

    const totalProventos = salarioBase + adicionais;
    const totalDescontos = totalDescontosFixos + totalDescontosVariaveis;
    const salarioLiquido = totalProventos - totalDescontos;

    resumoContainer.innerHTML = `
        <table style="width: 100%;">
            <tr>
                <td>Total Proventos:</td>
                <td class="valor-coluna valor-positivo">${totalProventos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            </tr>
            <tr>
                <td>Total Descontos:</td>
                <td class="valor-coluna valor-negativo">${totalDescontos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            </tr>
            <tr style="font-size: 1.2rem; font-weight: bold;">
                <td>Salário Líquido:</td>
                <td class="valor-coluna">${salarioLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            </tr>
        </table>
    `;
}

async function registrarPagamento(funcionario, mes, ano) {
    const getVariaveis = (tipo) => {
        return Array.from(document.querySelectorAll(`.campo-variavel [data-tipo="${tipo}"]`))
            .map(input => input.closest('.campo-variavel'))
            .filter((item, index, self) => self.indexOf(item) === index)
            .map(item => ({
                descricao: item.querySelector('[data-campo="descricao"]').value,
                valor: parseFloat(item.querySelector('[data-campo="valor"]').value) || 0
            }))
            .filter(item => item.descricao && item.valor > 0);
    };

    const adicionais = getVariaveis('adicional');
    const descontosVariaveis = getVariaveis('desconto-variavel');
    const descontosFixosAtivos = getDescontosFixosAtivos(funcionario, mes, ano);

    const formaPagamento = document.getElementById('formaPagamentoDemonstrativo').value;

    const totalProventos = funcionario.salarioBruto + adicionais.reduce((acc, item) => acc + item.valor, 0);
    const totalDescontos = descontosFixosAtivos.reduce((acc, item) => acc + item.valor, 0) + descontosVariaveis.reduce((acc, item) => acc + item.valor, 0);

    const payload = {
        mes, ano,
        salarioBase: funcionario.salarioBruto,
        adicionais,
        descontosFixos: descontosFixosAtivos,
        descontosVariaveis,
        totalProventos,
        totalDescontos,
        salarioLiquido: totalProventos - totalDescontos,
        formaPagamento: formaPagamento,
        chavePix: funcionario.chavePix // Envia a chave PIX do cadastro do funcionário
    };

    try {
        const response = await fetchWithAuth(`/api/funcionarios/${funcionario._id}/pagamentos`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Erro ao registrar pagamento.');
        }
        alert('Pagamento registrado com sucesso!');
        fecharModal();
        await carregarFuncionarios();
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

function fecharModal() {
    document.getElementById('modal-pagamento').style.display = 'none';
}