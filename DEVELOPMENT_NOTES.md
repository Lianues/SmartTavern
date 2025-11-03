# 开发注意事项（ModularFlow Framework）

本文件为本仓库的开发约束与最佳实践说明，统一规范“API 优先、门面导入（import core）、端口声明在 modularflow_config.py”。

建议所有后端开发者、前端集成者、模块作者遵循以下约定，确保跨模块/跨项目协作的一致性与可维护性。

## 0) 统一开发者须知（Core 方法并入本文件）

为统一前后端与公共 API 的开发体验，核心方法文档（Core Methods）已并入本开发者文档。今后请以本文件为唯一开发规范参考，避免分散文档导致的偏差。

- 内部端口配置
  - 前端项目与后端项目的“私有端口”（前端/后端/WebSocket）均必须在项目根的 modularflow_config.py 中声明，并保持同一项目的端口一致性：
    - 示例文件：  
      - [frontend_projects/ProjectManager/modularflow_config.py](frontend_projects/ProjectManager/modularflow_config.py)
      - [backend_projects/ProjectManager/modularflow_config.py](backend_projects/ProjectManager/modularflow_config.py)
  - 管理器与网关将基于此配置统一推导 API 地址与端口，避免手工散配。
  - 参考 API 配置读取： [core/config/api_config.py](core/config/api_config.py)

- 公共 API 的调用范式（强制）
  - 统一使用 import core 门面与本地 SDK 客户端进行 API 调用，不关注具体文件路径或内部实现位置：
    - 门面与客户端：  
      - [core/api_client.py](core/api_client.py)
      - [core/api_registry.py](core/api_registry.py)
      - [core/api_gateway.py](core/api_gateway.py)
    - 约定：所有跨模块/跨项目调用必须走“封装层（api/modules/*）或工作流层（api/workflow/*）”+ SDK（core），禁止直接 import 其他模块的 impl。
  - 目标：统一契约（JSON Schema）、统一入口（/api/{namespace}/{path}）、统一跨语言跨进程调用与治理。

- 公共模块/工作流 API 的注册与压缩包格式（供导入时校验）
  - 当要注册为“公共模块（modules）或工作流（workflow）”的 API 时，必须遵守以下导入压缩包路径前缀规范，以便自动识别命名空间：
    - 模块：压缩包中的唯一 .py 文件路径必须以 api/modules/ 开头（例如 api/modules/your_module/your_api.py）
    - 工作流：压缩包中的唯一 .py 文件路径必须以 api/workflow/ 开头（例如 api/workflow/your_flow/your_api.py）
  - 相关能力（前端面板入口“通用 API 文件管理”）会在导入时强制校验上述前缀；不符合将拒绝导入。
    - 能力封装： [api/modules/api_files/api_files.py](api/modules/api_files/api_files.py)

- 项目内部模块与工作流（无需对外暴露）
  - 对于项目内部使用的模块与工作流，不必注册为公共 API；直接放在项目的前端/后端文件夹中，通过项目内部端口调用（端口定义见 modularflow_config.py）。
  - 目的：内部调用更简洁，外部面板无需展示；公共 API 仅保留需要跨项目复用的能力。

- 项目导入的压缩包结构（强制目录根）
  - 导入前端或后端项目时，压缩包的根必须为 myproject/ 这样的目录，而不能直接把文件平铺在压缩包根：
    - 正确示例：  
      - myproject/modularflow_config.py  
      - myproject/src/...  
    - 错误示例：  
      - modularflow_config.py（直接位于压缩包根）  
  - 统一要求便于管理器识别项目根与配置脚本，避免路径不一致导致导入失败。

- 端口一致性（同一项目的前后端）
  - 前端与后端均需提供 modularflow_config.py，并确保同一项目的相关端口保持一致性（例如后端网关端口与 WebSocket 端口策略一致），避免跨组件通信异常或重定向错误。
  - 如需分配与冲突治理，请参考项目管理器实现的端口注册表与偏移策略：  
    - [api/modules/project_manager/impl.py](api/modules/project_manager/impl.py)

上述规范与“Core 方法”均已并入本开发者文档，后续不再维护独立的 CORE_METHODS.md。统一遵循“API 优先、import core 门面、端口在 modularflow_config.py 声明”的原则进行开发。
## A) 动态项目管理（融合 DYNAMIC_PROJECT_MANAGEMENT）

本节将“动态项目管理系统”的关键实践并入开发者文档，统一说明前后端 modularflow_config.py 的使用、端口管理、项目导入结构与简化配置方式。

- 动态发现与管理
  - 框架自动扫描项目目录并读取每个项目根的配置脚本：
    - 前端项目：扫描 [frontend_projects/](frontend_projects/ProjectManager)
    - 后端项目：扫描 [backend_projects/](backend_projects/ProjectManager)
  - 项目根必须提供 modularflow_config.py，以声明项目端口与运行命令：
    - 前端示例： [frontend_projects/ProjectManager/modularflow_config.py](frontend_projects/ProjectManager/modularflow_config.py)
    - 后端示例： [backend_projects/ProjectManager/modularflow_config.py](backend_projects/ProjectManager/modularflow_config.py)

- 简化配置脚本（常量式，推荐）
  - 采用“常量式”脚本，无需定义类/方法；框架通过 SimpleScriptConfig 直接读取：
    - FRONTEND_PORT / BACKEND_PORT / WEBSOCKET_PORT
    - INSTALL_COMMAND / DEV_COMMAND / BUILD_COMMAND（DEV_COMMAND 支持 {port} 占位符）
  - 端口与前缀统一来源：
    - API 配置： [core/config/api_config.py](core/config/api_config.py)
    - 管理器端口注册与动态分配： [api/modules/project_manager/impl.py](api/modules/project_manager/impl.py)

- 端口一致性要求（同一项目的前后端）
  - 同一项目的端口策略需保持一致，避免跨组件通信异常或重定向错误：
    - FRONTEND_PORT 与后端网关 BACKEND_PORT、WebSocket 端口 WEBSOCKET_PORT 的关联策略需在 modularflow_config.py 内统一声明。
  - 端口冲突治理由项目管理器自动处理（注册表 + 偏移），参考：
    - [python.ProjectManager._allocate_port()](api/modules/project_manager/impl.py:267)
    - [python.ProjectManager.get_port_usage()](api/modules/project_manager/impl.py:677)

- 项目导入的压缩包结构（强制目录根）
  - 导入前端或后端项目的压缩包必须以项目根目录命名（例如 myproject/），不能将文件直接平铺在压缩包根：
    - 正确：myproject/modularflow_config.py、myproject/src/...
    - 错误：压缩包根直接包含 modularflow_config.py
  - 这样有助于管理器稳定识别项目根与配置脚本，并避免路径歧义导致导入失败。

- npm start 与端口注入（常见 Node 项目）
  - 若你的项目使用 npm start：
    - DEV_COMMAND = "npm start"（由项目内部处理端口，例如读取 .env 或 PORT 环境变量）
    - 或在命令中注入端口（按平台选择）：
      - Windows（cmd）：DEV_COMMAND = "set PORT={port} && npm start"
      - Unix（bash/zsh）：DEV_COMMAND = "PORT={port} npm start"
    - 若为生产启动、依赖构建产物，需配置 BUILD_COMMAND 或在 DEV_COMMAND 中先构建再启动：
      - BUILD_COMMAND = "npm run build"
      - DEV_COMMAND = "npm run build && npm start"

- 模块调用与公共 API（一致性复述）
  - 跨模块/跨项目调用必须通过 import core 与本地 SDK 调用，不关注具体文件路径：
    - [python.call_api()](core/api_client.py:234)、[python.get_client()](core/api_client.py:216)
  - 仅在 api/modules/* 与 api/workflow/* 注册对外 API（封装层职责），统一使用装饰器并提供 JSON Schema：
    - [python.register_api()](core/api_registry.py:146)
    - API 网关统一暴露： [core/api_gateway.py](core/api_gateway.py)

- 公共模块/工作流 API 的导入包路径前缀（供“API 文件管理”面板校验）
  - 模块脚本 ZIP：唯一 .py 文件路径必须以 api/modules/ 开头
  - 工作流脚本 ZIP：唯一 .py 文件路径必须以 api/workflow/ 开头
  - 面板导入校验实现： [api/modules/api_files/api_files.py](api/modules/api_files/api_files.py)
---

## 1) 门面导入范式（import core）

- 统一通过核心门面使用，不再直接按文件路径导入模块函数。
- 统一范式：
  - Python（SDK 调用）：
    - `result = core.call_api("project_manager/get_status", {"project_name": "ProjectManager"}, method="GET", namespace="modules")`
      见 [python.call_api()](core/api_client.py:227)
  - 获取注册器与服务管理器：
    - `reg = core.get_registry()` 见 [python.get_registry()](core/api_registry.py:133)
    - `svc = core.get_service_manager()` 见 [python.get_service_manager()](core/services.py:204)
  - 获取 API 网关实例（延迟包装，避免循环依赖）：
    - `gateway = core.get_api_gateway()` 见 [python.get_api_gateway()](core/api_gateway.py:831)
  - 读取统一 API 配置：
    - `cfg = core.get_api_config()` 见 [python.get_api_config()](core/config/api_config.py:29)

说明：
- “门面导入”屏蔽了内部文件结构变动，避免硬编码路径与循环依赖。
- 任何涉及跨模块调用，优先通过 core 门面 + API 调用完成。

---

## 2) 模块之间互相调用必须走 API 接口

- 禁止直接 `import` 其他模块的实现层（impl）；模块间调用必须走“API 封装层（api/modules/*）或工作流层（api/workflow/*）”。
- 调用示例（工作流转发模块 API）：
  - `core.call_api("smarttavern/image_binding/get_embedded_files_info", {"image_path": img}, method="GET", namespace="modules")`
    见 [python.api_get_embedded_files_info()](api/workflow/image_binding/image_binding.py:98)

原因：
- 统一契约（JSON Schema）有助于文档生成（OpenAPI）与前后端一致。
- 降低耦合、便于替换实现、支持跨进程/跨服务调用。

---

## 3) 本地客户端（SDK）介绍

- SDK 提供统一 HTTP 调用（自动适配 modules/workflow 命名空间）：
  - `core.call_api(name, payload, method="POST", namespace=None)`：
    - 当 `namespace=None` 时按 `/api/modules` → `/api/workflow` 顺序尝试。
    - 指定命名空间：`namespace="modules"` 或 `namespace="workflow"`。
- 低层方法：
  - [python.ApiClient.request()](core/api_client.py:92) 统一 GET/POST。
  - [python.ApiClient.call_get()](core/api_client.py:167)、[python.ApiClient.call_post()](core/api_client.py:186) 便捷封装。
- SDK 全局客户端：
  - `client: ApiClient = core.get_client()` 见 [python.get_client()](core/api_client.py:216)

示例：
```python
import core

# GET 获取状态
status = core.call_api("project_manager/get_status", {"project_name": "ProjectManager"}, method="GET", namespace="modules")

# POST 启动项目
resp = core.call_api("project_manager/start_project", {"project_name": "ProjectManager", "component": "frontend"}, method="POST", namespace="modules")
```

---

## 4) 核心方法清单（通过 core 门面暴露）

- SDK 与客户端
  - [python.import(core.call_api)](core/__init__.py:12)
  - [python.import(core.get_client)](core/__init__.py:12)
  - [python.import(core.ApiClient)](core/__init__.py:12)
- API 配置
  - [python.import(core.get_api_config)](core/__init__.py:13)
- 注册中心与服务
  - [python.import(core.get_registry)](core/__init__.py:20)
  - [python.import(core.get_registered_api)](core/__init__.py:21)
  - [python.import(core.register_api)](core/__init__.py:22)
  - [python.import(core.get_service_manager)](core/__init__.py:15)
  - [python.import(core.get_current_globals)](core/__init__.py:15)
- API 网关
  - [python.function(core.get_api_gateway)](core/__init__.py:18)（延迟导入包装，避免循环依赖）

---

## 5) 端口开发注意事项

- 所有“私有端口”（前端/后端/WebSocket）必须在项目根的 `modularflow_config.py` 中声明：
  - 必填常量：`FRONTEND_PORT`、`BACKEND_PORT`、`WEBSOCKET_PORT`
  - 运行命令常量：`INSTALL_COMMAND`、`DEV_COMMAND`、`BUILD_COMMAND`
    - `DEV_COMMAND` 支持 `{port}` 占位符。
  - 参考示例： [python.modularflow_config.py](frontend_projects/ProjectManager/modularflow_config.py:1)
- 统一端口读取与生成：
  - 网关统一前缀与基地址由 [python.get_api_config()](core/config/api_config.py:29) 提供（默认 `base_url=http://localhost:8050`，`api_prefix=/api`）。
  - 项目管理模块提供端口使用查询：
    - `core.call_api("project_manager/get_ports", None, method="POST", namespace="modules")`
      见 [python.get_ports()](api/modules/project_manager/project_manager.py:101)
- 端口冲突与分配（后端侧）：
  - 项目管理器内部维护端口注册表并在冲突时偏移，详见：
    - [python.ProjectManager._allocate_port()](api/modules/project_manager/impl.py:155)

---

## 6) API 注册规范（封装层职责）

- 仅在 `api/modules/*` 与 `api/workflow/*` 注册对外 API，统一使用 [python.decorator(core.register_api)](core/__init__.py:22)。
- 内部实现文件（impl.py）仅用于具体逻辑，不直接对外暴露；统一由封装层暴露 API。
- 参考：
  - 模块封装层： [python.image_binding.image_binding.py](api/modules/SmartTavern/image_binding/image_binding.py:1)
  - 工作流封装层： [python.workflow.image_binding.py](api/workflow/image_binding/image_binding.py:1)
  - 项目管理封装层： [python.project_manager.project_manager.py](api/modules/project_manager/project_manager.py:1)
  - 内部实现（供封装层调用）： [python.project_manager.impl.py](api/modules/project_manager/impl.py:1)

---

## 7) WebSocket function_call 约束

- function 名必须为“斜杠路径”；点式与反斜杠将被网关拒绝：
  - 详见 [python.APIGateway._handle_websocket_message()](core/api_gateway.py:676)
- 示例：
```json
{
  "type": "function_call",
  "function": "project_manager/start_project",
  "params": { "project_name": "ProjectManager" }
}
```

---

## 8) 前端调用约定（管理面板）

- 前端 API 客户端默认使用 http://localhost:8050 + /api（参考 [python.get_api_config()](core/config/api_config.py:29) 默认值）
- 管理面板加载数据前确保客户端已就绪（若使用自建客户端可直接调用，无需外部配置文件）
- 统一调用：
  - GET /api/modules/project_manager/get_status → window.apiClient.getProjectStatus()
  - POST /api/modules/project_manager/start_project → window.apiClient.startProject(name)

---

## 9) 最佳实践清单

- 使用 `import core` 门面，不硬编码文件路径。
- 模块间调用必须走 API，严禁直接 `import impl`。
- 所有对外 API 必须提供严格的 JSON Schema（input/output）。
- 端口在 `modularflow_config.py` 中声明，后端管理器负责冲突检测与分配。
- WebSocket function_call 使用斜杠路径；点式路径将被拒绝。
- SDK 调用统一斜杠路径；命名空间自动尝试 `modules → workflow`。
- 文档与契约来源统一使用 JSON Schema；OpenAPI 自动生成校验。

---

## 10) 常见错误与排查

- “Cannot read properties of undefined (reading 'getProjectStatus')”
  - 前端 `window.apiClient` 未初始化；确保按顺序引入 `api.js → main.js` 并调用
    - [javascript.initApiClient()](frontend_projects/ProjectManager/js/api.js:363)
    - [javascript.ensureApiClientReady()](frontend_projects/ProjectManager/js/main.js:289)
- “函数路径格式错误（FUNCTION_PATH_FORMAT）”
  - 使用了点式路径；应改为斜杠路径：`"project_manager/start_project"`。
- “端口冲突”
  - 检查 `modularflow_config.py` 中端口设置并查看
    - [python.ProjectManager.get_port_usage()](api/modules/project_manager/impl.py:565)
    - 后端日志提示的自动偏移。

---

如遇到文档与行为不一致，请以上述“API 优先、import core 门面、端口在 modularflow_config.py 声明”的原则为准，并参照核心代码链接进行校验。