@echo off
REM comp03 - Single Window Start Script
REM Runs both backend and frontend in this terminal window

setlocal enabledelayedexpansion

echo ========================================
echo  comp03 - Single Window Mode
echo  Starting servers...
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed
    pause
    exit /b 1
)

REM Check if Bun is installed
where bun >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Bun is not installed
    pause
    exit /b 1
)

echo [1/3] Checking dependencies...
if not exist "mini-services\devteam-backend\node_modules" (
    echo Installing backend dependencies...
    cd mini-services\devteam-backend
    call bun install
    cd ..
)
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
)
echo Dependencies OK

echo.
echo [2/3] Starting backend (port 3030)...
echo.

REM Start backend in background
cd mini-services\devteam-backend
start /B bun --hot index.ts > backend.log 2>&1
cd ..

echo Waiting for backend...
timeout /t 5 /nobreak >nul

netstat -ano | find ":3030" | find "LISTENING" >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Backend failed to start
    type mini-services\devteam-backend\backend.log
    pause
    exit /b 1
)
echo ✓ Backend running on port 3030

echo.
echo [3/3] Starting frontend (port 3000)...
echo.

REM Start frontend
start /B npm run dev > frontend.log 2>&1

echo Waiting for frontend...
timeout /t 8 /nobreak >nul

netstat -ano | find ":3000" | find "LISTENING" >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Frontend failed to start
    type frontend.log
    pause
    exit /b 1
)
echo ✓ Frontend running on port 3000

echo.
echo ========================================
echo  ✅ comp03 is running!
echo ========================================
echo.
echo  Backend:  http://localhost:3030
echo  Frontend: http://localhost:3000
echo.
echo  Both servers running in background.
echo  Open: http://localhost:3000
echo.
echo  To stop: Run stop.bat
echo  Or close this window
echo.
echo  Logs:
echo    - Backend: mini-services/devteam-backend/backend.log
echo    - Frontend: frontend.log
echo.
echo ========================================
echo.

REM Open browser
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo Press Ctrl+C to stop all servers
pause
