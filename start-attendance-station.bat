@echo off
title Revive HR - Biometric Attendance Station
echo ===================================================
echo   Revive HR System - Biometric Attendance Station
echo   YuNet Face Detection + Silent-Face + SFace 1-to-N
echo ===================================================
echo.

set PYTHON_EXE=D:\Youssef\Programs\miniconda3\envs\workout_ml\python.exe
if not exist "%PYTHON_EXE%" (
    set PYTHON_EXE=python
)

echo [*] Launching Biometric AI Service on port 5050...
start "" "%PYTHON_EXE%" "biometric_test\webcam_app.py"

echo [*] Opening Attendance Station Kiosk in default browser...
timeout /t 2 /nobreak >nul
start "" "Mock UI\Attendance Station\index.html"

echo.
echo [*] System is running!
echo     Biometric API: http://localhost:5050
echo     UI: Mock UI\Attendance Station\index.html
echo.
pause
