# -*- coding: utf-8 -*-
"""
SmartTavern.workflow.smarttavern.variables_update 实现层

职责：
- 读取指定对话目录的 variables 文件（conversations/{name}/variables.json）
- 调用模块 API smarttavern/variables_update/merge 完成深度合并
- 返回合并后的变量 JSON（不落盘）

参考：
- [python.function(core.call_api)](core/__init__.py:12)
- [python.function(chat_branches.variables())](api/modules/SmartTavern/chat_branches/chat_branches.py:504)
- [python.function(variables_update.merge())](api/modules/SmartTavern/variables_update/variables_update.py:30)
"""
from __future__ import annotations

from typing import Any, Dict, Optional
import core  # 门面：统一 API 调用


def apply_to_conversation(
    file: str,
    overrides: Dict[str, Any],
    options: Optional[Dict[str, Any]] = None,
    operation: str = "merge",
) -> Dict[str, Any]:
    """
    参数：
    - file: 对话主文件路径（相对仓库根，如 backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json）
    - overrides: 需要覆盖更新的变量 JSON（对象）
    - options: 合并/策略选项，如 {"array_strategy":"replace|concat|union","remove_paths":["a.b[0]"]}
    - operation: 操作策略（默认 merge）：replace|shallow_merge|merge|deep_merge|append|union|remove

    返回：
    {
      "variables": { ... 操作后的变量 ... },
      "variables_file": "backend_projects/SmartTavern/data/conversations/xxx/variables.json"
    }
    """
    if not isinstance(file, str) or not file.strip():
        raise ValueError("file 必须为非空字符串")
    if not isinstance(overrides, dict):
        raise ValueError("overrides 必须为对象(dict)")

    # 1) 读取当前 variables（若不存在则默认 {}）
    get_payload = {"action": "get", "file": file}
    got = core.call_api(
        "smarttavern/chat_branches/variables",
        get_payload,
        method="POST",
        namespace="modules",
    )
    if not isinstance(got, dict):
        raise RuntimeError("读取 variables 失败：返回非对象")

    base_vars = got.get("variables") or {}
    if not isinstance(base_vars, dict):
        base_vars = {}

    variables_file = got.get("variables_file")

    # 2) 调用“变量操作策略”模块
    apply_payload = {
        "base": base_vars,
        "overrides": overrides,
        "operation": operation or "merge",
        "options": options or {},
    }
    applied_res = core.call_api(
        "smarttavern/variables_update/apply",
        apply_payload,
        method="POST",
        namespace="modules",
    )
    if not isinstance(applied_res, dict) or "result" not in applied_res:
        raise RuntimeError("变量策略应用失败：返回结构异常")

    result_vars = applied_res.get("result") or {}
    if not isinstance(result_vars, dict):
        result_vars = {"value": result_vars}

    return {
        "variables": result_vars,
        "variables_file": variables_file,
    }