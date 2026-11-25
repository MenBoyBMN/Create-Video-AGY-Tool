@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" %*
if errorlevel 1 (
  echo.
  echo [AGY Video Studio] Setup failed with exit code %errorlevel%.
  pause
  exit /b %errorlevel%
)
echo.
pause
