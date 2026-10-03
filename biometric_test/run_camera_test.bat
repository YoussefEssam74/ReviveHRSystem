@echo off
title Revive HR - Biometric Face Recognition
cd /d "%~dp0"

echo ===================================================================
echo             REVIVE HR SYSTEM - BIOMETRIC FACE RECOGNITION
echo ===================================================================
echo.
echo   [1] Full Anti-Spoofing Web Kiosk (Liveness + Multi-Staff Recognition)
echo   [2] Simple OpenCV Desktop Window (Quick Face Match Test)
echo.
set /p choice="Select mode (1 or 2, default is 1): "

if "%choice%"=="2" (
    echo.
    echo Starting Simple OpenCV Desktop Window...
    echo Controls: Press 's' to enroll, Press 'q' to quit.
    echo.
    "D:\Youssef\Programs\miniconda3\envs\workout_ml\python.exe" test_opencv_zoo.py --webcam
) else (
    echo.
    echo Starting Anti-Spoofing Biometric Kiosk...
    echo Please wait while models load...
    echo.
    "D:\Youssef\Programs\miniconda3\envs\workout_ml\python.exe" webcam_app.py
)

pause
