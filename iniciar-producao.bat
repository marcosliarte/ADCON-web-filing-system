@echo off
echo ========================================
echo  ADCON - MODO PRODUCAO (RECOMENDADO)
echo ========================================
echo.
echo Servidor: http://192.168.0.32:3000
echo Banco: MongoDB Atlas (dados reais)
echo.
echo Acesse de qualquer dispositivo na rede:
echo - PC:      http://192.168.0.32:3000
echo - Celular: http://192.168.0.32:3000
echo - Tablet:  http://192.168.0.32:3000
echo.
echo Para testes locais: iniciar-local.bat
echo.
set NODE_ENV=production
pause
npm start
