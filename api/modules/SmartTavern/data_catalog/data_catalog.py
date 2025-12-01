# -*- coding: utf-8 -*-
"""
API 封装层：SmartTavern.data_catalog

说明
- 遵循 DEVELOPMENT_NOTES：封装层仅做 API 注册与入参/出参契约定义；实现放在 impl.py
- 当前提供以下查询接口，返回每个文件的 name 与 description 字段（若存在）：
  • 预设（presets）
  • 世界书（world_books）
  • 角色卡（characters）
  • 用户（persona）
  • 正则规则（regex_rules）
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
import core
from .impl import (
    list_presets_impl,
    list_world_books_impl,
    list_characters_impl,
    list_personas_impl,
    list_regex_rules_impl,
    list_conversations_impl,
    list_llm_configs_impl,
    list_plugins_impl,
)


# ---------- 预设（presets） ----------

@core.register_api(
    path="smarttavern/data_catalog/list_presets",
    name="列出预设清单（名称与描述）",
    description="扫描 backend_projects/SmartTavern/data/presets 下的子目录（每个预设目录包含 preset.json），返回 preset.json 的相对路径与其 name/description 字段（若存在）。",
    input_schema={
        "type": "object",
        "properties": {},
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "folder": {"type": "string"},
            "total": {"type": "integer"},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string"},
                        "name": {"type": ["string", "null"]},
                        "description": {"type": ["string", "null"]}
                    },
                    "required": ["file"],
                    "additionalProperties": True
                }
            },
            "errors": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": ["string", "null"]},
                        "error": {"type": "string"}
                    },
                    "required": ["error"]
                }
            }
        },
        "required": ["folder", "total", "items"],
        "additionalProperties": False
    },
)
def list_presets(base_dir: Optional[str] = None,
                 fields: Optional[List[str]] = None) -> Dict[str, Any]:
    # 忽略入参，统一返回内置目录与全部字段
    return list_presets_impl()


# ---------- 世界书（world_books） ----------

@core.register_api(
    path="smarttavern/data_catalog/list_world_books",
    name="列出世界书清单（名称与描述）",
    description="扫描 backend_projects/SmartTavern/data/world_books 下的子目录（每个世界书目录包含 worldbook.json），返回 worldbook.json 的相对路径与其 name/description 字段（若存在）。",
    input_schema={
        "type": "object",
        "properties": {},
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "folder": {"type": "string"},
            "total": {"type": "integer"},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string"},
                        "name": {"type": ["string", "null"]},
                        "description": {"type": ["string", "null"]}
                    },
                    "required": ["file"],
                    "additionalProperties": True
                }
            },
            "errors": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": ["string", "null"]},
                        "error": {"type": "string"}
                    },
                    "required": ["error"]
                }
            }
        },
        "required": ["folder", "total", "items"],
        "additionalProperties": False
    },
)
def list_world_books(base_dir: Optional[str] = None,
                     fields: Optional[List[str]] = None) -> Dict[str, Any]:
    # 忽略入参，统一返回内置目录与全部字段
    return list_world_books_impl()


# ---------- 角色卡（characters） ----------

@core.register_api(
    path="smarttavern/data_catalog/list_characters",
    name="列出角色卡清单（名称、描述与类型）",
    description="扫描 backend_projects/SmartTavern/data/characters 下的子目录（每个角色目录包含 character.json），返回 character.json 的相对路径与其 name/description/type 字段（若存在）。type 字段支持 'threaded'（楼层对话模式，默认）和 'sandbox'（前端沙盒模式）。",
    input_schema={
        "type": "object",
        "properties": {},
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "folder": {"type": "string"},
            "total": {"type": "integer"},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string"},
                        "name": {"type": ["string", "null"]},
                        "description": {"type": ["string", "null"]},
                        "type": {"type": ["string", "null"], "enum": ["threaded", "sandbox", None]}
                    },
                    "required": ["file"],
                    "additionalProperties": True
                }
            },
            "errors": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": ["string", "null"]},
                        "error": {"type": "string"}
                    },
                    "required": ["error"]
                }
            }
        },
        "required": ["folder", "total", "items"],
        "additionalProperties": False
    },
)
def list_characters(base_dir: Optional[str] = None,
                    fields: Optional[List[str]] = None) -> Dict[str, Any]:
    # 忽略入参，统一返回内置目录与全部字段
    return list_characters_impl()


# ---------- 用户（persona） ----------

@core.register_api(
    path="smarttavern/data_catalog/list_personas",
    name="列出用户清单（名称与描述）",
    description="扫描 backend_projects/SmartTavern/data/personas 下的子目录（每个用户目录包含 persona.json），返回 persona.json 的相对路径与其 name/description 字段（若存在）。",
    input_schema={
        "type": "object",
        "properties": {},
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "folder": {"type": "string"},
            "total": {"type": "integer"},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string"},
                        "name": {"type": ["string", "null"]},
                        "description": {"type": ["string", "null"]}
                    },
                    "required": ["file"],
                    "additionalProperties": True
                }
            },
            "errors": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": ["string", "null"]},
                        "error": {"type": "string"}
                    },
                    "required": ["error"]
                }
            }
        },
        "required": ["folder", "total", "items"],
        "additionalProperties": False
    },
)
def list_personas(base_dir: Optional[str] = None,
                  fields: Optional[List[str]] = None) -> Dict[str, Any]:
    # 忽略入参，统一返回内置目录与全部字段
    return list_personas_impl()


# ---------- 正则规则（regex_rules） ----------

@core.register_api(
    path="smarttavern/data_catalog/list_regex_rules",
    name="列出正则规则清单（名称与描述）",
    description="扫描 backend_projects/SmartTavern/data/regex_rules 下的子目录（每个规则目录包含 regex_rule.json），返回 regex_rule.json 的相对路径与其 name/description 字段（若存在）。",
    input_schema={
        "type": "object",
        "properties": {},
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "folder": {"type": "string"},
            "total": {"type": "integer"},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string"},
                        "name": {"type": ["string", "null"]},
                        "description": {"type": ["string", "null"]}
                    },
                    "required": ["file"],
                    "additionalProperties": True
                }
            },
            "errors": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": ["string", "null"]},
                        "error": {"type": "string"}
                    },
                    "required": ["error"]
                }
            }
        },
        "required": ["folder", "total", "items"],
        "additionalProperties": False
    },
)
def list_regex_rules(base_dir: Optional[str] = None,
                     fields: Optional[List[str]] = None) -> Dict[str, Any]:
    return list_regex_rules_impl()

# ---------- 对话配置（conversations） ----------

@core.register_api(
    path="smarttavern/data_catalog/list_conversations",
    name="列出对话配置清单（名称与描述）",
    description="扫描 backend_projects/SmartTavern/data/conversations 下的 JSON 文件，返回文件相对路径与其 name/description 字段（若存在）。",
    input_schema={
        "type": "object",
        "properties": {},
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "folder": {"type": "string"},
            "total": {"type": "integer"},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string"},
                        "name": {"type": ["string", "null"]},
                        "description": {"type": ["string", "null"]}
                    },
                    "required": ["file"],
                    "additionalProperties": True
                }
            },
            "errors": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": ["string", "null"]},
                        "error": {"type": "string"}
                    },
                    "required": ["error"]
                }
            }
        },
        "required": ["folder", "total", "items"],
        "additionalProperties": False
    },
)
def list_conversations(base_dir: Optional[str] = None,
                       fields: Optional[List[str]] = None) -> Dict[str, Any]:
    # 忽略入参，统一返回内置目录与全部字段
    return list_conversations_impl()


# ---------- 获取对话详情（读取单个文件） ----------
@core.register_api(
    path="smarttavern/data_catalog/get_conversation_detail",
    name="获取对话详情",
    description="读取 backend_projects/SmartTavern/data/conversations 下指定 JSON 文件，返回完整内容与基础字段。",
    input_schema={
        "type": "object",
        "properties": {
            "file": {
                "type": "string",
                "description": "列表接口返回的 file 相对路径（POSIX 风格），例如 backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json"
            }
        },
        "required": ["file"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "name": {"type": ["string", "null"]},
            "description": {"type": ["string", "null"]},
            "content": {"type": ["object", "array", "null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def get_conversation_detail(file: str) -> Dict[str, Any]:
    from .impl import get_conversation_detail_impl
    return get_conversation_detail_impl(file=file)

# ---------- 获取对话中单个消息节点 ----------
@core.register_api(
    path="smarttavern/data_catalog/get_node_detail",
    name="获取对话中单个消息节点",
    description="读取 conversations 下指定对话文件，仅返回 nodes[node_id] 的节点信息。",
    input_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string", "description": "对话文件路径，相对仓库根（POSIX）"},
            "node_id": {"type": "string", "description": "消息节点ID，如 n_ass..."}
        },
        "required": ["file", "node_id"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "file": {"type": "string"},
            "node_id": {"type": "string"},
            "node": {"type": ["object", "null"], "additionalProperties": True},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": ["success"],
        "additionalProperties": True
    }
)
def get_node_detail(file: str, node_id: str) -> Dict[str, Any]:
    from .impl import get_node_detail_impl
    return get_node_detail_impl(file=file, node_id=node_id)

# ---------- 获取预设详情（读取单个文件） ----------

@core.register_api(
    path="smarttavern/data_catalog/get_preset_detail",
    name="获取预设详情",
    description="读取 backend_projects/SmartTavern/data/presets 下指定 JSON 文件，返回完整内容与基础字段。",
    input_schema={
        "type": "object",
        "properties": {
            "file": {
                "type": "string",
                "description": "列表接口返回的 file 相对路径（POSIX 风格），例如 backend_projects/SmartTavern/data/presets/Default/preset.json"
            }
        },
        "required": ["file"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "name": {"type": ["string", "null"]},
            "description": {"type": ["string", "null"]},
            "content": {"type": ["object", "array", "null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def get_preset_detail(file: str) -> Dict[str, Any]:
    # 延迟导入，避免在顶层修改 import 列表导致潜在循环
    from .impl import get_preset_detail_impl
    return get_preset_detail_impl(file=file)

# ---------- 获取世界书详情（读取单个文件） ----------

@core.register_api(
    path="smarttavern/data_catalog/get_world_book_detail",
    name="获取世界书详情",
    description="读取 backend_projects/SmartTavern/data/world_books 下指定 JSON 文件，返回完整内容与基础字段。",
    input_schema={
        "type": "object",
        "properties": {
            "file": {
                "type": "string",
                "description": "列表接口返回的 file 相对路径（POSIX 风格），例如 backend_projects/SmartTavern/data/world_books/参考用main_world/worldbook.json"
            }
        },
        "required": ["file"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "name": {"type": ["string", "null"]},
            "description": {"type": ["string", "null"]},
            "content": {"type": ["object", "array", "null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def get_world_book_detail(file: str) -> Dict[str, Any]:
    from .impl import get_world_book_detail_impl
    return get_world_book_detail_impl(file=file)


# ---------- 获取角色卡详情（读取单个文件） ----------

@core.register_api(
    path="smarttavern/data_catalog/get_character_detail",
    name="获取角色卡详情",
    description="读取 backend_projects/SmartTavern/data/characters 下指定角色目录的 character.json 文件，返回完整内容与基础字段。",
    input_schema={
        "type": "object",
        "properties": {
            "file": {
                "type": "string",
                "description": "列表接口返回的 file 相对路径（POSIX 风格），例如 backend_projects/SmartTavern/data/characters/许莲笙/character.json"
            }
        },
        "required": ["file"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "name": {"type": ["string", "null"]},
            "description": {"type": ["string", "null"]},
            "content": {"type": ["object", "array", "null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def get_character_detail(file: str) -> Dict[str, Any]:
    from .impl import get_character_detail_impl
    return get_character_detail_impl(file=file)


# ---------- 获取用户画像详情（读取单个文件） ----------

@core.register_api(
    path="smarttavern/data_catalog/get_persona_detail",
    name="获取用户画像详情",
    description="读取 backend_projects/SmartTavern/data/personas 下指定用户目录的 persona.json 文件，返回完整内容与基础字段。",
    input_schema={
        "type": "object",
        "properties": {
            "file": {
                "type": "string",
                "description": "列表接口返回的 file 相对路径（POSIX 风格），例如 backend_projects/SmartTavern/data/personas/用户2/persona.json"
            }
        },
        "required": ["file"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "name": {"type": ["string", "null"]},
            "description": {"type": ["string", "null"]},
            "content": {"type": ["object", "array", "null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def get_persona_detail(file: str) -> Dict[str, Any]:
    from .impl import get_persona_detail_impl
    return get_persona_detail_impl(file=file)


# ---------- 获取正则规则详情（读取单个文件） ----------

@core.register_api(
    path="smarttavern/data_catalog/get_regex_rule_detail",
    name="获取正则规则详情",
    description="读取 backend_projects/SmartTavern/data/regex_rules 下指定 JSON 文件，返回完整内容与基础字段。",
    input_schema={
        "type": "object",
        "properties": {
            "file": {
                "type": "string",
                "description": "列表接口返回的 file 相对路径（POSIX 风格），例如 backend_projects/SmartTavern/data/regex_rules/remove_xml_tags/regex_rule.json"
            }
        },
        "required": ["file"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "name": {"type": ["string", "null"]},
            "description": {"type": ["string", "null"]},
            "content": {"type": ["object", "array", "null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def get_regex_rule_detail(file: str) -> Dict[str, Any]:
    from .impl import get_regex_rule_detail_impl
    return get_regex_rule_detail_impl(file=file)


# ---------- 保存（创建/更新）文件接口：按类型 ----------

@core.register_api(
    path="smarttavern/data_catalog/update_preset_file",
    name="保存预设文件",
    description="在 presets 目录创建或更新指定 JSON 文件。若提供 name/description，将写入 content 顶层。若提供 icon_base64，将保存为同目录下的 icon.png。",
    input_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string", "description": "相对仓库根的 POSIX 路径，如 backend_projects/SmartTavern/data/presets/Your.json"},
            "content": {"type": ["object","array"]},
            "name": {"type": ["string","null"]},
            "description": {"type": ["string","null"]},
            "icon_base64": {"type": ["string","null"], "description": "图标的 Base64 编码（可选，保存为 icon.png）"}
        },
        "required": ["file", "content"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "name": {"type": ["string","null"]},
            "description": {"type": ["string","null"]},
            "content": {"type": ["object","array","null"]},
            "icon_path": {"type": ["string","null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def update_preset_file(file: str, content: dict, name: str = None, description: str = None, icon_base64: str = None) -> Dict[str, Any]:
    from .impl import update_preset_file_impl
    payload: Dict[str, Any] = {"content": content}
    if name is not None:
        payload["name"] = name
    if description is not None:
        payload["description"] = description
    if icon_base64 is not None:
        payload["icon_base64"] = icon_base64
    return update_preset_file_impl(file=file, payload=payload)


@core.register_api(
    path="smarttavern/data_catalog/update_world_book_file",
    name="保存世界书文件",
    description="在 world_books 目录创建或更新指定 JSON 文件。若提供 name/description，将写入 content 顶层。若提供 icon_base64，将保存为同目录下的 icon.png。",
    input_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "content": {"type": ["object","array"]},
            "name": {"type": ["string","null"]},
            "description": {"type": ["string","null"]},
            "icon_base64": {"type": ["string","null"], "description": "图标的 Base64 编码（可选，保存为 icon.png）"}
        },
        "required": ["file", "content"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "name": {"type": ["string","null"]},
            "description": {"type": ["string","null"]},
            "content": {"type": ["object","array","null"]},
            "icon_path": {"type": ["string","null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def update_world_book_file(file: str, content: dict, name: str = None, description: str = None, icon_base64: str = None) -> Dict[str, Any]:
    from .impl import update_world_book_file_impl
    payload: Dict[str, Any] = {"content": content}
    if name is not None:
        payload["name"] = name
    if description is not None:
        payload["description"] = description
    if icon_base64 is not None:
        payload["icon_base64"] = icon_base64
    return update_world_book_file_impl(file=file, payload=payload)


@core.register_api(
    path="smarttavern/data_catalog/update_character_file",
    name="保存角色卡文件",
    description="在 characters 目录创建或更新指定 JSON 文件。若提供 name/description，将写入 content 顶层。若提供 icon_base64，将保存为同目录下的 icon.png。若提供 avatar_base64，将保存为同目录下的 character.png。",
    input_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "content": {"type": ["object","array"]},
            "name": {"type": ["string","null"]},
            "description": {"type": ["string","null"]},
            "icon_base64": {"type": ["string","null"], "description": "图标的 Base64 编码（可选，保存为 icon.png）"},
            "avatar_base64": {"type": ["string","null"], "description": "头像的 Base64 编码（可选，保存为 character.png）"}
        },
        "required": ["file", "content"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "name": {"type": ["string","null"]},
            "description": {"type": ["string","null"]},
            "content": {"type": ["object","array","null"]},
            "icon_path": {"type": ["string","null"]},
            "avatar_path": {"type": ["string","null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def update_character_file(file: str, content: dict, name: str = None, description: str = None, icon_base64: str = None, avatar_base64: str = None) -> Dict[str, Any]:
    from .impl import update_character_file_impl
    payload: Dict[str, Any] = {"content": content}
    if name is not None:
        payload["name"] = name
    if description is not None:
        payload["description"] = description
    if icon_base64 is not None:
        payload["icon_base64"] = icon_base64
    if avatar_base64 is not None:
        payload["avatar_base64"] = avatar_base64
    return update_character_file_impl(file=file, payload=payload)


@core.register_api(
    path="smarttavern/data_catalog/update_persona_file",
    name="保存用户画像文件",
    description="在 persona 目录创建或更新指定 JSON 文件。若提供 name/description，将写入 content 顶层。若提供 icon_base64，将保存为同目录下的 icon.png。若提供 avatar_base64，将保存为同目录下的 persona.png。",
    input_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "content": {"type": ["object","array"]},
            "name": {"type": ["string","null"]},
            "description": {"type": ["string","null"]},
            "icon_base64": {"type": ["string","null"], "description": "图标的 Base64 编码（可选，保存为 icon.png）"},
            "avatar_base64": {"type": ["string","null"], "description": "头像的 Base64 编码（可选，保存为 persona.png）"}
        },
        "required": ["file", "content"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "name": {"type": ["string","null"]},
            "description": {"type": ["string","null"]},
            "content": {"type": ["object","array","null"]},
            "icon_path": {"type": ["string","null"]},
            "avatar_path": {"type": ["string","null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def update_persona_file(file: str, content: dict, name: str = None, description: str = None, icon_base64: str = None, avatar_base64: str = None) -> Dict[str, Any]:
    from .impl import update_persona_file_impl
    payload: Dict[str, Any] = {"content": content}
    if name is not None:
        payload["name"] = name
    if description is not None:
        payload["description"] = description
    if icon_base64 is not None:
        payload["icon_base64"] = icon_base64
    if avatar_base64 is not None:
        payload["avatar_base64"] = avatar_base64
    return update_persona_file_impl(file=file, payload=payload)


@core.register_api(
    path="smarttavern/data_catalog/update_regex_rule_file",
    name="保存正则规则文件",
    description="在 regex_rules 目录创建或更新指定 JSON 文件。若提供 name/description，将写入 content 顶层。若提供 icon_base64，将保存为同目录下的 icon.png。",
    input_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "content": {"type": ["object","array"]},
            "name": {"type": ["string","null"]},
            "description": {"type": ["string","null"]},
            "icon_base64": {"type": ["string","null"], "description": "图标的 Base64 编码（可选，保存为 icon.png）"}
        },
        "required": ["file", "content"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "name": {"type": ["string","null"]},
            "description": {"type": ["string","null"]},
            "content": {"type": ["object","array","null"]},
            "icon_path": {"type": ["string","null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def update_regex_rule_file(file: str, content: dict, name: str = None, description: str = None, icon_base64: str = None) -> Dict[str, Any]:
    from .impl import update_regex_rule_file_impl
    payload: Dict[str, Any] = {"content": content}
    if name is not None:
        payload["name"] = name
    if description is not None:
        payload["description"] = description
    if icon_base64 is not None:
        payload["icon_base64"] = icon_base64
    return update_regex_rule_file_impl(file=file, payload=payload)


# ---------- LLM配置（llm_configs） ----------

@core.register_api(
    path="smarttavern/data_catalog/list_llm_configs",
    name="列出LLM配置清单（名称与描述）",
    description="扫描 backend_projects/SmartTavern/data/llm_configs 下的子目录（每个配置目录包含 llm_config.json），返回 llm_config.json 的相对路径与其 name/description 字段（若存在）。",
    input_schema={
        "type": "object",
        "properties": {},
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "folder": {"type": "string"},
            "total": {"type": "integer"},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string"},
                        "name": {"type": ["string", "null"]},
                        "description": {"type": ["string", "null"]}
                    },
                    "required": ["file"],
                    "additionalProperties": True
                }
            },
            "errors": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": ["string", "null"]},
                        "error": {"type": "string"}
                    },
                    "required": ["error"]
                }
            }
        },
        "required": ["folder", "total", "items"],
        "additionalProperties": False
    },
)
def list_llm_configs(base_dir: Optional[str] = None,
                     fields: Optional[List[str]] = None) -> Dict[str, Any]:
    return list_llm_configs_impl()


@core.register_api(
    path="smarttavern/data_catalog/get_llm_config_detail",
    name="获取LLM配置详情",
    description="读取 backend_projects/SmartTavern/data/llm_configs 下指定 JSON 文件，返回完整内容与基础字段。",
    input_schema={
        "type": "object",
        "properties": {
            "file": {
                "type": "string",
                "description": "列表接口返回的 file 相对路径（POSIX 风格），例如 backend_projects/SmartTavern/data/llm_configs/openai_gpt4/llm_config.json"
            }
        },
        "required": ["file"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "name": {"type": ["string", "null"]},
            "description": {"type": ["string", "null"]},
            "content": {"type": ["object", "array", "null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def get_llm_config_detail(file: str) -> Dict[str, Any]:
    from .impl import get_llm_config_detail_impl
    return get_llm_config_detail_impl(file=file)


@core.register_api(
    path="smarttavern/data_catalog/update_llm_config_file",
    name="保存LLM配置文件",
    description="在 llm_configs 目录创建或更新指定 JSON 文件。若提供 name/description，将写入 content 顶层。若提供 icon_base64，将保存为同目录下的 icon.png。",
    input_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "content": {"type": ["object","array"]},
            "name": {"type": ["string","null"]},
            "description": {"type": ["string","null"]},
            "icon_base64": {"type": ["string","null"], "description": "图标的 Base64 编码（可选，保存为 icon.png）"}
        },
        "required": ["file", "content"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "name": {"type": ["string","null"]},
            "description": {"type": ["string","null"]},
            "content": {"type": ["object","array","null"]},
            "icon_path": {"type": ["string","null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def update_llm_config_file(file: str, content: dict, name: str = None, description: str = None, icon_base64: str = None) -> Dict[str, Any]:
    from .impl import update_llm_config_file_impl
    payload: Dict[str, Any] = {"content": content}
    if name is not None:
        payload["name"] = name
    if description is not None:
        payload["description"] = description
    if icon_base64 is not None:
        payload["icon_base64"] = icon_base64
    return update_llm_config_file_impl(file=file, payload=payload)


# ---------- 插件（plugins） ----------

@core.register_api(
    path="smarttavern/data_catalog/list_plugins",
    name="列出插件清单（名称与描述）",
    description="扫描 backend_projects/SmartTavern/plugins 下的插件目录，仅读取各自 manifest.json 的 name/description。必须存在 plugins_switch.json（位于 plugins 根目录）；接口会根据开关文件中 enabled 与 disabled 两个列表合并出需要扫描的插件集（均需展示），若声明的目录缺失则在 errors 返回提示。",
    input_schema={
        "type": "object",
        "properties": {},
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "folder": {"type": "string"},
            "total": {"type": "integer"},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "dir": {"type": "string"},
                        "name": {"type": ["string", "null"]},
                        "description": {"type": ["string", "null"]}
                    },
                    "required": ["dir"],
                    "additionalProperties": True
                }
            },
            "errors": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": ["string", "null"]},
                        "error": {"type": "string"}
                    },
                    "required": ["error"]
                }
            }
        },
        "required": ["folder", "total", "items"],
        "additionalProperties": False
    },
)
def list_plugins(base_dir: Optional[str] = None,
                 fields: Optional[List[str]] = None) -> Dict[str, Any]:
    return list_plugins_impl()


# ---------- 插件开关文件（plugins_switch.json） ----------
@core.register_api(
    path="smarttavern/data_catalog/get_plugins_switch",
    name="获取插件开关文件",
    description="读取 backend_projects/SmartTavern/plugins/plugins_switch.json 内容；若不存在则返回 error=SWITCH_MISSING 并提示缺失。",
    input_schema={"type": "object", "properties": {}, "additionalProperties": False},
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "enabled": {"type": ["array","null"], "items": {"type": "string"}},
            "disabled": {"type": ["array","null"], "items": {"type": "string"}},
            "error": {"type": "string"},
            "message": {"type": "string"},
        },
        "required": ["file"],
        "additionalProperties": True
    },
)
def get_plugins_switch() -> Dict[str, Any]:
    from .impl import get_plugins_switch_impl
    return get_plugins_switch_impl()

@core.register_api(
    path="smarttavern/data_catalog/update_plugins_switch",
    name="更新插件开关文件",
    description="更新 backend_projects/SmartTavern/plugins/plugins_switch.json，结构：{ enabled:string[], disabled?:string[] }",
    input_schema={
        "type": "object",
        "properties": {
            "content": {"type": "object"}
        },
        "required": ["content"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "enabled": {"type": ["array","null"], "items": {"type": "string"}},
            "disabled": {"type": ["array","null"], "items": {"type": "string"}},
            "error": {"type": "string"},
            "message": {"type": "string"},
        },
        "required": ["file"],
        "additionalProperties": True
    },
)
def update_plugins_switch(content: Dict[str, Any]) -> Dict[str, Any]:
    from .impl import update_plugins_switch_impl
    return update_plugins_switch_impl(content=content)

# ---------- 获取 plugins 资产（二进制） ----------
@core.register_api(
    path="smarttavern/data_catalog/get_plugins_asset",
    name="获取插件资产（二进制Base64）",
    description="读取 backend_projects/SmartTavern/plugins 下指定文件，返回 Base64 内容与 MIME。",
    input_schema={
        "type": "object",
        "properties": {
            "file": {
                "type": "string",
                "description": "列表接口返回或手写的相对路径（POSIX 风格），例如 backend_projects/SmartTavern/plugins/my-plugin/logo.png"
            }
        },
        "required": ["file"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "mime": {"type": "string"},
            "size": {"type": "integer"},
            "content_base64": {"type": "string"},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def get_plugins_asset(file: str) -> Dict[str, Any]:
    from .impl import get_plugins_asset_impl
    return get_plugins_asset_impl(file=file)


# ---------- 获取 data 资产（二进制） ----------
# ---------- 通用删除数据目录接口 ----------

@core.register_api(
    path="smarttavern/data_catalog/delete_data_folder",
    name="删除数据目录",
    description="""通用的删除数据目录接口。删除指定的数据目录（整个文件夹，包括其中所有文件）。

仅允许删除以下类型的目录：
- 预设 (backend_projects/SmartTavern/data/presets/...)
- 世界书 (backend_projects/SmartTavern/data/world_books/...)
- 角色卡 (backend_projects/SmartTavern/data/characters/...)
- 用户画像 (backend_projects/SmartTavern/data/personas/...)
- 正则规则 (backend_projects/SmartTavern/data/regex_rules/...)
- LLM配置 (backend_projects/SmartTavern/data/llm_configs/...)
- 对话 (backend_projects/SmartTavern/data/conversations/...)
- 插件 (backend_projects/SmartTavern/plugins/...)

注意：
1. 不能删除类型根目录本身（例如整个 presets 目录）。
2. 删除插件时会自动从 plugins_switch.json 中移除对应的注册。""",
    input_schema={
        "type": "object",
        "properties": {
            "folder_path": {
                "type": "string",
                "description": "要删除的目录路径（POSIX 风格），例如 backend_projects/SmartTavern/data/presets/Default"
            }
        },
        "required": ["folder_path"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "deleted_path": {"type": "string"},
            "data_type": {"type": "string", "description": "被删除目录的数据类型"},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": ["success"],
        "additionalProperties": True
    },
)
def delete_data_folder(folder_path: str) -> Dict[str, Any]:
    from .impl import delete_data_folder_impl
    return delete_data_folder_impl(folder_path=folder_path)


@core.register_api(
    path="smarttavern/data_catalog/get_data_asset",
    name="获取数据资产（二进制Base64）",
    description="读取 backend_projects/SmartTavern/data 下指定文件，返回 Base64 内容与 MIME。",
    input_schema={
        "type": "object",
        "properties": {
            "file": {
                "type": "string",
                "description": "相对仓库根的 POSIX 路径，例如 backend_projects/SmartTavern/data/characters/心与露/icon.png"
            }
        },
        "required": ["file"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "mime": {"type": "string"},
            "size": {"type": "integer"},
            "content_base64": {"type": "string"},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def get_data_asset(file: str) -> Dict[str, Any]:
    from .impl import get_data_asset_impl
    return get_data_asset_impl(file=file)


# ---------- 获取插件详情（读取单个插件的 manifest.json） ----------

@core.register_api(
    path="smarttavern/data_catalog/get_plugin_detail",
    name="获取插件详情",
    description="读取 backend_projects/SmartTavern/plugins 下指定插件目录的 manifest.json 文件，返回完整内容与基础字段。",
    input_schema={
        "type": "object",
        "properties": {
            "dir": {
                "type": "string",
                "description": "插件目录路径（POSIX 风格），例如 backend_projects/SmartTavern/plugins/context-variables"
            }
        },
        "required": ["dir"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "dir": {"type": "string"},
            "file": {"type": "string"},
            "name": {"type": ["string", "null"]},
            "description": {"type": ["string", "null"]},
            "content": {"type": ["object", "null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def get_plugin_detail(dir: str) -> Dict[str, Any]:
    from .impl import get_plugin_detail_impl
    return get_plugin_detail_impl(dir_path=dir)


# ---------- 保存插件文件（更新 manifest.json） ----------

@core.register_api(
    path="smarttavern/data_catalog/update_plugin_file",
    name="保存插件文件",
    description="更新 plugins 目录下指定插件的 manifest.json 文件。仅允许修改 name 和 description 字段，其他字段保持不变。若提供 icon_base64，将保存为同目录下的 icon.png。",
    input_schema={
        "type": "object",
        "properties": {
            "dir": {"type": "string", "description": "插件目录路径（POSIX 风格），例如 backend_projects/SmartTavern/plugins/context-variables"},
            "name": {"type": ["string", "null"]},
            "description": {"type": ["string", "null"]},
            "icon_base64": {"type": ["string", "null"], "description": "图标的 Base64 编码（可选，保存为 icon.png；空字符串表示删除图标）"}
        },
        "required": ["dir"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "dir": {"type": "string"},
            "file": {"type": "string"},
            "name": {"type": ["string", "null"]},
            "description": {"type": ["string", "null"]},
            "content": {"type": ["object", "null"]},
            "icon_path": {"type": ["string", "null"]},
            "icon_deleted": {"type": ["boolean", "null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def update_plugin_file(dir: str, name: str = None, description: str = None, icon_base64: str = None) -> Dict[str, Any]:
    from .impl import update_plugin_file_impl
    payload: Dict[str, Any] = {}
    if name is not None:
        payload["name"] = name
    if description is not None:
        payload["description"] = description
    if icon_base64 is not None:
        payload["icon_base64"] = icon_base64
    return update_plugin_file_impl(dir_path=dir, payload=payload)


# ---------- 创建数据文件夹 ----------

@core.register_api(
    path="smarttavern/data_catalog/create_data_folder",
    name="创建数据文件夹",
    description="""创建新的数据文件夹并初始化必要文件。支持创建以下类型：
- preset: 在 backend_projects/SmartTavern/data/presets 下创建目录和 preset.json
- worldbook: 在 backend_projects/SmartTavern/data/world_books 下创建目录和 worldbook.json
- character: 在 backend_projects/SmartTavern/data/characters 下创建目录和 character.json
- persona: 在 backend_projects/SmartTavern/data/personas 下创建目录和 persona.json
- regex_rule: 在 backend_projects/SmartTavern/data/regex_rules 下创建目录和 regex_rule.json
- llm_config: 在 backend_projects/SmartTavern/data/llm_configs 下创建目录和 llm_config.json

自动检测文件夹名称重复，避免覆盖现有数据。
可选提供图标的Base64编码，会保存为 icon.png。""",
    input_schema={
        "type": "object",
        "properties": {
            "data_type": {
                "type": "string",
                "enum": ["preset", "worldbook", "character", "persona", "regex_rule", "llm_config"],
                "description": "数据类型"
            },
            "name": {
                "type": "string",
                "description": "名称（将写入JSON文件的name字段）"
            },
            "description": {
                "type": "string",
                "description": "描述（可选，将写入JSON文件的description字段）"
            },
            "folder_name": {
                "type": "string",
                "description": "文件夹名称（目录名）"
            },
            "icon_base64": {
                "type": ["string", "null"],
                "description": "图标的Base64编码（可选，保存为icon.png）"
            }
        },
        "required": ["data_type", "name", "folder_name"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "data_type": {"type": "string"},
            "folder_path": {"type": "string"},
            "file_path": {"type": "string"},
            "icon_path": {"type": ["string", "null"]},
            "name": {"type": "string"},
            "description": {"type": ["string", "null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": ["success"],
        "additionalProperties": True
    },
)
def create_data_folder(data_type: str, name: str, description: str = None, folder_name: str = None, icon_base64: str = None) -> Dict[str, Any]:
    from .impl import create_data_folder_impl
    return create_data_folder_impl(
        data_type=data_type,
        name=name,
        description=description,
        folder_name=folder_name,
        icon_base64=icon_base64
    )