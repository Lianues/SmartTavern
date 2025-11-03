# -*- coding: utf-8 -*-
"""
SmartTavern.data_catalog 包初始化

作用
- 标记 data_catalog 目录为包，确保实现与注册脚本可被项目扫描器正确导入
- 便于从包级导入触发 API 注册（见 data_catalog.py）

用法
- 仅导入包即可触发注册：
    import api.modules.SmartTavern.data_catalog  # noqa
"""

# 注册入口：导入以触发 @core.register_api 装饰器
from .data_catalog import list_presets  # noqa: F401