# -*- coding: utf-8 -*-
"""
API 封装层：SmartTavern.styles

说明
- 遵循 DEVELOPMENT_NOTES：封装层仅做 API 注册与入参/出参契约定义；实现放在 impl.py
- 提供主题/外观文件的管理接口：
  • 列出主题（list_themes）
  • 获取主题开关（get_styles_switch）
  • 更新主题开关（update_styles_switch）
  • 获取主题详情（get_theme_detail）
  • 获取主题入口文件内容（get_theme_entries）
  • 获取主题资产（get_theme_asset）
  • 删除主题（delete_theme）
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
import core
from .impl import (
    list_themes_impl,
    get_styles_switch_impl,
    update_styles_switch_impl,
    get_theme_detail_impl,
    get_theme_entries_impl,
    get_theme_asset_impl,
    delete_theme_impl,
    get_all_enabled_themes_impl,
    get_page_backgrounds_hash_impl,
    get_page_background_impl,
    list_page_backgrounds_impl,
    upload_page_background_impl,
    update_theme_file_impl,
)


# ---------- 列出主题 ----------

@core.register_api(
    path="smarttavern/styles/list_themes",
    name="列出主题清单",
    description="""扫描 backend_projects/SmartTavern/styles 下的主题目录（每个 .sttheme 目录包含 manifest.json），
返回主题的名称、描述、入口文件列表及启用状态。

主题目录结构：
  backend_projects/SmartTavern/styles/
    ├── styles_switch.json       # 启用/禁用开关
    ├── demo-ocean.sttheme/      # 主题目录（以 .sttheme 结尾）
    │   ├── manifest.json        # 主题清单
    │   └── demo-ocean.sttheme.json  # 主题内容文件（entries中声明）
    └── ...

返回示例：
{
    "folder": "backend_projects/SmartTavern/styles",
    "total": 1,
    "items": [
        {
            "dir": "backend_projects/SmartTavern/styles/demo-ocean.sttheme",
            "name": "Demo Ocean",
            "description": "demo-ocean",
            "entries": ["demo-ocean.sttheme.json"],
            "enabled": true
        }
    ]
}""",
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
                        "description": {"type": ["string", "null"]},
                        "entries": {"type": "array", "items": {"type": "string"}},
                        "enabled": {"type": "boolean"}
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
def list_themes(base_dir: Optional[str] = None) -> Dict[str, Any]:
    return list_themes_impl(base_dir=base_dir)


# ---------- 获取主题开关文件 ----------

@core.register_api(
    path="smarttavern/styles/get_styles_switch",
    name="获取主题开关文件",
    description="""读取 backend_projects/SmartTavern/styles/styles_switch.json 内容。
若不存在则返回 error=SWITCH_MISSING。

开关文件结构：
{
    "enabled": ["demo-ocean.sttheme"],   # 启用的主题列表
    "disabled": []                       # 禁用的主题列表（可选）
}""",
    input_schema={
        "type": "object",
        "properties": {},
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "file": {"type": "string"},
            "enabled": {"type": ["array", "null"], "items": {"type": "string"}},
            "disabled": {"type": ["array", "null"], "items": {"type": "string"}},
            "error": {"type": "string"},
            "message": {"type": "string"},
        },
        "required": ["file"],
        "additionalProperties": True
    },
)
def get_styles_switch() -> Dict[str, Any]:
    return get_styles_switch_impl()


# ---------- 更新主题开关文件 ----------

@core.register_api(
    path="smarttavern/styles/update_styles_switch",
    name="更新主题开关文件",
    description="""更新 backend_projects/SmartTavern/styles/styles_switch.json。

输入结构：
{
    "enabled": ["theme-a.sttheme", "theme-b.sttheme"],  # 启用的主题列表
    "disabled": ["theme-c.sttheme"]                     # 禁用的主题列表（可选，不提供则自动计算）
}

规则：
- enabled 必须为数组（可为空）
- disabled 若不提供，则自动计算为"所有主题目录 - enabled"
""",
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
            "enabled": {"type": ["array", "null"], "items": {"type": "string"}},
            "disabled": {"type": ["array", "null"], "items": {"type": "string"}},
            "error": {"type": "string"},
            "message": {"type": "string"},
        },
        "required": ["file"],
        "additionalProperties": True
    },
)
def update_styles_switch(content: Dict[str, Any]) -> Dict[str, Any]:
    return update_styles_switch_impl(content=content)


# ---------- 获取主题详情 ----------

@core.register_api(
    path="smarttavern/styles/get_theme_detail",
    name="获取主题详情",
    description="""读取指定主题目录的 manifest.json，返回主题元信息。

入参：
- theme_dir: 主题目录路径，例如 "backend_projects/SmartTavern/styles/demo-ocean.sttheme"

返回主题的名称、描述、入口文件列表及完整 manifest 内容。""",
    input_schema={
        "type": "object",
        "properties": {
            "theme_dir": {
                "type": "string",
                "description": "主题目录路径（POSIX 风格），例如 backend_projects/SmartTavern/styles/demo-ocean.sttheme"
            }
        },
        "required": ["theme_dir"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "dir": {"type": "string"},
            "name": {"type": ["string", "null"]},
            "description": {"type": ["string", "null"]},
            "entries": {"type": "array", "items": {"type": "string"}},
            "manifest": {"type": ["object", "null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def get_theme_detail(theme_dir: str) -> Dict[str, Any]:
    return get_theme_detail_impl(theme_dir=theme_dir)


# ---------- 获取主题入口文件内容 ----------

@core.register_api(
    path="smarttavern/styles/get_theme_entries",
    name="获取主题入口文件内容",
    description="""读取指定主题目录的所有 entry 文件内容，并合并返回前端可直接消费的 ThemePackV1 格式。

入参：
- theme_dir: 主题目录路径

返回结构：
{
    "dir": "...",
    "name": "Demo Ocean",
    "merged_pack": {
        "id": "demo-ocean",
        "name": "Demo Ocean",
        "version": "1.0.0",
        "tokens": { "--st-primary": "56 189 248", ... },
        "css": "/* additional CSS */"
    },
    "entries": [
        { "file": "demo-ocean.sttheme.json", "content": {...} }
    ]
}

merged_pack 字段包含合并后的主题包，可直接传递给前端 ThemeManager.applyThemePack()。""",
    input_schema={
        "type": "object",
        "properties": {
            "theme_dir": {
                "type": "string",
                "description": "主题目录路径（POSIX 风格）"
            }
        },
        "required": ["theme_dir"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "dir": {"type": "string"},
            "name": {"type": ["string", "null"]},
            "merged_pack": {
                "type": "object",
                "properties": {
                    "id": {"type": ["string", "null"]},
                    "name": {"type": ["string", "null"]},
                    "version": {"type": ["string", "null"]},
                    "tokens": {"type": "object"},
                    "tokensLight": {"type": "object"},
                    "tokensDark": {"type": "object"},
                    "css": {"type": "string"},
                    "cssLight": {"type": "string"},
                    "cssDark": {"type": "string"}
                },
                "additionalProperties": True
            },
            "entries": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string"},
                        "content": {"type": "object"}
                    }
                }
            },
            "errors": {"type": "array"},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def get_theme_entries(theme_dir: str) -> Dict[str, Any]:
    return get_theme_entries_impl(theme_dir=theme_dir)


# ---------- 获取主题资产 ----------

@core.register_api(
    path="smarttavern/styles/get_theme_asset",
    name="获取主题资产（二进制Base64）",
    description="""读取 backend_projects/SmartTavern/styles 下指定文件，返回 Base64 内容与 MIME。
支持读取主题中的 JSON、CSS、图片等任意文件。

入参：
- file: 文件路径（POSIX 风格），例如 "backend_projects/SmartTavern/styles/demo-ocean.sttheme/demo-ocean.sttheme.json"
""",
    input_schema={
        "type": "object",
        "properties": {
            "file": {
                "type": "string",
                "description": "文件路径（POSIX 风格）"
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
def get_theme_asset(file: str) -> Dict[str, Any]:
    return get_theme_asset_impl(file=file)


# ---------- 删除主题 ----------

@core.register_api(
    path="smarttavern/styles/delete_theme",
    name="删除主题",
    description="""删除指定的主题目录（整个 .sttheme 文件夹）。
删除后会自动从 styles_switch.json 中移除注册。

入参：
- theme_dir: 主题目录路径（POSIX 风格）

注意：此操作不可逆，会删除整个主题目录及其所有文件。""",
    input_schema={
        "type": "object",
        "properties": {
            "theme_dir": {
                "type": "string",
                "description": "主题目录路径（POSIX 风格），例如 backend_projects/SmartTavern/styles/demo-ocean.sttheme"
            }
        },
        "required": ["theme_dir"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "deleted_path": {"type": "string"},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": ["success"],
        "additionalProperties": True
    },
)
def delete_theme(theme_dir: str) -> Dict[str, Any]:
    return delete_theme_impl(theme_dir=theme_dir)


# ---------- 获取所有启用主题的合并包 ----------

@core.register_api(
    path="smarttavern/styles/get_all_enabled_themes",
    name="获取所有启用主题的合并包",
    description="""读取所有启用的主题，按 order 顺序合并后返回。
顺序靠前的主题优先级更高（会覆盖后面的主题）。

合并逻辑：
- tokens/tokensLight/tokensDark: 顺序靠前的覆盖靠后的
- css/cssLight/cssDark: 顺序靠前的在 CSS 后面声明（CSS 后声明的优先级更高）

返回结构：
{
    "enabled_count": 2,
    "enabled_themes": ["theme-a", "theme-b"],
    "merged_pack": {
        "id": "merged",
        "name": "Merged Themes",
        "tokens": {...},
        "css": "..."
    }
}

merged_pack 可直接传递给前端 ThemeManager.applyThemePack()。""",
    input_schema={
        "type": "object",
        "properties": {},
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "enabled_count": {"type": "integer"},
            "enabled_themes": {
                "type": "array",
                "items": {"type": "string"}
            },
            "merged_pack": {
                "type": ["object", "null"],
                "properties": {
                    "id": {"type": ["string", "null"]},
                    "name": {"type": ["string", "null"]},
                    "version": {"type": ["string", "null"]},
                    "tokens": {"type": "object"},
                    "tokensLight": {"type": "object"},
                    "tokensDark": {"type": "object"},
                    "css": {"type": "string"},
                    "cssLight": {"type": "string"},
                    "cssDark": {"type": "string"}
                },
                "additionalProperties": True
            }
        },
        "required": ["enabled_count", "enabled_themes"],
        "additionalProperties": True
    },
)
def get_all_enabled_themes() -> Dict[str, Any]:
    return get_all_enabled_themes_impl()


# ---------- 获取页面背景图片哈希 ----------

@core.register_api(
    path="smarttavern/styles/get_page_backgrounds_hash",
    name="获取页面背景图片哈希",
    description="""获取所有页面背景图片的 MD5 哈希值，用于前端缓存验证。

前端可以使用此 API 来检查本地缓存的图片是否需要更新：
1. 首次加载时调用此 API 获取所有图片的哈希值
2. 与本地 IndexedDB/localStorage 中缓存的哈希值比较
3. 只有哈希值不同时才调用 get_page_background 获取新图片

入参：
- orientation: 方向，可选值为 "landscape"（横版）、"portrait"（竖版）或不传（两者都返回）

返回结构：
{
    "landscape": {
        "HomePage": "abc123...",
        "ThreadedChat": "def456...",
        "SandboxChat": "ghi789..."
    },
    "portrait": {
        "HomePage": "xyz111...",
        ...
    },
    "combined_hash": "md5_of_all_hashes"
}
""",
    input_schema={
        "type": "object",
        "properties": {
            "orientation": {
                "type": "string",
                "enum": ["landscape", "portrait"],
                "description": "方向：landscape（横版）或 portrait（竖版）。不传则返回两者。"
            }
        },
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "landscape": {
                "type": "object",
                "additionalProperties": {"type": ["string", "null"]}
            },
            "portrait": {
                "type": "object",
                "additionalProperties": {"type": ["string", "null"]}
            },
            "combined_hash": {"type": ["string", "null"]}
        },
        "additionalProperties": True
    },
)
def get_page_backgrounds_hash(orientation: Optional[str] = None) -> Dict[str, Any]:
    return get_page_backgrounds_hash_impl(orientation=orientation)


# ---------- 获取页面背景图片 ----------

@core.register_api(
    path="smarttavern/styles/get_page_background",
    name="获取页面背景图片",
    description="""获取指定页面的背景图片（Base64 编码）。

入参：
- page: 页面名称，可选值为 "HomePage"、"ThreadedChat"、"SandboxChat"
- orientation: 方向，可选值为 "landscape"（横版）或 "portrait"（竖版），默认 "landscape"

返回结构：
{
    "page": "HomePage",
    "orientation": "landscape",
    "file": "backend_projects/SmartTavern/pages_images/landscape/HomePage.png",
    "hash": "abc123...",
    "mime": "image/png",
    "size": 123456,
    "content_base64": "iVBORw0KGgo..."
}
""",
    input_schema={
        "type": "object",
        "properties": {
            "page": {
                "type": "string",
                "enum": ["HomePage", "ThreadedChat", "SandboxChat"],
                "description": "页面名称"
            },
            "orientation": {
                "type": "string",
                "enum": ["landscape", "portrait"],
                "default": "landscape",
                "description": "方向：landscape（横版）或 portrait（竖版）"
            }
        },
        "required": ["page"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "page": {"type": "string"},
            "orientation": {"type": "string"},
            "file": {"type": "string"},
            "hash": {"type": "string"},
            "mime": {"type": "string"},
            "size": {"type": "integer"},
            "content_base64": {"type": "string"},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "additionalProperties": True
    },
)
def get_page_background(page: str, orientation: str = "landscape") -> Dict[str, Any]:
    return get_page_background_impl(page=page, orientation=orientation)


# ---------- 列出所有背景图片 ----------

@core.register_api(
    path="smarttavern/styles/list_page_backgrounds",
    name="列出所有页面背景图片",
    description="""列出所有可用的页面背景图片及其元信息（不包含图片内容）。

此 API 可用于展示图片列表，显示哪些图片可用。

返回结构：
{
    "images_dir": "backend_projects/SmartTavern/pages_images",
    "landscape": {
        "HomePage": { "file": "...", "hash": "...", "size": 123456 },
        "ThreadedChat": { "file": "...", "hash": "...", "size": 234567 },
        "SandboxChat": { "file": "...", "hash": "...", "size": 345678 }
    },
    "portrait": {
        "HomePage": { "file": "...", "hash": "...", "size": 123456 },
        ...
    }
}
""",
    input_schema={
        "type": "object",
        "properties": {},
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "images_dir": {"type": "string"},
            "landscape": {
                "type": "object",
                "additionalProperties": {
                    "type": ["object", "null"],
                    "properties": {
                        "file": {"type": "string"},
                        "hash": {"type": ["string", "null"]},
                        "size": {"type": "integer"}
                    }
                }
            },
            "portrait": {
                "type": "object",
                "additionalProperties": {
                    "type": ["object", "null"],
                    "properties": {
                        "file": {"type": "string"},
                        "hash": {"type": ["string", "null"]},
                        "size": {"type": "integer"}
                    }
                }
            }
        },
        "additionalProperties": True
    },
)
def list_page_backgrounds() -> Dict[str, Any]:
    return list_page_backgrounds_impl()


# ---------- 上传/更新背景图片 ----------

@core.register_api(
    path="smarttavern/styles/upload_page_background",
    name="上传/更新页面背景图片",
    description="""上传或更新指定页面的背景图片。

此 API 用于设置自定义背景图片。上传后会自动：
1. 检测图片格式（PNG/JPG/WEBP）
2. 保存到对应的方向目录
3. 删除旧的不同格式文件
4. 返回新文件的哈希值

入参：
- page: 页面名称，可选值为 "HomePage"、"ThreadedChat"、"SandboxChat"
- orientation: 方向，可选值为 "landscape"（横版）或 "portrait"（竖版）
- image_base64: Base64 编码的图片内容

返回结构：
{
    "success": true,
    "page": "HomePage",
    "orientation": "landscape",
    "file": "backend_projects/SmartTavern/pages_images/landscape/HomePage.png",
    "hash": "abc123...",
    "size": 123456,
    "message": "背景图片已成功上传: HomePage (landscape)"
}
""",
    input_schema={
        "type": "object",
        "properties": {
            "page": {
                "type": "string",
                "enum": ["HomePage", "ThreadedChat", "SandboxChat"],
                "description": "页面名称"
            },
            "orientation": {
                "type": "string",
                "enum": ["landscape", "portrait"],
                "description": "方向：landscape（横版）或 portrait（竖版）"
            },
            "image_base64": {
                "type": "string",
                "description": "Base64 编码的图片内容"
            }
        },
        "required": ["page", "orientation", "image_base64"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "page": {"type": "string"},
            "orientation": {"type": "string"},
            "file": {"type": "string"},
            "hash": {"type": "string"},
            "size": {"type": "integer"},
            "message": {"type": "string"},
            "error": {"type": "string"}
        },
        "required": ["success"],
        "additionalProperties": True
    },
)
def upload_page_background(page: str, orientation: str, image_base64: str) -> Dict[str, Any]:
    return upload_page_background_impl(page=page, orientation=orientation, image_base64=image_base64)


# ---------- 更新主题 manifest.json 文件 ----------

@core.register_api(
    path="smarttavern/styles/update_theme_file",
    name="更新主题 manifest.json 文件",
    description="""更新主题目录下的 manifest.json 文件。
仅允许修改 name 和 description 字段，其他字段保持不变。

入参：
- theme_dir: 主题目录路径（POSIX 风格），例如 "backend_projects/SmartTavern/styles/demo-ocean.sttheme"
- payload: 包含 name 和/或 description 的字典

返回主题的更新后的信息及完整 manifest 内容。""",
    input_schema={
        "type": "object",
        "properties": {
            "theme_dir": {
                "type": "string",
                "description": "主题目录路径（POSIX 风格）"
            },
            "payload": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "description": {"type": "string"}
                },
                "description": "要更新的字段"
            }
        },
        "required": ["theme_dir", "payload"],
        "additionalProperties": False
    },
    output_schema={
        "type": "object",
        "properties": {
            "dir": {"type": "string"},
            "file": {"type": "string"},
            "name": {"type": ["string", "null"]},
            "description": {"type": ["string", "null"]},
            "manifest": {"type": ["object", "null"]},
            "error": {"type": "string"},
            "message": {"type": "string"}
        },
        "required": [],
        "additionalProperties": True
    },
)
def update_theme_file(theme_dir: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    return update_theme_file_impl(theme_dir=theme_dir, payload=payload)