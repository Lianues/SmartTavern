"""
Example backend plugin APIs for SmartTavern
"""

from core.api_registry import register_api


@register_api(
    path="smarttavern/example_backend/echo",
    input_schema={
        "type": "object",
        "properties": {"text": {"type": "string"}},
        "required": ["text"]
    },
    output_schema={
        "type": "object",
        "properties": {"echo": {"type": "string"}}
    },
    description="Echo input text"
)
def echo(text: str):
    return {"echo": text}


@register_api(
    path="smarttavern/example_backend/info",
    input_schema={"type": "object", "properties": {}},
    output_schema={
        "type": "object",
        "properties": {
            "project": {"type": "string"},
            "plugin": {"type": "string"}
        }
    },
    description="Plugin info"
)
def info():
    return {"project": "SmartTavern", "plugin": "example_backend"}