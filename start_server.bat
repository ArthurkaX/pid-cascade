@echo off
chdir /d "%~dp0"
echo.
echo ========================================
echo PID CASCADE SIMULATOR - Local Server
echo ========================================
echo.
echo Starting local HTTP server on port 8000...
echo.
echo OPEN BROWSER AND GO TO:
echo     http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.
python -m http.server 8000
pause
