# -*- coding: utf-8 -*-
"""
API 封装层：通用模块/工作流 API 文件管理 (api/modules)
- 列出已注册 API 对应的脚本所在文件夹（按命名空间 modules/workflow 归类）
- 支持删除该文件夹（危险操作，慎用）
新规范：斜杠 path + JSON Schema。
"""

from typing import Any, Dict, List, Tuple
from pathlib import Path
import os
import shutil

import core


def _collect_api_folders() -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    """
    从注册表中收集 API 所在文件夹（通过函数 __module__ 推断路径）
    返回:
        (modules_map, workflow_map)
        - key: 相对路径（相对 api/modules 或 api/workflow）
        - value: {
            "relative_path": str,
            "abs_path": str,
            "api_count": int,
            "name": str,
            "apis": List[Dict[str, Any]]  # 该文件夹下注册的API（name/description/path/namespace）
        }
    """
    reg = core.get_registry()
    modules_map: Dict[str, Dict[str, Any]] = {}
    workflow_map: Dict[str, Dict[str, Any]] = {}

    def ensure_item(ns: str, rel_path_parts: List[str]) -> Dict[str, Any]:
        """创建或返回文件夹项"""
        if not rel_path_parts:
            return {}
        rel = os.path.join(*rel_path_parts).replace("\\", "/")
        if ns == "modules":
            base = Path("api/modules")
            abs_path = (base / rel).resolve()
            item = modules_map.setdefault(rel, {
                "relative_path": rel,
                "abs_path": str(abs_path),
                "api_count": 0,
                "name": rel_path_parts[-1],
                "apis": []
            })
            return item
        elif ns == "workflow":
            base = Path("api/workflow")
            abs_path = (base / rel).resolve()
            item = workflow_map.setdefault(rel, {
                "relative_path": rel,
                "abs_path": str(abs_path),
                "api_count": 0,
                "name": rel_path_parts[-1],
                "apis": []
            })
            return item
        return {}

    for api_path in reg.list_functions():
        try:
            func = core.get_registered_api(api_path)
            spec = reg.get_spec(api_path)
        except Exception:
            continue

        mod = getattr(func, "__module__", "") or ""
        parts = mod.split(".") if mod else []
        if not parts or parts[0] != "api":
            continue

        # 结构示例：
        #   api.modules.project_manager.project_manager
        #   api.modules.SmartTavern.image_binding.image_binding
        #   api.workflow.image_binding.image_binding
        try:
            if len(parts) >= 4 and parts[1] == "modules":
                rel_parts = parts[2:-1]  # 去掉末尾脚本名
                item = ensure_item("modules", rel_parts)
                if item is not None:
                    item["api_count"] = int(item.get("api_count", 0)) + 1
                    if spec:
                        item["apis"].append({
                            "name": getattr(spec, "name", "") or "",
                            "description": getattr(spec, "description", "") or "",
                            "path": getattr(spec, "path", "") or "",
                            "namespace": getattr(spec, "namespace", "") or "modules"
                        })
            elif len(parts) >= 4 and parts[1] == "workflow":
                rel_parts = parts[2:-1]
                item = ensure_item("workflow", rel_parts)
                if item is not None:
                    item["api_count"] = int(item.get("api_count", 0)) + 1
                    if spec:
                        item["apis"].append({
                            "name": getattr(spec, "name", "") or "",
                            "description": getattr(spec, "description", "") or "",
                            "path": getattr(spec, "path", "") or "",
                            "namespace": getattr(spec, "namespace", "") or "workflow"
                        })
        except Exception:
            # 忽略异常，继续其他函数
            continue

    # 过滤：仅保留存在的目录
    def filter_existing(map_in: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        out: Dict[str, Dict[str, Any]] = {}
        for k, v in map_in.items():
            abs_p = v.get("abs_path")
            if abs_p and Path(abs_p).exists():
                out[k] = v
        return out

    return filter_existing(modules_map), filter_existing(workflow_map)


@core.register_api(
    name="列出API文件夹",
    description="列出已注册 API 对应脚本所在的文件夹（按 modules/workflow 归类）",
    path="api_files/list_folders",
    input_schema={"type": "object", "properties": {}},
    output_schema={
        "type": "object",
        "properties": {
            "modules": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
            "workflow": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
            "totals": {
                "type": "object",
                "properties": {
                    "modules": {"type": "integer"},
                    "workflow": {"type": "integer"}
                },
                "required": ["modules", "workflow"]
            }
        },
        "required": ["modules", "workflow"]
    }
)
def list_api_folders() -> Dict[str, Any]:
    modules_map, workflow_map = _collect_api_folders()

    def to_list(d: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        items = list(d.values())
        # 排序：先按名称，再按相对路径
        items.sort(key=lambda x: (str(x.get("name", "")).lower(), str(x.get("relative_path", "")).lower()))
        # 每项内部的 apis 再按 path 排序，便于前端展示
        for it in items:
            apis = it.get("apis", []) or []
            apis.sort(key=lambda a: (str(a.get("namespace", "")).lower(), str(a.get("path", "")).lower()))
            it["apis"] = apis
        return items

    modules_list = to_list(modules_map)
    workflow_list = to_list(workflow_map)

    return {
        "modules": modules_list,
        "workflow": workflow_list,
        "totals": {
            "modules": len(modules_list),
            "workflow": len(workflow_list),
        }
    }


@core.register_api(
    name="删除API文件夹",
    description="删除指定命名空间下的 API 文件夹（危险操作，谨慎使用）",
    path="api_files/delete_folder",
    input_schema={
        "type": "object",
        "properties": {
            "namespace": {"type": "string", "enum": ["modules", "workflow"]},
            "relative_path": {"type": "string"}
        },
        "required": ["namespace", "relative_path"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "message": {"type": "string"},
            "deleted_path": {"type": "string"}
        },
        "required": ["success"]
    }
)
def delete_api_folder(namespace: str, relative_path: str) -> Dict[str, Any]:
    try:
        ns = (namespace or "").strip().lower()
        if ns not in ("modules", "workflow"):
            return {"success": False, "message": f"非法命名空间: {namespace}"}

        base = Path("api") / ns
        target = (base / (relative_path or "")).resolve()

        # 安全检查：必须位于 base 之下
        base_resolved = base.resolve()
        try:
            _ = target.relative_to(base_resolved)
        except Exception:
            return {"success": False, "message": "路径越界，拒绝删除"}

        if not target.exists():
            return {"success": False, "message": "目标目录不存在", "deleted_path": str(target)}

        if not target.is_dir():
            return {"success": False, "message": "目标不是目录", "deleted_path": str(target)}

        # 执行删除
        shutil.rmtree(str(target), ignore_errors=False)

        return {
            "success": True,
            "message": "目录已删除",
            "deleted_path": str(target)
        }
    except Exception as e:
        return {"success": False, "message": f"删除失败: {str(e)}"}
# 新增：导入模块/工作流脚本（zip 或 PNG 图片内嵌 zip）

import zipfile
import tempfile
from typing import Optional

def _read_upload(obj):
    """读取上传对象统一为 (bytes, filename)"""
    if hasattr(obj, 'file'):
        return obj.file.read(), getattr(obj, 'filename', None)
    elif hasattr(obj, 'read'):
        return obj.read(), getattr(obj, 'name', None)
    elif isinstance(obj, (bytes, bytearray)):
        return obj, None
    else:
        raise ValueError("无效的上传对象")

def _validate_member_path(member: str, ns: str) -> bool:
    """
    校验 zip 内 .py 文件路径是否符合命名空间规范
    - workflow: 必须以 'api/workflow/' 开头
    - modules:  必须以 'api/modules/' 开头
    且必须以 '.py' 结尾
    """
    m = (member or "").replace("\\", "/").lstrip("/")
    if not m.endswith(".py"):
        return False
    if ns == "workflow":
        return m.startswith("api/workflow/")
    if ns == "modules":
        return m.startswith("api/modules/")
    return False

def _safe_extract_member(zip_ref: zipfile.ZipFile, member: str, dest_root: Path) -> str:
    """
    安全提取单个成员到 dest_root（保持相对路径），避免目录穿越。
    返回最终写入的绝对路径字符串。
    """
    rel = (member or "").replace("\\", "/").lstrip("/")
    target_path = (dest_root / rel).resolve()
    # 必须在目标根目录之下
    dest_resolved = dest_root.resolve()
    target_path.relative_to(dest_resolved)  # 越界会抛异常
    # 确保上级目录存在
    target_path.parent.mkdir(parents=True, exist_ok=True)
    # 写入文件内容
    with zip_ref.open(member, "r") as src, open(str(target_path), "wb") as dst:
        dst.write(src.read())
    return str(target_path)

@core.register_api(
    name="导入API脚本（zip）",
    description="导入单个模块或工作流脚本（zip包内仅包含一个 .py 文件，且路径以 api/modules 或 api/workflow 开头）",
    path="api_files/import_script",
    input_schema={
        "type": "object",
        "properties": {
            "archive": {"type": "string"},
            "namespace": {"type": "string", "enum": ["modules", "workflow"]}
        },
        "required": ["archive", "namespace"]
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def import_api_script(archive, namespace: str) -> Dict[str, Any]:
    temp_dir = None
    try:
        ns = (namespace or "").strip().lower()
        if ns not in ("modules", "workflow"):
            return {"success": False, "message": f"非法命名空间: {namespace}"}

        # 读取上传内容
        bytes_data, filename = _read_upload(archive)
        if not bytes_data:
            return {"success": False, "message": "未提供压缩包数据"}

        temp_dir = tempfile.mkdtemp(prefix="api_script_import_")
        zip_name = filename or "api_script.zip"
        zip_path = os.path.join(temp_dir, zip_name)
        with open(zip_path, "wb") as f:
            f.write(bytes_data)

        # 打开 zip 并校验内容
        with zipfile.ZipFile(zip_path, "r") as zf:
            members = zf.namelist()
            py_members = [m for m in members if m.lower().endswith(".py")]
            if len(py_members) != 1:
                return {"success": False, "message": "压缩包必须且只能包含一个 .py 文件"}
            member = py_members[0]
            if not _validate_member_path(member, ns):
                expect_prefix = f"api/{ns}/"
                return {"success": False, "message": f"脚本路径不符合所选类型要求，需以 '{expect_prefix}' 开头"}

            # 仅提取该 .py 到框架根目录
            framework_root = Path(__file__).parent.parent.parent.parent
            written_path = _safe_extract_member(zf, member, framework_root)

        # 动态导入新脚本以注册API
        rel_path = os.path.relpath(written_path, start=str(framework_root)).replace("\\", "/")
        module_name = rel_path[:-3].replace("/", ".")
        imported = False
        try:
            import importlib.util, sys
            spec = importlib.util.spec_from_file_location(module_name, written_path)
            mod = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = mod
            spec.loader.exec_module(mod)
            imported = True
        except Exception as ie:
            imported = False

        return {"success": True, "message": "API脚本导入成功", "written_path": written_path, "namespace": ns, "module": module_name, "imported": imported}
    except Exception as e:
        return {"success": False, "message": f"导入失败: {str(e)}"}
    finally:
        try:
            if temp_dir and os.path.isdir(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass

@core.register_api(
    name="从图片导入API脚本",
    description="从PNG图片中反嵌入zip，并将其中的单个 .py API脚本导入到 api/modules 或 api/workflow 下",
    path="api_files/import_script_from_image",
    input_schema={
        "type": "object",
        "properties": {
            "image": {"type": "string"},
            "namespace": {"type": "string", "enum": ["modules", "workflow"]}
        },
        "required": ["image", "namespace"]
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def import_api_script_from_image(image, namespace: str) -> Dict[str, Any]:
    temp_dir = None
    try:
        ns = (namespace or "").strip().lower()
        if ns not in ("modules", "workflow"):
            return {"success": False, "message": f"非法命名空间: {namespace}"}

        # 直接复用项目管理实现层的图片反嵌入逻辑
        from api.modules.project_manager.impl import extract_zip_from_image as _extract_zip_from_image

        result = _extract_zip_from_image(image)
        if not isinstance(result, dict) or not result.get("success"):
            return {"success": False, "message": f"图片解析失败: {result if not isinstance(result, dict) else result.get('error')}"}

        zip_path = result.get("zip_path")
        if not zip_path or not os.path.exists(zip_path):
            return {"success": False, "message": "未找到有效的zip文件路径"}

        # 打开 zip 并校验内容
        with zipfile.ZipFile(zip_path, "r") as zf:
            members = zf.namelist()
            py_members = [m for m in members if m.lower().endswith(".py")]
            if len(py_members) != 1:
                return {"success": False, "message": "压缩包必须且只能包含一个 .py 文件"}
            member = py_members[0]
            if not _validate_member_path(member, ns):
                expect_prefix = f"api/{ns}/"
                return {"success": False, "message": f"脚本路径不符合所选类型要求，需以 '{expect_prefix}' 开头"}

            framework_root = Path(__file__).parent.parent.parent.parent
            written_path = _safe_extract_member(zf, member, framework_root)

        return {"success": True, "message": "已从图片导入API脚本", "written_path": written_path, "namespace": ns}
    except Exception as e:
        return {"success": False, "message": f"导入失败: {str(e)}"}