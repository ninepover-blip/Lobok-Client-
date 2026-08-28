@echo off
title Infinyty - Start
cd /d "%~dp0"

echo ============================================
echo   Launching Infinyty (Fabric 1.21.4, dev client)
echo   Closing this window will stop the game.
echo ============================================
echo.
call gradlew.bat runClient --console=plain
if errorlevel 1 (
    echo [ERROR] Failed to launch client.
)
echo.
pause