@echo off
REM comp03 - Stop Script
REM This script stops both the backend and frontend servers

setlocal enabledelayedexpansion

echo ========================================
echo  comp03 - Stopping Servers
echo ========================================
echo.

REM Stop backend (port 3030)
echo Stopping backend server (port 3030)...
set KILLED_BACKEND=0
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3030" ^| find "LISTENING"') do (
    echo [INFO] Stopping backend process (PID %%a)...
    taskkill /F /PID %%a >nul 2>&1
    if !errorlevel! equ 0 (
        echo ✓ Backend stopped
        set KILLED_BACKEND=1
    )
)
if !KILLED_BACKEND! equ 0 echo No backend process found

echo.

REM Stop frontend (port 3000)
echo Stopping frontend server (port 3000)...
set KILLED_FRONTEND=0
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo [INFO] Stopping frontend process (PID %%a)...
    taskkill /F /PID %%a >nul 2>&1
    if !errorlevel! equ 0 (
        echo ✓ Frontend stopped
        set KILLED_FRONTEND=1
    )
)
if !KILLED_FRONTEND! equ 0 echo No frontend process found

echo.
echo ========================================
echo  ✅ All servers stopped
echo ========================================
echo.
echo To start again, run: start.bat
echo.
timeout /t 2 /nobreak >nul
