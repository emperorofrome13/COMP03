@echo off
REM comp03 - Easy Start Script
setlocal enabledelayedexpansion

echo ========================================
echo  comp03 - AI Development System
echo ========================================
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found
    echo Install from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check Bun
where bun >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Bun not found
    echo Run: npm install -g bun
    pause
    exit /b 1
)

echo [1/4] Checking dependencies...
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
)
if not exist "mini-services\devteam-backend\node_modules" (
    echo Installing backend dependencies...
    cd mini-services\devteam-backend
    call bun install
    cd ..\..
)

echo [2/4] Stopping existing servers...
taskkill /F /IM node.exe >nul 2>nul
taskkill /F /IM bun.exe >nul 2>nul
timeout /t 2 /nobreak >nul

echo [3/4] Starting servers...
echo.

REM Start backend
cd mini-services\devteam-backend
start "comp03 Backend" cmd /c "bun --hot index.ts"
cd ..\..

REM Wait for backend
echo Waiting for backend...
timeout /t 8 /nobreak >nul

REM Start frontend
start "comp03 Frontend" cmd /c "npm run dev"

REM Wait for frontend
echo Waiting for frontend...
timeout /t 12 /nobreak >nul

echo [4/4] Opening browser...
timeout /t 3 /nobreak >nul

REM Open browser - try multiple methods
echo Opening http://localhost:3000/create ...
start http://localhost:3000/create 2>nul
if %errorlevel% neq 0 (
    explorer http://localhost:3000/create
)

echo.
echo ========================================
echo  comp03 is running!
echo ========================================
echo.
echo  URLs:
echo    Create:  http://localhost:3000/create
echo    Build:   http://localhost:3000
echo    Results: http://localhost:3000/results
echo.
echo  Close this window to stop (or press Ctrl+C)
echo ========================================

REM Keep window open and show status
:loop
timeout /t 30 /nobreak >nul
echo [%time%] Servers running... Close windows to stop.
goto loop