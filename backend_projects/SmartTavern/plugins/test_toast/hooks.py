# -*- coding: utf-8 -*-
"""
测试插件：注册一个 toast 事件（stid: toast, op: toast）

目标：
- 指导 AI 在每条助手消息末尾追加 <postprocess>，包含一个 toast 项
- 复用前端 Toast 组件：data 包含 {type, message, timeout}
- 一次性（once=true）：保存前剔除，不进入历史
- 对 AI 不可见（visible_to_ai=false）：避免在下一轮再次传回给 AI
"""

from __future__ import annotations
from typing import Any, Dict
import core


_SPEC: Dict[str, Any] = {
        "stid": "toast",
        "description": (
            "在每条助手回复后追加一个 toast 提示。\n"
            "要求：严格在答案末尾追加 `<postprocess>{...}</postprocess>`，顶层以 stid 为键，值为 ops 数组。\n"
            "本 stid=toast 只允许 op=toast，data 结构如下：\n"
            "- type: 'info' | 'success' | 'warning' | 'error'\n"
            "- message: string\n"
            "- timeout: integer（可选，毫秒）\n"
            "建议 message 为对本轮助手回复的简要说明，如：'内容已生成' 或首句摘要。"
        ),
        "ops": [
            {
                "op": "toast",
                "data_schema": {
                    "type": "object",
                    "required": ["type", "message"],
                    "properties": {
                        "type": {"type": "string", "enum": ["info", "success", "warning", "error"]},
                        "message": {"type": "string"},
                        "timeout": {"type": "integer"}
                    },
                    "additionalProperties": False
                },
                "settings": {
                    "once": True,            # 不写入历史
                    "visible_to_ai": False   # 下一轮不回显给 AI
                }
            }
        ],
        "enabled": True,
        "priority": 1000  # 高优先级，确保约束靠前
}

def register_hooks(hook_manager):
    try:
        core.call_api(
            "smarttavern/postprocess/register_units",
            {"units": [_SPEC]},
            method="POST",
            namespace="plugins",
        )
    except Exception:
        # 注册失败不阻断加载
        pass
    return "test_toast"


