# -*- coding: utf-8 -*-
"""
SmartTavern.styles 实现层

职责
- 扫描 backend_projects/SmartTavern/styles 下的主题目录（.sttheme）
- 读取/写入 styles_switch.json 开关文件
- 读取主题 manifest.json 和 entries 文件
- 返回主题资产（CSS/JSON/图片等）

说明
- 本文件仅提供纯实现函数；API 注册在同目录 styles.py 中完成
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
import json
import base64
import mimetypes
import hashlib


# ---------- 路径与工具 ----------

def _repo_root() -> Path:
    """
    返回仓库根目录（基于当前文件层级向上回溯）
    当前文件位于: repo_root/api/modules/SmartTavern/styles/impl.py
    parents[4] => repo_root
    """
    return Path(__file__).resolve().parents[4]


def _styles_dir() -> Path:
    """返回主题存储目录"""
    return _repo_root() / "backend_projects" / "SmartTavern" / "styles"


def _pages_images_dir() -> Path:
    """返回页面背景图片目录"""
    return _repo_root() / "backend_projects" / "SmartTavern" / "pages_images"


def _safe_read_json(p: Path) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """安全读取 JSON 文件"""
    try:
        with p.open("r", encoding="utf-8") as f:
            return json.load(f), None
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"


def _ensure_str(x: Any) -> Optional[str]:
    """确保返回字符串或 None"""
    if x is None:
        return None
    try:
        return str(x)
    except Exception:
        return None


def _path_rel_to_root(p: Path, root: Path) -> str:
    """
    统一返回 POSIX 风格路径（使用 '/' 分隔）
    """
    try:
        return p.relative_to(root).as_posix()
    except Exception:
        try:
            return p.resolve().as_posix()
        except Exception:
            return str(p).replace("\\", "/")


def _is_within(child: Path, parent: Path) -> bool:
    """检查 child 是否在 parent 目录下"""
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except Exception:
        return False


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


# ---------- 实现：列出主题 ----------

def list_themes_impl(base_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    扫描 styles 目录，返回所有主题目录的列表。
    每个主题目录必须包含 manifest.json。
    列表按照 styles_switch.json 中的 order 字段排序。
    
    返回结构：
    {
        "folder": "backend_projects/SmartTavern/styles",
        "total": 2,
        "items": [
            {
                "dir": "backend_projects/SmartTavern/styles/demo-ocean.sttheme",
                "name": "Demo Ocean",
                "description": "demo-ocean",
                "entries": ["demo-ocean.sttheme.json"],
                "enabled": true
            },
            ...
        ],
        "errors": [...]
    }
    """
    root = _repo_root()
    folder = _styles_dir()
    
    if base_dir:
        b = Path(base_dir)
        folder = (root / b).resolve() if not b.is_absolute() else b.resolve()

    items: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    if not folder.exists() or not folder.is_dir():
        return {
            "folder": _path_rel_to_root(folder, root),
            "total": 0,
            "items": [],
            "errors": [{"file": None, "error": f"Folder not found: {folder}"}]
        }

    # 读取 styles_switch.json 获取启用列表和排序
    switch_path = folder / "styles_switch.json"
    enabled_set: set = set()
    order_list: List[str] = []
    if switch_path.exists() and switch_path.is_file():
        sw_doc, sw_err = _safe_read_json(switch_path)
        if sw_doc and isinstance(sw_doc, dict):
            raw_enabled = sw_doc.get("enabled", [])
            if isinstance(raw_enabled, list):
                enabled_set = set(str(x) for x in raw_enabled if isinstance(x, (str, int)))
            raw_order = sw_doc.get("order", [])
            if isinstance(raw_order, list):
                order_list = [str(x) for x in raw_order if isinstance(x, (str, int))]

    # 扫描所有包含 manifest.json 的子目录
    items_map: Dict[str, Dict[str, Any]] = {}
    for sub in folder.iterdir():
        if not sub.is_dir():
            continue
        # 跳过特殊文件（如 styles_switch.json 等）
        if sub.name.startswith("."):
            continue
        
        # 读取 manifest.json
        manifest_path = sub / "manifest.json"
        if not (manifest_path.exists() and manifest_path.is_file()):
            errors.append({
                "file": _path_rel_to_root(sub, root),
                "error": "manifest.json not found"
            })
            continue
        
        doc, err = _safe_read_json(manifest_path)
        if err:
            errors.append({
                "file": _path_rel_to_root(manifest_path, root),
                "error": err
            })
            continue
        
        if not isinstance(doc, dict):
            errors.append({
                "file": _path_rel_to_root(manifest_path, root),
                "error": "manifest.json is not an object"
            })
            continue
        
        name = _ensure_str(doc.get("name"))
        description = _ensure_str(doc.get("description"))
        entries = doc.get("entries", [])
        if not isinstance(entries, list):
            entries = []
        
        # 检查是否存在图标文件
        icon_path: Optional[str] = None
        for icon_name in ["icon.png", "icon.jpg", "icon.jpeg", "icon.webp", "icon.svg"]:
            icon_file = sub / icon_name
            if icon_file.exists() and icon_file.is_file():
                icon_path = _path_rel_to_root(icon_file, root)
                break
        
        item: Dict[str, Any] = {
            "dir": _path_rel_to_root(sub, root),
            "name": name,
            "description": description,
            "entries": entries,
            "enabled": sub.name in enabled_set,
            "icon": icon_path
        }
        items_map[sub.name] = item
    
    # 按照 order 字段排序
    # 先添加 order 中存在的项，再添加不在 order 中的项
    sorted_items: List[Dict[str, Any]] = []
    added_names: set = set()
    
    for name in order_list:
        if name in items_map:
            sorted_items.append(items_map[name])
            added_names.add(name)
    
    # 添加不在 order 中的项（按名称排序）
    for name in sorted(items_map.keys()):
        if name not in added_names:
            sorted_items.append(items_map[name])
    
    items = sorted_items

    out: Dict[str, Any] = {
        "folder": _path_rel_to_root(folder, root),
        "total": len(items),
        "items": items
    }
    if errors:
        out["errors"] = errors
    return out


# ---------- 实现：获取开关文件 ----------

def get_styles_switch_impl() -> Dict[str, Any]:
    """
    读取 backend_projects/SmartTavern/styles/styles_switch.json 内容。
    若不存在则返回 error=SWITCH_MISSING。
    """
    root = _repo_root()
    folder = _styles_dir()
    path = folder / "styles_switch.json"
    
    out = {
        "file": _path_rel_to_root(path, root),
        "enabled": None,
        "disabled": None,
        "order": None
    }
    
    if not path.exists() or not path.is_file():
        return {
            "error": "SWITCH_MISSING",
            "message": "styles_switch.json not found",
            **out
        }
    
    doc, err = _safe_read_json(path)
    if err:
        return {"error": "READ_FAILED", "message": err, **out}
    
    if not isinstance(doc, dict):
        return {
            "error": "INVALID_SWITCH",
            "message": "styles_switch.json must be an object",
            **out
        }
    
    enabled = doc.get("enabled", None)
    disabled = doc.get("disabled", None)
    order = doc.get("order", None)
    
    if enabled is not None and not isinstance(enabled, list):
        return {
            "error": "INVALID_SWITCH",
            "message": "enabled must be array",
            **out
        }
    if disabled is not None and not isinstance(disabled, list):
        return {
            "error": "INVALID_SWITCH",
            "message": "disabled must be array",
            **out
        }
    if order is not None and not isinstance(order, list):
        return {
            "error": "INVALID_SWITCH",
            "message": "order must be array",
            **out
        }
    
    out["enabled"] = enabled
    out["disabled"] = disabled
    out["order"] = order
    return out


# ---------- 实现：更新开关文件 ----------

def update_styles_switch_impl(content: Dict[str, Any]) -> Dict[str, Any]:
    """
    更新 styles_switch.json。
    期望结构：{ "enabled": [<string>...], "disabled": [<string>...], "order": [<string>...] }
    """
    root = _repo_root()
    folder = _styles_dir()
    path = folder / "styles_switch.json"
    
    if not isinstance(content, dict):
        return {"error": "INVALID_INPUT", "message": "content must be object"}
    
    # 规范化 enabled
    raw_enabled = content.get("enabled", [])
    if not isinstance(raw_enabled, list):
        return {"error": "INVALID_INPUT", "message": "enabled must be array of string"}
    enabled = [str(x) for x in raw_enabled if isinstance(x, (str, int))]
    
    # 去重并保持顺序
    seen: set = set()
    enabled = [x for x in enabled if not (x in seen or seen.add(x))]
    
    # 读取所有主题目录名称（用于自动计算 disabled 和 order）
    all_names: List[str] = []
    try:
        if folder.exists() and folder.is_dir():
            for sub in sorted(folder.iterdir()):
                # 包含 manifest.json 的子目录才算主题
                if sub.is_dir() and not sub.name.startswith(".") and (sub / "manifest.json").exists():
                    all_names.append(sub.name)
    except Exception as e:
        return {
            "error": "READ_FAILED",
            "message": f"scan styles failed: {type(e).__name__}: {e}"
        }
    
    # 规范化 disabled（若未提供则自动计算）
    if "disabled" in content and content.get("disabled", None) is not None:
        raw_disabled = content.get("disabled", [])
        if not isinstance(raw_disabled, list):
            return {"error": "INVALID_INPUT", "message": "disabled must be array of string"}
        disabled = [str(x) for x in raw_disabled if isinstance(x, (str, int))]
        dseen: set = set()
        disabled = [x for x in disabled if not (x in dseen or dseen.add(x))]
    else:
        eset = set(enabled)
        disabled = [n for n in all_names if n not in eset]
    
    # 规范化 order（若未提供则保持现有顺序或使用默认顺序）
    order: List[str] = []
    if "order" in content and content.get("order", None) is not None:
        raw_order = content.get("order", [])
        if not isinstance(raw_order, list):
            return {"error": "INVALID_INPUT", "message": "order must be array of string"}
        order = [str(x) for x in raw_order if isinstance(x, (str, int))]
        oseen: set = set()
        order = [x for x in order if not (x in oseen or oseen.add(x))]
    else:
        # 读取现有 order 或使用默认顺序
        if path.exists() and path.is_file():
            existing_doc, _ = _safe_read_json(path)
            if existing_doc and isinstance(existing_doc, dict):
                existing_order = existing_doc.get("order", [])
                if isinstance(existing_order, list):
                    order = [str(x) for x in existing_order if isinstance(x, (str, int))]
        
        # 确保所有主题都在 order 中
        order_set = set(order)
        for name in all_names:
            if name not in order_set:
                order.append(name)
    
    try:
        folder.mkdir(parents=True, exist_ok=True)
        err = _write_json_atomic(path, {"enabled": enabled, "disabled": disabled, "order": order})
        if err:
            return {
                "error": "WRITE_FAILED",
                "message": err,
                "file": _path_rel_to_root(path, root)
            }
        return {
            "file": _path_rel_to_root(path, root),
            "enabled": enabled,
            "disabled": disabled,
            "order": order
        }
    except Exception as e:
        return {
            "error": "WRITE_FAILED",
            "message": f"{type(e).__name__}: {e}",
            "file": _path_rel_to_root(path, root)
        }


# ---------- 实现：获取主题详情 ----------

def get_theme_detail_impl(theme_dir: str) -> Dict[str, Any]:
    """
    读取指定主题目录的 manifest.json，返回主题元信息。
    
    入参:
      - theme_dir: 主题目录路径（POSIX 风格），例如：
                  "backend_projects/SmartTavern/styles/demo-ocean.sttheme"
    
    返回:
      {
          "dir": "...",
          "name": "Demo Ocean",
          "description": "...",
          "entries": ["demo-ocean.sttheme.json"],
          "manifest": {...}  // 完整的 manifest.json 内容
      }
    """
    root = _repo_root()
    styles_dir = _styles_dir()
    
    if not isinstance(theme_dir, str) or not theme_dir:
        return {"error": "INVALID_INPUT", "message": "theme_dir 必须为非空字符串"}
    
    target = (root / Path(theme_dir)).resolve()
    
    if not _is_within(target, styles_dir):
        return {"error": "OUT_OF_SCOPE", "message": "仅允许读取 styles 目录下的主题"}
    
    if not target.exists() or not target.is_dir():
        return {
            "error": "NOT_FOUND",
            "message": f"主题目录不存在: {theme_dir}",
            "dir": _path_rel_to_root(target, root)
        }
    
    manifest_path = target / "manifest.json"
    if not manifest_path.exists():
        return {
            "error": "MANIFEST_MISSING",
            "message": "manifest.json not found",
            "dir": _path_rel_to_root(target, root)
        }
    
    doc, err = _safe_read_json(manifest_path)
    if err:
        return {
            "error": "READ_FAILED",
            "message": err,
            "dir": _path_rel_to_root(target, root)
        }
    
    if not isinstance(doc, dict):
        return {
            "error": "INVALID_MANIFEST",
            "message": "manifest.json is not an object",
            "dir": _path_rel_to_root(target, root)
        }
    
    name = _ensure_str(doc.get("name"))
    description = _ensure_str(doc.get("description"))
    entries = doc.get("entries", [])
    if not isinstance(entries, list):
        entries = []
    
    return {
        "dir": _path_rel_to_root(target, root),
        "name": name,
        "description": description,
        "entries": entries,
        "manifest": doc
    }


# ---------- 实现：获取主题入口文件内容 ----------

def get_theme_entries_impl(theme_dir: str) -> Dict[str, Any]:
    """
    读取指定主题目录的所有 entry 文件内容，并合并返回。
    支持前端直接消费的 ThemePackV1 格式。
    
    入参:
      - theme_dir: 主题目录路径（POSIX 风格）
    
    返回:
      {
          "dir": "...",
          "name": "...",
          "merged_pack": {
              "id": "...",
              "name": "...",
              "version": "...",
              "tokens": {...},
              "css": "...",
              ...
          },
          "entries": [
              {
                  "file": "demo-ocean.sttheme.json",
                  "content": {...}
              },
              ...
          ]
      }
    """
    root = _repo_root()
    styles_dir = _styles_dir()
    
    if not isinstance(theme_dir, str) or not theme_dir:
        return {"error": "INVALID_INPUT", "message": "theme_dir 必须为非空字符串"}
    
    target = (root / Path(theme_dir)).resolve()
    
    if not _is_within(target, styles_dir):
        return {"error": "OUT_OF_SCOPE", "message": "仅允许读取 styles 目录下的主题"}
    
    if not target.exists() or not target.is_dir():
        return {
            "error": "NOT_FOUND",
            "message": f"主题目录不存在: {theme_dir}",
            "dir": _path_rel_to_root(target, root)
        }
    
    manifest_path = target / "manifest.json"
    if not manifest_path.exists():
        return {
            "error": "MANIFEST_MISSING",
            "message": "manifest.json not found",
            "dir": _path_rel_to_root(target, root)
        }
    
    manifest_doc, err = _safe_read_json(manifest_path)
    if err or not isinstance(manifest_doc, dict):
        return {
            "error": "READ_FAILED",
            "message": err or "Invalid manifest",
            "dir": _path_rel_to_root(target, root)
        }
    
    entries_list = manifest_doc.get("entries", [])
    if not isinstance(entries_list, list):
        entries_list = []
    
    # 读取所有 entry 文件
    entries: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []
    
    # 合并后的主题包（按顺序合并 entries）
    merged_pack: Dict[str, Any] = {
        "id": _ensure_str(manifest_doc.get("name")),
        "name": _ensure_str(manifest_doc.get("name")),
        "version": None,
        "tokens": {},
        "tokensLight": {},
        "tokensDark": {},
        "css": "",
        "cssLight": "",
        "cssDark": ""
    }
    
    for entry_name in entries_list:
        if not isinstance(entry_name, str):
            continue
        
        entry_path = target / entry_name
        if not entry_path.exists() or not entry_path.is_file():
            errors.append({
                "file": entry_name,
                "error": "Entry file not found"
            })
            continue
        
        entry_doc, entry_err = _safe_read_json(entry_path)
        if entry_err:
            errors.append({
                "file": entry_name,
                "error": entry_err
            })
            continue
        
        if not isinstance(entry_doc, dict):
            errors.append({
                "file": entry_name,
                "error": "Entry file is not an object"
            })
            continue
        
        entries.append({
            "file": entry_name,
            "content": entry_doc
        })
        
        # 合并到 merged_pack
        if "id" in entry_doc and entry_doc["id"]:
            merged_pack["id"] = _ensure_str(entry_doc["id"])
        if "name" in entry_doc and entry_doc["name"]:
            merged_pack["name"] = _ensure_str(entry_doc["name"])
        if "version" in entry_doc and entry_doc["version"]:
            merged_pack["version"] = _ensure_str(entry_doc["version"])
        
        # 合并 tokens
        if isinstance(entry_doc.get("tokens"), dict):
            merged_pack["tokens"].update(entry_doc["tokens"])
        if isinstance(entry_doc.get("tokensLight"), dict):
            merged_pack["tokensLight"].update(entry_doc["tokensLight"])
        if isinstance(entry_doc.get("tokensDark"), dict):
            merged_pack["tokensDark"].update(entry_doc["tokensDark"])
        
        # 追加 CSS
        if isinstance(entry_doc.get("css"), str) and entry_doc["css"]:
            merged_pack["css"] += entry_doc["css"] + "\n"
        if isinstance(entry_doc.get("cssLight"), str) and entry_doc["cssLight"]:
            merged_pack["cssLight"] += entry_doc["cssLight"] + "\n"
        if isinstance(entry_doc.get("cssDark"), str) and entry_doc["cssDark"]:
            merged_pack["cssDark"] += entry_doc["cssDark"] + "\n"
    
    # 清理空字段
    if not merged_pack["tokens"]:
        del merged_pack["tokens"]
    if not merged_pack["tokensLight"]:
        del merged_pack["tokensLight"]
    if not merged_pack["tokensDark"]:
        del merged_pack["tokensDark"]
    if not merged_pack["css"].strip():
        del merged_pack["css"]
    else:
        merged_pack["css"] = merged_pack["css"].strip()
    if not merged_pack["cssLight"].strip():
        del merged_pack["cssLight"]
    else:
        merged_pack["cssLight"] = merged_pack["cssLight"].strip()
    if not merged_pack["cssDark"].strip():
        del merged_pack["cssDark"]
    else:
        merged_pack["cssDark"] = merged_pack["cssDark"].strip()
    
    result: Dict[str, Any] = {
        "dir": _path_rel_to_root(target, root),
        "name": _ensure_str(manifest_doc.get("name")),
        "merged_pack": merged_pack,
        "entries": entries
    }
    if errors:
        result["errors"] = errors
    
    return result


# ---------- 实现：获取所有启用主题的合并包 ----------

def get_all_enabled_themes_impl() -> Dict[str, Any]:
    """
    读取所有启用的主题，按 order 顺序合并后返回。
    顺序靠前的主题优先级更高（会覆盖后面的）。
    
    合并逻辑：
    - 按 order 逆序遍历启用的主题（先应用靠后的，再应用靠前的，这样靠前的会覆盖）
    - tokens/tokensLight/tokensDark: 逐个合并，靠前的覆盖靠后的
    - css/cssLight/cssDark: 按顺序拼接，靠前的在后面（CSS 后声明的优先级更高）
    
    返回:
      {
          "enabled_count": 2,
          "enabled_themes": ["theme-a", "theme-b"],
          "merged_pack": {
              "id": "merged",
              "name": "Merged Themes",
              "tokens": {...},
              "css": "...",
              ...
          }
      }
    """
    root = _repo_root()
    styles_dir = _styles_dir()
    
    # 读取 styles_switch.json 获取启用列表和排序
    switch_path = styles_dir / "styles_switch.json"
    enabled_list: List[str] = []
    order_list: List[str] = []
    
    if switch_path.exists() and switch_path.is_file():
        sw_doc, _ = _safe_read_json(switch_path)
        if sw_doc and isinstance(sw_doc, dict):
            raw_enabled = sw_doc.get("enabled", [])
            if isinstance(raw_enabled, list):
                enabled_list = [str(x) for x in raw_enabled if isinstance(x, (str, int))]
            raw_order = sw_doc.get("order", [])
            if isinstance(raw_order, list):
                order_list = [str(x) for x in raw_order if isinstance(x, (str, int))]
    
    if not enabled_list:
        return {
            "enabled_count": 0,
            "enabled_themes": [],
            "merged_pack": None
        }
    
    # 按 order 排序启用的主题（不在 order 中的放最后）
    enabled_set = set(enabled_list)
    sorted_enabled: List[str] = []
    for name in order_list:
        if name in enabled_set:
            sorted_enabled.append(name)
            enabled_set.discard(name)
    # 添加不在 order 中的
    for name in sorted(enabled_set):
        sorted_enabled.append(name)
    
    # 初始化合并后的主题包
    merged_pack: Dict[str, Any] = {
        "id": "merged",
        "name": "Merged Themes",
        "version": None,
        "tokens": {},
        "tokensLight": {},
        "tokensDark": {},
        "css": "",
        "cssLight": "",
        "cssDark": ""
    }
    
    # 按逆序遍历（先应用优先级低的，再应用优先级高的）
    # 这样优先级高的会覆盖优先级低的 tokens
    # 对于 CSS，优先级高的应该后面加载（CSS 后声明的优先级更高）
    css_parts: List[str] = []
    cssLight_parts: List[str] = []
    cssDark_parts: List[str] = []
    
    for theme_name in reversed(sorted_enabled):
        theme_dir = styles_dir / theme_name
        if not theme_dir.exists() or not theme_dir.is_dir():
            continue
        
        manifest_path = theme_dir / "manifest.json"
        if not manifest_path.exists():
            continue
        
        manifest_doc, _ = _safe_read_json(manifest_path)
        if not manifest_doc or not isinstance(manifest_doc, dict):
            continue
        
        entries_list = manifest_doc.get("entries", [])
        if not isinstance(entries_list, list):
            continue
        
        # 读取该主题的所有 entry 文件
        theme_tokens: Dict[str, Any] = {}
        theme_tokensLight: Dict[str, Any] = {}
        theme_tokensDark: Dict[str, Any] = {}
        theme_css = ""
        theme_cssLight = ""
        theme_cssDark = ""
        
        for entry_name in entries_list:
            if not isinstance(entry_name, str):
                continue
            entry_path = theme_dir / entry_name
            if not entry_path.exists() or not entry_path.is_file():
                continue
            entry_doc, _ = _safe_read_json(entry_path)
            if not entry_doc or not isinstance(entry_doc, dict):
                continue
            
            # 合并 tokens
            if isinstance(entry_doc.get("tokens"), dict):
                theme_tokens.update(entry_doc["tokens"])
            if isinstance(entry_doc.get("tokensLight"), dict):
                theme_tokensLight.update(entry_doc["tokensLight"])
            if isinstance(entry_doc.get("tokensDark"), dict):
                theme_tokensDark.update(entry_doc["tokensDark"])
            
            # 追加 CSS
            if isinstance(entry_doc.get("css"), str) and entry_doc["css"]:
                theme_css += entry_doc["css"] + "\n"
            if isinstance(entry_doc.get("cssLight"), str) and entry_doc["cssLight"]:
                theme_cssLight += entry_doc["cssLight"] + "\n"
            if isinstance(entry_doc.get("cssDark"), str) and entry_doc["cssDark"]:
                theme_cssDark += entry_doc["cssDark"] + "\n"
        
        # 合并到总包（逆序遍历，所以先处理优先级低的）
        merged_pack["tokens"].update(theme_tokens)
        merged_pack["tokensLight"].update(theme_tokensLight)
        merged_pack["tokensDark"].update(theme_tokensDark)
        
        # CSS 收集（稍后按正确顺序拼接）
        if theme_css.strip():
            css_parts.append(f"/* Theme: {theme_name} */\n{theme_css.strip()}")
        if theme_cssLight.strip():
            cssLight_parts.append(f"/* Theme: {theme_name} */\n{theme_cssLight.strip()}")
        if theme_cssDark.strip():
            cssDark_parts.append(f"/* Theme: {theme_name} */\n{theme_cssDark.strip()}")
    
    # CSS 需要反转顺序（优先级高的在后面）
    css_parts.reverse()
    cssLight_parts.reverse()
    cssDark_parts.reverse()
    
    merged_pack["css"] = "\n\n".join(css_parts)
    merged_pack["cssLight"] = "\n\n".join(cssLight_parts)
    merged_pack["cssDark"] = "\n\n".join(cssDark_parts)
    
    # 清理空字段
    if not merged_pack["tokens"]:
        del merged_pack["tokens"]
    if not merged_pack["tokensLight"]:
        del merged_pack["tokensLight"]
    if not merged_pack["tokensDark"]:
        del merged_pack["tokensDark"]
    if not merged_pack["css"].strip():
        del merged_pack["css"]
    if not merged_pack["cssLight"].strip():
        del merged_pack["cssLight"]
    if not merged_pack["cssDark"].strip():
        del merged_pack["cssDark"]
    
    return {
        "enabled_count": len(sorted_enabled),
        "enabled_themes": sorted_enabled,
        "merged_pack": merged_pack if merged_pack.get("tokens") or merged_pack.get("css") else None
    }


# ---------- 实现：获取主题资产 ----------

def get_theme_asset_impl(file: str) -> Dict[str, Any]:
    """
    读取 styles 目录下的任意文件（JSON/CSS/图片等），
    返回 Base64 编码内容与 MIME 类型。
    
    入参:
      - file: POSIX 相对路径，例如：
              "backend_projects/SmartTavern/styles/demo-ocean.sttheme/demo-ocean.sttheme.json"
    
    返回:
      {
          "file": "...",
          "mime": "application/json",
          "size": 12345,
          "content_base64": "eyJpZCI6Imde..."
      }
    """
    root = _repo_root()
    styles_dir = _styles_dir()
    
    if not isinstance(file, str) or not file:
        return {"error": "INVALID_INPUT", "message": "file 必须为非空字符串"}
    
    target = (root / Path(file)).resolve()
    
    if not _is_within(target, styles_dir):
        return {"error": "OUT_OF_SCOPE", "message": "仅允许读取 styles 目录下的文件"}
    
    if not target.exists() or not target.is_file():
        return {
            "error": "NOT_FOUND",
            "message": f"文件不存在: {target.as_posix()}",
            "file": _path_rel_to_root(target, root)
        }
    
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
        return {
            "error": "READ_FAILED",
            "message": f"{type(e).__name__}: {e}",
            "file": _path_rel_to_root(target, root)
        }


# ---------- 实现：删除主题 ----------

def delete_theme_impl(theme_dir: str) -> Dict[str, Any]:
    """
    删除指定的主题目录（整个 .sttheme 文件夹）。
    删除后会自动从 styles_switch.json 中移除注册。
    
    入参:
      - theme_dir: 主题目录路径（POSIX 风格）
    
    返回:
      成功: { "success": True, "deleted_path": "...", "message": "..." }
      失败: { "success": False, "error": "...", "message": "..." }
    """
    import shutil
    
    root = _repo_root()
    styles_dir = _styles_dir()
    
    if not isinstance(theme_dir, str) or not theme_dir:
        return {"success": False, "error": "INVALID_INPUT", "message": "theme_dir 必须为非空字符串"}
    
    # 规范化路径
    theme_dir_normalized = theme_dir.replace("\\", "/").strip("/")
    target = (root / Path(theme_dir_normalized)).resolve()
    
    # 安全检查
    if not _is_within(target, styles_dir):
        return {"success": False, "error": "OUT_OF_SCOPE", "message": "仅允许删除 styles 目录下的主题"}
    
    # 确保不是删除 styles 根目录
    if target.resolve() == styles_dir.resolve():
        return {"success": False, "error": "CANNOT_DELETE_ROOT", "message": "不能删除 styles 根目录"}
    
    # 确保目标存在
    if not target.exists():
        return {"success": False, "error": "NOT_FOUND", "message": f"主题目录不存在: {theme_dir}"}
    
    # 确保目标是目录
    if not target.is_dir():
        return {"success": False, "error": "NOT_A_DIRECTORY", "message": f"目标不是目录: {theme_dir}"}
    
    # 确保目录包含 manifest.json（是有效的主题目录）
    if not (target / "manifest.json").exists():
        return {"success": False, "error": "INVALID_THEME", "message": "目标目录不是有效的主题（缺少 manifest.json）"}
    
    try:
        theme_name = target.name
        
        # 删除目录
        shutil.rmtree(target)
        
        # 从 styles_switch.json 中移除
        _remove_theme_from_switch(theme_name)
        
        return {
            "success": True,
            "deleted_path": _path_rel_to_root(target, root),
            "message": f"已删除主题: {theme_name}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": "DELETE_FAILED",
            "message": f"{type(e).__name__}: {e}"
        }


def _remove_theme_from_switch(theme_name: str) -> None:
    """
    从 styles_switch.json 中移除指定主题的注册。
    会从 enabled、disabled 和 order 列表中移除。
    """
    switch_path = _styles_dir() / "styles_switch.json"
    
    if not switch_path.exists() or not switch_path.is_file():
        return
    
    try:
        doc, err = _safe_read_json(switch_path)
        if err or not isinstance(doc, dict):
            return
        
        modified = False
        
        # 从 enabled 列表移除
        enabled = doc.get("enabled", [])
        if isinstance(enabled, list) and theme_name in enabled:
            enabled.remove(theme_name)
            doc["enabled"] = enabled
            modified = True
        
        # 从 disabled 列表移除
        disabled = doc.get("disabled", [])
        if isinstance(disabled, list) and theme_name in disabled:
            disabled.remove(theme_name)
            doc["disabled"] = disabled
            modified = True
        
        # 从 order 列表移除
        order = doc.get("order", [])
        if isinstance(order, list) and theme_name in order:
            order.remove(theme_name)
            doc["order"] = order
            modified = True
        
        if modified:
            _write_json_atomic(switch_path, doc)
    except Exception:
        pass


# ---------- 实现：更新主题 manifest.json 文件 ----------

def update_theme_file_impl(theme_dir: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    更新主题目录下的 manifest.json 文件。
    仅允许修改 name 和 description 字段，其他字段保持不变。
    
    入参:
      - theme_dir: 主题目录路径（POSIX 风格）
      - payload: 包含 name 和/或 description 的字典
    
    返回:
      {
          "dir": "...",
          "file": "...",
          "name": "...|null",
          "description": "...|null",
          "manifest": {...}
      }
    """
    root = _repo_root()
    styles_dir = _styles_dir()
    
    if not isinstance(theme_dir, str) or not theme_dir:
        return {"error": "INVALID_INPUT", "message": "theme_dir 必须为非空字符串"}
    if not isinstance(payload, dict):
        return {"error": "INVALID_INPUT", "message": "payload 必须为对象"}
    
    target_dir = (root / Path(theme_dir)).resolve()
    if not _is_within(target_dir, styles_dir):
        return {"error": "OUT_OF_SCOPE", "message": "仅允许修改 styles 目录下的主题"}
    
    if not target_dir.exists() or not target_dir.is_dir():
        return {"error": "NOT_FOUND", "message": "主题目录不存在", "dir": _path_rel_to_root(target_dir, root)}
    
    manifest_path = target_dir / "manifest.json"
    if not manifest_path.exists() or not manifest_path.is_file():
        return {"error": "NOT_FOUND", "message": "manifest.json 不存在", "dir": _path_rel_to_root(target_dir, root)}
    
    # 读取现有的 manifest.json
    doc, err = _safe_read_json(manifest_path)
    if err:
        return {"error": "READ_FAILED", "message": err, "dir": _path_rel_to_root(target_dir, root), "file": _path_rel_to_root(manifest_path, root)}
    
    if not isinstance(doc, dict):
        return {"error": "INVALID_MANIFEST", "message": "manifest.json 必须是对象", "dir": _path_rel_to_root(target_dir, root), "file": _path_rel_to_root(manifest_path, root)}
    
    # 仅更新 name 和 description 字段
    name = payload.get("name", None)
    desc = payload.get("description", None)
    
    if name is not None:
        doc["name"] = name
    if desc is not None:
        doc["description"] = desc
    
    # 写回文件
    write_err = _write_json_atomic(manifest_path, doc)
    if write_err:
        return {"error": "WRITE_FAILED", "message": write_err, "dir": _path_rel_to_root(target_dir, root), "file": _path_rel_to_root(manifest_path, root)}
    
    # 返回更新后的内容
    out_name = _ensure_str(doc.get("name"))
    out_desc = _ensure_str(doc.get("description"))
    
    return {
        "dir": _path_rel_to_root(target_dir, root),
        "file": _path_rel_to_root(manifest_path, root),
        "name": out_name,
        "description": out_desc,
        "manifest": doc,
    }


# ---------- 实现：计算文件 MD5 哈希 ----------

def _compute_file_hash(file_path: Path) -> Optional[str]:
    """
    计算文件的 MD5 哈希值。
    返回 32 位小写十六进制字符串，或 None（如果文件不存在或无法读取）。
    """
    if not file_path.exists() or not file_path.is_file():
        return None
    try:
        md5 = hashlib.md5()
        with file_path.open("rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                md5.update(chunk)
        return md5.hexdigest()
    except Exception:
        return None


# ---------- 实现：获取页面背景图片哈希 ----------

def get_page_backgrounds_hash_impl(orientation: Optional[str] = None) -> Dict[str, Any]:
    """
    获取所有页面背景图片的 MD5 哈希值，用于前端缓存验证。
    
    入参:
      - orientation: 方向，可选值为 "landscape"（横版）、"portrait"（竖版）或 None（两者都返回）
    
    返回:
      {
          "landscape": {
              "HomePage": "abc123...",
              "ThreadedChat": "def456...",
              "SandboxChat": "ghi789..."
          },
          "portrait": {
              "HomePage": "xyz111...",
              "ThreadedChat": "xyz222...",
              "SandboxChat": "xyz333..."
          },
          "combined_hash": "md5_of_all_hashes"  # 可用于快速验证是否有任何变化
      }
    """
    root = _repo_root()
    images_dir = _pages_images_dir()
    
    result: Dict[str, Any] = {}
    all_hashes: List[str] = []
    
    page_names = ["HomePage", "ThreadedChat", "SandboxChat"]
    orientations_to_check = []
    
    if orientation == "landscape":
        orientations_to_check = ["landscape"]
    elif orientation == "portrait":
        orientations_to_check = ["portrait"]
    else:
        orientations_to_check = ["landscape", "portrait"]
    
    for orient in orientations_to_check:
        orient_dir = images_dir / orient
        orient_hashes: Dict[str, Optional[str]] = {}
        
        for page_name in page_names:
            # 尝试多种扩展名
            file_hash = None
            for ext in [".png", ".jpg", ".jpeg", ".webp"]:
                file_path = orient_dir / f"{page_name}{ext}"
                if file_path.exists() and file_path.is_file():
                    file_hash = _compute_file_hash(file_path)
                    break
            
            orient_hashes[page_name] = file_hash
            if file_hash:
                all_hashes.append(file_hash)
        
        result[orient] = orient_hashes
    
    # 计算综合哈希（用于快速验证是否有任何变化）
    if all_hashes:
        combined = "".join(sorted(all_hashes))
        result["combined_hash"] = hashlib.md5(combined.encode()).hexdigest()
    else:
        result["combined_hash"] = None
    
    return result


# ---------- 实现：获取页面背景图片 ----------

def get_page_background_impl(page: str, orientation: str = "landscape") -> Dict[str, Any]:
    """
    获取指定页面的背景图片。
    
    入参:
      - page: 页面名称，可选值为 "HomePage"、"ThreadedChat"、"SandboxChat"
      - orientation: 方向，可选值为 "landscape"（横版）或 "portrait"（竖版）
    
    返回:
      {
          "page": "HomePage",
          "orientation": "landscape",
          "file": "backend_projects/SmartTavern/pages_images/landscape/HomePage.png",
          "hash": "abc123...",
          "mime": "image/png",
          "size": 123456,
          "content_base64": "iVBORw0KGgo..."
      }
    """
    root = _repo_root()
    images_dir = _pages_images_dir()
    
    # 验证页面名称
    valid_pages = ["HomePage", "ThreadedChat", "SandboxChat"]
    if page not in valid_pages:
        return {
            "error": "INVALID_PAGE",
            "message": f"无效的页面名称: {page}。有效值: {', '.join(valid_pages)}"
        }
    
    # 验证方向
    valid_orientations = ["landscape", "portrait"]
    if orientation not in valid_orientations:
        return {
            "error": "INVALID_ORIENTATION",
            "message": f"无效的方向: {orientation}。有效值: {', '.join(valid_orientations)}"
        }
    
    # 查找图片文件
    target_file: Optional[Path] = None
    orient_dir = images_dir / orientation
    
    # 在指定方向目录查找
    for ext in [".png", ".jpg", ".jpeg", ".webp"]:
        file_path = orient_dir / f"{page}{ext}"
        if file_path.exists() and file_path.is_file():
            target_file = file_path
            break
    
    if target_file is None:
        return {
            "error": "NOT_FOUND",
            "message": f"找不到页面 {page} 的背景图片（方向: {orientation}）",
            "page": page,
            "orientation": orientation
        }
    
    # 读取文件并计算哈希
    try:
        data = target_file.read_bytes()
        file_hash = hashlib.md5(data).hexdigest()
        mime, _ = mimetypes.guess_type(target_file.name)
        b64 = base64.b64encode(data).decode("ascii")
        
        return {
            "page": page,
            "orientation": orientation,
            "file": _path_rel_to_root(target_file, root),
            "hash": file_hash,
            "mime": mime or "application/octet-stream",
            "size": len(data),
            "content_base64": b64
        }
    except Exception as e:
        return {
            "error": "READ_FAILED",
            "message": f"{type(e).__name__}: {e}",
            "page": page,
            "orientation": orientation
        }


# ---------- 实现：列出所有可用的背景图片 ----------

def list_page_backgrounds_impl() -> Dict[str, Any]:
    """
    列出所有可用的页面背景图片及其元信息。
    
    返回:
      {
          "images_dir": "backend_projects/SmartTavern/pages_images",
          "landscape": {
              "HomePage": { "file": "...", "hash": "...", "size": 123456 },
              ...
          },
          "portrait": {
              "HomePage": { "file": "...", "hash": "...", "size": 123456 },
              ...
          }
      }
    """
    root = _repo_root()
    images_dir = _pages_images_dir()
    
    result: Dict[str, Any] = {
        "images_dir": _path_rel_to_root(images_dir, root),
        "landscape": {},
        "portrait": {}
    }
    
    page_names = ["HomePage", "ThreadedChat", "SandboxChat"]
    
    for orient in ["landscape", "portrait"]:
        orient_dir = images_dir / orient
        
        for page_name in page_names:
            file_info: Optional[Dict[str, Any]] = None
            
            # 在指定方向目录查找
            for ext in [".png", ".jpg", ".jpeg", ".webp"]:
                file_path = orient_dir / f"{page_name}{ext}"
                if file_path.exists() and file_path.is_file():
                    file_hash = _compute_file_hash(file_path)
                    try:
                        file_size = file_path.stat().st_size
                    except Exception:
                        file_size = 0
                    
                    file_info = {
                        "file": _path_rel_to_root(file_path, root),
                        "hash": file_hash,
                        "size": file_size
                    }
                    break
            
            result[orient][page_name] = file_info
    
    return result


# ---------- 实现：上传/更新背景图片 ----------

def upload_page_background_impl(
    page: str,
    orientation: str,
    image_base64: str
) -> Dict[str, Any]:
    """
    上传/更新指定页面的背景图片。
    
    入参:
      - page: 页面名称，可选值为 "HomePage"、"ThreadedChat"、"SandboxChat"
      - orientation: 方向，可选值为 "landscape"（横版）或 "portrait"（竖版）
      - image_base64: Base64 编码的图片内容
    
    返回:
      {
          "success": true,
          "page": "HomePage",
          "orientation": "landscape",
          "file": "backend_projects/SmartTavern/pages_images/landscape/HomePage.png",
          "hash": "abc123...",
          "size": 123456,
          "message": "Background uploaded successfully"
      }
    """
    root = _repo_root()
    images_dir = _pages_images_dir()
    
    # 验证页面名称
    valid_pages = ["HomePage", "ThreadedChat", "SandboxChat"]
    if page not in valid_pages:
        return {
            "success": False,
            "error": "INVALID_PAGE",
            "message": f"无效的页面名称: {page}。有效值: {', '.join(valid_pages)}"
        }
    
    # 验证方向
    valid_orientations = ["landscape", "portrait"]
    if orientation not in valid_orientations:
        return {
            "success": False,
            "error": "INVALID_ORIENTATION",
            "message": f"无效的方向: {orientation}。有效值: {', '.join(valid_orientations)}"
        }
    
    # 验证 Base64 内容
    if not image_base64 or not isinstance(image_base64, str):
        return {
            "success": False,
            "error": "INVALID_INPUT",
            "message": "image_base64 必须为非空字符串"
        }
    
    try:
        # 解码 Base64
        image_data = base64.b64decode(image_base64)
        if len(image_data) == 0:
            return {
                "success": False,
                "error": "INVALID_INPUT",
                "message": "图片内容为空"
            }
        
        # 检测图片格式（通过文件头）
        ext = ".png"  # 默认
        if image_data[:8] == b'\x89PNG\r\n\x1a\n':
            ext = ".png"
        elif image_data[:3] == b'\xff\xd8\xff':
            ext = ".jpg"
        elif image_data[:4] == b'RIFF' and image_data[8:12] == b'WEBP':
            ext = ".webp"
        
        # 目标目录
        orient_dir = images_dir / orientation
        orient_dir.mkdir(parents=True, exist_ok=True)
        
        # 删除旧文件（如果存在不同扩展名的）
        for old_ext in [".png", ".jpg", ".jpeg", ".webp"]:
            old_file = orient_dir / f"{page}{old_ext}"
            if old_file.exists() and old_ext != ext:
                try:
                    old_file.unlink()
                except Exception:
                    pass  # 忽略删除失败的错误
        
        # 写入新文件
        target_file = orient_dir / f"{page}{ext}"
        target_file.write_bytes(image_data)
        
        # 计算哈希
        file_hash = hashlib.md5(image_data).hexdigest()
        
        return {
            "success": True,
            "page": page,
            "orientation": orientation,
            "file": _path_rel_to_root(target_file, root),
            "hash": file_hash,
            "size": len(image_data),
            "message": f"背景图片已成功上传: {page} ({orientation})"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": "UPLOAD_FAILED",
            "message": f"{type(e).__name__}: {e}",
            "page": page,
            "orientation": orientation
        }