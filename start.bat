@echo off
title ADCON - Sistema
color 0A

cd /d "%~dp0"

:: ── Configurações ──────────────────────────────
set DOMAIN=adcon
set PORT=3000

:: Le PORT do .env se existir
for /f "tokens=1,2 delims==" %%a in (.env) do (
    if "%%a"=="PORT" set PORT=%%b
)
:: ───────────────────────────────────────────────

echo.
echo  ==========================================
echo   ADCON - Iniciando em http://%DOMAIN%:%PORT%
echo  ==========================================
echo.

:: Verifica se esta rodando como Administrador
net session >nul 2>nul
if %errorlevel% neq 0 (
    echo  Solicitando permissao de Administrador...
    set "SELF=%~f0"
    set "DIR=%~dp0"
    powershell -NoProfile -Command "Start-Process -FilePath $env:SELF -WorkingDirectory $env:DIR -Verb RunAs"
    exit /b
)

:: Adiciona o dominio no hosts se ainda nao existir
findstr /c:"%DOMAIN%" "%windir%\System32\drivers\etc\hosts" >nul 2>nul
if %errorlevel% neq 0 (
    echo  Registrando %DOMAIN% no hosts do Windows...
    echo 127.0.0.1 %DOMAIN%>> "%windir%\System32\drivers\etc\hosts"
    echo  OK: http://%DOMAIN%:%PORT% ja pode ser usado neste computador.
) else (
    echo  Dominio %DOMAIN% ja registrado.
)

:: Encerra processo que ja esteja usando a porta
echo  Verificando porta %PORT%...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    echo  Encerrando processo anterior (PID %%p)...
    taskkill /PID %%p /F >nul 2>nul
)

:: Verifica Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  ERRO: Node.js nao encontrado. Instale em nodejs.org
    pause
    exit /b 1
)

echo.
echo  Acesse neste computador:  http://%DOMAIN%:%PORT%/login.html
echo  Acesse pela rede (Wi-Fi): veja o IP exibido abaixo
echo.

node server.js
pause
