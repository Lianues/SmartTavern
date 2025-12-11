#!/usr/bin/env python3
"""
SmartTavern 后端简化配置脚本（常量式）
- 不需要定义类/方法，统一由框架 SimpleScriptConfig 读取
"""

# 基本端口
FRONTEND_PORT = 5173
BACKEND_PORT = 8050
WEBSOCKET_PORT = 8050

# 项目信息
PROJECT_NAME = "SmartTavern"
DISPLAY_NAME = "SmartTavern Backend"
PROJECT_ROLE = "backend"
VERSION = "0.0.1"
DESCRIPTION = "AI 对话后端 (FastAPI + Python)"

# 运行命令
INSTALL_COMMAND = "pip install -r requirements.txt"
DEV_COMMAND = "python start_all_apis.py --reload"
BUILD_COMMAND = "echo 'No build required for Python backend'"
