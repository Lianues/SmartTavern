# -*- coding: utf-8 -*-
"""
SmartTavern 后端插件系统

提供：
- Hook 管理器（hook_manager.py）
- 插件加载器（plugin_loader.py）
- 热重载支持

使用方式：
    from api.plugins.SmartTavern import initialize_plugins, get_hook_manager
    
    # 初始化并加载所有插件
    initialize_plugins()
    
    # 获取 Hook 管理器
    hook_manager = get_hook_manager()
    
    # 执行 Hook
    result = await hook_manager.run_hooks('beforeRaw', data, ctx)
"""

from .hook_manager import (
    HookManager,
    get_hook_manager,
    reset_hook_manager,
)

from .plugin_loader import (
    PluginLoader,
    PluginInfo,
    get_plugin_loader,
    initialize_plugins,
    reset_plugin_loader,
)

__all__ = [
    # Hook 管理器
    'HookManager',
    'get_hook_manager',
    'reset_hook_manager',
    
    # 插件加载器
    'PluginLoader',
    'PluginInfo',
    'get_plugin_loader',
    'initialize_plugins',
    'reset_plugin_loader',
]