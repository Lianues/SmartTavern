# -*- coding: utf-8 -*-
"""
SmartTavern Prompt Router API 注册层

提供：
- route_with_hooks: 带 Hook 的视图处理
- complete_with_hooks: 带 Hook 的 AI 调用
- reload_plugins: 重新加载插件
"""

from typing import Any, Dict, Optional
import core
from fastapi import HTTPException

from .impl import (
    route_process_view_impl as _route_process_view_impl,
    route_complete_impl as _route_complete_impl,
)


@core.register_api(
    path="smarttavern/prompt_router/route_with_hooks",
    name="带Hook的智能路由处理",
    description=(
        "只需传入 conversation_file，自动读取所有配置，"
        "在各阶段执行插件注册的 Hooks，返回处理结果。"
        "这是前端 prompt-router.js 中 routeProcessView 的后端实现。"
        "支持 output=delta 增量返回：传 fingerprints 与 variables_hash 只返回变化项。"
    ),
    input_schema={
        "type": "object",
        "properties": {
            "conversation_file": {"type": "string"},
            "view": {
                "type": "string",
                "enum": ["user_view", "assistant_view"],
                "default": "user_view"
            },
            "output": {
                "type": "string",
                "enum": ["full", "history", "delta"],
                "default": "full"
            },
            "fingerprints": {
                "type": "object",
                "additionalProperties": {"type": "string"}
            },
            "variables_hash": {"type": "string"},
            "variables_fingerprints": {
                "type": "object",
                "additionalProperties": {"type": "string"}
            },
            "router_id": {"type": "string"}
        },
        "required": ["conversation_file"],
        "additionalProperties": False,
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "messages": {
                "type": "array",
                "items": {"type": "object", "additionalProperties": True}
            },
            "variables": {"type": "object", "additionalProperties": True},
            "messages_deleted": {
                "type": "array",
                "items": {"type": "string"}
            },
            "variables_changed": {
                "type": "array",
                "items": {"type": "object", "additionalProperties": True}
            },
            "variables_deleted": {
                "type": "array",
                "items": {"type": "string"}
            },
            "variables_total": {"type": "integer"},
            "variables_unchanged": {"type": "integer"},
            "variables_noop": {"type": "boolean"},
            "changed": {
                "type": "array",
                "items": {"type": "object", "additionalProperties": True}
            },
            "unchanged": {"type": "integer"},
            "total": {"type": "integer"},
            "variables_hash": {"type": "string"},
            "error": {"type": "string"},
        },
        "required": ["success"],
        "additionalProperties": True,
    },
)
def route_with_hooks(
    conversation_file: str,
    view: str = "user_view",
    output: str = "full",
    fingerprints: Optional[Dict[str, str]] = None,
    variables_hash: Optional[str] = None,
    variables_fingerprints: Optional[Dict[str, str]] = None,
    router_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    带 Hook 的智能路由处理
    
    完整流程：
    1. 读取 conversation_file 对应的所有配置
    2. 在各阶段执行插件注册的 Hooks
    3. 返回处理后的 messages 和 variables
    
    优势：
    - 前端只需传文件路径，不需要传完整配置 JSON
    - 后端自动执行所有 Hook
    - 减少网络传输，提升性能
    
    参数：
        conversation_file: 对话文件路径
        view: "user_view" | "assistant_view"
        output: "full" | "history"
    
    返回：
        {
            "success": True,
            "messages": [...],
            "variables": {...}
        }
    """
    return _route_process_view_impl(
        conversation_file=conversation_file,
        view=view,
        output=output,
        fingerprints=fingerprints,
        variables_hash=variables_hash,
        variables_fingerprints=variables_fingerprints,
        router_id=router_id,
    )


@core.register_api(
    path="smarttavern/prompt_router/complete_with_hooks",
    name="带Hook的AI调用",
    description=(
        "只需传入 conversation_file，自动从 settings.json 读取 llm_config，"
        "执行完整的 Hook 流程后调用 AI。"
    ),
    input_schema={
        "type": "object",
        "properties": {
            "conversation_file": {"type": "string"},
            "stream": {"type": "boolean", "default": False},
            "target_node_id": {"type": ["string", "null"], "description": "指定将AI响应写入的节点ID（并发/切分支安全）"},
        },
        "required": ["conversation_file"],
        "additionalProperties": False,
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "content": {"type": "string"},
            "node_id": {"type": "string"},
            "usage": {"type": "object", "additionalProperties": True},
            "error": {"type": "string"},
        },
        "required": ["success"],
        "additionalProperties": True,
    },
)
def complete_with_hooks(
    conversation_file: str,
    stream: bool = False,
    target_node_id: Optional[str] = None,
) -> Any:
    """
    带 Hook 的 AI 调用（自动读取配置）
    
    流程：
    1. 从 settings.json 读取 llm_config_file
    2. 通过 route_with_hooks 处理视图（执行所有 Hook）
    3. 调用 chat_completion 进行 AI 调用
    4. 返回结果
    
    参数：
        conversation_file: 对话文件路径
    
    返回：
        AI 调用结果
    """
    return _route_complete_impl(
        conversation_file=conversation_file,
        stream=stream,
        target_node_id=target_node_id,
    )


@core.register_api(
    path="smarttavern/prompt_router/reload_plugins",
    name="重新加载所有插件",
    description="热重载：重新扫描并加载所有后端插件及其 Hooks",
    input_schema={
        "type": "object",
        "properties": {},
        "additionalProperties": False,
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "loaded_plugins": {"type": "array", "items": {"type": "string"}},
            "total": {"type": "integer"},
        },
        "required": ["success"],
        "additionalProperties": True,
    },
)
def reload_plugins() -> Dict[str, Any]:
    """
    重新加载所有插件
    
    用于开发时热重载插件代码，无需重启服务器
    
    返回：
        {
            "success": True,
            "loaded_plugins": ["plugin1", "plugin2", ...],
            "total": 2
        }
    """
    try:
        from api.plugins.SmartTavern import get_plugin_loader
        
        loader = get_plugin_loader()
        plugins_info = loader.reload_all()
        
        loaded_plugins = [
            plugin_id for plugin_id, info in plugins_info.items()
            if info.loaded
        ]
        
        return {
            "success": True,
            "loaded_plugins": loaded_plugins,
            "total": len(loaded_plugins)
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "loaded_plugins": [],
            "total": 0
        }


@core.register_api(
    path="smarttavern/prompt_router/list_plugins",
    name="列出所有已加载的插件",
    description="获取当前已加载的插件列表及其状态",
    input_schema={
        "type": "object",
        "properties": {},
        "additionalProperties": False,
    },
    output_schema={
        "type": "object",
        "properties": {
            "plugins": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "plugin_id": {"type": "string"},
                        "loaded": {"type": "boolean"},
                        "error": {"type": ["string", "null"]},
                    }
                }
            },
            "total": {"type": "integer"},
        },
        "required": ["plugins", "total"],
        "additionalProperties": False,
    },
)
def list_plugins() -> Dict[str, Any]:
    """
    列出所有已加载的插件
    
    返回：
        {
            "plugins": [
                {"plugin_id": "...", "loaded": true, "error": null},
                ...
            ],
            "total": 2
        }
    """
    try:
        from api.plugins.SmartTavern import get_plugin_loader
        
        loader = get_plugin_loader()
        plugins_info = loader.get_loaded_plugins()
        
        plugins = [
            {
                "plugin_id": info.plugin_id,
                "loaded": info.loaded,
                "error": info.error,
            }
            for info in plugins_info.values()
        ]
        
        return {
            "plugins": plugins,
            "total": len(plugins)
        }
    
    except Exception as e:
        return {
            "plugins": [],
            "total": 0,
            "error": str(e)
        }