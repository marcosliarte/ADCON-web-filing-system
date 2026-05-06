/* ========================================
   UTILITY FUNCTIONS - Helper functions
   ======================================== */

/**
 * Formatar data para pt-BR
 */
function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR');
}

/**
 * Formatar data e hora
 */
function formatDateTime(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString('pt-BR');
}

/**
 * Formatar moeda
 */
function formatCurrency(value) {
    if (value === null || value === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

/**
 * Formatar CNPJ
 */
function formatCNPJ(cnpj) {
    if (!cnpj) return '';
    cnpj = cnpj.replace(/\D/g, '');
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Formatar telefone
 */
function formatPhone(phone) {
    if (!phone) return '';
    phone = phone.replace(/\D/g, '');
    if (phone.length === 11) {
        return phone.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    }
    return phone.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
}

/**
 * Debounce - atrasar execução de função
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Mostrar toast/notificação
 */
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 15px 20px;
        background-color: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Confirmar ação
 */
async function confirm(message, title = 'Confirmar') {
    return new Promise((resolve) => {
        const result = window.confirm(`${title}\n\n${message}`);
        resolve(result);
    });
}

/**
 * Validar email
 */
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

/**
 * Validar CNPJ
 */
function isValidCNPJ(cnpj) {
    cnpj = cnpj.replace(/\D/g, '');
    
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1+$/.test(cnpj)) return false;
    
    // Validação dos dígitos verificadores
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado != digitos.charAt(0)) return false;
    
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado != digitos.charAt(1)) return false;
    
    return true;
}

/**
 * Escapar HTML (prevenir XSS)
 */
function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Truncar texto
 */
function truncate(text, length = 50) {
    if (!text || text.length <= length) return text;
    return text.substring(0, length) + '...';
}

/**
 * Gerar ID aleatório
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Calcular tempo relativo (ex: "há 2 horas")
 */
function timeAgo(date) {
    if (!date) return '';
    
    const now = new Date();
    const past = new Date(date);
    const diff = Math.floor((now - past) / 1000); // segundos
    
    if (diff < 60) return 'agora';
    if (diff < 3600) return `há ${Math.floor(diff / 60)} minutos`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)} horas`;
    if (diff < 2592000) return `há ${Math.floor(diff / 86400)} dias`;
    if (diff < 31536000) return `há ${Math.floor(diff / 2592000)} meses`;
    return `há ${Math.floor(diff / 31536000)} anos`;
}

/**
 * Copiar texto para clipboard
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copiado para a área de transferência!', 'success');
        return true;
    } catch (error) {
        console.error('Erro ao copiar:', error);
        showToast('Erro ao copiar texto', 'error');
        return false;
    }
}

/**
 * Download de arquivo
 */
function downloadFile(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Sanitizar filename (remover caracteres perigosos)
 */
function sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
}

/**
 * Verificar se arquivo é imagem
 */
function isImageFile(filename) {
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    return imageExtensions.test(filename);
}

/**
 * Verificar se arquivo é PDF
 */
function isPDFFile(filename) {
    return /\.pdf$/i.test(filename);
}

/**
 * Formatar tamanho de arquivo
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Animar número (contagem animada)
 */
function animateNumber(element, target, duration = 1000) {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
}

// Exportar funções globalmente
window.utils = {
    formatDate,
    formatDateTime,
    formatCurrency,
    formatCNPJ,
    formatPhone,
    debounce,
    showToast,
    confirm,
    isValidEmail,
    isValidCNPJ,
    escapeHTML,
    truncate,
    generateId,
    timeAgo,
    copyToClipboard,
    downloadFile,
    sanitizeFilename,
    isImageFile,
    isPDFFile,
    formatFileSize,
    animateNumber,
};
