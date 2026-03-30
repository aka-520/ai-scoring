@echo off
chcp 65001 > nul
title AI 推動評分系統 v2

echo.
echo ================================
echo  AI 推動評分系統 v2 啟動中...
echo ================================
echo.

cd /d "%~dp0"

REM 檢查後端 node_modules
if not exist "backend\node_modules" (
  echo [初始化] 安裝後端相依套件...
  cd backend
  call npm install
  cd ..
)

REM 檢查前端 node_modules
if not exist "frontend\node_modules" (
  echo [初始化] 安裝前端相依套件...
  cd frontend
  call npm install
  cd ..
)

REM 執行 Prisma migrate + seed（僅首次）
if not exist "backend\prisma\dev.db" (
  echo [初始化] 建立資料庫並執行種子資料...
  cd backend
  call npx prisma migrate deploy
  call node src/seed.js
  cd ..
)

echo.
echo [啟動] 後端伺服器 (Port 3001)...
start "AI推動評分v2-後端" cmd /k "cd /d %~dp0backend && node src/index.js"

timeout /t 2 /nobreak > nul

echo [啟動] 前端開發伺服器 (Port 5174)...
start "AI推動評分v2-前端" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 4 /nobreak > nul

echo.
echo [完成] 系統已啟動！
echo  後端：http://localhost:3001
echo  前端：http://localhost:5174
echo.

start http://localhost:5174

pause
