@echo off
title ADCON - PARAR SERVIDOR (EMERGENCIA)
color 0C
cd /d "%~dp0"

echo.
echo  ==========================================================
echo   ATENCAO: isso vai DERRUBAR o sistema ADCON para TODOS
echo   os usuarios (escritorio, celular, ZeroTier - todo mundo).
echo   Use apenas em emergencia.
echo  ==========================================================
echo.

where pm2 >nul 2>nul
if %errorlevel% neq 0 (
    echo  ERRO: PM2 nao encontrado no PATH.
    pause
    exit /b 1
)

set /p CONFIRMA="Tem certeza que deseja parar o servidor agora? (digite SIM para confirmar): "
if /i not "%CONFIRMA%"=="SIM" (
    echo.
    echo  Cancelado. Nada foi alterado.
    pause
    exit /b 0
)

echo.
echo  Parando o servidor...
pm2 stop adcon

echo.
echo  ==========================================================
echo   Servidor PARADO. Ninguem consegue acessar o ADCON agora.
echo   Para voltar ao normal, execute: reiniciar-servidor.bat
echo  ==========================================================
echo.
pause
