# 动态项目管理系统

## 概述

ModularFlow Framework 现在支持动态项目发现和管理，不再需要维护静态的项目配置列表。系统会自动扫描 `frontend_projects/` 目录下的所有项目，并通过每个项目根目录下的 `modularflow_config.py` 配置脚本来获取项目信息。

## 🚀 主要特性

### 1. 动态项目发现
- 自动扫描 `frontend_projects/` 目录
- 检测每个子目录中的 `modularflow_config.py` 配置脚本
- 支持多种项目类型：React、Next.js、Vue、HTML等
- 实时项目状态监控和健康检查

### 2. 简化配置脚本
- 使用常量式配置：无需定义类/方法，框架通过 SimpleScriptConfig 直接读取常量
- DEV_COMMAND 支持 `{port}` 占位符，运行时自动替换为 FRONTEND_PORT
- 未提供 INSTALL_COMMAND/BUILD_COMMAND 时自动跳过安装/构建（安全默认）
- 自动回退：没有配置脚本时使用默认配置

### 3. 智能端口管理
- 自动端口分配和冲突检测
- 端口注册表防止重复占用
- 支持端口动态更新和范围扫描
- 项目间端口隔离

### 4. 项目导入功能
- 支持从ZIP压缩包导入项目
- 自动解压到 `frontend_projects/` 目录
- 立即发现和注册新导入的项目
- 智能备份现有项目

## 📁 项目结构要求

每个前端项目应该具有以下结构：

```
frontend_projects/
├── your_project_name/
│   ├── modularflow_config.py    # 配置脚本（推荐）
│   ├── package.json             # Node.js项目
│   ├── index.html               # HTML项目
│   └── ... (其他项目文件)
```

## 🔧 简化配置脚本格式

### 简化格式（常量式，推荐）

说明：
- 配置脚本无需定义类/方法，框架会通过 SimpleScriptConfig 直接读取常量。
- DEV_COMMAND 支持 `{port}` 占位符，框架在运行时自动替换为 FRONTEND_PORT。
- 若未提供 INSTALL_COMMAND/BUILD_COMMAND，框架将使用安全的默认行为（跳过安装/构建）。

示例（HTML 项目，参考 [python.modularflow_config.py](frontend_projects/ProjectManager/modularflow_config.py:1)）：
```python
#!/usr/bin/env python3
"""
前端项目简化配置脚本（常量式）
由框架 SimpleScriptConfig 自动读取，不需定义类/方法
"""

# 基本端口
FRONTEND_PORT = 8055
BACKEND_PORT = 8050
WEBSOCKET_PORT = 8051

# 项目信息
PROJECT_NAME = "ProjectManager"
DISPLAY_NAME = "项目管理器"
PROJECT_TYPE = "html"
VERSION = "1.0.0"
DESCRIPTION = "ModularFlow前端项目（html）"

# 运行命令（DEV_COMMAND 支持 {port} 占位符）
INSTALL_COMMAND = "echo 'No installation required for HTML project'"
DEV_COMMAND = "python -m http.server {port}"
BUILD_COMMAND = "echo 'No build required for HTML project'"

# 如需自定义更多变量，可按需新增；框架将按 SimpleScriptConfig 规则读取
```
### 示例（Node.js/Next.js 项目）

```python
#!/usr/bin/env python3
"""
前端项目简化配置脚本（常量式）—— Node.js/Next.js 示例
由框架 SimpleScriptConfig 自动读取，不需定义类/方法
"""

# 基本端口（可按需修改）
FRONTEND_PORT = 3000
BACKEND_PORT = 8050
WEBSOCKET_PORT = 8051

# 项目信息
PROJECT_NAME = "MyNodeProject"
DISPLAY_NAME = "我的 Node 项目"
PROJECT_TYPE = "nextjs"  # 可选：nextjs, react, vue, html
VERSION = "1.0.0"
DESCRIPTION = "基于 Next.js 的前端项目"

# 运行命令
# - 默认使用 npm 脚本；建议在项目内部处理端口（如读取 .env 或 PORT 环境变量）
INSTALL_COMMAND = "npm install"
DEV_COMMAND = "npm run dev"
BUILD_COMMAND = "npm run build"

# 如需将端口传入开发命令，可参考以下两种方式（按平台选用）：
# - Windows（cmd）：将端口注入环境变量后再运行脚本
# DEV_COMMAND = "set PORT={port} && npm run dev"
# - Unix（bash/zsh）：以环境变量方式注入端口
# DEV_COMMAND = "PORT={port} npm run dev"

# 如需自定义更多变量，可按需新增；框架将按 SimpleScriptConfig 规则读取
```

### 调试与验证

```bash
# 启动统一管理面板（会自动发现前端项目并读取配置脚本）
python backend_projects/ProjectManager/start_server.py

# 运行示例 HTML 项目本地开发服务器（若需独立启动，请替换端口）
python -m http.server 8055

# 在管理面板中查看项目端口与运行状态：
# 访问: http://localhost:8055
# API 网关文档: http://localhost:8050/docs
```
---

### 使用 npm start（快速配置说明）

- 开发或启动脚本使用 npm start 时，仅需将 DEV_COMMAND 替换为 "npm start" 即可：
  - 示例：在 [python.modularflow_config.py](frontend_projects/ProjectManager/modularflow_config.py:1) 中设置 DEV_COMMAND="npm start"
- 如需端口注入（你的项目通过 PORT 环境变量读取端口）：
  - Windows（cmd）：DEV_COMMAND = "set PORT={port} && npm start"
  - Unix（bash/zsh）：DEV_COMMAND = "PORT={port} npm start"
- 若 npm start 为生产启动，且依赖构建产物：
  - 将 BUILD_COMMAND 设置为 "npm run build"，并在启动前执行构建
  - 或将 DEV_COMMAND 设置为 "npm run build && npm start"（一条命令内先构建再启动）
- 其余常量（FRONTEND_PORT/BACKEND_PORT/WEBSOCKET_PORT、PROJECT_NAME/DISPLAY_NAME/PROJECT_TYPE/版本与描述）保持与常量式配置一致，框架会通过 SimpleScriptConfig 自动读取。

最简示例（Next.js 项目，使用 npm start）：
```python
#!/usr/bin/env python3
# 常量式配置脚本（npm start 版本）

# 端口
FRONTEND_PORT = 3000
BACKEND_PORT = 8050
WEBSOCKET_PORT = 8051

# 项目信息
PROJECT_NAME = "MyNodeProject"
DISPLAY_NAME = "我的 Node 项目"
PROJECT_TYPE = "nextjs"
VERSION = "1.0.0"
DESCRIPTION = "基于 Next.js 的前端项目（npm start）"

# 运行命令（任选其一）
INSTALL_COMMAND = "npm install"
# 方案A：项目内部自处理端口
DEV_COMMAND = "npm start"
# 方案B：Windows 端口注入（cmd）
# DEV_COMMAND = "set PORT={port} && npm start"
# 方案C：Unix 端口注入（bash/zsh）
# DEV_COMMAND = "PORT={port} npm start"

# 若使用生产启动且依赖构建产物，设置 BUILD_COMMAND 或合并到 DEV_COMMAND
BUILD_COMMAND = "npm run build"
# DEV_COMMAND = "npm run build && npm start"

---

## 开发注意事项（端口与模块调用）

- 私有端口必须在 modularflow_config.py 中注册
  - 每个前端项目的根目录必须提供 `FRONTEND_PORT`、`BACKEND_PORT`、`WEBSOCKET_PORT` 常量，详见 [python.modularflow_config.py 示例](frontend_projects/ProjectManager/modularflow_config.py:1)。
  - 运行命令常量 `INSTALL_COMMAND`、`DEV_COMMAND`、`BUILD_COMMAND` 必须以项目为单位声明，其中 `DEV_COMMAND` 支持 `{port}` 占位符。
- 统一通过核心门面调用
  - 后端调用统一使用 `import core`：
    `core.call_api("project_manager/get_status", {"project_name": "ProjectManager"}, method="GET", namespace="modules")` 见 [python.call_api()](core/api_client.py:227)
  - 禁止跨模块直接 import 实现层（impl）；模块间调用必须走 API 封装层与工作流层。
- 端口管理与查询
  - API 网关统一接口前缀与基地址由 [python.get_api_config()](core/config/api_config.py:29) 提供。
  - 项目管理器提供端口使用查询与分配，详见 [python.ProjectManager.get_port_usage()](api/modules/project_manager/impl.py:565)、[python.ProjectManager._allocate_port()](api/modules/project_manager/impl.py:155)。
- 对外 API 注册位置
  - 仅在 api/modules/* 与 api/workflow/* 注册对外 API，统一使用 [python.decorator(core.register_api)](core/__init__.py:22)。
    内部实现（impl.py）不直接对外暴露，统一由封装层暴露。
```