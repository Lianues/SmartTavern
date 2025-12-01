#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API 封装层：SmartTavern.python_sandbox
- 注册受限 Python 求值 API（表达式 + 受限语句）
"""
from typing import Any, Dict, Optional
import core
from .impl import eval_expr as _eval_expr


@core.register_api(
    path="smarttavern/python_sandbox/eval",
    name="Python 表达式沙盒求值",
    description="在受限沙盒中安全求值表达式或简单语句（允许赋值、简单 If、受限属性白名单调用；禁止导入/循环/异常处理/with/try 等），返回字符串化结果与变量状态（initial/final）",
    input_schema={
        "type": "object",
        "properties": {
            "code": {"type": "string"},
            "variables": {"type": "object", "additionalProperties": True},
            "policy": {
                "type": "object",
                "properties": {
                    "undefined_get": {"type": "string", "enum": ["error", "empty"]},
                    "error_token": {"type": "string"},
                },
                "additionalProperties": True,
            },
        },
        "required": ["code"],
        "additionalProperties": False,
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "result": {"type": "string"},
            "error": {"type": ["string", "null"]},
            "variables": {
                "type": "object",
                "properties": {
                    "initial": {"type": "object", "additionalProperties": True},
                    "final": {"type": "object", "additionalProperties": True},
                },
                "required": ["initial", "final"],
                "additionalProperties": False,
            },
        },
        "required": ["success", "result", "error", "variables"],
        "additionalProperties": False,
    },
)
def eval(
    code: str,
    variables: Optional[Dict[str, Any]] = None,
    policy: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return _eval_expr(code=code, variables=variables or {}, policy=policy or {})