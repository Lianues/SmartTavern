#!/usr/bin/env python3
"""
PromptEditor 简化配置脚本（常量式）
- 由框架 SimpleScriptConfig 读取，无需定义类/方法
- 端口一致性：本前端将直连本地 API 网关（见 core/config/api_config.py）
"""

# 基本端口
FRONTEND_PORT = 5178
BACKEND_PORT = 8050
WEBSOCKET_PORT = 8050

# 项目信息
PROJECT_NAME = "PromptEditor"
DISPLAY_NAME = "提示词编辑器"
PROJECT_ROLE = "frontend"
VERSION = "0.1.0"
DESCRIPTION = "基于 Vue + Vite 的提示词编辑器（前端）"

# 运行命令（DEV_COMMAND 支持 {port} 占位符）
INSTALL_COMMAND = "npm install"
DEV_COMMAND = "npm run dev -- --port {port}"
BUILD_COMMAND = "npm run build"

# 可按需扩展更多常量；框架将按 SimpleScriptConfig 规则读取