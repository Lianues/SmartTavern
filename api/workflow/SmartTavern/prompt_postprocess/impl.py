#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SmartTavern Prompt Post-Process Workflow Implementation (impl.py)

职责（单视图）：
- 基于一份 canonical 原始 messages，仅针对入参 view 执行：
  before_macro → macro → after_macro
- 正则调用统一使用 modules/smarttavern/regex_replace 单视图 API（apply_messages）
- 宏调用统一使用 modules/smarttavern/macro/process（仅替换 content，保留 source）
- 输出：{"message":[...], "variables": {initial, final}}
"""

from typing import Any, Dict, List, Optional, Tuple
import asyncio
import copy
import core  # type: ignore


def _dbg(label: str, data: Any = None) -> None:
    # 调试关闭：不输出任何日志
    return None


def _first_content(msgs: List[Dict[str, Any]]) -> str:
    try:
        if msgs and isinstance(msgs[0], dict):
            return str(msgs[0].get("content", ""))
    except Exception:
        pass
    return ""


def _deepcopy_messages(messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    try:
        return copy.deepcopy(messages or [])
    except Exception:
        return [dict(m) for m in (messages or [])]


def _safe_get_messages(res: Any, fallback: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    try:
        if isinstance(res, dict) and isinstance(res.get("message"), list):
            return res["message"]
    except Exception:
        pass
    return fallback


async def _regex_apply_messages(
    messages: List[Dict[str, Any]],
    rules: Any,
    placement: str,
    view: str,
    variables: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    单视图正则处理（messages）
    - 调用 modules/smarttavern/regex_replace/apply_messages
    - 返回处理后的 messages；失败时返回原 messages
    """
    _dbg(f"regex.call.{view}.{placement}.in_first", _first_content(messages))
    payload = {
        "regex_rules": rules,
        "placement": placement,
        "view": view,
        "messages": messages,
        "variables": dict(variables or {}),
    }
    try:
        res = await asyncio.to_thread(
            core.call_api,
            "smarttavern/regex_replace/apply_messages",
            payload,
            "POST",
            None,
            None,
            "modules",
        )
        out = _safe_get_messages(res, messages)
        _dbg(f"regex.call.{view}.{placement}.out_first", _first_content(out))
        return out
    except Exception as e:
        _dbg(f"regex.call.{view}.{placement}.exception", repr(e))
        return messages


async def _macro_process_messages(
    messages: List[Dict[str, Any]],
    variables: Optional[Dict[str, Any]] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    调用 modules/smarttavern/macro/process
    - 返回 (messages, variables)；失败时返回 (原 messages, {})
    """
    payload = {
        "messages": messages,
        "variables": dict(variables or {}),
    }
    try:
        res = await asyncio.to_thread(
            core.call_api,
            "smarttavern/macro/process",
            payload,
            "POST",
            None,
            None,
            "modules",
        )
        if isinstance(res, dict):
            out_msgs = res.get("messages")
            vars_obj = res.get("variables")
            if isinstance(out_msgs, list):
                return out_msgs, (vars_obj if isinstance(vars_obj, dict) else {})
    except Exception:
        pass
    return messages, {}


async def apply(
    messages: List[Dict[str, Any]],
    rules: Any,
    view: str,
    variables: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    工作流主入口（实现层，单视图）
    - 顺序：before_macro → macro → after_macro
    - 支持通过输入 variables 注入宏初始变量
    """
    base = _deepcopy_messages(messages)

    # step1: before_macro（单视图）
    m1 = await _regex_apply_messages(base, rules, "before_macro", view, variables=variables)

    # step2: macro（始终执行），使用传入的 variables 作为初始变量
    m2, variables_out = await _macro_process_messages(m1, variables=variables or {})

    # step3: after_macro（单视图）
    m3 = await _regex_apply_messages(m2, rules, "after_macro", view, variables=variables)

    return {
        "message": m3,
        "variables": variables_out if isinstance(variables_out, dict) else {},
    }