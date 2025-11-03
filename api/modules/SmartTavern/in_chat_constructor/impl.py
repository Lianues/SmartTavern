from __future__ import annotations

"""SmartTavern.in_chat_constructor 实现层
 - 接收 JSON 入参（history/presets_in_chat/world_books）
 - 输出 OpenAI Chat messages 扩展数组：为每条消息添加 source 来源字段（字段顺序尽量与来源条目一致）
 - 不合并相邻同角色；不再返回 trace（include_trace 参数被忽略）
"""

from typing import Any, Dict, List, Optional, Union
from collections import defaultdict
import core  # type: ignore

# 默认参数（合并自旧模块 variables.py）
DEFAULT_DEPTH: int = 0
DEFAULT_ORDER: int = 100
ALLOWED_ROLES = {"user", "assistant", "system", "thinking"}


def _is_enabled(val: Any) -> bool:
    """将 None 视为启用，仅 False 视为禁用。"""
    return False if val is False else True


def _role_priority(role: str) -> int:
    """assistant(0) < user(1) < system(2)"""
    return {"assistant": 0, "user": 1, "system": 2}.get(str(role), 2)


def _map_wb_pos_to_role(position: str) -> str:
    """世界书 position 映射为对话角色"""
    if position == "assistant":
        return "assistant"
    if position == "user":
        return "user"
    return "system"


def _flatten_world_books(items: Any) -> List[Dict[str, Any]]:
    """展平成新世界书格式：仅支持 {entries:[...]} 或 {world_book:{entries:[...]}}"""
    out: List[Dict[str, Any]] = []
    if not isinstance(items, dict):
        return out

    entries = items.get("entries")
    if isinstance(entries, list):
        for e in entries:
            if isinstance(e, dict):
                out.append(e)
        return out

    wb = items.get("world_book")
    if isinstance(wb, dict) and isinstance(wb.get("entries"), list):
        for e in wb["entries"]:
            if isinstance(e, dict):
                out.append(e)
    return out


def _sort_sources(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """按 order 升序 → 角色优先级 → internal_order 稳定排序"""
    return sorted(
        entries,
        key=lambda e: (
            int(e.get("order", DEFAULT_ORDER) or DEFAULT_ORDER),
            _role_priority(e.get("role", "system")),
            int(e.get("internal_order", 0) or 0),
        ),
    )

def _collect_history_text(history: List[Dict[str, Any]]) -> str:
    """将原始 history 的 content 拼接为文本（区分大小写）用于关键词匹配。"""
    texts: List[str] = []
    for msg in (history or []):
        try:
            c = (msg or {}).get("content")
        except Exception:
            c = None
        if isinstance(c, str):
            texts.append(c)
    return "\n".join(texts)

def _is_triggered_by_keys(history_text: str, keys: Any) -> bool:
    """
    基于 keys 触发逻辑（区分大小写）：
    - True：存在 keys 且至少一个关键词命中 history 文本
    - False：keys 缺失/为 0/为空数组/未命中
    """
    if keys == 0:
        return False
    key_list: List[str] = []
    if isinstance(keys, str):
        key_list = [keys]
    elif isinstance(keys, list):
        key_list = [str(k) for k in keys if k is not None]
    else:
        return False
    key_list = [k.strip() for k in key_list if isinstance(k, str) and k.strip()]
    if not key_list:
        return False
    text = history_text or ""
    for k in key_list:
        if k in text:
            return True
    return False


def _build_source_for_history(index: int, role: str) -> Dict[str, Any]:
    """历史消息来源字段，规范化 type 为 history.user/history.assistant/history.thinking"""
    r = (role or "").lower()
    if r == "user":
        t = "history.user"
    elif r == "assistant":
        t = "history.assistant"
    elif r == "thinking":
        t = "history.thinking"
    else:
        # 兜底：未声明角色统一归为 assistant 视角（避免产生未定义的 history.system）
        t = "history.assistant"
    return {
        "type": t,
        "id": f"history_{index}",
        "index": index,
    }


def _build_source_for_preset(p: Dict[str, Any], source_id: str) -> Dict[str, Any]:
    """
    构造预设来源字段：
    - 先放置 type 与 id（为来源标识），随后按原条目字段出现的顺序复制到 source 中
    - 原条目字段顺序来自 JSON 加载的插入顺序（Python 3.7+ dict 保序）
    """
    src: Dict[str, Any] = {
        "type": "preset.in-chat",
        "id": source_id,
    }
    # 按来源字段顺序复制
    for k in p.keys():
        src[k] = p.get(k)
    # 如预设缺少 role/depth/order 等字段，则不强制添加，保持与来源一致；UI 可通过消息顶层 role 使用
    return src


def _build_source_for_wb(wb: Dict[str, Any], source_id: str, derived_role: str) -> Dict[str, Any]:
    """
    构造世界书来源字段：
    - 先放置 type 与 id（为来源标识）
    - 按原条目字段顺序复制；当遇到原始 'id' 字段时，改名为 'wb_id' 以避免同键冲突
    - 追加 derived_role（源条目通常只有 position，没有 role），追加在末尾以不打破原字段顺序
    """
    src: Dict[str, Any] = {
        "type": "world_book.in-chat",
        "id": source_id,
    }
    for k in wb.keys():
        if k == "id":
            src["wb_id"] = wb.get(k)
        else:
            src[k] = wb.get(k)
    # 末尾追加 role（来源没有该字段时）
    if "role" not in src:
        src["role"] = derived_role
    return src


def _cond_to_bool(s: Any) -> bool:
    try:
        return str(s).strip().lower() == "true"
    except Exception:
        return False


def _eval_condition_text(cond: Any, variables: Optional[Dict[str, Any]]) -> bool:
    if not isinstance(cond, str) or not cond.strip():
        return False
    payload = {"text": cond, "variables": dict(variables or {})}
    try:
        res = core.call_api(
            "smarttavern/macro/process_text",
            payload,
            method="POST",
            namespace="modules",
        )
        out_text = (res or {}).get("text", "")
        return _cond_to_bool(out_text)
    except Exception:
        return False


def _eval_condition_texts_batch(conds: List[Any], variables: Optional[Dict[str, Any]]) -> List[bool]:
    """批量评估条件文本，内部走宏文本批量接口，失败时回退逐条。"""
    texts: List[str] = []
    index_map: List[int] = []
    for idx, c in enumerate(conds or []):
        if isinstance(c, str) and c.strip():
            texts.append(c)
            index_map.append(idx)
    if not texts:
        return [False] * len(conds)
    payload = {"texts": texts, "variables": dict(variables or {})}
    out_texts: List[str]
    try:
        res = core.call_api(
            "smarttavern/macro/process_text_batch",
            payload,
            method="POST",
            namespace="modules",
        )
        out_texts = (res or {}).get("texts", []) or []
    except Exception:
        out_texts = []
        # 回退逐条
        for t in texts:
            try:
                r = core.call_api(
                    "smarttavern/macro/process_text",
                    {"text": t, "variables": dict(variables or {})},
                    method="POST",
                    namespace="modules",
                )
                out_texts.append((r or {}).get("text", ""))
            except Exception:
                out_texts.append("")
    results = [False] * len(conds)
    for pos, txt in zip(index_map, out_texts):
        results[pos] = _cond_to_bool(txt)
    return results


def construct(
    history: List[Dict[str, Any]],
    presets_in_chat: List[Dict[str, Any]],
    world_books: Union[List[Any], Dict[str, Any]],
    include_trace: bool = False,  # 入参保留以兼容封装层，但在实现中忽略
    variables: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    组合对话：在 history 基础上按 depth/order 规则注入 in-chat 预设与命中的世界书。
    输出的每条消息字段顺序为：role → content → source
    """
    # 0) 归一化入参
    history = history or []
    presets_in_chat = presets_in_chat or []
    flat_wb = _flatten_world_books(world_books)
    history_text = _collect_history_text(history)
    # 条件变量上下文：合并调用方 variables，并注入 chat_history_text
    cond_vars: Dict[str, Any] = dict(variables or {})
    if "chat_history_text" not in cond_vars:
        cond_vars["chat_history_text"] = history_text

    # 1) 基于 history 初始化消息列表（为每条消息打来源；字段顺序为 role, content, source）
    constructed: List[Dict[str, Any]] = []
    for i, msg in enumerate(history):
        role = str(msg.get("role", "")).lower()
        content = msg.get("content", "")
        if role not in ALLOWED_ROLES:
            raise ValueError(f"invalid message role at history[{i}]: {role}")
        if not isinstance(content, str):
            content = "" if content is None else str(content)
        _src = _build_source_for_history(i, role)
        # 透传来源节点ID（若 history 元素包含 id 或 source_id 字段）
        try:
            _hid = msg.get("id") if isinstance(msg, dict) else None
            if _hid is None:
                _hid = msg.get("source_id") if isinstance(msg, dict) else None
            if _hid is not None:
                _src["source_id"] = _hid
        except Exception:
            pass
        constructed.append({
            "role": role,
            "content": content,
            "source": _src,
        })

    # 2) 收集 in-chat 预设与世界书候选
    candidates: List[Dict[str, Any]] = []
    # 批量收集需要条件判断的 preset
    preset_cond_indices: List[int] = []
    preset_cond_texts: List[str] = []
    for i, p in enumerate(presets_in_chat):
        try:
            if str(p.get("position")) != "in-chat":
                continue
            if not _is_enabled(p.get("enabled", True)):
                continue
            content = p.get("content")
            if not isinstance(content, str) or content == "":
                continue
            mode = str(p.get("mode", "always"))
            if mode == "conditional":
                preset_cond_indices.append(i)
                preset_cond_texts.append(str(p.get("condition", "")))
        except Exception:
            continue
    preset_cond_bools: Dict[int, bool] = {}
    if preset_cond_indices:
        bools = _eval_condition_texts_batch(preset_cond_texts, cond_vars)
        for j, idx in enumerate(preset_cond_indices):
            preset_cond_bools[idx] = bools[j] if j < len(bools) else False
    # 生成候选
    for i, p in enumerate(presets_in_chat):
        try:
            if str(p.get("position")) != "in-chat":
                continue
            if not _is_enabled(p.get("enabled", True)):
                continue
            content = p.get("content")
            if not isinstance(content, str) or content == "":
                continue
            mode = str(p.get("mode", "always"))
            if mode == "conditional" and not preset_cond_bools.get(i, False):
                continue
            depth = int(p.get("depth", DEFAULT_DEPTH) or DEFAULT_DEPTH)
            order = int(p.get("order", DEFAULT_ORDER) or DEFAULT_ORDER)
            role = str(p.get("role", "user")).lower()
            role = role if role in ALLOWED_ROLES else "user"
            candidates.append({
                "kind": "preset",
                "data": p,
                "depth": depth,
                "order": order,
                "role": role,
                "internal_order": i,
            })
        except Exception:
            continue

    # 批量收集需要条件判断的 world_book（仅 in-chat 段）
    wb_cond_indices: List[int] = []
    wb_cond_texts: List[str] = []
    for i, wb in enumerate(flat_wb):
        if not isinstance(wb, dict):
            continue
        try:
            pos = str(wb.get("position", ""))
            if pos in ("before_char", "after_char"):
                continue
            if not _is_enabled(wb.get("enabled", True)):
                continue
            content = wb.get("content")
            if not isinstance(content, str) or content == "":
                continue
            mode = str(wb.get("mode", "always"))
            if mode == "conditional":
                wb_cond_indices.append(i)
                wb_cond_texts.append(str(wb.get("condition", "")))
        except Exception:
            continue
    wb_cond_bools: Dict[int, bool] = {}
    if wb_cond_indices:
        bools2 = _eval_condition_texts_batch(wb_cond_texts, cond_vars)
        for j, idx in enumerate(wb_cond_indices):
            wb_cond_bools[idx] = bools2[j] if j < len(bools2) else False
    for i, wb in enumerate(flat_wb):
        if not isinstance(wb, dict):
            continue
        try:
            pos = str(wb.get("position", ""))
            if pos in ("before_char", "after_char"):
                continue
            if not _is_enabled(wb.get("enabled", True)):
                continue
            content = wb.get("content")
            if not isinstance(content, str) or content == "":
                continue
            mode = str(wb.get("mode", "always"))
            if mode == "conditional" and not wb_cond_bools.get(i, False):
                continue
            depth = int(wb.get("depth", DEFAULT_DEPTH) or DEFAULT_DEPTH)
            order = int(wb.get("order", DEFAULT_ORDER) or DEFAULT_ORDER)
            role = _map_wb_pos_to_role(pos)
            candidates.append({
                "kind": "world",
                "data": wb,
                "depth": depth,
                "order": order,
                "role": role,
                "internal_order": len(presets_in_chat) + i,
            })
        except Exception:
            continue

    # 3) 排序并按 depth 注入
    sorted_entries = _sort_sources(candidates)
    depth_groups: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for e in sorted_entries:
        depth_groups[int(e.get("depth", DEFAULT_DEPTH) or DEFAULT_DEPTH)].append(e)

    for depth in sorted(depth_groups.keys(), reverse=True):
        insertion_index = len(constructed) - int(depth)
        if insertion_index < 0:
            insertion_index = 0
        group = depth_groups[depth]
        # 逆序插入以保持组内先后
        for e in reversed(group):
            kind = e["kind"]
            data = e["data"]
            role = e["role"]
            content = data.get("content", "")
            # 构造 source 字段（字段顺序与来源条目一致）
            if kind == "preset":
                pid = data.get("identifier") or data.get("name") or str(e.get("internal_order", 0))
                src = _build_source_for_preset(data, source_id=f"preset_{pid}")
                # 统一附上 source_id，便于视图侧唯一标识（与 id 一致）
                try:
                    if "source_id" not in src and src.get("id") is not None:
                        src["source_id"] = src.get("id")
                except Exception:
                    pass
            else:
                wid = data.get("id")
                src = _build_source_for_wb(data, source_id=f"wb_{wid if wid is not None else e.get('internal_order', 0)}", derived_role=role)
                try:
                    if "source_id" not in src and src.get("id") is not None:
                        src["source_id"] = src.get("id")
                except Exception:
                    pass

            constructed.insert(insertion_index, {
                "role": role,
                "content": content,
                "source": src,
            })

    # 不再返回 trace，仅返回一套“带来源”的消息序列
    return {
        "messages": constructed
    }