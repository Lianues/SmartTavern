"""
API 封装层：模块能力对外接口 (api/modules)
为 SmartTavern.image_binding 提供统一的 @register_api 注册入口（新规范：斜杠 path + JSON Schema）。
注意：此层仅作为对外 API 适配，实际实现位于本包 impl.py
"""

import os
from typing import Any, Dict, List, Optional
from pathlib import Path

import core
from .impl import ImageBindingModule
from .variables import FILE_TYPE_TAGS

# embed_files_to_image
@core.register_api(
    name="嵌入文件到图片",
    description="将文件嵌入到PNG图片中",
    path="smarttavern/image_binding/embed_files_to_image",
    input_schema={
        "type": "object",
        "properties": {
            "image_path": {"type": "string"},
            "file_paths": {"type": "array", "items": {"type": "string"}},
            "output_path": {"type": "string"}
        },
        "required": ["image_path", "file_paths"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "message": {"type": "string"},
            "output_path": {"type": "string"},
            "relative_path": {"type": "string"}
        },
        "required": ["success"]
    }
)
def embed_files_to_image(image_path: str, file_paths: List[str], output_path: Optional[str] = None) -> Dict[str, Any]:
    try:
        ibm = ImageBindingModule()
        result_path = ibm.embed_files_to_image(
            image_path=str(Path(image_path)),
            file_paths=[str(Path(p)) for p in file_paths],
            output_path=str(Path(output_path)) if output_path else None
        )
        shared_dir = Path("shared/SmartTavern")
        rel_path = os.path.relpath(result_path, start=str(shared_dir)) if str(result_path).startswith(str(shared_dir)) else result_path
        return {"success": True, "message": "文件已成功嵌入到图片中", "output_path": result_path, "relative_path": rel_path}
    except Exception as e:
        return {"success": False, "message": f"嵌入文件失败: {str(e)}"}

# extract_files_from_image
@core.register_api(
    name="从图片提取文件",
    description="从PNG图片中提取文件",
    path="smarttavern/image_binding/extract_files_from_image",
    input_schema={
        "type": "object",
        "properties": {
            "image_path": {"type": "string"},
            "output_dir": {"type": "string"},
            "filter_types": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["image_path"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "message": {"type": "string"},
            "files": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["success"]
    }
)
def extract_files_from_image(image_path: str, output_dir: Optional[str] = None, filter_types: Optional[List[str]] = None) -> Dict[str, Any]:
    try:
        ibm = ImageBindingModule()
        out_dir = str(Path(output_dir)) if output_dir else None
        files = ibm.extract_files_from_image(
            image_path=str(Path(image_path)),
            output_dir=out_dir,
            filter_types=filter_types
        )
        return {"success": True, "message": f"成功从图片中提取了 {len(files)} 个文件", "files": files}
    except Exception as e:
        return {"success": False, "message": f"提取文件失败: {str(e)}", "files": []}

# get_embedded_files_info
@core.register_api(
    name="获取嵌入文件信息",
    description="获取PNG图片中嵌入的文件信息",
    path="smarttavern/image_binding/get_embedded_files_info",
    input_schema={
        "type": "object",
        "properties": {
            "image_path": {"type": "string"}
        },
        "required": ["image_path"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "message": {"type": "string"},
            "files_info": {"type": "array", "items": {"type": "object", "additionalProperties": True}}
        },
        "required": ["success"]
    }
)
def get_embedded_files_info(image_path: str) -> Dict[str, Any]:
    try:
        ibm = ImageBindingModule()
        info = ibm.get_embedded_files_info(str(Path(image_path)))
        return {"success": True, "message": f"图片包含 {len(info)} 个嵌入文件", "files_info": info}
    except Exception as e:
        return {"success": False, "message": f"获取文件信息失败: {str(e)}", "files_info": []}

# is_image_with_embedded_files
@core.register_api(
    name="检测图片是否包含嵌入文件",
    description="检查PNG图片是否包含嵌入文件",
    path="smarttavern/image_binding/is_image_with_embedded_files",
    input_schema={
        "type": "object",
        "properties": {
            "image_path": {"type": "string"}
        },
        "required": ["image_path"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "has_embedded_files": {"type": "boolean"},
            "message": {"type": "string"}
        },
        "required": ["success", "has_embedded_files"]
    }
)
def is_image_with_embedded_files(image_path: str) -> Dict[str, Any]:
    try:
        ibm = ImageBindingModule()
        has = ibm.is_image_with_embedded_files(str(Path(image_path)))
        return {"success": True, "has_embedded_files": has, "message": "图片包含嵌入文件" if has else "图片不包含嵌入文件"}
    except Exception as e:
        return {"success": False, "has_embedded_files": False, "message": f"检查图片失败: {str(e)}"}

# get_file_type_tags
@core.register_api(
    name="获取文件类型标签",
    description="获取所有支持的文件类型标签",
    path="smarttavern/image_binding/get_file_type_tags",
    input_schema={
        "type": "object",
        "properties": {}
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "file_type_tags": {"type": "array", "items": {"type": "string"}},
            "message": {"type": "string"}
        },
        "required": ["success", "file_type_tags"]
    }
)
def get_file_type_tags() -> Dict[str, Any]:
    try:
        return {"success": True, "file_type_tags": FILE_TYPE_TAGS}
    except Exception as e:
        return {"success": False, "message": f"获取文件类型标签失败: {str(e)}"}