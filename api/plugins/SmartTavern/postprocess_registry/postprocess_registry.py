# -*- coding: utf-8 -*-
"""
Postprocess Registry（统一注册中心，插件命名空间）

提供 API：
- smarttavern/postprocess/register_units   （POST）注册多个单元
- smarttavern/postprocess/list_units       （GET） 列出（隐藏 settings）
- smarttavern/postprocess/list_units_full  （GET） 列出完整（含 settings）
- smarttavern/postprocess/clear_units      （POST）清空
"""
from __future__ import annotations
from typing import Any, Dict, List
import core


_REGISTRY: Dict[str, Dict[str, Any]] = {}


def _normalize_unit(spec: Dict[str, Any]) -> Dict[str, Any]:
    stid = str(spec.get('stid') or '').strip()
    if not stid:
        raise ValueError('missing stid')
    description = str(spec.get('description') or '')
    enabled = bool(spec.get('enabled', True))
    priority = int(spec.get('priority', 0))
    ops_list = spec.get('ops') or []
    if not isinstance(ops_list, list) or not ops_list:
        raise ValueError('ops must be non-empty list')
    ops_map: Dict[str, Dict[str, Any]] = {}
    for i, it in enumerate(ops_list):
        if not isinstance(it, dict):
            raise ValueError(f'ops[{i}] must be object')
        op_name = str(it.get('op') or '').strip()
        if not op_name:
            raise ValueError(f'ops[{i}].op required')
        data_schema = it.get('data_schema') or {}
        if not isinstance(data_schema, dict):
            raise ValueError(f'ops[{i}].data_schema must be object')
        settings = it.get('settings') or {}
        if not isinstance(settings, dict):
            raise ValueError(f'ops[{i}].settings must be object')
        once = bool(settings.get('once', False))
        visible_to_ai = bool(settings.get('visible_to_ai', True))
        ops_map[op_name] = {
            'data_schema': data_schema,
            'settings': {
                'once': once,
                'visible_to_ai': visible_to_ai,
            }
        }
    return {
        'stid': stid,
        'description': description,
        'enabled': enabled,
        'priority': priority,
        'ops': ops_map,
    }


@core.register_api(
    path="smarttavern/postprocess/register_units",
    name="注册后处理单元（批量）",
    description="通过 API 注册多个后处理单元（stid/op/data_schema/settings）",
    input_schema={
        "type": "object",
        "properties": {
            "units": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
        },
        "required": ["units"],
        "additionalProperties": False,
    },
    output_schema={
        "type": "object",
        "properties": {
            "success": {"type": "boolean"},
            "registered": {"type": "array", "items": {"type": "string"}},
            "errors": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["success"],
        "additionalProperties": True,
    }
)
def api_register_units(units: Any) -> Dict[str, Any]:
    registered: List[str] = []
    errors: List[str] = []
    try:
        arr = units if isinstance(units, list) else []
        for i, spec in enumerate(arr):
            try:
                norm = _normalize_unit(spec)
                _REGISTRY[norm['stid']] = {
                    'description': norm['description'],
                    'enabled': norm['enabled'],
                    'priority': norm['priority'],
                    'ops': norm['ops'],
                }
                registered.append(norm['stid'])
            except Exception as e:
                errors.append(f"[{i}] {type(e).__name__}: {e}")
        return {"success": True, "registered": registered, "errors": errors}
    except Exception as e:
        return {"success": False, "error": str(e), "registered": registered, "errors": errors}


@core.register_api(
    path="smarttavern/postprocess/list_units",
    name="列出已注册单元（隐藏设置）",
    description="返回当前注册的 stid/ops（不含 settings 字段）",
    input_schema={"type": "object", "properties": {}},
    output_schema={"type": "object", "additionalProperties": True}
)
def api_list_units() -> Dict[str, Any]:
    out: List[Dict[str, Any]] = []
    items = sorted(
        (itm for itm in _REGISTRY.items() if itm[1].get('enabled', True)),
        key=lambda kv: (-int(kv[1].get('priority', 0)), str(kv[0]).lower()),
    )
    for stid, spec in items:
        ops_def = spec.get('ops') or {}
        ops_arr = []
        for op_name, od in ops_def.items():
            ops_arr.append({'op': op_name, 'data_schema': od.get('data_schema') or {}})
        out.append({
            'stid': stid,
            'description': spec.get('description') or '',
            'ops': ops_arr,
            'priority': spec.get('priority', 0),
        })
    return {"success": True, "units": out}


@core.register_api(
    path="smarttavern/postprocess/list_units_full",
    name="列出已注册单元（完整）",
    description="返回当前注册的 stid/ops（包含 settings）",
    input_schema={"type": "object", "properties": {}},
    output_schema={"type": "object", "additionalProperties": True}
)
def api_list_units_full() -> Dict[str, Any]:
    # 按照 list_units 的顺序返回，但包含 settings
    out: List[Dict[str, Any]] = []
    items = sorted(
        (itm for itm in _REGISTRY.items() if itm[1].get('enabled', True)),
        key=lambda kv: (-int(kv[1].get('priority', 0)), str(kv[0]).lower()),
    )
    for stid, spec in items:
        ops_def = spec.get('ops') or {}
        ops_arr = []
        for op_name, od in ops_def.items():
            ops_arr.append({'op': op_name, 'data_schema': od.get('data_schema') or {}, 'settings': od.get('settings') or {}})
        out.append({
            'stid': stid,
            'description': spec.get('description') or '',
            'ops': ops_arr,
            'priority': spec.get('priority', 0),
        })
    return {"success": True, "units": out}


@core.register_api(
    path="smarttavern/postprocess/clear_units",
    name="清空已注册单元",
    description="开发/测试用途：清空当前注册表",
    input_schema={"type": "object", "properties": {}},
    output_schema={"type": "object", "additionalProperties": True}
)
def api_clear_units() -> Dict[str, Any]:
    try:
        _REGISTRY.clear()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


