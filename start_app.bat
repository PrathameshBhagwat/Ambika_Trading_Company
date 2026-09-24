@echo off
setlocal enabledelayedexpansion
title Ambika Trading - Farmer Settlement Management System
color 0A

:: Navigate to script directory
cd /d "%~dp0"

echo ===============================================================================
echo                AMBIKA TRADING - FARMER SETTLEMENT SYSTEM
echo                   अंबिका ट्रेडिंग - शेतकरी हिशोब प्रणाली
echo ===============================================================================
echo.

:: 1. Check Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.11+ and ensure "Add Python to PATH" is checked.
    echo.
    pause
    exit /b 1
)

:: 2. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js version 18 or higher from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 3. Check Python dependencies
echo [1/3] Checking Python dependencies...
python -c "import fastapi, uvicorn, sqlalchemy, alembic, pydantic" >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Installing required Python backend dependencies...
    pip install -r backend\requirements.txt
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Failed to install Python dependencies.
        pause
        exit /b 1
    )
)
echo [OK] Python dependencies verified.

:: 4. Check Frontend node_modules
echo [2/3] Checking Node.js packages...
if not exist "node_modules\" (
    echo [INFO] Installing root dependencies...
    call npm install
)
if not exist "frontend\node_modules\" (
    echo [INFO] Installing frontend dependencies...
    cd frontend && call npm install && cd ..
)
echo [OK] Node dependencies verified.

:: 5. Check if production build exists
echo [3/3] Checking frontend build bundle...
if not exist "frontend\dist\index.html" (
    echo [INFO] Building frontend application bundle...
    call npm run frontend:build
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Frontend build failed.
        pause
        exit /b 1
    )
)
echo [OK] Frontend bundle ready.

if "%1"=="--test" (
    echo.
    echo ===============================================================================
    echo [TEST OK] All checks passed! System is ready to launch.
    echo ===============================================================================
    exit /b 0
)

echo.
echo ===============================================================================
echo [SUCCESS] Starting Ambika Trading Desktop Application...
echo ===============================================================================
echo.

:: Start desktop application
call npm start

if %errorlevel% neq 0 (
    echo.
    echo [NOTE] Desktop window closed or encountered an issue.
)

exit /b 0
