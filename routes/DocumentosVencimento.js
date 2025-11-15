import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // ADICIONADO: Importa o componente de Link para navegação.

// Componente reutilizável para renderizar a tabela de documentos
const TabelaDocumentos = ({ titulo, documentos, isVencido = false }) => (
  <div style={{ marginBottom: '40px' }}>
    <h2 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
      {titulo} <span style={{ backgroundColor: isVencido ? '#dc3545' : '#ffc107', color: isVencido ? 'white' : 'black', padding: '3px 8px', borderRadius: '5px', fontSize: '0.9em' }}>{documentos.length}</span>
    </h2>
    {documentos.length > 0 ? (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8f9fa' }}>
            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Empresa</th>
            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>CNPJ</th>
            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Documento</th>
            <th style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'left' }}>Data de Vencimento</th>
          </tr>
        </thead>
        <tbody>
          {documentos.map((doc, index) => (
            <tr key={`${doc.empresaId}-${doc.documentoNome}-${index}`} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#f8f9fa' }}>
              {/* CORREÇÃO: O nome da empresa agora é um link para a página de edição. */}
              <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                <Link to={`/empresas/editar/${doc.empresaId}`} style={{ textDecoration: 'none', color: '#007bff' }}>{doc.empresaNome}</Link>
              </td>
              <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>{doc.empresaCnpj}</td>
              <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>{doc.documentoNome}</td>
              <td style={{ padding: '12px', border: '1px solid #dee2e6', color: isVencido ? '#dc3545' : 'inherit', fontWeight: 'bold' }}>
                {new Date(doc.dataValidade).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <p>Nenhum documento encontrado nesta categoria.</p>
    )}
  </div>
);

// Componente principal da página
function PaginaDocumentosVencimento() {
  const [vencidos, setVencidos] = useState([]);
  const [aVencer, setAVencer] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDocumentos = async () => {
      try {
        // Pega o token do localStorage para autenticação
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Usuário não autenticado. Faça o login novamente.');
        }

        const response = await fetch('/api/empresas/documentos-a-vencer', {
          headers: {
            'x-auth-token': token, // Envia o token no header
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.msg || 'Falha ao buscar os dados dos documentos.');
        }

        const data = await response.json();
        
        // Ordena os documentos por data (mais antigos primeiro)
        const sortByDate = (a, b) => new Date(a.dataValidade) - new Date(b.dataValidade);
        
        setVencidos(data.vencidos.sort(sortByDate));
        setAVencer(data.aVencer.sort(sortByDate));

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentos();
  }, []); // O array vazio [] garante que o useEffect execute apenas uma vez, ao montar o componente.

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>Carregando documentos...</div>;
  }

  if (error) {
    return <div style={{ color: '#721c24', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', padding: '15px', borderRadius: '5px' }}>
      <strong>Erro:</strong> {error}
    </div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: '30px' }}>Controle de Vencimentos de Documentos</h1>
      
      {/* Seção de Documentos Vencidos */}
      <TabelaDocumentos titulo="Documentos Vencidos" documentos={vencidos} isVencido={true} />
      
      {/* Seção de Documentos a Vencer */}
      <TabelaDocumentos titulo="Documentos a Vencer (Próximos 30 dias)" documentos={aVencer} />
    </div>
  );
}

export default PaginaDocumentosVencimento;