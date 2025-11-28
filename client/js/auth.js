/* ========================================
   AUTHENTICATION UTILITIES
   ======================================== */

/**
 * Classe para gerenciar autenticação
 */
class Auth {
    /**
     * Verifica se usuário está autenticado
     */
    static isAuthenticated() {
        return !!localStorage.getItem('token');
    }

    /**
     * Obter token
     */
    static getToken() {
        return localStorage.getItem('token');
    }

    /**
     * Salvar token
     */
    static setToken(token) {
        localStorage.setItem('token', token);
    }

    /**
     * Remover token (logout)
     */
    static removeToken() {
        localStorage.removeItem('token');
    }

    /**
     * Decodificar JWT (sem verificação)
     */
    static decodeToken(token) {
        try {
            const payload = token.split('.')[1];
            const decoded = atob(payload);
            return JSON.parse(decoded);
        } catch (error) {
            console.error('Erro ao decodificar token:', error);
            return null;
        }
    }

    /**
     * Obter dados do usuário do token
     */
    static getUserFromToken() {
        const token = this.getToken();
        if (!token) return null;

        const decoded = this.decodeToken(token);
        return decoded ? decoded.usuario : null;
    }

    /**
     * Verificar se token expirou
     */
    static isTokenExpired() {
        const token = this.getToken();
        if (!token) return true;

        const decoded = this.decodeToken(token);
        if (!decoded || !decoded.exp) return true;

        const now = Date.now() / 1000;
        return decoded.exp < now;
    }

    /**
     * Verificar se usuário é admin
     */
    static isAdmin() {
        const user = this.getUserFromToken();
        return user && user.role === 'admin';
    }

    /**
     * Verificar se usuário é gerente
     */
    static isGerente() {
        const user = this.getUserFromToken();
        return user && user.role === 'gerente';
    }

    /**
     * Fazer logout
     */
    static logout() {
        this.removeToken();
        window.location.href = '/login.html';
    }

    /**
     * Proteger página (redirecionar se não autenticado)
     */
    static protectPage() {
        if (!this.isAuthenticated() || this.isTokenExpired()) {
            this.logout();
            return false;
        }
        return true;
    }

    /**
     * Proteger página de admin
     */
    static protectAdminPage() {
        if (!this.protectPage()) return false;

        if (!this.isAdmin()) {
            alert('Acesso negado. Apenas administradores podem acessar esta página.');
            window.location.href = '/home.html';
            return false;
        }

        return true;
    }
}

// Exportar para uso global
window.Auth = Auth;
