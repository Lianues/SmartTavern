# -*- coding: utf-8 -*-
"""
SmartTavern.assets_normalizer 实现层

职责
- 提取：
  • 预设 JSON 内的 regex_rules
  • 角色卡 JSON 内的 world_book.entries（作为 in-chat 世界书条目）
  • 角色卡 JSON 内的 regex_rules
- 合并：
  • 多个世界书 → 单一“世界书数组”（list[dict]，每项为一条世界书条目）
    顺序：原始 world_books 合并体 在前 → 角色卡 world_book.entries 在后
  • 多源正则 → 单一正则对象 {"regex_rules":[...]}
    顺序：独立正则 → 预设正则 → 角色卡正则
    去重：默认按 id → name → find_regex；冲突策略默认 keep_first

注意
- 下游模块（framing_prompt / in_chat_constructor）对 world_books 的消费习惯是“直接数组/或嵌套数组，元素为带 position/enabled/content 的条目对象”，
  因此本模块“世界书合并”的输出采用 list[dict] 而非 {"entries":[...]} 的包裹结构，以保证向后兼容。
"""

from __future__ import annotations
from typing import Any, Dict, List, Tuple, Optional
import hashlib
import copy


# ========== 低阶工具 ==========

def _is_list(x: Any) -> bool:
    return isinstance(x, list)

def _is_dict(x: Any) -> bool:
    return isinstance(x, dict)

def _deepcopy_json(x: Any) -> Any:
    try:
        return copy.deepcopy(x)
    except Exception:
        return x

def _hash_text(s: str) -> str:
    try:
        return hashlib.sha1((s or "").encode("utf-8")).hexdigest()
    except Exception:
        return ""

def _safe_str(x: Any) -> str:
    if isinstance(x, str):
        return x
    if x is None:
        return ""
    return str(x)

def _dedup_key_for_wb(item: Dict[str, Any]) -> str:
    """
    世界书去重键：
    - 优先 id（含数字 id 也可）
    - 退化为 name + '#' + sha1(content)
    """
    if not _is_dict(item):
        return ""
    if "id" in item:
        return f"id:{_safe_str(item.get('id'))}"
    name = _safe_str(item.get("name"))
    content = _safe_str(item.get("content"))
    return f"name:{name}#sha1:{_hash_text(content)}"

def _dedup_key_for_rule(rule: Dict[str, Any], dedup_by: str = "auto") -> str:
    """
    正则去重键：
    - auto: id > name > find_regex
    - id/name/find_regex: 强制某一键
    """
    if not _is_dict(rule):
        return ""
    chosen = dedup_by.lower().strip() if isinstance(dedup_by, str) else "auto"
    if chosen == "id":
        return f"id:{_safe_str(rule.get('id'))}"
    if chosen == "name":
        return f"name:{_safe_str(rule.get('name'))}"
    if chosen in ("pattern", "find_regex", "findregex"):
        return f"re:{_safe_str(rule.get('find_regex'))}"
    # auto
    if "id" in rule and _safe_str(rule.get("id")) != "":
        return f"id:{_safe_str(rule.get('id'))}"
    if "name" in rule and _safe_str(rule.get("name")) != "":
        return f"name:{_safe_str(rule.get('name'))}"
    return f"re:{_safe_str(rule.get('find_regex'))}"

def _normalize_rules_array(maybe_rules: Any, add_source: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    归一化成规则数组（不抛异常）
    - 支持：list[dict] 或 {"regex_rules":[...]}
    - add_source: 为每条规则注入 meta.source
    """
    arr: List[Dict[str, Any]] = []
    try:
        if _is_list(maybe_rules):
            for r in maybe_rules:
                if _is_dict(r):
                    arr.append(_deepcopy_json(r))
        elif _is_dict(maybe_rules):
            # 使用标准的 "regex_rules" 字段
            sub = maybe_rules.get("regex_rules")
            if _is_list(sub):
                for r in sub:
                    if _is_dict(r):
                        arr.append(_deepcopy_json(r))
    except Exception:
        pass

    if add_source:
        for r in arr:
            try:
                meta = r.get("meta") if _is_dict(r.get("meta")) else {}
                meta = dict(meta)
                meta["source"] = add_source
                r["meta"] = meta
            except Exception:
                pass
    return arr

def _collect_rules_from_mixed(container: Any, add_source: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    聚合多源规则：
    - 支持：直接数组、{"regex_rules":[...]}、{"items":[ [...], {"regex_rules":[...]}, ... ]}
    - 支持：{"key1": {"regex_rules":[...]}, "key2": {...}} 字典的值是规则容器
    """
    if container is None:
        return []
    out: List[Dict[str, Any]] = []

    # 1) 直接数组 / {"regex_rules":[...]}
    if _is_list(container):
        return _normalize_rules_array(container, add_source=add_source)
    
    if _is_dict(container):
        # 检查是否有 "regex_rules" 键（单一规则容器）
        if "regex_rules" in container:
            return _normalize_rules_array(container, add_source=add_source)
        
        # 2) {"items":[ ... ]} 格式
        items = container.get("items")
        if _is_list(items):
            for it in items:
                out.extend(_normalize_rules_array(it, add_source=add_source))
            return out
        
        # 3) 字典的值是规则容器：{"regex_0": {"regex_rules":[...]}, "regex_1": {...}}
        # 遍历所有值，尝试从每个值中提取规则
        for key, value in container.items():
            if _is_dict(value):
                rules = _normalize_rules_array(value, add_source=add_source)
                out.extend(rules)
    
    return out


# ========== 世界书工具 ==========

def _flatten_world_books(items: Any) -> List[Dict[str, Any]]:
    """
    展平成新世界书格式：仅支持 {entries:[...]} 或 {world_book:{entries:[...]}}。
    """
    out: List[Dict[str, Any]] = []
    if not _is_dict(items):
        return out

    # { "entries": [ ... ] }
    ens = items.get("entries")
    if _is_list(ens):
        for e in ens:
            if _is_dict(e):
                out.append(_deepcopy_json(e))
        return out

    # { "world_book": { "entries": [ ... ] } }
    wb = items.get("world_book")
    if _is_dict(wb) and _is_list(wb.get("entries")):
        for e in wb.get("entries"):
            if _is_dict(e):
                out.append(_deepcopy_json(e))
    return out

def _normalize_char_world_book_entries(character: Any) -> List[Dict[str, Any]]:
    """
    从 角色卡.character["world_book"]["entries"] 抽取条目数组。
    - 注入 enabled 默认 True（若缺省）
    - 保留原字段与顺序；不强行改动 position/role/order
    """
    if not _is_dict(character):
        return []
    wb = character.get("world_book")
    entries: List[Dict[str, Any]] = []
    if _is_dict(wb) and _is_list(wb.get("entries")):
        for e in wb["entries"]:
            if not _is_dict(e):
                continue
            item = _deepcopy_json(e)
            if "enabled" not in item:
                item["enabled"] = True
            entries.append(item)
    return entries


# ========== 提取 ==========

def extract_preset_regex_impl(preset: Dict[str, Any]) -> Dict[str, Any]:
    """
    提取预设中的 regex_rules，标准化为 {"regex_rules":[...]} 并注入 meta.source="preset"
    """
    rules = []
    if _is_dict(preset):
        rules = _normalize_rules_array(preset.get("regex_rules"), add_source="preset")
    return {
        "regex_rules": rules,
        "meta": {
            "source": "preset",
            "count": len(rules),
        }
    }

def extract_character_world_book_impl(character: Dict[str, Any]) -> Dict[str, Any]:
    """
    提取角色卡 world_book.entries，输出 {"entries":[...]}
    """
    entries = _normalize_char_world_book_entries(character)
    return {
        "entries": entries,
        "meta": {
            "source": "character",
            "count": len(entries),
        }
    }

def extract_character_regex_impl(character: Dict[str, Any]) -> Dict[str, Any]:
    """
    提取角色卡中的 regex_rules，标准化为 {"regex_rules":[...]} 并注入 meta.source="character"
    """
    rules = []
    if _is_dict(character):
        rules = _normalize_rules_array(character.get("regex_rules"), add_source="character")
    return {
        "regex_rules": rules,
        "meta": {
            "source": "character",
            "count": len(rules),
        }
    }


# ========== 合并 ==========

def merge_world_books_impl(
    world_books: Any,
    character_world_book: Any,
    allow_override: bool = False,
    dedup_key: str = "auto"
) -> Dict[str, Any]:
    """
    合并世界书：
    - 输入：
      • world_books: 任意结构，展平后为 list[dict]
      • character_world_book: {"items":[...]} | list[dict]
      • allow_override: True 则角色卡条目可覆盖同 key 的原条目；False 保留先出现者
      • dedup_key: "auto"（id>name+content）| "id"
    - 输出：
      {"world_book":[...], "meta":{...}}
    """
    base_list: List[Dict[str, Any]] = _flatten_world_books(world_books)
    # 统一新格式：character_world_book 也是 {entries:[...]} 或 {world_book:{entries:[...]}}
    char_items: List[Dict[str, Any]] = _flatten_world_books(character_world_book) if character_world_book is not None else []

    result: List[Dict[str, Any]] = []
    seen: Dict[str, int] = {}
    removed = 0

    def add_item(it: Dict[str, Any], is_override_stage: bool = False):
        nonlocal removed
        key = _dedup_key_for_wb(it) if dedup_key == "auto" else f"id:{_safe_str(it.get('id'))}"
        if key in seen:
            if is_override_stage and allow_override:
                idx = seen[key]
                result[idx] = _deepcopy_json(it)
            else:
                removed += 1
            return
        seen[key] = len(result)
        result.append(_deepcopy_json(it))

    # 先放入原 world_books
    for it in base_list:
        if not _is_dict(it):
            continue
        add_item(it, is_override_stage=False)

    # 再放入角色卡 world_book
    for it in char_items:
        if not _is_dict(it):
            continue
        add_item(it, is_override_stage=True)

    return {
        "world_book": result,
        "meta": {
            "order": ["original_world_books", "character_world_book"],
            "input_counts": {
                "world_books_flat": len(base_list),
                "character_world_book_items": len(char_items),
            },
            "dedup_removed_count": removed,
            "total": len(result),
            "allow_override": allow_override,
            "dedup_key": dedup_key,
        }
    }

def merge_regex_impl(
    independent_regex: Any,
    preset_regex: Any,
    character_regex: Any,
    options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    合并正则规则，顺序：独立 → 预设 → 角色卡
    - 输入可为：
      • 数组
      • {"regex_rules":[...]}
      • {"items":[ [...], {"regex_rules":[...]}, ... ]}
    - options:
      {
        "dedup_by": "auto|id|name|pattern",
        "on_conflict": "keep_first|override_later"
      }
    - 输出：{"merged_regex":{"regex_rules":[...]}, "meta":{...}}
    """
    opts = options or {}
    dedup_by = _safe_str(opts.get("dedup_by") or "auto")
    on_conflict = _safe_str(opts.get("on_conflict") or "keep_first").lower()

    indep_rules = _collect_rules_from_mixed(independent_regex, add_source="independent")
    preset_rules = _collect_rules_from_mixed(preset_regex, add_source="preset")
    char_rules = _collect_rules_from_mixed(character_regex, add_source="character")

    seq = [
        ("independent", indep_rules),
        ("preset", preset_rules),
        ("character", char_rules),
    ]

    out: List[Dict[str, Any]] = []
    seen: Dict[str, int] = {}
    removed = 0

    def push(rule: Dict[str, Any], stage_index: int):
        nonlocal removed
        key = _dedup_key_for_rule(rule, dedup_by=dedup_by)
        if key in seen:
            if on_conflict == "override_later":
                idx = seen[key]
                out[idx] = _deepcopy_json(rule)
            else:
                removed += 1
            return
        seen[key] = len(out)
        out.append(_deepcopy_json(rule))

    for stage_idx, (_, rules) in enumerate(seq):
        for r in rules:
            if not _is_dict(r):
                continue
            push(r, stage_idx)

    return {
        "merged_regex": {"regex_rules": out},
        "meta": {
            "order": ["independent", "preset", "character"],
            "input_counts": {
                "independent": len(indep_rules),
                "preset": len(preset_rules),
                "character": len(char_rules),
            },
            "dedup_removed_count": removed,
            "total": len(out),
            "dedup_by": dedup_by,
            "on_conflict": on_conflict,
        }
    }


# ========== 主流程 ==========

def normalize_impl(
    preset: Dict[str, Any],
    world_books: Any,
    character: Dict[str, Any],
    regex_files: Any,
    options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    一键标准化：
    - 统一输出：
      {
        "preset": {... 原样回传 ...},
        "world_book": [ ... 合并后的世界书条目 ... ],
        "character": { ... 原样回传 ... },
        "merged_regex": { "regex_rules":[...] },
        "meta": { "stats":{...}, "order":{...}, "warnings":[...] }
      }
    """
    # 1) 提取
    preset_rx = extract_preset_regex_impl(preset)
    char_wb = extract_character_world_book_impl(character)
    char_rx = extract_character_regex_impl(character)

    # 2) 合并世界书
    wb_merge = merge_world_books_impl(
        world_books=world_books,
        character_world_book=char_wb,
        allow_override=False,
        dedup_key="id",
    )

    # 3) 合并正则：独立 → 预设 → 角色卡
    indep_rx = _collect_rules_from_mixed(regex_files, add_source="independent")
    rx_merge = merge_regex_impl(
        independent_regex=indep_rx,  # 直接传数组
        preset_regex=preset_rx,
        character_regex=char_rx,
        options=(options or {}).get("regex_options") if _is_dict(options) else None
    )

    return {
        "preset": _deepcopy_json(preset),
        "world_book": wb_merge.get("world_book") or [],
        "character": _deepcopy_json(character),
        "merged_regex": rx_merge.get("merged_regex") or {"regex_rules": []},
        "meta": {
            "stats": {
                "world_books_input_count_flat": wb_merge.get("meta", {}).get("input_counts", {}).get("world_books_flat", 0),
                "character_world_book_extracted_count": char_wb.get("meta", {}).get("count", 0),
                "regex_input_independent_count": len(indep_rx),
                "regex_extracted_from_preset_count": preset_rx.get("meta", {}).get("count", 0),
                "regex_extracted_from_character_count": char_rx.get("meta", {}).get("count", 0),
                "regex_final_count": len((rx_merge.get("merged_regex") or {}).get("regex_rules") or []),
                "regex_dedup_removed_count": rx_merge.get("meta", {}).get("dedup_removed_count", 0),
            },
            "order": {
                "regex": ["independent", "preset", "character"],
                "world_book": ["original_world_books", "character_world_book"]
            },
            "warnings": []
        }
    }