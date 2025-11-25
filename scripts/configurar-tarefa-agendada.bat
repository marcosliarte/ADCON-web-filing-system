@echo off
REM Script para configurar tarefa agendada no Windows
REM Execute como Administrador

echo ========================================
echo ADCON - Configurar Verificacao Diaria
echo ========================================
echo.

set SCRIPT_PATH=%~dp0verificar-documentos.js
set WORKING_DIR=%~dp0..

echo Criando tarefa agendada...
echo.
echo Nome: ADCON-VerificarDocumentos
echo Horario: Diariamente as 08:00
echo Script: %SCRIPT_PATH%
echo.

schtasks /Create /SC DAILY /TN "ADCON-VerificarDocumentos" /TR "node \"%SCRIPT_PATH%\"" /ST 08:00 /F

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo Tarefa criada com sucesso!
    echo ========================================
    echo.
    echo A verificacao de documentos sera executada
    echo automaticamente todos os dias as 08:00.
    echo.
    echo Para verificar a tarefa:
    echo   taskschd.msc
    echo.
    echo Para executar manualmente agora:
    echo   schtasks /Run /TN "ADCON-VerificarDocumentos"
    echo.
    echo Para remover a tarefa:
    echo   schtasks /Delete /TN "ADCON-VerificarDocumentos" /F
    echo.
) else (
    echo.
    echo ========================================
    echo ERRO ao criar a tarefa!
    echo ========================================
    echo.
    echo Execute este arquivo como Administrador
    echo Clique com botao direito e "Executar como administrador"
    echo.
)

pause
