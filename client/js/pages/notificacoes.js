// === notificacoes.js ===
// Lógica da página de notificações

let notificacoes = [];

// === INICIALIZAÇÃO ===
document.addEventListener('DOMContentLoaded', async () => {
    const userResponse = await fetchWithAuth('/api/auth');
    if (!userResponse) return;

    const usuario = await userResponse.json();
    createHeader('header-placeholder', usuario);
    
    document.body.style.display = 'block';
    
    carregarNotificacoes();
    setupEventListeners();
});

// === CARREGAR NOTIFICAÇÕES ===
async function carregarNotificacoes() {
    try {
        const tipo = document.getElementById('filterTipo').value;
        const lida = document.getElementById('filterLida').value;
        
        let url = '/api/notificacoes?limit=100';
        if (tipo) url += `&tipo=${tipo}`;
        if (lida) url += `&lida=${lida}`;

        const response = await fetchWithAuth(url);
        if (!response.ok) throw new Error('Falha ao carregar notificações');

        const data = await response.json();
        notificacoes = data.notificacoes;
        
        renderizarNotificacoes();
    } catch (err) {
        console.error(err);
        document.getElementById('notificationContainer').innerHTML = 
            '<div class="empty-state"><div class="empty-state-icon">❌</div><p>Erro ao carregar notificações</p></div>';
    }
}

// === RENDERIZAR NOTIFICAÇÕES ===
function renderizarNotificacoes() {
    const container = document.getElementById('notificationContainer');
    
    if (notificacoes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔔</div>
                <p>Nenhuma notificação encontrada</p>
            </div>
        `;
        return;
    }

    const icones = {
        'documento_vencendo': '⏰',
        'documento_vencido': '⚠️',
        'pagamento_recebido': '💰',
        'mensagem_admin': '📢',
        'sistema': 'ℹ️'
    };

    const tipoNomes = {
        'documento_vencendo': 'Doc. Vencendo',
        'documento_vencido': 'Doc. Vencido',
        'pagamento_recebido': 'Pagamento',
        'mensagem_admin': 'Mensagem',
        'sistema': 'Sistema'
    };

    container.innerHTML = notificacoes.map(n => {
        const tempo = formatarTempoCompleto(new Date(n.createdAt));
        const icone = icones[n.tipo] || '📌';
        const unreadClass = n.lida ? '' : 'unread';
        const tipoClass = `tipo-${n.tipo}`;
        const tipoNome = tipoNomes[n.tipo] || escapeHtml(n.tipo);

        return `
            <div class="notification-card ${unreadClass}" data-id="${escapeHtml(n._id)}" data-link="${escapeHtml(n.link || '')}" data-lida="${n.lida}">
                <div class="notification-icon">${icone}</div>
                <div class="notification-content">
                    <div class="notification-title">
                        ${escapeHtml(n.titulo)}
                        <span class="tipo-badge ${tipoClass}">${tipoNome}</span>
                    </div>
                    <div class="notification-message">${escapeHtml(n.mensagem)}</div>
                    <div class="notification-meta">
                        <span class="notification-time">${tempo}</span>
                        <div class="notification-actions">
                            ${!n.lida ? `<button class="btn-marcar-lida" data-id="${escapeHtml(n._id)}">✓ Marcar como lida</button>` : ''}
                            <button class="btn-delete btn-excluir-notif" data-id="${escapeHtml(n._id)}">🗑️ Excluir</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// === ABRIR NOTIFICAÇÃO ===
async function abrirNotificacaoCompleta(id, link, jaLida) {
    if (!jaLida) {
        await marcarComoLida(id);
    }
    
    const isValidLink = link && link !== '' && link !== 'null' && (link.includes('.html') || link.startsWith('http'));
    if (isValidLink) {
        window.location.href = link;
    }
}

// === MARCAR COMO LIDA ===
async function marcarComoLida(id) {
    try {
        const response = await fetchWithAuth(`/api/notificacoes/${id}/ler`, { method: 'PUT' });
        if (!response.ok) throw new Error('Falha ao marcar como lida');
        
        const notif = notificacoes.find(n => n._id === id);
        if (notif) notif.lida = true;
        
        renderizarNotificacoes();
        updateNotificationBadge();
    } catch (err) {
        showToast('Erro ao marcar notificação como lida', 'error');
    }
}

// === EXCLUIR NOTIFICAÇÃO ===
async function excluirNotificacao(id) {
    if (!confirm('Deseja realmente excluir esta notificação?')) return;
    
    try {
        const response = await fetchWithAuth(`/api/notificacoes/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Falha ao excluir');
        
        notificacoes = notificacoes.filter(n => n._id !== id);
        renderizarNotificacoes();
        updateNotificationBadge();
        showToast('Notificação excluída', 'success');
    } catch (err) {
        showToast('Erro ao excluir notificação', 'error');
    }
}

// === MARCAR TODAS COMO LIDAS ===
async function marcarTodasComoLidas() {
    try {
        const response = await fetchWithAuth('/api/notificacoes/ler-todas', { method: 'PUT' });
        if (!response.ok) throw new Error('Falha ao marcar todas como lidas');
        
        showToast('Todas as notificações foram marcadas como lidas', 'success');
        carregarNotificacoes();
        updateNotificationBadge();
    } catch (err) {
        showToast('Erro ao marcar notificações como lidas', 'error');
    }
}

// === LIMPAR LIDAS ===
async function limparNotificacoesLidas() {
    if (!confirm('Deseja excluir todas as notificações já lidas?')) return;
    
    try {
        const response = await fetchWithAuth('/api/notificacoes/limpar/lidas', { method: 'DELETE' });
        if (!response.ok) throw new Error('Falha ao limpar');
        
        showToast('Notificações lidas excluídas com sucesso', 'success');
        carregarNotificacoes();
    } catch (err) {
        showToast('Erro ao limpar notificações', 'error');
    }
}

// === FILTROS ===
function aplicarFiltros() {
    carregarNotificacoes();
}

// === FORMATAÇÃO ===
function formatarTempoCompleto(data) {
    const agora = new Date();
    const diff = Math.floor((agora - data) / 1000);
    
    if (diff < 60) return 'Agora mesmo';
    if (diff < 3600) return `Há ${Math.floor(diff / 60)} minuto(s)`;
    if (diff < 86400) return `Há ${Math.floor(diff / 3600)} hora(s)`;
    if (diff < 604800) return `Há ${Math.floor(diff / 86400)} dia(s)`;
    
    return data.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// === EVENT LISTENERS ===
function setupEventListeners() {
    // Botões de ação principais
    const btnFiltrar = document.getElementById('btnFiltrar');
    const btnMarcarLidas = document.getElementById('btnMarcarLidas');
    const btnLimparLidas = document.getElementById('btnLimparLidas');
    
    if (btnFiltrar) btnFiltrar.addEventListener('click', aplicarFiltros);
    if (btnMarcarLidas) btnMarcarLidas.addEventListener('click', marcarTodasComoLidas);
    if (btnLimparLidas) btnLimparLidas.addEventListener('click', limparNotificacoesLidas);
    
    // Event delegation para notificações dinâmicas
    document.addEventListener('click', (e) => {
        // Clicar no card
        const card = e.target.closest('.notification-card');
        if (card && !e.target.closest('.notification-actions')) {
            const id = card.getAttribute('data-id');
            const link = card.getAttribute('data-link');
            const lida = card.getAttribute('data-lida') === 'true';
            abrirNotificacaoCompleta(id, link, lida);
            return;
        }
        
        // Marcar como lida
        if (e.target.classList.contains('btn-marcar-lida')) {
            e.stopPropagation();
            const id = e.target.getAttribute('data-id');
            marcarComoLida(id);
            return;
        }
        
        // Excluir
        if (e.target.classList.contains('btn-excluir-notif')) {
            e.stopPropagation();
            const id = e.target.getAttribute('data-id');
            excluirNotificacao(id);
            return;
        }
    });
}
