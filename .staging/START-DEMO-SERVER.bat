@echo off
title Empower Write - demo server  (KEEP THIS WINDOW OPEN during your demo)
echo ============================================================
echo  Empower Write preview server
echo  Serving on http://localhost:8830
echo.
echo  The "Open the working preview" button in the app opens:
echo  http://localhost:8830/.staging/empower-write/
echo.
echo  KEEP THIS WINDOW OPEN while you demo. Close it when done.
echo ============================================================
echo.
where python >nul 2>nul && (python "E:\vocab-trainer\.staging\serve-nocache.py") || (py "E:\vocab-trainer\.staging\serve-nocache.py")
echo.
echo Server stopped. You can close this window.
pause
