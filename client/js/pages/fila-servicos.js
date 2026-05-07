// fila-servicos.js

let usuarioAtual = null;
let todosServicos = [];
let funcionariosCache = [];
let empresasCache = [];

const TIPOS = {
  alteracao_empresa:    'Alteração de Empresa',
  abertura_empresa:     'Abertura de Empresa',
  encerramento_empresa: 'Encerramento de Empresa',
  declaracao_fiscal:    'Declaração Fiscal',
  certidao_negativa:    'Certidão Negativa',
  certificado_digital:  'Certificado Digital',
  consultoria:          'Consultoria',
  outro:                'Outro'
};

// Tipos que exigem seleção de empresa
const TIPOS_COM_EMPRESA = ['alteracao_empresa', 'abertura_empresa', 'encerramento_empresa', 'declaracao_fiscal', 'certidao_negativa', 'certificado_digital'];

// Tipos onde a empresa ainda não existe no banco (vai direto para input de texto)
const TIPOS_ABERTURA = ['abertura_empresa'];

const STATUS_LABEL = {
  pendente:     'Pendente',
  em_andamento: 'Em andamento',
  concluido:    'Concluído',
  cancelado:    'Cancelado'
};

const PRIORIDADE_LABEL = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta' };

function formatarData(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('pt-BR');
}

// ── Tabela ────────────────────────────────────────────────────
function renderTabela(servicos) {
  const tbody = document.getElementById('tbody-servicos');
  if (!servicos.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Nenhum serviço encontrado.</p></div></td></tr>`;
    return;
  }

  const isGerente = usuarioAtual && ['admin', 'gerente'].includes(usuarioAtual.role);

  tbody.innerHTML = servicos.map(s => {
    const tipoLabel  = TIPOS[s.tipo] || s.tipo || '–';
    const empresaInfo = s.empresa
      ? `<div style="font-size:0.78rem;color:var(--text-secondary)">${escapeHtml(s.empresa.nome)}</div>`
      : s.empresaNaoCadastrada
      ? `<div style="font-size:0.78rem;color:#b45309">⚠ ${escapeHtml(s.empresaNaoCadastrada)} <em>(não cadastrada)</em></div>`
      : '';
    const funcNome = s.funcionario
      ? escapeHtml(s.funcionario.nome)
      : '<span style="color:var(--muted)">–</span>';
    const respNome = s.responsavel
      ? escapeHtml(s.responsavel.nome)
      : '<span style="color:var(--muted)">–</span>';

    const eResponsavel = s.responsavel && usuarioAtual && s.responsavel._id === usuarioAtual._id;

    let botaoAssumir = '';
    if (!s.responsavel) {
      botaoAssumir = `<button class="btn btn-success btn-sm" onclick="assumirServico('${s._id}')">Assumir</button>`;
    } else if (eResponsavel) {
      botaoAssumir = `<button class="btn btn-warning btn-sm" onclick="assumirServico('${s._id}')">Liberar</button>`;
    } else if (isGerente) {
      botaoAssumir = `<button class="btn btn-warning btn-sm" onclick="assumirServico('${s._id}')">Reatribuir</button>`;
    }

    let botaoEmpresa = '';
    if (s.empresa && s.tipo === 'alteracao_empresa' && s.status === 'concluido') {
      botaoEmpresa = `<a class="btn btn-primary btn-sm" href="editar.html?id=${s.empresa._id}">Registrar alteração</a>`;
    } else if (s.empresa) {
      botaoEmpresa = `<a class="btn btn-outline btn-sm" href="detalhes-empresa.html?id=${s.empresa._id}">Ver empresa</a>`;
    }

    const botoesGerente = isGerente ? `
      <button class="btn btn-outline btn-sm" onclick="abrirEdicao('${s._id}')">Editar</button>
      <button class="btn btn-danger btn-sm" onclick="excluirServico('${s._id}')">Excluir</button>
    ` : '';

    return `
      <tr>
        <td>
          <div style="font-weight:600">${escapeHtml(s.titulo)}</div>
          <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:0.1rem">${tipoLabel}</div>
          ${empresaInfo}
        </td>
        <td>${funcNome}</td>
        <td>${respNome}</td>
        <td><span class="badge badge-${s.prioridade}">${PRIORIDADE_LABEL[s.prioridade] || s.prioridade}</span></td>
        <td><span class="badge badge-${s.status}">${STATUS_LABEL[s.status] || s.status}</span></td>
        <td>${formatarData(s.createdAt)}</td>
        <td><div class="acoes">
          <button class="btn btn-outline btn-sm" onclick="abrirDetalhes('${s._id}')">Detalhes</button>
          ${botaoAssumir}${botaoEmpresa}${botoesGerente}
        </div></td>
      </tr>
    `;
  }).join('');
}

function atualizarStats(servicos) {
  document.getElementById('stat-total').textContent     = servicos.length;
  document.getElementById('stat-pendente').textContent  = servicos.filter(s => s.status === 'pendente').length;
  document.getElementById('stat-andamento').textContent = servicos.filter(s => s.status === 'em_andamento').length;
  document.getElementById('stat-concluido').textContent = servicos.filter(s => s.status === 'concluido').length;
}

function aplicarFiltros() {
  const status = document.getElementById('filtro-status').value;
  const busca  = document.getElementById('filtro-busca').value.toLowerCase();

  const filtrados = todosServicos.filter(s => {
    const matchStatus = !status || s.status === status;
    const matchBusca  = !busca
      || s.titulo.toLowerCase().includes(busca)
      || (s.funcionario && s.funcionario.nome.toLowerCase().includes(busca))
      || (s.empresa && s.empresa.nome.toLowerCase().includes(busca));
    return matchStatus && matchBusca;
  });

  renderTabela(filtrados);
}

async function carregarServicos() {
  try {
    const resp = await fetchWithAuth('/api/fila-servicos');
    if (!resp || !resp.ok) throw new Error();
    todosServicos = await resp.json();
    atualizarStats(todosServicos);
    aplicarFiltros();
  } catch {
    document.getElementById('tbody-servicos').innerHTML =
      `<tr><td colspan="7"><div class="empty-state"><p>Erro ao carregar serviços.</p></div></td></tr>`;
  }
}

async function carregarFuncionarios() {
  try {
    const resp = await fetchWithAuth('/api/funcionarios');
    if (!resp || !resp.ok) return;
    funcionariosCache = await resp.json();
    const select = document.getElementById('input-funcionario');
    funcionariosCache.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f._id;
      opt.textContent = `${f.nome} (${f.cargo || 'sem cargo'})`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Erro ao carregar funcionários:', err);
  }
}

async function carregarEmpresas() {
  try {
    const resp = await fetchWithAuth('/api/empresas?limite=2000&ordenacao=nome&direcao=asc');
    if (!resp || !resp.ok) return;
    const data = await resp.json();
    // mongoose-paginate-v2 retorna { docs: [...], ... }
    empresasCache = data.docs || data.empresas || (Array.isArray(data) ? data : []);
  } catch (err) {
    console.error('Erro ao carregar empresas:', err);
  }
}

// ── Modal de detalhes ──────────────────────────────────────────
function abrirDetalhes(id) {
  const s = todosServicos.find(x => x._id === id);
  if (!s) return;

  const isGerente = usuarioAtual && ['admin', 'gerente'].includes(usuarioAtual.role);
  const tipoLabel = TIPOS[s.tipo] || s.tipo || '–';

  const previsao = s.dataPrevisao ? formatarData(s.dataPrevisao) : '–';

  let empresaHtml = '–';
  if (s.empresa) {
    const linkEmpresa = s.tipo === 'alteracao_empresa' && s.status === 'concluido'
      ? `editar.html?id=${s.empresa._id}`
      : `detalhes-empresa.html?id=${s.empresa._id}`;
    empresaHtml = `<a href="${linkEmpresa}" style="color:var(--primary-600);text-decoration:underline">${escapeHtml(s.empresa.nome)}</a>
      <div style="font-size:0.78rem;color:var(--text-secondary)">${s.empresa.cnpj || ''}</div>`;
  } else if (s.empresaNaoCadastrada) {
    empresaHtml = `<span style="color:#b45309;font-weight:600">⚠ ${escapeHtml(s.empresaNaoCadastrada)}</span>
      <div style="font-size:0.78rem;color:var(--text-secondary)">Empresa não cadastrada no sistema</div>`;
  }

  const body = document.getElementById('detalhes-body');
  body.innerHTML = `
    <div class="detalhe-grid">
      <div class="detalhe-item full">
        <span class="detalhe-label">Título</span>
        <span class="detalhe-valor" style="font-size:1.05rem">${escapeHtml(s.titulo)}</span>
      </div>

      <div class="detalhe-item">
        <span class="detalhe-label">Tipo</span>
        <span class="detalhe-valor">${tipoLabel}</span>
      </div>

      <div class="detalhe-item">
        <span class="detalhe-label">Status</span>
        <span class="detalhe-valor"><span class="badge badge-${s.status}">${STATUS_LABEL[s.status]}</span></span>
      </div>

      <div class="detalhe-item">
        <span class="detalhe-label">Prioridade</span>
        <span class="detalhe-valor"><span class="badge badge-${s.prioridade}">${PRIORIDADE_LABEL[s.prioridade]}</span></span>
      </div>

      <div class="detalhe-item">
        <span class="detalhe-label">Previsão de conclusão</span>
        <span class="detalhe-valor">${previsao}</span>
      </div>

      <p class="detalhe-section-title">Pessoas</p>

      <div class="detalhe-item">
        <span class="detalhe-label">Funcionário relacionado</span>
        <span class="detalhe-valor">${s.funcionario ? escapeHtml(s.funcionario.nome) + (s.funcionario.cargo ? ` <span style="color:var(--text-secondary);font-size:0.82rem">(${escapeHtml(s.funcionario.cargo)})</span>` : '') : '–'}</span>
      </div>

      <div class="detalhe-item">
        <span class="detalhe-label">Responsável (assumiu)</span>
        <span class="detalhe-valor">${s.responsavel ? escapeHtml(s.responsavel.nome) : '–'}</span>
      </div>

      <div class="detalhe-item">
        <span class="detalhe-label">Criado por</span>
        <span class="detalhe-valor">${s.criadoPor ? escapeHtml(s.criadoPor.nome) : '–'}</span>
      </div>

      <div class="detalhe-item">
        <span class="detalhe-label">Criado em</span>
        <span class="detalhe-valor">${formatarData(s.createdAt)}</span>
      </div>

      ${(s.empresa || s.empresaNaoCadastrada) ? `
        <p class="detalhe-section-title">Empresa</p>
        <div class="detalhe-item full">
          <span class="detalhe-label">Empresa relacionada</span>
          <span class="detalhe-valor">${empresaHtml}</span>
        </div>
      ` : ''}

      ${s.descricao ? `
        <p class="detalhe-section-title">Descrição</p>
        <div class="detalhe-item full">
          <div class="detalhe-descricao">${escapeHtml(s.descricao)}</div>
        </div>
      ` : ''}
    </div>
  `;

  // Botões do footer
  const footer = document.getElementById('detalhes-footer');
  let botoes = `<button class="btn btn-outline" id="btn-fechar-detalhes">Fechar</button>`;

  const eResponsavel = s.responsavel && s.responsavel._id === usuarioAtual._id;
  if (!s.responsavel) {
    botoes += `<button class="btn btn-success" onclick="assumirServico('${s._id}');fecharDetalhes()">Assumir serviço</button>`;
  } else if (eResponsavel) {
    botoes += `<button class="btn btn-warning" onclick="assumirServico('${s._id}');fecharDetalhes()">Liberar serviço</button>`;
  }

  if (isGerente) {
    botoes += `<button class="btn btn-primary" onclick="fecharDetalhes();abrirEdicao('${s._id}')">Editar</button>`;
    if (s.empresa && s.tipo === 'alteracao_empresa' && s.status === 'concluido') {
      botoes += `<a class="btn btn-primary" href="editar.html?id=${s.empresa._id}">Registrar alteração</a>`;
    }
  }

  footer.innerHTML = botoes;
  document.getElementById('btn-fechar-detalhes').addEventListener('click', fecharDetalhes);

  document.getElementById('modal-detalhes').classList.add('show');
}

function fecharDetalhes() {
  document.getElementById('modal-detalhes').classList.remove('show');
}

// ── Autocomplete de empresa ────────────────────────────────────
function setupEmpresaAutocomplete() {
  const inputBusca    = document.getElementById('input-empresa-busca');
  const dropdown      = document.getElementById('empresa-resultados');
  const naoEncontrada = document.getElementById('empresa-nao-encontrada');

  const optNaoCadastradaHtml = `
    <div class="empresa-dropdown-item empresa-opt-nao-cadastrada" data-tipo="nao-cadastrada">
      <div class="empresa-nome">Empresa não cadastrada</div>
      <div class="empresa-cnpj">Prosseguir sem vínculo com cadastro</div>
    </div>`;

  inputBusca.addEventListener('input', () => {
    const termo = inputBusca.value.trim().toLowerCase();
    naoEncontrada.style.display = 'none';

    if (!termo) { dropdown.style.display = 'none'; return; }

    const resultados = empresasCache.filter(e =>
      e.nome.toLowerCase().includes(termo) ||
      (e.cnpj && e.cnpj.replace(/\D/g, '').includes(termo.replace(/\D/g, '')))
    ).slice(0, 8);

    if (!resultados.length) {
      dropdown.innerHTML = `<div class="empresa-dropdown-vazio">Nenhuma empresa encontrada.</div>` + optNaoCadastradaHtml;
      dropdown.style.display = 'block';
      naoEncontrada.style.display = 'block';
    } else {
      dropdown.innerHTML = resultados.map(e => `
        <div class="empresa-dropdown-item" data-id="${e._id}" data-nome="${escapeHtml(e.nome)}">
          <div class="empresa-nome">${escapeHtml(e.nome)}</div>
          <div class="empresa-cnpj">${e.cnpj || 'CNPJ não informado'}</div>
        </div>
      `).join('') + optNaoCadastradaHtml;
      dropdown.style.display = 'block';
    }

    dropdown.querySelectorAll('.empresa-dropdown-item[data-id]').forEach(item => {
      item.addEventListener('click', () => selecionarEmpresa(item.dataset.id, item.dataset.nome));
    });
    const optEl = dropdown.querySelector('.empresa-opt-nao-cadastrada');
    if (optEl) optEl.addEventListener('click', () => {
      const nome = inputBusca.value.trim();
      if (nome) {
        selecionarEmpresaNaoCadastrada(nome);
      } else {
        ativarModoNaoCadastrada('');
      }
    });
  });

  document.addEventListener('click', e => {
    if (!document.getElementById('grupo-empresa').contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  document.getElementById('input-nao-cadastrada-nome').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmarNaoCadastrada(); }
  });
}

function selecionarEmpresa(id, nome) {
  document.getElementById('input-empresa-id').value = id;
  document.getElementById('input-empresa-nao-cadastrada').value = '';
  document.getElementById('input-empresa-busca').value = '';
  document.getElementById('empresa-resultados').style.display = 'none';
  document.getElementById('empresa-nao-encontrada').style.display = 'none';

  const tag = document.getElementById('empresa-selecionada');
  tag.className = 'empresa-tag';
  tag.innerHTML = `<span>${escapeHtml(nome)}</span><button type="button" onclick="limparEmpresa()" title="Remover">✕</button>`;
  tag.style.display = 'flex';
}

function limparEmpresa() {
  const tipo = document.getElementById('input-tipo')?.value;
  const ehAbertura = TIPOS_ABERTURA.includes(tipo);

  document.getElementById('input-empresa-id').value = '';
  document.getElementById('input-empresa-nao-cadastrada').value = '';
  document.getElementById('input-nao-cadastrada-nome').value = '';
  document.getElementById('empresa-nao-encontrada').style.display = 'none';
  const tag = document.getElementById('empresa-selecionada');
  tag.style.display = 'none';
  tag.innerHTML = '';

  if (ehAbertura) {
    // Para abertura, mantém o input de texto visível (é o único caminho)
    document.getElementById('input-empresa-busca').style.display = 'none';
    document.getElementById('campo-nao-cadastrada').style.display = 'block';
  } else {
    document.getElementById('input-empresa-busca').style.display = '';
    document.getElementById('campo-nao-cadastrada').style.display = 'none';
  }
}

function ativarModoNaoCadastrada(nomeInicial) {
  document.getElementById('empresa-resultados').style.display = 'none';
  document.getElementById('empresa-nao-encontrada').style.display = 'none';
  document.getElementById('input-empresa-busca').style.display = 'none';
  document.getElementById('campo-nao-cadastrada').style.display = 'block';
  const inputNome = document.getElementById('input-nao-cadastrada-nome');
  inputNome.value = nomeInicial || '';
  inputNome.focus();
}

function confirmarNaoCadastrada() {
  const nome = document.getElementById('input-nao-cadastrada-nome').value.trim();
  if (!nome) { showToast('Informe o nome da empresa.', 'error'); return; }
  selecionarEmpresaNaoCadastrada(nome);
}

function cancelarNaoCadastrada() {
  const tipo = document.getElementById('input-tipo').value;
  document.getElementById('input-nao-cadastrada-nome').value = '';
  document.getElementById('input-empresa-nao-cadastrada').value = '';

  if (TIPOS_ABERTURA.includes(tipo)) {
    // Para abertura não tem para onde "voltar" — mantém o input visível e limpo
    return;
  }
  document.getElementById('campo-nao-cadastrada').style.display = 'none';
  document.getElementById('input-empresa-busca').style.display = '';
  document.getElementById('input-empresa-busca').value = '';
}

function selecionarEmpresaNaoCadastrada(nome) {
  document.getElementById('input-empresa-id').value = '';
  document.getElementById('input-empresa-nao-cadastrada').value = nome;
  document.getElementById('input-empresa-busca').value = '';
  document.getElementById('input-empresa-busca').style.display = 'none';
  document.getElementById('campo-nao-cadastrada').style.display = 'none';
  document.getElementById('empresa-resultados').style.display = 'none';
  document.getElementById('empresa-nao-encontrada').style.display = 'none';

  const tag = document.getElementById('empresa-selecionada');
  tag.className = 'empresa-tag empresa-tag-nao-cadastrada';
  tag.innerHTML = `<span>⚠ ${escapeHtml(nome)} <em style="font-size:0.75rem;font-weight:400">(não cadastrada)</em></span><button type="button" onclick="limparEmpresa()" title="Remover">✕</button>`;
  tag.style.display = 'flex';
}

function toggleGrupoEmpresa(tipo) {
  const mostrar = TIPOS_COM_EMPRESA.includes(tipo);
  const grupoEl = document.getElementById('grupo-empresa');
  const labelEl = grupoEl.querySelector('label');

  grupoEl.style.display = mostrar ? 'block' : 'none';
  if (!mostrar) { limparEmpresa(); return; }

  if (TIPOS_ABERTURA.includes(tipo)) {
    labelEl.textContent = 'Nome da empresa a ser aberta';
    document.getElementById('input-nao-cadastrada-nome').placeholder = 'Nome da empresa a ser aberta...';
    // Vai direto para o input de texto — empresa ainda não existe no banco
    document.getElementById('input-empresa-busca').style.display = 'none';
    document.getElementById('empresa-selecionada').style.display = 'none';
    document.getElementById('campo-nao-cadastrada').style.display = 'block';
  } else {
    labelEl.textContent = 'Empresa relacionada';
    document.getElementById('input-nao-cadastrada-nome').placeholder = 'Nome da empresa não cadastrada...';
    document.getElementById('input-empresa-busca').style.display = '';
  }
}

// ── Modal criar/editar ─────────────────────────────────────────
function abrirModal(titulo) {
  document.getElementById('modal-titulo').textContent = titulo;
  document.getElementById('modal-servico').classList.add('show');
}

function fecharModal() {
  document.getElementById('modal-servico').classList.remove('show');
  document.getElementById('servico-id').value = '';
  document.getElementById('input-tipo').value = 'alteracao_empresa';
  document.getElementById('input-titulo').value = '';
  document.getElementById('input-descricao').value = '';
  document.getElementById('input-funcionario').value = '';
  document.getElementById('input-prioridade').value = 'normal';
  document.getElementById('input-status').value = 'pendente';
  document.getElementById('input-previsao').value = '';
  limparEmpresa();
  document.getElementById('input-empresa-busca').value = '';
  document.getElementById('empresa-resultados').style.display = 'none';
  toggleGrupoEmpresa('alteracao_empresa');
}

function abrirEdicao(id) {
  const s = todosServicos.find(x => x._id === id);
  if (!s) return;

  document.getElementById('servico-id').value   = s._id;
  document.getElementById('input-tipo').value   = s.tipo || 'outro';
  document.getElementById('input-titulo').value = s.titulo;
  document.getElementById('input-descricao').value = s.descricao || '';
  document.getElementById('input-funcionario').value = s.funcionario ? s.funcionario._id : '';
  document.getElementById('input-prioridade').value  = s.prioridade;
  document.getElementById('input-status').value      = s.status;
  document.getElementById('input-previsao').value    = s.dataPrevisao
    ? new Date(s.dataPrevisao).toISOString().split('T')[0] : '';

  toggleGrupoEmpresa(s.tipo);
  if (s.empresa) {
    selecionarEmpresa(s.empresa._id, s.empresa.nome);
  } else if (s.empresaNaoCadastrada) {
    selecionarEmpresaNaoCadastrada(s.empresaNaoCadastrada);
  }

  abrirModal('Editar Serviço');
}

async function salvarServico() {
  const id    = document.getElementById('servico-id').value;
  const tipo  = document.getElementById('input-tipo').value;
  const titulo = document.getElementById('input-titulo').value.trim();

  if (!titulo) { showToast('O título é obrigatório.', 'error'); return; }

  const empresaId = document.getElementById('input-empresa-id').value;
  const empresaNaoCadastrada = document.getElementById('input-empresa-nao-cadastrada').value.trim();

  if (TIPOS_ABERTURA.includes(tipo)) {
    if (!empresaNaoCadastrada) {
      showToast('Informe o nome da empresa a ser aberta.', 'error'); return;
    }
  } else if (TIPOS_COM_EMPRESA.includes(tipo) && !empresaId && !empresaNaoCadastrada) {
    showToast('Selecione a empresa ou informe o nome da empresa não cadastrada.', 'error'); return;
  }

  const payload = {
    tipo,
    titulo,
    descricao:            document.getElementById('input-descricao').value.trim(),
    empresa:              empresaId || null,
    empresaNaoCadastrada: empresaNaoCadastrada || null,
    funcionario:          document.getElementById('input-funcionario').value || null,
    prioridade:           document.getElementById('input-prioridade').value,
    status:               document.getElementById('input-status').value,
    dataPrevisao:         document.getElementById('input-previsao').value || null
  };

  const btn = document.getElementById('btn-salvar-servico');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const url    = id ? `/api/fila-servicos/${id}` : '/api/fila-servicos';
    const method = id ? 'PUT' : 'POST';
    const resp   = await fetchWithAuth(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!resp || !resp.ok) {
      const data = resp ? await resp.json().catch(() => ({})) : {};
      throw new Error(data.msg || data.errors?.[0]?.msg || 'Erro ao salvar serviço');
    }

    showToast(id ? 'Serviço atualizado!' : 'Serviço criado!', 'success');
    fecharModal();
    await carregarServicos();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar';
  }
}

async function assumirServico(id) {
  try {
    const resp = await fetchWithAuth(`/api/fila-servicos/${id}/assumir`, { method: 'PUT' });
    if (!resp || !resp.ok) {
      const data = resp ? await resp.json().catch(() => ({})) : {};
      throw new Error(data.msg || 'Erro ao assumir serviço');
    }
    showToast('Serviço atualizado!', 'success');
    await carregarServicos();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function excluirServico(id) {
  const confirmado = await openConfirmModal('Tem certeza que deseja excluir este serviço?', {
    requireTyped: false,
    title: 'Excluir Serviço'
  });
  if (!confirmado) return;

  try {
    const resp = await fetchWithAuth(`/api/fila-servicos/${id}`, { method: 'DELETE' });
    if (!resp || !resp.ok) throw new Error('Erro ao excluir serviço');
    showToast('Serviço excluído.', 'success');
    await carregarServicos();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Init ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const resp = await fetchWithAuth('/api/auth');
    if (!resp || !resp.ok) throw new Error('Não autenticado');
    usuarioAtual = await resp.json();
    await createHeader('header-placeholder', usuarioAtual);

    const isGerente = ['admin', 'gerente'].includes(usuarioAtual.role);

    if (isGerente) {
      document.getElementById('btn-novo-servico').style.display = 'inline-flex';
      await Promise.all([carregarFuncionarios(), carregarEmpresas()]);
    }

    await carregarServicos();

    // Filtros
    document.getElementById('filtro-status').addEventListener('change', aplicarFiltros);
    document.getElementById('filtro-busca').addEventListener('input', aplicarFiltros);

    // Tipo → mostrar/ocultar campo de empresa + preencher título
    document.getElementById('input-tipo').addEventListener('change', e => {
      toggleGrupoEmpresa(e.target.value);
      const inputTitulo = document.getElementById('input-titulo');
      if (!inputTitulo.value) inputTitulo.value = TIPOS[e.target.value] || '';
    });

    // Autocomplete de empresa
    setupEmpresaAutocomplete();

    // Modal criar/editar
    document.getElementById('btn-novo-servico').addEventListener('click', () => {
      fecharModal();
      document.getElementById('input-titulo').value = TIPOS['alteracao_empresa'];
      toggleGrupoEmpresa('alteracao_empresa');
      abrirModal('Novo Serviço');
    });
    document.getElementById('modal-fechar').addEventListener('click', fecharModal);
    document.getElementById('btn-cancelar-modal').addEventListener('click', fecharModal);
    document.getElementById('btn-salvar-servico').addEventListener('click', salvarServico);
    document.getElementById('modal-servico').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-servico')) fecharModal();
    });

    // Modal detalhes
    document.getElementById('detalhes-fechar').addEventListener('click', fecharDetalhes);
    document.getElementById('modal-detalhes').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-detalhes')) fecharDetalhes();
    });

  } catch (err) {
    console.error(err);
    localStorage.removeItem('token');
    window.location.replace('login.html');
  }
});
