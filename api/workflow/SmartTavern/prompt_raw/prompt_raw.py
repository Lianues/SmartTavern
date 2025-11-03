"""
SmartTavern Prompt RAW Workflow Registration (prompt_raw.py)

职责（封装/注册层，仅声明 API，不包含实现逻辑）:
- 通过 @core.register_api 暴露工作流 API（斜杠路径 + JSON Schema）
- 实际实现委托给同目录的 impl.py

输入说明（JSON 对象/数组，非文件路径）:
- presets: 预设文档对象，包含 prompts 数组（参考 data/presets/Default.json 的结构）
- world_books: 世界书条目数组/嵌套数组/对象（参考 data/world_books 的结构）
- history: OpenAI Chat messages 数组（[{role, content}]），可不含 source 字段
- character: 可选，角色文档对象（若含 world_book.entries 将并入世界书）
- persona: 可选，用户画像文档对象

输出:
- messages: 完整提示词（prefix + in-chat 注入），每条结构 {role, content, source}（字段顺序: role → content → source）
"""
from typing import Any, Dict, List, Optional

import core  # type: ignore

from .impl import assemble_full as _assemble_full


@core.register_api(
    path="smarttavern/prompt_raw/assemble_full",
    name="提示词装配（RAW：prefix + in-chat）",
    description="聚合 framing 与 in-chat，输入为 JSON 对象/数组（非文件路径），输出完整 messages（含 source）",
    input_schema={
        "type": "object",
        "properties": {
            "presets": {"type": "object", "additionalProperties": True},
            "world_books": {"type": ["array", "object"]},
            "history": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "role": {"type": "string", "enum": ["system", "user", "assistant"]},
                        "content": {"type": "string"},
                        "source": {"type": "object", "additionalProperties": True}
                    },
                    "required": ["role", "content"],
                    "additionalProperties": True
                }
            },
            "character": {"type": "object", "additionalProperties": True},
            "persona": {"type": "object", "additionalProperties": True},
            "variables": {"type": "object", "additionalProperties": True}
        },
        "required": ["presets", "history"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "messages": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "role": {"type": "string", "enum": ["system", "user", "assistant"]},
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
async def assemble_full(
    presets: Dict[str, Any],
    history: List[Dict[str, Any]],
    world_books: Any = None,
    character: Optional[Dict[str, Any]] = None,
    persona: Optional[Dict[str, Any]] = None,
    variables: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    适配器：转发到实现层（impl.py），遵循 “API 优先 / 解耦” 原则。
    """
    return await _assemble_full(
        presets=presets,
        history=history,
        world_books=world_books,
        character=character,
        persona=persona,
        variables=variables,
    )


if __name__ == "__main__":
    # 本文件为工作流 API 的注册封装层，非独立可执行脚本。
    # 请通过 API 网关运行或使用测试脚本进行验证：
    #   python api/workflow/smarttavern/prompt_raw/test_prompt_workflow.py
    import json
    print(json.dumps({
        "message": "This file registers the RAW workflow API. Please run the API gateway or the test script instead."
    }, ensure_ascii=False))