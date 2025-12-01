# -*- coding: utf-8 -*-
"""
实现层：通用 LLM 能力（统一非流/流式封装 + 管理器本体）
- 本文件合并了原 llm_api_manager.py 的完整实现（LLMAPIManager/数据类等）
- 并提供封装方法供注册层调用：
  • call_chat_non_streaming()  → JSON 一次性返回
  • stream_chat_chunks()       → 迭代器（供 SSE 输出）
  • list_models_impl()         → 远端模型列表
  • get_defaults_impl()        → 默认映射/常量
  • health_impl()              → 健康检查
"""

import os
import json
import time
import asyncio
import aiohttp
import requests
from typing import Dict, List, Any, Optional, Union, AsyncGenerator, Iterator
from dataclasses import dataclass, field
from enum import Enum
import logging

from . import variables as v

# 日志
logger = logging.getLogger(__name__)

# ========== 数据类/枚举（来自原 llm_api_manager.py） ==========

class ResponseType(Enum):
    STREAMING = "streaming"
    NON_STREAMING = "non_streaming"


@dataclass
class APIResponse:
    """API响应结果"""
    success: bool
    content: str = ""
    error: Optional[str] = None
    usage: Optional[Dict[str, Any]] = None
    response_time: float = 0.0
    model_used: Optional[str] = None
    finish_reason: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None
    provider: Optional[str] = None


@dataclass
class StreamChunk:
    """流式响应块"""
    content: str
    finish_reason: Optional[str] = None
    usage: Optional[Dict[str, Any]] = None


@dataclass
class APIConfiguration:
    """API配置"""
    provider: str
    api_key: str
    base_url: str
    models: List[str]
    enabled: bool = True
    timeout: int = v.DEFAULT_TIMEOUT
    connect_timeout: int = v.DEFAULT_CONNECT_TIMEOUT
    enable_logging: bool = False


# ========== 核心 LLMAPIManager（来自原 llm_api_manager.py，保持逻辑一致） ==========

class LLMAPIManager:
    """通用LLM API管理器"""

    def __init__(self, config: APIConfiguration):
        self.config = config
        self._setup_logging()

    def _setup_logging(self):
        """设置日志配置"""
        if self.config.enable_logging:
            logging.basicConfig(level=logging.INFO)
        else:
            logging.basicConfig(level=getattr(logging, v.DEFAULT_LOG_LEVEL))

    def get_available_models(self) -> List[str]:
        """获取可用模型列表"""
        return self.config.models or v.DEFAULT_MODELS.get(self.config.provider, [])

    def is_available(self) -> bool:
        """检查API是否可用"""
        return (
            self.config.enabled and
            self.config.api_key != '' and
            self.config.base_url != ''
        )

    def _get_headers(self) -> Dict[str, str]:
        """构建请求头"""
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "ModularFlow-LLM-API/1.0"
        }

        # 根据提供商类型设置认证头
        if self.config.provider == 'openai':
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        elif self.config.provider == 'anthropic':
            headers["x-api-key"] = self.config.api_key
            headers["anthropic-version"] = "2023-06-01"
        elif self.config.provider == 'gemini':
            # Gemini使用API密钥作为URL参数，不需要特殊头
            pass
        elif self.config.provider == 'openai_compatible':
            # OpenAI兼容格式使用Bearer认证
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        else:
            # 自定义提供商，默认使用Bearer认证
            headers["Authorization"] = f"Bearer {self.config.api_key}"

        return headers

    def _build_request_payload(self, messages: List[Dict[str, str]],
                             model: str,
                             max_tokens: int = None,
                             temperature: float = None,
                             stream: bool = False,
                             **kwargs) -> Dict[str, Any]:
        """构建API请求体（不使用默认参数，完全依赖配置文件）"""

        if self.config.provider == 'gemini':
            return self._build_gemini_payload(messages, model, max_tokens, temperature, stream, **kwargs)
        elif self.config.provider == 'anthropic':
            return self._build_anthropic_payload(messages, model, max_tokens, temperature, stream, **kwargs)

        # 标准OpenAI格式（适用于OpenAI、openai_compatible和大多数自定义提供商）
        payload = {
            "messages": messages,
            "model": model,
            "stream": stream,
        }
        
        # 只添加非 None 的参数
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        if temperature is not None:
            payload["temperature"] = temperature
        if "top_p" in kwargs and kwargs["top_p"] is not None:
            payload["top_p"] = kwargs["top_p"]
        if "presence_penalty" in kwargs and kwargs["presence_penalty"] is not None:
            payload["presence_penalty"] = kwargs["presence_penalty"]
        if "frequency_penalty" in kwargs and kwargs["frequency_penalty"] is not None:
            payload["frequency_penalty"] = kwargs["frequency_penalty"]

        # 合并自定义字段（如果有的话）
        custom_params = kwargs.get("custom_params", {})
        if custom_params:
            payload.update(custom_params)

        # 移除None值
        payload = {k: v for k, v in payload.items() if v is not None}

        if self.config.enable_logging:
            logger.info(f"构建请求体: {json.dumps(payload, indent=2, ensure_ascii=False)}")

        return payload

    def _build_gemini_payload(self, messages: List[Dict[str, str]],
                            model: str,
                            max_tokens: int = None,
                            temperature: float = None,
                            stream: bool = False,
                            **kwargs) -> Dict[str, Any]:
        """构建Gemini特定的请求体（不使用默认参数）"""
        # 分离系统消息和对话消息
        system_instruction = None
        conversation_messages = []

        for msg in messages:
            if msg["role"] == "system":
                # 如果有多个system消息，合并它们
                if system_instruction:
                    system_instruction += "\n\n" + msg["content"]
                else:
                    system_instruction = msg["content"]
            else:
                conversation_messages.append(msg)

        # 转换消息格式为Gemini格式
        gemini_contents = []
        for msg in conversation_messages:
            role = msg["role"]
            content = msg["content"]

            # Gemini角色映射: user -> user, assistant -> model
            gemini_role = "model" if role == "assistant" else "user"
            gemini_contents.append({
                "role": gemini_role,
                "parts": [{"text": content}]
            })

        # 构建Gemini请求体 - 使用新的顶层参数格式
        payload = {
            "contents": gemini_contents
        }

        # 添加系统指令（如果有）
        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        # 添加生成配置 - 直接放在顶层（只添加非 None 的参数）
        generation_config = {}
        if temperature is not None:
            generation_config["temperature"] = temperature
        if "top_p" in kwargs and kwargs["top_p"] is not None:
            generation_config["topP"] = kwargs["top_p"]
        if max_tokens is not None:
            generation_config["maxOutputTokens"] = max_tokens

        # 添加thinking配置（如果支持的话）
        if kwargs.get("disable_thinking", False):
            generation_config["responseLogprobs"] = False

        payload["generationConfig"] = generation_config

        # 安全设置（可选）
        if kwargs.get("safety_settings"):
            payload["safetySettings"] = kwargs["safety_settings"]

        # 合并自定义字段（如果有的话）
        custom_params = kwargs.get("custom_params", {})
        if custom_params:
            # 对于Gemini，某些参数需要放在generationConfig中
            gemini_generation_fields = ["topK", "candidateCount", "stopSequences", "responseMimeType"]
            for key, value in custom_params.items():
                if key in gemini_generation_fields:
                    generation_config[key] = value
                else:
                    payload[key] = value

        if self.config.enable_logging:
            logger.info(f"构建Gemini请求体: {json.dumps(payload, indent=2, ensure_ascii=False)}")

        return payload

    def _build_anthropic_payload(self, messages: List[Dict[str, str]],
                               model: str,
                               max_tokens: int = None,
                               temperature: float = None,
                               stream: bool = False,
                               **kwargs) -> Dict[str, Any]:
        """构建Anthropic特定的请求体（不使用默认参数）"""
        # 分离系统消息和对话消息
        system_messages = []
        conversation_messages = []

        for msg in messages:
            if msg["role"] == "system":
                system_messages.append(msg["content"])
            else:
                conversation_messages.append(msg)

        # 构建Anthropic请求体（只添加非 None 的参数）
        payload = {
            "model": model,
            "messages": conversation_messages,
            "stream": stream
        }
        
        # 只添加非 None 的参数
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens

        # 添加系统消息（如果有）
        if system_messages:
            payload["system"] = "\n\n".join(system_messages)

        # 添加其他参数
        if temperature is not None:
            payload["temperature"] = temperature

        if "top_p" in kwargs and kwargs["top_p"] is not None:
            payload["top_p"] = kwargs["top_p"]

        # Anthropic特有的参数
        if kwargs.get("stop_sequences"):
            payload["stop_sequences"] = kwargs["stop_sequences"]

        # 添加thinking配置（如果支持）
        if kwargs.get("enable_thinking"):
            payload["thinking"] = {
                "type": "enabled",
                "budget_tokens": kwargs.get("thinking_budget", 16000)
            }

        # 合并自定义字段（如果有的话）
        custom_params = kwargs.get("custom_params", {})
        if custom_params:
            payload.update(custom_params)

        if self.config.enable_logging:
            logger.info(f"构建Anthropic请求体: {json.dumps(payload, indent=2, ensure_ascii=False)}")

        return payload

    def _validate_request(self, messages: List[Dict[str, str]]) -> bool:
        """验证请求数据"""
        if not messages:
            raise ValueError("消息列表不能为空")

        for msg in messages:
            if not isinstance(msg, dict):
                raise ValueError("消息必须是字典格式")
            if "role" not in msg or "content" not in msg:
                raise ValueError("消息必须包含'role'和'content'字段")
            if msg["role"] not in ["system", "user", "assistant"]:
                raise ValueError(f"无效的角色: {msg['role']}")

        # 检查请求大小
        request_size = len(json.dumps(messages, ensure_ascii=False).encode('utf-8'))
        if request_size > v.MAX_REQUEST_SIZE:
            raise ValueError(f"请求大小超过限制: {request_size} > {v.MAX_REQUEST_SIZE}")

        return True

    def _get_request_url(self, model: str, stream: bool = False) -> str:
        """构建请求URL"""
        base_url = self.config.base_url.rstrip('/')

        if self.config.provider == 'gemini':
            # Gemini使用特殊的URL格式
            if stream:
                url = f"{base_url}/models/{model}:streamGenerateContent"
            else:
                url = f"{base_url}/models/{model}:generateContent"
            # Gemini使用API密钥作为URL参数
            url += f"?key={self.config.api_key}"
            return url
        elif self.config.provider == 'anthropic':
            return f"{base_url}/messages"
        else:
            # OpenAI、openai_compatible和其他兼容提供商
            return f"{base_url}/chat/completions"

    def call_api(self, messages: List[Dict[str, str]],
                 model: str = None,
                 max_tokens: int = None,
                 temperature: float = None,
                 stream: bool = False,
                 **kwargs) -> Union[APIResponse, Iterator[StreamChunk]]:
        """同步调用API"""
        start_time = time.time()

        try:
            # 检查是否可用
            if not self.is_available():
                return APIResponse(
                    success=False,
                    error=f"API提供商 {self.config.provider} 不可用或未正确配置",
                    response_time=time.time() - start_time,
                    provider=self.config.provider
                )

            # 使用默认模型如果未指定
            if not model:
                available_models = self.get_available_models()
                if not available_models:
                    return APIResponse(
                        success=False,
                        error=f"提供商 {self.config.provider} 没有可用的模型",
                        response_time=time.time() - start_time,
                        provider=self.config.provider
                    )
                model = available_models[0]

            # 验证请求
            self._validate_request(messages)

            # 构建请求
            url = self._get_request_url(model, stream)
            headers = self._get_headers()
            payload = self._build_request_payload(messages, model, max_tokens, temperature, stream, **kwargs)

            # 打印请求信息（使用WARNING级别确保显示，但不误导为错误）
            logger.warning(f"\n{'='*60}")
            logger.warning(f"LLM API 请求")
            logger.warning(f"{'='*60}")
            logger.warning(f"URL: {url}")
            safe_headers = {k: v for k, v in headers.items() if k.lower() not in ['authorization', 'x-api-key']}
            logger.warning(f"Headers:\n{json.dumps(safe_headers, ensure_ascii=False, indent=2)}")
            logger.warning(f"Request Body:\n{json.dumps(payload, ensure_ascii=False, indent=2)}")

            # 发送请求
            response = requests.post(
                url,
                headers=headers,
                json=payload,
                timeout=(self.config.connect_timeout, self.config.timeout),
                stream=stream
            )

            # 打印响应状态
            logger.info(f"=== LLM API 响应 ===")
            logger.info(f"Status Code: {response.status_code}")
            logger.info(f"Response Headers: {json.dumps(dict(response.headers), ensure_ascii=False, indent=2)}")

            if not response.ok:
                return self._handle_error(response, start_time)

            if stream:
                return self._handle_streaming_response(response, start_time)
            else:
                return self._handle_non_streaming_response(response, start_time)

        except requests.exceptions.Timeout:
            return APIResponse(
                success=False,
                error="请求超时",
                response_time=time.time() - start_time,
                provider=self.config.provider
            )
        except requests.exceptions.ConnectionError:
            return APIResponse(
                success=False,
                error="连接失败",
                response_time=time.time() - start_time,
                provider=self.config.provider
            )
        except Exception as e:
            return APIResponse(
                success=False,
                error=f"未知错误: {str(e)}",
                response_time=time.time() - start_time,
                provider=self.config.provider
            )

    def _handle_error(self, response, start_time: float) -> APIResponse:
        """处理API错误响应 - 返回完整的错误JSON给前端"""
        # 默认错误消息
        default_error_msg = v.HTTP_ERROR_MESSAGES.get(response.status_code, f"HTTP {response.status_code}")

        # 尝试获取完整的错误响应体
        try:
            error_body_text = response.text
            error_data = json.loads(error_body_text)
            logger.error(f"Response Body (Error):\n{json.dumps(error_data, indent=2, ensure_ascii=False)}")
            
            # 将完整的JSON作为字符串返回，让前端自己处理
            error_msg = json.dumps(error_data, ensure_ascii=False)
            
        except Exception as parse_err:
            # 如果无法解析JSON，返回原始文本
            error_body_text = response.text if hasattr(response, 'text') else ''
            logger.error(f"Response Body (Error, 原始文本): {error_body_text}")
            logger.error(f"解析错误响应失败: {parse_err}")
            error_msg = error_body_text if error_body_text else default_error_msg

        logger.error(f"API请求失败 ({self.config.provider}): Status {response.status_code}")

        return APIResponse(
            success=False,
            error=error_msg,
            response_time=time.time() - start_time,
            provider=self.config.provider
        )

    def _handle_non_streaming_response(self, response, start_time: float) -> APIResponse:
        """处理非流式响应"""
        try:
            data = response.json()

            if self.config.enable_logging:
                logger.info(f"收到响应: {json.dumps(data, indent=2, ensure_ascii=False)}")

            # 根据提供商处理不同的响应格式
            if self.config.provider == 'gemini':
                return self._handle_gemini_response(data, start_time)
            elif self.config.provider == 'anthropic':
                return self._handle_anthropic_response(data, start_time)
            else:
                return self._handle_openai_response(data, start_time)

        except json.JSONDecodeError:
            return APIResponse(
                success=False,
                error="响应JSON解析失败",
                response_time=time.time() - start_time,
                provider=self.config.provider
            )
        except Exception as e:
            return APIResponse(
                success=False,
                error=f"响应处理失败: {str(e)}",
                response_time=time.time() - start_time,
                provider=self.config.provider
            )

    def _handle_openai_response(self, data: Dict[str, Any], start_time: float) -> APIResponse:
        """处理OpenAI格式的响应"""
        content = ""
        finish_reason = None
        usage = data.get("usage")
        model_used = data.get("model")

        if "choices" in data and data["choices"]:
            choice = data["choices"][0]
            if "message" in choice:
                content = choice["message"].get("content", "")
            finish_reason = choice.get("finish_reason")

        return APIResponse(
            success=True,
            content=content,
            usage=usage,
            response_time=time.time() - start_time,
            model_used=model_used,
            finish_reason=finish_reason,
            raw_response=data,
            provider=self.config.provider
        )

    def _handle_gemini_response(self, data: Dict[str, Any], start_time: float) -> APIResponse:
        """处理Gemini格式的响应"""
        content = ""
        finish_reason = None
        usage = None
        model_used = None

        # Gemini响应格式: {"candidates": [{"content": {"parts": [{"text": "..."}], "role": "model"}, "finishReason": "STOP"}]}
        if "candidates" in data and data["candidates"]:
            candidate = data["candidates"][0]
            if "content" in candidate and "parts" in candidate["content"]:
                # 合并所有parts的文本
                parts = candidate["content"]["parts"]
                content = "".join([part.get("text", "") for part in parts if "text" in part])

            finish_reason = candidate.get("finishReason", "").lower()
            if finish_reason == "stop":
                finish_reason = "end_turn"

        # Gemini的使用统计
        if "usageMetadata" in data:
            usage_metadata = data["usageMetadata"]
            usage = {
                "prompt_tokens": usage_metadata.get("promptTokenCount", 0),
                "completion_tokens": usage_metadata.get("candidatesTokenCount", 0),
                "total_tokens": usage_metadata.get("totalTokenCount", 0)
            }

        return APIResponse(
            success=True,
            content=content,
            usage=usage,
            response_time=time.time() - start_time,
            model_used=model_used,
            finish_reason=finish_reason,
            raw_response=data,
            provider=self.config.provider
        )

    def _handle_anthropic_response(self, data: Dict[str, Any], start_time: float) -> APIResponse:
        """处理Anthropic格式的响应"""
        content = ""
        finish_reason = None
        usage = None
        model_used = data.get("model")

        # Anthropic响应格式: {"content": [{"type": "text", "text": "..."}], "stop_reason": "end_turn"}
        if "content" in data and data["content"]:
            # 合并所有content blocks的文本
            for content_block in data["content"]:
                if content_block.get("type") == "text":
                    content += content_block.get("text", "")

        finish_reason = data.get("stop_reason")

        # Anthropic的使用统计
        if "usage" in data:
            usage_data = data["usage"]
            usage = {
                "prompt_tokens": usage_data.get("input_tokens", 0),
                "completion_tokens": usage_data.get("output_tokens", 0),
                "total_tokens": usage_data.get("input_tokens", 0) + usage_data.get("output_tokens", 0)
            }

        return APIResponse(
            success=True,
            content=content,
            usage=usage,
            response_time=time.time() - start_time,
            model_used=model_used,
            finish_reason=finish_reason,
            raw_response=data,
            provider=self.config.provider
        )

    def _handle_streaming_response(self, response, start_time: float) -> Iterator[StreamChunk]:
        """处理流式响应"""
        try:
            # 根据提供商处理不同的流式响应格式
            if self.config.provider == 'anthropic':
                yield from self._handle_anthropic_streaming_response(response, start_time)
            elif self.config.provider == 'gemini':
                yield from self._handle_gemini_streaming_response(response, start_time)
            else:
                yield from self._handle_openai_streaming_response(response, start_time)

        except Exception as e:
            # 直接传递原始错误消息，不做任何包装
            error_msg = str(e)
            logger.error(f"流式响应处理失败: {error_msg}")
            yield StreamChunk(content=error_msg, finish_reason="error")

    def _handle_openai_streaming_response(self, response, start_time: float) -> Iterator[StreamChunk]:
        """处理OpenAI格式的流式响应"""
        full_content = ""

        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')

                if line.startswith('data: '):
                    data_str = line[6:]  # 移除 'data: ' 前缀

                    if data_str.strip() == '[DONE]':
                        break

                    try:
                        data = json.loads(data_str)

                        if "choices" in data and data["choices"]:
                            choice = data["choices"][0]
                            delta = choice.get("delta", {})

                            if "content" in delta:
                                content = delta["content"]
                                full_content += content

                                yield StreamChunk(
                                    content=content,
                                    finish_reason=choice.get("finish_reason")
                                )

                            # 检查是否完成
                            if choice.get("finish_reason"):
                                usage = data.get("usage")
                                yield StreamChunk(
                                    content="",
                                    finish_reason=choice.get("finish_reason"),
                                    usage=usage
                                )
                                break

                    except json.JSONDecodeError:
                        continue

        if self.config.enable_logging:
            logger.info(f"OpenAI流式响应完成，总长度: {len(full_content)}")

    def _handle_anthropic_streaming_response(self, response, start_time: float) -> Iterator[StreamChunk]:
        """处理Anthropic格式的流式响应"""
        full_content = ""

        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')

                if line.startswith('event: '):
                    event_type = line[7:].strip()  # 移除 'event: ' 前缀
                elif line.startswith('data: '):
                    data_str = line[6:]  # 移除 'data: ' 前缀

                    if data_str.strip():
                        try:
                            data = json.loads(data_str)

                            # 处理不同类型的事件
                            if data.get("type") == "content_block_delta":
                                delta = data.get("delta", {})
                                if delta.get("type") == "text_delta":
                                    content = delta.get("text", "")
                                    full_content += content

                                    yield StreamChunk(
                                        content=content,
                                        finish_reason=None
                                    )

                            elif data.get("type") == "message_delta":
                                # 消息完成
                                delta = data.get("delta", {})
                                stop_reason = delta.get("stop_reason")
                                usage_data = data.get("usage", {})

                                if stop_reason:
                                    # 构建使用统计
                                    usage = {
                                        "prompt_tokens": usage_data.get("input_tokens", 0),
                                        "completion_tokens": usage_data.get("output_tokens", 0),
                                        "total_tokens": usage_data.get("input_tokens", 0) + usage_data.get("output_tokens", 0)
                                    }

                                    yield StreamChunk(
                                        content="",
                                        finish_reason=stop_reason,
                                        usage=usage
                                    )

                            elif data.get("type") == "message_stop":
                                # 流式响应结束
                                break

                        except json.JSONDecodeError:
                            continue

        if self.config.enable_logging:
            logger.info(f"Anthropic流式响应完成，总长度: {len(full_content)}")

    def _handle_gemini_streaming_response(self, response, start_time: float) -> Iterator[StreamChunk]:
        """处理Gemini格式的流式响应"""
        full_content = ""

        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')

                if line.startswith('data: '):
                    data_str = line[6:]  # 移除 'data: ' 前缀

                    if data_str.strip():
                        try:
                            data = json.loads(data_str)

                            # Gemini流式响应格式
                            if "candidates" in data and data["candidates"]:
                                candidate = data["candidates"][0]

                                if "content" in candidate and "parts" in candidate["content"]:
                                    # 提取文本内容
                                    parts = candidate["content"]["parts"]
                                    content = ""
                                    for part in parts:
                                        if "text" in part:
                                            content += part["text"]

                                    if content:
                                        full_content += content
                                        yield StreamChunk(
                                            content=content,
                                            finish_reason=None
                                        )

                                # 检查完成状态
                                finish_reason = candidate.get("finishReason")
                                if finish_reason:
                                    if finish_reason == "STOP":
                                        finish_reason = "end_turn"

                                    # 构建使用统计
                                    usage = None
                                    if "usageMetadata" in data:
                                        usage_metadata = data["usageMetadata"]
                                        usage = {
                                            "prompt_tokens": usage_metadata.get("promptTokenCount", 0),
                                            "completion_tokens": usage_metadata.get("candidatesTokenCount", 0),
                                            "total_tokens": usage_metadata.get("totalTokenCount", 0)
                                        }

                                    yield StreamChunk(
                                        content="",
                                        finish_reason=finish_reason,
                                        usage=usage
                                    )
                                    break

                        except json.JSONDecodeError:
                            continue

        if self.config.enable_logging:
            logger.info(f"Gemini流式响应完成，总长度: {len(full_content)}")

    def list_models(self, limit: Optional[int] = None, page_token: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        """获取可用模型列表

        Args:
            limit: 返回结果数量限制 (Anthropic: 1-1000, Gemini: 1-1000)
            page_token: 分页令牌 (Anthropic: before_id/after_id, Gemini: pageToken)
            **kwargs: 其他分页参数
                - before_id: Anthropic分页参数
                - after_id: Anthropic分页参数

        Returns:
            包含模型列表的字典，格式根据提供商而异
        """
        try:
            if not self.is_available():
                return {
                    "success": False,
                    "error": f"API提供商 {self.config.provider} 不可用或未正确配置",
                    "provider": self.config.provider
                }

            # 构建请求URL和参数
            if self.config.provider == 'anthropic':
                return self._list_anthropic_models(limit, page_token, **kwargs)
            elif self.config.provider == 'gemini':
                return self._list_gemini_models(limit, page_token, **kwargs)
            else:
                # OpenAI和其他提供商通常使用标准endpoint
                return self._list_openai_models(limit, page_token, **kwargs)

        except Exception as e:
            logger.error(f"获取模型列表失败: {str(e)}")
            return {
                "success": False,
                "error": f"获取模型列表失败: {str(e)}",
                "provider": self.config.provider
            }

    def _list_anthropic_models(self, limit: Optional[int] = None, page_token: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        """获取Anthropic模型列表"""
        base_url = self.config.base_url.rstrip('/')
        url = f"{base_url}/v1/models"

        # 构建查询参数
        params = {}
        if limit is not None:
            # Anthropic限制: 1-1000
            params['limit'] = max(1, min(limit, 1000))

        # 处理分页参数
        if page_token:
            params['after_id'] = page_token
        if kwargs.get('before_id'):
            params['before_id'] = kwargs['before_id']
        if kwargs.get('after_id'):
            params['after_id'] = kwargs['after_id']

        # 构建请求头
        headers = {
            "anthropic-version": "2023-06-01",
            "x-api-key": self.config.api_key,
            "User-Agent": "ModularFlow-LLM-API/1.0"
        }

        if self.config.enable_logging:
            logger.info(f"Anthropic获取模型列表: {url}, 参数: {params}")

        try:
            response = requests.get(
                url,
                headers=headers,
                params=params,
                timeout=(self.config.connect_timeout, self.config.timeout)
            )

            if not response.ok:
                error_msg = f"HTTP {response.status_code}"
                try:
                    error_data = response.json()
                    if "error" in error_data:
                        if isinstance(error_data["error"], dict):
                            error_msg = error_data["error"].get("message", error_msg)
                        else:
                            error_msg = str(error_data["error"])
                except:
                    pass

                return {
                    "success": False,
                    "error": error_msg,
                    "provider": self.config.provider,
                    "status_code": response.status_code
                }

            data = response.json()
            if self.config.enable_logging:
                logger.info(f"Anthropic模型列表响应: {json.dumps(data, indent=2, ensure_ascii=False)}")

            return {
                "success": True,
                "provider": self.config.provider,
                "data": data.get("data", []),
                "first_id": data.get("first_id"),
                "last_id": data.get("last_id"),
                "has_more": data.get("has_more", False),
                "raw_response": data
            }

        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": "请求超时",
                "provider": self.config.provider
            }
        except requests.exceptions.ConnectionError:
            return {
                "success": False,
                "error": "连接失败",
                "provider": self.config.provider
            }

    def _list_gemini_models(self, limit: Optional[int] = None, page_token: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        """获取Gemini模型列表"""
        url = "https://generativelanguage.googleapis.com/v1beta/models"

        # 构建查询参数
        params = {
            "key": self.config.api_key
        }

        if limit is not None:
            # Gemini限制: 1-1000
            params['pageSize'] = max(1, min(limit, 1000))

        if page_token:
            params['pageToken'] = page_token

        # 构建请求头
        headers = {
            "User-Agent": "ModularFlow-LLM-API/1.0"
        }

        if self.config.enable_logging:
            logger.info(f"Gemini获取模型列表: {url}, 参数: {params}")

        try:
            response = requests.get(
                url,
                headers=headers,
                params=params,
                timeout=(self.config.connect_timeout, self.config.timeout)
            )

            if not response.ok:
                error_msg = f"HTTP {response.status_code}"
                try:
                    error_data = response.json()
                    if "error" in error_data:
                        if isinstance(error_data["error"], dict):
                            error_msg = error_data["error"].get("message", error_msg)
                        else:
                            error_msg = str(error_data["error"])
                except:
                    pass

                return {
                    "success": False,
                    "error": error_msg,
                    "provider": self.config.provider,
                    "status_code": response.status_code
                }

            data = response.json()
            if self.config.enable_logging:
                logger.info(f"Gemini模型列表响应: {json.dumps(data, indent=2, ensure_ascii=False)}")

            return {
                "success": True,
                "provider": self.config.provider,
                "models": data.get("models", []),
                "next_page_token": data.get("nextPageToken"),
                "raw_response": data
            }

        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": "请求超时",
                "provider": self.config.provider
            }
        except requests.exceptions.ConnectionError:
            return {
                "success": False,
                "error": "连接失败",
                "provider": self.config.provider
            }

    def _list_openai_models(self, limit: Optional[int] = None, page_token: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        """获取OpenAI格式的模型列表"""
        base_url = self.config.base_url.rstrip('/')
        url = f"{base_url}/models"

        # 构建请求头
        headers = self._get_headers()

        if self.config.enable_logging:
            logger.info(f"OpenAI获取模型列表: {url}")

        try:
            response = requests.get(
                url,
                headers=headers,
                timeout=(self.config.connect_timeout, self.config.timeout)
            )

            if not response.ok:
                error_msg = f"HTTP {response.status_code}"
                try:
                    error_data = response.json()
                    if "error" in error_data:
                        if isinstance(error_data["error"], dict):
                            error_msg = error_data["error"].get("message", error_msg)
                        else:
                            error_msg = str(error_data["error"])
                except:
                    pass

                return {
                    "success": False,
                    "error": error_msg,
                    "provider": self.config.provider,
                    "status_code": response.status_code
                }

            data = response.json()
            if self.config.enable_logging:
                logger.info(f"OpenAI模型列表响应: {json.dumps(data, indent=2, ensure_ascii=False)}")

            return {
                "success": True,
                "provider": self.config.provider,
                "data": data.get("data", []),
                "raw_response": data
            }

        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": "请求超时",
                "provider": self.config.provider
            }
        except requests.exceptions.ConnectionError:
            return {
                "success": False,
                "error": "连接失败",
                "provider": self.config.provider
            }


# ========== 封装函数（供注册层调用） ==========

from typing import Tuple  # late import keepers


def _normalize_messages(messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    规范化/校验对话消息
    - 必须为数组，元素包含 {role, content}
    - role in ["system","user","assistant"]
    """
    if not isinstance(messages, list) or not messages:
        raise ValueError("messages 必须为非空数组")
    out: List[Dict[str, str]] = []
    for i, msg in enumerate(messages):
        if not isinstance(msg, dict):
            raise ValueError(f"messages[{i}] 必须为对象")
        role = msg.get("role")
        content = msg.get("content")
        if role not in ("system", "user", "assistant"):
            raise ValueError(f"messages[{i}].role 无效: {role}")
        if not isinstance(content, str):
            raise ValueError(f"messages[{i}].content 必须为字符串")
        out.append({"role": role, "content": content})
    return out


def _ensure_models(provider: str, models: Optional[List[str]]) -> List[str]:
    """
    若未提供 models，则回落到默认模型映射
    """
    if isinstance(models, list) and models:
        return models
    return v.DEFAULT_MODELS.get(provider, [])


def create_manager(
    provider: str,
    api_key: str,
    base_url: str,
    models: Optional[List[str]] = None,
    timeout: Optional[int] = None,
    connect_timeout: Optional[int] = None,
    enable_logging: bool = False,
) -> LLMAPIManager:
    """
    基于入参创建 LLMAPIManager
    """
    cfg = APIConfiguration(
        provider=provider,
        api_key=api_key or "",
        base_url=(base_url or "").rstrip("/"),
        models=_ensure_models(provider, models),
        enabled=True,
        timeout=int(timeout) if timeout is not None else v.DEFAULT_TIMEOUT,
        connect_timeout=int(connect_timeout) if timeout is not None else v.DEFAULT_CONNECT_TIMEOUT,
        enable_logging=bool(enable_logging),
    )
    return LLMAPIManager(cfg)


def call_chat_non_streaming(
    provider: str,
    api_key: str,
    base_url: str,
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    top_p: Optional[float] = None,
    presence_penalty: Optional[float] = None,
    frequency_penalty: Optional[float] = None,
    custom_params: Optional[Dict[str, Any]] = None,
    safety_settings: Optional[Dict[str, Any]] = None,
    timeout: Optional[int] = None,
    connect_timeout: Optional[int] = None,
    enable_logging: bool = False,
    models: Optional[List[str]] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    """
    非流式调用：返回一次性 JSON（不使用默认参数）
    """
    msgs = _normalize_messages(messages)
    mgr = create_manager(
        provider=provider,
        api_key=api_key,
        base_url=base_url,
        models=models,
        timeout=timeout,
        connect_timeout=connect_timeout,
        enable_logging=enable_logging,
    )

    extra: Dict[str, Any] = {}
    if top_p is not None:
        extra["top_p"] = top_p
    if presence_penalty is not None:
        extra["presence_penalty"] = presence_penalty
    if frequency_penalty is not None:
        extra["frequency_penalty"] = frequency_penalty
    if safety_settings is not None:
        extra["safety_settings"] = safety_settings
    if custom_params:
        extra["custom_params"] = custom_params

    resp: Union[APIResponse, Iterator[StreamChunk]] = mgr.call_api(
        messages=msgs,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        stream=False,
        **extra,
    )

    if isinstance(resp, APIResponse):
        return {
            "success": bool(resp.success),
            "content": resp.content or "",
            "usage": resp.usage,
            "response_time": resp.response_time,
            "model_used": resp.model_used,
            "finish_reason": resp.finish_reason,
            "raw_response": resp.raw_response,
            "provider": resp.provider or provider,
            "error": resp.error,
        }
    # 理论不应到达此分支
    return {
        "success": False,
        "error": "意外的返回类型（期望 APIResponse）",
        "provider": provider,
    }


def stream_chat_chunks(
    provider: str,
    api_key: str,
    base_url: str,
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    top_p: Optional[float] = None,
    presence_penalty: Optional[float] = None,
    frequency_penalty: Optional[float] = None,
    custom_params: Optional[Dict[str, Any]] = None,
    safety_settings: Optional[Dict[str, Any]] = None,
    timeout: Optional[int] = None,
    connect_timeout: Optional[int] = None,
    enable_logging: bool = False,
    models: Optional[List[str]] = None,
    **kwargs: Any,
) -> Iterator[StreamChunk]:
    """
    流式调用：返回迭代器（不使用默认参数）
    """
    msgs = _normalize_messages(messages)
    mgr = create_manager(
        provider=provider,
        api_key=api_key,
        base_url=base_url,
        models=models,
        timeout=timeout,
        connect_timeout=connect_timeout,
        enable_logging=enable_logging,
    )

    extra: Dict[str, Any] = {}
    if top_p is not None:
        extra["top_p"] = top_p
    if presence_penalty is not None:
        extra["presence_penalty"] = presence_penalty
    if frequency_penalty is not None:
        extra["frequency_penalty"] = frequency_penalty
    if safety_settings is not None:
        extra["safety_settings"] = safety_settings
    if custom_params:
        extra["custom_params"] = custom_params

    resp = mgr.call_api(
        messages=msgs,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        stream=True,
        **extra,
    )
    if isinstance(resp, Iterator):
        for chunk in resp:
            # 透传 manager 的流式分片
            yield chunk
    else:
        # 若返回 APIResponse（通常是错误），直接传递原始错误信息
        if isinstance(resp, APIResponse):
            error_msg = resp.error or "未知错误"
            yield StreamChunk(content=error_msg, finish_reason="error", usage=None)
        else:
            yield StreamChunk(content="未知错误类型", finish_reason="error", usage=None)


def list_models_impl(
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
    """
    获取远端可用模型
    """
    mgr = create_manager(
        provider=provider,
        api_key=api_key,
        base_url=(base_url or "").rstrip("/") if base_url else "",
        models=None,
        timeout=timeout,
        connect_timeout=connect_timeout,
        enable_logging=enable_logging,
    )
    return mgr.list_models(
        limit=limit,
        page_token=page_token,
        before_id=before_id,
        after_id=after_id,
    )


def get_defaults_impl() -> Dict[str, Any]:
    """
    返回静态默认值：支持的提供商、默认模型映射、HTTP 错误映射、默认超时等
    """
    return {
        "providers": list(v.SUPPORTED_PROVIDERS),
        "default_models": dict(v.DEFAULT_MODELS),
        "http_error_messages": dict(v.HTTP_ERROR_MESSAGES),
        "defaults": {
            "timeout": v.DEFAULT_TIMEOUT,
            "connect_timeout": v.DEFAULT_CONNECT_TIMEOUT,
            "max_request_size": v.MAX_REQUEST_SIZE,
            "log_level": v.DEFAULT_LOG_LEVEL,
        },
    }


def health_impl() -> Dict[str, Any]:
    """
    简单健康检查
    """
    return {"status": "ok", "timestamp": time.time()}