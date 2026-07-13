@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul

echo.
echo ========================================
echo   Build do ObraGest.exe
echo ========================================
echo.

REM ── Verificar se Python está instalado ──────────────────────────────────────
where python >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python nao encontrado. Instale o Python 3.13+ e tente novamente.
    echo        Download: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM ── Verificar se Node.js está instalado ─────────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado. Instale o Node.js 22+ e tente novamente.
    echo        Download: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/5] Instalando dependencias do frontend...
cd frontend
call npm install
if errorlevel 1 goto :error

echo.
echo [2/5] Compilando frontend React...
call npm run build
if errorlevel 1 goto :error

if not exist "dist\index.html" (
    echo [ERRO] frontend\dist\index.html nao encontrado apos o build.
    goto :error
)
cd ..

echo.
echo [3/5] Instalando dependencias do backend...
cd backend
pip install pyinstaller waitress pystray pillow
if errorlevel 1 goto :error

echo.
echo [4/5] Gerando arquivos estaticos do Django...
set OBRA_GEST_DATA_DIR=data
set DEBUG=false
set ALLOWED_HOSTS=localhost
set SECRET_KEY=build-temp-key
python manage.py collectstatic --noinput
if errorlevel 1 goto :error

echo.
echo [5/5] Compilando executavel com PyInstaller (onedir)...
if not exist "google_client_secret.json" (
    echo [AVISO] google_client_secret.json ausente — o build nao tera Google Drive embutido.
    echo         Para builds de distribuicao, copie o JSON OAuth para backend\google_client_secret.json
)
pyinstaller launcher.spec --clean --noconfirm
if errorlevel 1 goto :error

echo.
echo ========================================
echo   Build concluido com sucesso!
echo.
echo   Pasta: backend\dist\ObraGest\
echo   Execute: backend\dist\ObraGest\ObraGest.exe
echo.
echo   Para distribuir: zip a pasta ObraGest inteira.
echo ========================================
cd ..
pause
exit /b 0

:error
echo.
echo [ERRO] O build falhou. Verifique as mensagens acima.
cd ..
pause
exit /b 1
