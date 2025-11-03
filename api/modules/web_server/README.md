# 模块：Web 前端服务器管理（web_server）

位置：api/modules/web_server/

本模块提供“前端项目开发服务器与静态站点”的统一管理能力：列出前端项目、启动/停止/重启单个或全部项目、查询项目信息、创建基础项目结构、按项目专属配置加载、查询运行中服务器列表等。遵循统一“斜杠 path + JSON Schema”规范，通过 core 门面对外暴露 API。

相关代码
- 封装与注册（对外 API 定义/Schemas）： [python.web_server.web_server.py](api/modules/web_server/web_server.py:1)
  - 列出前端项目： [python.list_frontend_projects()](api/modules/web_server/web_server.py:27)
  - 启动项目： [python.start_frontend_project()](api/modules/web_server/web_server.py:54)
  - 停止项目： [python.stop_frontend_project()](api/modules/web_server/web_server.py:85)
  - 重启项目： [python.restart_frontend_project()](api/modules/web_server/web_server.py:116)
  - 启动全部： [python.start_all_projects()](api/modules/web_server/web_server.py:145)
  - 停止全部： [python.stop_all_projects()](api/modules/web_server/web_server.py:174)
  - 获取项目信息： [python.get_project_information()](api/modules/web_server/web_server.py:203)
  - 获取运行中服务器： [python.get_running_servers()](api/modules/web_server/web_server.py:226)
  - 创建项目结构： [python.create_project_structure()](api/modules/web_server/web_server.py:252)
  - 加载项目专属配置： [python.load_project_config()](api/modules/web_server/web_server.py:283)
- 实现层（核心逻辑）： [filename](api/modules/web_server/impl.py:1)
  - 前端项目模型： [python.FrontendProject](api/modules/web_server/impl.py:35)
  - 静态文件服务器： [python.StaticFileServer](api/modules/web_server/impl.py:62)
  - 开发服务器管理器： [python.DevServer](api/modules/web_server/impl.py:140)
  - Web 服务器主类： [python.WebServer](api/modules/web_server/impl.py:310)
  - 单例获取： [python.get_web_server()](api/modules/web_server/impl.py:641)

模块功能
- 项目清单：列出配置中可管理的前端项目（HTML/静态/React/Vue/Python 等类型）。
- 单项目控制：按项目名启动、停止、重启；可选择是否自动打开浏览器。
- 批量控制：启动所有“启用”的前端项目；停止全部项目。
- 信息查询：获取项目详细信息（类型、路径、端口、命令、依赖、状态等），以及当前运行中的服务器列表。
- 项目初始化：在指定路径创建基础结构（HTML 项目包含基础 index.html/css/js 目录）。
- 专属配置：为某个项目加载专用配置文件（通常随项目仓库存放）。

依赖与约束
- 项目配置来源于实现层自动加载的配置文件或传入的 `project_config`；可通过 API 提供 `config_path` 指定配置文件位置。
- Node/前端类项目需在配置中声明适当的 `dev_command`；静态/HTML 项目可使用内置静态文件服务器。
- Windows 下 Node 进程支持独立控制台创建；停止时尽量使用进程树终止，避免僵尸进程。

API 一览与 I/O 说明

1) web_server/list_projects（列出前端项目）
- 定义： [python.list_frontend_projects()](api/modules/web_server/web_server.py:27)
- 输入（JSON）：
  - config_path?: string（可选，前端项目配置文件路径）
- 输出（JSON）：
  - projects: object[]（每项包含 name/display_name/type/path/port/api_endpoint/enabled/description/server_status 等）

2) web_server/start_project（启动前端项目）
- 定义： [python.start_frontend_project()](api/modules/web_server/web_server.py:54)
- 输入（JSON）：
  - project_name: string（必填）
  - open_browser?: boolean（可选，默认 true，自动打开浏览器）
  - config_path?: string（可选，配置文件路径）
- 输出（JSON）：
  - success: boolean
  - project: string
  - message: string

3) web_server/stop_project（停止前端项目）
- 定义： [python.stop_frontend_project()](api/modules/web_server/web_server.py:85)
- 输入（JSON）：
  - project_name: string（必填）
  - config_path?: string
- 输出（JSON）：
  - success: boolean
  - project: string
  - message: string

4) web_server/restart_project（重启前端项目）
- 定义： [python.restart_frontend_project()](api/modules/web_server/web_server.py:116)
- 输入（JSON）：
  - project_name: string（必填）
  - config_path?: string
- 输出（JSON）：
  - success: boolean
  - project: string
  - message: string

5) web_server/start_all（启动所有启用的前端项目）
- 定义： [python.start_all_projects()](api/modules/web_server/web_server.py:145)
- 输入（JSON）：
  - config_path?: string
- 输出（JSON）：
  - results: object（键为项目名，值为 boolean）
  - total: number
  - successful: number

6) web_server/stop_all（停止所有前端项目）
- 定义： [python.stop_all_projects()](api/modules/web_server/web_server.py:174)
- 输入（JSON）：
  - config_path?: string
- 输出（JSON）：
  - results: object（键为项目名，值为 boolean）
  - total: number
  - successful: number

7) web_server/project_info（获取项目信息）
- 定义： [python.get_project_information()](api/modules/web_server/web_server.py:203)
- 输入（JSON）：
  - project_name: string（必填）
  - config_path?: string
- 输出（JSON）：
  - object（项目详情；不存在时返回 {error: "..."}）

8) web_server/running_servers（获取运行中服务器列表）
- 定义： [python.get_running_servers()](api/modules/web_server/web_server.py:226)
- 输入（JSON）：
  - config_path?: string
- 输出（JSON）：
  - servers: object[]（每项包含 name/port/pid/start_time/url）

9) web_server/create_structure（创建项目基础结构）
- 定义： [python.create_project_structure()](api/modules/web_server/web_server.py:252)
- 输入（JSON）：
  - project_name: string（必填）
  - config_path?: string
- 输出（JSON）：
  - success: boolean
  - project: string
  - message: string

10) web_server/load_project_config（加载项目专属配置）
- 定义： [python.load_project_config()](api/modules/web_server/web_server.py:283)
- 输入（JSON）：
  - project_name: string（必填）
  - project_config_path: string（必填，专属配置文件路径）
- 输出（JSON）：
  - success: boolean
  - project: string
  - message: string

调用示例（Python SDK）

- 启动项目并自动打开浏览器
```python
import core
core.call_api(
  "web_server/start_project",
  {"project_name": "ProjectManager", "open_browser": True},
  method="POST",
  namespace="modules"
)
```

- 启动全部启用的项目
```python
res = core.call_api("web_server/start_all", None, method="POST", namespace="modules")
# {"results":{"ProjectManager":true,...}, "total":N, "successful":K}
```

- 查询运行中服务器
```python
res = core.call_api("web_server/running_servers", None, method="GET", namespace="modules")
# {"servers":[{"name":"...","port":3000,"pid":12345,"url":"http://localhost:3000"},...]}
```

注意事项
- config_path 未提供时，实施层会尝试多个默认位置查找配置文件；若仍找不到，仅能列出/管理已在内存中的配置项目。
- React/Vue 等前端项目需在配置里为 `dev_command` 提供正确命令（例如 npm/yarn/pnpm）；静态/HTML 项目可直接使用内置静态服务器。
- Windows 平台停止 Node 进程时会尝试使用 taskkill 终止进程树（见实现层终止逻辑）。
- 自动打开浏览器可能因系统策略失败；实现层会记录警告日志但不影响服务器启动。
- 在生产环境中建议限制这些“管理类 API”的访问权限（基于 API 网关的鉴权中间件）。

错误与边界
- 项目名不存在、路径无效、命令缺失、端口冲突等情况，将返回 success=false 或 error 字段，需在上层 UI 做提示处理。
- 启动失败后再次启动会根据实现层状态进行幂等处理（若已在运行则直接返回成功或提示已运行）。
- create_structure 仅创建最小骨架，不包含打包/脚手架复杂逻辑。

版本与变更
- 初版：提供前端项目生命周期控制、信息查询与项目初始化能力，遵循 DEVELOPMENT_NOTES 统一规范。