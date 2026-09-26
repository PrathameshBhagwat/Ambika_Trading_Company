@echo off
setlocal enabledelayedexpansion
title Ambika Trading - Farmer Settlement Management System Control Center
color 0B

:: Navigate to script directory
cd /d "%~dp0"

:MENU
cls
echo ===============================================================================
echo                AMBIKA TRADING - FARMER SETTLEMENT SYSTEM
echo                   अंबिका ट्रेडिंग - शेतकरी हिशोब व्यवस्थापन
echo ===============================================================================
echo.
echo   Select an option:
echo.
echo     [1] Launch Desktop App (Recommended - Offline Window)
echo     [2] Launch Browser Development Mode (Hot Reload + Dev Server)
echo     [3] Run Backend Calculation and API Test Suite (pytest)
echo     [4] Rebuild Frontend Application Bundle
echo     [5] Open Database and Backup Folder
echo     [6] Exit
echo.
echo ===============================================================================
set /p CHOICE="Enter choice [1-6] (Default is 1): "

if "%CHOICE%"=="" set CHOICE=1
if "%CHOICE%"=="1" goto LAUNCH_DESKTOP
if "%CHOICE%"=="2" goto LAUNCH_DEV
if "%CHOICE%"=="3" goto RUN_TESTS
if "%CHOICE%"=="4" goto REBUILD_FRONTEND
if "%CHOICE%"=="5" goto OPEN_BACKUP
if "%CHOICE%"=="6" goto EXIT_APP

echo Invalid selection. Please choose 1, 2, 3, 4, 5, or 6.
timeout /t 2 >nul
goto MENU

:LAUNCH_DESKTOP
cls
echo Starting Ambika Trading Desktop Application...
call start_app.bat
goto MENU

:LAUNCH_DEV
cls
echo Starting Ambika Trading in Development Mode (FastAPI + Vite)...
echo Backend will be available at: http://127.0.0.1:8741
echo Frontend will be available at: http://localhost:5173
echo.
echo Press CTRL+C at any time in this window to stop both servers.
echo.
call npm run dev
pause
goto MENU

:RUN_TESTS
cls
echo Running Backend Unit and Integration Test Suite...
echo.
call npm run test:backend
echo.
echo Tests completed.
pause
goto MENU

:REBUILD_FRONTEND
cls
echo Rebuilding Frontend Production Bundle...
echo.
call npm run frontend:build
if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Frontend bundle updated in frontend\dist\
) else (
    echo.
    echo [ERROR] Build encountered an error.
)
pause
goto MENU

:OPEN_BACKUP
cls
set APPDATA_DIR=%APPDATA%\AmbikaTrading
if not exist "%APPDATA_DIR%" (
    mkdir "%APPDATA_DIR%"
)
echo Opening Ambika Trading data directory: %APPDATA_DIR%
explorer "%APPDATA_DIR%"
timeout /t 2 >nul
goto MENU

:EXIT_APP
cls
echo Exiting Ambika Trading Control Center.
timeout /t 1 >nul
exit /b 0
