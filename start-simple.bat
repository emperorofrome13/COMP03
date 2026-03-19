@echo off
REM DevTeam - Simple Start Script
REM Runs both servers in this terminal window

echo ========================================
echo  DevTeam - Simple Start
echo ========================================
echo.

REM Check dependencies
where node >nul 2>nul || (echo Node.js not found! && pause && exit /b 1)
where bun >nul 2>nul || (echo Bun not found! && pause && exit /b 1)

echo Starting backend and frontend...
echo.

REM Start backend in background
start "DevTeam Backend" cmd /k "cd mini-services\devteam-backend && bun --hot index.ts"

REM Wait for backend
timeout /t 5 /nobreak >nul

REM Start frontend
start "DevTeam Frontend" cmd /k "npm run dev"

echo.
echo Servers starting in new windows...
echo Backend: http://localhost:3030
echo Frontend: http://localhost:3000
echo.
timeout /t 8 /nobreak >nul
start http://localhost:3000

pause
