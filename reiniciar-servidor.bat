@echo off
title ADCON - Reiniciar Servidor
color 0E
cd /d "%~dp0"

echo.
echo  ==========================================
echo   ADCON - Reiniciando o servidor
echo  ==========================================
echo.

where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo  ERRO: PM2 nao encontrado no PATH.
    echo  O servidor ADCON roda via PM2 - instale com: npm install -g pm2
    pause
    exit /b 1
)

pm2 restart adcon
if %errorlevel% neq 0 (
    echo.
    echo  ERRO: nao foi possivel reiniciar o processo "adcon" via PM2.
    echo  Rode "pm2 list" para verificar se o processo existe.
    pause
    exit /b 1
)

echo.
echo  Servidor reiniciado. Status atual:
echo.
pm2 list

echo.
echo  Acesse em: http://adcon-escritorio.duckdns.org:3000/login.html
echo.
pause
