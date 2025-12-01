#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API 封装层：SmartTavern.regex_replace
- 根据正则规则（参考 backend_projects/SmartTavern/data/regex_rules/*.json）对 messages 或 text 执行替换
- 支持 placement: before_macro / after_macro
- 单视图 API：apply_messages 与 apply_text，需显式指定 view（user_view|assistant_view）；返回单一结果字段（message 或 text）
"""
from typing import Any, Dict, List, Optional
import core
from .impl import (
    apply_regex_messages_view as _apply_messages_view,
    apply_regex_text_view as _apply_text_view,
)
import json

def _dbg(label, data=None):
    # 调试关闭：不输出任何日志
    return None


@core.register_api(
    path="smarttavern/regex_replace/apply_messages",
    name="正则替换（messages，单视图）",
    description="对消息数组，根据 view 仅应用对应规则视图，返回单一 message 结果。",
    input_schema={
        "type": "object",
        "properties": {
            "regex_rules": {"type": ["array", "object"]},
            "placement": {"type": "string", "enum": ["before_macro", "after_macro"]},
            "view": {"type": "string", "enum": ["user_view", "assistant_view"]},
            "messages": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "role": {"type": "string", "enum": ["system", "user", "assistant", "thinking"]},
                        "content": {"type": "string"},
                        "source": {"type": "object", "additionalProperties": True}
                    },
                    "required": ["role", "content"],
                    "additionalProperties": True
                }
            },
            "variables": {"type": "object", "additionalProperties": True}
        },
        "required": ["regex_rules", "placement", "view", "messages"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "message": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "role": {"type": "string", "enum": ["system", "user", "assistant", "thinking"]},
                        "content": {"type": "string"},
                        "source": {"type": "object", "additionalProperties": True}
                    },
                    "required": ["role", "content"],
                    "additionalProperties": True
                }
            }
        },
        "required": ["message"],
        "additionalProperties": False
    },
)
def apply_messages(
    regex_rules: Any,
    placement: str,
    view: str,
    messages: List[Dict[str, Any]],
    variables: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    try:
        _dbg("apply_messages.enter", {
            "placement": placement,
            "view": view,
            "rules_type": type(regex_rules).__name__,
            "rules_len": (len(regex_rules) if isinstance(regex_rules, list) else (len((regex_rules or {}).get("regex_rules", [])) if isinstance(regex_rules, dict) else None)),
            "messages_count": len(messages or []),
            "first_content": (messages[0].get("content") if isinstance(messages, list) and messages else ""),
        })
    except Exception:
        pass
    res = _apply_messages_view(rules=regex_rules, placement=placement, view=view, messages=messages, variables=variables)
    try:
        out = res.get("message") if isinstance(res, dict) else None
        _dbg("apply_messages.exit_first", (out[0].get("content") if isinstance(out, list) and out else ""))
    except Exception:
        pass
    return res


@core.register_api(
    path="smarttavern/regex_replace/apply_text",
    name="正则替换（text，单视图）",
    description="对纯文本，根据 view 仅应用对应规则视图，返回单一 text 结果。",
    input_schema={
        "type": "object",
        "properties": {
            "regex_rules": {"type": ["array", "object"]},
            "placement": {"type": "string", "enum": ["before_macro", "after_macro"]},
            "view": {"type": "string", "enum": ["user_view", "assistant_view"]},
            "text": {"type": "string"},
            "variables": {"type": "object", "additionalProperties": True}
        },
        "required": ["regex_rules", "placement", "view", "text"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "text": {"type": "string"}
        },
        "required": ["text"],
        "additionalProperties": False
    },
)
def apply_text(
    regex_rules: Any,
    placement: str,
    view: str,
    text: str,
    variables: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return _apply_text_view(rules=regex_rules, placement=placement, view=view, text=text, variables=variables)