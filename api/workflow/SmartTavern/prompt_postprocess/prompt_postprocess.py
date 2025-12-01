#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SmartTavern Prompt Post-Process Workflow Registration (prompt_postprocess.py)

职责（封装/注册层，仅声明 API，不包含实现逻辑）:
- 通过 @core.register_api 暴露工作流 API（斜杠路径 + JSON Schema）
- 实际实现委托给同目录的 impl.py

接口说明（单视图流水线）:
- 输入:
  - messages: OpenAI Chat 消息数组（[{role, content, source?}]），建议含 source
  - regex_rules: 正则规则（数组或 {"regex_rules":[...]}）
  - view: "user_view" | "assistant_view"（仅处理所选视图）
- 输出:
  - {"message":[...], "variables": {"initial":{}, "final":{}}}
"""
from typing import Any, Dict, List, Optional

import core  # type: ignore

from .impl import apply as _apply


@core.register_api(
    path="smarttavern/prompt_postprocess/apply",
    name="提示词后处理（单视图：正则 + 宏）",
    description=(
        "根据入参 view，仅对该视图执行流水线："
        "before_macro → macro → after_macro；宏阶段始终执行，"
        "仅替换 content，保留 source 等其它字段。"
    ),
    input_schema={
        "type": "object",
        "properties": {
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
            "regex_rules": {"type": ["array", "object"]},
            "view": {"type": "string", "enum": ["user_view", "assistant_view"]},
            "variables": {"type": "object", "additionalProperties": True}
        },
        "required": ["messages", "regex_rules", "view"],
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
            },
            "variables": {
                "type": "object",
                "properties": {
                    "initial": {"type": "object", "additionalProperties": True},
                    "final": {"type": "object", "additionalProperties": True}
                },
                "required": ["initial", "final"],
                "additionalProperties": False
            }
        },
        "required": ["message", "variables"],
        "additionalProperties": False
    },
)
async def apply(
    messages: List[Dict[str, Any]],
    regex_rules: Any,
    view: str,
    variables: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    适配器：转发到实现层（impl.py），遵循 "API 优先 / 解耦" 原则。
    """
    return await _apply(messages=messages, rules=regex_rules, view=view, variables=variables)


if __name__ == "__main__":
    import json
    print(json.dumps({
        "message": "This file registers the Post-Process workflow API (single-view). Please run the API gateway or call the API instead."
    }, ensure_ascii=False))