# -*- coding: utf-8 -*-
"""
SmartTavern 主题/外观 API 模块
提供主题文件的管理、读取和服务接口
"""

from .styles import (
    list_themes,
    get_styles_switch,
    update_styles_switch,
    get_theme_detail,
    get_theme_entries,
    get_theme_asset,
    delete_theme,
)

__all__ = [
    "list_themes",
    "get_styles_switch",
    "update_styles_switch",
    "get_theme_detail",
    "get_theme_entries",
    "get_theme_asset",
    "delete_theme",
]