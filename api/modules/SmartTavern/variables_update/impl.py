# -*- coding: utf-8 -*-
"""
SmartTavern.variables_update 实现层

功能：
- 提供“变量 JSON 深度合并（覆盖更新）”能力
- 典型输入结构参考：
  backend_projects/SmartTavern/data/conversations/branch_demo/variables.json
  {
    "variables": {...},
    "stat_overrides": {
      "全局": {...},
      "角色名": {...}
    }
  }

合并规则（深度覆盖）：
- 字典：按键递归合并；overlay 的键覆盖/新增 base
- 数组：
  - replace（默认）：直接用 overlay 替换 base
  - concat：拼接 base + overlay
  - union：集合并去重（基于 JSON 序列化字符串对比）
- 标量（含 None/str/number/bool）：overlay 覆盖 base

注意：
- 不修改传入对象，返回全新对象
- 容错：遇到类型不匹配时，overlay 直接覆盖 base
"""
from __future__ import annotations

from typing import Any, Dict, List, Tuple, Union, Optional
import copy
import json


_ArrayStrategy = str  # "replace" | "concat" | "union"


def _as_json_key(v: Any) -> str:
    """将任意值规范为比较用的 JSON 字符串（用于 union 去重）"""
    try:
        return json.dumps(v, ensure_ascii=False, sort_keys=True)
    except Exception:
        return str(v)


def _get_by_path_value(obj: Any, path: Optional[str]) -> Any:
    """从对象中按点/方括号路径读取值；失败返回 None"""
    if path is None or path == "":
        return None
    toks = _parse_path(path)
    cur = obj
    try:
        for t in toks:
            if isinstance(t, int):
                if not isinstance(cur, list) or t < 0 or t >= len(cur):
                    return None
                cur = cur[t]
            else:
                if not isinstance(cur, dict) or t not in cur:
                    return None
                cur = cur[t]
        return cur
    except Exception:
        return None

def _merge_arrays(a: List[Any], b: List[Any], strategy: _ArrayStrategy = "replace", array_key: Optional[str] = None) -> List[Any]:
    s = (strategy or "replace").lower()
    if s == "concat":
        return list(a or []) + list(b or [])
    if s == "prepend":
        return list(b or []) + list(a or [])
    if s == "union_by_key":
        out: List[Any] = []
        seen = set()
        # 遍历 a+b，按 array_key 提取键，进行去重
        for item in list(a or []) + list(b or []):
            key_val = None
            if isinstance(item, dict):
                key_val = _get_by_path_value(item, array_key)
            k = _as_json_key(key_val if key_val is not None else item)
            if k in seen:
                continue
            seen.add(k)
            out.append(item)
        return out
    if s == "union":
        out: List[Any] = []
        seen = set()
        for item in list(a or []) + list(b or []):
            k = _as_json_key(item)
            if k in seen:
                continue
            seen.add(k)
            out.append(item)
        return out
    # default replace
    return list(b or [])


def deep_merge(base: Any, overlay: Any, array_strategy: _ArrayStrategy = "replace", array_key: Optional[str] = None) -> Any:
    """
    深度合并：不修改 base/overlay，返回新对象
    """
    # 类型完全相同的快速路径
    if isinstance(base, dict) and isinstance(overlay, dict):
        res: Dict[str, Any] = {}
        # 先复制 base
        for k, v in (base or {}).items():
            res[k] = copy.deepcopy(v)
        # 应用 overlay
        for k, v in (overlay or {}).items():
            if k in res:
                res[k] = deep_merge(res[k], v, array_strategy=array_strategy)
            else:
                res[k] = copy.deepcopy(v)
        return res

    if isinstance(base, list) and isinstance(overlay, list):
        return _merge_arrays(list(base), list(overlay), strategy=array_strategy, array_key=array_key)

    # 类型不一致或标量 → 直接覆盖
    return copy.deepcopy(overlay)


def merge_variables_document(
    base_document: Dict[str, Any],
    overrides: Dict[str, Any],
    options: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    将 overrides 深度覆盖到 base_document，返回合并后的完整变量 JSON。

    Args:
        base_document: 原始变量 JSON 文档（通常包含 "variables" 与 "stat_overrides"）
        overrides:     覆盖更新 JSON（结构与字段任意，按深度覆盖规则处理）
        options:       可选项：
                       - array_strategy: "replace" | "concat" | "union"，默认 "replace"
    Returns:
        merged: 合并后的完整 JSON 文档
    """
    opts = dict(options or {})
    array_strategy = str(opts.get("array_strategy", "replace")).lower()
    if array_strategy not in ("replace", "concat", "union", "prepend", "union_by_key"):
        array_strategy = "replace"
    array_key = opts.get("array_key")

    base_doc = base_document if isinstance(base_document, dict) else {}
    ov = overrides if isinstance(overrides, dict) else {}

    merged = deep_merge(base_doc, ov, array_strategy=array_strategy, array_key=array_key)
    # 保障顶层类型为对象
    if not isinstance(merged, dict):
        merged = {"value": merged}
    return merged

# ===== 新增：常用操作策略封装 =====

from typing import List as _List, Union as _Union

_PathToken = _Union[str, int]

def _parse_path(path: str) -> _List[_PathToken]:
    s = str(path or "")
    tokens: _List[_PathToken] = []
    i, n = 0, len(s)
    buf: _List[str] = []
    def flush_buf():
        nonlocal buf
        if buf:
            tokens.append("".join(buf))
            buf = []
    while i < n:
        ch = s[i]
        if ch == ".":
            flush_buf(); i += 1; continue
        if ch == "[":
            flush_buf(); i += 1
            if i < n and s[i] in ("'", '"'):
                q = s[i]; i += 1
                qb: _List[str] = []
                while i < n and s[i] != q:
                    qb.append(s[i]); i += 1
                if i < n and s[i] == q: i += 1
                while i < n and s[i] != "]": i += 1
                if i < n and s[i] == "]": i += 1
                tokens.append("".join(qb))
            else:
                nb: _List[str] = []
                while i < n and s[i] != "]":
                    nb.append(s[i]); i += 1
                if i < n and s[i] == "]": i += 1
                raw = "".join(nb).strip()
                if raw.isdigit() or (raw.startswith("-") and raw[1:].isdigit()):
                    try:
                        tokens.append(int(raw))
                    except Exception:
                        tokens.append(raw)
                else:
                    tokens.append(raw)
            continue
        buf.append(ch); i += 1
    flush_buf()
    return [t for t in tokens if t != "" and t is not None]

def _delete_by_path(doc: Dict[str, Any], path: str) -> None:
    toks = _parse_path(path)
    if not toks:
        return
    cur: Any = doc
    for idx, t in enumerate(toks):
        last = (idx == len(toks) - 1)
        if last:
            try:
                if isinstance(t, int) and isinstance(cur, list) and 0 <= t < len(cur):
                    cur.pop(t)
                elif isinstance(t, str) and isinstance(cur, dict) and t in cur:
                    cur.pop(t, None)
            except Exception:
                pass
            return
        else:
            if isinstance(t, int):
                if not (isinstance(cur, list) and 0 <= t < len(cur)):
                    return
                cur = cur[t]
            else:
                if not (isinstance(cur, dict) and t in cur):
                    return
                cur = cur[t]

def _delete_many(doc: Dict[str, Any], paths: _List[str]) -> None:
    if not isinstance(paths, list):
        return
    for p in paths:
        if not isinstance(p, (str, int)):
            continue
        _delete_by_path(doc, str(p))

def shallow_merge_documents(base_document: Dict[str, Any], overrides: Dict[str, Any]) -> Dict[str, Any]:
    res: Dict[str, Any] = {}
    if isinstance(base_document, dict):
        for k, v in base_document.items():
            res[k] = copy.deepcopy(v)
    if isinstance(overrides, dict):
        for k, v in overrides.items():
            res[k] = copy.deepcopy(v)
    return res

def apply_operation(
    base_document: Dict[str, Any],
    overrides: Dict[str, Any],
    operation: str = "merge",
    options: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    常用操作策略：
      - replace: 直接返回 overrides
      - shallow_merge: 顶层浅合并（dict.update）
      - merge/deep_merge: 深度合并（数组策略可选 replace|concat|union）
      - append: 深度合并 + 数组使用 concat
      - union: 深度合并 + 数组使用 union
      - remove: 在以上策略基础上，按 options.remove_paths 删除指定路径（点/方括号）
    """
    op = str(operation or "merge").lower()
    opts = dict(options or {})
    remove_paths = opts.get("remove_paths")  # list[str]
    array_strategy = str(opts.get("array_strategy", "replace")).lower()

    if op == "replace":
        result = copy.deepcopy(overrides if isinstance(overrides, dict) else (overrides or {}))
        if not isinstance(result, dict):
            result = {"value": result}
    elif op in ("shallow_merge", "shallow"):
        result = shallow_merge_documents(
            base_document if isinstance(base_document, dict) else {},
            overrides if isinstance(overrides, dict) else {},
        )
    elif op in ("append", "concat"):
        result = deep_merge(
            base_document if isinstance(base_document, dict) else {},
            overrides if isinstance(overrides, dict) else {},
            array_strategy="concat",
            array_key=opts.get("array_key"),
        )
    elif op in ("union", "union_all"):
        result = deep_merge(
            base_document if isinstance(base_document, dict) else {},
            overrides if isinstance(overrides, dict) else {},
            array_strategy="union",
            array_key=opts.get("array_key"),
        )
    else:
        if array_strategy not in ("replace", "concat", "union", "prepend", "union_by_key"):
            array_strategy = "replace"
        result = deep_merge(
            base_document if isinstance(base_document, dict) else {},
            overrides if isinstance(overrides, dict) else {},
            array_strategy=array_strategy,
            array_key=opts.get("array_key"),
        )

    if isinstance(result, dict) and isinstance(remove_paths, list) and remove_paths:
        _delete_many(result, remove_paths)

    if not isinstance(result, dict):
        result = {"value": result}
    return result