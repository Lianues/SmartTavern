"""
API 封装层：SmartTavern.framing_prompt
- 遵循 DEVELOPMENT_NOTES 新规范：斜杠 path + JSON Schema
- 通过 @core.register_api 暴露公共 API，内部实现位于 impl.py
"""
from typing import Any, Dict, List, Optional
import core
from .impl import assemble as _assemble


@core.register_api(
    path="smarttavern/framing_prompt/assemble",
    name="前缀提示词构造（framing）",
    description="根据 relative 预设与世界书（before/after）构建前缀提示词，并规范化历史（为无 source 的历史补齐来源字段）",
    input_schema={
        "type": "object",
        "properties": {
            "history": {
                "type": ["array", "object"],
                "additionalProperties": True
            },
            "world_books": {
                "type": "object"
            },
            "presets_relative": {
                "type": "array",
                "items": {"type": "object", "additionalProperties": True}
            },
            "presets_doc": {
                "type": "object",
                "additionalProperties": True
            },
            "character": {
                "type": "object",
                "additionalProperties": True
            },
            "persona": {
                "type": "object",
                "additionalProperties": True
            }
        },
        "required": ["history"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "messages": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "role": {"type": "string", "enum": ["system", "user", "assistant", "thinking"]},
                        "content": {"type": "string"},
                        "source": {"type": "object", "additionalProperties": True}
                    },
                    "required": ["role", "content", "source"]
                }
            }
        },
        "required": ["messages"]
    },
)
def assemble(
    history: List[Dict[str, Any]],
    world_books: Any = None,
    presets_relative: Optional[List[Dict[str, Any]]] = None,
    presets_doc: Optional[Dict[str, Any]] = None,
    character: Optional[Dict[str, Any]] = None,
    persona: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    - history 可为“原始 OpenAI 消息数组（无 source）”或“已处理消息（含 source）”
    - 若无 source，将按 in_chat_constructor 的历史来源规范补齐 {"type":"history","id":"history_i","index":i}
    - presets_relative 优先；未提供时可传 presets_doc（将自动过滤 position == 'relative'）
    - world_books 支持嵌套数组 [[{...}], {...}]
    - character/persona 可选，用于处理 charDescription/personaDescription 占位符
    """
    return _assemble(
        history=history,
        world_books=world_books,
        presets_relative=presets_relative,
        presets_doc=presets_doc,
        character=character,
        persona=persona,
    )