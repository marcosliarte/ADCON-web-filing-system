// Teste rápido da configuração
console.log('🔧 Config test - API_BASE_URL:', API_BASE_URL);

// Teste da função fetchWithAuth
async function testFetch() {
    console.log('🧪 Testing fetchWithAuth...');
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/api/auth/admin/users`);
        console.log('✅ fetchWithAuth worked:', response.status);
        if (response.ok) {
            const data = await response.json();
            console.log('📦 Data received:', data);
        }
    } catch (error) {
        console.error('❌ fetchWithAuth failed:', error);
    }
}

// Executar teste se estiver na página de user-management
if (window.location.pathname.includes('user-management.html')) {
    console.log('🎯 On user-management page, running test...');
    testFetch();
}