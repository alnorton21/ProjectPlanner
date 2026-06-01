@echo off
pushd "%~dp0"
echo ============================================
echo   Project Planner - Dev Mode
echo ============================================
echo.
echo Backend API:  http://localhost:3001
echo Frontend UI:  http://localhost:3000
echo.

:: Install deps if needed
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend && call npm install && cd ..
)
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend && call npm install && cd ..
)

:: Start backend in a new window
start "Project Planner - Backend" cmd /k "cd /d %~dp0backend && npm run dev"

:: Wait a moment then start frontend
timeout /t 3 /nobreak >nul
start "Project Planner - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both servers starting... opening http://localhost:3000
timeout /t 5 /nobreak >nul
start http://localhost:3000
