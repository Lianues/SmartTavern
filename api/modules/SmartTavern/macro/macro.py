#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API 封装层：SmartTavern.macro
- 注册“顺序宏处理（仅修改 content）”API
"""
from typing import Any, Dict, List, Optional
import os
from concurrent.futures import ThreadPoolExecutor
import core
from .impl import process_messages as _process_messages, process_text_value as _process_text_value
from .impl import register_custom_macros as _register_custom_macros
from .impl import list_custom_macros as _list_custom_macros
from .impl import clear_custom_macros as _clear_custom_macros


@core.register_api(
    path="smarttavern/macro/process",
    name="顺序宏处理（支持 {{..}} 与 <<..>>）",
    description="按顺序处理消息数组中的宏（setvar/getvar/python），仅替换 content，保留 source 等其他字段不变，并返回变量表（initial/final）",
    input_schema={
        "type": "object",
        "properties": {
            "messages": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "role": {"type": "string"},
                        "content": {"type": "string"},
                        "source": {"type": "object", "additionalProperties": True}
                    },
                    "required": ["role", "content"],
                    "additionalProperties": True
                }
            },
            "variables": {"type": "object", "additionalProperties": True},
        },
        "required": ["messages"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "messages": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "role": {"type": "string"},
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
        "required": ["messages", "variables"],
        "additionalProperties": False
    },
)
def process(
    messages: List[Dict[str, Any]],
    variables: Optional[Dict[str, Any]] = None,
    policy: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return _process_messages(messages=messages, variables=variables or {}, policy=policy or {})


@core.register_api(
    path="smarttavern/macro/register",
    name="注册自定义宏（供插件扩展）",
    description=(
        "注册一组自定义传统宏，形如 {{name:params}}/<<name:params>>。\n"
        "每个宏以 name 标识，并提供 handler_api（被调用以生成替换文本）。\n"
        "调用时将传入 {name, params, variables}。handler_api 应返回 {text, variables?} 或字符串（text）。"
    ),
    input_schema={
        "type": "object",
        "properties": {
            "macros": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "handler_api": {"type": "string"}
                    },
                    "required": ["name", "handler_api"],
                    "additionalProperties": False
                }
            }
        },
        "required": ["macros"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "count": {"type": "integer"}
        },
        "required": ["success", "count"],
        "additionalProperties": False
    },
)
def register(macros: list[dict]) -> dict:
    _register_custom_macros(macros or [])
    return {"success": True, "count": len(macros or [])}


@core.register_api(
    path="smarttavern/macro/list",
    name="列出已注册的自定义宏",
    description="返回当前在内存中的自定义宏名称与 handler_api 映射",
    input_schema={
        "type": "object",
        "properties": {},
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "items": {"type": "object", "additionalProperties": {"type": "string"}}
        },
        "required": ["success", "items"],
        "additionalProperties": False
    },
)
def list_registered() -> dict:
    return {"success": True, "items": _list_custom_macros()}


@core.register_api(
    path="smarttavern/macro/clear",
    name="清空自定义宏注册",
    description="清空当前内存中的所有自定义宏注册项",
    input_schema={
        "type": "object",
        "properties": {},
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {"success": {"type": "boolean"}},
        "required": ["success"],
        "additionalProperties": False
    },
)
def clear() -> dict:
    _clear_custom_macros()
    return {"success": True}

@core.register_api(
    path="smarttavern/macro/process_text",
    name="纯文本顺序宏处理（支持 {{..}} 与 <<..>>）",
    description="按顺序处理单个纯文本中的宏，仅返回处理后的 text 与变量表（initial/final）",
    input_schema={
        "type": "object",
        "properties": {
            "text": {"type": "string"},
            "variables": {"type": "object", "additionalProperties": True},
        },
        "required": ["text"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "text": {"type": "string"},
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
        "required": ["text", "variables"],
        "additionalProperties": False
    },
)
def process_text(
    text: str,
    variables: Optional[Dict[str, Any]] = None,
    policy: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return _process_text_value(text=text, variables=variables or {}, policy=policy or {})


@core.register_api(
    path="smarttavern/macro/process_text_batch",
    name="纯文本顺序宏处理（批量）",
    description="批量处理多条纯文本中的宏；按输入顺序逐条依次处理，返回处理后的 texts 与每条对应的 variables（initial/final）",
    input_schema={
        "type": "object",
        "properties": {
            "texts": {"type": "array", "items": {"type": "string"}},
            "variables": {"type": "object", "additionalProperties": True},
        },
        "required": ["texts"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "texts": {"type": "array", "items": {"type": "string"}},
            "variables_list": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "initial": {"type": "object", "additionalProperties": True},
                        "final": {"type": "object", "additionalProperties": True}
                    },
                    "required": ["initial", "final"],
                    "additionalProperties": False
                }
            }
        },
        "required": ["texts", "variables_list"],
        "additionalProperties": False
    },
)
def process_text_batch(
    texts: List[str],
    variables: Optional[Dict[str, Any]] = None,
    policy: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    n = len(texts or [])
    if n == 0:
        return {"texts": [], "variables_list": []}
    base_vars = variables or {}
    pol = policy or {}
    out_texts: List[str] = [""] * n
    out_vars: List[Dict[str, Any]] = [
        {"initial": dict(base_vars), "final": dict(base_vars)}
    ] * n

    # 为每条 condition 使用变量的“镜像”（dict 拷贝），保证互不影响
    def _work(idx: int, text: str) -> None:
        try:
            res = _process_text_value(text=text, variables=dict(base_vars), policy=pol)
        except Exception:
            res = None
        out_texts[idx] = str((res or {}).get("text", ""))
        out_vars[idx] = (res or {}).get("variables", {"initial": dict(base_vars), "final": dict(base_vars)})

    # 线程并发：对 CPU 计算量较小场景收益有限，但能与外部 I/O 重叠；保持次序输出
    max_workers = min(max(1, (os.cpu_count() or 1)), n)
    if max_workers <= 1 or n <= 1:
        for i, t in enumerate(texts):
            _work(i, t)
    else:
        with ThreadPoolExecutor(max_workers=max_workers) as ex:
            for i, t in enumerate(texts):
                ex.submit(_work, i, t)
        # 由于我们直接写入预分配数组，不需要在此 join 结果，with 会等待所有任务结束

    return {"texts": out_texts, "variables_list": out_vars}