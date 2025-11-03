# -*- coding: utf-8 -*-
"""
SmartTavern AI 对话补全工作流 - 实现层

工作流程：
1. 读取对话文件，调用 chat_branches/openai_messages 获取 messages
2. 读取 LLM 配置文件
3. 调用 llm_api/chat 进行 AI 对话（支持流式/非流式）
4. 保存 AI 响应到对话文件（调用 chat_branches/append_message）
"""
from pathlib import Path
from typing import Any, Dict, Iterator, Optional, List
import json
import time

import core


def _repo_root() -> Path:
    """返回仓库根目录"""
    return Path(__file__).resolve().parents[4]


def _safe_read_json(file_path: str) -> Dict[str, Any]:
    """安全读取JSON文件"""
    root = _repo_root()
    target = (root / Path(file_path)).resolve()
    
    # 检查文件是否在 llm_configs 目录内
    llm_configs_dir = root / "backend_projects" / "SmartTavern" / "data" / "llm_configs"
    try:
        target.relative_to(llm_configs_dir)
    except ValueError:
        raise ValueError(f"LLM config file must be within llm_configs directory: {file_path}")
    
    if not target.exists():
        raise FileNotFoundError(f"LLM config file not found: {file_path}")
    
    with target.open("r", encoding="utf-8") as f:
        return json.load(f)


def chat_completion_non_streaming(
    conversation_file: str,
    llm_config_file: Optional[str] = None,
) -> Dict[str, Any]:
    """
    非流式AI对话补全
    
    参数：
    - conversation_file: 对话文件路径（相对仓库根）
    - llm_config_file: LLM配置文件路径（可选，若不提供则从settings.json自动读取）
    
    返回：
      {
        "success": bool,
        "node_id": str,  # 新创建的assistant消息节点ID
        "content": str,  # AI响应内容
        "usage": dict,   # token使用统计
        "response_time": float,
        "model_used": str,
        "error": str (可选)
      }
    """
    start_time = time.time()
    
    try:
        # 步骤0：如果未提供 llm_config_file，从 settings.json 读取
        if not llm_config_file:
            settings_result = core.call_api(
                "smarttavern/chat_branches/settings",
                {"action": "get", "file": conversation_file},
                method="POST",
                namespace="modules"
            )
            if not settings_result or "settings" not in settings_result:
                raise ValueError("Failed to get settings from conversation")
            
            llm_config_file = settings_result["settings"].get("llm_config")
            if not llm_config_file:
                raise ValueError("No llm_config found in conversation settings")
        
        # 步骤1：使用 assistant_view 处理消息（发送给AI用）
        process_result = process_messages_view_impl(
            conversation_file=conversation_file,
            view="assistant_view",
            variables=None  # 自动从文件读取
        )
        
        if not process_result.get("success"):
            raise ValueError(f"Failed to process messages view: {process_result.get('error')}")
        
        messages = process_result["messages"]
        
        # 同时获取 active_path（用于后续保存）
        messages_result = core.call_api(
            "smarttavern/chat_branches/openai_messages",
            {"file": conversation_file},
            method="POST",
            namespace="modules"
        )
        
        if not messages_result:
            raise ValueError("Failed to get conversation metadata")
        
        # 步骤2：读取LLM配置
        llm_config = _safe_read_json(llm_config_file)
        
        # 步骤3：调用LLM API（只使用配置文件的值，不提供默认值）
        llm_params = {
            "provider": llm_config.get("provider"),
            "api_key": llm_config.get("api_key"),
            "base_url": llm_config.get("base_url"),
            "messages": messages,
            "stream": False,  # 非流式
        }
        
        # 只添加配置文件中存在的参数
        if "model" in llm_config and llm_config["model"]:
            llm_params["model"] = llm_config["model"]
        if "max_tokens" in llm_config and llm_config["max_tokens"] is not None:
            llm_params["max_tokens"] = llm_config["max_tokens"]
        if "temperature" in llm_config and llm_config["temperature"] is not None:
            llm_params["temperature"] = llm_config["temperature"]
        if "top_p" in llm_config and llm_config["top_p"] is not None:
            llm_params["top_p"] = llm_config["top_p"]
        if "presence_penalty" in llm_config and llm_config["presence_penalty"] is not None:
            llm_params["presence_penalty"] = llm_config["presence_penalty"]
        if "frequency_penalty" in llm_config and llm_config["frequency_penalty"] is not None:
            llm_params["frequency_penalty"] = llm_config["frequency_penalty"]
        if "timeout" in llm_config and llm_config["timeout"] is not None:
            llm_params["timeout"] = llm_config["timeout"]
        if "connect_timeout" in llm_config and llm_config["connect_timeout"] is not None:
            llm_params["connect_timeout"] = llm_config["connect_timeout"]
        if "enable_logging" in llm_config:
            llm_params["enable_logging"] = llm_config["enable_logging"]
        if "custom_params" in llm_config and llm_config["custom_params"]:
            llm_params["custom_params"] = llm_config["custom_params"]
        if "safety_settings" in llm_config and llm_config["safety_settings"]:
            llm_params["safety_settings"] = llm_config["safety_settings"]
        
        llm_response = core.call_api(
            "llm_api/chat",
            llm_params,
            method="POST",
            namespace="modules"
        )
        
        if not llm_response.get("success"):
            return {
                "success": False,
                "error": llm_response.get("error", "LLM API call failed"),
                "response_time": time.time() - start_time
            }
        
        ai_content = llm_response.get("content", "")
        
        # 步骤4：保存AI响应到对话文件
        # 从 messages_result 中获取 path（active_path）
        active_path = messages_result.get("path", [])
        if not active_path:
            raise ValueError("No active_path found in conversation")
        
        parent_id = active_path[-1]
        last_node_id = active_path[-1]
        
        # 读取对话文档获取节点信息
        root = _repo_root()
        conv_file_path = (root / Path(conversation_file)).resolve()
        with conv_file_path.open("r", encoding="utf-8") as f:
            conv_doc = json.load(f)
        
        nodes = conv_doc.get("nodes", {})
        last_node = nodes.get(last_node_id, {})
        
        # 判断是否是空的 assistant 节点（重试创建的占位节点）
        is_empty_assistant = (
            last_node.get("role") == "assistant" and
            last_node.get("content", "").strip() == ""
        )
        
        if is_empty_assistant:
            # 更新现有节点
            update_result = core.call_api(
                "smarttavern/chat_branches/update_message",
                {
                    "file": conversation_file,
                    "node_id": last_node_id,
                    "content": ai_content
                },
                method="POST",
                namespace="modules"
            )
            
            return {
                "success": True,
                "node_id": last_node_id,
                "content": ai_content,
                "usage": llm_response.get("usage"),
                "response_time": time.time() - start_time,
                "model_used": llm_response.get("model_used"),
                "doc": update_result
            }
        else:
            # 创建新节点
            new_node_id = f"n_ass{int(time.time() * 1000)}"
            
            append_result = core.call_api(
                "smarttavern/chat_branches/append_message",
                {
                    "file": conversation_file,
                    "node_id": new_node_id,
                    "pid": parent_id,
                    "role": "assistant",
                    "content": ai_content
                },
                method="POST",
                namespace="modules"
            )
            
            return {
                "success": True,
                "node_id": new_node_id,
                "content": ai_content,
                "usage": llm_response.get("usage"),
                "response_time": time.time() - start_time,
                "model_used": llm_response.get("model_used"),
                "doc": append_result
            }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "response_time": time.time() - start_time
        }


def get_merged_rules_impl(conversation_file: str) -> Dict[str, Any]:
    """
    获取对话的统一正则规则
    
    工作流程：
    1. 从 settings.json 读取 preset、character、regex_rules 文件路径
    2. 读取这些文件的完整 JSON 内容
    3. 调用 assets_normalizer/normalize 合并规则
    4. 返回合并后的 regex_rules 数组
    
    参数：
    - conversation_file: 对话文件路径（相对仓库根）
    
    返回：
      {
        "success": bool,
        "regex_rules": [...],  # 合并后的正则规则数组
        "meta": {...},   # 元数据（来源统计等）
        "error": str (可选)
      }
    """
    try:
        # 步骤1：获取 settings
        settings_result = core.call_api(
            "smarttavern/chat_branches/settings",
            {"action": "get", "file": conversation_file},
            method="POST",
            namespace="modules"
        )
        
        if not settings_result or "settings" not in settings_result:
            raise ValueError("Failed to get settings from conversation")
        
        settings = settings_result["settings"]
        
        # 步骤2：读取各个资产文件
        root = _repo_root()
        
        # 读取 preset
        preset_file = settings.get("preset")
        if not preset_file:
            raise ValueError("No preset found in settings")
        
        preset_path = (root / Path(preset_file)).resolve()
        with preset_path.open("r", encoding="utf-8") as f:
            preset = json.load(f)
        
        # 读取 character（单值）
        character_file = settings.get("character")
        if not character_file:
            raise ValueError("No character found in settings")
        
        character_path = (root / Path(character_file)).resolve()
        with character_path.open("r", encoding="utf-8") as f:
            character = json.load(f)
        
        # 读取 regex_rules（独立正则文件数组）
        regex_files_list = settings.get("regex_rules", [])
        regex_files = {}
        
        if regex_files_list:
            for i, regex_file in enumerate(regex_files_list):
                if regex_file:
                    regex_path = (root / Path(regex_file)).resolve()
                    with regex_path.open("r", encoding="utf-8") as f:
                        regex_data = json.load(f)
                        # 使用索引作为 key，保持顺序
                        regex_files[f"regex_{i}"] = regex_data
        
        # 读取 world_books（可选）
        world_books_list = settings.get("world_books", [])
        world_books = {}
        
        if world_books_list:
            for i, wb_file in enumerate(world_books_list):
                if wb_file:
                    wb_path = (root / Path(wb_file)).resolve()
                    with wb_path.open("r", encoding="utf-8") as f:
                        wb_data = json.load(f)
                        world_books[f"wb_{i}"] = wb_data
        
        # 步骤3：调用 assets_normalizer 合并
        normalize_result = core.call_api(
            "smarttavern/assets_normalizer/normalize",
            {
                "preset": preset,
                "world_books": world_books,
                "character": character,
                "regex_files": regex_files
            },
            method="POST",
            namespace="modules"
        )
        
        if not normalize_result or "merged_regex" not in normalize_result:
            raise ValueError("Failed to normalize assets")
        
        merged_regex = normalize_result["merged_regex"]
        rules = merged_regex.get("regex_rules", [])
        
        return {
            "success": True,
            "regex_rules": rules,
            "meta": normalize_result.get("meta", {})
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "regex_rules": []
        }


def process_messages_view_impl(
    conversation_file: str,
    view: str,
    variables: Optional[Dict[str, Any]] = None,
    output: Optional[str] = "full",
) -> Dict[str, Any]:
    """
    处理对话消息的指定视图

    新工作流程（插入 RAW 前置处理 + 可选输出模式）:
    1. 从 settings.json 读取资产（preset/character/persona/regex_rules/world_books）
    2. 获取原始 messages（通过 openai_messages）作为 history
    2.5 使用 assets_normalizer/normalize 合并资产，调用 prompt_raw/assemble_full 进行 RAW 装配，得到新的 messages
    3. 读取 variables 文件（若未提供）
    4. 调用 prompt_postprocess/apply（基于合并后的 regex_rules 与选择的 view）进行后处理
    5. 保存更新后的 variables 到文件
    6. 根据 output 模式筛选返回的消息：
       - full: 返回全部处理后的 messages（包含 preset.relative/in-chat 等来源）
       - history: 仅返回 source.type 以 'history.' 开头且 role ∈ {user, assistant} 的消息（纯楼层）

    参数：
    - conversation_file: 对话文件路径（相对仓库根）
    - view: "user_view" | "assistant_view"
    - variables: 变量字典（可选，若未提供则从 variables.json 读取）
    - output: "full" | "history"（可选，默认 "full"）

    返回：
      {
        "success": bool,
        "messages": [...],     # 处理后的消息
        "variables": {...},    # 更新后的变量
        "error": str (可选)
      }
    """
    try:
        if view not in ("user_view", "assistant_view"):
            raise ValueError(f"Invalid view: {view}, must be 'user_view' or 'assistant_view'")

        # 读取 settings（资产路径）
        settings_result = core.call_api(
            "smarttavern/chat_branches/settings",
            {"action": "get", "file": conversation_file},
            method="POST",
            namespace="modules"
        )
        if not settings_result or "settings" not in settings_result:
            raise ValueError("Failed to get settings from conversation")
        settings = settings_result["settings"]

        # 解析并读取资产文件
        root = _repo_root()

        # preset
        preset_file = settings.get("preset")
        if not preset_file:
            raise ValueError("No preset found in settings")
        preset_path = (root / Path(preset_file)).resolve()
        with preset_path.open("r", encoding="utf-8") as f:
            preset = json.load(f)

        # character（单值）
        character_file = settings.get("character")
        if not character_file:
            raise ValueError("No character found in settings")
        character_path = (root / Path(character_file)).resolve()
        with character_path.open("r", encoding="utf-8") as f:
            character = json.load(f)

        # 独立正则（数组）
        regex_files_list = settings.get("regex_rules", [])
        regex_files: Dict[str, Any] = {}
        for i, regex_file in enumerate(regex_files_list or []):
            if regex_file:
                regex_path = (root / Path(regex_file)).resolve()
                with regex_path.open("r", encoding="utf-8") as f:
                    regex_data = json.load(f)
                    regex_files[f"regex_{i}"] = regex_data

        # 世界书（数组）
        world_books_list = settings.get("world_books", [])
        world_books: Dict[str, Any] = {}
        for i, wb_file in enumerate(world_books_list or []):
            if wb_file:
                wb_path = (root / Path(wb_file)).resolve()
                with wb_path.open("r", encoding="utf-8") as f:
                    wb_data = json.load(f)
                    world_books[f"wb_{i}"] = wb_data

        # 获取原始 messages（history）
        messages_result = core.call_api(
            "smarttavern/chat_branches/openai_messages",
            {"file": conversation_file},
            method="POST",
            namespace="modules"
        )
        if not messages_result or "messages" not in messages_result:
            raise ValueError("Failed to get messages from conversation file")
        history = messages_result["messages"]

        # 合并资产（标准化，得到单一 world_book 与合并正则）
        normalize_result = core.call_api(
            "smarttavern/assets_normalizer/normalize",
            {
                "preset": preset,
                "world_books": world_books,
                "character": character,
                "regex_files": regex_files
            },
            method="POST",
            namespace="modules"
        )
        if not normalize_result or "merged_regex" not in normalize_result:
            raise ValueError("Failed to normalize assets")
        merged_regex = normalize_result["merged_regex"]
        rules = merged_regex.get("regex_rules", []) or []

        normalized_preset = normalize_result.get("preset", preset)
        normalized_character = normalize_result.get("character", character)
        normalized_world_book = normalize_result.get("world_book", [])

        # persona（可选）
        persona_doc = None
        persona_file = settings.get("persona")
        if persona_file:
            persona_path = (root / Path(persona_file)).resolve()
            with persona_path.open("r", encoding="utf-8") as f:
                persona_doc = json.load(f)

        # RAW 装配：prefix + in-chat，输出新的 messages
        raw_result = core.call_api(
            "smarttavern/prompt_raw/assemble_full",
            {
                "presets": normalized_preset,
                "world_books": normalized_world_book,
                "history": history,
                "character": normalized_character,
                "persona": persona_doc
            },
            method="POST",
            namespace="workflow"
        )
        if not raw_result or "messages" not in raw_result:
            raise ValueError("Failed to assemble RAW messages")
        messages = raw_result["messages"]

        # 读取 variables（若未提供）
        if variables is None:
            variables_result = core.call_api(
                "smarttavern/chat_branches/variables",
                {"action": "get", "file": conversation_file},
                method="POST",
                namespace="modules"
            )
            if variables_result and "variables" in variables_result:
                variables = variables_result["variables"]
            else:
                variables = {}

        # 后处理：按视图应用规则与宏
        postprocess_result = core.call_api(
            "smarttavern/prompt_postprocess/apply",
            {
                "messages": messages,
                "regex_rules": rules,
                "view": view,
                "variables": variables
            },
            method="POST",
            namespace="workflow"
        )
        if not postprocess_result:
            raise ValueError("Failed to process messages")

        processed_messages = postprocess_result.get("message", [])
        variables_data = postprocess_result.get("variables", {})
        final_variables = variables_data.get("final", {})

        # 保存更新后的 variables
        if final_variables:
            core.call_api(
                "smarttavern/chat_branches/variables",
                {
                    "action": "set",
                    "file": conversation_file,
                    "data": final_variables
                },
                method="POST",
                namespace="modules"
            )

        # 输出筛选：history 模式仅返回历史楼层（user/assistant 且来源为 history.*）
        out_mode = (output or "full").lower()
        if out_mode == "history":
            filtered = []
            for m in processed_messages or []:
                try:
                    role = str(m.get("role", "")).lower()
                    src = m.get("source") or {}
                    stype = str(src.get("type", "")).lower()
                    if role in ("user", "assistant") and stype.startswith("history"):
                        filtered.append(m)
                except Exception:
                    continue
            processed_messages = filtered

        return {
            "success": True,
            "messages": processed_messages,
            "variables": final_variables
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "messages": [],
            "variables": {}
        }


def chat_completion_streaming(
    conversation_file: str,
    llm_config_file: Optional[str] = None,
) -> Iterator[Dict[str, Any]]:
    """
    流式AI对话补全
    
    参数：
    - conversation_file: 对话文件路径（相对仓库根）
    - llm_config_file: LLM配置文件路径（可选，若不提供则从settings.json自动读取）
    
    生成器yield：
      {"type": "chunk", "content": str}
      {"type": "finish", "finish_reason": str}
      {"type": "usage", "usage": dict}
      {"type": "saved", "node_id": str, "doc": dict}  # 保存成功
      {"type": "error", "message": str}
      {"type": "end"}
    """
    try:
        # 步骤0：如果未提供 llm_config_file，从 settings.json 读取
        if not llm_config_file:
            settings_result = core.call_api(
                "smarttavern/chat_branches/settings",
                {"action": "get", "file": conversation_file},
                method="POST",
                namespace="modules"
            )
            if not settings_result or "settings" not in settings_result:
                yield {"type": "error", "message": "Failed to get settings from conversation"}
                yield {"type": "end"}
                return
            
            llm_config_file = settings_result["settings"].get("llm_config")
            if not llm_config_file:
                yield {"type": "error", "message": "No llm_config found in conversation settings"}
                yield {"type": "end"}
                return
        
        # 步骤1：使用 assistant_view 处理消息（发送给AI用）
        process_result = process_messages_view_impl(
            conversation_file=conversation_file,
            view="assistant_view",
            variables=None  # 自动从文件读取
        )
        
        if not process_result.get("success"):
            yield {"type": "error", "message": f"Failed to process messages view: {process_result.get('error')}"}
            yield {"type": "end"}
            return
        
        messages = process_result["messages"]
        
        # 同时获取 active_path（用于后续保存）
        messages_result = core.call_api(
            "smarttavern/chat_branches/openai_messages",
            {"file": conversation_file},
            method="POST",
            namespace="modules"
        )
        
        if not messages_result:
            yield {"type": "error", "message": "Failed to get conversation metadata"}
            yield {"type": "end"}
            return
        
        active_path = messages_result.get("path", [])
        
        if not active_path:
            yield {"type": "error", "message": "No active_path found in conversation"}
            yield {"type": "end"}
            return
        
        parent_id = active_path[-1]
        
        # 步骤2：读取LLM配置
        llm_config = _safe_read_json(llm_config_file)
        
        # 步骤3：调用LLM API（流式，只使用配置文件的值）
        from api.modules.llm_api.impl import stream_chat_chunks
        
        # 构建参数（只使用配置文件中存在的值）
        stream_params = {
            "provider": llm_config.get("provider"),
            "api_key": llm_config.get("api_key"),
            "base_url": llm_config.get("base_url"),
            "messages": messages,
        }
        
        # 只添加配置文件中存在的参数
        if "model" in llm_config and llm_config["model"]:
            stream_params["model"] = llm_config["model"]
        if "max_tokens" in llm_config and llm_config["max_tokens"] is not None:
            stream_params["max_tokens"] = llm_config["max_tokens"]
        if "temperature" in llm_config and llm_config["temperature"] is not None:
            stream_params["temperature"] = llm_config["temperature"]
        if "top_p" in llm_config and llm_config["top_p"] is not None:
            stream_params["top_p"] = llm_config["top_p"]
        if "presence_penalty" in llm_config and llm_config["presence_penalty"] is not None:
            stream_params["presence_penalty"] = llm_config["presence_penalty"]
        if "frequency_penalty" in llm_config and llm_config["frequency_penalty"] is not None:
            stream_params["frequency_penalty"] = llm_config["frequency_penalty"]
        if "timeout" in llm_config and llm_config["timeout"] is not None:
            stream_params["timeout"] = llm_config["timeout"]
        if "connect_timeout" in llm_config and llm_config["connect_timeout"] is not None:
            stream_params["connect_timeout"] = llm_config["connect_timeout"]
        if "enable_logging" in llm_config:
            stream_params["enable_logging"] = llm_config["enable_logging"]
        if "custom_params" in llm_config and llm_config["custom_params"]:
            stream_params["custom_params"] = llm_config["custom_params"]
        if "safety_settings" in llm_config and llm_config["safety_settings"]:
            stream_params["safety_settings"] = llm_config["safety_settings"]
        
        chunk_iter = stream_chat_chunks(**stream_params)
        
        # 收集完整响应用于保存
        full_content = ""
        finish_reason = None
        usage = None
        has_error = False
        
        for chunk in chunk_iter:
            # 检查是否是错误
            if chunk.finish_reason == "error":
                # 错误情况：content 包含错误信息
                error_msg = chunk.content or "未知错误"
                has_error = True
                yield {"type": "error", "message": error_msg}
                yield {"type": "finish", "finish_reason": "error"}
                # 直接结束，不保存
                yield {"type": "end"}
                return
            
            if chunk.content:
                full_content += chunk.content
                yield {"type": "chunk", "content": chunk.content}
            
            if chunk.finish_reason:
                finish_reason = chunk.finish_reason
                yield {"type": "finish", "finish_reason": chunk.finish_reason}
            
            if chunk.usage:
                usage = chunk.usage
                yield {"type": "usage", "usage": chunk.usage}
        
        # 步骤4：仅在无错误且有内容时才保存
        if not has_error and full_content:
            try:
                # 检查 active_path 末尾节点是否是空的 assistant 节点（重试场景）
                # 如果是，更新该节点；否则创建新节点
                last_node_id = active_path[-1]
                
                # 读取对话文档获取节点信息
                doc_result = core.call_api(
                    "smarttavern/chat_branches/openai_messages",
                    {"file": conversation_file},
                    method="POST",
                    namespace="modules"
                )
                
                # 从完整文档中获取节点信息（需要读取原始文件）
                import json
                root = _repo_root()
                conv_file_path = (root / Path(conversation_file)).resolve()
                with conv_file_path.open("r", encoding="utf-8") as f:
                    conv_doc = json.load(f)
                
                nodes = conv_doc.get("nodes", {})
                last_node = nodes.get(last_node_id, {})
                
                # 判断是否是空的 assistant 节点（重试创建的占位节点）
                is_empty_assistant = (
                    last_node.get("role") == "assistant" and
                    last_node.get("content", "").strip() == ""
                )
                
                if is_empty_assistant:
                    # 更新现有节点
                    update_result = core.call_api(
                        "smarttavern/chat_branches/update_message",
                        {
                            "file": conversation_file,
                            "node_id": last_node_id,
                            "content": full_content
                        },
                        method="POST",
                        namespace="modules"
                    )
                    
                    yield {
                        "type": "saved",
                        "node_id": last_node_id,
                        "doc": update_result,
                        "usage": usage
                    }
                else:
                    # 创建新节点
                    new_node_id = f"n_ass{int(time.time() * 1000)}"
                    
                    append_result = core.call_api(
                        "smarttavern/chat_branches/append_message",
                        {
                            "file": conversation_file,
                            "node_id": new_node_id,
                            "pid": parent_id,
                            "role": "assistant",
                            "content": full_content
                        },
                        method="POST",
                        namespace="modules"
                    )
                    
                    yield {
                        "type": "saved",
                        "node_id": new_node_id,
                        "doc": append_result,
                        "usage": usage
                    }
                    
            except Exception as e:
                yield {"type": "error", "message": f"Failed to save response: {str(e)}"}
        
        yield {"type": "end"}
        
    except Exception as e:
        yield {"type": "error", "message": str(e)}
        yield {"type": "end"}


def chat_with_config_non_streaming(
    conversation_file: str,
    messages: List[Dict[str, str]],
    stream_override: Optional[bool] = None,
    custom_params_override: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    使用当前对话配置进行AI调用（自定义messages，非流式）
    
    参数：
    - conversation_file: 对话文件路径（用于读取llm_config）
    - messages: 自定义的消息数组
    - stream_override: 可选，如果提供则覆盖配置文件的 stream 值
    - custom_params_override: 可选，如果提供则覆盖配置文件的 custom_params
    
    返回：
      {
        "success": bool,
        "content": str,  # AI响应内容
        "usage": dict,   # token使用统计
        "response_time": float,
        "model_used": str,
        "finish_reason": str,
        "error": str (可选)
      }
    """
    start_time = time.time()
    
    try:
        # 步骤1：从 settings.json 读取 llm_config
        settings_result = core.call_api(
            "smarttavern/chat_branches/settings",
            {"action": "get", "file": conversation_file},
            method="POST",
            namespace="modules"
        )
        if not settings_result or "settings" not in settings_result:
            raise ValueError("Failed to get settings from conversation")
        
        llm_config_file = settings_result["settings"].get("llm_config")
        if not llm_config_file:
            raise ValueError("No llm_config found in conversation settings")
        
        # 步骤2：读取LLM配置
        llm_config = _safe_read_json(llm_config_file)
        
        # 步骤3：调用LLM API
        # 如果前端没有提供 stream_override，则使用配置文件的值（但对于非流式函数，强制为 False）
        llm_params = {
            "provider": llm_config.get("provider"),
            "api_key": llm_config.get("api_key"),
            "base_url": llm_config.get("base_url"),
            "messages": messages,
            "stream": False,  # 非流式函数始终为 False
        }
        
        # 只添加配置文件中存在的参数
        if "model" in llm_config and llm_config["model"]:
            llm_params["model"] = llm_config["model"]
        if "max_tokens" in llm_config and llm_config["max_tokens"] is not None:
            llm_params["max_tokens"] = llm_config["max_tokens"]
        if "temperature" in llm_config and llm_config["temperature"] is not None:
            llm_params["temperature"] = llm_config["temperature"]
        if "top_p" in llm_config and llm_config["top_p"] is not None:
            llm_params["top_p"] = llm_config["top_p"]
        if "presence_penalty" in llm_config and llm_config["presence_penalty"] is not None:
            llm_params["presence_penalty"] = llm_config["presence_penalty"]
        if "frequency_penalty" in llm_config and llm_config["frequency_penalty"] is not None:
            llm_params["frequency_penalty"] = llm_config["frequency_penalty"]
        if "timeout" in llm_config and llm_config["timeout"] is not None:
            llm_params["timeout"] = llm_config["timeout"]
        if "connect_timeout" in llm_config and llm_config["connect_timeout"] is not None:
            llm_params["connect_timeout"] = llm_config["connect_timeout"]
        if "enable_logging" in llm_config:
            llm_params["enable_logging"] = llm_config["enable_logging"]
        # 处理 custom_params：优先使用前端提供的，否则使用配置文件的
        if custom_params_override is not None:
            llm_params["custom_params"] = custom_params_override
        elif "custom_params" in llm_config and llm_config["custom_params"]:
            llm_params["custom_params"] = llm_config["custom_params"]
        
        if "safety_settings" in llm_config and llm_config["safety_settings"]:
            llm_params["safety_settings"] = llm_config["safety_settings"]
        
        llm_response = core.call_api(
            "llm_api/chat",
            llm_params,
            method="POST",
            namespace="modules"
        )
        
        if not llm_response.get("success"):
            return {
                "success": False,
                "error": llm_response.get("error", "LLM API call failed"),
                "response_time": time.time() - start_time
            }
        
        # 返回响应（不保存到对话文件）
        return {
            "success": True,
            "content": llm_response.get("content", ""),
            "usage": llm_response.get("usage"),
            "response_time": time.time() - start_time,
            "model_used": llm_response.get("model_used"),
            "finish_reason": llm_response.get("finish_reason")
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "response_time": time.time() - start_time
        }


def chat_with_config_streaming(
    conversation_file: str,
    messages: List[Dict[str, str]],
    stream_override: Optional[bool] = None,
    custom_params_override: Optional[Dict[str, Any]] = None,
) -> Iterator[Dict[str, Any]]:
    """
    使用当前对话配置进行AI调用（自定义messages，流式）
    
    参数：
    - conversation_file: 对话文件路径（用于读取llm_config）
    - messages: 自定义的消息数组
    - stream_override: 可选，如果提供则覆盖配置文件的 stream 值（流式函数忽略此参数）
    - custom_params_override: 可选，如果提供则覆盖配置文件的 custom_params
    
    生成器yield：
      {"type": "chunk", "content": str}
      {"type": "finish", "finish_reason": str}
      {"type": "usage", "usage": dict}
      {"type": "error", "message": str}
      {"type": "end"}
    """
    try:
        # 步骤1：从 settings.json 读取 llm_config
        settings_result = core.call_api(
            "smarttavern/chat_branches/settings",
            {"action": "get", "file": conversation_file},
            method="POST",
            namespace="modules"
        )
        if not settings_result or "settings" not in settings_result:
            yield {"type": "error", "message": "Failed to get settings from conversation"}
            yield {"type": "end"}
            return
        
        llm_config_file = settings_result["settings"].get("llm_config")
        if not llm_config_file:
            yield {"type": "error", "message": "No llm_config found in conversation settings"}
            yield {"type": "end"}
            return
        
        # 步骤2：读取LLM配置
        llm_config = _safe_read_json(llm_config_file)
        
        # 步骤3：调用LLM API（流式）
        from api.modules.llm_api.impl import stream_chat_chunks
        
        stream_params = {
            "provider": llm_config.get("provider"),
            "api_key": llm_config.get("api_key"),
            "base_url": llm_config.get("base_url"),
            "messages": messages,
        }
        
        # 只添加配置文件中存在的参数
        if "model" in llm_config and llm_config["model"]:
            stream_params["model"] = llm_config["model"]
        if "max_tokens" in llm_config and llm_config["max_tokens"] is not None:
            stream_params["max_tokens"] = llm_config["max_tokens"]
        if "temperature" in llm_config and llm_config["temperature"] is not None:
            stream_params["temperature"] = llm_config["temperature"]
        if "top_p" in llm_config and llm_config["top_p"] is not None:
            stream_params["top_p"] = llm_config["top_p"]
        if "presence_penalty" in llm_config and llm_config["presence_penalty"] is not None:
            stream_params["presence_penalty"] = llm_config["presence_penalty"]
        if "frequency_penalty" in llm_config and llm_config["frequency_penalty"] is not None:
            stream_params["frequency_penalty"] = llm_config["frequency_penalty"]
        if "timeout" in llm_config and llm_config["timeout"] is not None:
            stream_params["timeout"] = llm_config["timeout"]
        if "connect_timeout" in llm_config and llm_config["connect_timeout"] is not None:
            stream_params["connect_timeout"] = llm_config["connect_timeout"]
        if "enable_logging" in llm_config:
            stream_params["enable_logging"] = llm_config["enable_logging"]
        # 处理 custom_params：优先使用前端提供的，否则使用配置文件的
        if custom_params_override is not None:
            stream_params["custom_params"] = custom_params_override
        elif "custom_params" in llm_config and llm_config["custom_params"]:
            stream_params["custom_params"] = llm_config["custom_params"]
        
        if "safety_settings" in llm_config and llm_config["safety_settings"]:
            stream_params["safety_settings"] = llm_config["safety_settings"]
        
        chunk_iter = stream_chat_chunks(**stream_params)
        
        # 流式返回（不保存到对话文件）
        for chunk in chunk_iter:
            # 检查是否是错误
            if chunk.finish_reason == "error":
                error_msg = chunk.content or "未知错误"
                yield {"type": "error", "message": error_msg}
                yield {"type": "finish", "finish_reason": "error"}
                yield {"type": "end"}
                return
            
            if chunk.content:
                yield {"type": "chunk", "content": chunk.content}
            
            if chunk.finish_reason:
                yield {"type": "finish", "finish_reason": chunk.finish_reason}
            
            if chunk.usage:
                yield {"type": "usage", "usage": chunk.usage}
        
        yield {"type": "end"}
        
    except Exception as e:
        yield {"type": "error", "message": str(e)}
        yield {"type": "end"}