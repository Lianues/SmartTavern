#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API 封装层：SmartTavern.variables_update

说明：
- 统一的“变量操作策略应用”API（不再提供单独的 merge 路径）
- 支持常用 operation 策略：
  • replace：整体替换为 overrides
  • shallow_merge：顶层浅合并（dict.update 语义）
  • merge / deep_merge：深度合并（数组策略可选）
  • append：深度合并 + 数组 concat
  • union：深度合并 + 数组 union（去重）
  • remove：在以上策略基础上，按 options.remove_paths 批量删除路径键（支持点/方括号路径）

- 支持扩展的数组策略（array_strategy）：
  • replace（默认）：用 overrides 数组直接替换 base 数组
  • concat：拼接 base + overrides
  • union：按 JSON 值去重并集
  • prepend：前置拼接 overrides + base
  • union_by_key：基于 options.array_key（点/方括号路径）对数组中对象进行去重并集
    - 若对象无法从 array_key 取到标识，则退化为按 JSON 值去重

"""
from typing import Any, Dict, Optional
import core
from .impl import apply_operation as _apply_operation


@core.register_api(
    path="smarttavern/variables_update/apply",
    name="变量操作策略应用",
    description=(
        "对变量 JSON 应用指定操作策略："
        "replace（替换）、shallow_merge（浅合并）、merge/deep_merge（深合并）、"
        "append（数组拼接）、union（数组去重并集）、remove（按路径删除）。"
        "数组策略（array_strategy）支持 replace | concat | union | prepend | union_by_key；"
        "当使用 union_by_key 时，通过 options.array_key 指定对象键路径。"
    ),
    input_schema={
        "type": "object",
        "properties": {
            "base": {"type": "object", "additionalProperties": True},
            "overrides": {"type": "object", "additionalProperties": True},
            "operation": {
                "type": "string",
                "enum": ["replace", "shallow_merge", "merge", "deep_merge", "append", "union", "remove"]
            },
            "options": {
                "type": "object",
                "properties": {
                    "array_strategy": {
                        "type": "string",
                        "enum": ["replace", "concat", "union", "prepend", "union_by_key"]
                    },
                    "array_key": {
                        "type": "string",
                        "description": "当 array_strategy=union_by_key 时，数组项对象的唯一键路径（支持 a.b[0].id / ['k'] 等）"
                    },
                    "remove_paths": {"type": "array", "items": {"type": ["string","integer"]}}
                },
                "additionalProperties": True
            }
        },
        "required": ["base", "overrides", "operation"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "result": {"type": "object", "additionalProperties": True}
        },
        "required": ["result"],
        "additionalProperties": False
    },
)
def apply(
    base: Dict[str, Any],
    overrides: Dict[str, Any],
    operation: str,
    options: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    常用策略：
      - replace：直接替换为 overrides
      - shallow_merge：顶层浅合并（dict.update）
      - merge/deep_merge：深度合并（数组策略可选 replace|concat|union|prepend|union_by_key）
      - append：深度合并 + 数组 concat
      - union：深度合并 + 数组 union（去重）
      - remove：在以上策略基础上，按 options.remove_paths 删除路径键（如 a.b[0]、x['k']）
    """
    op = (operation or "merge").lower()
    if op == "deep_merge":
        op = "merge"
    result = _apply_operation(base_document=base, overrides=overrides, operation=op, options=options)
    return {"result": result}