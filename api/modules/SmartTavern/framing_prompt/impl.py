from __future__ import annotations

"""
SmartTavern.framing_prompt 实现层

职责
- 根据 relative 预设占位符在“对话历史之前”构建前缀提示词（prefix）
- 支持两类 history 输入：
  1) 原始 OpenAI messages（不含 source）→ 规范化补齐 source
  2) 已处理过的 in-chat 风格 messages（含 source）→ 原样透传并校验结构
- 支持从 presets_doc.prompts 或直接传入 presets_relative 数组两种来源
- 从 world_books（新格式：{entries:[...]} 或 {world_book:{entries:[...]}}）中抽取 before_char/after_char 的条目
- 支持 persona/character 描述占位符
- 输出键顺序统一：role → content → source（source 字段内部尽量保持来源条目字段顺序）

注意
- 不处理 chatHistory（保持与 in_chat_constructor 的职责边界）
- 世界书在本模块仅处理 position ∈ {before_char, after_char} 的条目
"""

from typing import Any, Dict, List, Optional, Union

# 常量
DEFAULT_ORDER: int = 100
ALLOWED_ROLES = {"user", "assistant", "system", "thinking"}


def _is_enabled(val: Any) -> bool:
    """None 视为启用，仅显式 False 视为禁用。"""
    return False if val is False else True


def _role_priority(role: str) -> int:
    """assistant(0) < user(1) < system(2)"""
    return {"assistant": 0, "user": 1, "system": 2}.get(str(role), 2)


def _map_wb_pos_to_role(position: str) -> str:
    """
    世界书 position → 对话角色的映射
    - before_char / after_char → system（旧模块语义）
    - 否则当作显式角色（user|assistant|system）或回退 system
    """
    pos = str(position or "").lower()
    if pos in ("before_char", "after_char"):
        return "system"
    if pos in ALLOWED_ROLES:
        return pos
    return "system"


def _flatten_world_books(items: Any) -> List[Dict[str, Any]]:
    """展平成新世界书格式：仅支持 {entries:[...]} 或 {world_book:{entries:[...]}}"""
    out: List[Dict[str, Any]] = []
    if not isinstance(items, dict):
        return out

    # { "entries": [ ... ] }
    entries = items.get("entries")
    if isinstance(entries, list):
        for e in entries:
            if isinstance(e, dict):
                out.append(e)
        return out

    # { "world_book": { "entries": [ ... ] } }
    wb = items.get("world_book")
    if isinstance(wb, dict):
        ens = wb.get("entries")
        if isinstance(ens, list):
            for e in ens:
                if isinstance(e, dict):
                    out.append(e)
    return out


def _sort_sources(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """按 order 升序 → 角色优先级（assistant < user < system）→ internal_order 稳定排序。"""
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
    - True：存在 keys 且至少一个关键词命中
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
        # 兜底到 assistant，避免出现未定义的 history.system
        t = "history.assistant"
    return {
        "type": t,
        "id": f"history_{index}",
        "index": index,
    }


def _build_source_for_preset(p: Dict[str, Any], source_id: str) -> Dict[str, Any]:
    """
    预设来源字段：
    - 先放置 type 与 id
    - 再按原条目字段顺序复制（Python 3.7+ dict 保序）
    """
    src: Dict[str, Any] = {
        "type": "preset.relative",
        "id": source_id,
    }
    for k in p.keys():
        src[k] = p.get(k)
    return src


def _build_source_for_wb(wb: Dict[str, Any], source_id: str, derived_role: str) -> Dict[str, Any]:
    """
    世界书来源字段：
    - 先放置 type 与 id
    - 按原条目字段顺序复制；遇到原始 'id' 改名为 'wb_id' 避免冲突
    - 若来源缺少 role，则在末尾追加 role 以不打乱原字段顺序
    """
    src: Dict[str, Any] = {
        "type": "world_book",
        "id": source_id,
    }
    for k in wb.keys():
        if k == "id":
            src["wb_id"] = wb.get(k)
        else:
            src[k] = wb.get(k)
    # 根据世界书位置细分类型（before_char/after_char；否则兜底为 in-chat）
    pos = str(wb.get("position", "") or "").lower()
    if pos in ("before_char", "after_char"):
        src["type"] = f"world_book.{pos}"
    else:
        src["type"] = "world_book.in-chat"
    if "role" not in src:
        src["role"] = derived_role
    return src


def _build_source_for_character(character: Dict[str, Any]) -> Dict[str, Any]:
    """
    角色来源字段：
    - 先放置 type 与 id
    - 再按原文档键顺序复制（常见字段：name, description, ...）
    """
    src: Dict[str, Any] = {
        "type": "char.description",
        "id": "char_description",
    }
    for k in character.keys():
        src[k] = character.get(k)
    return src


def _build_source_for_persona(persona: Dict[str, Any]) -> Dict[str, Any]:
    """用户画像来源字段，同上。"""
    src: Dict[str, Any] = {
        "type": "persona.description",
        "id": "persona_description",
    }
    for k in persona.keys():
        src[k] = persona.get(k)
    return src


def _collect_relative_presets(
    presets_relative: Optional[List[Dict[str, Any]]],
    presets_doc: Optional[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    收集 relative 预设条目（仅 enabled==True，保持文档出现顺序；不排序）。
    """
    rel: List[Dict[str, Any]] = []

    if isinstance(presets_relative, list):
        rel = [p for p in presets_relative if isinstance(p, dict)]
    elif isinstance(presets_doc, dict):
        prompts = presets_doc.get("prompts") or []
        if isinstance(prompts, list):
            rel = [p for p in prompts if isinstance(p, dict) and str(p.get("position")) == "relative"]

    entries: List[Dict[str, Any]] = []
    for i, p in enumerate(rel):
        # 仅显式 True 视为启用
        if p.get("enabled") is not True:
            continue
        role = str(p.get("role", "system")).lower()
        role = role if role in ALLOWED_ROLES else "system"
        entries.append({
            "data": p,
            "type": "preset",
            "order": int(p.get("order", DEFAULT_ORDER) or DEFAULT_ORDER),
            "role": role,
            "internal_order": i,
        })
    return entries


def _world_info_messages(
    position: str,
    world_books: Any,
    history_text: str,
) -> List[Dict[str, Any]]:
    """
    构建 before_char / after_char 的世界书消息列表。
    - 过滤：position 精确匹配、enabled==True、content 非空、mode 允许（always 或 conditional & 触发）
    - conditional 仅依据 keys 命中 history；若 keys 缺失/为 0/为空数组则不触发
    - 排序：order 升序 → 角色优先级 → internal_order
    - 每条消息不合并，逐条输出
    """
    flat = _flatten_world_books(world_books)
    wb_sources: List[Dict[str, Any]] = []
 
    for i, wb in enumerate(flat):
        if not isinstance(wb, dict):
            continue
        pos = str(wb.get("position", ""))
        if pos != position:
            continue
        # 仅显式 True 视为启用
        if wb.get("enabled") is not True:
            continue
        content = wb.get("content")
        if not isinstance(content, str) or content.strip() == "":
            continue
        mode = str(wb.get("mode", "always"))
        if mode == "conditional":
            if not _is_triggered_by_keys(history_text, wb.get("keys")):
                continue
        role = _map_wb_pos_to_role(pos)
        wb_sources.append({
            "data": wb,
            "type": "world",
            "order": int(wb.get("order", DEFAULT_ORDER) or DEFAULT_ORDER),
            "role": role,
            "internal_order": i,
        })
 
    sorted_wb = _sort_sources(wb_sources)
    out: List[Dict[str, Any]] = []
    for e in sorted_wb:
        data = e["data"]
        content = data.get("content", "")
        src = _build_source_for_wb(
            data,
            source_id=f"wb_{data.get('id') if data.get('id') is not None else e.get('internal_order', 0)}",
            derived_role=e["role"],
        )
        out.append({
            "role": e["role"],
            "content": content,
            "source": src,
        })
    return out


def assemble(
    history: Any,
    world_books: Union[List[Any], Dict[str, Any], None] = None,
    presets_relative: Optional[List[Dict[str, Any]]] = None,
    presets_doc: Optional[Dict[str, Any]] = None,
    character: Optional[Dict[str, Any]] = None,
    persona: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    构建“框架提示词”大消息块（仅输出带来源的 messages）：
    - 输入 history 可为数组或 {"messages":[...]}；无 source 时按 {"type":"history","id":"history_i","index":i} 补齐
    - 仅处理 position=="relative" 且 enabled==True 的预设，保持文档出现顺序（跳过 "in-chat"）
    - chatHistory：在当前位置插入归一化后的历史消息
    - worldInfoBefore/After：注入对应 position 的世界书（enabled==True + keys 命中，大小写敏感）
    - charDescription/personaDescription：使用传入的 description
    """
    # 0) 归一化入参（仅新格式对象）
    world_books = world_books or {}

    # 提取原始 history 列表（支持 {"messages":[...]} 或直接数组）
    raw_hist: List[Dict[str, Any]] = []
    if isinstance(history, dict) and isinstance(history.get("messages"), list):
        raw_hist = history.get("messages", []) or []
    elif isinstance(history, list):
        raw_hist = history or []

    # 规范化历史（补齐 source）
    normalized_history: List[Dict[str, Any]] = []
    for i, msg in enumerate(raw_hist):
        if not isinstance(msg, dict):
            continue
        role = str(msg.get("role", "")).lower()
        content = msg.get("content", "")
        if role not in ALLOWED_ROLES:
            role = "user"
        if not isinstance(content, str):
            content = "" if content is None else str(content)
        src = msg.get("source")
        if not isinstance(src, dict):
            src = _build_source_for_history(i, role)
        normalized_history.append({"role": role, "content": content, "source": src})

    # 用于 keys 匹配（大小写敏感）
    history_text = _collect_history_text(normalized_history)

    # 1) 收集 relative 预设（仅 enabled==True，保持文档顺序；跳过 in-chat）
    rel_entries = _collect_relative_presets(presets_relative, presets_doc)

    # 2) 如果没有预设，直接返回历史消息
    if not rel_entries:
        return {"messages": normalized_history}

    # 3) 按顺序遍历 relative 构建（在 chatHistory 位置插入历史）
    combined: List[Dict[str, Any]] = []
    for e in rel_entries:
        p = e["data"]
        identifier = str(p.get("identifier", "") or "")
        role = e["role"]

        # chatHistory：在当前位置注入归一化历史
        if identifier == "chatHistory":
            combined.extend(normalized_history)
            continue

        # world info before/after
        if identifier == "charBefore":
            combined.extend(_world_info_messages("before_char", world_books, history_text))
            continue
        if identifier == "charAfter":
            combined.extend(_world_info_messages("after_char", world_books, history_text))
            continue

        # char / persona
        if identifier == "charDescription":
            desc = ""
            if isinstance(character, dict):
                desc = character.get("description") or ""
            if isinstance(desc, str) and desc.strip():
                combined.append({
                    "role": role,
                    "content": desc,
                    "source": _build_source_for_character(character or {}),
                })
            continue

        if identifier == "personaDescription":
            pdesc = ""
            if isinstance(persona, dict):
                pdesc = persona.get("description") or ""
            if isinstance(pdesc, str) and pdesc.strip():
                combined.append({
                    "role": role,
                    "content": pdesc,
                    "source": _build_source_for_persona(persona or {}),
                })
            continue

        # 普通 relative 文本
        content = p.get("content", "")
        if isinstance(content, str) and content.strip():
            pid = p.get("identifier") or p.get("name") or ""
            src = _build_source_for_preset(p, source_id=f"preset_{pid}")
            combined.append({
                "role": role,
                "content": content,
                "source": src,
            })

    return {"messages": combined}