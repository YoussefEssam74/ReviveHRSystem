@echo off
REM ============================================================
REM Revive HR - Attendance Station Kiosk launcher
REM Opens the attendance station (Client SPA, /attendance) full-screen.
REM Face-ID runs in the .NET API, so start the backend (dotnet run in
REM ReviveHRSystem.Web) and the client dev server (npm run dev in Client)
REM before launching this file.
REM Put a shortcut to THIS file in shell:startup to auto-open
REM on every login (or run install-kiosk-startup.ps1 once).
REM ============================================================
setlocal

set "PAGE=http://localhost:5173/attendance"

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

