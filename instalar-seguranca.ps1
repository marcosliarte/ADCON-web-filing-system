# Script de instalação das melhorias de segurança
# Execute com: .\instalar-seguranca.ps1

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "  INSTALAÇÃO DE MELHORIAS DE SEGURANÇA" -ForegroundColor Cyan
Write-Host "  ADCON Web Filing System" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Instalar dependências
Write-Host "`n[1/5] Instalando dependências de segurança..." -ForegroundColor Yellow
npm install helmet express-mongo-sanitize express-rate-limit cors dotenv --save

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao instalar dependências!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependências instaladas com sucesso!" -ForegroundColor Green

# 2. Gerar JWT_SECRET forte
Write-Host "`n[2/5] Gerando JWT_SECRET forte..." -ForegroundColor Yellow
$jwtSecret = node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
Write-Host "✅ JWT_SECRET gerado:" -ForegroundColor Green
Write-Host "   $jwtSecret" -ForegroundColor Cyan
Write-Host "   ⚠️  COPIE e salve este valor com segurança!" -ForegroundColor Yellow

# 3. Verificar se .env existe
Write-Host "`n[3/5] Verificando arquivo .env..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✅ Arquivo .env encontrado" -ForegroundColor Green
    Write-Host "   ⚠️  Você deve atualizar manualmente:" -ForegroundColor Yellow
    Write-Host "      - JWT_SECRET com o valor gerado acima" -ForegroundColor Yellow
    Write-Host "      - Trocar senha do MongoDB Atlas (foi exposta!)" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  Arquivo .env não encontrado!" -ForegroundColor Yellow
    Write-Host "   Criando a partir do .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Arquivo .env criado!" -ForegroundColor Green
    Write-Host "   ⚠️  IMPORTANTE: Edite o .env e configure:" -ForegroundColor Yellow
    Write-Host "      - JWT_SECRET (copie o valor gerado acima)" -ForegroundColor Yellow
    Write-Host "      - MONGODB_URI com suas credenciais" -ForegroundColor Yellow
}

# 4. Verificar .gitignore
Write-Host "`n[4/5] Verificando .gitignore..." -ForegroundColor Yellow
if (Test-Path ".gitignore") {
    $gitignoreContent = Get-Content ".gitignore" -Raw
    if ($gitignoreContent -match "\.env") {
        Write-Host "✅ .env já está no .gitignore" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Adicionando .env ao .gitignore..." -ForegroundColor Yellow
        Add-Content ".gitignore" "`n# Environment variables`n.env`n"
        Write-Host "✅ .env adicionado ao .gitignore" -ForegroundColor Green
    }
} else {
    Write-Host "❌ .gitignore não encontrado!" -ForegroundColor Red
}

# 5. Auditar vulnerabilidades
Write-Host "`n[5/5] Auditando vulnerabilidades..." -ForegroundColor Yellow
npm audit

# Resumo final
Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "  ✅ INSTALAÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan

Write-Host "`n⚠️  AÇÕES MANUAIS NECESSÁRIAS:" -ForegroundColor Yellow
Write-Host "   1. Edite o arquivo .env e adicione:" -ForegroundColor White
Write-Host "      JWT_SECRET=$jwtSecret" -ForegroundColor Cyan
Write-Host "`n   2. Troque a senha do MongoDB Atlas:" -ForegroundColor White
Write-Host "      - Acesse https://cloud.mongodb.com" -ForegroundColor Cyan
Write-Host "      - Database Access → Editar usuário" -ForegroundColor Cyan
Write-Host "      - Altere a senha imediatamente!" -ForegroundColor Cyan
Write-Host "`n   3. Atualize MONGODB_URI no .env com a nova senha" -ForegroundColor White
Write-Host "`n   4. NUNCA faça commit do arquivo .env!" -ForegroundColor White

Write-Host "`n📚 DOCUMENTAÇÃO:" -ForegroundColor Yellow
Write-Host "   - Leia SEGURANÇA.md para guia completo" -ForegroundColor Cyan
Write-Host "   - Leia REFATORACAO-RESUMO.md para detalhes técnicos" -ForegroundColor Cyan

Write-Host "`n🚀 Para iniciar o servidor:" -ForegroundColor Yellow
Write-Host "   node server.js" -ForegroundColor Cyan

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host ""
