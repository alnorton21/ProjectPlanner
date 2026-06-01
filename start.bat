@echo off
pushd "%~dp0"
echo ============================================
echo   Project Planner - Starting...
echo ============================================
echo.

:: Check Node is available
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found.
    echo Please install from https://nodejs.org and re-run this script.
    pause
    exit /b 1
)

:: Install backend deps if needed
if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
)

:: Install frontend deps if needed
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

:: Build backend
echo Building backend...
cd backend
call npm run build
cd ..

:: Build frontend
echo Building frontend...
cd frontend
call npm run build
cd ..

:: Start backend (serves built frontend + API)
echo.
echo ============================================
echo   App running at http://localhost:3001
echo   Also accessible at http://YOUR-IP:3001
echo ============================================
echo.
cd backend
call npm start
