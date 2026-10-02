# ============================================================
# Revive HR - Attendance Station: install auto-start on login
# Creates a shortcut in the user's Startup folder that runs
# open-kiosk.bat, so the station page is always open on the
# desktop after login. Run once:
#   powershell -ExecutionPolicy Bypass -File install-kiosk-startup.ps1
# Uninstall: delete "ReviveHR Attendance Station.lnk" from
#   shell:startup
# ============================================================
$ErrorActionPreference = 'Stop'

$startup = [Environment]::GetFolderPath('Startup')
$bat     = Join-Path $PSScriptRoot 'open-kiosk.bat'
$lnkPath = Join-Path $startup 'ReviveHR Attendance Station.lnk'

if (-not (Test-Path $bat)) { throw "open-kiosk.bat not found next to this script." }

$shell = New-Object -ComObject WScript.Shell
$lnk   = $shell.CreateShortcut($lnkPath)
$lnk.TargetPath       = $bat
$lnk.WorkingDirectory = $PSScriptRoot
$lnk.WindowStyle      = 7   # minimized - the bat flashes then the kiosk window opens
$lnk.Description      = 'Revive HR Attendance Station kiosk (auto-start)'
$lnk.Save()

Write-Host "Installed: $lnkPath"
Write-Host "The Attendance Station will now open automatically on every login."
Write-Host "To remove it, delete that .lnk from shell:startup."
