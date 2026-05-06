# refatorar-htmls.ps1 - Script para refatorar todos os HTMLs restantes

$arquivos = @(
    'admin-dashboard.html',
    'cadastrar-empresa.html',
    'cliente-formulario.html',
    'configuracao-empresa.html',
    'detalhes-empresa.html',
    'documentos-vencendo.html',
    'editar.html',
    'enviar-notificacoes.html',
    'faturamento.html',
    'funcionarios-pagamentos.html',
    'logs.html',
    'mensalidades.html',
    'meus-pagamentos.html',
    'notificacoes.html',
    'relatorios.html',
    'user-management.html'
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " REFATORACAO AUTOMATIZADA DE HTMLs" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$total = $arquivos.Count
$contador = 0

foreach ($arquivo in $arquivos) {
    $contador++
    $nomeBase = $arquivo -replace '\.html$', ''
    $caminhoHtml = "client\$arquivo"
    $caminhoCss = "client\css\$nomeBase.css"
    $caminhoJs = "client\js\pages\$nomeBase.js"
    
    Write-Host "[$contador/$total] Processando: $arquivo" -ForegroundColor Yellow
    
    if (!(Test-Path $caminhoHtml)) {
        Write-Host "  ⚠ Arquivo nao encontrado, pulando..." -ForegroundColor Red
        continue
    }
    
    # Ler o HTML completo
    $conteudo = Get-Content $caminhoHtml -Raw
    
    # Verificar se tem <style> inline
    $temStyle = $conteudo -match '(?s)<style>(.*?)</style>'
    $cssInline = if ($matches) { $matches[1].Trim() } else { '' }
    
    # Verificar se tem <script> inline (exceto o de bloqueio)
    $temScriptGrande = $conteudo -match '(?s)<script>\s*(let|const|var|function|document\.addEventListener).*?</script>'
    $jsInline = if ($matches) { $matches[0] } else { ''  }
    
    if ($temStyle) {
        Write-Host "  → Extraindo CSS ($($cssInline.Length) caracteres)..." -ForegroundColor Green
        
        # Salvar CSS em arquivo
        $cssInline | Out-File -FilePath $caminhoCss -Encoding UTF8
        
        # Remover <style> do HTML
        $conteudo = $conteudo -replace '(?s)<style>.*?</style>', ''
    }
    
    if ($temScriptGrande) {
        Write-Host "  → Extraindo JavaScript ($($jsInline.Length) caracteres)..." -ForegroundColor Green
        
        # Extrair conteudo do script (sem as tags)
        $jsContent = $jsInline -replace '<script>', '' -replace '</script>', ''
        $jsContent | Out-File -FilePath $caminhoJs -Encoding UTF8
        
        # Remover script grande do HTML (manter apenas o de bloqueio)
        $conteudo = $conteudo -replace '(?s)<script>\s*(let|const|var|function|document\.addEventListener).*?</script>', ''
    }
    
    # Adicionar links CSS no <head> se não existirem
    if ($temStyle -and $conteudo -notmatch 'css/global\.css') {
        $conteudo = $conteudo -replace '(<meta name="viewport"[^>]*>)', "`$1`n  <link rel=`"stylesheet`" href=`"css/global.css`">`n  <link rel=`"stylesheet`" href=`"css/components.css`">`n  <link rel=`"stylesheet`" href=`"css/$nomeBase.css`">"
    }
    
    # Adicionar script JS antes do </body> se não existir
    if ($temScriptGrande -and $conteudo -notmatch "js/pages/$nomeBase\.js") {
        $conteudo = $conteudo -replace '</body>', "  <script src=`"js/pages/$nomeBase.js`"></script>`n</body>"
    }
    
    # Salvar HTML refatorado
    $conteudo | Out-File -FilePath $caminhoHtml -Encoding UTF8
    
    Write-Host "  ✓ Concluido!" -ForegroundColor Green
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " REFATORACAO CONCLUIDA: $total arquivos" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
