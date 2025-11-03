# 模块：API 文件管理（api_files）

位置：api/modules/api_files/

本模块提供“API 文件管理”能力，用于列出当前注册到网关的模块/工作流脚本所在目录、以及危险操作的目录删除和便捷导入脚本（支持 ZIP 包与 PNG 图片中嵌入的 ZIP）。遵循统一的“斜杠 path + JSON Schema”规范，通过 core 门面注册对外 API。

相关代码
- 封装与实现： [python.api_files.api_files.py](api/modules/api_files/api_files.py:1)
  - 列出 API 文件夹： [python.list_api_folders()](api/modules/api_files/api_files.py:143)
  - 删除 API 文件夹： [python.delete_api_folder()](api/modules/api_files/api_files.py:192)
  - 导入脚本（zip）： [python.import_api_script()](api/modules/api_files/api_files.py:288)
  - 从图片导入脚本： [python.import_api_script_from_image()](api/modules/api_files/api_files.py:359)
- 依赖的注册中心/网关门面：  
  - [python.import(core.get_registry)](core/__init__.py:20)  
  - [python.import(core.get_api_gateway)](core/__init__.py:18)

模块功能
- 按命名空间（modules/workflow）统计已注册 API 所属脚本目录，便于文件级运维和管理。
- 删除指定命名空间下的目录（危险操作，内置路径越界保护）。
- 导入单个 .py API 脚本（zip 内仅一个 .py，且路径前缀必须是 api/modules 或 api/workflow）。
- 从 PNG 图片中反嵌入 zip，解出并导入单个 .py API 脚本（结合项目管理模块的图片解包能力）。

依赖与约束
- 路径规范（强制）：  
  - 模块脚本路径必须以 api/modules/ 开头  
  - 工作流脚本路径必须以 api/workflow/ 开头  
  - 见校验函数： [python._validate_member_path()](api/modules/api_files/api_files.py:241)
- 安全提取：统一通过受控写入，防止目录穿越。  
  - 见安全提取： [python._safe_extract_member()](api/modules/api_files/api_files.py:257)
- 图片反嵌入：依赖项目管理模块的实现：  
  - [python.project_manager.extract_zip_from_image()](api/modules/project_manager/project_manager.py:256)

API 一览

1) api_files/list_folders（列出 API 文件夹）
- 注册函数： [python.list_api_folders()](api/modules/api_files/api_files.py:143)
- 输入（JSON）：
  - {}
- 输出（JSON）：
  - modules: object[]（每项包含 relative_path/abs_path/api_count/name/apis[]）
  - workflow: object[]
  - totals: { modules: number, workflow: number }

输出字段说明
- relative_path: string 相对 api/modules 或 api/workflow 的目录，比如 "SmartTavern/in_chat_constructor"
- abs_path: string 绝对路径
- api_count: number 该目录下注册 API 的数量
- name: string 目录名（最后一段）
- apis: object[]（每个 API 的 name/description/path/namespace）

2) api_files/delete_folder（删除 API 文件夹，危险）
- 注册函数： [python.delete_api_folder()](api/modules/api_files/api_files.py:192)
- 输入（JSON）：
  - namespace: "modules" | "workflow"
  - relative_path: string 相对路径（如 "SmartTavern/in_chat_constructor"）
- 输出（JSON）：
  - success: boolean
  - message?: string
  - deleted_path?: string

安全策略
- 仅允许删除 api/{namespace}/ 下的子目录，越界将被拒绝（相对路径检查，见 [python.delete_api_folder()](api/modules/api_files/api_files.py:201)）。
- 目标必须存在且为目录。

3) api_files/import_script（导入单个脚本 .py，来源 zip）
- 注册函数： [python.import_api_script()](api/modules/api_files/api_files.py:288)
- 输入（JSON/表单）：
  - archive: string | File-like（zip 数据）
  - namespace: "modules" | "workflow"
- 输出（JSON）：
  - success: boolean
  - message?: string
  - written_path?: string（写入到框架根的实际路径）
  - namespace?: string
  - module?: string（导入用的模块名）
  - imported?: boolean（是否已动态 import 并注册）

规则
- zip 里必须且只能包含一个 .py 文件（见 [python.import_api_script()](api/modules/api_files/api_files.py:307)）。
- 该 .py 路径必须以 "api/{namespace}/" 开头，且后缀为 .py，方可提取写入（见 [python._validate_member_path()](api/modules/api_files/api_files.py:241)）。

4) api_files/import_script_from_image（从 PNG 反嵌入 zip 后导入单个脚本）
- 注册函数： [python.import_api_script_from_image()](api/modules/api_files/api_files.py:359)
- 输入（JSON/表单）：
  - image: string | File-like（PNG 图像）
  - namespace: "modules" | "workflow"
- 输出（JSON）：
  - success: boolean
  - message?: string
  - written_path?: string
  - namespace?: string

流程
- 通过项目管理实现 [python.project_manager.extract_zip_from_image()](api/modules/project_manager/project_manager.py:256) 将 PNG 中的 zip 提取到临时路径。
- 对 zip 内唯一的 .py 文件执行与 import_script 相同的路径规范校验与安全提取。

示例调用（Python SDK）

- 列出 API 文件夹
```python
import core
res = core.call_api("api_files/list_folders", None, method="GET", namespace="modules")
# 形如：{"modules":[{...}], "workflow":[{...}], "totals":{"modules":N,"workflow":M}}
```

- 删除目录（危险）
```python
payload = {"namespace":"modules","relative_path":"SmartTavern/in_chat_constructor"}
res = core.call_api("api_files/delete_folder", payload, method="POST", namespace="modules")
```

- 从 zip 导入单个脚本
```python
# archive 为 zip 的二进制或文件对象；下例以占位符演示
payload = {"archive": "<zip-bytes>", "namespace": "modules"}
res = core.call_api("api_files/import_script", payload, method="POST", namespace="modules")
```

- 从 PNG 反嵌入 zip 并导入单个脚本
```python
payload = {"image": "<png-bytes>", "namespace": "workflow"}
res = core.call_api("api_files/import_script_from_image", payload, method="POST", namespace="modules")
```

注意事项
- 删除操作不可逆，谨慎执行。建议在 CI 或面板提供二次确认与备份。
- 导入仅支持“单文件脚本”场景，复杂模块请通过常规项目导入流水线处理。
- 所有路径判断大小写敏感与否由底层文件系统决定；建议统一使用小写路径和 / 分隔符（模块已归一化）。
- 生产环境不建议开放 delete/import 能力给未授权用户；请配合 API 网关鉴权中间件。

错误与返回
- 路径越界或不存在时返回 success=false 与 message。
- zip 结构不合要求或解包失败时返回详细错误 message。
- 图片无法反嵌入 zip 时将返回来自项目管理实现的错误信息。

测试建议
- 使用内置的“列出 API 文件夹”快速验证注册器与路径映射： [python.list_api_folders()](api/modules/api_files/api_files.py:143)
- 为删除与导入提供单元/集成测试，隔离测试目录，避免污染仓库树。

版本与变更
- 初版：目录枚举 + 删除 + 脚本导入（zip / image）能力，全面遵循 DEVELOPMENT_NOTES 规范。