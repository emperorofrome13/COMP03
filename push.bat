@echo off
echo ========================================
echo Pushing COMP03 to GitHub
echo ========================================
echo.

cd /d %~dp0

echo Step 1: Initializing git...
git init

echo Step 2: Adding all files...
git add .

echo Step 3: Creating initial commit...
git commit -m "Initial release v1.0.0"

echo Step 4: Setting branch to main...
git branch -M main

echo Step 5: Adding GitHub remote...
git remote remove origin 2>nul
git remote add origin https://github.com/emperorofrome13/COMP03.git

echo Step 6: Pushing to GitHub...
echo (You will be prompted for GitHub credentials)
git push -u origin main

echo.
echo ========================================
echo Complete! Check your repo at:
echo https://github.com/emperorofrome13/COMP03
echo ========================================
pause
