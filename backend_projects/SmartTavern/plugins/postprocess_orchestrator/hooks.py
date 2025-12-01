# -*- coding: utf-8 -*-
"""
Postprocess Orchestrator 插件

功能：
- 提供注册接口：其他插件可注册 stid → 多个 op（每个 op 绑定 data_schema 与 settings）
- beforeLLMCall：
  - 注入统一约束提示，让 AI 在答案末尾仅在需要时追加一个 <postprocess>{...}</postprocess>
  - 对即将发送到 LLM 的历史消息进行“可见性隐藏”：按每个 op.settings.visible_to_ai 过滤当前消息副本
- afterLLMCall：
  - 解析 <postprocess>，合并重复 stid，保持 ops 顺序；按 data_schema 校验并规范化
- beforeSaveResponse：
  - 按每个 op.settings.once 对本轮响应内的 <postprocess> 做一次性清理，并进行级联删除（空 stid/空块）

说明：
- 本插件不改变历史消息，仅在发送副本上进行“可见性隐藏”
- data_schema 仅实现轻量校验（JSON Schema 子集）
"""

from __future__ import annotations
import re
import json
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Tuple

import core


# 统一从 API 获取注册信息（避免 import 依赖）


def _get_units_full() -> List[Dict[str, Any]]:
    try:
        res = core.call_api(
            "smarttavern/postprocess/list_units_full",
            {},
            method="GET",
            namespace="plugins",
        ) or {}
        return res.get('units') or []
    except Exception:
        return []


# =====================
# JSON Schema 轻量校验（子集）
# =====================

def _is_type(value: Any, t: str) -> bool:
    if t == 'string':
        return isinstance(value, str)
    if t == 'number':
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if t == 'boolean':
        return isinstance(value, bool)
    if t == 'object':
        return isinstance(value, dict)
    if t == 'array':
        return isinstance(value, list)
    if t == 'null':
        return value is None
    return True  # 未知类型宽松通过


def _validate_schema(data: Any, schema: Dict[str, Any]) -> bool:
    # 仅支持基本字段：type, required, properties, additionalProperties, items
    if not isinstance(schema, dict):
        return True

    s_type = schema.get('type')
    if s_type is not None:
        if isinstance(s_type, list):
            if not any(_is_type(data, t) for t in s_type):
                return False
        elif isinstance(s_type, str):
            if not _is_type(data, s_type):
                return False

    if isinstance(data, dict):
        required = schema.get('required') or []
        if isinstance(required, list):
            for k in required:
                if k not in data:
                    return False

        props = schema.get('properties') or {}
        if isinstance(props, dict):
            for k, sub_schema in props.items():
                if k in data:
                    if not _validate_schema(data[k], sub_schema):
                        return False

        addl = schema.get('additionalProperties', True)
        if addl is False and isinstance(props, dict):
            for k in data.keys():
                if k not in props:
                    return False

    if isinstance(data, list) and 'items' in schema:
        item_schema = schema.get('items')
        if isinstance(item_schema, dict):
            for v in data:
                if not _validate_schema(v, item_schema):
                    return False

    return True


# =====================
# <postprocess> 解析与规范化
# =====================

# 仅匹配严格的 JSON 块：要求 <postprocess> 后紧跟可选空白与 '{'
# 避免误把正文里提及的 “`<postprocess>`” 当作起始标签，从而跨越到后面的真正闭合标签导致大段截断
_POSTPROCESS_RE = re.compile(r"<postprocess>\s*({[\s\S]*?})\s*</postprocess>", re.IGNORECASE)


def _merge_stid_ops_preserve_order(inner_json_text: str) -> Tuple[OrderedDict, bool]:
    """解析 JSON 字符串，合并重复 stid，保持出现顺序。
    返回 (OrderedDict{stid: list[ops]}, success)
    """
    # 尝试基于扫描的方式抽取顶层 key: array 片段（允许重复）
    text = inner_json_text.strip()
    merged: OrderedDict[str, List[Any]] = OrderedDict()
    try:
        # 简易状态机：解析 { "key": [ ... ], "key2": [ ... ] }
        i = 0
        n = len(text)
        # 跳过前导空白与可选的大括号
        while i < n and text[i].isspace():
            i += 1
        if i < n and text[i] == '{':
            i += 1
        while i < n:
            # 跳空白或逗号
            while i < n and (text[i].isspace() or text[i] in ','):
                i += 1
            if i >= n:
                break
            if text[i] == '}':
                i += 1
                break
            # 读取 key 字符串
            if text[i] != '"':
                # 非严格格式，放弃扫描
                raise ValueError('expect key string')
            i += 1
            key_chars = []
            while i < n:
                ch = text[i]
                if ch == '\\':
                    if i + 1 < n:
                        key_chars.append(text[i:i+2])
                        i += 2
                        continue
                if ch == '"':
                    i += 1
                    break
                key_chars.append(ch)
                i += 1
            key = ''.join(key_chars)
            # 跳过空白与冒号
            while i < n and text[i].isspace():
                i += 1
            if i < n and text[i] == ':':
                i += 1
            while i < n and text[i].isspace():
                i += 1
            # 期望数组
            if i >= n or text[i] != '[':
                raise ValueError('expect array')
            # 捕获匹配的数组片段（支持嵌套括号）
            start_arr = i
            depth = 0
            while i < n:
                ch = text[i]
                if ch == '"':
                    # 跳过字符串
                    i += 1
                    while i < n:
                        ch2 = text[i]
                        if ch2 == '\\':
                            i += 2
                            continue
                        if ch2 == '"':
                            i += 1
                            break
                        i += 1
                    continue
                if ch == '[':
                    depth += 1
                elif ch == ']':
                    depth -= 1
                    if depth == 0:
                        i += 1
                        break
                i += 1
            arr_text = text[start_arr:i]
            # 解析该数组 JSON
            arr = json.loads(arr_text)
            if not isinstance(arr, list):
                arr = []
            if key not in merged:
                merged[key] = []
            merged[key].extend(arr)
            # 跳过到下一个逗号或右花括号
            while i < n and text[i].isspace():
                i += 1
            if i < n and text[i] == ',':
                i += 1
                continue
            if i < n and text[i] == '}':
                i += 1
                break
        return merged, True
    except Exception:
        # 回退：常规解析（会丢失重复 key；但仍可用）
        try:
            obj = json.loads(text)
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if isinstance(v, list):
                        merged[k] = list(v)
            return merged, True
        except Exception:
            return OrderedDict(), False


def _serialize_postprocess_body(merged: OrderedDict) -> str:
    # 使用插入顺序序列化（Python3.7+ 字典保持插入顺序）
    body = {k: v for k, v in merged.items() if isinstance(v, list) and len(v) > 0}
    return json.dumps(body, ensure_ascii=False, separators=(",", ":"))


def _extract_postprocess_blocks(text: str) -> List[Tuple[int, int, str]]:
    out: List[Tuple[int, int, str]] = []
    if not isinstance(text, str) or not text:
        return out
    for m in _POSTPROCESS_RE.finditer(text):
        out.append((m.start(), m.end(), m.group(1)))
    return out


def _remove_postprocess_from_text(text: str) -> Tuple[str, List[str]]:
    if not isinstance(text, str) or not text:
        return text, []
    removed: List[str] = []
    def _repl(m: re.Match) -> str:
        inner = m.group(1)
        removed.append(inner)
        return ''
    new_text = _POSTPROCESS_RE.sub(_repl, text)
    return new_text, removed


def _remove_postprocess_in_messages(messages: List[Dict[str, Any]], stash_key: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for m in messages or []:
        if not isinstance(m, dict):
            out.append(m)
            continue
        content = m.get('content')
        if not isinstance(content, str) or '<postprocess>' not in content:
            out.append(m)
            continue
        new_content, removed_blocks = _remove_postprocess_from_text(content)
        if removed_blocks:
            mm = dict(m)
            mm['content'] = new_content
            # 累加同一条消息（避免覆盖其他阶段存根）
            prev = list(mm.get(stash_key) or [])
            mm[stash_key] = prev + removed_blocks
            out.append(mm)
        else:
            out.append(m)
    return out


def _restore_postprocess_in_messages(messages: List[Dict[str, Any]], stash_key: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for m in messages or []:
        if not isinstance(m, dict):
            out.append(m)
            continue
        blocks = m.get(stash_key)
        if not blocks:
            # 清理潜在空字段
            if stash_key in m:
                mm = dict(m)
                mm.pop(stash_key, None)
                out.append(mm)
            else:
                out.append(m)
            continue
        content = m.get('content') or ''
        if not isinstance(content, str):
            content = str(content)
        # 追加恢复（保持顺序）
        restored = content
        for inner in blocks:
            restored += '<postprocess>' + str(inner) + '</postprocess>'
        mm = dict(m)
        mm['content'] = restored
        mm.pop(stash_key, None)
        out.append(mm)
    return out


def _filter_invisible_for_messages(messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    # 仅对发送副本做过滤（不修改历史持久化）
    if not isinstance(messages, list):
        return messages
    new_messages: List[Dict[str, Any]] = []
    for m in messages:
        if not isinstance(m, dict):
            new_messages.append(m)
            continue
        content = m.get('content')
        if not isinstance(content, str) or '<postprocess>' not in content:
            new_messages.append(m)
            continue
        blocks = _extract_postprocess_blocks(content)
        if not blocks:
            new_messages.append(m)
            continue
        # 只处理第一个块（规范要求仅一个）
        s, e, inner = blocks[0]
        merged, ok = _merge_stid_ops_preserve_order(inner)
        if not ok or not merged:
            new_messages.append(m)
            continue
        # 逐 stid/op 按 settings.visible_to_ai 过滤
        changed = False
        filtered: OrderedDict[str, List[Any]] = OrderedDict()
        units = _get_units_full()
        units_map = {u.get('stid'): u for u in units}
        for stid, ops in merged.items():
            spec = units_map.get(stid) or {}
            op_defs = {od.get('op'): od for od in (spec.get('ops') or [])}
            kept_ops: List[Any] = []
            for op_item in ops:
                if not isinstance(op_item, dict):
                    continue
                op_name = str(op_item.get('op') or '')
                defn = op_defs.get(op_name)
                if defn is None:
                    # 未注册的 op 仍保留给 AI 可见，避免影响 AI 的自身逻辑
                    kept_ops.append(op_item)
                    continue
                settings = defn.get('settings') or {}
                visible = bool(settings.get('visible_to_ai', True))
                if visible:
                    kept_ops.append(op_item)
                else:
                    changed = True
            if kept_ops:
                filtered[stid] = kept_ops
        # 级联清理：若空则移除整个块
        new_content = content
        if changed:
            if filtered:
                body = _serialize_postprocess_body(filtered)
                new_content = content[:s] + '<postprocess>' + body + '</postprocess>' + content[e:]
            else:
                # 删除整个 <postprocess> 块
                new_content = content[:s] + content[e:]
        new_m = dict(m)
        new_m['content'] = new_content
        new_messages.append(new_m)
    return new_messages


def _build_instruction_message() -> str:
    # 生成给 AI 的统一约束提示：仅包含 stid、description、ops/op.data_schema
    try:
        res = core.call_api(
            "smarttavern/postprocess/list_units",
            {},
            method="GET",
            namespace="plugins",
        ) or {}
        units = res.get('units') or []
    except Exception:
        units = []

    guidance = (
        "请遵循以下严格规范：\n"
        "- 当且仅当存在可结构化返回的内容时，才在答案最后追加且仅追加一次 `<postprocess>{JSON}</postprocess>`。\n"
        "- JSON 顶层以 stid 为键，值为该 stid 的 ops 数组；每个元素为 {\"op\": \"<op_name>\", \"data\": {…}}。\n"
        "- 同一 stid 的所有 op 必须聚合到同一数组中；仅使用下方列出的 stid/op，并严格满足对应 data_schema。\n"
        "- 严格 JSON：不得使用代码块、注释或任何额外字符。无条目则不要输出 `<postprocess>` 块。\n\n"
        "允许的条目与数据要求（不包含任何设置字段）：\n"
        + json.dumps(units, ensure_ascii=False, separators=(",", ":"))
    )
    return guidance


# =====================
# Hook 实现
# =====================

async def _before_llm_call(data: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    messages = data.get('messages') or []
    if not isinstance(messages, list):
        messages = []

    # 1) 可见性过滤（仅影响发送副本）
    filtered_messages = _filter_invisible_for_messages(messages)

    # 2) 注入统一约束提示（system）
    inject_text = _build_instruction_message()
    if inject_text:
        filtered_messages = list(filtered_messages) + [{
            'role': 'system',
            'content': inject_text,
        }]

    return {
        'messages': filtered_messages,
        'llm_params': data.get('llm_params') or {}
    }


def _validate_and_normalize_ops(merged: OrderedDict) -> OrderedDict:
    out: OrderedDict[str, List[Dict[str, Any]]] = OrderedDict()
    units = _get_units_full()
    units_map = {u.get('stid'): u for u in units}
    for stid, ops in merged.items():
        spec = units_map.get(stid)
        if not spec:
            continue
        op_defs = {od.get('op'): od for od in (spec.get('ops') or [])}
        norm_ops: List[Dict[str, Any]] = []
        for item in ops:
            if not isinstance(item, dict):
                continue
            op_name = str(item.get('op') or '')
            data = item.get('data')
            defn = op_defs.get(op_name)
            if not defn:
                continue
            schema = (defn.get('data_schema') or {})
            if not _validate_schema(data, schema):
                continue
            norm_ops.append({'op': op_name, 'data': data})
        if norm_ops:
            out[stid] = norm_ops
    return out


async def _after_llm_call(data: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    content = data.get('content') or ''
    if not isinstance(content, str) or '<postprocess>' not in content:
        return data

    blocks = _extract_postprocess_blocks(content)
    if not blocks:
        return data

    s, e, inner = blocks[0]
    merged, ok = _merge_stid_ops_preserve_order(inner)
    if not ok or not merged:
        return data

    # 按 schema 校验与规范化
    normalized = _validate_and_normalize_ops(merged)
    if not normalized:
        # 无合法条目，删除整个块
        new_content = content[:s] + content[e:]
        new_d = dict(data)
        new_d['content'] = new_content
        return new_d

    body = _serialize_postprocess_body(normalized)
    new_content = content[:s] + '<postprocess>' + body + '</postprocess>' + content[e:]
    new_d = dict(data)
    new_d['content'] = new_content
    # 向上游暴露标准化后的结构（供后端推送 postprocess 事件）
    try:
        if isinstance(normalized, dict) and normalized:
            new_d['postprocess_items'] = normalized  # 顶层 stid -> [{op,data}]
    except Exception:
        pass
    return new_d


async def _before_save_response(data: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    # 一次性清理：保存前剔除 settings.once 的 op；并级联删除空 stid/空块
    content = data.get('content') or ''
    if not isinstance(content, str) or '<postprocess>' not in content:
        return data
    blocks = _extract_postprocess_blocks(content)
    if not blocks:
        return data
    s, e, inner = blocks[0]
    merged, ok = _merge_stid_ops_preserve_order(inner)
    if not ok or not merged:
        return data

    # 过滤 once 的 op
    kept: OrderedDict[str, List[Dict[str, Any]]] = OrderedDict()
    changed = False
    units = _get_units_full()
    units_map = {u.get('stid'): u for u in units}
    for stid, ops in merged.items():
        spec = units_map.get(stid) or {}
        op_defs = {od.get('op'): od for od in (spec.get('ops') or [])}
        kept_ops: List[Dict[str, Any]] = []
        for item in ops:
            if not isinstance(item, dict):
                continue
            op_name = str(item.get('op') or '')
            defn = op_defs.get(op_name)
            if not defn:
                # 未注册的 op 原样保留
                kept_ops.append(item)
                continue
            settings = defn.get('settings') or {}
            if bool(settings.get('once', False)):
                changed = True
                continue
            kept_ops.append(item)
        if kept_ops:
            kept[stid] = kept_ops
        else:
            changed = True

    new_content = content
    if changed:
        if kept:
            body = _serialize_postprocess_body(kept)
            new_content = content[:s] + '<postprocess>' + body + '</postprocess>' + content[e:]
        else:
            new_content = content[:s] + content[e:]

    out = dict(data)
    out['content'] = new_content
    return out


# =====================
# 保护阶段：剔除/归还 <postprocess>
# =====================

async def _before_raw(messages: List[Dict[str, Any]], ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    return _remove_postprocess_in_messages(messages, '__pp_stash_raw')


async def _after_raw(messages: List[Dict[str, Any]], ctx: Dict[str, Any]) -> List[Dict[str, Any]]:
    return _restore_postprocess_in_messages(messages, '__pp_stash_raw')


async def _before_post_user(data: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    messages = data.get('messages') or []
    return {
        'messages': _remove_postprocess_in_messages(messages, '__pp_stash_user'),
        'rules': data.get('rules'),
        'variables': data.get('variables')
    }


async def _after_post_user(data: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    messages = data.get('messages') or []
    return {
        'messages': _restore_postprocess_in_messages(messages, '__pp_stash_user'),
        'rules': data.get('rules'),
        'variables': data.get('variables')
    }


async def _before_post_assistant(data: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    messages = data.get('messages') or []
    return {
        'messages': _remove_postprocess_in_messages(messages, '__pp_stash_assist'),
        'rules': data.get('rules'),
        'variables': data.get('variables')
    }


async def _after_post_assistant(data: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    messages = data.get('messages') or []
    return {
        'messages': _restore_postprocess_in_messages(messages, '__pp_stash_assist'),
        'rules': data.get('rules'),
        'variables': data.get('variables')
    }


# =====================
# 插件挂载
# =====================

def register_hooks(hook_manager):
    strategy_id = 'postprocess_orchestrator'
    hook_manager.register_strategy(
        strategy_id,
        {
            'beforeRaw': _before_raw,
            'afterRaw': _after_raw,
            'beforePostprocessUser': _before_post_user,
            'afterPostprocessUser': _after_post_user,
            'beforePostprocessAssistant': _before_post_assistant,
            'afterPostprocessAssistant': _after_post_assistant,
            'beforeLLMCall': _before_llm_call,
            'afterLLMCall': _after_llm_call,
            'beforeSaveResponse': _before_save_response,
        },
        order=100
    )
    return strategy_id


# 可选：卸载接口
def unregister_hooks(hook_manager):
    try:
        hook_manager.unregister_strategy('postprocess_orchestrator')
    except Exception:
        pass


# 移除本插件内的 API（已迁移到 api/workflow/.../postprocess_registry）

