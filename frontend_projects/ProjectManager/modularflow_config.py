#!/usr/bin/env python3
"""
ProjectManager 简化配置脚本（常量式）
- 不需要定义类/方法，统一由框架 SimpleScriptConfig 读取
"""

# 基本端口
FRONTEND_PORT = 8055
BACKEND_PORT = 8050
WEBSOCKET_PORT = 8050

# 项目信息
PROJECT_NAME = "ProjectManager"
DISPLAY_NAME = "项目管理器"
PROJECT_ROLE = "frontend"
# 新增：版本与描述（供前端展示）
VERSION = "1.0.0"
DESCRIPTION = "ModularFlow前端项目（html）"

# 运行命令（DEV_COMMAND 支持 {port} 占位符）
INSTALL_COMMAND = "echo 'No installation required for HTML project'"
DEV_COMMAND = "python -m http.server {port}"
BUILD_COMMAND = "echo 'No build required for HTML project'"

# 如需自定义更多变量，可按需新增；框架将按 SimpleScriptConfig 规则读取