"""
API 封装层：工作流能力对外接口 (api/workflow)
新规范：斜杠 path + JSON Schema；工作流适配器转发调用模块级API。
"""

import os
from typing import Any, Dict, List, Optional
from pathlib import Path

import core

# embed_files_to_image
@core.register_api(
    name="工作流:嵌入文件到图片",
    description="将文件嵌入到PNG图片中",
    path="image_binding/embed_files_to_image",
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
def api_embed_files_to_image(image_path: str, file_paths: List[str], output_path: Optional[str] = None) -> Dict[str, Any]:
    try:
        payload = {"image_path": image_path, "file_paths": file_paths, "output_path": output_path}
        result = core.call_api("smarttavern/image_binding/embed_files_to_image", payload, method="POST", namespace="modules")
        return result if isinstance(result, dict) else {"success": False, "message": "接口返回非字典", "result": result}
    except Exception as e:
        return {"success": False, "message": f"嵌入文件失败: {str(e)}"}

# extract_files_from_image
@core.register_api(
    name="工作流:从图片提取文件",
    description="从PNG图片中提取文件",
    path="image_binding/extract_files_from_image",
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
def api_extract_files_from_image(image_path: str, output_dir: Optional[str] = None, filter_types: Optional[List[str]] = None) -> Dict[str, Any]:
    try:
        payload = {"image_path": image_path, "output_dir": output_dir, "filter_types": filter_types}
        result = core.call_api("smarttavern/image_binding/extract_files_from_image", payload, method="POST", namespace="modules")
        return result if isinstance(result, dict) else {"success": False, "message": "接口返回非字典", "result": result}
    except Exception as e:
        return {"success": False, "message": f"提取文件失败: {str(e)}", "files": []}

# get_embedded_files_info
@core.register_api(
    name="工作流:获取嵌入文件信息",
    description="获取PNG图片中嵌入的文件信息",
    path="image_binding/get_embedded_files_info",
    input_schema={
        "type": "object",
        "properties": {"image_path": {"type": "string"}},
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
def api_get_embedded_files_info(image_path: str) -> Dict[str, Any]:
    try:
        payload = {"image_path": image_path}
        result = core.call_api("smarttavern/image_binding/get_embedded_files_info", payload, method="GET", namespace="modules")
        return result if isinstance(result, dict) else {"success": False, "message": "接口返回非字典", "result": result}
    except Exception as e:
        return {"success": False, "message": f"获取文件信息失败: {str(e)}", "files_info": []}

# is_image_with_embedded_files
@core.register_api(
    name="工作流:检测图片是否包含嵌入文件",
    description="检查PNG图片是否包含嵌入文件",
    path="image_binding/is_image_with_embedded_files",
    input_schema={
        "type": "object",
        "properties": {"image_path": {"type": "string"}},
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
def api_is_image_with_embedded_files(image_path: str) -> Dict[str, Any]:
    try:
        payload = {"image_path": image_path}
        result = core.call_api("smarttavern/image_binding/is_image_with_embedded_files", payload, method="GET", namespace="modules")
        return result if isinstance(result, dict) else {"success": False, "message": "接口返回非字典", "result": result}
    except Exception as e:
        return {"success": False, "has_embedded_files": False, "message": f"检查图片失败: {str(e)}"}

# get_file_type_tags
@core.register_api(
    name="工作流:获取文件类型标签",
    description="获取所有支持的文件类型标签",
    path="image_binding/get_file_type_tags",
    input_schema={"type": "object", "properties": {}},
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
def api_get_file_type_tags() -> Dict[str, Any]:
    try:
        result = core.call_api("smarttavern/image_binding/get_file_type_tags", None, method="GET", namespace="modules")
        return result if isinstance(result, dict) else {"success": False, "message": "接口返回非字典", "result": result}
    except Exception as e:
        return {"success": False, "message": f"获取文件类型标签失败: {str(e)}"}

# test
@core.register_api(
    name="工作流:图像绑定测试",
    description="测试图像绑定模块的功能",
    path="image_binding/test",
    input_schema={
        "type": "object",
        "properties": {
            "image_path": {"type": "string"},
            "test_files": {"type": "array", "items": {"type": "string"}}
        }
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "message": {"type": "string"},
            "embed_result": {"type": "object", "additionalProperties": True},
            "info_result": {"type": "object", "additionalProperties": True},
            "extract_result": {"type": "object", "additionalProperties": True},
            "test_output_image": {"type": "string"},
            "test_output_dir": {"type": "string"}
        },
        "required": ["success"]
    }
)
def api_test_image_binding(image_path: Optional[str] = None, test_files: Optional[List[str]] = None) -> Dict[str, Any]:
    try:
        image_path = image_path or "shared/SmartTavern/测试图片.png"
        if not test_files:
            test_files = [
                "shared/SmartTavern/world_books/参考用main_world.json",
                "shared/SmartTavern/regex_rules/remove_xml_tags.json",
                "shared/SmartTavern/presets/Default.json",
                "shared/SmartTavern/user_preferences.json"
            ]
        img = str(Path(image_path))
        files = [str(Path(p)) for p in test_files]
        test_dir = Path("shared/SmartTavern/test_image_binding")
        test_dir.mkdir(exist_ok=True)
        test_output_image = str(test_dir / "test_embedded.png")
        test_output_dir = str(test_dir / "extracted")
        Path(test_output_dir).mkdir(exist_ok=True)
        embed_result = api_embed_files_to_image(img, files, test_output_image)
        if not embed_result.get("success"):
            return embed_result
        info_result = api_get_embedded_files_info(test_output_image)
        if not info_result.get("success"):
            return info_result
        extract_result = api_extract_files_from_image(test_output_image, test_output_dir, None)
        if not extract_result.get("success"):
            return extract_result
        return {
            "success": True,
            "message": "图像绑定模块测试完成",
            "embed_result": embed_result,
            "info_result": info_result,
            "extract_result": extract_result,
            "test_output_image": test_output_image,
            "test_output_dir": test_output_dir
        }
    except Exception as e:
        return {"success": False, "message": f"测试失败: {str(e)}"}