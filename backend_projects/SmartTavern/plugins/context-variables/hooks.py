# -*- coding: utf-8 -*-
"""
Context Variables 插件 - 后端 Hooks（基于后处理事件）

目标：
- 通过后处理编排器的统一注册机制（postprocess_registry）注册 stid=CtxVar
- 允许 AI 返回对上下文变量的操作（set/get/del）；插件在后端执行变量更新
- path 使用数组段表示：例如 ["player", "level"] 表示 content.player.level
- 在 afterLLMCall 钩子内读取规范化的 postprocess_items 并应用 set/del；get 为只读操作（当前不回传）
- 配置：非一次性（once=false），对 AI 隐藏（visible_to_ai=false）
"""

from __future__ import annotations
from typing import Any, Dict, List
import logging
import core

logger = logging.getLogger(__name__)


_SPEC_CTXVAR: Dict[str, Any] = {
    "stid": "CtxVar",
    "description": (
        "上下文变量（context_variables.json）操作。\n"
        "path 为数组段，例如 ['player','level'] 表示 content.player.level。\n"
        "可用操作：\n"
        "- set: 设置指定路径的值；如果路径不存在则自动创建；data: {path: string[]|string, value: any}\n"
        "- add: 增量修改指定路径的值；支持数值相加、数组追加、字符串拼接、对象合并；data: {path: string[]|string, value: any}\n"
        "- del: 删除指定路径；data: {path: string[]|string}\n"
    ),
    "ops": [
        {
            "op": "set",
            "data_schema": {
                "type": "object",
                "required": ["path", "value"],
                "properties": {
                    "path": {
                        "type": ["array", "string"],
                        "minItems": 1,
                        "items": {"type": "string"}
                    },
                    "value": {}
                },
                "additionalProperties": False
            },
            "settings": {"once": False, "visible_to_ai": False}
        },
        {
            "op": "add",
            "data_schema": {
                "type": "object",
                "required": ["path", "value"],
                "properties": {
                    "path": {
                        "type": ["array", "string"],
                        "minItems": 1,
                        "items": {"type": "string"}
                    },
                    "value": {}
                },
                "additionalProperties": False
            },
            "settings": {"once": False, "visible_to_ai": False}
        },
        {
            "op": "del",
            "data_schema": {
                "type": "object",
                "required": ["path"],
                "properties": {
                    "path": {
                        "type": ["array", "string"],
                        "minItems": 1,
                        "items": {"type": "string"}
                    }
                },
                "additionalProperties": False
            },
            "settings": {"once": False, "visible_to_ai": False}
        },
    ],
    "enabled": True,
    "priority": 500,
}


def _get_ctx_vars(conversation_file: str) -> Dict[str, Any]:
    try:
        res = core.call_api(
            "smarttavern/context_variables/get",
            {"conversation_file": conversation_file},
            method="POST",
            namespace="plugins",
        )
        return (res or {}).get("content", {}) or {}
    except Exception as e:
        logger.warning(f"[CtxVar] get failed: {e}")
        return {}


def _set_ctx_vars(conversation_file: str, content: Dict[str, Any]) -> bool:
    try:
        res = core.call_api(
            "smarttavern/context_variables/set",
            {"conversation_file": conversation_file, "content": content},
            method="POST",
            namespace="plugins",
        )
        return bool(res and res.get("success"))
    except Exception as e:
        logger.warning(f"[CtxVar] set failed: {e}")
        return False


def _set_by_path(root: Dict[str, Any], path: List[str], value: Any) -> None:
    """设置指定路径的值；如果路径不存在则自动创建中间对象"""
    cur = root
    for i, key in enumerate(path):
        is_last = (i == len(path) - 1)
        if is_last:
            cur[key] = value
        else:
            nxt = cur.get(key)
            if not isinstance(nxt, dict):
                nxt = {}
                cur[key] = nxt
            cur = nxt


def _add_by_path(root: Dict[str, Any], path: List[str], delta: Any) -> None:
    """
    增量修改指定路径的值：
    - 如果路径不存在，先创建并设置为 delta（等价于 set）
    - 如果存在：
      - 数值类型：相加
      - 数组：追加元素（delta 为单个元素则 append，为数组则 extend）
      - 字符串：拼接
      - 对象：合并（浅合并，用 delta 覆盖同名键）
      - 其他类型：直接用 delta 覆盖（等价于 set）
    """
    # 先确保路径存在（创建中间对象）
    cur = root
    for i, key in enumerate(path):
        is_last = (i == len(path) - 1)
        if is_last:
            existing = cur.get(key)
            if existing is None:
                # 路径不存在，直接设置（等价于 set）
                cur[key] = delta
            else:
                # 根据类型进行增量操作
                if isinstance(existing, (int, float)) and isinstance(delta, (int, float)):
                    cur[key] = existing + delta
                elif isinstance(existing, list):
                    if isinstance(delta, list):
                        cur[key].extend(delta)
                    else:
                        cur[key].append(delta)
                elif isinstance(existing, str) and isinstance(delta, str):
                    cur[key] = existing + delta
                elif isinstance(existing, dict) and isinstance(delta, dict):
                    # 浅合并
                    cur[key] = {**existing, **delta}
                else:
                    # 类型不匹配，直接覆盖
                    cur[key] = delta
        else:
            # 中间路径必须存在，不存在则创建
            nxt = cur.get(key)
            if not isinstance(nxt, dict):
                nxt = {}
                cur[key] = nxt
            cur = nxt


def _del_by_path(root: Dict[str, Any], path: List[str]) -> None:
    cur = root
    for i, key in enumerate(path):
        is_last = (i == len(path) - 1)
        if is_last:
            try:
                if key in cur:
                    del cur[key]
            except Exception:
                pass
        else:
            nxt = cur.get(key)
            if not isinstance(nxt, dict):
                return
            cur = nxt


async def _after_llm_call(data: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """消费 afterLLMCall 中 postprocess_orchestrator 规范化写入的 postprocess_items。"""
    try:
        items = None
        if isinstance(data, dict):
            items = data.get("postprocess_items")
        if not isinstance(items, dict) or not items:
            return data

        ops = items.get("CtxVar")
        if not isinstance(ops, list) or not ops:
            return data

        conversation_file = (ctx or {}).get("conversationFile")
        if not conversation_file:
            return data

        # 读取 → 应用全部操作 → 一次性写入
        doc = _get_ctx_vars(conversation_file)
        changed = False
        def _normalize_path(pv: Any) -> List[str]:
            if isinstance(pv, list):
                return [str(x).strip() for x in pv if str(x).strip()]
            if isinstance(pv, str):
                s = pv.replace('[', '.').replace(']', '.')
                toks = [t.strip() for t in s.split('.') if t.strip()]
                return toks
            return []

        for it in ops:
            if not isinstance(it, dict):
                continue
            op = str(it.get("op") or "").lower()
            payload = it.get("data") or {}
            path = _normalize_path(payload.get("path"))
            if not path:
                continue
            if op == "set":
                _set_by_path(doc, path, payload.get("value"))
                changed = True
            elif op == "add":
                _add_by_path(doc, path, payload.get("value"))
                changed = True
            elif op in ("del", "delete", "remove"):
                _del_by_path(doc, path)
                changed = True

        if changed:
            _set_ctx_vars(conversation_file, doc)
    except Exception as e:
        logger.warning(f"[CtxVar] afterLLMCall error: {e}")
    return data


 

def register_hooks(hook_manager):
    strategy_id = "context-variables-backend"

    # 注册后处理单元（通过 API）
    try:
        core.call_api(
            "smarttavern/postprocess/register_units",
            {"units": [_SPEC_CTXVAR]},
            method="POST",
            namespace="plugins",
        )
    except Exception:
        pass

    # 向宏引擎注册自定义宏：getCtxVar → 由本插件提供 handler_api 直接返回文本
    try:
        core.call_api(
            "smarttavern/macro/register",
            {"macros": [
                {"name": "getCtxVar", "handler_api": "plugins:smarttavern/context_variables/macro_get"},
                {"name": "getCtxVarJSON", "handler_api": "plugins:smarttavern/context_variables/macro_get_json"}
            ]},
            method="POST",
            namespace="modules",
        )
    except Exception:
        pass

    # 仅注册 afterLLMCall（执行变量更新）
    hook_manager.register_strategy(
        strategy_id=strategy_id,
        hooks_dict={
            'afterLLMCall': _after_llm_call,
        },
        order=120  # 在 orchestrator(100) 之后执行
    )

    logger.info("Context Variables(CtxVar) 插件已注册：afterLLMCall & postprocess unit")
    return [strategy_id]


def unregister_hooks(hook_manager):
    try:
        hook_manager.unregister_strategy("context-variables-backend")
    except Exception:
        pass
    logger.info("Context Variables 插件已卸载后端 Hooks")