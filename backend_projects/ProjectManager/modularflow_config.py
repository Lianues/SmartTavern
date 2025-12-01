#!/usr/bin/env python3
"""
ProjectManager 后端配置脚本（常量式）
- 仅后端服务所需端口；不启动前端开发服务器
"""

# 端口配置（后端通常只需 API 与 WebSocket，共用同端口亦可）
FRONTEND_PORT = 8055  # 为兼容 CORS 配置，指向控制台前端端口
BACKEND_PORT = 8050
WEBSOCKET_PORT = 8050

# 项目信息
PROJECT_NAME = "ProjectManagerBackend"
DISPLAY_NAME = "项目管理器后端"
PROJECT_ROLE = "backend"
VERSION = "1.0.0"
DESCRIPTION = "ModularFlow 后端项目（仅 API 网关，无前端开发服务器）"

# 运行命令（后端通常由框架统一启动，此处留空以避免误触发）
INSTALL_COMMAND = "pip install -r requirements.txt"
DEV_COMMAND = ""
BUILD_COMMAND = ""

# 如需扩展：可添加自定义变量，SimpleScriptConfig 会按需读取