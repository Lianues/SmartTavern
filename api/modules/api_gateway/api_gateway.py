"""
API 封装层：API 网关对外接口 (api/modules)
新规范：斜杠 path + JSON Schema；核心实现位于 core/api_gateway.py
"""

from typing import Any, Dict, Optional
import core

@core.register_api(
    name="API网关启动",
    description="启动API网关服务器",
    path="api_gateway/start",
    input_schema={
        "type": "object",
        "properties": {
            "background": {"type": "boolean"},
            "config_file": {"type": "string"}
        }
    },
    output_schema={
        "type": "object",
        "properties": {
            "status": {"type": "string"},
            "background": {"type": "boolean"}
        },
        "required": ["status"]
    }
)
def api_gateway_start(background: bool = True, config_file: Optional[str] = None) -> Dict[str, Any]:
    gateway = core.get_api_gateway(config_file=config_file)
    gateway.start_server(background=background)
    return {"status": "started", "background": background}

@core.register_api(
    name="API网关停止",
    description="停止API网关服务器",
    path="api_gateway/stop",
    input_schema={"type": "object", "properties": {}},
    output_schema={
        "type": "object",
        "properties": {"status": {"type": "string"}},
        "required": ["status"]
    }
)
def api_gateway_stop() -> Dict[str, Any]:
    gateway = core.get_api_gateway()
    gateway.stop_server()
    return {"status": "stopped"}

@core.register_api(
    name="API网关信息",
    description="获取API网关信息",
    path="api_gateway/info",
    input_schema={
        "type": "object",
        "properties": {
            "config_file": {"type": "string"}
        }
    },
    output_schema={
        "type": "object",
        "properties": {
            "endpoints": {"type": "integer"},
            "middlewares": {"type": "integer"},
            "websocket_connections": {"type": "integer"},
            "config": {"type": "object", "additionalProperties": True}
        },
        "required": ["endpoints", "middlewares", "websocket_connections"]
    }
)
def api_gateway_info(config_file: Optional[str] = None) -> Dict[str, Any]:
    gateway = core.get_api_gateway(config_file=config_file)
    return {
        "endpoints": len(gateway.router.get_endpoints()),
        "middlewares": len(gateway.router.get_middlewares()),
        "websocket_connections": len(gateway.websocket_connections),
        "config": gateway.config.__dict__ if gateway.config else None
    }

@core.register_api(
    name="API网关广播消息",
    description="向所有WebSocket连接广播消息",
    path="api_gateway/broadcast",
    input_schema={
        "type": "object",
        "properties": {"message": {"type": "object", "additionalProperties": True}},
        "required": ["message"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "broadcasted": {"type": "boolean"},
            "connections": {"type": "integer"}
        },
        "required": ["broadcasted"]
    }
)
async def api_gateway_broadcast(message: Dict[str, Any]) -> Dict[str, Any]:
    gateway = core.get_api_gateway()
    await gateway.broadcast_message(message)
    return {"broadcasted": True, "connections": len(gateway.websocket_connections)}

@core.register_api(
    name="列出已注册API",
    description="获取所有已注册 API 的定义（名称、描述、路径、命名空间、输入/输出Schema）",
    path="api_gateway/list_apis",
    input_schema={"type": "object", "properties": {}},
    output_schema={
        "type": "object",
        "properties": {
            "apis": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string"},
                        "path": {"type": "string"},
                        "namespace": {"type": "string"},
                        "input_schema": {"type": "object"},
                        "output_schema": {"type": "object"}
                    },
                    "required": ["name", "path", "namespace"]
                }
            },
            "total": {"type": "integer"}
        },
        "required": ["apis"]
    }
)
def api_gateway_list_apis() -> Dict[str, Any]:
    # migrated to core facade
    reg = core.get_registry()
    items = []
    for p in reg.list_functions():
        spec = reg.get_spec(p)
        if not spec:
            continue
        items.append({
            "name": spec.name,
            "description": spec.description,
            "path": spec.path,
            "namespace": spec.namespace,
            "input_schema": spec.input_schema,
            "output_schema": spec.output_schema
        })
    return {"apis": items, "total": len(items)}