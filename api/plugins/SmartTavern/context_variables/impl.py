from __future__ import annotations

"""
SmartTavern Plugin Backend — Context Variables Implementation (impl)

说明：
- 本文件仅包含实现函数，不做入口注册（不使用 @register_api）
- 入口注册文件：context_variables.py 仅负责绑定路由并转发到此处的实现
- 路由前缀（由入口文件声明）：/api/plugins/smarttavern/context_variables/*

提供的实现函数：
- ensure_init_impl(conversation_file) -> dict
- get_context_variables_impl(conversation_file) -> dict
- set_context_variables_impl(conversation_file, content: dict) -> dict
- merge_context_variables_impl(conversation_file, patch: dict) -> dict

路径解析约定：
- conversation_file 传入 POSIX 风格路径（如 /data/conversations/xxx/conversation.json）
- 实际文件路径：backend_projects/SmartTavern/data/conversations/xxx/conversation.json
- context_variables.json 位于 conversation.json 同目录
"""

import json
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import re
import json as _json
import core  # type: ignore


def _repo_root() -> Path:
    # api/plugins/SmartTavern/context_variables/impl.py → parents[4] = repo root
    return Path(__file__).resolve().parents[4]


def _posix_to_abs(posix_path: str) -> Path:
    """
    将 POSIX 风格的 /data/... 路径解析为仓库真实路径：
      /data/...  → backend_projects/SmartTavern/data/...
    若传入已是绝对/相对 OS 路径，则尝试按原样解析。
    """
    posix_path = str(posix_path or "").strip()
    root = _repo_root()

    if posix_path.startswith("/data/"):
        rel = posix_path.lstrip("/")  # data/...
        return root / "backend_projects" / "SmartTavern" / rel
    # 兼容已传绝对/相对
    p = Path(posix_path)
    if p.is_absolute():
        return p
    # 相对路径相对于 repo root
    return (root / posix_path).resolve()


def _read_json(path: Path) -> Optional[Any]:
    try:
        if not path.exists():
            return None
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _write_json(path: Path, obj: Any) -> bool:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as f:
            json.dump(obj if obj is not None else {}, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False


def _conversation_dir_and_settings(conversation_file: str) -> Tuple[Path, Path]:
    abs_conv = _posix_to_abs(conversation_file)
    conv_dir = abs_conv.parent
    settings_path = conv_dir / "settings.json"
    return conv_dir, settings_path


def _resolve_character_file_from_settings(settings_doc: Dict[str, Any]) -> Optional[str]:
    if not isinstance(settings_doc, dict):
        return None
    # settings.character 或 settings.characters[0]
    if settings_doc.get("character"):
        return str(settings_doc.get("character"))
    chars = settings_doc.get("characters")
    if isinstance(chars, list) and chars:
        return str(chars[0])
    return None


def _extract_initvar_from_character(character_doc: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    提取 world_book.entries 中 name 含 "[InitVar]" 的条目，并解析其 content 成为 dict。
    content 可能是对象或字符串化 JSON（甚至双层字符串），逐层尝试。
    """
    try:
        wb = character_doc.get("world_book")
        if not isinstance(wb, dict):
            return None
        entries = wb.get("entries")
        if not isinstance(entries, list):
            return None
        target = None
        for e in entries:
            nm = str(e.get("name", ""))
            if "[InitVar]" in nm:
                target = e
                break
        if not target:
            return None
        raw = target.get("content")
        if raw is None:
            return None
        # 直接对象
        if isinstance(raw, dict):
            return raw
        # 尝试字符串解析
        if isinstance(raw, str):
            # 先 parse 一次
            try:
                first = json.loads(raw)
                if isinstance(first, dict):
                    return first
                # 若 first 是字符串（双层），再 parse 一次
                if isinstance(first, str):
                    try:
                        second = json.loads(first)
                        if isinstance(second, dict):
                            return second
                    except Exception:
                        pass
                # 其他类型不处理
                return None
            except Exception:
                return None
        return None
    except Exception:
        return None


def _ensure_init_from_character(conversation_file: str) -> Tuple[Path, Dict[str, Any]]:
    """
    依据 settings.json 的角色卡内嵌 world_book 提取 [InitVar]，返回 context_variables.json 路径与初始对象（没有则 {}）。
    不进行写入，仅返回目标路径与内容。
    """
    conv_dir, settings_path = _conversation_dir_and_settings(conversation_file)
    ctx_path = conv_dir / "context_variables.json"

    settings_doc = _read_json(settings_path) or {}
    init_obj: Dict[str, Any] = {}

    # 角色卡内嵌 world_book 的 [InitVar]
    char_file = _resolve_character_file_from_settings(settings_doc)
    if char_file:
        abs_char = _posix_to_abs(char_file)
        char_doc = _read_json(abs_char) or {}
        extracted_char = _extract_initvar_from_character(char_doc)
        if isinstance(extracted_char, dict):
            init_obj.update(extracted_char)

    return ctx_path, init_obj


def ensure_init_impl(conversation_file: str) -> Dict[str, Any]:
    """
    若当前对话目录下不存在 context_variables.json，则创建占位文件，包含初始化标记：
      {"initialized": false}
    已存在则不覆盖，直接返回当前内容。
    注：实际变量内容由前端状态就绪后写入，并将 initialized 置为 true。
    """
    ctx_path, _init_obj = _ensure_init_from_character(conversation_file)
    existing = _read_json(ctx_path)

    if existing is None:
        # 不存在 → 创建占位（仅标记 initialized=false）
        payload = {"initialized": False}
        ok = _write_json(ctx_path, payload)
        return {
            "success": bool(ok),
            "file": str(ctx_path),
            "created": bool(ok),
            "content": payload if ok else {}
        }
    else:
        # 已存在 → 不覆盖，直接返回当前内容
        return {
            "success": True,
            "file": str(ctx_path),
            "created": False,
            "content": existing if isinstance(existing, dict) else {}
        }


def get_context_variables_impl(conversation_file: str) -> Dict[str, Any]:
    """
    读取 context_variables.json；不存在返回 {}。
    """
    conv_dir, _ = _conversation_dir_and_settings(conversation_file)
    ctx_path = conv_dir / "context_variables.json"
    content = _read_json(ctx_path)
    return {
        "success": True,
        "file": str(ctx_path),
        "content": content if isinstance(content, dict) else {}
    }


def set_context_variables_impl(conversation_file: str, content: Dict[str, Any]) -> Dict[str, Any]:
    """
    完整覆盖写入 context_variables.json。
    """
    conv_dir, _ = _conversation_dir_and_settings(conversation_file)
    ctx_path = conv_dir / "context_variables.json"

    ok = _write_json(ctx_path, content if isinstance(content, dict) else {})
    return {
        "success": bool(ok),
        "file": str(ctx_path),
        "content": content if bool(ok) else {}
    }


def merge_context_variables_impl(conversation_file: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    """
    合并写入：读取现有 context_variables.json 与传入 patch 合并后写回（浅合并）。
    """
    conv_dir, _ = _conversation_dir_and_settings(conversation_file)
    ctx_path = conv_dir / "context_variables.json"

    current = _read_json(ctx_path)
    if not isinstance(current, dict):
        current = {}
    if not isinstance(patch, dict):
        patch = {}

    merged: Dict[str, Any] = dict(current)
    # 浅合并；如需深合并可在此扩展
    for k, v in patch.items():
        merged[k] = v

    ok = _write_json(ctx_path, merged)
    return {
        "success": bool(ok),
        "file": str(ctx_path),
        "content": merged if bool(ok) else (current or {})
    }


__all__ = [
    "ensure_init_impl",
    "get_context_variables_impl",
    "set_context_variables_impl",
    "merge_context_variables_impl",
    "replay_context_variables_impl",
    "replay_get_value_impl",
    "replay_keys_impl",
]


_PP_RE = re.compile(r"<postprocess>\s*({[\s\S]*?})\s*</postprocess>", re.IGNORECASE)

def _extract_pp_obj(text: str) -> Optional[Dict[str, Any]]:
    if not isinstance(text, str) or '<postprocess>' not in text:
        return None
    m = _PP_RE.search(text)
    if not m:
        return None
    try:
        obj = _json.loads(m.group(1))
        return obj if isinstance(obj, dict) else None
    except Exception:
        return None

def _set_by_path(root: Dict[str, Any], path: Any, value: Any) -> None:
    # path: list[str] or dotted string
    if isinstance(path, list):
        toks = [str(x).strip() for x in path if str(x).strip()]
    else:
        s = str(path or "")
        s2 = s.replace('[', '.').replace(']', '.')
        toks = [t.strip().strip("'\"") for t in s2.split('.') if t.strip()]
    cur = root
    for i, key in enumerate(toks):
        last = (i == len(toks) - 1)
        if last:
            cur[key] = value
        else:
            nxt = cur.get(key)
            if not isinstance(nxt, dict):
                nxt = {}
                cur[key] = nxt
            cur = nxt

def _del_by_path(root: Dict[str, Any], path: Any) -> None:
    if isinstance(path, list):
        toks = [str(x).strip() for x in path if str(x).strip()]
    else:
        s = str(path or "")
        s2 = s.replace('[', '.').replace(']', '.')
        toks = [t.strip().strip("'\"") for t in s2.split('.') if t.strip()]
    cur = root
    for i, key in enumerate(toks):
        last = (i == len(toks) - 1)
        if last:
            try:
                if key in cur:
                    del cur[key]
            except Exception:
                pass
        else:
            nxt = cur.get(key)
            if not isinstance(nxt, dict):
                return
            cur = nxt

def _get_by_path(root: Dict[str, Any], path: Any) -> str:
    # 解析路径为 token（支持数字下标）
    if isinstance(path, list):
        raw = [str(x).strip() for x in path if str(x).strip()]
    else:
        s = str(path or "")
        s2 = s.replace('[', '.').replace(']', '.')
        raw = [t.strip().strip("'\"") for t in s2.split('.') if t.strip()]
    toks: list[Any] = []
    for t in raw:
        if t.lstrip('-').isdigit():
            try:
                toks.append(int(t))
                continue
            except Exception:
                pass
        toks.append(t)
    cur: Any = root
    for tok in toks:
        if isinstance(tok, int):
            if not isinstance(cur, list):
                return ""
            if tok < 0 or tok >= len(cur):
                return ""
            cur = cur[tok]
        else:
            if not isinstance(cur, dict) or tok not in cur:
                return ""
            cur = cur[tok]
    return "" if cur is None else str(cur)

def _resolve_path(root: Dict[str, Any], path: Any) -> Any:
    if path is None or path == "":
        return root
    if isinstance(path, list):
        raw = [str(x).strip() for x in path if str(x).strip()]
    else:
        s = str(path or "")
        s2 = s.replace('[', '.').replace(']', '.')
        raw = [t.strip().strip("'\"") for t in s2.split('.') if t.strip()]
    toks: list[Any] = []
    for t in raw:
        if t.lstrip('-').isdigit():
            try:
                toks.append(int(t)); continue
            except Exception:
                pass
        toks.append(t)
    cur: Any = root
    for tok in toks:
        if isinstance(tok, int):
            if not isinstance(cur, list) or tok < 0 or tok >= len(cur):
                return None
            cur = cur[tok]
        else:
            if not isinstance(cur, dict) or tok not in cur:
                return None
            cur = cur[tok]
    return cur

def replay_keys_impl(conversation_file: str, key: Optional[str] = None, until_node_id: Optional[str] = None) -> Dict[str, Any]:
    rep = replay_context_variables_impl(conversation_file, until_node_id=until_node_id) or {}
    acc = rep.get("content") or {}
    target = _resolve_path(acc, key) if key else acc
    out: Dict[str, bool] = {}
    if isinstance(target, dict):
        for k in target.keys():
            out[str(k)] = True
    elif isinstance(target, list):
        for i in range(len(target)):
            out[str(i)] = True
    return {"success": True, "keys": out}

def replay_context_variables_impl(conversation_file: str, until_node_id: Optional[str] = None) -> Dict[str, Any]:
    # 读取分支路径（active_path）
    try:
        oa = core.call_api(
            "smarttavern/chat_branches/openai_messages",
            {"file": conversation_file},
            method="POST",
            namespace="modules",
        )
        path = (oa or {}).get("path") or []
    except Exception:
        path = []
    # 读取完整对话文档
    try:
        conv = core.call_api(
            "smarttavern/data_catalog/get_conversation_detail",
            {"file": conversation_file},
            method="POST",
            namespace="modules",
        )
        doc = (conv or {}).get("content", {}) or {}
    except Exception:
        doc = {}
    nodes = doc.get("nodes", {}) if isinstance(doc, dict) else {}

    # 基线：使用现有 context_variables.json 中的 __char_initvar 作为初始值
    try:
        base = get_context_variables_impl(conversation_file)
        base_doc = (base or {}).get("content", {}) or {}
        acc: Dict[str, Any] = dict(base_doc.get("__char_initvar", {}) if isinstance(base_doc, dict) else {})
    except Exception:
        acc = {}
    applied = 0
    for nid in path:
        if until_node_id and str(nid) == str(until_node_id):
            # 包含当前节点内容，再停止后续
            nd = nodes.get(nid) or {}
            content = nd.get("content") or ""
            pp = _extract_pp_obj(content)
            if isinstance(pp, dict):
                items = pp.get("CtxVar") or []
                if isinstance(items, list):
                    for it in items:
                        if not isinstance(it, dict):
                            continue
                        op = str(it.get("op") or "").lower()
                        data = it.get("data") or {}
                        if op == "set":
                            _set_by_path(acc, data.get("path"), data.get("value"))
                            applied += 1
                        elif op in ("del","delete","remove"):
                            _del_by_path(acc, data.get("path"))
                            applied += 1
            break
        nd = nodes.get(nid) or {}
        content = nd.get("content") or ""
        pp = _extract_pp_obj(content)
        if not isinstance(pp, dict):
            continue
        items = pp.get("CtxVar") or []
        if not isinstance(items, list):
            continue
        for it in items:
            if not isinstance(it, dict):
                continue
            op = str(it.get("op") or "").lower()
            data = it.get("data") or {}
            if op == "set":
                _set_by_path(acc, data.get("path"), data.get("value"))
                applied += 1
            elif op in ("del","delete","remove"):
                _del_by_path(acc, data.get("path"))
                applied += 1

    return {"success": True, "content": acc, "applied": applied, "path": path}


def replay_get_value_impl(conversation_file: str, key: str, until_node_id: Optional[str] = None) -> Dict[str, Any]:
    res = replay_context_variables_impl(conversation_file, until_node_id=until_node_id) or {}
    acc = res.get("content") or {}
    val = _get_by_path(acc, key)
    return {"success": True, "value": val, "applied": res.get("applied", 0)}