# 模块：API 网关（api_gateway）

位置：api/modules/api_gateway/

本模块为“API 网关”对外封装层，遵循统一的“斜杠 path + JSON Schema”规范。它通过 core 门面启动/停止网关、查询网关信息、广播 WebSocket 消息，以及枚举当前已注册的全部 API 定义（包含输入/输出 Schema），便于面板与运维工具集成。

相关代码
- 封装与注册： [python.api_gateway.api_gateway.py](api/modules/api_gateway/api_gateway.py:1)
  - 启动网关： [python.api_gateway_start()](api/modules/api_gateway/api_gateway.py:29)
  - 停止网关： [python.api_gateway_stop()](api/modules/api_gateway/api_gateway.py:45)
  - 网关信息： [python.api_gateway_info()](api/modules/api_gateway/api_gateway.py:71)
  - 广播消息： [python.api_gateway_broadcast()](api/modules/api_gateway/api_gateway.py:98)
  - 列出已注册 API： [python.api_gateway_list_apis()](api/modules/api_gateway/api_gateway.py:131)
- 依赖的核心网关： [python.import(core.get_api_gateway)](core/__init__.py:18), [python.import(core.get_registry)](core/__init__.py:20)

模块功能
- 启动/停止 API 网关 HTTP+WebSocket 服务（可后台运行）。
- 获取运行期信息（端点数、中间件数、活跃 WebSocket 连接数、当前配置）。
- WebSocket 广播消息，向所有连接分发一条 JSON 消息。
- 列出当前进程中通过装饰器注册的全部 API（含 Schema），便于前端面板自动生成文档或调试工具。

API 一览与 I/O 说明

1) api_gateway/start（启动网关）
- 定义： [python.api_gateway_start()](api/modules/api_gateway/api_gateway.py:29)
- 输入（JSON）：
  - background?: boolean（默认 true，后台启动）
  - config_file?: string（可选，显式提供配置文件路径）
- 输出（JSON）：
  - status: string（"started"）
  - background?: boolean

2) api_gateway/stop（停止网关）
- 定义： [python.api_gateway_stop()](api/modules/api_gateway/api_gateway.py:45)
- 输入（JSON）：{}
- 输出（JSON）：
  - status: string（"stopped"）

3) api_gateway/info（获取网关信息）
- 定义： [python.api_gateway_info()](api/modules/api_gateway/api_gateway.py:71)
- 输入（JSON）：
  - config_file?: string（可选；用于以该配置实例化/读取）
- 输出（JSON）：
  - endpoints: number（已注册端点数量）
  - middlewares: number（中间件数量）
  - websocket_connections: number（当前 WebSocket 连接数）
  - config?: object（当前网关配置对象，字段随实现可能调整）

4) api_gateway/broadcast（广播 WebSocket 消息）
- 定义： [python.api_gateway_broadcast()](api/modules/api_gateway/api_gateway.py:98)
- 输入（JSON）：
  - message: object（将广播的任意 JSON 对象）
- 输出（JSON）：
  - broadcasted: boolean（是否已广播）
  - connections?: number（当时连接数）

说明
- 该 API 为异步实现（async），但对外调用方式与其他一致，由核心门面负责调度。
- 广播目标为当前网关维护的所有活跃连接。

5) api_gateway/list_apis（列出已注册 API）
- 定义： [python.api_gateway_list_apis()](api/modules/api_gateway/api_gateway.py:131)
- 输入（JSON）：{}
- 输出（JSON）：
  - apis: object[]（每个对象结构如下）
    - name: string（API 名称）
    - description: string（API 描述）
    - path: string（斜杠路径）
    - namespace: string（"modules" | "workflow"）
    - input_schema: object（JSON Schema）
    - output_schema: object（JSON Schema）
  - total?: number（API 总数）

调用示例（Python SDK）

- 启动网关（后台）
```python
import core
res = core.call_api("api_gateway/start", {"background": True}, method="POST", namespace="modules")
# {"status":"started","background":true}
```

- 获取网关信息
```python
info = core.call_api("api_gateway/info", None, method="GET", namespace="modules")
# {"endpoints":N,"middlewares":M,"websocket_connections":K,"config":{...}}
```

- 广播消息
```python
core.call_api("api_gateway/broadcast", {"message": {"type":"ping","time":123456}}, method="POST", namespace="modules")
# {"broadcasted": true, "connections": K}
```

- 列出已注册 API
```python
apis = core.call_api("api_gateway/list_apis", None, method="GET", namespace="modules")
# {"apis":[{"name":"...","path":"...","namespace":"modules","input_schema":{...},"output_schema":{...}},...], "total":N}
```

注意事项
- 启动/停止为幂等行为：多次启动可能抛出端口占用或忽略，取决于核心网关实现；请在上层做好错误处理与提示。
- 广播仅对当前进程的连接有效；若存在多实例部署，应使用更上层的分发机制（如消息队列）。
- list_apis 的结果源自注册中心，随动态模块加载而变化（见服务管理器与装饰器注册逻辑）。
- 建议在生产环境为“管理类 API”增加鉴权中间件（路由前缀/令牌等）。

错误与边界
- config_file 不存在或非法时，底层可能回退默认配置或抛异常；建议在调用前校验路径。
- 广播时若当前无任何连接，返回 broadcasted=true 且 connections=0，属于正常情况。
- list_apis 仅枚举“已注册”的 API；未被加载/注册的脚本不会出现在结果中。

版本与变更
- 初版：提供启动/停止/信息/广播/枚举接口，统一 JSON Schema 定义，符合 DEVELOPMENT_NOTES 约定。