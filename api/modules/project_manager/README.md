# 模块：项目管理（project_manager）

位置：api/modules/project_manager/

本模块提供“动态项目管理”能力，统一管理前端/后端项目的导入、启动/停止/重启、端口状态、依赖安装、配置校验，以及将 ZIP 嵌入/提取于 PNG 的便捷运维工具。遵循统一“斜杠 path + JSON Schema”规范，通过 core 门面对外暴露 API。

相关代码
- 封装与注册： [python.project_manager.project_manager.py](api/modules/project_manager/project_manager.py:1)
  - 启动项目： [python.start_project()](api/modules/project_manager/project_manager.py:39)
  - 停止项目： [python.stop_project()](api/modules/project_manager/project_manager.py:57)
  - 重启项目： [python.restart_project()](api/modules/project_manager/project_manager.py:75)
  - 获取状态： [python.get_status()](api/modules/project_manager/project_manager.py:90)
  - 端口使用： [python.get_ports()](api/modules/project_manager/project_manager.py:101)
  - 健康检查： [python.health_check()](api/modules/project_manager/project_manager.py:112)
  - 获取可管理项目： [python.get_managed_projects()](api/modules/project_manager/project_manager.py:127)
  - 导入项目（zip）： [python.import_project()](api/modules/project_manager/project_manager.py:141)
  - 删除项目： [python.delete_project()](api/modules/project_manager/project_manager.py:155)
  - 更新端口配置： [python.update_ports()](api/modules/project_manager/project_manager.py:172)
  - 刷新项目列表： [python.refresh_projects()](api/modules/project_manager/project_manager.py:182)
  - 安装依赖： [python.install_project()](api/modules/project_manager/project_manager.py:196)
  - 获取项目配置： [python.get_project_config()](api/modules/project_manager/project_manager.py:210)
  - 校验配置脚本： [python.validate_config_script()](api/modules/project_manager/project_manager.py:224)
  - ZIP→PNG 嵌入： [python.embed_zip_into_image()](api/modules/project_manager/project_manager.py:242)
  - PNG→ZIP 提取： [python.extract_zip_from_image()](api/modules/project_manager/project_manager.py:256)
  - 从图片导入项目： [python.import_project_from_image()](api/modules/project_manager/project_manager.py:270)
  - 导入后端项目（zip）： [python.import_backend_project()](api/modules/project_manager/project_manager.py:284)
  - 从图片导入后端项目： [python.import_backend_project_from_image()](api/modules/project_manager/project_manager.py:301)
- 实现层（细节见 impl.py）： [filename](api/modules/project_manager/impl.py:1)
- 统一规范参考： [filename](DEVELOPMENT_NOTES.md:1)

模块功能
- 启停控制：对被管理的项目前端/后端组件进行启动、停止、重启。
- 发现与状态：列出管理的项目、健康检查、查询项目/端口状态。
- 导入/删除：以 ZIP 包导入项目（要求项目根含 modularflow_config.py），或删除已导入项目。
- 端口管理：更新项目端口配置，读取/刷新项目列表。
- 配置治理：获取项目配置、校验 modularflow_config.py。
- 资产打包：将 ZIP 嵌入 PNG 或从 PNG 提取 ZIP；支持从图片导入项目（结合图像管道分发）。

API 一览与 I/O 说明

1) project_manager/start_project（启动被管理的项目）
- 定义： [python.start_project()](api/modules/project_manager/project_manager.py:39)
- 输入（JSON）：
  - project_name: string（必填）
  - component?: string（默认 "all"，可选组件）
- 输出（JSON）：实现层返回对象，包含启动结果与详情

2) project_manager/stop_project（停止被管理的项目）
- 定义： [python.stop_project()](api/modules/project_manager/project_manager.py:57)
- 输入（JSON）：
  - project_name: string（必填）
  - component?: string（默认 "all"）
- 输出（JSON）：实现层返回对象

3) project_manager/restart_project（重启被管理的项目）
- 定义： [python.restart_project()](api/modules/project_manager/project_manager.py:75)
- 输入（JSON）：
  - project_name: string（必填）
  - component?: string（默认 "all"）
- 输出（JSON）：实现层返回对象

4) project_manager/get_status（获取项目状态）
- 定义： [python.get_status()](api/modules/project_manager/project_manager.py:90)
- 输入（JSON）：
  - project_name?: string（为空则返回整体状态）
- 输出（JSON）：实现层返回对象（状态摘要/详情）

5) project_manager/get_ports（获取端口使用情况）
- 定义： [python.get_ports()](api/modules/project_manager/project_manager.py:101)
- 输入（JSON）：{}
- 输出（JSON）：端口使用映射（实现层定义）

6) project_manager/health_check（执行健康检查）
- 定义： [python.health_check()](api/modules/project_manager/project_manager.py:112)
- 输入（JSON）：{}
- 输出（JSON）：键为项目名、值为项目状态的对象

7) project_manager/get_managed_projects（获取可管理项目列表）
- 定义： [python.get_managed_projects()](api/modules/project_manager/project_manager.py:127)
- 输入（JSON）：{}
- 输出（JSON）：列表/映射（实现层定义）

8) project_manager/import_project（导入项目）
- 定义： [python.import_project()](api/modules/project_manager/project_manager.py:141)
- 输入（JSON/表单）：
  - project_archive: string | File-like（zip 数据；根目录必须包含 modularflow_config.py）
- 输出（JSON）：导入结果，包含路径/项目名等

9) project_manager/delete_project（删除项目）
- 定义： [python.delete_project()](api/modules/project_manager/project_manager.py:155)
- 输入（JSON）：
  - project_name: string（必填）
- 输出（JSON）：删除结果

10) project_manager/update_ports（更新项目端口配置）
- 定义： [python.update_ports()](api/modules/project_manager/project_manager.py:172)
- 输入（JSON）：
  - project_name: string（必填）
  - ports: object（必填；{FRONTEND_PORT,BACKEND_PORT,WEBSOCKET_PORT,...}）
- 输出（JSON）：更新结果

11) project_manager/refresh_projects（刷新项目列表）
- 定义： [python.refresh_projects()](api/modules/project_manager/project_manager.py:182)
- 输入（JSON）：{}
- 输出（JSON）：刷新结果（数量、列表变化等）

12) project_manager/install_project（安装项目依赖）
- 定义： [python.install_project()](api/modules/project_manager/project_manager.py:196)
- 输入（JSON）：
  - project_name: string（必填）
- 输出（JSON）：安装过程与结果摘要

13) project_manager/get_project_config（获取项目配置信息）
- 定义： [python.get_project_config()](api/modules/project_manager/project_manager.py:210)
- 输入（JSON）：
  - project_name: string（必填）
- 输出（JSON）：配置详情（端口、命令、路径等）

14) project_manager/validate_config_script（验证项目配置脚本）
- 定义： [python.validate_config_script()](api/modules/project_manager/project_manager.py:224)
- 输入（JSON）：
  - project_name: string（必填）
- 输出（JSON）：校验结果（通过/错误列表等）

15) project_manager/embed_zip_into_image（将 zip 嵌入 PNG）
- 定义： [python.embed_zip_into_image()](api/modules/project_manager/project_manager.py:242)
- 输入（JSON/表单）：
  - image: string | File-like（PNG）
  - archive: string | File-like（zip）
- 输出（JSON）：成功标志、产物（base64/路径等，视实现层）

16) project_manager/extract_zip_from_image（从 PNG 提取 zip）
- 定义： [python.extract_zip_from_image()](api/modules/project_manager/project_manager.py:256)
- 输入（JSON/表单）：
  - image: string | File-like（PNG）
- 输出（JSON）：提取结果（zip_path/清单等）

17) project_manager/import_project_from_image（从图片导入项目）
- 定义： [python.import_project_from_image()](api/modules/project_manager/project_manager.py:270)
- 输入（JSON/表单）：
  - image: string | File-like（PNG）
- 输出（JSON）：导入结果

18) project_manager/import_backend_project（导入后端项目）
- 定义： [python.import_backend_project()](api/modules/project_manager/project_manager.py:284)
- 输入（JSON/表单）：
  - project_archive: string | File-like（zip）
- 输出（JSON）：导入结果

19) project_manager/import_backend_project_from_image（从图片导入后端项目）
- 定义： [python.import_backend_project_from_image()](api/modules/project_manager/project_manager.py:301)
- 输入（JSON/表单）：
  - image: string | File-like（PNG）
- 输出（JSON）：导入结果

调用示例（Python SDK）

- 启动/停止项目
```python
import core
core.call_api("project_manager/start_project", {"project_name":"ProjectManager","component":"frontend"}, method="POST", namespace="modules")
core.call_api("project_manager/stop_project", {"project_name":"ProjectManager"}, method="POST", namespace="modules")
```

- 导入项目（zip）
```python
res = core.call_api("project_manager/import_project", {"project_archive":"<zip bytes or file>"}, method="POST", namespace="modules")
```

- 更新端口
```python
core.call_api("project_manager/update_ports", {"project_name":"ProjectManager","ports":{"FRONTEND_PORT":9000,"BACKEND_PORT":8050,"WEBSOCKET_PORT":8060}}, method="POST", namespace="modules")
```

注意事项
- 导入 zip 的项目根必须包含 modularflow_config.py，配置常量参考统一规范： [python.frontend_projects.ProjectManager.modularflow_config.py](frontend_projects/ProjectManager/modularflow_config.py:1), [python.backend_projects.ProjectManager.modularflow_config.py](backend_projects/ProjectManager/modularflow_config.py:1)
- 端口一致性：同一项目的前后端与 WebSocket 端口策略需一致，冲突时管理器会处理偏移（详见实现层）。
- 图片嵌入/提取用于“运维分发”，请在生产环境中限制权限并校验输入。
- 健康检查可能耗时，建议在后台或定时任务中执行。

错误与边界
- 项目不存在/路径无效/端口冲突时返回错误对象（实现层定义 message/code）。
- zip/PNG 处理失败将返回详细错误原因。
- 某些 API 为幂等操作（多次调用返回一致状态），上层应做好 UI 提示。

版本与变更
- 初版：提供项目全生命周期管理 + 资产嵌入/提取工具，遵循 DEVELOPMENT_NOTES 统一规范。