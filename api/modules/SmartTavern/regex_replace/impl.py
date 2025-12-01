from __future__ import annotations

"""
SmartTavern.regex_replace 实现层

功能概述
- 根据规则文件（数组 JSON）和 placement（before_macro/after_macro）对内容执行正则替换
- 支持两种输入形态：messages（带 role/content/source）或 text（纯文本）
- 对 messages：
  - 先基于“深度（depth）”限定生效范围（仅 messages 生效；text 默认对整段生效）
  - 再按 targets 过滤（role 或 source.type 匹配）
  - 再按 views（user_view/assistant_view）分别应用替换
  - 保留原 messages 结构，仅替换 content；输出 original/user_view/assistant_view 三套视图
- 对 text：
  - 忽略 depth 与 targets，默认整段生效
  - 按 views 产出 user_view/assistant_view 两套文本，同时透传 original

深度（depth）计算规则（仅 messages）
- 先过滤掉 source.type=='preset' 且 source.position=='relative' 的消息（仅用于计算锚点，不影响最终输出）
- 将剩余消息中，role ∈ {'user','assistant'} 的消息索引作为“锚点”
- 定义 depth(i) = 共有多少个锚点索引 >= i（含等号）
  - i > 最后一个锚点 → depth=0
  - 最后一个锚点 ≤ i ≤ 最后一个锚点 → depth=1（即最后一个锚点本身属于 depth=1）
  - 介于倒数第2与最后一个锚点之间（不含倒数第2锚点）→ depth=1
  - 倒数第2锚点本身 → depth=2
  - 以此类推；若没有锚点，则所有消息 depth=0
- 规则字段：
  - min_depth 未提供时默认 0
  - max_depth 未提供时默认“无上限”
"""

from typing import Any, Dict, List, Optional, Tuple
import re
import copy
import bisect
import json
import core  # type: ignore

def _dbg(label: str, data: Any = None) -> None:
    # 调试关闭：不输出任何日志
    return None


ALLOWED_VIEWS = {"user_view", "assistant_view"}
ROLE_SET = {"user", "assistant", "system"}


def _normalize_rules(rules: Any) -> List[Dict[str, Any]]:
    """
    接受数组或 {"regex_rules":[...]} 结构，返回规则数组
    """
    if isinstance(rules, list):
        return [r for r in rules if isinstance(r, dict)]
    if isinstance(rules, dict):
        arr = rules.get("regex_rules")
        if isinstance(arr, list):
            return [r for r in arr if isinstance(r, dict)]
    return []


def _transform_replacement(s: str) -> str:
    """
    将 $1/$2 形式替换为 Python re.sub 支持的 \\g<1> 形式
    """
    if not isinstance(s, str):
        return "" if s is None else str(s)
    return re.sub(r"\$(\d+)", r"\\g<\1>", s)


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
    """批量评估规则条件宏；失败时回退逐条，保持语义不变。"""
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
        # 回退逐条
        out_texts = []
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


def _apply_regex_to_text(text: str, find_regex: str, replace_regex: str) -> str:
    """
    对单段文本应用一次 find/replace；不抛异常，失败时返回原文
    """
    try:
        pattern = re.compile(find_regex)
        repl = _transform_replacement(replace_regex)
        return pattern.sub(repl, text)
    except Exception:
        return text


def _is_relative_preset_source(src: Any) -> bool:
    """
    判断来源是否为 relative 预设（仅用于深度锚点过滤）
    - 兼容新枚举：preset.relative
    """
    if not isinstance(src, dict):
        return False
    t = str(src.get("type", "")).lower()
    p = str(src.get("position", "")).lower()
    return t == "preset.relative" or (t.startswith("preset") and p == "relative")


def _compute_depths(messages: List[Dict[str, Any]]) -> List[int]:
    """
    计算每条消息的 depth 值（参见顶部注释）
    """
    n = len(messages)
    if n == 0:
        return []

    # 仅用于锚点计算的过滤（不改变最终输出）
    keep_indices: List[int] = []
    for i, m in enumerate(messages):
        src = m.get("source", {})
        if not _is_relative_preset_source(src):
            keep_indices.append(i)

    # 提取 user/assistant 锚点
    anchors: List[int] = []
    for i in keep_indices:
        role = str(messages[i].get("role", "")).lower()
        if role in ("user", "assistant"):
            anchors.append(i)

    anchors.sort()
    depths: List[int] = [0] * n
    if not anchors:
        # 无锚点 → 所有 depth=0
        return depths

    # depth(i) = 共有多少个锚点索引 >= i
    # 等价：len(anchors) - bisect_left(anchors, i)
    for i in range(n):
        k = bisect.bisect_left(anchors, i)
        depths[i] = len(anchors) - k
    return depths


def _depth_in_range(d: int, min_d: Optional[int], max_d: Optional[int]) -> bool:
    if min_d is None:
        min_d = 0
    if max_d is None:
        return d >= min_d
    return (d >= min_d) and (d <= max_d)


def _matches_targets(msg: Dict[str, Any], targets: Optional[List[str]]) -> bool:
    """
    targets 匹配语义（单字段，仅基于 source.type，不再支持角色匹配）：
    - 精确来源：完整 type 值（如 'preset.in-chat', 'world_book.before_char'）
    - 前缀大类：'preset' | 'world_book' | 'history' | 'char' | 'persona'
      - 命中规则：stype == prefix 或 stype 以 'prefix.' 开头
    - targets 为空或非法 → 视为“全部匹配”
    - 若同时选择前缀大类与其子集，视为命中大类（实现为统一 True）
    """
    if not isinstance(targets, list) or not targets:
        return True

    tset = {str(t).lower() for t in targets if t is not None}
    src = msg.get("source", {}) or {}
    stype = str(src.get("type", "")).lower()

    # 1) 精确来源命中
    if stype in tset:
        return True

    # 2) 前缀大类命中
    PREFIXES = {"preset", "world_book", "history", "char", "persona"}
    for t in tset:
        if t in PREFIXES and (stype == t or stype.startswith(t + ".")):
            return True

    return False


def _filter_rules_by_placement(rules: List[Dict[str, Any]], placement: str, variables: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    # 先做静态过滤 + 收集需要批量条件判断的规则
    pending_indices: List[int] = []
    pending_conds: List[str] = []
    prelim: List[Optional[Dict[str, Any]]] = []
    for i, r in enumerate(rules):
        try:
            if r.get("enabled") is not True:
                prelim.append(None); continue
            if str(r.get("placement", "")).lower() != str(placement).lower():
                prelim.append(None); continue
            if not r.get("find_regex"):
                prelim.append(None); continue
            views = r.get("views") or []
            if not isinstance(views, list) or not views:
                prelim.append(None); continue
            if not any(v in ALLOWED_VIEWS for v in views):
                prelim.append(None); continue
            mode = str(r.get("mode", "always")).lower()
            if mode == "conditional":
                pending_indices.append(i)
                pending_conds.append(str(r.get("condition", "")))
            elif mode != "always":
                prelim.append(None); continue
            prelim.append(r)
        except Exception:
            prelim.append(None)
            continue
    cond_ok: Dict[int, bool] = {}
    if pending_indices:
        bools = _eval_condition_texts_batch(pending_conds, variables)
        for j, idx in enumerate(pending_indices):
            cond_ok[idx] = bools[j] if j < len(bools) else False
    for i, r in enumerate(prelim):
        if r is None:
            continue
        mode = str(r.get("mode", "always")).lower()
        if mode == "conditional" and not cond_ok.get(i, False):
            continue
        out.append(r)
    return out


def _filter_rules_by_view_and_placement(rules: List[Dict[str, Any]], placement: str, view: Optional[str], variables: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    过滤到指定 placement 且包含指定 view 的规则；若 view 无效/为空，返回空列表（视为不执行）
    """
    if view not in ALLOWED_VIEWS:
        return []
    selected = _filter_rules_by_placement(rules, placement, variables)
    out: List[Dict[str, Any]] = []
    for r in selected:
        views = r.get("views") or []
        if isinstance(views, list) and view in views:
            out.append(r)
    return out


def _apply_rules_to_messages_for_view(
    messages: List[Dict[str, Any]],
    rules: List[Dict[str, Any]],
    placement: str,
    view: Optional[str],
    variables: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    对 messages 仅应用某个视图（user_view 或 assistant_view）可见的规则，返回单视图处理后的 messages。
    - 若 view 非法/未提供，则直接返回原始 messages（不执行）
    """
    if view not in ALLOWED_VIEWS:
        return [dict(m) for m in (messages or [])]

    out_msgs = [dict(m) for m in (messages or [])]
    depths = _compute_depths(messages)
    selected_rules = _filter_rules_by_view_and_placement(rules, placement, view, variables)

    for rule in selected_rules:
        find_regex = str(rule.get("find_regex", ""))
        replace_regex = str(rule.get("replace_regex", ""))
        # depth 窗口
        min_d = rule.get("min_depth", 0)
        try:
            min_d = int(min_d) if min_d is not None else 0
        except Exception:
            min_d = 0
        max_d_raw = rule.get("max_depth", None)
        try:
            max_d = int(max_d_raw) if max_d_raw is not None else None
        except Exception:
            max_d = None

        targets = rule.get("targets", [])

        # 预编译正则一次
        try:
            pattern = re.compile(find_regex)
            repl = _transform_replacement(replace_regex)
        except Exception:
            continue

        for idx, m in enumerate(out_msgs):
            try:
                d = depths[idx] if idx < len(depths) else 0
                if not _depth_in_range(d, min_d, max_d):
                    if idx == 0:
                        _dbg("skip.depth", {"idx": idx, "d": d, "min": min_d, "max": max_d})
                    continue

                # 目标匹配调试（仅 idx==0 打印一次以便定位）
                msg0 = messages[idx] if idx < len(messages) else {}
                src0 = (msg0 or {}).get("source") or {}
                stype0 = str(src0.get("type", "")).lower()
                if not _matches_targets(msg0, targets):
                    if idx == 0:
                        _dbg("skip.targets", {"stype": stype0, "targets": targets})
                    continue

                old = m.get("content", "")
                if not isinstance(old, str):
                    old = "" if old is None else str(old)

                new_text = pattern.sub(repl, old)
                if new_text != old:
                    if idx == 0:
                        _dbg("replaced", {
                            "idx": idx,
                            "stype": stype0,
                            "find": find_regex,
                            "preview_before": old[:80],
                            "preview_after": new_text[:80],
                        })
                    m["content"] = new_text
                else:
                    if idx == 0:
                        _dbg("no_change_after_sub", {
                            "idx": idx,
                            "stype": stype0,
                            "find": find_regex,
                            "preview": old[:80],
                        })
            except Exception as e:
                if idx == 0:
                    _dbg("exception.at_idx0", repr(e))
                continue

    return out_msgs


def _apply_rules_to_text_for_view(
    text: str,
    rules: List[Dict[str, Any]],
    placement: str,
    view: Optional[str],
    variables: Optional[Dict[str, Any]],
) -> str:
    """
    对纯文本仅应用某个视图可见的规则；若 view 非法/未提供，直接返回原文本
    - 对 text 不考虑 depth/targets
    """
    if view not in ALLOWED_VIEWS:
        return "" if text is None else str(text)

    txt = "" if text is None else str(text)
    selected_rules = _filter_rules_by_view_and_placement(rules, placement, view, variables)

    for rule in selected_rules:
        find_regex = str(rule.get("find_regex", ""))
        replace_regex = str(rule.get("replace_regex", ""))
        try:
            pattern = re.compile(find_regex)
            repl = _transform_replacement(replace_regex)
        except Exception:
            continue
        try:
            txt = pattern.sub(repl, txt)
        except Exception:
            pass

    return txt


def apply_regex_messages_view(
    rules: Any,
    placement: str,
    view: Optional[str],
    messages: Optional[List[Dict[str, Any]]] = None,
    variables: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    单视图消息替换：
    - 若 view 非法/未提供：不执行，直接返回 {"message": messages}
    - 否则仅应用指定 view 的规则，返回 {"message": processed_messages}
    """
    try:
        _dbg("apply_messages.enter", {
            "placement": placement,
            "view": view,
            "messages_is_list": isinstance(messages, list),
            "rules_type": type(rules).__name__,
            "rules_len": (len(rules) if isinstance(rules, list) else (len((rules or {}).get("regex_rules", [])) if isinstance(rules, dict) else None)),
        })
    except Exception:
        pass

    if not isinstance(messages, list):
        return {"message": []}
    placement_norm = str(placement or "").lower()
    if placement_norm not in ("before_macro", "after_macro"):
        return {"message": [dict(m) for m in (messages or [])]}

    try:
        rule_list = _normalize_rules(rules)
        _dbg("apply_messages.rules_norm_len", len(rule_list))
    except Exception as e:
        _dbg("apply_messages.normalize.exception", repr(e))
        rule_list = []

    try:
        out_msgs = _apply_rules_to_messages_for_view(messages, rule_list, placement_norm, view, variables)
        _dbg("apply_messages.out_first", (out_msgs[0].get("content") if out_msgs else ""))
    except Exception as e:
        _dbg("apply_messages.inner.exception", repr(e))
        out_msgs = [dict(m) for m in (messages or [])]
    return {"message": out_msgs}


def apply_regex_text_view(
    rules: Any,
    placement: str,
    view: Optional[str],
    text: Optional[str] = None,
    variables: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    单视图纯文本替换：
    - 若 view 非法/未提供：不执行，直接返回 {"text": 原文}
    - 否则仅应用指定 view 的规则，返回 {"text": processed_text}
    """
    placement_norm = str(placement or "").lower()
    if placement_norm not in ("before_macro", "after_macro"):
        return {"text": "" if text is None else str(text)}
    rule_list = _normalize_rules(rules)
    out_text = _apply_rules_to_text_for_view(text or "", rule_list, placement_norm, view, variables)
    return {"text": out_text}