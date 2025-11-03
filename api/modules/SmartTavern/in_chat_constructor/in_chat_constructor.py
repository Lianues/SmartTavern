"""
API 封装层：SmartTavern.in_chat_constructor
- 遵循 DEVELOPMENT_NOTES 新规范：斜杠 path + JSON Schema
- 通过 @core.register_api 暴露公共 API，内部实现位于 impl.py
"""
from typing import Any, Dict, List, Optional
import core
from .impl import construct as _construct


@core.register_api(
    path="smarttavern/in_chat_constructor/construct",
    name="对话内构造（带来源）",
    description="按 depth/order 注入 in-chat 预设与世界书，输出带来源字段的 OpenAI messages",
    input_schema={
        "type": "object",
        "properties": {
            "history": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "role": {"type": "string", "enum": ["system", "user", "assistant", "thinking"]},
                        "content": {"type": "string"}
                    },
                    "required": ["role", "content"]
                }
            },
            "presets_in_chat": {
                "type": "array",
                "items": {"type": "object", "additionalProperties": True}
            },
            "world_books": {
                "type": "object"
            },
            "variables": {"type": "object", "additionalProperties": True}
        },
        "required": ["history", "presets_in_chat", "world_books"]
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
def construct(
    history: List[Dict[str, Any]],
    presets_in_chat: List[Dict[str, Any]],
    world_books: Any,
    variables: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return _construct(
        history=history,
        presets_in_chat=presets_in_chat,
        world_books=world_books,
        variables=variables,
    )