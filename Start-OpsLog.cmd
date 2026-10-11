@echo off
REM Double-click to run OpsLog locally at http://localhost:8080
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\Start-OpsLog.ps1" %*
