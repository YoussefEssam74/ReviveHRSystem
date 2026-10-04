@echo off
title Deploy to Hugging Face Spaces
echo =========================================================
echo   Revive HR - Deploy Biometric Service to Hugging Face
echo =========================================================
echo.
echo Make sure you created a Docker space at https://huggingface.co/new-space
echo.
set /p HF_USER="Enter your Hugging Face username: "
set /p HF_SPACE="Enter your Space name (e.g. revive-biometrics): "

if "%HF_USER%"=="" (
    echo Username cannot be empty.
    pause
    exit /b
)
if "%HF_SPACE%"=="" (
    echo Space name cannot be empty.
    pause
    exit /b
)

set REMOTE_URL=https://huggingface.co/spaces/%HF_USER%/%HF_SPACE%
echo.
echo [*] Target remote: %REMOTE_URL%
echo.

if not exist ".git" (
    echo [*] Initializing git repository in this folder...
    git init
    git branch -M main
)

git remote remove space 2>nul
git remote add space %REMOTE_URL%

echo [*] Staging files...
git add .

echo [*] Committing...
git commit -m "Deploy Revive HR Biometrics to Hugging Face"

echo.
echo [*] Pushing to Hugging Face Spaces...
echo (When prompted, enter your Hugging Face username and your Access Token as password)
git push -u space main --force

echo.
echo =========================================================
echo If the push succeeded, your Space will be live at:
echo https://%HF_USER%-%HF_SPACE%.hf.space
echo =========================================================
pause
