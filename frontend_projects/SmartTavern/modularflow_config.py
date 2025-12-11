#!/usr/bin/env python3
"""
SmartTavern 前端简化配置脚本（常量式）
- 不需要定义类/方法，统一由框架 SimpleScriptConfig 读取
"""

# 基本端口
FRONTEND_PORT = 5173
BACKEND_PORT = 8050
WEBSOCKET_PORT = 8050

# 项目信息
PROJECT_NAME = "SmartTavern"
DISPLAY_NAME = "SmartTavern"
PROJECT_ROLE = "frontend"
VERSION = "0.0.1"
DESCRIPTION = "AI 对话前端 (Vue + TypeScript)"

# 运行命令（DEV_COMMAND 支持 {port} 占位符）
INSTALL_COMMAND = "npm install"
DEV_COMMAND = "npm run dev -- --port {port}"
BUILD_COMMAND = "npm run build"
