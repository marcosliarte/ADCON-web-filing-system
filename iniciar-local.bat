@echo off
echo ========================================
echo  ADCON - MODO DE TESTE LOCAL
echo ========================================
echo.
echo Servidor: http://192.168.1.10:3000
echo Banco: MongoDB LOCAL (apenas testes)
echo.
echo AVISO: Este modo usa banco de dados local
echo        NAO afeta os dados de producao
echo.
echo Para usar dados reais: iniciar-producao.bat
echo.
pause
npm start
