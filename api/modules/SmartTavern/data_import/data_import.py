# -*- coding: utf-8 -*-
"""
API 封装层：SmartTavern.data_import

说明
- 遵循 DEVELOPMENT_NOTES：封装层仅做 API 注册与入参/出参契约定义；实现放在 impl.py
- 提供通用的数据导入/导出接口，支持：
  • 预设（presets）
  • 角色卡（characters）
  • 世界书（world_books）
  • 用户画像（personas）
  • 正则规则（regex_rules）
  • LLM 配置（llm_configs）
- 支持的文件格式：
  • JSON 文件（直接导入）
  • ZIP 压缩包（包含 JSON 和附加文件）
  • PNG 图片（从嵌入数据中提取）
"""

from __future__ import annotations
from typing import Any, Dict, Optional
import core
from .impl import import_data_impl, get_supported_types_impl, export_data_impl, check_name_exists_impl


# ---------- 导入数据 ----------

@core.register_api(
    path="smarttavern/data_import/import_data",
    name="导入数据",
    description="""
通用数据导入接口，支持导入预设、角色卡、世界书、用户画像、正则规则、LLM 配置等。

支持的文件格式：
- JSON 文件：直接解析并导入
- ZIP 压缩包：解压后查找主 JSON 文件和附加资源
- PNG 图片：从嵌入的 stDa 数据块中提取数据

导入流程：
1. 前端通过文件选择获取文件，转为 Base64
2. 调用此接口，传入数据类型、文件内容、文件名
3. 后端自动检测文件格式，提取数据
4. 在对应目录下创建新文件夹并写入数据
""",
    input_schema={
        "type": "object",
        "properties": {
            "data_type": {
                "type": "string",
                "description": "数据类型：preset, character, worldbook, persona, regex_rule, llm_config, plugin, style",
                "enum": ["preset", "character", "worldbook", "persona", "regex_rule", "llm_config", "plugin", "style"]
            },
            "file_content_base64": {
                "type": "string",
                "description": "Base64 编码的文件内容"
            },
            "filename": {
                "type": "string",
                "description": "原始文件名（用于类型检测和默认命名）"
            },
            "target_name": {
                "type": ["string", "null"],
                "description": "目标名称（可选），不提供则从数据中提取或使用文件名"
            },
            "overwrite": {
                "type": "boolean",
                "description": "是否覆盖已存在的同名数据，默认 false",
                "default": False
            }
        },
        "required": ["data_type", "file_content_base64", "filename"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "message": {"type": "string"},
            "error": {"type": "string"},
            "data_type": {"type": "string"},
            "name": {"type": "string"},
            "folder": {"type": "string"},
            "file": {"type": "string"},
            "extra_files": {
                "type": "array",
                "items": {"type": "string"}
            }
        },
        "required": ["success"],
        "additionalProperties": True
    },
)
def import_data(
    data_type: str,
    file_content_base64: str,
    filename: str,
    target_name: Optional[str] = None,
    overwrite: bool = False
) -> Dict[str, Any]:
    """
    导入数据
    
    Args:
        data_type: 数据类型
        file_content_base64: Base64 编码的文件内容
        filename: 原始文件名
        target_name: 目标名称（可选）
        overwrite: 是否覆盖已存在的数据
        
    Returns:
        导入结果
    """
    return import_data_impl(
        data_type=data_type,
        file_content_base64=file_content_base64,
        filename=filename,
        target_name=target_name,
        overwrite=overwrite
    )


# ---------- 导出数据 ----------

@core.register_api(
    path="smarttavern/data_import/export_data",
    name="导出数据",
    description="""
通用数据导出接口，将指定目录打包为 ZIP、JSON 或嵌入到 PNG 图片中。

导出格式：
- json：仅导出主 JSON 文件（轻量，便于编辑）
- zip：输出 ZIP 压缩包（包含所有文件）
- png：将数据嵌入到 PNG 图片中（需提供 embed_image_base64）

ZIP 结构：
- .st_meta.json：元数据文件，包含类型标记、名称等
- {folder_name}/：原始目录结构

PNG 嵌入：
- 数据嵌入到 stDa 自定义数据块中
- 包含完整的 ZIP 数据（Base64 编码）
- 包含类型标记和元数据

导出流程：
1. 前端调用接口，传入目录路径
2. 后端自动检测数据类型（或使用指定类型）
3. 根据 export_format 选择导出格式
4. 返回 Base64 编码的文件内容
""",
    input_schema={
        "type": "object",
        "properties": {
            "folder_path": {
                "type": "string",
                "description": "要导出的目录路径（相对于仓库根或绝对路径），例如 backend_projects/SmartTavern/data/presets/Default"
            },
            "data_type": {
                "type": ["string", "null"],
                "description": "数据类型（可选，自动从路径检测）：preset, character, worldbook, persona, regex_rule, llm_config, plugin, style",
                "enum": ["preset", "character", "worldbook", "persona", "regex_rule", "llm_config", "plugin", "style", None]
            },
            "embed_image_base64": {
                "type": ["string", "null"],
                "description": "Base64 编码的 PNG 图片（可选），当 export_format 为 png 时使用"
            },
            "export_format": {
                "type": ["string", "null"],
                "description": "导出格式：zip（默认）、png、json",
                "enum": ["zip", "png", "json", None]
            }
        },
        "required": ["folder_path"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "message": {"type": "string"},
            "error": {"type": "string"},
            "data_type": {"type": "string"},
            "name": {"type": "string"},
            "format": {
                "type": "string",
                "description": "输出格式：zip、png 或 json"
            },
            "filename": {
                "type": "string",
                "description": "建议的文件名"
            },
            "content_base64": {
                "type": "string",
                "description": "Base64 编码的文件内容"
            },
            "size": {
                "type": "integer",
                "description": "文件大小（字节）"
            }
        },
        "required": ["success"],
        "additionalProperties": True
    },
)
def export_data(
    folder_path: str,
    data_type: Optional[str] = None,
    embed_image_base64: Optional[str] = None,
    export_format: Optional[str] = None
) -> Dict[str, Any]:
    """
    导出数据
    
    Args:
        folder_path: 要导出的目录路径
        data_type: 数据类型（可选，自动检测）
        embed_image_base64: Base64 编码的嵌入图片（可选）
        export_format: 导出格式（可选：'zip', 'png', 'json'）
        
    Returns:
        导出结果
    """
    return export_data_impl(
        folder_path=folder_path,
        data_type=data_type,
        embed_image_base64=embed_image_base64,
        export_format=export_format
    )


# ---------- 获取支持的类型 ----------

@core.register_api(
    path="smarttavern/data_import/get_supported_types",
    name="获取支持的导入/导出类型",
    description="获取支持导入/导出的数据类型和文件格式列表",
    input_schema={
        "type": "object",
        "properties": {},
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "types": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string"},
                        "dir": {"type": "string"},
                        "main_file": {"type": "string"}
                    }
                }
            },
            "formats": {
                "type": "array",
                "items": {"type": "string"}
            }
        },
        "required": ["success"],
        "additionalProperties": True
    },
)
def get_supported_types() -> Dict[str, Any]:
    """
    获取支持的导入/导出类型
    
    Returns:
        支持的类型信息
    """
    return get_supported_types_impl()


# ---------- 检查名称是否存在 ----------

@core.register_api(
    path="smarttavern/data_import/check_name_exists",
    name="检查名称是否存在",
    description="检查指定数据类型下是否已存在同名的文件夹",
    input_schema={
        "type": "object",
        "properties": {
            "data_type": {
                "type": "string",
                "description": "数据类型：preset, character, worldbook, persona, regex_rule, llm_config, plugin, style",
                "enum": ["preset", "character", "worldbook", "persona", "regex_rule", "llm_config", "plugin", "style"]
            },
            "name": {
                "type": "string",
                "description": "要检查的名称"
            }
        },
        "required": ["data_type", "name"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "exists": {"type": "boolean"},
            "folder_name": {"type": "string"},
            "suggested_name": {"type": ["string", "null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": ["success"],
        "additionalProperties": True
    },
)
def check_name_exists(data_type: str, name: str) -> Dict[str, Any]:
    """
    检查名称是否存在
    
    Args:
        data_type: 数据类型
        name: 要检查的名称
        
    Returns:
        检查结果
    """
    return check_name_exists_impl(data_type, name)