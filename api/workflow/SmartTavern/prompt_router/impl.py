# -*- coding: utf-8 -*-
"""
SmartTavern Prompt Router 实现层

核心功能：
- 集成前端 prompt-router.js 的所有路由逻辑到后端
- 只需传入 conversation_file，自动读取所有配置
- 在各阶段执行插件注册的 Hooks
- 返回处理后的结果

这是对前端 prompt-router.js 中 routeProcessView 的 Python 实现
"""

from __future__ import annotations
import logging
import asyncio
import time
from typing import Any, Dict, List, Optional
import hashlib
import json

from api.plugins.SmartTavern import get_hook_manager

logger = logging.getLogger(__name__)

# 轻量内存缓存：按 (conversation_file, view) 维护上次指纹
# 结构：{
#   key: {
#     'messages_fp': { source_id: hash },
#     'variables_fp': { path: hash },
#     'variables_hash': str,
#     'messages_total': int,
#     'variables_total': int,
#   }
# }
_DELTA_CACHE: Dict[str, Dict[str, Any]] = {}
_DELTA_CACHE_MAX_ENTRIES: int = 1024
_DELTA_CACHE_TTL_SECONDS: int = 1800  # 30 分钟未访问即视为过期

def _cache_key(conversation_file: str, view: str, router_id: Optional[str] = None) -> str:
    rid = router_id if router_id else "global"
    return f"{conversation_file}::{view}::{rid}"

def _prune_cache(now_ts: float) -> None:
    try:
        # 先清理过期项
        if _DELTA_CACHE_TTL_SECONDS > 0:
            expired_keys = [k for k, v in _DELTA_CACHE.items() if (now_ts - float(v.get('ts', now_ts))) > _DELTA_CACHE_TTL_SECONDS]
            for k in expired_keys:
                _DELTA_CACHE.pop(k, None)
        # 再按容量裁剪：超出容量时，移除最久未使用的项
        if len(_DELTA_CACHE) > _DELTA_CACHE_MAX_ENTRIES:
            items = sorted(_DELTA_CACHE.items(), key=lambda kv: float(kv[1].get('ts', now_ts)))
            to_remove = len(_DELTA_CACHE) - _DELTA_CACHE_MAX_ENTRIES
            for i in range(to_remove):
                _DELTA_CACHE.pop(items[i][0], None)
    except Exception:
        # 清理失败忽略，不影响主流程
        pass


def route_process_view_impl(
    conversation_file: str,
    view: str = "user_view",
    output: str = "full",
    fingerprints: Optional[Dict[str, str]] = None,
    variables_hash: Optional[str] = None,
    variables_fingerprints: Optional[Dict[str, str]] = None,
    router_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    视图处理路由（带 Hook 执行）
    
    完整流程（对应前端 prompt-router.js 的 routeProcessView）：
    1. 读取 settings 获取资产配置
    2. beforeNormalizeAssets Hook
    3. 调用 assets_normalizer 合并规则
    4. afterNormalizeAssets Hook
    5. 读取原始 messages
    6. beforeRaw Hook
    7. afterInsert Hook
    8. 调用 prompt_raw/assemble_full 进行 RAW 装配
    9. afterRaw Hook
    10. 读取 variables
    11. beforePostprocess Hook
    12. 调用 prompt_postprocess/apply 进行后处理
    13. afterPostprocess Hook
    14. beforeVariablesSave Hook
    15. 保存 variables
    16. afterVariablesSave Hook
    17. 返回结果
    
    参数：
        conversation_file: 对话文件路径
        view: "user_view" | "assistant_view"
        output: "full" | "history"
    
    返回：
        {
            "success": True,
            "messages": [...],
            "variables": {...}
        }
    """
    try:
        # 获取 Hook 管理器（同步调用）
        import core
        hook_manager = get_hook_manager()
        ctx = {"conversationFile": conversation_file, "view": view}
        
        # 创建或获取事件循环用于执行异步 Hook
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        # === 步骤1：读取 settings（优先同目录 settings.json）===
        # 仅通过接口读取，不再从 conversation.json 内部字段读取
        try:
            settings_resp = core.call_api(
                "smarttavern/chat_branches/settings",
                {"action": "get", "file": conversation_file},
                method="POST",
                namespace="modules",
            )
            settings = (settings_resp or {}).get("settings", {}) or {}
        except Exception:
            # 不再从对话文件读取旧格式配置
            settings = {}
        
        # 提取资产路径
        preset_file = settings.get("preset")
        # 兼容：历史字段可能为 characters（数组），新版为 character（单值）
        characters = settings.get("characters", [])
        character_file = characters[0] if isinstance(characters, list) and characters else settings.get("character")
        regex_files_list = settings.get("regex_rules", [])
        world_books_list = settings.get("world_books", [])
        persona_file = settings.get("persona")

        # 缺省回退：未配置 preset 时使用仓库内置默认预设
        if not preset_file:
            preset_file = "backend_projects/SmartTavern/data/presets/Default/preset.json"
        
        # === 读取资产详情（通过 data_catalog API）===
        
        # 并行读取
        preset_detail = core.call_api(
            "smarttavern/data_catalog/get_preset_detail",
            {"file": preset_file},
            method="POST",
            namespace="modules"
        ) if preset_file else {}
        
        character_detail = core.call_api(
            "smarttavern/data_catalog/get_character_detail",
            {"file": character_file},
            method="POST",
            namespace="modules"
        ) if character_file else {}
        
        persona_detail = core.call_api(
            "smarttavern/data_catalog/get_persona_detail",
            {"file": persona_file},
            method="POST",
            namespace="modules"
        ) if persona_file else {}
        
        # 读取正则规则
        regex_files = {}
        for i, regex_file in enumerate(regex_files_list or []):
            if regex_file:
                detail = core.call_api(
                    "smarttavern/data_catalog/get_regex_rule_detail",
                    {"file": regex_file},
                    method="POST",
                    namespace="modules"
                )
                regex_files[f"regex_{i}"] = detail.get("content", {})
        
        # 读取世界书
        world_books = {}
        for i, wb_file in enumerate(world_books_list or []):
            if wb_file:
                detail = core.call_api(
                    "smarttavern/data_catalog/get_world_book_detail",
                    {"file": wb_file},
                    method="POST",
                    namespace="modules"
                )
                world_books[f"wb_{i}"] = detail.get("content", {})
        
        # === 步骤2：beforeNormalizeAssets Hook ===
        assets_in = loop.run_until_complete(hook_manager.run_hooks('beforeNormalizeAssets', {
            'preset': preset_detail.get("content", {}),
            'world_books': world_books,
            'character': character_detail.get("content", {}),
            'regex_files': regex_files
        }, ctx))
        
        # === 步骤3：资产归一化（通过 API）===
        normalize_res = core.call_api(
            "smarttavern/assets_normalizer/normalize",
            {
                "preset": assets_in.get('preset', {}),
                "world_books": assets_in.get('world_books', {}),
                "character": assets_in.get('character', {}),
                "regex_files": assets_in.get('regex_files', {})
            },
            method="POST",
            namespace="modules"
        )
        
        merged_regex = normalize_res.get("merged_regex", {})
        rules = merged_regex.get("regex_rules", [])
        normalized_preset = normalize_res.get("preset", {})
        normalized_character = normalize_res.get("character", {})
        normalized_world_book = normalize_res.get("world_book", [])
        
        # === 步骤4：afterNormalizeAssets Hook ===
        assets_out = loop.run_until_complete(hook_manager.run_hooks('afterNormalizeAssets', {
            'preset': normalized_preset,
            'world_books': normalized_world_book,
            'character': normalized_character,
            'regex_files': merged_regex
        }, ctx))
        
        # 更新资产
        if assets_out and isinstance(assets_out, dict):
            normalized_preset = assets_out.get('preset', normalized_preset)
            normalized_world_book = assets_out.get('world_books', normalized_world_book)
            normalized_character = assets_out.get('character', normalized_character)
            out_regex_files = assets_out.get('regex_files', merged_regex)
            rules = out_regex_files.get('regex_rules', rules) if isinstance(out_regex_files, dict) else rules
        
        # === 步骤5：读取原始消息（从树状结构转换）===
        # 对话文件是树状结构，需要用 openai_messages API 转换为消息数组
        messages_res = core.call_api(
            "smarttavern/chat_branches/openai_messages",
            {"file": conversation_file},
            method="POST",
            namespace="modules"
        )
        
        history_for_raw = messages_res.get("messages", [])
        # 关联每条 history 对应的节点ID，便于后续在 in-chat 与视图阶段进行精确映射
        try:
            _path = messages_res.get("path", []) or []
            if isinstance(history_for_raw, list) and isinstance(_path, list):
                for _i, _m in enumerate(history_for_raw):
                    if isinstance(_m, dict) and _i < len(_path):
                        # 标准化为 id 字段，供下游 in_chat_constructor 透传为 source.source_id
                        _m.setdefault("id", _path[_i])
        except Exception:
            pass
        logger.info(f"步骤5 - 从树状结构提取消息数量: {len(history_for_raw)}")
        
        # === 步骤6：beforeRaw Hook ===
        history_for_raw = loop.run_until_complete(hook_manager.run_hooks('beforeRaw', history_for_raw, ctx))
        
        # === 步骤7：afterInsert Hook ===
        history_for_raw = loop.run_until_complete(hook_manager.run_hooks('afterInsert', history_for_raw, ctx))
        
        # === 步骤8：RAW 装配（通过 API）===
        logger.info(f"步骤8 - 调用 RAW 装配，history 数量: {len(history_for_raw)}")
        
        raw_res = core.call_api(
            "smarttavern/prompt_raw/assemble_full",
            {
                "presets": normalized_preset,
                "world_books": normalized_world_book,
                "history": history_for_raw,
                "character": normalized_character,
                "persona": persona_detail.get("content", {})
            },
            method="POST",
            namespace="workflow"
        )
        
        # 仅记录类型，避免打印大体量内容
        logger.info(f"步骤8 - RAW 装配返回类型: {type(raw_res).__name__}")
        if logger.isEnabledFor(logging.DEBUG):
            try:
                if isinstance(raw_res, dict):
                    logger.debug(f"步骤8 - RAW 装配返回摘要: keys={list(raw_res.keys())[:10]}")
                else:
                    logger.debug(f"步骤8 - RAW 装配返回摘要: {str(raw_res)[:500]}")
            except Exception:
                pass
        
        messages = raw_res.get("messages", []) if isinstance(raw_res, dict) else []
        logger.info(f"步骤8 - 提取的 messages 数量: {len(messages)}")
        
        # === 步骤9：afterRaw Hook ===
        messages = loop.run_until_complete(hook_manager.run_hooks('afterRaw', messages, ctx))
        
        # === 步骤10：读取变量（同目录 variables.json）===
        try:
            variables_res = core.call_api(
                "smarttavern/chat_branches/variables",
                {"action": "get", "file": conversation_file},
                method="POST",
                namespace="modules",
            )
            variables_obj = (variables_res or {}).get("variables", {}) or {}
        except Exception:
            # 不再从对话文件读取旧格式变量，使用空对象
            variables_obj = {}
        # 注入对话文件供宏与插件使用（例如自定义宏 getCtxVar）
        try:
            if isinstance(variables_obj, dict):
                variables_obj["__conversation_file"] = conversation_file
        except Exception:
            pass
        
        # === 步骤11：beforePostprocess Hook（按 view 区分）===
        if view == 'user_view':
            hook_name = 'beforePostprocessUser'
        else:  # assistant_view
            hook_name = 'beforePostprocessAssistant'
        
        pre_proc = loop.run_until_complete(hook_manager.run_hooks(hook_name, {
            'messages': messages,
            'rules': rules,
            'variables': variables_obj
        }, ctx))
        
        if pre_proc and isinstance(pre_proc, dict):
            messages = pre_proc.get('messages', messages)
            rules = pre_proc.get('rules', rules)
            variables_obj = pre_proc.get('variables', variables_obj)
        
        # === 步骤12：后处理（通过 API）===
        logger.info(f"步骤12 - 调用后处理 API，参数: messages数量={len(messages)}, rules数量={len(rules)}, view={view}")
        logger.debug(f"步骤12 - 入参类型: messages={type(messages).__name__}, rules={type(rules).__name__}, variables={type(variables_obj).__name__}")
        
        post_res = core.call_api(
            "smarttavern/prompt_postprocess/apply",
            {
                "messages": messages,
                "regex_rules": rules,  # 修正：API 需要 regex_rules 而不是 rules
                "view": view,
                "variables": variables_obj
            },
            method="POST",
            namespace="workflow"
        )
        
        # 仅记录类型，避免打印大体量内容
        logger.info(f"步骤12 - 后处理 API 返回类型: {type(post_res).__name__}")
        if logger.isEnabledFor(logging.DEBUG):
            try:
                if isinstance(post_res, dict):
                    logger.debug(f"步骤12 - 后处理返回摘要: keys={list(post_res.keys())[:10]}")
                else:
                    logger.debug(f"步骤12 - 后处理返回摘要: {str(post_res)[:500]}")
            except Exception:
                pass
        
        # 检查返回是否为字符串（错误）
        if isinstance(post_res, str):
            logger.error(f"步骤12 - 后处理 API 返回错误字符串: {post_res}")
            raise Exception(f"后处理API返回错误: {post_res}")
        
        processed_messages = post_res.get("message", [])
        vars_data = post_res.get("variables", {})
        final_vars = vars_data.get("final", {})
        
        # 日志：检查 processed_messages 的类型和内容
        logger.info(f"步骤12后处理结果 - processed_messages 类型: {type(processed_messages).__name__}, 长度: {len(processed_messages) if isinstance(processed_messages, list) else 'N/A'}")
        if logger.isEnabledFor(logging.DEBUG) and processed_messages and len(processed_messages) > 0:
            try:
                logger.debug(f"第一个元素类型: {type(processed_messages[0]).__name__}")
            except Exception:
                pass
        
        # === 步骤13：afterPostprocess Hook（按 view 区分）===
        if view == 'user_view':
            hook_name = 'afterPostprocessUser'
        else:  # assistant_view
            hook_name = 'afterPostprocessAssistant'
        
        post_proc = loop.run_until_complete(hook_manager.run_hooks(hook_name, {
            'messages': processed_messages,
            'rules': rules,
            'variables': variables_obj
        }, ctx))
        
        if post_proc and isinstance(post_proc, dict):
            processed_messages = post_proc.get('messages', processed_messages)
            rules = post_proc.get('rules', rules)
            variables_obj = post_proc.get('variables', variables_obj)
        
        # === 步骤14：beforeVariablesSave Hook ===
        final_vars = loop.run_until_complete(hook_manager.run_hooks('beforeVariablesSave', final_vars, ctx))
        
        # === 步骤15：保存变量（通过 chat_branches API）===
        if final_vars and isinstance(final_vars, dict) and final_vars:
            try:
                core.call_api(
                    "smarttavern/chat_branches/variables",
                    {
                        "action": "set",
                        "file": conversation_file,
                        "data": final_vars
                    },
                    method="POST",
                    namespace="modules"
                )
            except Exception as e:
                logger.warning(f"保存变量失败: {e}")
        
        # === 步骤16：afterVariablesSave Hook ===
        loop.run_until_complete(hook_manager.run_hooks('afterVariablesSave', final_vars, ctx))
        
        # === 步骤17：输出筛选 ===
        logger.info(f"步骤17 - 输出筛选前 processed_messages 类型: {type(processed_messages).__name__}, 长度: {len(processed_messages) if isinstance(processed_messages, list) else 'N/A'}")
        
        if output == "history":
            filtered = []
            for i, m in enumerate(processed_messages):
                if logger.isEnabledFor(logging.DEBUG):
                    try:
                        logger.debug(f"处理消息 {i} - 类型: {type(m).__name__}")
                    except Exception:
                        pass
                
                # 检查 m 是否是字典
                if not isinstance(m, dict):
                    logger.warning(f"跳过非字典消息 {i}: {type(m)}")
                    continue
                    
                source = m.get("source", {})
                stype = str(source.get("type", "")).lower()
                role = str(m.get("role", "")).lower()
                # 仅保留来自历史的对话楼层（user/assistant/system）
                if stype.startswith("history") and role in ("user", "assistant", "system"):
                    filtered.append(m)
            processed_messages = filtered
            logger.info(f"步骤17 - 筛选后 processed_messages 长度: {len(processed_messages)}")

        # 增量模式：基于 history 视图输出最小变更集（只返回内容变更的消息与变量）
        if output == "delta":
            # 先基于 history 筛选（与上面的 history 分支一致）
            filtered: List[Dict[str, Any]] = []
            for i, m in enumerate(processed_messages):
                if not isinstance(m, dict):
                    continue
                src = m.get("source", {}) or {}
                stype = str(src.get("type", "")).lower()
                role = str(m.get("role", "")).lower()
                if stype.startswith("history") and role in ("user", "assistant", "system"):
                    filtered.append(m)

            def _msg_hash(msg: Dict[str, Any]) -> str:
                base = {
                    "role": str(msg.get("role", "")),
                    "content": str(msg.get("content", "")),
                }
                s = json.dumps(base, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
                return hashlib.sha256(s.encode("utf-8")).hexdigest()

            # 支持后端缓存指纹：当前端未提供时从缓存读取
            cache_key = _cache_key(conversation_file, view, router_id)
            cached_entry = _DELTA_CACHE.get(cache_key, {}) if isinstance(_DELTA_CACHE, dict) else {}
            client_fp = fingerprints or cached_entry.get('messages_fp', {}) or {}
            changed: List[Dict[str, Any]] = []
            unchanged_count = 0
            current_source_ids: List[str] = []
            new_messages_fp: Dict[str, str] = {}

            for i, m in enumerate(filtered):
                src = m.get("source", {}) or {}
                source_id = src.get("source_id") or src.get("id") or f"history_{i}"
                current_source_ids.append(str(source_id))
                h = _msg_hash(m)
                new_messages_fp[str(source_id)] = h
                if client_fp.get(source_id) != h:
                    changed.append({
                        "source_id": source_id,
                        "role": m.get("role"),
                        "content": m.get("content"),
                    })
                else:
                    unchanged_count += 1

            # 计算被删除的消息（客户端存在但服务端已不在当前历史中的）
            current_set = set(current_source_ids)
            messages_deleted: List[str] = []
            for k in client_fp.keys():
                if str(k) not in current_set:
                    messages_deleted.append(str(k))

            # 变量哈希（用于判断是否需要返回 variables）
            try:
                vars_serialized = json.dumps(final_vars, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
                vars_hash = hashlib.sha256(vars_serialized.encode("utf-8")).hexdigest()
            except Exception:
                vars_hash = ""

            # 变量增量：按路径指纹返回变更与删除
            def _flatten(obj: Any, prefix: str = "") -> Dict[str, Any]:
                out: Dict[str, Any] = {}
                if isinstance(obj, dict):
                    for k, v in obj.items():
                        key = f"{prefix}.{k}" if prefix else str(k)
                        if isinstance(v, (dict, list)):
                            out.update(_flatten(v, key))
                        else:
                            out[key] = v
                elif isinstance(obj, list):
                    for i2, v in enumerate(obj):
                        key = f"{prefix}[{i2}]" if prefix else f"[{i2}]"
                        if isinstance(v, (dict, list)):
                            out.update(_flatten(v, key))
                        else:
                            out[key] = v
                else:
                    if prefix:
                        out[prefix] = obj
                return out

            def _val_hash(val: Any) -> str:
                try:
                    s2 = json.dumps(val, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
                except Exception:
                    s2 = str(val)
                return hashlib.sha256(s2.encode("utf-8")).hexdigest()

            variables_changed: List[Dict[str, Any]] = []
            variables_deleted: List[str] = []
            variables_unchanged = 0
            flat_vars = _flatten(final_vars or {})

            client_var_fp = variables_fingerprints or cached_entry.get('variables_fp', {}) or {}
            # 若提供总哈希且与服务端一致，可直接跳过变量diff
            skip_vars_diff = bool(variables_hash) and variables_hash == vars_hash
            if not skip_vars_diff:
                # 计算变更/新增
                for p, v in flat_vars.items():
                    h2 = _val_hash(v)
                    if client_var_fp.get(p) != h2:
                        variables_changed.append({"path": p, "value": v})
                    else:
                        variables_unchanged += 1
                # 计算删除
                for p in client_var_fp.keys():
                    if p not in flat_vars:
                        variables_deleted.append(p)
            else:
                variables_unchanged = len(flat_vars)

            out: Dict[str, Any] = {
                "success": True,
                "mode": "delta",
                "changed": changed,
                "unchanged": unchanged_count,
                "total": len(filtered),
                "messages_deleted": messages_deleted,
            }
            # 始终提供变量统计与 noop 标志；仅在需要时返回变更列表
            out["variables_total"] = len(flat_vars)
            out["variables_unchanged"] = variables_unchanged
            out["variables_noop"] = bool(skip_vars_diff)
            if not skip_vars_diff:
                out["variables_changed"] = variables_changed
                out["variables_deleted"] = variables_deleted
            # 更新后端缓存：以当前结果为基准
            try:
                now_ts = time.time()
                _DELTA_CACHE[cache_key] = {
                    'messages_fp': new_messages_fp,
                    'variables_fp': {p: _val_hash(v) for p, v in flat_vars.items()},
                    'variables_hash': vars_hash,
                    'messages_total': len(new_messages_fp),
                    'variables_total': len(flat_vars),
                    'ts': now_ts,
                }
                _prune_cache(now_ts)
            except Exception:
                pass
            return out
        
        return {
            "success": True,
            "messages": processed_messages,
            "variables": final_vars
        }
    
    except Exception as e:
        logger.error(f"路由处理失败: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "messages": [],
            "variables": {}
        }


def route_complete_impl(
    conversation_file: str,
    stream: bool = False,
    target_node_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    带 Hook 的 AI 调用（完整版）
    
    完整流程：
    1-11. 调用 route_process_view_impl(assistant_view) 执行所有提示词处理 Hook
    12. beforeLLMCall Hook - LLM 调用前
    13. 调用 LLM API
    14. afterLLMCall Hook - LLM 调用后
    15. beforeSaveResponse Hook - 保存响应前
    16. 保存 AI 响应
    17. afterSaveResponse Hook - 保存响应后
    
    参数：
        conversation_file: 对话文件路径
    
    返回：
        {
            "success": True,
            "content": "AI响应",
            "node_id": "...",
            "usage": {...}
        }
    """
    import time
    import json
    from pathlib import Path
    import core
    
    start_time = time.time()
    
    try:
        # 获取 Hook 管理器（同步调用）
        hook_manager = get_hook_manager()
        ctx = {"conversationFile": conversation_file, "view": "assistant_view", "targetNodeId": target_node_id}
        
        # 创建或获取事件循环用于执行异步 Hook
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        # === 步骤1-11：调用 route_process_view_impl 执行所有提示词处理 Hook ===
        process_result = route_process_view_impl(
            conversation_file=conversation_file,
            view="assistant_view",  # AI 调用使用 assistant_view
            output="full"
        )
        
        if not process_result.get("success"):
            return {
                "success": False,
                "error": f"提示词处理失败: {process_result.get('error')}",
                "response_time": time.time() - start_time
            }
        
        messages = process_result["messages"]
        
        # === 读取 LLM 配置（优先同目录 settings.json）===
        try:
            settings_resp = core.call_api(
                "smarttavern/chat_branches/settings",
                {"action": "get", "file": conversation_file},
                method="POST",
                namespace="modules",
            )
            settings = (settings_resp or {}).get("settings", {}) or {}
        except Exception:
            # 回退：从 conversation.json 内部读取（兼容旧数据）
            conv_detail = core.call_api(
                "smarttavern/data_catalog/get_conversation_detail",
                {"file": conversation_file},
                method="POST",
                namespace="modules"
            )
            if not conv_detail or "error" in conv_detail:
                return {
                    "success": False,
                    "error": f"读取对话文件失败: {conv_detail.get('error', '未知错误') if isinstance(conv_detail, dict) else '未知错误'}",
                    "response_time": time.time() - start_time
                }
            settings = (conv_detail.get("content", {}) or {}).get("settings", {}) or {}
        llm_config_file = settings.get("llm_config")
        
        if not llm_config_file:
            return {
                "success": False,
                "error": "未找到 llm_config 配置",
                "response_time": time.time() - start_time
            }
        
        # 读取 LLM 配置文件
        llm_config_detail = core.call_api(
            "smarttavern/data_catalog/get_llm_config_detail",
            {"file": llm_config_file},
            method="POST",
            namespace="modules"
        )
        
        if not llm_config_detail or "error" in llm_config_detail:
            return {
                "success": False,
                "error": f"读取 LLM 配置失败: {llm_config_detail.get('error', '未知错误')}",
                "response_time": time.time() - start_time
            }
        
        llm_config = llm_config_detail.get("content", {})
        
        # 构建 LLM 参数（允许切换流式/非流式）
        llm_params = {
            "provider": llm_config.get("provider"),
            "api_key": llm_config.get("api_key"),
            "base_url": llm_config.get("base_url"),
            "stream": bool(stream),
        }
        
        # 只添加配置文件中存在的参数
        for key in ["model", "max_tokens", "temperature", "top_p",
                    "presence_penalty", "frequency_penalty", "timeout",
                    "connect_timeout", "enable_logging", "custom_params", "safety_settings"]:
            if key in llm_config and llm_config[key] is not None:
                llm_params[key] = llm_config[key]
        
        # === 步骤12：beforeLLMCall Hook ===
        hook_data = loop.run_until_complete(hook_manager.run_hooks('beforeLLMCall', {
            'messages': messages,
            'llm_params': llm_params
        }, ctx))
        
        if hook_data and isinstance(hook_data, dict):
            messages = hook_data.get('messages', messages)
            llm_params = hook_data.get('llm_params', llm_params)
        
        # === 流式调用时的提前验证（避免在生成器内部遇到配置错误） ===
        if stream:
            # 流式调用前，提前验证所有必需的配置和数据
            # 这样如果有错误可以直接抛出 HTTPException，而不是进入 SSE 流
            
            # 验证 active_path（流式路径需要）
            if not target_node_id:
                active_path_check: List[str] = []
                try:
                    messages_result_check = core.call_api(
                        "smarttavern/chat_branches/openai_messages",
                        {"file": conversation_file},
                        method="POST",
                        namespace="modules",
                    )
                    if isinstance(messages_result_check, dict):
                        active_path_check = messages_result_check.get("path", []) or []
                except Exception:
                    active_path_check = []
                
                if not active_path_check:
                    try:
                        conv_detail_check = core.call_api(
                            "smarttavern/data_catalog/get_conversation_detail",
                            {"file": conversation_file},
                            method="POST",
                            namespace="modules",
                        )
                        active_path_check = ((conv_detail_check or {}).get("content", {}) or {}).get("active_path", []) or []
                    except Exception:
                        active_path_check = []
                
                if not active_path_check:
                    # 配置错误，直接返回
                    return {
                        "success": False,
                        "error": "未找到 active_path",
                        "response_time": time.time() - start_time
                    }
        
        # 确保 messages 在 llm_params 中
        llm_params["messages"] = messages
        
        if not stream:
            # === 步骤13：调用 LLM API（非流式） ===
            llm_response = core.call_api(
                "llm_api/chat",
                llm_params,
                method="POST",
                namespace="modules"
            )
            
            if not llm_response.get("success"):
                return {
                    "success": False,
                    "error": llm_response.get("error", "LLM API 调用失败"),
                    "response_time": time.time() - start_time
                }
            
            # === 步骤14：afterLLMCall Hook ===
            llm_result = {
                'content': llm_response.get("content", ""),
                'usage': llm_response.get("usage"),
                'finish_reason': llm_response.get("finish_reason"),
                'model_used': llm_response.get("model_used")
            }
            
            hook_result = loop.run_until_complete(hook_manager.run_hooks('afterLLMCall', llm_result, ctx))
            
            if hook_result and isinstance(hook_result, dict):
                ai_content = hook_result.get('content', llm_result['content'])
                usage = hook_result.get('usage', llm_result['usage'])
                finish_reason = hook_result.get('finish_reason', llm_result['finish_reason'])
                model_used = hook_result.get('model_used', llm_result['model_used'])
                postprocess_items = hook_result.get('postprocess_items') if isinstance(hook_result.get('postprocess_items'), dict) else None
            else:
                ai_content = llm_result['content']
                usage = llm_result['usage']
                finish_reason = llm_result['finish_reason']
                model_used = llm_result['model_used']
                postprocess_items = None
        else:
            # === 流式路径：边收块边下发，同时在服务端聚合，结束后执行完整 Hook 与保存 ===
            try:
                from fastapi.responses import StreamingResponse  # 延迟导入
            except Exception as e:
                return {
                    "success": False,
                    "error": f"SSE 不可用（依赖 fastapi 未就绪）: {str(e)}",
                    "response_time": time.time() - start_time
                }

            # 使用底层 iterator 获取分片
            from api.modules.llm_api.impl import stream_chat_chunks, StreamChunk  # type: ignore

            # 生成器：对每个分片调用分片 Hook，并逐步累加；结束后执行完整 Hook 与保存
            import json as _json

            def _sse_line(obj: Dict[str, Any]) -> str:
                return "data: " + _json.dumps(obj, ensure_ascii=False) + "\n\n"

            # 提前测试：尝试获取第一个 chunk，如果是错误则直接抛出异常
            # 这样可以在进入 StreamingResponse 前就返回 HTTP 错误
            chunk_iter = stream_chat_chunks(
                provider=llm_params.get("provider"),
                api_key=llm_params.get("api_key"),
                base_url=llm_params.get("base_url"),
                messages=messages,
                model=llm_params.get("model"),
                max_tokens=llm_params.get("max_tokens"),
                temperature=llm_params.get("temperature"),
                top_p=llm_params.get("top_p"),
                presence_penalty=llm_params.get("presence_penalty"),
                frequency_penalty=llm_params.get("frequency_penalty"),
                custom_params=llm_params.get("custom_params"),
                safety_settings=llm_params.get("safety_settings"),
                timeout=llm_params.get("timeout"),
                connect_timeout=llm_params.get("connect_timeout"),
                enable_logging=llm_params.get("enable_logging", False),
                models=llm_params.get("models"),
            )

            # 将迭代器转换为列表以便检查第一个元素
            chunks_list = []
            first_chunk = None
            try:
                first_chunk = next(chunk_iter)
                # 检查第一个 chunk 是否是错误
                if first_chunk and getattr(first_chunk, 'finish_reason', None) == 'error':
                    # LLM API 调用失败，直接返回错误而不进入流式响应
                    error_content = getattr(first_chunk, 'content', '未知错误')
                    return {
                        "success": False,
                        "error": error_content,
                        "response_time": time.time() - start_time
                    }
                chunks_list.append(first_chunk)
            except StopIteration:
                # 空流
                return {
                    "success": False,
                    "error": "LLM API 未返回任何数据",
                    "response_time": time.time() - start_time
                }
            except Exception as e:
                # 迭代器初始化或第一次next失败
                return {
                    "success": False,
                    "error": str(e),
                    "response_time": time.time() - start_time
                }

            acc_text: str = ""
            _finish_reason: Optional[str] = None
            _usage: Optional[Dict[str, Any]] = None
            _model_used: Optional[str] = llm_params.get("model")

            def _generator():
                nonlocal acc_text, _finish_reason, _usage, _model_used
                try:
                    # 先处理第一个chunk（已经获取）
                    for ch in chunks_list:
                        # 检查是否是错误chunk（虽然前面已经检查过，但保险起见）
                        if getattr(ch, 'finish_reason', None) == 'error':
                            error_msg = getattr(ch, 'content', '未知错误')
                            yield _sse_line({"type": "error", "message": error_msg})
                            yield _sse_line({"type": "end"})
                            return
                        
                        # 处理文本块
                        if getattr(ch, 'content', None):
                            chunk_data = {'content': ch.content}
                            try:
                                # beforeStreamChunk（允许改写分片）
                                b_res = loop.run_until_complete(hook_manager.run_hooks('beforeStreamChunk', chunk_data, ctx))
                                if isinstance(b_res, dict) and 'content' in b_res:
                                    chunk_data['content'] = b_res['content']
                            except Exception:
                                pass

                            # 下发分片
                            yield _sse_line({"type": "chunk", "content": chunk_data['content']})

                            # afterStreamChunk（副作用）
                            try:
                                loop.run_until_complete(hook_manager.run_hooks('afterStreamChunk', chunk_data, ctx))
                            except Exception:
                                pass

                            # 聚合
                            acc_text += str(chunk_data['content'])

                        # 完成原因
                        if getattr(ch, 'finish_reason', None):
                            _finish_reason = ch.finish_reason
                            yield _sse_line({"type": "finish", "finish_reason": _finish_reason})

                        # 使用统计
                        if getattr(ch, 'usage', None):
                            _usage = ch.usage
                            yield _sse_line({"type": "usage", "usage": _usage})

                    # 流结束：执行完整 Hook、保存并结束
                    llm_result2 = {
                        'content': acc_text,
                        'usage': _usage,
                        'finish_reason': _finish_reason,
                        'model_used': _model_used,
                    }

                    try:
                        h_res = loop.run_until_complete(hook_manager.run_hooks('afterLLMCall', llm_result2, ctx))
                    except Exception:
                        h_res = llm_result2

                    if isinstance(h_res, dict):
                        final_content = h_res.get('content', llm_result2['content'])
                        final_usage = h_res.get('usage', llm_result2['usage'])
                        final_finish = h_res.get('finish_reason', llm_result2['finish_reason'])
                        final_model = h_res.get('model_used', llm_result2['model_used'])
                        # 推送后处理项（若存在）
                        try:
                            _pp = h_res.get('postprocess_items')
                            if isinstance(_pp, dict) and _pp:
                                yield _sse_line({"type": "postprocess", "items": _pp})
                        except Exception:
                            pass
                    else:
                        final_content = llm_result2['content']
                        final_usage = llm_result2['usage']
                        final_finish = llm_result2['finish_reason']
                        final_model = llm_result2['model_used']

                    # 保存（复用非流式路径逻辑）
                    try:
                        if target_node_id:
                            # 直接写入指定节点（并发/切分支安全），先做 beforeSaveResponse 清理
                            content_to_save2 = final_content
                            try:
                                bsr = loop.run_until_complete(hook_manager.run_hooks('beforeSaveResponse', {
                                    'node_id': target_node_id,
                                    'content': final_content,
                                    'parent_id': None,
                                    'is_update': True,
                                }, ctx))
                                if isinstance(bsr, dict) and isinstance(bsr.get('content'), str):
                                    content_to_save2 = bsr['content']
                            except Exception:
                                pass
                            core.call_api(
                                "smarttavern/chat_branches/update_message",
                                {
                                    "file": conversation_file,
                                    "node_id": target_node_id,
                                    "content": content_to_save2
                                },
                                method="POST",
                                namespace="modules"
                            )
                            saved_node_id = target_node_id
                        else:
                            # 兼容：按当前 active_path 保存
                            active_path: List[str] = []
                            try:
                                conv_detail2 = core.call_api(
                                    "smarttavern/data_catalog/get_conversation_detail",
                                    {"file": conversation_file},
                                    method="POST",
                                    namespace="modules",
                                )
                                active_path = ((conv_detail2 or {}).get("content", {}) or {}).get("active_path", []) or []
                            except Exception:
                                active_path = []
                            if not active_path:
                                yield _sse_line({"type": "error", "message": "未找到 active_path"})
                                yield _sse_line({"type": "end"})
                                return
                            parent_id = active_path[-1]
                            last_node_id = active_path[-1]
                            try:
                                conv_detail3 = core.call_api(
                                    "smarttavern/data_catalog/get_conversation_detail",
                                    {"file": conversation_file},
                                    method="POST",
                                    namespace="modules",
                                )
                                conv_doc = (conv_detail3 or {}).get("content", {}) or {}
                            except Exception:
                                conv_doc = {}
                            nodes = conv_doc.get("nodes", {})
                            last_node = nodes.get(last_node_id, {})
                            is_empty_assistant = (
                                last_node.get("role") == "assistant" and
                                str(last_node.get("content", "")).strip() == ""
                            )
                            if is_empty_assistant:
                                core.call_api(
                                    "smarttavern/chat_branches/update_message",
                                    {
                                        "file": conversation_file,
                                        "node_id": last_node_id,
                                        "content": final_content
                                    },
                                    method="POST",
                                    namespace="modules"
                                )
                                saved_node_id = last_node_id
                            else:
                                new_node_id = f"n_ass{int(time.time() * 1000)}"
                                core.call_api(
                                    "smarttavern/chat_branches/append_message",
                                    {
                                        "file": conversation_file,
                                        "node_id": new_node_id,
                                        "pid": parent_id,
                                        "role": "assistant",
                                        "content": final_content
                                    },
                                    method="POST",
                                    namespace="modules"
                                )
                                saved_node_id = new_node_id

                        try:
                            loop.run_until_complete(hook_manager.run_hooks('afterSaveResponse', {
                                'node_id': saved_node_id if 'saved_node_id' in locals() else None,
                                'doc': None,
                                'usage': final_usage,
                                'content': final_content
                            }, ctx))
                        except Exception:
                            pass
                    except Exception as _e:
                        # 保存阶段错误仅上报，不中断 SSE 收尾
                        yield _sse_line({"type": "error", "message": str(_e)})

                    # 结束事件
                    yield _sse_line({"type": "end"})
                except Exception as e:
                    yield _sse_line({"type": "error", "message": str(e)})
                    yield _sse_line({"type": "end"})

            return StreamingResponse(
                _generator(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )
        
        # === 获取 active_path 用于保存（优先从 openai_messages.path 回退到 conversation.json）===
        active_path: List[str] = []
        try:
            messages_result = core.call_api(
                "smarttavern/chat_branches/openai_messages",
                {"file": conversation_file},
                method="POST",
                namespace="modules",
            )
            if isinstance(messages_result, dict):
                active_path = messages_result.get("path", []) or []
        except Exception:
            active_path = []
        if not active_path:
            try:
                conv_detail2 = core.call_api(
                    "smarttavern/data_catalog/get_conversation_detail",
                    {"file": conversation_file},
                    method="POST",
                    namespace="modules",
                )
                active_path = ((conv_detail2 or {}).get("content", {}) or {}).get("active_path", []) or []
            except Exception:
                active_path = []
        
        if not active_path:
            return {
                "success": False,
                "error": "未找到 active_path",
                "response_time": time.time() - start_time
            }
        
        parent_id = active_path[-1]
        last_node_id = active_path[-1]
        
        # 获取节点信息判断是否需要更新现有节点
        try:
            conv_detail3 = core.call_api(
                "smarttavern/data_catalog/get_conversation_detail",
                {"file": conversation_file},
                method="POST",
                namespace="modules",
            )
            conv_doc = (conv_detail3 or {}).get("content", {}) or {}
        except Exception:
            conv_doc = {}
        
        nodes = conv_doc.get("nodes", {})
        last_node = nodes.get(last_node_id, {})
        
        is_empty_assistant = (
            last_node.get("role") == "assistant" and
            last_node.get("content", "").strip() == ""
        )
        
        # === 步骤15：beforeSaveResponse Hook ===
        save_data = {
            'node_id': last_node_id if is_empty_assistant else f"n_ass{int(time.time() * 1000)}",
            'content': ai_content,
            'parent_id': parent_id,
            'is_update': is_empty_assistant
        }
        
        hook_save_data = loop.run_until_complete(hook_manager.run_hooks('beforeSaveResponse', save_data, ctx))
        
        if hook_save_data and isinstance(hook_save_data, dict):
            save_data = {**save_data, **hook_save_data}
        
        # === 步骤16：保存响应（通过 chat_branches API）===
        if target_node_id:
            # 明确指定节点：先经 beforeSaveResponse 处理，再直接更新该节点（并发/切分支安全）
            content_to_save = ai_content
            try:
                bs_res = loop.run_until_complete(hook_manager.run_hooks('beforeSaveResponse', {
                    'node_id': target_node_id,
                    'content': ai_content,
                    'parent_id': None,
                    'is_update': True,
                }, ctx))
                if isinstance(bs_res, dict) and isinstance(bs_res.get('content'), str):
                    content_to_save = bs_res['content']
            except Exception:
                pass

            update_result = core.call_api(
                "smarttavern/chat_branches/update_message",
                {
                    "file": conversation_file,
                    "node_id": target_node_id,
                    "content": content_to_save,
                },
                method="POST",
                namespace="modules"
            )
            result = {
                "success": True,
                "node_id": target_node_id,
                "content": content_to_save,
                "usage": usage,
                "response_time": time.time() - start_time,
                "model_used": model_used,
                "finish_reason": finish_reason,
                "doc": update_result
            }
            if postprocess_items:
                result["postprocess_items"] = postprocess_items
        elif save_data['is_update']:
            # 更新现有节点
            update_result = core.call_api(
                "smarttavern/chat_branches/update_message",
                {
                    "file": conversation_file,
                    "node_id": save_data['node_id'],
                    "content": save_data['content']
                },
                method="POST",
                namespace="modules"
            )
            
            result = {
                "success": True,
                "node_id": save_data['node_id'],
                "content": save_data['content'],
                "usage": usage,
                "response_time": time.time() - start_time,
                "model_used": model_used,
                "finish_reason": finish_reason,
                "doc": update_result
            }
            if postprocess_items:
                result["postprocess_items"] = postprocess_items
        else:
            # 创建新节点
            new_node_id = save_data['node_id']
            
            append_result = core.call_api(
                "smarttavern/chat_branches/append_message",
                {
                    "file": conversation_file,
                    "node_id": new_node_id,
                    "pid": save_data['parent_id'],
                    "role": "assistant",
                    "content": save_data['content']
                },
                method="POST",
                namespace="modules"
            )
            
            result = {
                "success": True,
                "node_id": new_node_id,
                "content": save_data['content'],
                "usage": usage,
                "response_time": time.time() - start_time,
                "model_used": model_used,
                "finish_reason": finish_reason,
                "doc": append_result
            }
            if postprocess_items:
                result["postprocess_items"] = postprocess_items
        
        # === 步骤17：afterSaveResponse Hook ===
        loop.run_until_complete(hook_manager.run_hooks('afterSaveResponse', {
            'node_id': result['node_id'],
            'doc': result.get('doc'),
            'usage': usage,
            'content': result['content']
        }, ctx))
        
        return result
    
    except Exception as e:
        logger.error(f"带Hook的AI调用失败: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "response_time": time.time() - start_time
        }