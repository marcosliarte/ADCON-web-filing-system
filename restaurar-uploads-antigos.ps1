# Script para restaurar arquivos das pastas uploads_old de volta para uploads
# Este script copia arquivos das pastas uploads_old_* sem sobrescrever arquivos existentes

$rootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$uploadsPath = Join-Path $rootPath "uploads"
$uploadsOldFolders = Get-ChildItem -Path $rootPath -Directory -Filter "uploads_old_*"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESTAURAÇÃO DE UPLOADS ANTIGOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($uploadsOldFolders.Count -eq 0) {
    Write-Host "Nenhuma pasta uploads_old_* encontrada." -ForegroundColor Yellow
    Write-Host "Nada a fazer."
    exit
}

Write-Host "Encontradas $($uploadsOldFolders.Count) pasta(s) de uploads antigas:" -ForegroundColor Green
foreach ($folder in $uploadsOldFolders) {
    Write-Host "  - $($folder.Name)" -ForegroundColor Gray
}
Write-Host ""

$response = Read-Host "Deseja restaurar os arquivos dessas pastas para 'uploads'? (S/N)"
if ($response -ne 'S' -and $response -ne 's') {
    Write-Host "Operação cancelada." -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "Iniciando restauração..." -ForegroundColor Cyan
Write-Host ""

$totalCopiados = 0
$totalIgnorados = 0

function Copy-FilesRecursive {
    param(
        [string]$Source,
        [string]$Destination
    )
    
    if (-not (Test-Path $Destination)) {
        New-Item -Path $Destination -ItemType Directory -Force | Out-Null
    }
    
    $items = Get-ChildItem -Path $Source -Recurse
    
    foreach ($item in $items) {
        $relativePath = $item.FullName.Substring($Source.Length)
        $destPath = Join-Path $Destination $relativePath
        
        if ($item.PSIsContainer) {
            if (-not (Test-Path $destPath)) {
                New-Item -Path $destPath -ItemType Directory -Force | Out-Null
            }
        } else {
            if (Test-Path $destPath) {
                Write-Host "  [IGNORADO] $relativePath (já existe)" -ForegroundColor Yellow
                $script:totalIgnorados++
            } else {
                Copy-Item -Path $item.FullName -Destination $destPath -Force
                Write-Host "  [COPIADO] $relativePath" -ForegroundColor Green
                $script:totalCopiados++
            }
        }
    }
}

foreach ($oldFolder in $uploadsOldFolders) {
    Write-Host "Processando: $($oldFolder.Name)" -ForegroundColor Cyan
    Copy-FilesRecursive -Source $oldFolder.FullName -Destination $uploadsPath
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RESUMO DA RESTAURAÇÃO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Arquivos copiados: $totalCopiados" -ForegroundColor Green
Write-Host "Arquivos ignorados (já existentes): $totalIgnorados" -ForegroundColor Yellow
Write-Host ""

$deleteOld = Read-Host "Deseja DELETAR as pastas uploads_old_* agora? (S/N)"
if ($deleteOld -eq 'S' -or $deleteOld -eq 's') {
    Write-Host ""
    Write-Host "Deletando pastas antigas..." -ForegroundColor Yellow
    foreach ($oldFolder in $uploadsOldFolders) {
        Remove-Item -Path $oldFolder.FullName -Recurse -Force
        Write-Host "  - Deletado: $($oldFolder.Name)" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Pastas antigas deletadas com sucesso!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Pastas antigas mantidas. Você pode deletá-las manualmente depois." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Processo concluído!" -ForegroundColor Green
Write-Host ""
