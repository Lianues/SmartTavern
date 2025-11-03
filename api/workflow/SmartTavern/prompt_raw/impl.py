"""
SmartTavern Prompt Workflow Implementation (impl.py)

说明:
- 仅包含实现逻辑，不做 API 注册
- 输入为 JSON 对象/数组，参考 backend_projects/SmartTavern/data 的结构，但不读取文件
"""
from typing import Any, Dict, List, Optional
import asyncio
import core


def _extract_prompts(doc: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """从 presets 文档中提取 prompts 数组（容错）。"""
    if not isinstance(doc, dict):
        return []
    arr = doc.get("prompts")
    return arr if isinstance(arr, list) else []


def _split_presets(doc: Optional[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """拆分 relative 与 in-chat 预设。"""
    rel, inch = [], []
    for p in _extract_prompts(doc):
        if not isinstance(p, dict):
            continue
        pos = str(p.get("position", "")).lower()
        if pos == "relative":
            rel.append(p)
        elif pos == "in-chat":
            inch.append(p)
    return {"relative": rel, "in_chat": inch}


async def assemble_full(
    presets: Dict[str, Any],
    history: List[Dict[str, Any]],
    world_books: Any = None,
    character: Optional[Dict[str, Any]] = None,
    persona: Optional[Dict[str, Any]] = None,
    variables: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    执行流程
    1) 组合世界书：world_books_doc + character_doc.world_book.entries（若存在）
    2) 调用 modules/smarttavern/framing_prompt/assemble（HTTP via core.call_api → 线程池）
    3) 提取 in-chat 预设并调用 modules/smarttavern/in_chat_constructor/construct（HTTP via core.call_api → 线程池）
    4) 拼接与返回
    """
    # 1) 世界书透传（不做扁平与合并；上游负责准备完整 world_books）
    combined_wb: Any = world_books if world_books is not None else []

    # 兼容下游模块输入：in_chat_constructor / framing_prompt 期望 {"entries": [...]} 或 {"world_book": {"entries": [...]}}
    def _wrap_world_books(items: Any) -> Any:
        if isinstance(items, list):
            return {"entries": items}
        return items or {"entries": []}
    world_books_payload = _wrap_world_books(combined_wb)

    # 2) in-chat（先按 depth/order 注入 in-chat 预设与世界书，产出“带来源”的对话块）
    presets_split = _split_presets(presets or {})
    presets_in_chat = presets_split["in_chat"]
 
    # history 可为数组或 {"messages":[...]}，in_chat_constructor 支持数组形态
    if isinstance(history, dict) and isinstance(history.get("messages"), list):
        history_for_inchat = history.get("messages") or []
    else:
        history_for_inchat = history or []
 
    in_chat_payload = {
        "history": history_for_inchat,
        "presets_in_chat": presets_in_chat,
        "world_books": world_books_payload,
        "variables": dict(variables or {}),
    }
    inchat_res = await asyncio.to_thread(
        core.call_api,
        "smarttavern/in_chat_constructor/construct",
        in_chat_payload,
        method="POST",
        namespace="modules",
    )
    in_chat_with_source = inchat_res.get("messages", []) or []
 
    # 3) framing（将 in-chat 结果替代 chatHistory，占位于 relative 的顺序位置）
    framing_payload = {
        "history": {"messages": in_chat_with_source},
        "world_books": world_books_payload,
        "presets_doc": presets or {},
        "character": character or {},
        "persona": persona or {},
    }
    framing_res = await asyncio.to_thread(
        core.call_api,
        "smarttavern/framing_prompt/assemble",
        framing_payload,
        method="POST",
        namespace="modules",
    )
    final_messages = framing_res.get("messages", []) or []
    return {"messages": final_messages}