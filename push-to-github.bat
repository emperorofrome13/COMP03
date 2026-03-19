@echo off
echo ========================================
echo Pushing COMP03 to GitHub
echo ========================================
echo.

cd /d %~dp0

echo Step 1: Creating version tag...
git tag -a v1.0.0 -m "Version 1.0.0 - Initial release" 2>nul || echo Tag already exists

echo Step 2: Setting up GitHub remote...
git remote remove origin 2>nul
git remote add origin https://github.com/emperorofrome13/COMP03.git

echo Step 3: Pushing to GitHub...
echo You will be prompted for GitHub credentials
echo.
git push -u origin main --force
if errorlevel 1 (
    echo.
    echo Push failed! Make sure:
    echo 1. You created the COMP03 repo at https://github.com/emperorofrome13/COMP03
    echo 2. You entered correct GitHub credentials
    pause
    exit /b 1
)

echo.
echo Step 4: Pushing version tag...
git push origin v1.0.0

echo.
echo ========================================
echo SUCCESS!
echo Check your repo at:
echo https://github.com/emperorofrome13/COMP03
echo ========================================
pause
