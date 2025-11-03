from __future__ import annotations

"""
SmartTavern Plugin Backend — Context Variables (entry registration)

职责：
- 仅进行 API 路由的注册（@register_api），将请求参数转发到实现层 impl.py
- 保持对外路径与 JSON Schema 不变
- 实现细节全部位于：api/plugins/SmartTavern/context_variables/impl.py

路由前缀：
- /api/plugins/smarttavern/context_variables/*
"""

from typing import Any, Dict
from core.api_registry import register_api
from .impl import (
    ensure_init_impl,
    get_context_variables_impl,
    set_context_variables_impl,
    merge_context_variables_impl,
    replay_context_variables_impl,
    replay_get_value_impl,
    replay_keys_impl,
)


@register_api(
    path="smarttavern/context_variables/ensure_init",
    input_schema={
        "type": "object",
        "properties": {
            "conversation_file": {"type": "string"}
        },
        "required": ["conversation_file"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "file": {"type": "string"},
            "created": {"type": "boolean"},
            "content": {"type": "object"}
        },
        "required": ["success", "file", "created", "content"]
    },
    description="若当前对话目录下不存在 context_variables.json，则从角色卡的 [InitVar] 初始化创建；已存在则不覆盖，仅返回内容"
)
def ensure_init(conversation_file: str) -> Dict[str, Any]:
    return ensure_init_impl(conversation_file)


@register_api(
    path="smarttavern/context_variables/get",
    input_schema={
        "type": "object",
        "properties": {
            "conversation_file": {"type": "string"}
        },
        "required": ["conversation_file"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "file": {"type": "string"},
            "content": {"type": "object"}
        },
        "required": ["success", "file", "content"]
    },
    description="读取对话目录中的 context_variables.json；不存在则返回 {}"
)
def get_context_variables(conversation_file: str) -> Dict[str, Any]:
    return get_context_variables_impl(conversation_file)


@register_api(
    path="smarttavern/context_variables/set",
    input_schema={
        "type": "object",
        "properties": {
            "conversation_file": {"type": "string"},
            "content": {"type": "object"}
        },
        "required": ["conversation_file", "content"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "file": {"type": "string"},
            "content": {"type": "object"}
        },
        "required": ["success", "file", "content"]
    },
    description="完整覆盖写入 context_variables.json"
)
def set_context_variables(conversation_file: str, content: Dict[str, Any]) -> Dict[str, Any]:
    return set_context_variables_impl(conversation_file, content)


@register_api(
    path="smarttavern/context_variables/merge",
    input_schema={
        "type": "object",
        "properties": {
            "conversation_file": {"type": "string"},
            "patch": {"type": "object"}
        },
        "required": ["conversation_file", "patch"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "file": {"type": "string"},
            "content": {"type": "object"}
        },
        "required": ["success", "file", "content"]
    },
    description="合并写入：读取现有 context_variables.json 与传入 patch 合并后写回"
)
def merge_context_variables(conversation_file: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    return merge_context_variables_impl(conversation_file, patch)


@register_api(
    path="smarttavern/context_variables/macro_get",
    input_schema={
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "params": {"type": "string"},
            "variables": {"type": "object", "additionalProperties": True},
            "policy": {"type": "object", "additionalProperties": True}
        },
        "required": ["name"],
        "additionalProperties": True
    },
    output_schema={
        "type": "object",
        "properties": {
            "text": {"type": "string"},
            "variables": {"type": "object", "additionalProperties": True}
        },
        "required": ["text"],
        "additionalProperties": False
    },
    description="自定义宏处理：getCtxVar，从 context_variables.json 读取值"
)
def macro_get(name: str, params: str = "", variables: Dict[str, Any] | None = None, policy: Dict[str, Any] | None = None) -> Dict[str, Any]:
    # 解析对话文件
    conv = None
    try:
        if isinstance(variables, dict):
            conv = variables.get("__conversation_file") or variables.get("conversation_file")
    except Exception:
        conv = None
    if not conv:
        return {"text": ""}

    # 解析路径：支持 a.b.c 与 a[b] 混写
    def _read_by_path(doc: Dict[str, Any], path_str: str) -> str:
        s = str(path_str or "").strip()
        s2 = s.replace('[', '.').replace(']', '.')
        toks = [t.strip().strip("'\"") for t in s2.split('.') if t.strip()]
        cur: Any = doc
        try:
            for t in toks:
                if isinstance(cur, dict) and t in cur:
                    cur = cur[t]
                else:
                    return ""
            return "" if cur is None else str(cur)
        except Exception:
            return ""

    # 重放 CtxVar 指令到当前激活路径，得到“即时生效”的上下文变量再取值
    try:
        key = str(params or "").strip()
        res = replay_get_value_impl(str(conv), key=key, until_node_id=None)
        return {"text": str(res.get("value",""))}
    except Exception:
        return {"text": ""}


@register_api(
    path="smarttavern/context_variables/macro_get_json",
    input_schema={
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "params": {"type": "string"},
            "variables": {"type": "object", "additionalProperties": True},
            "policy": {"type": "object", "additionalProperties": True}
        },
        "required": ["name"],
        "additionalProperties": True
    },
    output_schema={
        "type": "object",
        "properties": {
            "text": {"type": "string"}
        },
        "required": ["text"],
        "additionalProperties": False
    },
    description="自定义宏：getCtxVarJSON，返回 JSON 值（不传key返回整个对象；传key返回该路径JSON或子键字典）"
)
def macro_get_json(name: str, params: str = "", variables: Dict[str, Any] | None = None, policy: Dict[str, Any] | None = None) -> Dict[str, Any]:
    import json as _json
    conv = None
    try:
        if isinstance(variables, dict):
            conv = variables.get("__conversation_file") or variables.get("conversation_file")
    except Exception:
        conv = None
    if not conv:
        return {"text": "{}"}
    try:
        key = (params or "").strip()
        # 基于重放后的最新状态获取完整 JSON
        full = replay_context_variables_impl(str(conv), until_node_id=None) or {}
        content = full.get("content") or {}

        if not key:
            return {"text": _json.dumps(content, ensure_ascii=False)}

        # 路径解析（支持 a.b、a['b']、arr[0] 混用）
        def _resolve(obj: Any, path: str) -> Any:
            if not path:
                return obj
            s2 = path.replace('[', '.').replace(']', '.')
            toks = [t.strip().strip("'\"") for t in s2.split('.') if t.strip()]
            cur: Any = obj
            for t in toks:
                # 尝试数组索引
                if isinstance(cur, list) and t.lstrip('-').isdigit():
                    idx = int(t)
                    if idx < 0 or idx >= len(cur):
                        return None
                    cur = cur[idx]
                elif isinstance(cur, dict):
                    if t not in cur:
                        return None
                    cur = cur[t]
                else:
                    return None
            return cur

        val = _resolve(content, key)
        if val is None:
            return {"text": "{}"}
        return {"text": _json.dumps(val, ensure_ascii=False)}
    except Exception:
        return {"text": "{}"}


@register_api(
    path="smarttavern/context_variables/replay",
    input_schema={
        "type": "object",
        "properties": {
            "conversation_file": {"type": "string"},
            "until_node_id": {"type": ["string", "null"]}
        },
        "required": ["conversation_file"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "content": {"type": "object"},
            "applied": {"type": "integer"},
            "path": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["success", "content"],
        "additionalProperties": True
    },
)
def replay(conversation_file: str, until_node_id: str | None = None) -> Dict[str, Any]:
    return replay_context_variables_impl(conversation_file, until_node_id=until_node_id)


@register_api(
    path="smarttavern/context_variables/replay_get",
    input_schema={
        "type": "object",
        "properties": {
            "conversation_file": {"type": "string"},
            "key": {"type": "string"},
            "until_node_id": {"type": ["string", "null"]}
        },
        "required": ["conversation_file", "key"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "value": {"type": "string"},
            "applied": {"type": "integer"}
        },
        "required": ["success", "value"],
        "additionalProperties": False
    },
)
def replay_get(conversation_file: str, key: str, until_node_id: str | None = None) -> Dict[str, Any]:
    return replay_get_value_impl(conversation_file, key=key, until_node_id=until_node_id)


@register_api(
    path="smarttavern/context_variables/replay_keys",
    input_schema={
        "type": "object",
        "properties": {
            "conversation_file": {"type": "string"},
            "key": {"type": ["string", "null"]},
            "until_node_id": {"type": ["string", "null"]}
        },
        "required": ["conversation_file"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "keys": {"type": "object", "additionalProperties": {"type": "boolean"}}
        },
        "required": ["success", "keys"],
        "additionalProperties": False
    },
)
def replay_keys(conversation_file: str, key: str | None = None, until_node_id: str | None = None) -> Dict[str, Any]:
    return replay_keys_impl(conversation_file, key=key, until_node_id=until_node_id)