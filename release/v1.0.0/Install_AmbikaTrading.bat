@echo off
setlocal enabledelayedexpansion
title Ambika Trading - Windows Setup Installer
color 0A

:: Navigate to script directory
cd /d "%~dp0"

echo ===============================================================================
echo            AMBIKA TRADING - WINDOWS 64-BIT SETUP & INSTALLER
echo               मे. अंबिका ट्रेडिंग कंपनी - संगणक स्थापना
echo ===============================================================================
echo.

:: 1. Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.11+ and ensure "Add Python to PATH" is checked.
    echo Download from: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

:: 2. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js 18+ from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 3. Setup Python dependencies
echo [1/4] Verifying Python backend libraries...
python -c "import fastapi, uvicorn, sqlalchemy, alembic, pydantic" >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Installing required Python libraries...
    pip install -r backend\requirements.txt
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Failed to install Python dependencies.
        pause
        exit /b 1
    )
)
echo [OK] Python backend ready.

:: 4. Setup Node packages
echo [2/4] Verifying desktop runtime packages...
if not exist "node_modules\" (
    echo [INFO] Installing desktop runtime packages...
    call npm install
)
echo [OK] Runtime packages ready.

:: 5. Create User Data Directory
echo [3/4] Ensuring secure user data directory...
set DATA_DIR=%USERPROFILE%\AmbikaTrading
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"
if not exist "%DATA_DIR%\Backups" mkdir "%DATA_DIR%\Backups"
if not exist "%DATA_DIR%\Logs" mkdir "%DATA_DIR%\Logs"
echo [OK] User data directory verified: %DATA_DIR%

:: 6. Create Desktop Shortcut
echo [4/4] Creating Windows Desktop Shortcut...
set SCRIPT_DIR=%~dp0
set SHORTCUT_PATH=%USERPROFILE%\Desktop\Ambika Trading.lnk
set TARGET_VBS=%SCRIPT_DIR%Launch_Ambika_Trading.vbs

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = '%TARGET_VBS%'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Description = 'Ambika Trading - Farmer Settlement System'; $s.Save()"

if exist "%SHORTCUT_PATH%" (
    echo [OK] Desktop Shortcut successfully created on your Windows Desktop!
) else (
    echo [NOTE] Desktop shortcut could not be placed automatically. You can launch using Launch_Ambika_Trading.vbs directly.
)

echo.
echo ===============================================================================
echo [SUCCESS] Ambika Trading v1.0.0 is successfully installed and ready!
echo ===============================================================================
echo.
echo You can now start the application anytime by double-clicking:
echo   - "Ambika Trading" on your Windows Desktop
echo   - Or "Launch_Ambika_Trading.vbs" in this folder.
echo.
pause
exit /b 0
