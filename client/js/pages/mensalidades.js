let usuario;
let dadosCarregados = [];
let reciboCache = {};
let pagamentoCache = {};
let escritorioConfig = null;

const MESES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

document.addEventListener('DOMContentLoaded', async () => {
    if (!localStorage.getItem('token')) {
        window.location.replace('login.html');
        return;
    }

    try {
        const response = await fetchWithAuth('/api/auth');
        if (!response || !response.ok) throw new Error('Falha na autenticação.');

        usuario = await response.json();
        createHeader('header-placeholder', usuario);

        if (!['admin', 'gerente', 'funcionario'].includes(usuario.role)) {
            document.body.innerHTML = '<h1>Acesso Negado</h1><p>Você não tem permissão para ver esta página.</p>';
            document.body.style.display = 'block';
            return;
        }

        document.body.style.display = 'block';
        inicializarFiltros();
        await carregarStatusMensalidades();

        document.getElementById('modal-form').addEventListener('submit', handleFormSubmit);
        document.getElementById('btn-filtrar').addEventListener('click', carregarStatusMensalidades);
        document.getElementById('modal-close-btn').addEventListener('click', fecharModal);
        document.getElementById('modal-cancel-btn').addEventListener('click', fecharModal);

        document.getElementById('filtro-busca').addEventListener('input', () => {
            renderizarTabela(filtrarLocalmente(), parseInt(document.getElementById('filtro-mes').value), parseInt(document.getElementById('filtro-ano').value));
        });

        window.onclick = (event) => {
            if (event.target === document.getElementById('acao-modal')) fecharModal();
        };

    } catch (error) {
        console.error('Erro na inicialização:', error);
        localStorage.removeItem('token');
        window.location.replace('login.html');
    }
});

function inicializarFiltros() {
    const filtroMes = document.getElementById('filtro-mes');
    const filtroAno = document.getElementById('filtro-ano');
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();

    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    meses.forEach((nome, i) => {
        const option = document.createElement('option');
        option.value = i + 1;
        option.textContent = nome;
        if ((i + 1) === mesAtual) option.selected = true;
        filtroMes.appendChild(option);
    });

    filtroAno.value = anoAtual;
}

function filtrarLocalmente() {
    const busca = document.getElementById('filtro-busca').value.trim().toLowerCase();
    if (!busca) return dadosCarregados;
    return dadosCarregados.filter(item =>
        item.nome.toLowerCase().includes(busca) ||
        (item.cnpj && item.cnpj.includes(busca))
    );
}

async function carregarStatusMensalidades() {
    const mes = document.getElementById('filtro-mes').value;
    const ano = document.getElementById('filtro-ano').value;
    const tbody = document.querySelector('#tabela-mensalidades tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-cell">Carregando...</td></tr>';
    document.getElementById('stats-bar').style.display = 'none';

    try {
        const response = await fetchWithAuth(`/api/mensalidades/status-geral?mes=${mes}&ano=${ano}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Falha ao carregar dados.');
        }
        const dados = await response.json();
        dadosCarregados = dados.data;
        renderizarTabela(filtrarLocalmente(), parseInt(mes), parseInt(ano));
        renderizarStats(dadosCarregados);
    } catch (error) {
        console.error('Erro ao carregar mensalidades:', error);
        tbody.innerHTML = `<tr><td colspan="7" class="error-cell">${error.message}</td></tr>`;
    }
}

function renderizarStats(dados) {
    const statsBar = document.getElementById('stats-bar');
    if (!dados || dados.length === 0) { statsBar.style.display = 'none'; return; }

    let pago = 0, pendente = 0, atrasado = 0, naoGerada = 0;
    dados.forEach(item => {
        const status = item.mensalidade?.status || 'Não Gerada';
        if (status === 'Pago') pago++;
        else if (status === 'Pendente') pendente++;
        else if (status === 'Atrasado') atrasado++;
        else naoGerada++;
    });

    document.getElementById('stat-total').textContent = dados.length;
    document.getElementById('stat-pago').textContent = pago;
    document.getElementById('stat-pendente').textContent = pendente;
    document.getElementById('stat-atrasado').textContent = atrasado;
    document.getElementById('stat-nao-gerada').textContent = naoGerada;
    statsBar.style.display = 'flex';
}

function renderizarTabela(dados, mesFiltro, anoFiltro) {
    const tbody = document.querySelector('#tabela-mensalidades tbody');
    tbody.innerHTML = '';

    if (!dados || dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">Nenhuma empresa encontrada.</td></tr>';
        return;
    }

    dados.forEach(item => {
        const row = tbody.insertRow();
        const mensalidade = item.mensalidade;

        row.insertCell(0).textContent = item.nome;
        row.insertCell(1).textContent = formatarCNPJ(item.cnpj);

        const statusCell = row.insertCell(2);
        const valorCell = row.insertCell(3);
        const vencimentoCell = row.insertCell(4);
        const pagamentoCell = row.insertCell(5);
        const acoesCell = row.insertCell(6);
        acoesCell.className = 'acoes-cell';

        if (mensalidade && mensalidade._id) {
            const status = mensalidade.status;
            const statusClass = status.toLowerCase()
                .normalize('NFD').replace(/[̀-ͯ]/g, '')
                .replace(/\s+/g, '-');

            statusCell.innerHTML = `<span class="status-badge status-${statusClass}">${status}</span>`;
            valorCell.textContent = formatarMoeda(mensalidade.valor);
            vencimentoCell.textContent = formatarData(mensalidade.dataVencimento);
            pagamentoCell.textContent = status === 'Pago' ? formatarData(mensalidade.dataPagamento) : '—';

            if (status === 'Pago') {
                reciboCache[mensalidade._id] = {
                    id: mensalidade._id,
                    empresaNome: item.nome,
                    empresaCnpj: item.cnpj,
                    valor: mensalidade.valor,
                    dataPagamento: mensalidade.dataPagamento,
                    mes: mesFiltro,
                    ano: anoFiltro
                };
            } else {
                pagamentoCache[mensalidade._id] = {
                    empresaNome: item.nome,
                    valor: mensalidade.valor,
                    dataVencimento: mensalidade.dataVencimento
                };
            }

            acoesCell.innerHTML = `
                ${status !== 'Pago' ? `<button class="btn-acao btn-pagar" onclick="abrirModalPagar('${mensalidade._id}')">Pagar</button>` : ''}
                ${status === 'Pago' ? `<button class="btn-acao btn-recibo" onclick="gerarRecibo('${mensalidade._id}')">Recibo</button>` : ''}
                <button class="btn-acao btn-editar" onclick="abrirModalEditar('${mensalidade._id}', '${mensalidade.valor}', '${mensalidade.dataVencimento}')">Editar</button>
                <button class="btn-acao btn-excluir" onclick="excluirMensalidade('${mensalidade._id}')">Excluir</button>
            `;
        } else {
            statusCell.innerHTML = `<span class="status-badge status-nao-gerada">Não Gerada</span>`;
            valorCell.textContent = '—';
            vencimentoCell.textContent = '—';
            pagamentoCell.textContent = '—';
            acoesCell.innerHTML = `
                <button class="btn-acao btn-gerar" onclick="abrirModalGerar('${item._id}', '${item.nome}', ${mensalidade?.valor || 0})">Gerar</button>
            `;
        }
    });
}

// --- Modal ---

function abrirModalGerar(empresaId, empresaNome, valorSugerido) {
    const mes = document.getElementById('filtro-mes').value;
    const ano = document.getElementById('filtro-ano').value;
    const defaultVencimento = `${ano}-${String(mes).padStart(2, '0')}-10`;

    document.getElementById('modal-titulo').textContent = `Gerar Mensalidade — ${empresaNome}`;
    document.getElementById('modal-mensalidade-id').value = '';
    document.getElementById('modal-empresa-id').value = empresaId;
    document.getElementById('modal-modo').value = 'gerar';
    document.getElementById('modal-valor').value = valorSugerido > 0 ? parseFloat(valorSugerido).toFixed(2) : '';
    document.getElementById('modal-valor').readOnly = false;
    document.getElementById('modal-data-vencimento').value = defaultVencimento;
    document.getElementById('grupo-data-vencimento').style.display = 'block';
    document.getElementById('grupo-data-pagamento').style.display = 'none';
    document.getElementById('modal-submit-btn').textContent = 'Gerar Mensalidade';
    document.getElementById('acao-modal').style.display = 'flex';
}

function abrirModalEditar(mensalidadeId, valor, dataVencimento) {
    document.getElementById('modal-titulo').textContent = 'Editar Mensalidade';
    document.getElementById('modal-mensalidade-id').value = mensalidadeId;
    document.getElementById('modal-empresa-id').value = '';
    document.getElementById('modal-modo').value = 'editar';
    document.getElementById('modal-valor').value = parseFloat(valor).toFixed(2);
    document.getElementById('modal-valor').readOnly = false;
    document.getElementById('modal-data-vencimento').value = dataVencimento
        ? new Date(dataVencimento).toISOString().split('T')[0]
        : '';
    document.getElementById('grupo-data-vencimento').style.display = 'block';
    document.getElementById('grupo-data-pagamento').style.display = 'none';
    document.getElementById('modal-submit-btn').textContent = 'Salvar Alterações';
    document.getElementById('acao-modal').style.display = 'flex';
}

function abrirModalPagar(mensalidadeId) {
    const dados = pagamentoCache[mensalidadeId];
    if (!dados) return;

    document.getElementById('modal-titulo').textContent = `Registrar Pagamento — ${dados.empresaNome}`;
    document.getElementById('modal-mensalidade-id').value = mensalidadeId;
    document.getElementById('modal-empresa-id').value = '';
    document.getElementById('modal-modo').value = 'pagar';
    document.getElementById('modal-valor').value = parseFloat(dados.valor).toFixed(2);
    document.getElementById('modal-valor').readOnly = true;
    document.getElementById('modal-data-pagamento').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-data-vencimento').value = dados.dataVencimento
        ? new Date(dados.dataVencimento).toISOString().split('T')[0]
        : '';
    document.getElementById('grupo-data-pagamento').style.display = 'block';
    document.getElementById('grupo-data-vencimento').style.display = 'block';
    document.getElementById('modal-submit-btn').textContent = 'Confirmar Pagamento';
    document.getElementById('acao-modal').style.display = 'flex';
}


function fecharModal() {
    document.getElementById('acao-modal').style.display = 'none';
    document.getElementById('modal-form').reset();
    document.getElementById('modal-modo').value = '';
    document.getElementById('modal-valor').readOnly = false;
    document.getElementById('grupo-data-vencimento').style.display = 'none';
    document.getElementById('grupo-data-pagamento').style.display = 'none';
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const modo = document.getElementById('modal-modo').value;
    const mensalidadeId = document.getElementById('modal-mensalidade-id').value;
    const empresaId = document.getElementById('modal-empresa-id').value;
    const valor = document.getElementById('modal-valor').value;
    const dataVencimento = document.getElementById('modal-data-vencimento').value;

    let url, method, body;

    if (modo === 'pagar') {
        const dataPagamento = document.getElementById('modal-data-pagamento').value;
        if (!dataPagamento) { showToast('Informe a data de pagamento.', 'error'); return; }
        url = `/api/mensalidades/${mensalidadeId}`;
        method = 'PUT';
        body = { status: 'Pago', dataPagamento, ...(dataVencimento && { dataVencimento }) };
    } else if (modo === 'editar') {
        url = `/api/mensalidades/${mensalidadeId}`;
        method = 'PUT';
        body = { valor, ...(dataVencimento && { dataVencimento }) };
    } else {
        url = '/api/mensalidades';
        method = 'POST';
        body = {
            empresaId, valor,
            mes: document.getElementById('filtro-mes').value,
            ano: document.getElementById('filtro-ano').value,
            ...(dataVencimento && { dataVencimento })
        };
    }

    const submitBtn = document.getElementById('modal-submit-btn');
    submitBtn.disabled = true;

    try {
        const response = await fetchWithAuth(url, { method, body: JSON.stringify(body) });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Erro ao salvar.');
        }

        showToast('Operação realizada com sucesso!', 'success');
        fecharModal();
        await carregarStatusMensalidades();
    } catch (error) {
        showToast(`Erro: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
    }
}

async function excluirMensalidade(mensalidadeId) {
    const confirmado = await openConfirmModal('Tem certeza que deseja excluir esta mensalidade? Esta ação não pode ser desfeita.', {
        title: 'Excluir Mensalidade'
    });
    if (!confirmado) return;

    try {
        const response = await fetchWithAuth(`/api/mensalidades/${mensalidadeId}`, { method: 'DELETE' });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.msg || 'Falha ao excluir.');
        }

        showToast('Mensalidade excluída com sucesso!', 'success');
        await carregarStatusMensalidades();
    } catch (error) {
        showToast(`Erro: ${error.message}`, 'error');
    }
}

// --- Auxiliares ---

function formatarMoeda(valor) {
    return parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarCNPJ(cnpj) {
    if (!cnpj) return '';
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatarData(dataISO) {
    if (!dataISO) return '';
    const data = new Date(dataISO);
    const offset = data.getTimezoneOffset();
    return new Date(data.getTime() + offset * 60 * 1000).toLocaleDateString('pt-BR');
}

// --- Recibo ---

async function gerarRecibo(mensalidadeId) {
    const dados = reciboCache[mensalidadeId];
    if (!dados) { showToast('Dados do recibo não encontrados.', 'error'); return; }

    if (!escritorioConfig) {
        try {
            const r = await fetchWithAuth('/api/configuracao');
            if (r && r.ok) escritorioConfig = await r.json();
        } catch (e) { /* continua sem config */ }
    }

    const win = window.open('', '_blank', 'width=820,height=950,scrollbars=yes');
    if (!win) { showToast('Habilite pop-ups no navegador para gerar o recibo.', 'error'); return; }
    win.document.write(buildReceiptHtml(dados, escritorioConfig));
    win.document.close();
    win.focus();
}

function formatarEnderecoRecibo(end) {
    if (!end) return '';
    const partes = [];
    if (end.logradouro) {
        let linha = end.logradouro;
        if (end.numero) linha += `, ${end.numero}`;
        if (end.complemento) linha += ` — ${end.complemento}`;
        partes.push(linha);
    }
    if (end.bairro) partes.push(end.bairro);
    if (end.cidade) partes.push(`${end.cidade}${end.uf ? `/${end.uf}` : ''}`);
    if (end.cep) partes.push(`CEP ${end.cep}`);
    return partes.join(' • ');
}

function buildReceiptHtml(dados, config) {
    const numRecibo = `REC-${dados.ano}${String(dados.mes).padStart(2, '0')}-${dados.id.slice(-6).toUpperCase()}`;
    const mesNome = MESES_NOME[dados.mes - 1] || dados.mes;
    const valorFmt = formatarMoeda(dados.valor);
    const dataPagFmt = formatarData(dados.dataPagamento);
    const dataEmissao = new Date().toLocaleDateString('pt-BR');

    const esc = {
        nome: config?.nomeEmpresa || 'Escritório de Contabilidade',
        cnpj: config?.cnpj ? formatarCNPJ(config.cnpj) : '',
        endereco: formatarEnderecoRecibo(config?.endereco),
        telefone: config?.telefone || '',
        email: config?.email || '',
        logo: config?.logotipoUrl || '',
        cidade: config?.endereco?.cidade || '',
        uf: config?.endereco?.uf || ''
    };

    const emp = {
        nome: dados.empresaNome,
        cnpj: dados.empresaCnpj ? formatarCNPJ(dados.empresaCnpj) : ''
    };

    const localData = esc.cidade ? `${esc.cidade}${esc.uf ? `/${esc.uf}` : ''}, ${dataEmissao}` : dataEmissao;

    const detalhesEsc = [
        esc.cnpj ? `CNPJ: ${esc.cnpj}` : '',
        esc.endereco,
        [esc.telefone ? `Tel: ${esc.telefone}` : '', esc.email].filter(Boolean).join('  |  ')
    ].filter(Boolean).join('<br>');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Recibo ${numRecibo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#e8ecf0;color:#1a1a1a}
  .toolbar{background:#2c3e50;padding:.75rem 1rem;display:flex;gap:.75rem;justify-content:center;position:sticky;top:0;z-index:10}
  .toolbar button{padding:.5rem 1.4rem;font-size:.9rem;font-weight:600;border:none;border-radius:5px;cursor:pointer}
  .btn-imprimir{background:#27ae60;color:#fff}
  .btn-fechar{background:#7f8c8d;color:#fff}
  .page{background:#fff;max-width:760px;margin:1.5rem auto 3rem;padding:44px 52px;box-shadow:0 4px 24px rgba(0,0,0,.15)}

  /* Cabeçalho escritório */
  .esc-header{display:flex;align-items:center;gap:1.2rem;padding-bottom:1.2rem;border-bottom:3px solid #2c3e50;margin-bottom:1.6rem}
  .esc-logo{max-height:72px;max-width:130px;object-fit:contain}
  .esc-nome{font-size:1.25rem;font-weight:700;color:#2c3e50;margin-bottom:.3rem}
  .esc-detalhe{font-size:.8rem;color:#555;line-height:1.65}

  /* Título */
  .recibo-titulo{text-align:center;margin-bottom:.3rem}
  .recibo-titulo h1{font-size:1.45rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#2c3e50}
  .recibo-num{text-align:center;font-size:.8rem;color:#999;margin-bottom:1.8rem;letter-spacing:.04em}

  /* Texto declaratório */
  .declaracao{font-size:1rem;line-height:1.85;color:#2d2d2d;text-align:justify;margin-bottom:1.6rem}
  .declaracao strong{color:#1a1a1a}

  /* Grid de informações */
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:.9rem;margin-bottom:1.5rem}
  .info-item{background:#f5f7fa;border-left:3px solid #2c3e50;border-radius:0 6px 6px 0;padding:.65rem 1rem}
  .info-label{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:.2rem}
  .info-valor{font-size:.92rem;font-weight:600;color:#1a1a1a}

  /* Box valor */
  .valor-box{background:#2c3e50;color:#fff;border-radius:8px;padding:1.1rem 1.5rem;text-align:center;margin:1.4rem 0}
  .valor-label{font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;opacity:.75;margin-bottom:.35rem}
  .valor-numero{font-size:1.9rem;font-weight:800;letter-spacing:.02em}

  /* Rodapé */
  .rodape{margin-top:2.5rem;padding-top:1.4rem;border-top:1px solid #dee2e6}
  .rodape-data{font-size:.88rem;color:#666;margin-bottom:2.2rem}
  .assinatura{text-align:center;display:inline-block;min-width:260px}
  .assinatura-linha{border-top:1px solid #333;margin-bottom:.4rem}
  .assinatura-nome{font-size:.85rem;font-weight:600;color:#2c3e50}
  .assinatura-cnpj{font-size:.74rem;color:#999;margin-top:.15rem}

  @media print{
    .toolbar{display:none!important}
    body{background:#fff}
    .page{box-shadow:none;margin:0;padding:28px 36px;max-width:100%}
    @page{size:A4;margin:1.2cm}
  }
</style>
</head>
<body>
<div class="toolbar">
  <button class="btn-imprimir" onclick="window.print()">🖨️ Imprimir</button>
  <button class="btn-fechar" onclick="window.close()">✕ Fechar</button>
</div>

<div class="page">

  <div class="esc-header">
    ${esc.logo ? `<img class="esc-logo" src="${esc.logo}" alt="Logo">` : ''}
    <div>
      <div class="esc-nome">${esc.nome}</div>
      ${detalhesEsc ? `<div class="esc-detalhe">${detalhesEsc}</div>` : ''}
    </div>
  </div>

  <div class="recibo-titulo"><h1>Recibo de Mensalidade</h1></div>
  <div class="recibo-num">Nº ${numRecibo}</div>

  <p class="declaracao">
    Recebemos de <strong>${emp.nome}</strong>${emp.cnpj ? ` (CNPJ: ${emp.cnpj})` : ''} a importância de
    <strong>${valorFmt}</strong>, referente à prestação de serviços contábeis
    do mês de <strong>${mesNome} de ${dados.ano}</strong>. Declaramos que o valor foi
    recebido em sua totalidade, dando plena quitação pelo presente.
  </p>

  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">Empresa Pagadora</div>
      <div class="info-valor">${emp.nome}</div>
    </div>
    ${emp.cnpj ? `<div class="info-item">
      <div class="info-label">CNPJ da Empresa</div>
      <div class="info-valor">${emp.cnpj}</div>
    </div>` : ''}
    <div class="info-item">
      <div class="info-label">Competência</div>
      <div class="info-valor">${mesNome} / ${dados.ano}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Data do Pagamento</div>
      <div class="info-valor">${dataPagFmt}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Prestador de Serviços</div>
      <div class="info-valor">${esc.nome}</div>
    </div>
    ${esc.cnpj ? `<div class="info-item">
      <div class="info-label">CNPJ do Escritório</div>
      <div class="info-valor">${esc.cnpj}</div>
    </div>` : ''}
  </div>

  <div class="valor-box">
    <div class="valor-label">Valor Total Recebido</div>
    <div class="valor-numero">${valorFmt}</div>
  </div>

  <div class="rodape">
    <div class="rodape-data">${localData}</div>
    <div class="assinatura">
      <div class="assinatura-linha"></div>
      <div class="assinatura-nome">${esc.nome}</div>
      ${esc.cnpj ? `<div class="assinatura-cnpj">CNPJ: ${esc.cnpj}</div>` : ''}
    </div>
  </div>

</div>
</body>
</html>`;
}
