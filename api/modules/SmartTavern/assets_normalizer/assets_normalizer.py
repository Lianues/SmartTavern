# -*- coding: utf-8 -*-
"""
API 封装层：SmartTavern.assets_normalizer
- 提供 6 个 API：
  1) normalize（总入口）
  2) extract_preset_regex
  3) extract_character_world_book
  4) extract_character_regex
  5) merge_world_books
  6) merge_regex
"""

from typing import Any, Dict
import core
from .impl import (
    normalize_impl as _normalize_impl,
    extract_preset_regex_impl as _extract_preset_regex_impl,
    extract_character_world_book_impl as _extract_character_world_book_impl,
    extract_character_regex_impl as _extract_character_regex_impl,
    merge_world_books_impl as _merge_world_books_impl,
    merge_regex_impl as _merge_regex_impl,
)


# ========== 1) normalize ==========

@core.register_api(
    path="smarttavern/assets_normalizer/normalize",
    name="资产标准化（合并世界书与正则，提取预设/角色卡内嵌条目）",
    description="输入：preset(完整)、world_books(可为数组/对象)、character(完整)、regex_files(多个正则组成的大JSON)。输出：单一world_book数组、合并正则JSON、原样preset/character与统计。",
    input_schema={
        "type": "object",
        "properties": {
            "preset": {"type": "object", "additionalProperties": True},
            "world_books": {"type": "object"},
            "character": {"type": "object", "additionalProperties": True},
            "regex_files": {"type": ["array", "object"]}
        },
        "required": ["preset", "world_books", "character", "regex_files"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "preset": {"type": "object", "additionalProperties": True},
            "world_book": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
            "character": {"type": "object", "additionalProperties": True},
            "merged_regex": {
                "type": "object",
                "properties": {
                    "regex_rules": {"type": "array", "items": {"type": "object", "additionalProperties": True}}
                },
                "required": ["regex_rules"]
            },
            "meta": {"type": "object", "additionalProperties": True}
        },
        "required": ["preset", "world_book", "character", "merged_regex"]
    },
)
def normalize(
    preset: Dict[str, Any],
    world_books: Any,
    character: Dict[str, Any],
    regex_files: Any,
) -> Dict[str, Any]:
    # 内部自动选择合并策略，无需外部 options
    return _normalize_impl(
        preset=preset,
        world_books=world_books,
        character=character,
        regex_files=regex_files,
        options=None,
    )


# ========== 2) extract_preset_regex ==========

@core.register_api(
    path="smarttavern/assets_normalizer/extract_preset_regex",
    name="提取预设正则",
    description="从预设完整JSON中提取 regex_rules 字段并标准化为 {'regex_rules':[...]}，为每条规则注入 meta.source='preset'。",
    input_schema={
        "type": "object",
        "properties": {
            "preset": {"type": "object", "additionalProperties": True}
        },
        "required": ["preset"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "regex_rules": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
            "meta": {"type": "object", "additionalProperties": True}
        },
        "required": ["regex_rules"]
    },
)
def extract_preset_regex(preset: Dict[str, Any]) -> Dict[str, Any]:
    return _extract_preset_regex_impl(preset)


# ========== 3) extract_character_world_book ==========

@core.register_api(
    path="smarttavern/assets_normalizer/extract_character_world_book",
    name="提取角色卡世界书",
    description="从角色卡完整JSON中提取 world_book.entries 数组，输出 {'items':[...]}；每项补充 enabled=True（若缺失）。",
    input_schema={
        "type": "object",
        "properties": {
            "character": {"type": "object", "additionalProperties": True}
        },
        "required": ["character"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "entries": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
            "meta": {"type": "object", "additionalProperties": True}
        },
        "required": ["entries"]
    },
)
def extract_character_world_book(character: Dict[str, Any]) -> Dict[str, Any]:
    return _extract_character_world_book_impl(character)


# ========== 4) extract_character_regex ==========

@core.register_api(
    path="smarttavern/assets_normalizer/extract_character_regex",
    name="提取角色卡正则",
    description="从角色卡完整JSON中提取 regex_rules，标准化为 {'regex_rules':[...]}，为每条规则注入 meta.source='character'。",
    input_schema={
        "type": "object",
        "properties": {
            "character": {"type": "object", "additionalProperties": True}
        },
        "required": ["character"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "regex_rules": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
            "meta": {"type": "object", "additionalProperties": True}
        },
        "required": ["regex_rules"]
    },
)
def extract_character_regex(character: Dict[str, Any]) -> Dict[str, Any]:
    return _extract_character_regex_impl(character)


# ========== 5) merge_world_books ==========

@core.register_api(
    path="smarttavern/assets_normalizer/merge_world_books",
    name="世界书合并",
    description="合并多个世界书与角色卡 world_book 条目。顺序：原世界书在前 → 角色卡条目在后；按 id 去重，不提供覆盖选项。",
    input_schema={
        "type": "object",
        "properties": {
            "world_books": {"type": "object"},
            "character_world_book": {"type": "object"}
        },
        "required": ["world_books"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "world_book": {"type": "array", "items": {"type": "object", "additionalProperties": True}},
            "meta": {"type": "object", "additionalProperties": True}
        },
        "required": ["world_book"]
    },
)
def merge_world_books(
    world_books: Any,
    character_world_book: Any = None,
) -> Dict[str, Any]:
    # 默认不允许覆盖；按 id 去重（无 id 的条目视为各自独立，不参与重复合并）
    return _merge_world_books_impl(
        world_books=world_books,
        character_world_book=character_world_book,
        allow_override=False,
        dedup_key="id",
    )


# ========== 6) merge_regex ==========

@core.register_api(
    path="smarttavern/assets_normalizer/merge_regex",
    name="正则合并（独立→预设→角色卡）",
    description="按顺序合并三类规则；内部自动选择去重与冲突策略（独立优先）。",
    input_schema={
        "type": "object",
        "properties": {
            "independent_regex": {"type": ["array", "object"]},
            "preset_regex": {"type": ["array", "object"]},
            "character_regex": {"type": ["array", "object"]}
        },
        "required": ["independent_regex"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "merged_regex": {
                "type": "object",
                "properties": {
                    "regex_rules": {"type": "array", "items": {"type": "object", "additionalProperties": True}}
                },
                "required": ["regex_rules"]
            },
            "meta": {"type": "object", "additionalProperties": True}
        },
        "required": ["merged_regex"]
    },
)
def merge_regex(
    independent_regex: Any,
    preset_regex: Any = None,
    character_regex: Any = None,
) -> Dict[str, Any]:
    # 内部采用默认策略：dedup_by='auto'，on_conflict='keep_first'
    return _merge_regex_impl(
        independent_regex=independent_regex,
        preset_regex=preset_regex,
        character_regex=character_regex,
        options=None,
    )