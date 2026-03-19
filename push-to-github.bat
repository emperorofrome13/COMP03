@echo off
echo ========================================
echo Pushing COMP03 to GitHub
echo ========================================
echo.

cd /d %~dp0

echo Step 1: Checking git status...
git status

echo.
echo Step 2: Cleaning git cache to re-apply .gitignore...
git rm -r --cached .

echo.
echo Step 3: Re-adding all files (respecting .gitignore)...
git add .

echo.
echo Step 4: Creating initial commit...
git commit -m "Initial release v1.0.0"

echo.
echo Step 5: Setting branch to main...
git branch -M main

echo.
echo Step 6: Updating GitHub remote...
git remote remove origin 2>nul
git remote add origin https://github.com/emperorofrome13/COMP03.git

echo.
echo Step 7: Pushing to GitHub...
echo (You will be prompted for GitHub credentials)
git push -u origin main --force

echo.
echo ========================================
echo Complete! Check your repo at:
echo https://github.com/emperorofrome13/COMP03
echo ========================================
pause
