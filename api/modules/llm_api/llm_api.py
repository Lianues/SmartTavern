# -*- coding: utf-8 -*-
"""
API 封装层：通用 LLM 调用 (api/modules/llm_api)
- 统一注册 llm_api/chat（支持 stream true/false）、llm_api/list_models、llm_api/get_defaults、llm_api/health
- 当 stream=true 时返回 SSE（text/event-stream），事件为 data: {"type":"chunk","content":"..."}\n\n，最后发送 {"type":"end"}。
"""

from typing import Any, Dict, List, Iterator, Optional
import json

import core
from .impl import (
    call_chat_non_streaming,
    stream_chat_chunks,
    list_models_impl,
    get_defaults_impl,
    health_impl,
)
from .impl import StreamChunk


def _sse_line(obj: Dict[str, Any]) -> str:
    return "data: " + json.dumps(obj, ensure_ascii=False) + "\n\n"


def _make_sse_generator(chunks: Iterator[StreamChunk]) -> Iterator[str]:
    try:
        for ch in chunks:
            if ch.content:
                # 逐块文本
                yield _sse_line({"type": "chunk", "content": ch.content})
            # 分段结束原因（若有）
            if ch.finish_reason:
                yield _sse_line({"type": "finish", "finish_reason": ch.finish_reason})
            # 使用统计（通常在最后返回）
            if ch.usage:
                yield _sse_line({"type": "usage", "usage": ch.usage})
        # 结束事件
        yield _sse_line({"type": "end"})
    except Exception as e:
        # 错误事件
        yield _sse_line({"type": "error", "message": str(e)})
        yield _sse_line({"type": "end"})


@core.register_api(
    name="统一聊天接口（支持SSE）",
    description="调用通用 LLM 对话接口；当 stream=true 时返回 SSE（text/event-stream），否则返回 JSON。",
    path="llm_api/chat",
    input_schema={
        "type": "object",
        "properties": {
            "provider": {"type": "string", "enum": ["openai", "anthropic", "gemini", "openai_compatible", "custom"]},
            "api_key": {"type": "string"},
            "base_url": {"type": "string"},
            "messages": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "role": {"type": "string", "enum": ["system", "user", "assistant"]},
                        "content": {"type": "string"}
                    },
                    "required": ["role", "content"]
                }
            },
            "stream": {"type": "boolean", "default": False},
            "model": {"type": "string"},
            "max_tokens": {"type": "integer", "default": 2048},
            "temperature": {"type": "number", "default": 0.7},
            "top_p": {"type": "number"},
            "presence_penalty": {"type": "number"},
            "frequency_penalty": {"type": "number"},
            "custom_params": {"type": "object", "additionalProperties": True},
            "safety_settings": {"type": "object", "additionalProperties": True},
            "timeout": {"type": "integer"},
            "connect_timeout": {"type": "integer"},
            "enable_logging": {"type": "boolean"},
            "models": {"type": "array", "items": {"type": "string"}}
        },
        "required": ["provider", "api_key", "base_url", "messages"]
    },
    output_schema={
        "type": "object",
        "description": "当 stream=false 时返回该 JSON；当 stream=true 时返回 text/event-stream（SSE）。",
        "properties": {
            "success": {"type": "boolean"},
            "content": {"type": "string"},
            "usage": {"type": "object", "additionalProperties": True},
            "response_time": {"type": "number"},
            "model_used": {"type": "string"},
            "finish_reason": {"type": "string"},
            "raw_response": {"type": "object", "additionalProperties": True},
            "provider": {"type": "string"},
            "error": {"type": "string"}
        }
    }
)
def chat(
    provider: str,
    api_key: str,
    base_url: str,
    messages: List[Dict[str, str]],
    stream: bool = False,
    model: Optional[str] = None,
    max_tokens: int = 2048,
    temperature: float = 0.7,
    top_p: Optional[float] = None,
    presence_penalty: Optional[float] = None,
    frequency_penalty: Optional[float] = None,
    custom_params: Optional[Dict[str, Any]] = None,
    safety_settings: Optional[Dict[str, Any]] = None,
    timeout: Optional[int] = None,
    connect_timeout: Optional[int] = None,
    enable_logging: bool = False,
    models: Optional[List[str]] = None,
) -> Any:
    """
    统一聊天接口：
    - stream=false：返回 JSON
    - stream=true：返回 SSE（建议客户端使用 EventSource 订阅）
    """
    if not stream:
        return call_chat_non_streaming(
            provider=provider,
            api_key=api_key,
            base_url=base_url,
            messages=messages,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            presence_penalty=presence_penalty,
            frequency_penalty=frequency_penalty,
            custom_params=custom_params,
            safety_settings=safety_settings,
            timeout=timeout,
            connect_timeout=connect_timeout,
            enable_logging=enable_logging,
            models=models,
        )

    # SSE 流式
    # 延迟导入以避免在非网关场景下的依赖问题
    try:
        from fastapi.responses import StreamingResponse
    except Exception as e:
        # 快速失败为 JSON（提示未安装 FastAPI）
        return {
            "success": False,
            "error": f"SSE 不可用（依赖 fastapi 未就绪）: {str(e)}"
        }

    chunk_iter = stream_chat_chunks(
        provider=provider,
        api_key=api_key,
        base_url=base_url,
        messages=messages,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
        presence_penalty=presence_penalty,
        frequency_penalty=frequency_penalty,
        custom_params=custom_params,
        safety_settings=safety_settings,
        timeout=timeout,
        connect_timeout=connect_timeout,
        enable_logging=enable_logging,
        models=models,
    )
    sse_gen = _make_sse_generator(chunk_iter)
    return StreamingResponse(
        sse_gen,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@core.register_api(
    name="列出可用模型",
    description="按提供商列出远端可用模型（OpenAI/Gemini/Anthropic/兼容端点）。",
    path="llm_api/list_models",
    input_schema={
        "type": "object",
        "properties": {
            "provider": {"type": "string", "enum": ["openai", "anthropic", "gemini", "openai_compatible", "custom"]},
            "api_key": {"type": "string"},
            "base_url": {"type": "string"},
            "limit": {"type": "integer"},
            "page_token": {"type": "string"},
            "before_id": {"type": "string"},
            "after_id": {"type": "string"},
            "timeout": {"type": "integer"},
            "connect_timeout": {"type": "integer"},
            "enable_logging": {"type": "boolean"}
        },
        "required": ["provider", "api_key"]
    },
    output_schema={"type": "object", "additionalProperties": True}
)
def list_models(
    provider: str,
    api_key: str,
    base_url: Optional[str] = None,
    limit: Optional[int] = None,
    page_token: Optional[str] = None,
    before_id: Optional[str] = None,
    after_id: Optional[str] = None,
    timeout: Optional[int] = None,
    connect_timeout: Optional[int] = None,
    enable_logging: bool = False,
) -> Dict[str, Any]:
    return list_models_impl(
        provider=provider,
        api_key=api_key,
        base_url=base_url,
        limit=limit,
        page_token=page_token,
        before_id=before_id,
        after_id=after_id,
        timeout=timeout,
        connect_timeout=connect_timeout,
        enable_logging=enable_logging,
    )


@core.register_api(
    name="获取默认配置",
    description="返回支持提供商、默认模型映射、HTTP 错误映射与默认超时配置。",
    path="llm_api/get_defaults",
    input_schema={"type": "object", "properties": {}},
    output_schema={"type": "object", "additionalProperties": True}
)
def get_defaults() -> Dict[str, Any]:
    return get_defaults_impl()


@core.register_api(
    name="健康检查",
    description="模块健康检查。",
    path="llm_api/health",
    input_schema={"type": "object", "properties": {}},
    output_schema={
        "type": "object",
        "properties": {
            "status": {"type": "string"},
            "timestamp": {"type": "number"}
        },
        "required": ["status", "timestamp"]
    }
)
def health() -> Dict[str, Any]:
    return health_impl()