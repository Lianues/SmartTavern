# -*- coding: utf-8 -*-
"""
SmartTavern.data_import 包初始化

作用
- 标记 data_import 目录为包，确保实现与注册脚本可被项目扫描器正确导入
- 便于从包级导入触发 API 注册（见 data_import.py）

用法
- 仅导入包即可触发注册：
    import api.modules.SmartTavern.data_import  # noqa
"""

# 注册入口：导入以触发 @core.register_api 装饰器
from .data_import import import_data, export_data, get_supported_types, check_name_exists  # noqa: F401