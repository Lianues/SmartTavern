#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Workflow 封装层：smarttavern.variables_update

职责：
- 暴露工作流 API：根据对话主文件（.json）读取其 variables.json，
  与传入的 overrides 深度合并（不落盘），输出合并后的变量 JSON。
- 实现委托给同目录 impl.py

参考：
- [python.function(core.register_api)](core/api_registry.py:146)
- [python.function(core.call_api)](core/api_client.py:234)
- [python.function(apply_to_conversation())](api/workflow/smarttavern/variables_update/impl.py:19)
"""
from typing import Any, Dict, Optional
import core  # type: ignore

from .impl import apply_to_conversation as _apply_to_conversation


@core.register_api(
    path="smarttavern/variables_update/apply",
    name="变量覆盖更新（工作流）",
    description=(
        "输入对话主文件路径（conversations/*.json）与变量更新 JSON（overrides），"
        "内部读取 conversations/{name}/variables.json 后，调用模块 API 按指定策略（replace|shallow_merge|merge|append|union|remove）处理，返回结果（不落盘）。"
        "数组策略支持 replace|concat|union|prepend|union_by_key，union_by_key 需提供 options.array_key。"
    ),
    input_schema={
        "type": "object",
        "properties": {
            "file": {
                "type": "string",
                "description": "对话主文件路径（仓库根相对），例：backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json"
            },
            "overrides": {"type": "object", "additionalProperties": True},
            "operation": {
                "type": "string",
                "enum": ["replace", "shallow_merge", "merge", "deep_merge", "append", "union", "remove"],
                "description": "默认 merge"
            },
            "options": {
                "type": "object",
                "properties": {
                    "array_strategy": {"type": "string", "enum": ["replace", "concat", "union", "prepend", "union_by_key"]},
                    "array_key": {"type": "string"},
                    "remove_paths": {"type": "array", "items": {"type": ["string","integer"]}}
                },
                "additionalProperties": True
            }
        },
        "required": ["file", "overrides"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "variables": {"type": "object", "additionalProperties": True},
            "variables_file": {"type": ["string", "null"]}
        },
        "required": ["variables"],
        "additionalProperties": False
    },
)
def apply(
    file: str,
    overrides: Dict[str, Any],
    options: Optional[Dict[str, Any]] = None,
    operation: str = "merge",
) -> Dict[str, Any]:
    """
    读取 conversations/{name}/variables.json 与 overrides 按 operation 策略处理，返回结果（不写回文件）。
    """
    return _apply_to_conversation(file=file, overrides=overrides, options=options, operation=operation)