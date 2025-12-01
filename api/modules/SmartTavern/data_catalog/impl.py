# -*- coding: utf-8 -*-
"""
SmartTavern.data_catalog 实现层

职责
- 扫描 backend_projects/SmartTavern/data 下各类资源文件夹
- 首期：实现“预设（presets）目录”的清单读取（name/description 字段提取）
- 扩展：实现 world_books / characters / persona / regex_rules 的清单读取

说明
- 本文件仅提供纯实现函数；API 注册在同目录 data_catalog.py 中完成
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
import json
import base64
import mimetypes


# ---------- 路径与工具 ----------

def _repo_root() -> Path:
    """
    返回仓库根目录（基于当前文件层级向上回溯）
    当前文件位于: repo_root/api/modules/SmartTavern/data_catalog/impl.py
    parents[4] => repo_root
    """
    return Path(__file__).resolve().parents[4]


def _safe_read_json(p: Path) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    try:
        with p.open("r", encoding="utf-8") as f:
            return json.load(f), None
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"


def _ensure_str(x: Any) -> Optional[str]:
    if x is None:
        return None
    try:
        return str(x)
    except Exception:
        return None


def _path_rel_to_root(p: Path, root: Path) -> str:
    """
    统一返回 POSIX 风格路径（使用 '/' 分隔），避免在 Windows 下出现 '\\' 与断言不匹配。
    """
    try:
        return p.relative_to(root).as_posix()
    except Exception:
        # 路径规范处理（不同 Python 版本/跨盘场景）
        try:
            return p.resolve().as_posix()
        except Exception:
            # 兜底：替换反斜杠为斜杠
            return str(p).replace("\\", "/")


# ---------- 实现：列出 presets ----------

def list_presets_impl(base_dir: Optional[str] = None,
                      fields: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    扫描 presets 目录（目录式），返回每个预设目录下 preset.json 的相对路径与所需字段（name/description）
    新结构：
      backend_projects/SmartTavern/data/presets/{name}/preset.json
    """
    root = _repo_root()
    default_folder = root / "backend_projects" / "SmartTavern" / "data" / "presets"

    if base_dir:
        b = Path(base_dir)
        folder = (root / b).resolve() if not b.is_absolute() else b.resolve()
    else:
        folder = default_folder

    want_name = True
    want_desc = True
    if isinstance(fields, list) and fields:
        fs = [str(x).strip().lower() for x in fields if isinstance(x, str)]
        want_name = "name" in fs
        want_desc = "description" in fs

    items: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    if not folder.exists() or not folder.is_dir():
        return {
            "folder": _path_rel_to_root(folder, root),
            "total": 0,
            "items": [],
            "errors": [{"file": None, "error": f"Folder not found: {folder}"}]
        }

    # 扫描每个子目录下的 preset.json
    for sub in sorted(folder.iterdir()):
        if not sub.is_dir():
            continue
        p = sub / "preset.json"
        if not (p.exists() and p.is_file()):
            errors.append({"file": _path_rel_to_root(sub, root), "error": "preset.json not found"})
            continue

        doc, err = _safe_read_json(p)
        if err:
            errors.append({"file": _path_rel_to_root(p, root), "error": err})
            continue

        name = _ensure_str((doc or {}).get("name")) if want_name else None
        desc = _ensure_str((doc or {}).get("description")) if want_desc else None

        item: Dict[str, Any] = {"file": _path_rel_to_root(p, root)}
        if want_name:
            item["name"] = name
        if want_desc:
            item["description"] = desc
        items.append(item)

    out: Dict[str, Any] = {
        "folder": _path_rel_to_root(folder, root),
        "total": len(items),
        "items": items
    }
    if errors:
        out["errors"] = errors
    return out


# ---------- 实现：列出 world_books ----------

def list_world_books_impl(base_dir: Optional[str] = None,
                          fields: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    扫描 world_books 目录（目录式），返回每个世界书目录下 worldbook.json 的相对路径与所需字段（name/description）
    新结构：
      backend_projects/SmartTavern/data/world_books/{name}/worldbook.json
    """
    root = _repo_root()
    default_folder = root / "backend_projects" / "SmartTavern" / "data" / "world_books"

    if base_dir:
        b = Path(base_dir)
        folder = (root / b).resolve() if not b.is_absolute() else b.resolve()
    else:
        folder = default_folder

    want_name = True
    want_desc = True
    if isinstance(fields, list) and fields:
        fs = [str(x).strip().lower() for x in fields if isinstance(x, str)]
        want_name = "name" in fs
        want_desc = "description" in fs

    items: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    if not folder.exists() or not folder.is_dir():
        return {
            "folder": _path_rel_to_root(folder, root),
            "total": 0,
            "items": [],
            "errors": [{"file": None, "error": f"Folder not found: {folder}"}]
        }

    # 扫描每个子目录下的 worldbook.json
    for sub in sorted(folder.iterdir()):
        if not sub.is_dir():
            continue
        p = sub / "worldbook.json"
        if not (p.exists() and p.is_file()):
            errors.append({"file": _path_rel_to_root(sub, root), "error": "worldbook.json not found"})
            continue

        doc, err = _safe_read_json(p)
        if err:
            errors.append({"file": _path_rel_to_root(p, root), "error": err})
            continue

        name = _ensure_str((doc or {}).get("name")) if want_name else None
        desc = _ensure_str((doc or {}).get("description")) if want_desc else None

        item: Dict[str, Any] = {"file": _path_rel_to_root(p, root)}
        if want_name:
            item["name"] = name
        if want_desc:
            item["description"] = desc
        items.append(item)

    out: Dict[str, Any] = {
        "folder": _path_rel_to_root(folder, root),
        "total": len(items),
        "items": items
    }
    if errors:
        out["errors"] = errors
    return out


# ---------- 实现：列出 characters ----------

def list_characters_impl(base_dir: Optional[str] = None,
                         fields: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    扫描 characters 目录（目录式），返回每个角色目录下 character.json 的相对路径与所需字段（name/description/type）
    新结构：
      backend_projects/SmartTavern/data/characters/{name}/character.json
    支持的 type 值：
      - "threaded": 楼层对话模式（默认）
      - "sandbox": 前端沙盒模式
    """
    root = _repo_root()
    default_folder = root / "backend_projects" / "SmartTavern" / "data" / "characters"

    if base_dir:
        b = Path(base_dir)
        folder = (root / b).resolve() if not b.is_absolute() else b.resolve()
    else:
        folder = default_folder

    want_name = True
    want_desc = True
    want_type = True
    if isinstance(fields, list) and fields:
        fs = [str(x).strip().lower() for x in fields if isinstance(x, str)]
        want_name = "name" in fs
        want_desc = "description" in fs
        want_type = "type" in fs

    items: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    if not folder.exists() or not folder.is_dir():
        return {
            "folder": _path_rel_to_root(folder, root),
            "total": 0,
            "items": [],
            "errors": [{"file": None, "error": f"Folder not found: {folder}"}]
        }

    # 扫描每个子目录下的 character.json
    for sub in sorted(folder.iterdir()):
        if not sub.is_dir():
            continue
        p = sub / "character.json"
        if not (p.exists() and p.is_file()):
            errors.append({"file": _path_rel_to_root(sub, root), "error": "character.json not found"})
            continue

        doc, err = _safe_read_json(p)
        if err:
            errors.append({"file": _path_rel_to_root(p, root), "error": err})
            continue

        name = _ensure_str((doc or {}).get("name")) if want_name else None
        desc = _ensure_str((doc or {}).get("description")) if want_desc else None
        
        # 提取 type 字段（必须存在）
        char_type = _ensure_str((doc or {}).get("type")) if want_type else None

        item: Dict[str, Any] = {"file": _path_rel_to_root(p, root)}
        if want_name:
            item["name"] = name
        if want_desc:
            item["description"] = desc
        if want_type:
            item["type"] = char_type
        items.append(item)

    out: Dict[str, Any] = {
        "folder": _path_rel_to_root(folder, root),
        "total": len(items),
        "items": items
    }
    if errors:
        out["errors"] = errors
    return out


# ---------- 实现：列出 persona ----------

def list_personas_impl(base_dir: Optional[str] = None,
                       fields: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    扫描 personas 目录（目录式），返回每个用户画像目录下 persona.json 的相对路径与所需字段（name/description）
    新结构：
      backend_projects/SmartTavern/data/personas/{name}/persona.json
    """
    root = _repo_root()
    default_folder = root / "backend_projects" / "SmartTavern" / "data" / "personas"

    if base_dir:
        b = Path(base_dir)
        folder = (root / b).resolve() if not b.is_absolute() else b.resolve()
    else:
        folder = default_folder

    want_name = True
    want_desc = True
    if isinstance(fields, list) and fields:
        fs = [str(x).strip().lower() for x in fields if isinstance(x, str)]
        want_name = "name" in fs
        want_desc = "description" in fs

    items: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    if not folder.exists() or not folder.is_dir():
        return {
            "folder": _path_rel_to_root(folder, root),
            "total": 0,
            "items": [],
            "errors": [{"file": None, "error": f"Folder not found: {folder}"}]
        }

    # 扫描每个子目录下的 persona.json
    for sub in sorted(folder.iterdir()):
        if not sub.is_dir():
            continue
        p = sub / "persona.json"
        if not (p.exists() and p.is_file()):
            errors.append({"file": _path_rel_to_root(sub, root), "error": "persona.json not found"})
            continue

        doc, err = _safe_read_json(p)
        if err:
            errors.append({"file": _path_rel_to_root(p, root), "error": err})
            continue

        name = _ensure_str((doc or {}).get("name")) if want_name else None
        desc = _ensure_str((doc or {}).get("description")) if want_desc else None

        item: Dict[str, Any] = {"file": _path_rel_to_root(p, root)}
        if want_name:
            item["name"] = name
        if want_desc:
            item["description"] = desc
        items.append(item)

    out: Dict[str, Any] = {
        "folder": _path_rel_to_root(folder, root),
        "total": len(items),
        "items": items
    }
    if errors:
        out["errors"] = errors
    return out


# ---------- 实现：列出 regex_rules ----------

def list_regex_rules_impl(base_dir: Optional[str] = None,
                          fields: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    扫描 regex_rules 目录（目录式），返回每个规则目录下 regex.json 的相对路径与所需字段（name/description）
    新结构：
      backend_projects/SmartTavern/data/regex_rules/{name}/regex.json
    """
    root = _repo_root()
    default_folder = root / "backend_projects" / "SmartTavern" / "data" / "regex_rules"

    if base_dir:
        b = Path(base_dir)
        folder = (root / b).resolve() if not b.is_absolute() else b.resolve()
    else:
        folder = default_folder

    want_name = True
    want_desc = True
    if isinstance(fields, list) and fields:
        fs = [str(x).strip().lower() for x in fields if isinstance(x, str)]
        want_name = "name" in fs
        want_desc = "description" in fs

    items: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    if not folder.exists() or not folder.is_dir():
        return {
            "folder": _path_rel_to_root(folder, root),
            "total": 0,
            "items": [],
            "errors": [{"file": None, "error": f"Folder not found: {folder}"}]
        }

    # 扫描每个子目录下的 regex.json
    for sub in sorted(folder.iterdir()):
        if not sub.is_dir():
            continue
        p = sub / "regex_rule.json"
        if not (p.exists() and p.is_file()):
            errors.append({"file": _path_rel_to_root(sub, root), "error": "regex_rule.json not found"})
            continue

        doc, err = _safe_read_json(p)
        if err:
            errors.append({"file": _path_rel_to_root(p, root), "error": err})
            continue

        name = _ensure_str((doc or {}).get("name")) if want_name else None
        desc = _ensure_str((doc or {}).get("description")) if want_desc else None

        item: Dict[str, Any] = {"file": _path_rel_to_root(p, root)}
        if want_name:
            item["name"] = name
        if want_desc:
            item["description"] = desc
        items.append(item)

    out: Dict[str, Any] = {
        "folder": _path_rel_to_root(folder, root),
        "total": len(items),
        "items": items
    }
    if errors:
        out["errors"] = errors
    return out

# ---------- 实现：列出 conversations ----------
def list_conversations_impl(base_dir: Optional[str] = None,
                            fields: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    扫描 conversations 目录（子目录式），返回每个会话目录下 conversation.json 的相对路径与所需字段（name/description）
    新结构：
      backend_projects/SmartTavern/data/conversations/{name}/conversation.json
    """
    root = _repo_root()
    default_folder = root / "backend_projects" / "SmartTavern" / "data" / "conversations"

    if base_dir:
        b = Path(base_dir)
        folder = (root / b).resolve() if not b.is_absolute() else b.resolve()
    else:
        folder = default_folder

    want_name = True
    want_desc = True
    if isinstance(fields, list) and fields:
        fs = [str(x).strip().lower() for x in fields if isinstance(x, str)]
        want_name = "name" in fs
        want_desc = "description" in fs

    items: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    if not folder.exists() or not folder.is_dir():
        return {
            "folder": _path_rel_to_root(folder, root),
            "total": 0,
            "items": [],
            "errors": [{"file": None, "error": f"Folder not found: {folder}"}]
        }

    # 目录式扫描：每个子目录下的 conversation.json
    for sub in sorted(folder.iterdir()):
        if not sub.is_dir():
            continue
        p = sub / "conversation.json"
        if not p.exists() or not p.is_file():
            # 可选：记录没有 conversation.json 的目录错误
            errors.append({"file": _path_rel_to_root(sub, root), "error": "conversation.json not found"})
            continue

        doc, err = _safe_read_json(p)
        if err:
            errors.append({"file": _path_rel_to_root(p, root), "error": err})
            continue

        name = _ensure_str((doc or {}).get("name")) if want_name else None
        desc = _ensure_str((doc or {}).get("description")) if want_desc else None

        item: Dict[str, Any] = {"file": _path_rel_to_root(p, root)}
        if want_name:
            item["name"] = name
        if want_desc:
            item["description"] = desc
        items.append(item)

    out: Dict[str, Any] = {
        "folder": _path_rel_to_root(folder, root),
        "total": len(items),
        "items": items
    }
    if errors:
        out["errors"] = errors
    return out


# ---------- 实现：读取单个 preset 详情 ----------

def _is_within(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except Exception:
        return False


def get_preset_detail_impl(file: str) -> Dict[str, Any]:
    """
    读取 backend_projects/SmartTavern/data/presets 下指定 JSON 文件，返回基础字段与完整内容。

    入参:
      - file: POSIX 风格相对路径（来自 list_presets 的 items[*].file），例如：
              "backend_projects/SmartTavern/data/presets/Default.json"

    返回:
      {
        "file": "...",
        "name": "...|null",
        "description": "...|null",
        "content": {...}
      }
    """
    root = _repo_root()
    presets_dir = root / "backend_projects" / "SmartTavern" / "data" / "presets"

    if not isinstance(file, str) or not file:
        return {"error": "INVALID_INPUT", "message": "file 必须为非空字符串"}

    target = (root / Path(file)).resolve()
    if not _is_within(target, presets_dir):
        return {"error": "OUT_OF_SCOPE", "message": "仅允许读取 presets 目录下的文件"}

    doc, err = _safe_read_json(target)
    if err:
        return {"error": "READ_FAILED", "message": err, "file": _path_rel_to_root(target, root)}

    name = _ensure_str((doc or {}).get("name"))
    desc = _ensure_str((doc or {}).get("description"))

    return {
        "file": _path_rel_to_root(target, root),
        "name": name,
        "description": desc,
        "content": doc,
    }

# ---------- 实现：读取单个 world_book 详情 ----------

def get_world_book_detail_impl(file: str) -> Dict[str, Any]:
    """
    读取 backend_projects/SmartTavern/data/world_books 下指定 JSON 文件，返回完整内容与基础字段。
    """
    root = _repo_root()
    world_dir = root / "backend_projects" / "SmartTavern" / "data" / "world_books"

    if not isinstance(file, str) or not file:
        return {"error": "INVALID_INPUT", "message": "file 必须为非空字符串"}

    target = (root / Path(file)).resolve()
    if not _is_within(target, world_dir):
        return {"error": "OUT_OF_SCOPE", "message": "仅允许读取 world_books 目录下的文件"}

    doc, err = _safe_read_json(target)
    if err:
        return {"error": "READ_FAILED", "message": err, "file": _path_rel_to_root(target, root)}

    name = _ensure_str((doc or {}).get("name"))
    desc = _ensure_str((doc or {}).get("description"))

    return {
        "file": _path_rel_to_root(target, root),
        "name": name,
        "description": desc,
        "content": doc,
    }


# ---------- 实现：读取单个 character 详情 ----------

def get_character_detail_impl(file: str) -> Dict[str, Any]:
    """
    读取 backend_projects/SmartTavern/data/characters 下指定 JSON 文件，返回完整内容与基础字段。
    """
    root = _repo_root()
    char_dir = root / "backend_projects" / "SmartTavern" / "data" / "characters"

    if not isinstance(file, str) or not file:
        return {"error": "INVALID_INPUT", "message": "file 必须为非空字符串"}

    target = (root / Path(file)).resolve()
    if not _is_within(target, char_dir):
        return {"error": "OUT_OF_SCOPE", "message": "仅允许读取 characters 目录下的文件"}

    doc, err = _safe_read_json(target)
    if err:
        return {"error": "READ_FAILED", "message": err, "file": _path_rel_to_root(target, root)}

    name = _ensure_str((doc or {}).get("name"))
    desc = _ensure_str((doc or {}).get("description"))

    return {
        "file": _path_rel_to_root(target, root),
        "name": name,
        "description": desc,
        "content": doc,
    }


# ---------- 实现：读取单个 persona 详情 ----------

def get_persona_detail_impl(file: str) -> Dict[str, Any]:
    """
    读取 backend_projects/SmartTavern/data/personas 下指定 JSON 文件，返回完整内容与基础字段。
    """
    root = _repo_root()
    persona_dir = root / "backend_projects" / "SmartTavern" / "data" / "personas"

    if not isinstance(file, str) or not file:
        return {"error": "INVALID_INPUT", "message": "file 必须为非空字符串"}

    target = (root / Path(file)).resolve()
    if not _is_within(target, persona_dir):
        return {"error": "OUT_OF_SCOPE", "message": "仅允许读取 personas 目录下的文件"}

    doc, err = _safe_read_json(target)
    if err:
        return {"error": "READ_FAILED", "message": err, "file": _path_rel_to_root(target, root)}

    name = _ensure_str((doc or {}).get("name"))
    desc = _ensure_str((doc or {}).get("description"))

    return {
        "file": _path_rel_to_root(target, root),
        "name": name,
        "description": desc,
        "content": doc,
    }


# ---------- 实现：读取单个 regex_rules 详情 ----------

def get_regex_rule_detail_impl(file: str) -> Dict[str, Any]:
    """
    读取 backend_projects/SmartTavern/data/regex_rules 下指定 JSON 文件，返回完整内容与基础字段。
    """
    root = _repo_root()
    regex_dir = root / "backend_projects" / "SmartTavern" / "data" / "regex_rules"

    if not isinstance(file, str) or not file:
        return {"error": "INVALID_INPUT", "message": "file 必须为非空字符串"}

    target = (root / Path(file)).resolve()
    if not _is_within(target, regex_dir):
        return {"error": "OUT_OF_SCOPE", "message": "仅允许读取 regex_rules 目录下的文件"}

    doc, err = _safe_read_json(target)
    if err:
        return {"error": "READ_FAILED", "message": err, "file": _path_rel_to_root(target, root)}

    name = _ensure_str((doc or {}).get("name"))
    desc = _ensure_str((doc or {}).get("description"))

    return {
        "file": _path_rel_to_root(target, root),
        "name": name,
        "description": desc,
        "content": doc,
    }


def get_conversation_detail_impl(file: str) -> Dict[str, Any]:
    """
    读取 backend_projects/SmartTavern/data/conversations 下指定 JSON 文件，返回完整内容与基础字段。
    """
    root = _repo_root()
    conv_dir = root / "backend_projects" / "SmartTavern" / "data" / "conversations"

    if not isinstance(file, str) or not file:
        return {"error": "INVALID_INPUT", "message": "file 必须为非空字符串"}

    target = (root / Path(file)).resolve()
    if not _is_within(target, conv_dir):
        return {"error": "OUT_OF_SCOPE", "message": "仅允许读取 conversations 目录下的文件"}

    doc, err = _safe_read_json(target)
    if err:
        return {"error": "READ_FAILED", "message": err, "file": _path_rel_to_root(target, root)}

    name = _ensure_str((doc or {}).get("name"))
    desc = _ensure_str((doc or {}).get("description"))

    return {
        "file": _path_rel_to_root(target, root),
        "name": name,
        "description": desc,
        "content": doc,
    }


def get_node_detail_impl(file: str, node_id: str) -> Dict[str, Any]:
    """
    读取指定对话文件，仅返回 nodes[node_id] 节点内容（轻量）。
    """
    root = _repo_root()
    conv_dir = root / "backend_projects" / "SmartTavern" / "data" / "conversations"

    if not isinstance(file, str) or not file:
        return {"success": False, "error": "INVALID_INPUT", "message": "file 必须为非空字符串"}
    if not isinstance(node_id, str) or not node_id:
        return {"success": False, "error": "INVALID_INPUT", "message": "node_id 必须为非空字符串"}

    target = (root / Path(file)).resolve()
    if not _is_within(target, conv_dir):
        return {"success": False, "error": "OUT_OF_SCOPE", "message": "仅允许读取 conversations 目录下的文件"}

    doc, err = _safe_read_json(target)
    if err:
        return {"success": False, "error": "READ_FAILED", "message": err, "file": _path_rel_to_root(target, root)}

    nodes = (doc or {}).get("nodes", {}) or {}
    node = nodes.get(node_id)
    return {
        "success": True,
        "file": _path_rel_to_root(target, root),
        "node_id": node_id,
        "node": node if isinstance(node, dict) else None,
    }


# ---------- 写入与更新（保存）通用工具 ----------

def _write_json_atomic(target: Path, data: Any) -> Optional[str]:
    """
    将 JSON 原子化写入目标路径（UTF-8, ensure_ascii=False, indent=2）。
    返回 None 表示成功；返回错误字符串表示失败。
    """
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp = target.with_suffix(target.suffix + ".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        tmp.replace(target)
        return None
    except Exception as e:
        return f"{type(e).__name__}: {e}"


def _update_json_in_dir(file: str, allowed_dir: Path, payload: Dict[str, Any], avatar_filename: str = None) -> Dict[str, Any]:
    """
    在指定 allowed_dir 范围内创建/更新一个 JSON 文件。
    约定：
    - payload.content 为完整 JSON（object 或 array）
    - 若 payload.name / payload.description 传入，则写入 content['name'/'description']（覆盖）
    - 若 payload.icon_base64 传入：
      - 若为非空字符串：保存为同目录下的 icon.png（覆盖或创建）
      - 若为空字符串 ''：删除现有的 icon.png（如果存在）
      - 若不传或为 None：不做任何改变（保持现有图标）
    - 若 payload.avatar_base64 传入且 avatar_filename 指定：
      - 若为非空字符串：保存为同目录下的 avatar_filename（覆盖或创建）
      - 若为空字符串 ''：删除现有的头像文件（如果存在）
      - 若不传或为 None：不做任何改变（保持现有头像）
    - 若文件不存在则创建；存在则完全覆盖为 content
    - 返回与 *detail_impl 同构的结构：{ file, name, description, content, icon_path, icon_deleted, avatar_path, avatar_deleted } 或 { error, message }
    """
    root = _repo_root()

    if not isinstance(file, str) or not file:
        return {"error": "INVALID_INPUT", "message": "file 必须为非空字符串"}
    if not isinstance(payload, dict):
        return {"error": "INVALID_INPUT", "message": "payload 必须为对象"}

    content = payload.get("content")
    name = payload.get("name", None)
    desc = payload.get("description", None)
    # 使用特殊标记值来区分 "未传入" 和 "传入 None"
    icon_base64_sentinel = object()
    icon_base64 = payload.get("icon_base64", icon_base64_sentinel)
    avatar_base64_sentinel = object()
    avatar_base64 = payload.get("avatar_base64", avatar_base64_sentinel)

    # 允许 content 为对象或数组
    if not (isinstance(content, dict) or isinstance(content, list)):
        return {"error": "INVALID_INPUT", "message": "content 必须为 object 或 array"}

    target = (root / Path(file)).resolve()
    if not _is_within(target, allowed_dir):
        return {"error": "OUT_OF_SCOPE", "message": f"仅允许写入 {allowed_dir.as_posix()} 目录下的文件"}

    # 将 name/description（若提供）回写到 content 顶层（仅当 content 是对象时）
    if isinstance(content, dict):
        if name is not None:
            content["name"] = name
        if desc is not None:
            content["description"] = desc

    err = _write_json_atomic(target, content)
    if err:
        return {"error": "WRITE_FAILED", "message": err, "file": _path_rel_to_root(target, root)}

    # 处理图标：
    # - icon_base64 未传入（sentinel）或 None：不做任何改变
    # - icon_base64 == ''（空字符串）：删除现有图标
    # - icon_base64 为非空字符串：更新为新图标
    icon_path = None
    icon_deleted = False
    icon_file = target.parent / "icon.png"
    
    if icon_base64 is not icon_base64_sentinel and icon_base64 is not None:
        if icon_base64 == '':
            # 删除现有图标
            if icon_file.exists() and icon_file.is_file():
                try:
                    icon_file.unlink()
                    icon_deleted = True
                except Exception as e:
                    # 删除失败不影响整体更新
                    pass
        else:
            # 更新为新图标
            try:
                icon_bytes = base64.b64decode(icon_base64)
                icon_file.write_bytes(icon_bytes)
                icon_path = _path_rel_to_root(icon_file, root)
            except Exception as e:
                # 图标保存失败不影响整体更新，但记录错误
                pass

    # 处理头像（如果指定了 avatar_filename）
    avatar_path = None
    avatar_deleted = False
    if avatar_filename:
        avatar_file = target.parent / avatar_filename
        
        if avatar_base64 is not avatar_base64_sentinel and avatar_base64 is not None:
            if avatar_base64 == '':
                # 删除现有头像
                if avatar_file.exists() and avatar_file.is_file():
                    try:
                        avatar_file.unlink()
                        avatar_deleted = True
                    except Exception as e:
                        # 删除失败不影响整体更新
                        pass
            else:
                # 更新为新头像
                try:
                    avatar_bytes = base64.b64decode(avatar_base64)
                    avatar_file.write_bytes(avatar_bytes)
                    avatar_path = _path_rel_to_root(avatar_file, root)
                except Exception as e:
                    # 头像保存失败不影响整体更新，但记录错误
                    pass

    # 规范化返回
    if isinstance(content, dict):
        out_name = _ensure_str(content.get("name"))
        out_desc = _ensure_str(content.get("description"))
    else:
        out_name = None
        out_desc = None

    result: Dict[str, Any] = {
        "file": _path_rel_to_root(target, root),
        "name": out_name,
        "description": out_desc,
        "content": content,
    }
    if icon_path:
        result["icon_path"] = icon_path
    if icon_deleted:
        result["icon_deleted"] = True
    if avatar_path:
        result["avatar_path"] = avatar_path
    if avatar_deleted:
        result["avatar_deleted"] = True
    return result


# ---------- 实现：按类型保存（创建/更新） ----------

def update_preset_file_impl(file: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    root = _repo_root()
    presets_dir = root / "backend_projects" / "SmartTavern" / "data" / "presets"
    return _update_json_in_dir(file, presets_dir, payload)


def update_world_book_file_impl(file: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    root = _repo_root()
    world_dir = root / "backend_projects" / "SmartTavern" / "data" / "world_books"
    return _update_json_in_dir(file, world_dir, payload)


def update_character_file_impl(file: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    root = _repo_root()
    char_dir = root / "backend_projects" / "SmartTavern" / "data" / "characters"
    return _update_json_in_dir(file, char_dir, payload, avatar_filename="character.png")


def update_persona_file_impl(file: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    root = _repo_root()
    persona_dir = root / "backend_projects" / "SmartTavern" / "data" / "personas"
    return _update_json_in_dir(file, persona_dir, payload, avatar_filename="persona.png")


def update_regex_rule_file_impl(file: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    root = _repo_root()
    regex_dir = root / "backend_projects" / "SmartTavern" / "data" / "regex_rules"
    return _update_json_in_dir(file, regex_dir, payload)


# ---------- 实现：列出 llm_configs ----------

def list_llm_configs_impl(base_dir: Optional[str] = None,
                          fields: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    扫描 llm_configs 目录（目录式），返回每个配置目录下 llm_config.json 的相对路径与所需字段（name/description）
    新结构：
      backend_projects/SmartTavern/data/llm_configs/{name}/llm_config.json
    """
    root = _repo_root()
    default_folder = root / "backend_projects" / "SmartTavern" / "data" / "llm_configs"

    if base_dir:
        b = Path(base_dir)
        folder = (root / b).resolve() if not b.is_absolute() else b.resolve()
    else:
        folder = default_folder

    want_name = True
    want_desc = True
    if isinstance(fields, list) and fields:
        fs = [str(x).strip().lower() for x in fields if isinstance(x, str)]
        want_name = "name" in fs
        want_desc = "description" in fs

    items: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    if not folder.exists() or not folder.is_dir():
        return {
            "folder": _path_rel_to_root(folder, root),
            "total": 0,
            "items": [],
            "errors": [{"file": None, "error": f"Folder not found: {folder}"}]
        }

    # 扫描每个子目录下的 llm_config.json
    for sub in sorted(folder.iterdir()):
        if not sub.is_dir():
            continue
        p = sub / "llm_config.json"
        if not (p.exists() and p.is_file()):
            errors.append({"file": _path_rel_to_root(sub, root), "error": "llm_config.json not found"})
            continue

        doc, err = _safe_read_json(p)
        if err:
            errors.append({"file": _path_rel_to_root(p, root), "error": err})
            continue

        name = _ensure_str((doc or {}).get("name")) if want_name else None
        desc = _ensure_str((doc or {}).get("description")) if want_desc else None

        item: Dict[str, Any] = {"file": _path_rel_to_root(p, root)}
        if want_name:
            item["name"] = name
        if want_desc:
            item["description"] = desc
        items.append(item)

    out: Dict[str, Any] = {
        "folder": _path_rel_to_root(folder, root),
        "total": len(items),
        "items": items
    }
    if errors:
        out["errors"] = errors
    return out


# ---------- 实现：读取单个 llm_config 详情 ----------

def get_llm_config_detail_impl(file: str) -> Dict[str, Any]:
    """
    读取 backend_projects/SmartTavern/data/llm_configs 下指定 JSON 文件，返回完整内容与基础字段。
    """
    root = _repo_root()
    llm_dir = root / "backend_projects" / "SmartTavern" / "data" / "llm_configs"

    if not isinstance(file, str) or not file:
        return {"error": "INVALID_INPUT", "message": "file 必须为非空字符串"}

    target = (root / Path(file)).resolve()
    if not _is_within(target, llm_dir):
        return {"error": "OUT_OF_SCOPE", "message": "仅允许读取 llm_configs 目录下的文件"}

    doc, err = _safe_read_json(target)
    if err:
        return {"error": "READ_FAILED", "message": err, "file": _path_rel_to_root(target, root)}

    name = _ensure_str((doc or {}).get("name"))
    desc = _ensure_str((doc or {}).get("description"))

    return {
        "file": _path_rel_to_root(target, root),
        "name": name,
        "description": desc,
        "content": doc,
    }


# ---------- 实现：更新/创建 llm_config 文件 ----------

def update_llm_config_file_impl(file: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    root = _repo_root()
    llm_dir = root / "backend_projects" / "SmartTavern" / "data" / "llm_configs"
    return _update_json_in_dir(file, llm_dir, payload)


# ---------- 实现：列出 plugins ----------

def list_plugins_impl(base_dir: Optional[str] = None,
                        fields: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    扫描 plugins 目录（每个子目录视为一个插件），仅读取 manifest.json 的 name/description。
    支持插件开关文件 backend_projects/SmartTavern/plugins/plugins_switch.json：
      {
        "enabled": ["plugin-dir-a", "plugin-dir-b"],
        "disabled": ["..."] // 可选；仅作标注，不参与过滤
      }
    - 若存在开关文件，则仅返回 enabled 中声明的插件；若文件中声明但目录缺失，记录错误信息。
    - 若开关文件不存在，则返回 plugins 目录下的全部插件。
    返回：每个插件一条记录 { dir: <插件根目录>, name, description }（不返回入口 JS）
    """
    root = _repo_root()
    default_folder = root / "backend_projects" / "SmartTavern" / "plugins"

    if base_dir:
        b = Path(base_dir)
        folder = (root / b).resolve() if not b.is_absolute() else b.resolve()
    else:
        folder = default_folder

    want_name = True
    want_desc = True
    if isinstance(fields, list) and fields:
        fs = [str(x).strip().lower() for x in fields if isinstance(x, str)]
        want_name = "name" in fs
        want_desc = "description" in fs

    items: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    if not folder.exists() or not folder.is_dir():
        return {
            "folder": _path_rel_to_root(folder, root),
            "total": 0,
            "items": [],
            "errors": [{"file": None, "error": f"Folder not found: {folder}"}]
        }

    # 尝试读取开关文件（必须存在，否则不返回任何插件并给出错误）
    switch_path = folder / "plugins_switch.json"
    if not (switch_path.exists() and switch_path.is_file()):
        return {
            "folder": _path_rel_to_root(folder, root),
            "total": 0,
            "items": [],
            "errors": [{"file": _path_rel_to_root(switch_path, root), "error": "plugins_switch.json missing"}]
        }
    sw_doc, sw_err = _safe_read_json(switch_path)
    if not (sw_err is None and isinstance(sw_doc, dict)):
        return {
            "folder": _path_rel_to_root(folder, root),
            "total": 0,
            "items": [],
            "errors": [{"file": _path_rel_to_root(switch_path, root), "error": sw_err or "plugins_switch.json invalid"}]
        }
    raw_enabled = sw_doc.get("enabled", [])
    if not isinstance(raw_enabled, list):
        return {
            "folder": _path_rel_to_root(folder, root),
            "total": 0,
            "items": [],
            "errors": [{"file": _path_rel_to_root(switch_path, root), "error": "enabled must be array"}]
        }
    enabled_list = [str(x) for x in raw_enabled if isinstance(x, (str, int))]

    # 同时读取 disabled，列表中声明的插件也需要扫描（用于前端展示与启用切换）
    raw_disabled = sw_doc.get("disabled", [])
    if raw_disabled is None:
        raw_disabled = []
    if not isinstance(raw_disabled, list):
        return {
            "folder": _path_rel_to_root(folder, root),
            "total": 0,
            "items": [],
            "errors": [{"file": _path_rel_to_root(switch_path, root), "error": "disabled must be array"}]
        }
    disabled_list = [str(x) for x in raw_disabled if isinstance(x, (str, int))]

    # 统一候选列表：enabled ∪ disabled（去重）
    names_seen: set = set()
    name_list: List[str] = []
    for nm in enabled_list + disabled_list:
        if nm not in names_seen:
            names_seen.add(nm)
            name_list.append(nm)

    # 决定要扫描的子目录集合（按开关文件声明的所有插件）
    candidates: List[Path] = []
    for nm in name_list:
        sub = folder / str(nm)
        if not sub.exists() or not sub.is_dir():
            errors.append({"file": _path_rel_to_root(sub, root), "error": "plugin directory not found (from plugins_switch.json)"})
            continue
        candidates.append(sub)

    # 生成 enabled 集合，供标注使用
    enabled_set = set(enabled_list)

    # 构造清单
    for sub in candidates:
        try:
            man = sub / "manifest.json"
            if not (man.exists() and man.is_file()):
                errors.append({"file": _path_rel_to_root(sub, root), "error": "manifest.json not found"})
                continue
            man_doc, man_err = _safe_read_json(man)
            if man_err:
                errors.append({"file": _path_rel_to_root(man, root), "error": man_err})
                continue
            if not isinstance(man_doc, dict):
                errors.append({"file": _path_rel_to_root(man, root), "error": "manifest.json is not an object"})
                continue

            name = _ensure_str(man_doc.get("name")) if want_name else None
            desc = _ensure_str(man_doc.get("description")) if want_desc else None

            plug_name = sub.name
            item: Dict[str, Any] = {
                "dir": _path_rel_to_root(sub, root),
                "enabled": plug_name in enabled_set
            }
            if want_name:
                item["name"] = name
            if want_desc:
                item["description"] = desc
            items.append(item)
        except Exception as e:
            errors.append({"file": _path_rel_to_root(sub, root), "error": f"{type(e).__name__}: {e}"})

    out: Dict[str, Any] = {
        "folder": _path_rel_to_root(folder, root),
        "total": len(items),
        "items": items
    }
    if errors:
        out["errors"] = errors
    return out


# ---------- 插件开关（plugins_switch.json） ----------
def get_plugins_switch_impl() -> Dict[str, Any]:
    """
    读取 backend_projects/SmartTavern/plugins/plugins_switch.json 内容。
    若不存在则返回 error=SWITCH_MISSING，并提示缺失。
    """
    root = _repo_root()
    folder = root / "backend_projects" / "SmartTavern" / "plugins"
    path = folder / "plugins_switch.json"
    out = {"file": _path_rel_to_root(path, root), "enabled": None, "disabled": None}
    if not path.exists() or not path.is_file():
        return {"error": "SWITCH_MISSING", "message": "plugins_switch.json not found", **out}
    doc, err = _safe_read_json(path)
    if err:
        return {"error": "READ_FAILED", "message": err, **out}
    if not isinstance(doc, dict):
        return {"error": "INVALID_SWITCH", "message": "plugins_switch.json must be an object", **out}
    enabled = doc.get("enabled", None)
    disabled = doc.get("disabled", None)
    if enabled is not None and not isinstance(enabled, list):
        return {"error": "INVALID_SWITCH", "message": "enabled must be array", **out}
    if disabled is not None and not isinstance(disabled, list):
        return {"error": "INVALID_SWITCH", "message": "disabled must be array", **out}
    out["enabled"] = enabled
    out["disabled"] = disabled
    return out

def update_plugins_switch_impl(content: Dict[str, Any]) -> Dict[str, Any]:
    """
    更新 plugins_switch.json，期望结构：
      { "enabled": [<string>...], "disabled": [<string>...] }
    规则：
    - enabled 必须为数组（可为空）；若 disabled 未提供，则自动计算为“所有插件目录 - enabled”
    - disabled 若提供，必须为数组；写入时去重并规范为字符串数组
    """
    root = _repo_root()
    folder = root / "backend_projects" / "SmartTavern" / "plugins"
    path = folder / "plugins_switch.json"

    if not isinstance(content, dict):
        return {"error": "INVALID_INPUT", "message": "content must be object"}

    # 规范化 enabled
    raw_enabled = content.get("enabled", [])
    if not isinstance(raw_enabled, list):
        return {"error": "INVALID_INPUT", "message": "enabled must be array of string"}
    enabled = [str(x) for x in raw_enabled if isinstance(x, (str, int))]
    # 去重并保持顺序
    seen = set()
    enabled = [x for x in enabled if not (x in seen or seen.add(x))]

    # 读取所有插件目录名称（用于自动计算 disabled）
    all_names: List[str] = []
    try:
        if folder.exists() and folder.is_dir():
            for sub in sorted(folder.iterdir()):
                if sub.is_dir():
                    all_names.append(sub.name)
    except Exception as e:
        # 不影响写入，但给出提示
        return {"error": "READ_FAILED", "message": f"scan plugins failed: {type(e).__name__}: {e}"}

    # 规范化 disabled（若未提供则自动计算）
    if "disabled" in content and content.get("disabled", None) is not None:
        raw_disabled = content.get("disabled", [])
        if not isinstance(raw_disabled, list):
            return {"error": "INVALID_INPUT", "message": "disabled must be array of string"}
        disabled = [str(x) for x in raw_disabled if isinstance(x, (str, int))]
        # 去重/去交集
        dseen = set()
        disabled = [x for x in disabled if not (x in dseen or dseen.add(x))]
    else:
        eset = set(enabled)
        disabled = [n for n in all_names if n not in eset]

    try:
        folder.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as f:
            json.dump({"enabled": enabled, "disabled": disabled}, f, ensure_ascii=False, indent=2)
            f.write("\n")
        return {"file": _path_rel_to_root(path, root), "enabled": enabled, "disabled": disabled}
    except Exception as e:
        return {"error": "WRITE_FAILED", "message": f"{type(e).__name__}: {e}", "file": _path_rel_to_root(path, root)}

# ---------- 实现：读取 plugins 资产（图片/二进制/任意文件，Base64 编码） ----------
def get_plugins_asset_impl(file: str) -> Dict[str, Any]:
    """
    读取 backend_projects/SmartTavern/plugins 下的任意文件（非JS亦可），
    返回 Base64 编码内容与 MIME 类型，供前端 Loader 在运行时生成 Blob URL 使用。

    入参:
      - file: POSIX 相对路径，例如：
              "backend_projects/SmartTavern/plugins/my-plugin/logo.png"

    返回:
      {
        "file": "...",
        "mime": "image/png",
        "size": 12345,
        "content_base64": "iVBORw0KGgoAAA..."
      }
    """
    root = _repo_root()
    plugins_dir = root / "backend_projects" / "SmartTavern" / "plugins"

    if not isinstance(file, str) or not file:
        return {"error": "INVALID_INPUT", "message": "file 必须为非空字符串"}

    target = (root / Path(file)).resolve()
    if not _is_within(target, plugins_dir):
        return {"error": "OUT_OF_SCOPE", "message": "仅允许读取 plugins 目录下的文件"}

    if not target.exists() or not target.is_file():
        return {"error": "NOT_FOUND", "message": f"文件不存在: {target.as_posix()}", "file": _path_rel_to_root(target, root)}

    try:
        data = target.read_bytes()
        mime, _ = mimetypes.guess_type(target.name)
        b64 = base64.b64encode(data).decode("ascii")
        return {
            "file": _path_rel_to_root(target, root),
            "mime": mime or "application/octet-stream",
            "size": len(data),
            "content_base64": b64,
        }
    except Exception as e:
        return {"error": "READ_FAILED", "message": f"{type(e).__name__}: {e}", "file": _path_rel_to_root(target, root)}


# ---------- 实现：通用删除数据目录 ----------

# 允许删除的数据类型及其对应的目录路径
_ALLOWED_DELETE_TYPES: Dict[str, str] = {
    "preset": "backend_projects/SmartTavern/data/presets",
    "worldbook": "backend_projects/SmartTavern/data/world_books",
    "character": "backend_projects/SmartTavern/data/characters",
    "persona": "backend_projects/SmartTavern/data/personas",
    "regex_rule": "backend_projects/SmartTavern/data/regex_rules",
    "llm_config": "backend_projects/SmartTavern/data/llm_configs",
    "conversation": "backend_projects/SmartTavern/data/conversations",
    "plugin": "backend_projects/SmartTavern/plugins",
}


def delete_data_folder_impl(folder_path: str) -> Dict[str, Any]:
    """
    通用的删除数据目录实现。
    删除指定的数据目录（整个文件夹，包括其中所有文件）。
    
    仅允许删除以下类型的目录：
    - 预设 (presets)
    - 世界书 (world_books)
    - 角色卡 (characters)
    - 用户画像 (personas)
    - 正则规则 (regex_rules)
    - LLM配置 (llm_configs)
    - 插件 (plugins)
    
    入参:
      - folder_path: 要删除的目录路径（POSIX 风格），例如：
                    "backend_projects/SmartTavern/data/presets/Default"
    
    返回:
      成功: { "success": True, "deleted_path": "...", "data_type": "...", "message": "..." }
      失败: { "success": False, "error": "...", "message": "..." }
    """
    import shutil
    
    root = _repo_root()
    
    if not isinstance(folder_path, str) or not folder_path:
        return {"success": False, "error": "INVALID_INPUT", "message": "folder_path 必须为非空字符串"}
    
    # 规范化路径
    folder_path_normalized = folder_path.replace("\\", "/").strip("/")
    
    # 检查路径是否在允许的类型目录中
    matched_type: Optional[str] = None
    matched_base: Optional[Path] = None
    
    for data_type, base_path in _ALLOWED_DELETE_TYPES.items():
        if folder_path_normalized.startswith(base_path):
            matched_type = data_type
            matched_base = root / base_path
            break
    
    if not matched_type or not matched_base:
        allowed_paths = ", ".join(_ALLOWED_DELETE_TYPES.values())
        return {
            "success": False,
            "error": "NOT_ALLOWED",
            "message": f"不允许删除该路径。仅允许删除以下目录下的内容: {allowed_paths}"
        }
    
    target = (root / Path(folder_path_normalized)).resolve()
    
    # 安全检查：确保目标在允许的目录范围内（防止路径遍历攻击）
    if not _is_within(target, matched_base):
        return {
            "success": False,
            "error": "OUT_OF_SCOPE",
            "message": f"路径不在允许的范围内"
        }
    
    # 确保不是删除类型目录本身（例如不能删除整个 presets 目录）
    if target.resolve() == matched_base.resolve():
        return {
            "success": False,
            "error": "CANNOT_DELETE_ROOT",
            "message": f"不能删除根类型目录: {matched_type}"
        }
    
    # 确保目标存在
    if not target.exists():
        return {
            "success": False,
            "error": "NOT_FOUND",
            "message": f"目录不存在: {folder_path}"
        }
    
    # 确保目标是目录
    if not target.is_dir():
        return {
            "success": False,
            "error": "NOT_A_DIRECTORY",
            "message": f"目标不是目录: {folder_path}"
        }
    
    try:
        # 如果是插件，删除前需要从 plugins_switch.json 中移除注册
        plugin_name = target.name if matched_type == "plugin" else None
        
        # 删除整个目录
        shutil.rmtree(target)
        
        # 删除插件后，更新 plugins_switch.json
        if matched_type == "plugin" and plugin_name:
            _remove_plugin_from_switch(plugin_name, root)
        
        return {
            "success": True,
            "deleted_path": _path_rel_to_root(target, root),
            "data_type": matched_type,
            "message": f"已删除{matched_type}目录: {target.name}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": "DELETE_FAILED",
            "message": f"{type(e).__name__}: {e}"
        }


def _remove_plugin_from_switch(plugin_name: str, root: Path) -> None:
    """
    从 plugins_switch.json 中移除指定插件的注册。
    
    入参:
      - plugin_name: 插件目录名称
      - root: 仓库根目录
    """
    switch_path = root / "backend_projects" / "SmartTavern" / "plugins" / "plugins_switch.json"
    
    if not switch_path.exists() or not switch_path.is_file():
        return  # 开关文件不存在，无需处理
    
    try:
        doc, err = _safe_read_json(switch_path)
        if err or not isinstance(doc, dict):
            return  # 无法读取或格式不正确，跳过
        
        modified = False
        
        # 从 enabled 列表移除
        enabled = doc.get("enabled", [])
        if isinstance(enabled, list) and plugin_name in enabled:
            enabled.remove(plugin_name)
            doc["enabled"] = enabled
            modified = True
        
        # 从 disabled 列表移除
        disabled = doc.get("disabled", [])
        if isinstance(disabled, list) and plugin_name in disabled:
            disabled.remove(plugin_name)
            doc["disabled"] = disabled
            modified = True
        
        # 如果有修改，写回文件
        if modified:
            _write_json_atomic(switch_path, doc)
    except Exception:
        pass  # 更新开关文件失败不影响删除操作的结果


# ---------- 实现：读取单个 plugin 详情 ----------

def get_plugin_detail_impl(dir_path: str) -> Dict[str, Any]:
    """
    读取 backend_projects/SmartTavern/plugins 下指定插件目录的 manifest.json 文件，返回完整内容与基础字段。
    
    入参:
      - dir_path: 插件目录路径（POSIX 风格），例如：
                  "backend_projects/SmartTavern/plugins/context-variables"
    
    返回:
      {
        "dir": "...",
        "file": "...",
        "name": "...|null",
        "description": "...|null",
        "content": {...}
      }
    """
    root = _repo_root()
    plugins_dir = root / "backend_projects" / "SmartTavern" / "plugins"

    if not isinstance(dir_path, str) or not dir_path:
        return {"error": "INVALID_INPUT", "message": "dir_path 必须为非空字符串"}

    target_dir = (root / Path(dir_path)).resolve()
    if not _is_within(target_dir, plugins_dir):
        return {"error": "OUT_OF_SCOPE", "message": "仅允许读取 plugins 目录下的文件"}

    if not target_dir.exists() or not target_dir.is_dir():
        return {"error": "NOT_FOUND", "message": "插件目录不存在", "dir": _path_rel_to_root(target_dir, root)}

    manifest_path = target_dir / "manifest.json"
    if not manifest_path.exists() or not manifest_path.is_file():
        return {"error": "NOT_FOUND", "message": "manifest.json 不存在", "dir": _path_rel_to_root(target_dir, root)}

    doc, err = _safe_read_json(manifest_path)
    if err:
        return {"error": "READ_FAILED", "message": err, "dir": _path_rel_to_root(target_dir, root), "file": _path_rel_to_root(manifest_path, root)}

    name = _ensure_str((doc or {}).get("name"))
    desc = _ensure_str((doc or {}).get("description"))

    return {
        "dir": _path_rel_to_root(target_dir, root),
        "file": _path_rel_to_root(manifest_path, root),
        "name": name,
        "description": desc,
        "content": doc,
    }


# ---------- 实现：更新/创建 plugin manifest.json 文件 ----------

def update_plugin_file_impl(dir_path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    更新插件目录下的 manifest.json 文件。
    允许修改 name、description 字段，以及上传/删除图标。
    
    入参:
      - dir_path: 插件目录路径（POSIX 风格）
      - payload: 包含以下字段的字典：
        - name: 插件名称（可选）
        - description: 插件描述（可选）
        - icon_base64: 图标Base64编码（可选）
          - 若为非空字符串：保存为 icon.png（覆盖或创建）
          - 若为空字符串 ''：删除现有的 icon.png
          - 若不传或为 None：不做任何改变
    
    返回:
      {
        "dir": "...",
        "file": "...",
        "name": "...|null",
        "description": "...|null",
        "content": {...},
        "icon_path": "..." (如果上传了图标),
        "icon_deleted": true (如果删除了图标)
      }
    """
    root = _repo_root()
    plugins_dir = root / "backend_projects" / "SmartTavern" / "plugins"

    if not isinstance(dir_path, str) or not dir_path:
        return {"error": "INVALID_INPUT", "message": "dir_path 必须为非空字符串"}
    if not isinstance(payload, dict):
        return {"error": "INVALID_INPUT", "message": "payload 必须为对象"}

    target_dir = (root / Path(dir_path)).resolve()
    if not _is_within(target_dir, plugins_dir):
        return {"error": "OUT_OF_SCOPE", "message": "仅允许修改 plugins 目录下的文件"}

    if not target_dir.exists() or not target_dir.is_dir():
        return {"error": "NOT_FOUND", "message": "插件目录不存在", "dir": _path_rel_to_root(target_dir, root)}

    manifest_path = target_dir / "manifest.json"
    if not manifest_path.exists() or not manifest_path.is_file():
        return {"error": "NOT_FOUND", "message": "manifest.json 不存在", "dir": _path_rel_to_root(target_dir, root)}

    # 读取现有的 manifest.json
    doc, err = _safe_read_json(manifest_path)
    if err:
        return {"error": "READ_FAILED", "message": err, "dir": _path_rel_to_root(target_dir, root), "file": _path_rel_to_root(manifest_path, root)}

    if not isinstance(doc, dict):
        return {"error": "INVALID_MANIFEST", "message": "manifest.json 必须是对象", "dir": _path_rel_to_root(target_dir, root), "file": _path_rel_to_root(manifest_path, root)}

    # 更新 name 和 description 字段
    name = payload.get("name", None)
    desc = payload.get("description", None)

    if name is not None:
        doc["name"] = name
    if desc is not None:
        doc["description"] = desc

    # 写回 manifest.json
    write_err = _write_json_atomic(manifest_path, doc)
    if write_err:
        return {"error": "WRITE_FAILED", "message": write_err, "dir": _path_rel_to_root(target_dir, root), "file": _path_rel_to_root(manifest_path, root)}

    # 处理图标（使用 sentinel 值区分"未传入"和"传入 None"）
    icon_base64_sentinel = object()
    icon_base64 = payload.get("icon_base64", icon_base64_sentinel)
    
    icon_path = None
    icon_deleted = False
    icon_file = target_dir / "icon.png"
    
    if icon_base64 is not icon_base64_sentinel and icon_base64 is not None:
        if icon_base64 == '':
            # 删除现有图标
            if icon_file.exists() and icon_file.is_file():
                try:
                    icon_file.unlink()
                    icon_deleted = True
                except Exception as e:
                    # 删除失败不影响整体更新
                    pass
        else:
            # 更新为新图标
            try:
                icon_bytes = base64.b64decode(icon_base64)
                icon_file.write_bytes(icon_bytes)
                icon_path = _path_rel_to_root(icon_file, root)
            except Exception as e:
                # 图标保存失败不影响整体更新，但记录错误
                pass

    # 返回更新后的内容
    out_name = _ensure_str(doc.get("name"))
    out_desc = _ensure_str(doc.get("description"))

    result: Dict[str, Any] = {
        "dir": _path_rel_to_root(target_dir, root),
        "file": _path_rel_to_root(manifest_path, root),
        "name": out_name,
        "description": out_desc,
        "content": doc,
    }
    if icon_path:
        result["icon_path"] = icon_path
    if icon_deleted:
        result["icon_deleted"] = True
    return result


# ---------- 实现：创建数据文件夹 ----------

def create_data_folder_impl(data_type: str, name: str, description: Optional[str] = None, folder_name: Optional[str] = None, icon_base64: Optional[str] = None) -> Dict[str, Any]:
    """
    创建新的数据文件夹并初始化必要文件。
    
    入参:
      - data_type: 数据类型 (preset, worldbook, character, persona, regex_rule, llm_config)
      - name: 名称（写入JSON的name字段）
      - description: 描述（可选，写入JSON的description字段）
      - folder_name: 文件夹名称（目录名）
      - icon_base64: 图标的Base64编码（可选，保存为icon.png）
    
    返回:
      成功: { "success": True, "folder_path": "...", "file_path": "...", ... }
      失败: { "success": False, "error": "...", "message": "..." }
    """
    root = _repo_root()
    
    # 数据类型配置
    type_configs = {
        "preset": {
            "base_dir": root / "backend_projects" / "SmartTavern" / "data" / "presets",
            "filename": "preset.json",
            "init_content": {
                "name": name,
                "description": description or "",
                "api_config": {},
                "prompts": [],
                "regex_rules": []
            }
        },
        "worldbook": {
            "base_dir": root / "backend_projects" / "SmartTavern" / "data" / "world_books",
            "filename": "worldbook.json",
            "init_content": {
                "name": name,
                "description": description or "",
                "entries": []
            }
        },
        "character": {
            "base_dir": root / "backend_projects" / "SmartTavern" / "data" / "characters",
            "filename": "character.json",
            "init_content": {
                "name": name,
                "description": description or "",
                "type": "threaded"
            }
        },
        "persona": {
            "base_dir": root / "backend_projects" / "SmartTavern" / "data" / "personas",
            "filename": "persona.json",
            "init_content": {
                "name": name,
                "description": description or ""
            }
        },
        "regex_rule": {
            "base_dir": root / "backend_projects" / "SmartTavern" / "data" / "regex_rules",
            "filename": "regex_rule.json",
            "init_content": {
                "name": name,
                "description": description or "",
                "rules": []
            }
        },
        "llm_config": {
            "base_dir": root / "backend_projects" / "SmartTavern" / "data" / "llm_configs",
            "filename": "llm_config.json",
            "init_content": {
                "name": name,
                "description": description or "",
                "provider": "",
                "model": "",
                "api_key": ""
            }
        }
    }
    
    # 验证数据类型
    if data_type not in type_configs:
        return {
            "success": False,
            "error": "INVALID_TYPE",
            "message": f"不支持的数据类型: {data_type}。支持的类型: {', '.join(type_configs.keys())}"
        }
    
    # 验证输入
    if not isinstance(name, str) or not name.strip():
        return {"success": False, "error": "INVALID_INPUT", "message": "name 必须为非空字符串"}
    
    if not isinstance(folder_name, str) or not folder_name.strip():
        return {"success": False, "error": "INVALID_INPUT", "message": "folder_name 必须为非空字符串"}
    
    # 验证文件夹名称格式
    import re
    if not re.match(r'^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$', folder_name):
        return {
            "success": False,
            "error": "INVALID_FOLDER_NAME",
            "message": "文件夹名称只能包含字母、数字、下划线、连字符和中文字符"
        }
    
    config = type_configs[data_type]
    base_dir = config["base_dir"]
    filename = config["filename"]
    init_content = config["init_content"]
    
    # 构建目标路径
    target_folder = base_dir / folder_name
    target_file = target_folder / filename
    
    # 检查文件夹是否已存在
    if target_folder.exists():
        return {
            "success": False,
            "error": "FOLDER_EXISTS",
            "message": f"文件夹已存在: {folder_name}",
            "folder_name": folder_name
        }
    
    try:
        # 创建文件夹
        target_folder.mkdir(parents=True, exist_ok=False)
        
        # 写入初始JSON文件
        err = _write_json_atomic(target_file, init_content)
        if err:
            # 如果写入失败，删除已创建的文件夹
            try:
                import shutil
                shutil.rmtree(target_folder)
            except Exception:
                pass
            return {
                "success": False,
                "error": "WRITE_FAILED",
                "message": f"创建文件失败: {err}"
            }
        
        # 如果提供了图标，保存为 icon.png
        icon_path = None
        if icon_base64:
            try:
                icon_bytes = base64.b64decode(icon_base64)
                icon_file = target_folder / "icon.png"
                icon_file.write_bytes(icon_bytes)
                icon_path = _path_rel_to_root(icon_file, root)
            except Exception as e:
                # 图标保存失败不影响整体创建，只记录警告
                pass
        
        return {
            "success": True,
            "data_type": data_type,
            "folder_path": _path_rel_to_root(target_folder, root),
            "file_path": _path_rel_to_root(target_file, root),
            "icon_path": icon_path,
            "name": name,
            "description": description,
            "message": f"成功创建{data_type}: {name}"
        }
    except Exception as e:
        # 清理可能创建的文件夹
        if target_folder.exists():
            try:
                import shutil
                shutil.rmtree(target_folder)
            except Exception:
                pass
        return {
            "success": False,
            "error": "CREATE_FAILED",
            "message": f"{type(e).__name__}: {e}"
        }


# ---------- 实现：读取 data 资产（图片/二进制/任意文件，Base64 编码） ----------
def get_data_asset_impl(file: str) -> Dict[str, Any]:
    """
    读取 backend_projects/SmartTavern/data 下的任意文件（例如角色图标等），
    返回 Base64 编码内容与 MIME 类型，供前端生成 Blob URL 使用。

    入参:
      - file: POSIX 相对路径，例如：
              "backend_projects/SmartTavern/data/characters/心与露/icon.png"

    返回:
      {
        "file": "...",
        "mime": "image/png",
        "size": 12345,
        "content_base64": "iVBORw0KGgoAAA..."
      }
    """
    root = _repo_root()
    data_dir = root / "backend_projects" / "SmartTavern" / "data"

    if not isinstance(file, str) or not file:
        return {"error": "INVALID_INPUT", "message": "file 必须为非空字符串"}

    target = (root / Path(file)).resolve()
    if not _is_within(target, data_dir):
        return {"error": "OUT_OF_SCOPE", "message": "仅允许读取 data 目录下的文件"}

    if not target.exists() or not target.is_file():
        return {"error": "NOT_FOUND", "message": f"文件不存在: {target.as_posix()}", "file": _path_rel_to_root(target, root)}

    try:
        data = target.read_bytes()
        mime, _ = mimetypes.guess_type(target.name)
        b64 = base64.b64encode(data).decode("ascii")
        return {
            "file": _path_rel_to_root(target, root),
            "mime": mime or "application/octet-stream",
            "size": len(data),
            "content_base64": b64,
        }
    except Exception as e:
        return {"error": "READ_FAILED", "message": f"{type(e).__name__}: {e}", "file": _path_rel_to_root(target, root)}