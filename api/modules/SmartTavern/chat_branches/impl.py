# -*- coding: utf-8 -*-
"""
SmartTavern.chat_branches 实现层（无状态版）

职责（只处理"单个对话文件"的派生视图计算，不管理会话/对话状态）：
- openai_messages_from_doc(doc): 由最小分支树文件导出 OpenAI Chat messages
- branch_table_from_doc(doc): 由最小分支树文件计算分支情况表（包含每层 j/n 与 latest）

最小分支树文件格式（仅四个字段）：
{
  "roots": ["node_id1", "node_id2", ...],  // 所有根节点ID数组
  "nodes": {
    "node_id": { "pid": "parent_id|null", "role": "system|user|assistant", "content": "..." },
    ...
  },
  "children": { "parent_id": ["child_id1","child_id2",...] },   // 可选；若缺省将由 nodes[*].pid 推导
  "active_path": ["current_root", "...", "leafId"]              // 第一个元素是当前使用的根节点
}
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
import json
import re


# ---------- 文件读取工具 ----------

def _repo_root() -> Path:
    """返回仓库根目录（基于当前文件层级向上回溯）"""
    return Path(__file__).resolve().parents[4]


def _safe_read_json(p: Path) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """安全读取 JSON 文件，返回 (doc, error)"""
    try:
        with p.open("r", encoding="utf-8") as f:
            return json.load(f), None
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"


def _is_within(child: Path, parent: Path) -> bool:
    """检查 child 是否在 parent 目录范围内"""
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except Exception:
        return False


def _load_doc_from_file_or_obj(
    doc: Optional[Dict[str, Any]] = None,
    file: Optional[str] = None
) -> Dict[str, Any]:
    """
    二选一加载对话文件（深拷贝以避免副作用）：
    - 若 doc 非空，深拷贝后返回
    - 若 file 非空，从 conversations 目录读取 JSON
    - 若都为空或读取失败，抛出 ValueError
    """
    import copy
    
    if doc is not None:
        if not isinstance(doc, dict):
            raise ValueError("doc must be a dictionary")
        return copy.deepcopy(doc)
    
    if file is not None and isinstance(file, str) and file.strip():
        root = _repo_root()
        conversations_dir = root / "backend_projects" / "SmartTavern" / "data" / "conversations"
        target = (root / Path(file)).resolve()
        
        if not _is_within(target, conversations_dir):
            raise ValueError(f"File must be within conversations directory: {file}")
        
        loaded_doc, err = _safe_read_json(target)
        if err:
            raise ValueError(f"Failed to read file {file}: {err}")
        
        if not isinstance(loaded_doc, dict):
            raise ValueError(f"File content must be a JSON object: {file}")
        
        return loaded_doc
    
    raise ValueError("Either 'doc' or 'file' must be provided")


def _buckets_from_doc(doc: Dict[str, Any]) -> Dict[str, List[str]]:
    """
    由 children 与 nodes[*].pid 构建 parent->children 桶。
    - 优先采用 doc.children 的显式顺序
    - 补全 nodes[*].pid 所隐含但未在 children 给出的边
    """
    nodes_doc = (doc.get("nodes") or {})
    children_doc = (doc.get("children") or {})
    buckets: Dict[str, List[str]] = {}

    # 显式 children
    for pid, arr in (children_doc or {}).items():
        if isinstance(arr, list):
            buckets[pid] = [cid for cid in arr if cid in nodes_doc]

    # 根据 pid 隐式补全
    for nid, nd in (nodes_doc or {}).items():
        pid = (nd or {}).get("pid")
        if pid is not None:
            buckets.setdefault(pid, [])
            if nid not in buckets[pid]:
                buckets[pid].append(nid)
    return buckets


def _normalize_path_from_doc(doc: Dict[str, Any]) -> List[str]:
    """
    规范化 active_path，确保从当前根节点连通。
    规则：
      - active_path[0] 是当前使用的根节点
      - 若 active_path 缺省，则从 roots[0] 开始
      - 自左向右逐步验证连通，遇到不连通则截断
    """
    roots = doc.get("roots") or []
    nodes_doc = (doc.get("nodes") or {})
    active_path = list(doc.get("active_path") or [])
    
    # 确定当前根节点
    if active_path and active_path[0] in nodes_doc:
        current_root = active_path[0]
    elif roots and roots[0] in nodes_doc:
        current_root = roots[0]
        active_path = [current_root]
    else:
        raise ValueError("invalid doc: no valid root found in roots or active_path")
    
    # 验证当前根节点是否在 roots 中
    if roots and current_root not in roots:
        raise ValueError(f"active_path root '{current_root}' not in roots array")
    
    buckets = _buckets_from_doc(doc)
    norm: List[str] = [current_root]
    
    for i in range(1, len(active_path)):
        prev = norm[-1]
        nxt = active_path[i]
        if nxt in set(buckets.get(prev, [])):
            norm.append(nxt)
        else:
            break
    return norm


def _compute_latest_with_branch_indexes(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    计算并返回最新节点（latest）信息及其 j/n：
      {
        "active_path": [ ... ],
        "latest": {
          "depth": number,
          "node_id": string,
          "role": string,
          "content": string,
          "j": number|null,
          "n": number|null
        }
      }
    说明：
      - 根节点用 roots 计算 j/n
      - 其他节点用父节点 children 顺序计算 j/n
    """
    path = _normalize_path_from_doc(doc)
    nodes_doc = (doc.get("nodes") or {})
    roots = (doc.get("roots") or [])
    buckets = _buckets_from_doc(doc)

    depth = len(path)
    latest_id = path[-1] if depth >= 1 else None
    latest_node = (nodes_doc.get(latest_id) or {}) if latest_id else {}

    j_val: Optional[int] = None
    n_val: Optional[int] = None

    if depth == 1 and latest_id is not None:
        n_val = len(roots)
        j_val = (roots.index(latest_id) + 1) if latest_id in roots else None
    elif depth >= 2:
        parent_id = path[-2]
        siblings = buckets.get(parent_id, [])
        n_val = len(siblings)
        j_val = (siblings.index(latest_id) + 1) if latest_id in siblings else None

    return {
        "active_path": path,
        "latest": {
            "depth": depth,
            "node_id": latest_id,
            "j": j_val,
            "n": n_val,
        }
    }

def openai_messages_from_doc(
    doc: Optional[Dict[str, Any]] = None,
    file: Optional[str] = None
) -> Dict[str, Any]:
    """
    从最小分支树文件导出 OpenAI Chat messages。
    
    参数（二选一）：
    - doc: 最小分支树 JSON 对象
    - file: 对话文件路径（相对仓库根，如 "backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json"）
    
    返回：
      {
        "messages": [{ "role": "system|user|assistant", "content": "..." }, ...],
        "path": ["node_id", ...]
      }
    
    注意：会自动过滤重试占位节点（节点ID包含'retry'且内容为空的助手消息）
    """
    loaded_doc = _load_doc_from_file_or_obj(doc, file)
    nodes_doc = (loaded_doc.get("nodes") or {})
    path = _normalize_path_from_doc(loaded_doc)
    messages: List[Dict[str, str]] = []
    # 仅当“最后一个节点”是空的 retry/append 助手占位时，过滤该最后节点
    last_id = path[-1] if path else None
    last_node = (nodes_doc.get(last_id) or {}) if last_id else {}
    last_role = last_node.get("role") or "system"
    last_content = (last_node.get("content") or "")
    last_is_placeholder = bool(
        last_id
        and last_role == "assistant"
        and (last_content.strip() == "")
        and (("retry" in last_id.lower()) or ("append" in last_id.lower()))
    )
    for idx, nid in enumerate(path):
        if last_is_placeholder and idx == len(path) - 1:
            continue
        nd = (nodes_doc.get(nid) or {})
        role = nd.get("role") or "system"
        content = (nd.get("content") or "")
        if role in ("system", "user", "assistant"):
            messages.append({"role": role, "content": content})
    return {"messages": messages, "path": path}


def branch_table_from_doc(
    doc: Optional[Dict[str, Any]] = None,
    file: Optional[str] = None
) -> Dict[str, Any]:
    """
    由最小分支树文件计算分支情况表。
    
    参数（二选一）：
    - doc: 最小分支树 JSON 对象
    - file: 对话文件路径（相对仓库根，如 "backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json"）
    
    返回：
      {
        "latest": { "depth": number, "j": number|null, "n": number|null, "node_id": "..." },
        "levels": [
          { "depth": number, "node_id": "...", "j": number|null, "n": number|null },
          ...
        ]
      }
    说明：
      - j/n 来自父节点 children 顺序位置（1-based）；若不可判定则为 null
      - depth=1 时表示根节点，j/n 来自 roots 数组中的位置
    """
    loaded_doc = _load_doc_from_file_or_obj(doc, file)
    path = _normalize_path_from_doc(loaded_doc)
    buckets = _buckets_from_doc(loaded_doc)
    roots = loaded_doc.get("roots") or []
    
    L = len(path)
    latest = {"depth": L, "j": None, "n": None, "node_id": path[-1] if L >= 1 else None}
    levels: List[Dict[str, Any]] = []
    
    # 从 depth=1 开始（包括根节点）
    for depth in range(1, L + 1):
        if depth == 1:
            # 根节点：从 roots 数组中查找当前根的位置
            current_root = path[0]
            n = len(roots)
            j = (roots.index(current_root) + 1) if current_root in roots else None
            row = {"depth": 1, "node_id": current_root, "j": j, "n": n}
            levels.append(row)
            if depth == L:
                latest.update({"j": j, "n": n})
        else:
            parent_id = path[depth - 2]
            child_id = path[depth - 1]
            children = buckets.get(parent_id, [])
            n = len(children)
            j = (children.index(child_id) + 1) if child_id in children else None
            row = {"depth": depth, "node_id": child_id, "j": j, "n": n}
            levels.append(row)
            if depth == L:
                latest.update({"j": j, "n": n})
    
    return {"latest": latest, "levels": levels}


def get_latest_message_from_doc(
    doc: Optional[Dict[str, Any]] = None,
    file: Optional[str] = None
) -> Dict[str, Any]:
    """
    根据 active_path 提取最后一条消息。
    
    参数（二选一）：
    - doc: 最小分支树 JSON 对象
    - file: 对话文件路径（相对仓库根，如 "backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json"）
    
    返回：
      {
        "node_id": "...",
        "role": "system|user|assistant",
        "content": "...",
        "depth": number
      }
    
    若 active_path 为空或无效，返回 root 节点。
    """
    loaded_doc = _load_doc_from_file_or_obj(doc, file)
    nodes_doc = (loaded_doc.get("nodes") or {})
    path = _normalize_path_from_doc(loaded_doc)
    
    if not path:
        raise ValueError("No valid path found in document")
    
    latest_node_id = path[-1]
    latest_node = (nodes_doc.get(latest_node_id) or {})
    
    return {
        "node_id": latest_node_id,
        "role": latest_node.get("role") or "system",
        "content": latest_node.get("content") or "",
        "depth": len(path)
    }


def _update_timestamp(doc: Dict[str, Any]) -> str:
    """更新并返回 ISO 8601 时间戳（UTC+8）"""
    from datetime import datetime, timezone, timedelta
    tz_cn = timezone(timedelta(hours=8))
    ts = datetime.now(tz_cn).isoformat(timespec='seconds')
    doc["updated_at"] = ts
    return ts


def _get_node_timestamp() -> str:
    """生成节点时间戳（UTC+8），与 updated_at 格式一致"""
    from datetime import datetime, timezone, timedelta
    tz_cn = timezone(timedelta(hours=8))
    return datetime.now(tz_cn).isoformat(timespec='seconds')


def update_message_content(
    node_id: str,
    content: str,
    doc: Optional[Dict[str, Any]] = None,
    file: Optional[str] = None,
    return_mode: str = "doc",
) -> Dict[str, Any]:
    """
    修改某个节点的 content。
    
    参数：
    - node_id: 要修改的节点 ID
    - content: 新的内容
    - doc/file: 二选一输入
    
    返回：
      更新后的完整 doc（含 updated_at）
      
    注意：当传入 file 参数时，会自动保存更新后的文档到文件
    """
    loaded_doc = _load_doc_from_file_or_obj(doc, file)
    nodes = loaded_doc.get("nodes") or {}
    
    if node_id not in nodes:
        raise ValueError(f"Node not found: {node_id}")
    
    nodes[node_id]["content"] = content
    nodes[node_id]["node_updated_at"] = _get_node_timestamp()
    ts = _update_timestamp(loaded_doc)
    
    # 如果传入了 file 参数，保存更新后的文档到文件
    if file is not None and isinstance(file, str) and file.strip():
        root = _repo_root()
        conversations_dir = root / "backend_projects" / "SmartTavern" / "data" / "conversations"
        target = (root / Path(file)).resolve()
        
        if not _is_within(target, conversations_dir):
            raise ValueError(f"File must be within conversations directory: {file}")
        
        _safe_write_json(target, loaded_doc)

    # 返回结果根据 return_mode 精简
    mode = str(return_mode or "doc").lower()
    if mode == "node":
        # 仅返回被更新的节点信息与时间戳
        try:
            node = dict(loaded_doc.get("nodes", {}).get(node_id) or {})
        except Exception:
            node = {"node_id": node_id, "content": content}
        node.setdefault("node_id", node_id)
        # 确保包含 node_updated_at
        if "node_updated_at" not in node:
            node["node_updated_at"] = nodes[node_id].get("node_updated_at")
        return {"success": True, "node": node, "updated_at": loaded_doc.get("updated_at", ts)}
    if mode == "none":
        # 仅返回成功标识与时间戳/节点 id，包含 node_updated_at
        return {
            "success": True,
            "node_id": node_id,
            "node_updated_at": nodes[node_id].get("node_updated_at"),
            "updated_at": loaded_doc.get("updated_at", ts)
        }

    # 默认保持向后兼容：返回完整 doc
    return loaded_doc


def truncate_after_node(
    node_id: str,
    doc: Optional[Dict[str, Any]] = None,
    file: Optional[str] = None
) -> Dict[str, Any]:
    """
    修剪：删除指定节点及其所有子孙。
    
    参数：
    - node_id: 要删除的节点（包括其本身及所有子孙）
    - doc/file: 二选一输入
    
    返回：
      更新后的完整 doc（nodes 删除节点及子树，children 清理，active_path 截断到父节点，updated_at 更新）
    
    说明：
    - 级联删除：删除 node_id 本身及其所有子孙节点
    - active_path 截断：若 node_id 在 active_path 中，截断到其父节点；否则不变
    - children 清理：从父节点的 children 中移除 node_id，并清理所有被删节点的 children 条目
    """
    loaded_doc = _load_doc_from_file_or_obj(doc, file)
    nodes = loaded_doc.get("nodes") or {}
    children_map = loaded_doc.get("children") or {}
    active_path = list(loaded_doc.get("active_path") or [])
    
    if node_id not in nodes:
        raise ValueError(f"Node not found: {node_id}")
    
    # 获取父节点ID（用于后续 active_path 截断和 children 清理）
    parent_id = nodes[node_id].get("pid")
    
    # 递归收集所有要删除的节点：node_id 本身 + 所有子孙
    to_delete = set([node_id])  # 包含节点本身
    stack = list(children_map.get(node_id, []))
    
    while stack:
        current = stack.pop()
        if current in to_delete:
            continue
        to_delete.add(current)
        # 将当前节点的子节点加入栈
        for child in (children_map.get(current) or []):
            if child not in to_delete:
                stack.append(child)
    
    # 删除所有收集到的节点
    for nid in to_delete:
        nodes.pop(nid, None)
    
    # 清理 children_map：删除被删节点的条目
    for nid in to_delete:
        children_map.pop(nid, None)
    
    # 从其他节点的 children 中移除被删节点的引用
    for pid in list(children_map.keys()):
        children_map[pid] = [cid for cid in children_map[pid] if cid not in to_delete]
        if not children_map[pid]:
            children_map.pop(pid, None)
    
    # 清理 active_path：移除所有被删除的节点（包括 node_id 及其所有子孙）
    # 由于 active_path 是一条路径，如果父节点被删除，其子孙必然也在后面
    # 所以只需找到第一个被删除节点的位置并截断即可
    if active_path:
        # 找到第一个被删除节点在 active_path 中的位置
        first_deleted_idx = None
        for i, nid in enumerate(active_path):
            if nid in to_delete:
                first_deleted_idx = i
                break
        
        # 截断到第一个被删除节点之前
        if first_deleted_idx is not None:
            active_path = active_path[:first_deleted_idx]
    
    loaded_doc["nodes"] = nodes
    loaded_doc["children"] = children_map
    loaded_doc["active_path"] = active_path
    _update_timestamp(loaded_doc)
    
    # 如果传入了 file 参数，保存更新后的文档到文件
    if file is not None and isinstance(file, str) and file.strip():
        root = _repo_root()
        conversations_dir = root / "backend_projects" / "SmartTavern" / "data" / "conversations"
        target = (root / Path(file)).resolve()
        
        if not _is_within(target, conversations_dir):
            raise ValueError(f"File must be within conversations directory: {file}")
        
        _safe_write_json(target, loaded_doc)
    
    return loaded_doc


def switch_branch_impl(
    target_j: int,
    doc: Optional[Dict[str, Any]] = None,
    file: Optional[str] = None,
    return_mode: str = "doc",
) -> Dict[str, Any]:
    """
    切换当前 active_path 最后节点的分支。
    
    参数：
    - target_j: 目标分支序号（1-based，相邻切换：当前j±1）
    - doc/file: 二选一输入
    
    返回：
      {
        "doc": 更新后的完整文档（active_path 更新，updated_at 更新）,
        "node": {
          "node_id": 新节点ID,
          "pid": 父节点ID,
          "role": 角色,
          "content": 内容,
          "j": 当前分支序号,
          "n": 总分支数
        }
      }
    
    说明：
    - 获取当前 active_path 的最后节点
    - 从其父节点的 children 中切换到第 target_j 个兄弟节点
    - 更新 active_path，替换最后一个节点为目标节点
    - 若 target_j 超出范围则报错
    """
    loaded_doc = _load_doc_from_file_or_obj(doc, file)
    nodes = loaded_doc.get("nodes") or {}
    children_map = loaded_doc.get("children") or {}
    active_path = list(loaded_doc.get("active_path") or [])
    
    if not active_path:
        raise ValueError("active_path is empty")
    
    # 获取当前最后节点
    current_node_id = active_path[-1]
    current_node = nodes.get(current_node_id)
    if not current_node:
        raise ValueError(f"Current node not found: {current_node_id}")
    
    # 获取父节点
    parent_id = current_node.get("pid")
    
    # 特殊处理：根节点切换（从 roots 数组中切换）
    if parent_id is None:
        # 当前是根节点，从 roots 数组中切换
        roots = loaded_doc.get("roots") or []
        if not roots or len(roots) <= 1:
            raise ValueError("Cannot switch branch: only one root node exists")
        
        # 验证 target_j 范围
        if target_j < 1 or target_j > len(roots):
            raise ValueError(f"Invalid target_j={target_j}, must be between 1 and {len(roots)}")
        
        # 获取目标根节点
        target_node_id = roots[target_j - 1]
        target_node = nodes.get(target_node_id)
        if not target_node:
            raise ValueError(f"Target root node not found: {target_node_id}")
        
        # 更新 active_path：替换为新的根节点
        active_path = [target_node_id]
        
        loaded_doc["active_path"] = active_path
        ts = _update_timestamp(loaded_doc)
        
        # 保存文件
        if file is not None and isinstance(file, str) and file.strip():
            root = _repo_root()
            conversations_dir = root / "backend_projects" / "SmartTavern" / "data" / "conversations"
            target_path = (root / Path(file)).resolve()
            
            if not _is_within(target_path, conversations_dir):
                raise ValueError(f"File must be within conversations directory: {file}")
            
            _safe_write_json(target_path, loaded_doc)
        
        node_obj = {
            "node_id": target_node_id,
            "j": target_j,
            "n": len(roots)
        }
        mode = str(return_mode or "doc").lower()
        if mode == "node":
            latest_pack = _compute_latest_with_branch_indexes(loaded_doc)
            return {
                "success": True,
                "node": node_obj,
                "active_path": latest_pack.get("active_path"),
                "latest": latest_pack.get("latest"),
                "updated_at": loaded_doc.get("updated_at", ts),
            }
        if mode == "path":
            latest_pack = _compute_latest_with_branch_indexes(loaded_doc)
            return {
                "success": True,
                "active_path": latest_pack.get("active_path"),
                "latest": latest_pack.get("latest"),
                "node_id": target_node_id,
                "updated_at": loaded_doc.get("updated_at", ts),
            }
        if mode == "none":
            latest_pack = _compute_latest_with_branch_indexes(loaded_doc)
            return {
                "success": True,
                "node_id": target_node_id,
                "active_path": latest_pack.get("active_path"),
                "latest": latest_pack.get("latest"),
                "updated_at": loaded_doc.get("updated_at", ts),
            }
        # 默认：返回完整文档并附带 latest/active_path，便于前端统一读取
        latest_pack = _compute_latest_with_branch_indexes(loaded_doc)
        resp = {"doc": loaded_doc, "node": node_obj}
        try:
            resp.update({
                "active_path": latest_pack.get("active_path"),
                "latest": latest_pack.get("latest"),
                "success": True,
            })
        except Exception:
            pass
        return resp
    
    # 普通节点切换（从父节点的 children 中切换）
    # 获取父节点的所有子节点
    siblings = children_map.get(parent_id, [])
    if not siblings:
        raise ValueError(f"No siblings found for parent: {parent_id}")
    
    # 验证 target_j 范围
    if target_j < 1 or target_j > len(siblings):
        raise ValueError(f"Invalid target_j={target_j}, must be between 1 and {len(siblings)}")
    
    # 获取目标节点（j 是 1-based）
    target_node_id = siblings[target_j - 1]
    target_node = nodes.get(target_node_id)
    if not target_node:
        raise ValueError(f"Target node not found: {target_node_id}")
    
    # 更新 active_path：替换最后一个节点
    active_path[-1] = target_node_id
    loaded_doc["active_path"] = active_path
    ts = _update_timestamp(loaded_doc)
    
    # 如果传入了 file 参数，保存更新后的文档到文件
    if file is not None and isinstance(file, str) and file.strip():
        root = _repo_root()
        conversations_dir = root / "backend_projects" / "SmartTavern" / "data" / "conversations"
        target_path = (root / Path(file)).resolve()
        
        if not _is_within(target_path, conversations_dir):
            raise ValueError(f"File must be within conversations directory: {file}")
        
        _safe_write_json(target_path, loaded_doc)
    
    node_obj = {
        "node_id": target_node_id,
        "j": target_j,
        "n": len(siblings)
    }
    mode = str(return_mode or "doc").lower()
    if mode == "node":
        latest_pack = _compute_latest_with_branch_indexes(loaded_doc)
        return {
            "success": True,
            "node": node_obj,
            "active_path": latest_pack.get("active_path"),
            "latest": latest_pack.get("latest"),
            "updated_at": loaded_doc.get("updated_at", ts),
        }
    if mode == "path":
        latest_pack = _compute_latest_with_branch_indexes(loaded_doc)
        return {
            "success": True,
            "active_path": latest_pack.get("active_path"),
            "latest": latest_pack.get("latest"),
            "node_id": target_node_id,
            "updated_at": loaded_doc.get("updated_at", ts),
        }
    if mode == "none":
        latest_pack = _compute_latest_with_branch_indexes(loaded_doc)
        return {
            "success": True,
            "node_id": target_node_id,
            "active_path": latest_pack.get("active_path"),
            "latest": latest_pack.get("latest"),
            "updated_at": loaded_doc.get("updated_at", ts),
        }
    latest_pack = _compute_latest_with_branch_indexes(loaded_doc)
    resp = {"doc": loaded_doc, "node": node_obj}
    try:
        resp.update({
            "active_path": latest_pack.get("active_path"),
            "latest": latest_pack.get("latest"),
            "success": True,
        })
    except Exception:
        pass
    return resp


def append_new_message(
    node_id: str,
    pid: str,
    role: str,
    content: str,
    doc: Optional[Dict[str, Any]] = None,
    file: Optional[str] = None,
    return_mode: str = "doc",
) -> Dict[str, Any]:
    """
    追加新消息：创建新节点并更新父节点 children 与 active_path。
    
    参数：
    - node_id: 新节点 ID（必须唯一）
    - pid: 父节点 ID（必须存在）
    - role: system|user|assistant
    - content: 消息内容
    - doc/file: 二选一输入
    
    返回：
      更新后的完整 doc（nodes 新增，children 更新父节点，active_path 追加，updated_at 更新）
      
    注意：当传入 file 参数时，会自动保存更新后的文档到文件
    """
    loaded_doc = _load_doc_from_file_or_obj(doc, file)
    nodes = loaded_doc.get("nodes") or {}
    children_map = loaded_doc.get("children") or {}
    active_path = list(loaded_doc.get("active_path") or [])
    
    if node_id in nodes:
        raise ValueError(f"Node ID already exists: {node_id}")
    
    if pid not in nodes:
        raise ValueError(f"Parent node not found: {pid}")
    
    if role not in ("system", "user", "assistant"):
        raise ValueError(f"Invalid role: {role}")
    
    # 创建新节点
    nodes[node_id] = {
        "pid": pid,
        "role": role,
        "content": content,
        "node_updated_at": _get_node_timestamp()
    }
    
    # 更新父节点 children
    if pid not in children_map:
        children_map[pid] = []
    if node_id not in children_map[pid]:
        children_map[pid].append(node_id)
    
    # 追加到 active_path（如果 pid 是 active_path 的最后一个节点）
    if active_path and active_path[-1] == pid:
        active_path.append(node_id)

    # 创建助手占位节点（空内容），立即作为新分支末尾
    # 占位节点 ID 采用 'n_append_ass' 前缀，便于 openai_messages 过滤空占位
    from time import time
    placeholder_id = f"n_append_ass{int(time()*1000)}"
    # 确保唯一
    while placeholder_id in nodes:
        placeholder_id = f"n_append_ass{int(time()*1000)}"
    nodes[placeholder_id] = {
        "pid": node_id,
        "role": "assistant",
        "content": "",
        "node_updated_at": _get_node_timestamp()
    }
    # 将占位添加为用户消息的子节点
    if node_id not in children_map:
        children_map[node_id] = []
    if placeholder_id not in children_map[node_id]:
        children_map[node_id].append(placeholder_id)
    # 若 active_path 末尾是用户消息，则将占位作为新的末尾
    if active_path and active_path[-1] == node_id:
        active_path.append(placeholder_id)
    
    loaded_doc["nodes"] = nodes
    loaded_doc["children"] = children_map
    loaded_doc["active_path"] = active_path
    ts = _update_timestamp(loaded_doc)
    
    # 如果传入了 file 参数，保存更新后的文档到文件
    if file is not None and isinstance(file, str) and file.strip():
        root = _repo_root()
        conversations_dir = root / "backend_projects" / "SmartTavern" / "data" / "conversations"
        target = (root / Path(file)).resolve()
        
        if not _is_within(target, conversations_dir):
            raise ValueError(f"File must be within conversations directory: {file}")
        
        _safe_write_json(target, loaded_doc)
    
    mode = str(return_mode or "doc").lower()
    # 统一并回 latest 与 active_path
    latest_pack = _compute_latest_with_branch_indexes(loaded_doc)
    if mode == "node":
        node = {
            "node_id": node_id,
            "pid": pid,
            "role": role,
            "content": content,
            "node_updated_at": nodes[node_id].get("node_updated_at")
        }
        return {
            "success": True,
            "node": node,
            "active_path": latest_pack.get("active_path"),
            "latest": latest_pack.get("latest"),
            "updated_at": loaded_doc.get("updated_at", ts),
        }
    if mode == "path":
        return {
            "success": True,
            "active_path": latest_pack.get("active_path"),
            "latest": latest_pack.get("latest"),
            "node_id": placeholder_id,
            "node_updated_at": nodes[node_id].get("node_updated_at"),
            "placeholder_updated_at": nodes[placeholder_id].get("node_updated_at"),
            "updated_at": loaded_doc.get("updated_at", ts),
        }
    if mode == "none":
        return {
            "success": True,
            "node_id": placeholder_id,
            "node_updated_at": nodes[node_id].get("node_updated_at"),
            "placeholder_updated_at": nodes[placeholder_id].get("node_updated_at"),
            "active_path": latest_pack.get("active_path"),
            "latest": latest_pack.get("latest"),
            "updated_at": loaded_doc.get("updated_at", ts),
        }

    # 默认：返回完整 doc，并附加 latest/active_path
    resp = dict(loaded_doc)
    try:
        resp.update({
            "success": True,
            "active_path": latest_pack.get("active_path"),
            "latest": latest_pack.get("latest"),
        })
    except Exception:
        pass
    return resp


def delete_branch(
    node_id: str,
    doc: Optional[Dict[str, Any]] = None,
    file: Optional[str] = None,
    return_mode: str = "doc",
) -> Dict[str, Any]:
    """
    删除单个分支节点：删除该节点及其所有子孙，更新 active_path，如果删除的是当前分支则切换到相邻分支。
    
    参数：
    - node_id: 要删除的节点
    - doc/file: 二选一输入
    
    返回：
      更新后的完整 doc
      
    逻辑：
    1. 删除节点及其子孙
    2. 从父节点的 children 中移除
    3. 如果删除的节点在 active_path 中：
       - 如果有兄弟节点，切换到前一个或后一个兄弟
       - 如果没有兄弟节点，截断 active_path 到父节点
    """
    loaded_doc = _load_doc_from_file_or_obj(doc, file)
    nodes = loaded_doc.get("nodes") or {}
    children_map = loaded_doc.get("children") or {}
    active_path = list(loaded_doc.get("active_path") or [])
    
    if node_id not in nodes:
        raise ValueError(f"Node not found: {node_id}")
    
    # 获取父节点
    parent_id = nodes[node_id].get("pid")
    
    # 收集要删除的所有节点（节点本身 + 所有子孙）
    to_delete = set([node_id])
    stack = list(children_map.get(node_id, []))
    while stack:
        current = stack.pop()
        if current in to_delete:
            continue
        to_delete.add(current)
        for child in (children_map.get(current) or []):
            if child not in to_delete:
                stack.append(child)
    
    # 删除所有节点
    for nid in to_delete:
        nodes.pop(nid, None)
        children_map.pop(nid, None)
    
    # 从父节点的 children 中移除
    if parent_id and parent_id in children_map:
        children_map[parent_id] = [cid for cid in children_map[parent_id] if cid not in to_delete]
        if not children_map[parent_id]:
            children_map.pop(parent_id, None)
    
    # 从其他节点的 children 中移除被删节点的引用
    for pid in list(children_map.keys()):
        children_map[pid] = [cid for cid in children_map[pid] if cid not in to_delete]
        if not children_map[pid]:
            children_map.pop(pid, None)
    
    # 更新 active_path
    if node_id in active_path:
        node_idx = active_path.index(node_id)
        # 截断到该节点之前
        active_path = active_path[:node_idx]
        
        # 如果有父节点且父节点有其他子节点，智能切换到相邻分支
        if parent_id and parent_id in children_map and children_map[parent_id]:
            # 获取删除前的兄弟节点列表（包含被删除的节点）
            old_siblings = children_map[parent_id] + [node_id]
            # 找到被删除节点在原列表中的位置
            if node_id in old_siblings:
                old_j = old_siblings.index(node_id)  # 0-based
                new_siblings = children_map[parent_id]  # 删除后的列表
                
                if new_siblings:
                    # 如果删除的不是最后一个，切换到同位置（原来的下一个继承了当前位置）
                    if old_j < len(new_siblings):
                        active_path.append(new_siblings[old_j])
                    # 如果删除的是最后一个，切换到新的最后一个
                    else:
                        active_path.append(new_siblings[-1])
    
    loaded_doc["nodes"] = nodes
    loaded_doc["children"] = children_map
    loaded_doc["active_path"] = active_path
    ts = _update_timestamp(loaded_doc)
    
    # 保存文件
    if file is not None and isinstance(file, str) and file.strip():
        root = _repo_root()
        conversations_dir = root / "backend_projects" / "SmartTavern" / "data" / "conversations"
        target = (root / Path(file)).resolve()
        
        if not _is_within(target, conversations_dir):
            raise ValueError(f"File must be within conversations directory: {file}")
        
        _safe_write_json(target, loaded_doc)
    
    mode = str(return_mode or "doc").lower()
    if mode == "path":
        latest_pack = _compute_latest_with_branch_indexes(loaded_doc)
        switched_to = (latest_pack.get("latest") or {}).get("node_id")
        return {
            "success": True,
            "active_path": latest_pack.get("active_path"),
            "latest": latest_pack.get("latest"),
            "switched_to": switched_to,
            "updated_at": loaded_doc.get("updated_at", ts),
        }
    if mode == "none":
        latest_pack = _compute_latest_with_branch_indexes(loaded_doc)
        switched_to = (latest_pack.get("latest") or {}).get("node_id")
        return {
            "success": True,
            "node_id": node_id,
            "active_path": latest_pack.get("active_path"),
            "latest": latest_pack.get("latest"),
            "switched_to": switched_to,
            "updated_at": loaded_doc.get("updated_at", ts),
        }

    # 默认返回完整文档并附带 latest 信息
    latest_pack = _compute_latest_with_branch_indexes(loaded_doc)
    resp = dict(loaded_doc)
    try:
        resp.update({
            "active_path": latest_pack.get("active_path"),
            "latest": latest_pack.get("latest"),
            "success": True,
        })
    except Exception:
        pass
    return resp


def retry_branch(
    new_node_id: str,
    retry_node_id: str,
    role: str,
    content: str,
    doc: Optional[Dict[str, Any]] = None,
    file: Optional[str] = None,
    return_mode: str = "doc",
) -> Dict[str, Any]:
    """
    重试分支：创建新分支节点，继承原节点的父节点，并替换 active_path 中的位置。
    
    参数：
    - new_node_id: 新节点 ID（必须唯一）
    - retry_node_id: 要重试的节点 ID（必须存在）
    - role: system|user|assistant
    - content: 消息内容
    - doc/file: 二选一输入
    
    返回：
      更新后的完整 doc（新节点添加，children 更新，active_path 更新）
      
    逻辑：
    1. 继承 retry_node 的 pid 作为新节点的 pid
    2. 在父节点的 children 末尾添加新节点
    3. 在 active_path 中，将 retry_node_id 替换为 new_node_id
    4. 删除 retry_node_id 之后的所有 active_path 节点
    """
    loaded_doc = _load_doc_from_file_or_obj(doc, file)
    nodes = loaded_doc.get("nodes") or {}
    children_map = loaded_doc.get("children") or {}
    active_path = list(loaded_doc.get("active_path") or [])
    
    if new_node_id in nodes:
        raise ValueError(f"New node ID already exists: {new_node_id}")
    
    if retry_node_id not in nodes:
        raise ValueError(f"Retry node not found: {retry_node_id}")
    
    if role not in ("system", "user", "assistant"):
        raise ValueError(f"Invalid role: {role}")
    
    # 获取要重试节点的父节点
    retry_node = nodes[retry_node_id]
    pid = retry_node.get("pid")
    
    if pid is None:
        raise ValueError("Cannot retry root node")
    
    if pid not in nodes:
        raise ValueError(f"Parent node not found: {pid}")
    
    # 创建新节点（继承相同的 pid）
    nodes[new_node_id] = {
        "pid": pid,
        "role": role,
        "content": content,
        "node_updated_at": _get_node_timestamp()
    }
    
    # 在父节点的 children 末尾添加新节点
    if pid not in children_map:
        children_map[pid] = []
    children_map[pid].append(new_node_id)
    
    # 更新 active_path：找到 retry_node_id 的位置并替换，删除其后的所有节点
    if retry_node_id in active_path:
        retry_idx = active_path.index(retry_node_id)
        # 截断到重试节点之前，然后追加新节点
        active_path = active_path[:retry_idx] + [new_node_id]
    else:
        # 如果 retry_node 不在当前路径，将新节点追加到路径末尾（兜底逻辑）
        if active_path and active_path[-1] == pid:
            active_path.append(new_node_id)
    
    loaded_doc["nodes"] = nodes
    loaded_doc["children"] = children_map
    loaded_doc["active_path"] = active_path
    ts = _update_timestamp(loaded_doc)
    
    # 如果传入了 file 参数，保存更新后的文档到文件
    if file is not None and isinstance(file, str) and file.strip():
        root = _repo_root()
        conversations_dir = root / "backend_projects" / "SmartTavern" / "data" / "conversations"
        target = (root / Path(file)).resolve()
        
        if not _is_within(target, conversations_dir):
            raise ValueError(f"File must be within conversations directory: {file}")
        
        _safe_write_json(target, loaded_doc)
    
    mode = str(return_mode or "doc").lower()
    if mode == "path":
        latest_pack = _compute_latest_with_branch_indexes(loaded_doc)
        return {
            "success": True,
            "active_path": latest_pack.get("active_path"),
            "latest": latest_pack.get("latest"),
            "new_node_id": new_node_id,
            "node_updated_at": nodes[new_node_id].get("node_updated_at"),
            "updated_at": loaded_doc.get("updated_at", ts),
        }
    if mode == "none":
        latest_pack = _compute_latest_with_branch_indexes(loaded_doc)
        return {
            "success": True,
            "node_id": new_node_id,
            "node_updated_at": nodes[new_node_id].get("node_updated_at"),
            "active_path": latest_pack.get("active_path"),
            "latest": latest_pack.get("latest"),
            "updated_at": loaded_doc.get("updated_at", ts),
        }

    # 默认返回完整文档并附带 latest 信息
    latest_pack = _compute_latest_with_branch_indexes(loaded_doc)
    resp = dict(loaded_doc)
    try:
        resp.update({
            "active_path": latest_pack.get("active_path"),
            "latest": latest_pack.get("latest"),
            "success": True,
        })
    except Exception:
        pass
    return resp

def retry_user_message(
    user_node_id: str,
    doc: Optional[Dict[str, Any]] = None,
    file: Optional[str] = None
) -> Dict[str, Any]:
    """
    智能重试用户消息：
    1. 优先检查 active_path：如果用户消息后有助手消息，返回 active_path 中的助手消息 ID
    2. 如果 active_path 中没有，但 children 中有助手消息，返回第一个助手消息 ID
    3. 如果都没有助手消息，返回特殊标记（前端需要创建新助手消息并调用 AI）
    
    参数：
    - user_node_id: 用户消息节点 ID
    - doc/file: 二选一输入
    
    返回：
      {
        "action": "retry_assistant" | "create_assistant",
        "assistant_node_id": str (action=retry_assistant 时存在),
        "user_node_id": str,
        "pid": str (action=create_assistant 时，新助手消息的父节点)
      }
    """
    loaded_doc = _load_doc_from_file_or_obj(doc, file)
    nodes = loaded_doc.get("nodes") or {}
    children_map = loaded_doc.get("children") or {}
    active_path = list(loaded_doc.get("active_path") or [])
    
    if user_node_id not in nodes:
        raise ValueError(f"User node not found: {user_node_id}")
    
    user_node = nodes[user_node_id]
    if user_node.get("role") != "user":
        raise ValueError(f"Node {user_node_id} is not a user message")
    
    # 优先从 active_path 中查找：如果用户消息在 active_path 中，且后面有助手消息
    if user_node_id in active_path:
        user_idx = active_path.index(user_node_id)
        # 检查用户消息后面是否有节点
        if user_idx + 1 < len(active_path):
            next_node_id = active_path[user_idx + 1]
            next_node = nodes.get(next_node_id)
            # 如果下一个节点是助手消息，返回这个节点
            if next_node and next_node.get("role") == "assistant":
                return {
                    "action": "retry_assistant",
                    "assistant_node_id": next_node_id,
                    "user_node_id": user_node_id
                }
    
    # 如果 active_path 中没有找到，回退到检查 children 列表
    children = children_map.get(user_node_id, [])
    
    # 查找第一个助手消息子节点
    assistant_child = None
    for child_id in children:
        child = nodes.get(child_id)
        if child and child.get("role") == "assistant":
            assistant_child = child_id
            break
    
    if assistant_child:
        # 有助手消息，返回重试助手消息的指示
        return {
            "action": "retry_assistant",
            "assistant_node_id": assistant_child,
            "user_node_id": user_node_id
        }
    else:
        # 没有助手消息：直接在该用户消息下创建一个空的助手占位节点（n_retry_ass*），并更新 active_path
        from time import time
        new_ass_id = f"n_retry_ass{int(time()*1000)}"
        # 确保唯一
        while new_ass_id in nodes:
            new_ass_id = f"n_retry_ass{int(time()*1000)}"

        # 创建助手占位节点
        nodes[user_node_id] = dict(nodes.get(user_node_id) or {})  # 防御性复制
        nodes[new_ass_id] = {
            "pid": user_node_id,
            "role": "assistant",
            "content": "",
            "node_updated_at": _get_node_timestamp()
        }
        # 追加到 children
        if user_node_id not in children_map:
            children_map[user_node_id] = []
        if new_ass_id not in children_map[user_node_id]:
            children_map[user_node_id].append(new_ass_id)
        # 若 active_path 末尾是该用户消息，则把占位节点追加为新的末尾
        if active_path and active_path[-1] == user_node_id:
            active_path.append(new_ass_id)

        # 写回并保存
        loaded_doc["nodes"] = nodes
        loaded_doc["children"] = children_map
        loaded_doc["active_path"] = active_path
        ts = _update_timestamp(loaded_doc)

        if file is not None and isinstance(file, str) and file.strip():
            root = _repo_root()
            conversations_dir = root / "backend_projects" / "SmartTavern" / "data" / "conversations"
            target = (root / Path(file)).resolve()
            if not _is_within(target, conversations_dir):
                raise ValueError(f"File must be within conversations directory: {file}")
            _safe_write_json(target, loaded_doc)

        latest_pack = _compute_latest_with_branch_indexes(loaded_doc)
        return {
            "success": True,
            "action": "create_assistant",
            "assistant_node_id": new_ass_id,
            "node_updated_at": nodes[new_ass_id].get("node_updated_at"),
            "user_node_id": user_node_id,
            "active_path": latest_pack.get("active_path"),
            "latest": latest_pack.get("latest"),
            "updated_at": loaded_doc.get("updated_at", ts),
            "doc": loaded_doc,
        }



# ---------- 创建初始对话：从角色卡 messages[0] 生成根节点，并输出对话三件套 ----------

def _conversations_dir() -> Path:
    root = _repo_root()
    conv = root / "backend_projects" / "SmartTavern" / "data" / "conversations"
    conv.mkdir(parents=True, exist_ok=True)
    return conv

def _allowed_data_dirs() -> List[Path]:
    root = _repo_root()
    return [
        root / "backend_projects" / "SmartTavern" / "data" / "characters",
        root / "backend_projects" / "SmartTavern" / "data" / "presets",
        root / "backend_projects" / "SmartTavern" / "data" / "personas",
        root / "backend_projects" / "SmartTavern" / "data" / "regex_rules",
        root / "backend_projects" / "SmartTavern" / "data" / "world_books",
        root / "backend_projects" / "SmartTavern" / "data" / "llm_configs",
    ]

def _is_under_any(target: Path, parents: List[Path]) -> bool:
    for p in parents:
        if _is_within(target, p):
            return True
    return False

def _safe_write_json(p: Path, obj: Dict[str, Any]) -> None:
    with p.open("w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def _sanitize_filename(name: str) -> str:
    """
    最小化的文件名安全处理：
    - 去掉首尾空白
    - 替换 Windows/Unix 非法分隔符: / \ : * ? " < > | 为连字符
    - 去掉结尾的点与空格
    其余字符保留，以尽量“直接使用用户设置的名称”。
    """
    s = str(name or "").strip()
    if not s:
        return ""
    s = re.sub(r'[\\/:\*\?"<>|]', '-', s)
    s = s.rstrip(' .')
    return s

def _ensure_unique_name(base_name: str) -> str:
    """
    在 conversations 目录下确保“会话目录”唯一，冲突时追加 -2, -3, ...
    新结构：
      conversations/{name}/conversation.json
      conversations/{name}/settings.json
      conversations/{name}/variables.json
    """
    conv_dir = _conversations_dir()
    name = base_name or "conversation"
    idx = 2
    while True:
        folder = conv_dir / name
        main = folder / "conversation.json"
        settings = folder / "settings.json"
        variables = folder / "variables.json"
        if not (folder.exists() or main.exists() or settings.exists() or variables.exists()):
            return name
        name = f"{base_name}-{idx}"
        idx += 1

def _read_json_allowlisted(file: str) -> Dict[str, Any]:
    root = _repo_root()
    target = (root / Path(file)).resolve()
    if not _is_under_any(target, _allowed_data_dirs()):
        raise ValueError(f"Access denied for file outside allowed data dirs: {file}")
    data, err = _safe_read_json(target)
    if err:
        raise ValueError(f"Failed to read json: {file}: {err}")
    if not isinstance(data, dict):
        raise ValueError(f"Invalid JSON object: {file}")
    return data

def create_conversation_impl(
    name: str,
    description: str,
    character_file: str,
    preset_file: str,
    persona_file: str,
    regex_file: Optional[str] = None,
    worldbook_file: Optional[str] = None,
    llm_config_file: Optional[str] = None,
    type: str = "threaded",
) -> Dict[str, Any]:
    # 校验并读取角色卡，提取所有 messages（启用多分支）
    char_doc = _read_json_allowlisted(character_file)

    # 从角色卡读取type字段，如果没有则使用传入的type，最后默认为threaded
    char_type = char_doc.get("type") if isinstance(char_doc, dict) else None
    final_type = char_type or type or "threaded"
    
    # 验证type值
    if final_type not in ("threaded", "sandbox"):
        final_type = "threaded"

    # 生成文件名（直接使用用户输入名称作为基名，做最小安全处理）
    base_name = _sanitize_filename(name) or "conversation"
    filename_base = _ensure_unique_name(base_name)
    conv_dir = _conversations_dir()
    conv_base_dir = conv_dir / filename_base
    conv_base_dir.mkdir(parents=True, exist_ok=True)
    main_path = conv_base_dir / "conversation.json"
    settings_path = conv_base_dir / "settings.json"
    variables_path = conv_base_dir / "variables.json"

    # 根据类型构造不同的对话文档
    if final_type == "sandbox":
        # sandbox 类型：仅包含基本信息，不需要消息节点
        doc: Dict[str, Any] = {
            "name": str(name or "").strip() or filename_base,
            "description": str(description or "").strip(),
        }
        updated_at = _update_timestamp(doc)  # 设置 updated_at（+08:00）
        root_node_id = None
        nodes_count = 0
    else:
        # threaded 类型：创建消息节点分支
        # 取角色卡 message（字符串数组），每条消息创建一个根节点分支
        msgs = char_doc.get("message") if isinstance(char_doc, dict) else None

        if not isinstance(msgs, list) or len(msgs) == 0:
            # 没有消息，创建单个空根节点
            node_ts = _get_node_timestamp()
            root_nodes = {
                "n_root1": {"pid": None, "role": "assistant", "content": "（空）", "node_updated_at": node_ts}
            }
            roots_array = ["n_root1"]
        else:
            # 为每条消息创建一个根节点
            root_nodes = {}
            roots_array = []
            for i, msg_content in enumerate(msgs, start=1):
                root_id = f"n_root{i}"
                content = str(msg_content or "").strip() or "（空）"
                root_nodes[root_id] = {
                    "pid": None,
                    "role": "assistant",
                    "content": content,
                    "node_updated_at": _get_node_timestamp()
                }
                roots_array.append(root_id)

        # 构造主对话 doc（多根节点分支）
        doc: Dict[str, Any] = {
            "name": str(name or "").strip() or filename_base,
            "description": str(description or "").strip(),
            "roots": roots_array,  # 多个根节点
            "nodes": root_nodes,
            "children": {},
            "active_path": [roots_array[0]],  # 默认激活第一个根节点
        }
        updated_at = _update_timestamp(doc)  # 设置 updated_at（+08:00）
        root_node_id = roots_array[0]
        nodes_count = len(root_nodes)

    # 写入主文件
    _safe_write_json(main_path, doc)

    # 写入 settings（目录化新规范，包含type字段）
    settings: Dict[str, Any] = {
        "type": final_type,
        "preset": preset_file,
        "world_books": [worldbook_file] if worldbook_file else [],
        "character": character_file,
        "persona": persona_file,
        "regex_rules": [regex_file] if regex_file else [],
    }
    # 添加 llm_config（若提供）
    if llm_config_file:
        settings["llm_config"] = llm_config_file
    
    _safe_write_json(settings_path, settings)

    # 写入 variables（空对象）
    _safe_write_json(variables_path, {})

    # 返回结果
    rel_main = str(main_path.relative_to(_repo_root()).as_posix())
    rel_settings = str(settings_path.relative_to(_repo_root()).as_posix())
    rel_variables = str(variables_path.relative_to(_repo_root()).as_posix())
    result = {
        "file": rel_main,
        "settings_file": rel_settings,
        "variables_file": rel_variables,
        "name": doc["name"],
        "type": final_type,
        "updated_at": updated_at,
        "slug": filename_base,
    }
    # 只在 threaded 类型时返回节点信息
    if final_type == "threaded":
        result["root_node_id"] = root_node_id
        result["nodes_count"] = nodes_count
    return result


# ---------- 后续管理 API：更新 settings 与管理 variables ----------

def _resolve_conversation_files(
    file: Optional[str] = None,
    slug: Optional[str] = None,
) -> Tuple[Path, Path, Path, str]:
    """
    新结构解析：
      - 若提供 file：允许传入 conversations/{name}/conversation.json|settings.json|variables.json 三者之一，
        统一解析其父目录为 {name}，并返回该目录中的三件套路径。
      - 若提供 slug：直接定位到 conversations/{slug}/ 目录，并返回三件套路径。
    返回 (main_path, settings_path, variables_path, base_name)
    """
    root = _repo_root()
    conv_dir = _conversations_dir()

    if file and isinstance(file, str):
        target = (root / Path(file)).resolve()
        if not _is_within(target, conv_dir):
            raise ValueError(f"File must be within conversations directory: {file}")
        # 目录式：父目录名即 base_name
        base_dir = target.parent
        base_name = base_dir.name
        main_path = base_dir / "conversation.json"
        settings_path = base_dir / "settings.json"
        variables_path = base_dir / "variables.json"
        return main_path, settings_path, variables_path, base_name

    if slug and isinstance(slug, str) and slug.strip():
        base_name = slug.strip()
        base_dir = conv_dir / base_name
        main_path = base_dir / "conversation.json"
        settings_path = base_dir / "settings.json"
        variables_path = base_dir / "variables.json"
        return main_path, settings_path, variables_path, base_name

    raise ValueError("Either 'file' or 'slug' must be provided")


def _safe_read_json_default(p: Path, default: Dict[str, Any]) -> Dict[str, Any]:
    if not p.exists():
        return dict(default)
    data, err = _safe_read_json(p)
    if err:
        raise ValueError(f"Failed to read json: {p}: {err}")
    if not isinstance(data, dict):
        raise ValueError(f"Invalid JSON object: {p}")
    return data


def _validate_allowlisted_path_opt(val: Optional[str], field_name: str) -> Optional[str]:
    """
    若 val 非空，校验其是否位于允许的数据目录；通过则返回原值，否则抛出错误。
    """
    if val is None or val == "":
        return val
    root = _repo_root()
    target = (root / Path(val)).resolve()
    if not _is_under_any(target, _allowed_data_dirs()):
        raise ValueError(f"Invalid {field_name}, outside allowed data dirs: {val}")
    return val


def settings_impl(
    action: str,
    file: Optional[str] = None,
    slug: Optional[str] = None,
    patch: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    综合设置管理：读取与更新 conversations/{name}/settings.json。
    
    参数：
      - action: 'get' 或 'update'
      - file/slug: 二选一定位对话（file 可为该目录下的 conversation.json|settings.json|variables.json 之一）
      - patch: action=update 时必需，仅允许以下字段：
        - preset: string (单值)
        - character: string (单值，角色卡)
        - persona: string (单值)
        - regex_rules: string[] (多选)
        - world_books: string[] (多选)
        - llm_config: string (单值，AI配置)
    
    返回：{ settings_file, settings, slug }
    """
    main_path, settings_path, variables_path, base_name = _resolve_conversation_files(file=file, slug=slug)
    rel_settings = str(settings_path.relative_to(_repo_root()).as_posix())
    
    action = (action or "").strip().lower()
    if action not in {"get", "update"}:
        raise ValueError(f"Unsupported action: {action} (must be 'get' or 'update')")
    
    # GET: 读取并返回
    if action == "get":
        settings = _safe_read_json_default(settings_path, default={})
        return {
            "settings_file": rel_settings,
            "settings": settings,
            "slug": base_name,
        }
    
    # UPDATE: 校验 patch 并更新
    if not isinstance(patch, dict):
        raise ValueError("patch must be an object for action=update")
    
    settings = _safe_read_json_default(settings_path, default={})
    
    allowed_keys = {"type", "preset", "character", "persona", "regex_rules", "world_books", "llm_config"}
    for k in patch.keys():
        if k not in allowed_keys:
            raise ValueError(f"Unsupported settings field: {k}")
    
    # 校验函数：数组字段
    def _ensure_list_str(val, field):
        if val is None:
            return []
        if not isinstance(val, list):
            raise ValueError(f"{field} must be an array of strings")
        out = []
        for i, p in enumerate(val):
            if p is None or p == "":
                continue
            ps = _validate_allowlisted_path_opt(p, f"{field}[{i}]")
            if ps:
                out.append(ps)
        return out
    
    # 逐项校验与赋值（仅覆盖传入键）
    if "type" in patch:
        type_val = patch.get("type")
        if type_val not in ("threaded", "sandbox"):
            raise ValueError(f"Invalid type value: {type_val} (must be 'threaded' or 'sandbox')")
        settings["type"] = type_val
    if "preset" in patch:
        settings["preset"] = _validate_allowlisted_path_opt(patch.get("preset"), "preset")
    if "character" in patch:
        settings["character"] = _validate_allowlisted_path_opt(patch.get("character"), "character")
    if "persona" in patch:
        settings["persona"] = _validate_allowlisted_path_opt(patch.get("persona"), "persona")
    if "regex_rules" in patch:
        settings["regex_rules"] = _ensure_list_str(patch.get("regex_rules"), "regex_rules")
    if "world_books" in patch:
        settings["world_books"] = _ensure_list_str(patch.get("world_books"), "world_books")
    if "llm_config" in patch:
        settings["llm_config"] = _validate_allowlisted_path_opt(patch.get("llm_config"), "llm_config")
    
    _safe_write_json(settings_path, settings)
    
    return {
        "settings_file": rel_settings,
        "settings": settings,
        "slug": base_name,
    }


def variables_impl(
    action: str,
    file: Optional[str] = None,
    slug: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    管理 conversations/{name}/variables.json：
      - action=get:    读取并返回 variables
      - action=set:    全量替换为 data（data 必须为对象）
      - action=merge:  与 data 浅合并（键覆盖）
      - action=reset:  重置为 {}
    """
    main_path, settings_path, variables_path, base_name = _resolve_conversation_files(file=file, slug=slug)
    rel_variables = str(variables_path.relative_to(_repo_root()).as_posix())

    action = (action or "").strip().lower()
    if action not in {"get", "set", "merge", "reset"}:
        raise ValueError(f"Unsupported action: {action}")

    if action == "get":
        variables = _safe_read_json_default(variables_path, default={})
        return {
            "variables_file": rel_variables,
            "variables": variables,
            "slug": base_name,
        }

    if action in {"set", "merge"}:
        if not isinstance(data, dict):
            raise ValueError("data must be an object for set/merge")

    if action == "set":
        variables = dict(data or {})
        _safe_write_json(variables_path, variables)
        return {
            "variables_file": rel_variables,
            "variables": variables,
            "slug": base_name,
        }

    if action == "merge":
        variables = _safe_read_json_default(variables_path, default={})
        variables.update(data or {})
        _safe_write_json(variables_path, variables)
        return {
            "variables_file": rel_variables,
            "variables": variables,
            "slug": base_name,
        }

    # reset
    variables = {}
    _safe_write_json(variables_path, variables)
    return {
        "variables_file": rel_variables,
        "variables": variables,
        "slug": base_name,
    }