@echo off
REM ============================================================
REM Revive HR - Attendance Station Kiosk launcher
REM Starts the Biometric Face-ID service if needed and
REM opens the attendance station full-screen (Edge app window).
REM Put a shortcut to THIS file in shell:startup to auto-open
REM on every login (or run install-kiosk-startup.ps1 once).
REM ============================================================
setlocal

set "PYTHON_EXE=D:\Youssef\Programs\miniconda3\envs\workout_ml\python.exe"
set "BIO_SCRIPT=%~dp0..\..\biometric_test\webcam_app.py"

REM Start the Biometric Face-ID FastAPI backend in minimized window if available
if exist "%PYTHON_EXE%" (
  if exist "%BIO_SCRIPT%" (
    start "Revive HR Biometrics Backend" /min "%PYTHON_EXE%" "%BIO_SCRIPT%"
    timeout /t 2 /nobreak >nul
  )
)

set "PAGE=http://localhost:5050/station/"

REM Prefer Edge in app mode (no tabs/address bar); fall back to Chrome; then default browser.
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%PAGE%"
  goto :eof
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="%PAGE%"
  goto :eof
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%PAGE%"
  goto :eof
)
start "" "%PAGE%"

