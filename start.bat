@echo off
title Khoi dong Floralia Project
echo ====================================================
echo             KHOI DONG DU AN FLORALIA
echo ====================================================
echo.

echo [1/2] Dang khoi dong Backend Server (Node.js/Express)...
start "Floralia Server (Port 3002)" cmd /k "cd /d ""%~dp0my-server-mongodb"" && npm start"

echo [2/2] Dang khoi dong Frontend Client (Angular)...
start "Floralia Client (Port 4200)" cmd /k "cd /d ""%~dp0client"" && npm start"

echo.
echo ====================================================
echo   Backend Server: http://localhost:3002
echo   Frontend Web:   http://localhost:4200
echo ====================================================
echo.
echo Ca 2 cua so da duoc mo. Ban co the dong cua so nay.
pause
