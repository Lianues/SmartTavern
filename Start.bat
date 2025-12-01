@echo off
chcp 65001 >nul
echo ====================================
echo 正在启动 SmartTavern 应用程序...
echo ====================================

REM 启动后端 API 服务
echo [1/3] 正在启动后端 API 服务...
start "SmartTavern Backend APIs" cmd /k python start_all_apis.py

REM 等待 2 秒让后端服务启动
timeout /t 2 /nobreak >nul

REM 进入前端项目目录
cd frontend_projects\SmartTavern

REM 安装依赖（如果需要）
echo [2/3] 正在检查并安装前端依赖...
if not exist "node_modules\" (
    echo 首次运行，正在安装依赖，请稍候...
    call npm install
) else (
    echo 依赖已存在，跳过安装
)

REM 启动前端开发服务器
echo [3/3] 正在启动前端开发服务器...
start "SmartTavern Frontend" cmd /k npm run dev

REM 返回根目录
cd ..\..

echo.
echo ====================================
echo 所有服务已启动！
echo - 后端 API 服务正在运行
echo - 前端开发服务器正在运行
echo ====================================
echo.
echo 提示：关闭此窗口不会停止服务
echo 要停止服务，请关闭相应的命令行窗口
echo.
pause