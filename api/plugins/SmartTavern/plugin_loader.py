# -*- coding: utf-8 -*-
"""
SmartTavern 后端插件加载器

职责：
- 扫描并加载后端插件
- 支持热重载机制
- 自动注册插件的 Hook 到 HookManager
- 监控文件变化（可选）

插件结构要求：
backend_projects/SmartTavern/plugins/<plugin_name>/hooks.py
- 必须导出 register_hooks(hook_manager) 函数
- 在该函数中注册所有 Hook
"""

from __future__ import annotations
import os
import sys
import importlib
import importlib.util
import logging
from pathlib import Path
from typing import Dict, Set, Optional, Any, Callable
from dataclasses import dataclass

from .hook_manager import get_hook_manager, HookManager

logger = logging.getLogger(__name__)


@dataclass
class PluginInfo:
    """插件信息"""
    plugin_id: str
    plugin_path: Path
    module_name: str
    module: Any = None
    loaded: bool = False
    error: Optional[str] = None


class PluginLoader:
    """
    后端插件加载器
    
    特性：
    - 动态扫描插件目录
    - 热重载支持
    - 错误隔离（单个插件失败不影响其他）
    - 与 HookManager 集成
    """
    
    def __init__(
        self,
        plugins_dir: Optional[str] = None,
        hook_manager: Optional[HookManager] = None,
        switch_file: Optional[str] = None
    ):
        """
        初始化插件加载器
        
        参数：
            plugins_dir: 插件目录路径，默认为 backend_projects/SmartTavern/plugins
            hook_manager: Hook 管理器实例，默认使用全局单例
            switch_file: 插件开关文件路径，默认为 plugins_dir/plugins_switch.json
        """
        # 确定插件目录
        if plugins_dir:
            self.plugins_dir = Path(plugins_dir)
        else:
            # 默认路径：backend_projects/SmartTavern/plugins
            current_file = Path(__file__).resolve()
            project_root = current_file.parent.parent.parent.parent
            self.plugins_dir = project_root / "backend_projects" / "SmartTavern" / "plugins"
        
        # 确定开关文件路径
        if switch_file:
            self.switch_file = Path(switch_file)
        else:
            self.switch_file = self.plugins_dir / "plugins_switch.json"
        
        self.hook_manager = hook_manager or get_hook_manager()
        self._loaded_plugins: Dict[str, PluginInfo] = {}
        self._plugin_strategies: Dict[str, Set[str]] = {}  # plugin_id -> set of strategy_ids
        self._enabled_plugins: Set[str] = set()  # 启用的插件列表
        
        # 加载插件开关配置
        self._load_switch_config()
        
        logger.info(f"插件加载器初始化，插件目录: {self.plugins_dir}")
        logger.info(f"启用的插件: {self._enabled_plugins}")
    
    def _load_switch_config(self):
        """加载插件开关配置"""
        if not self.switch_file.exists():
            logger.warning(f"插件开关文件不存在: {self.switch_file}")
            # 默认全部启用
            self._enabled_plugins = set()
            return
        
        try:
            import json
            with open(self.switch_file, 'r', encoding='utf-8') as f:
                switch_config = json.load(f)
            
            enabled = switch_config.get("enabled", [])
            self._enabled_plugins = set(enabled) if isinstance(enabled, list) else set()
            
            logger.info(f"从 {self.switch_file} 加载插件开关配置")
        
        except Exception as e:
            logger.error(f"加载插件开关配置失败: {e}")
            self._enabled_plugins = set()
    
    def scan_and_load_all(self) -> Dict[str, PluginInfo]:
        """
        扫描并加载所有启用的插件
        
        返回：
            插件信息字典 {plugin_id: PluginInfo}
        """
        if not self.plugins_dir.exists():
            logger.warning(f"插件目录不存在: {self.plugins_dir}")
            return {}
        
        logger.info(f"开始扫描插件目录: {self.plugins_dir}")
        
        # 遍历插件目录
        for plugin_path in self.plugins_dir.iterdir():
            if not plugin_path.is_dir():
                continue
            
            # 跳过以 . 或 _ 开头的目录
            if plugin_path.name.startswith('.') or plugin_path.name.startswith('_'):
                continue
            
            # 检查插件是否启用
            if self._enabled_plugins and plugin_path.name not in self._enabled_plugins:
                logger.debug(f"插件 {plugin_path.name} 未启用，跳过")
                continue
            
            # 检查是否有 hooks.py
            hooks_file = plugin_path / "hooks.py"
            if not hooks_file.exists():
                logger.debug(f"插件 {plugin_path.name} 没有 hooks.py，跳过")
                continue
            
            # 加载插件
            self.load_plugin(plugin_path.name)
        
        logger.info(f"插件扫描完成，成功加载 {len(self._loaded_plugins)} 个插件")
        return self._loaded_plugins
    
    def load_plugin(self, plugin_id: str) -> Optional[PluginInfo]:
        """
        加载单个插件
        
        参数：
            plugin_id: 插件 ID（目录名）
        
        返回：
            插件信息，加载失败返回 None
        """
        plugin_path = self.plugins_dir / plugin_id
        hooks_file = plugin_path / "hooks.py"
        
        if not hooks_file.exists():
            logger.error(f"插件 {plugin_id} 的 hooks.py 不存在: {hooks_file}")
            return None
        
        # 如果已加载，先卸载
        if plugin_id in self._loaded_plugins:
            self.unload_plugin(plugin_id)
        
        # 构建模块名
        module_name = f"smarttavern_plugin_{plugin_id}_hooks"
        
        plugin_info = PluginInfo(
            plugin_id=plugin_id,
            plugin_path=plugin_path,
            module_name=module_name
        )
        
        try:
            # 动态导入模块
            spec = importlib.util.spec_from_file_location(module_name, hooks_file)
            if spec is None or spec.loader is None:
                raise ImportError(f"无法创建模块 spec: {hooks_file}")
            
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            spec.loader.exec_module(module)
            
            plugin_info.module = module
            
            # 查找并调用 register_hooks 函数
            if not hasattr(module, 'register_hooks'):
                raise AttributeError(f"插件 {plugin_id} 缺少 register_hooks 函数")
            
            register_func = getattr(module, 'register_hooks')
            if not callable(register_func):
                raise TypeError(f"register_hooks 不是可调用对象")
            
            # 调用注册函数
            result = register_func(self.hook_manager)
            
            # 记录注册的策略 ID（如果返回）
            strategy_ids = set()
            if isinstance(result, list):
                strategy_ids = set(result)
            elif isinstance(result, str):
                strategy_ids = {result}
            elif result is not None:
                logger.warning(f"插件 {plugin_id} 的 register_hooks 返回了意外类型: {type(result)}")
            
            self._plugin_strategies[plugin_id] = strategy_ids
            
            plugin_info.loaded = True
            self._loaded_plugins[plugin_id] = plugin_info
            
            logger.info(f"成功加载插件: {plugin_id}, 注册策略: {strategy_ids or '自动'}")
            return plugin_info
        
        except Exception as e:
            error_msg = f"{type(e).__name__}: {e}"
            plugin_info.error = error_msg
            plugin_info.loaded = False
            self._loaded_plugins[plugin_id] = plugin_info
            
            logger.error(f"加载插件 {plugin_id} 失败: {error_msg}", exc_info=True)
            return plugin_info
    
    def unload_plugin(self, plugin_id: str) -> bool:
        """
        卸载插件
        
        参数：
            plugin_id: 插件 ID
        
        返回：
            是否成功卸载
        """
        if plugin_id not in self._loaded_plugins:
            logger.warning(f"插件 {plugin_id} 未加载")
            return False
        
        plugin_info = self._loaded_plugins[plugin_id]
        
        try:
            # 注销该插件注册的所有策略
            strategy_ids = self._plugin_strategies.get(plugin_id, set())
            for strategy_id in strategy_ids:
                self.hook_manager.unregister_strategy(strategy_id)
            
            # 如果插件有自定义的卸载逻辑
            if plugin_info.module and hasattr(plugin_info.module, 'unregister_hooks'):
                unregister_func = getattr(plugin_info.module, 'unregister_hooks')
                if callable(unregister_func):
                    unregister_func(self.hook_manager)
            
            # 从 sys.modules 移除
            if plugin_info.module_name in sys.modules:
                del sys.modules[plugin_info.module_name]
            
            # 清理记录
            del self._loaded_plugins[plugin_id]
            if plugin_id in self._plugin_strategies:
                del self._plugin_strategies[plugin_id]
            
            logger.info(f"成功卸载插件: {plugin_id}")
            return True
        
        except Exception as e:
            logger.error(f"卸载插件 {plugin_id} 失败: {e}", exc_info=True)
            return False
    
    def reload_plugin(self, plugin_id: str) -> Optional[PluginInfo]:
        """
        重新加载插件（热重载）
        
        参数：
            plugin_id: 插件 ID
        
        返回：
            新的插件信息
        """
        logger.info(f"开始重载插件: {plugin_id}")
        
        # 先卸载
        if plugin_id in self._loaded_plugins:
            self.unload_plugin(plugin_id)
        
        # 再加载
        return self.load_plugin(plugin_id)
    
    def reload_all(self) -> Dict[str, PluginInfo]:
        """
        重新加载所有插件
        
        返回：
            插件信息字典
        """
        logger.info("开始重载所有插件")
        
        # 获取当前所有插件 ID
        plugin_ids = list(self._loaded_plugins.keys())
        
        # 逐个重载
        for plugin_id in plugin_ids:
            self.reload_plugin(plugin_id)
        
        # 扫描新插件
        return self.scan_and_load_all()
    
    def get_loaded_plugins(self) -> Dict[str, PluginInfo]:
        """获取所有已加载的插件信息"""
        return dict(self._loaded_plugins)
    
    def is_plugin_loaded(self, plugin_id: str) -> bool:
        """检查插件是否已加载"""
        plugin_info = self._loaded_plugins.get(plugin_id)
        return plugin_info is not None and plugin_info.loaded
    
    def get_plugin_info(self, plugin_id: str) -> Optional[PluginInfo]:
        """获取插件信息"""
        return self._loaded_plugins.get(plugin_id)


# 全局单例
_global_plugin_loader: Optional[PluginLoader] = None


def get_plugin_loader() -> PluginLoader:
    """获取全局插件加载器实例"""
    global _global_plugin_loader
    if _global_plugin_loader is None:
        _global_plugin_loader = PluginLoader()
    return _global_plugin_loader


def initialize_plugins(auto_load: bool = True) -> PluginLoader:
    """
    初始化插件系统
    
    参数：
        auto_load: 是否自动扫描并加载所有插件
    
    返回：
        插件加载器实例
    """
    loader = get_plugin_loader()
    
    if auto_load:
        loader.scan_and_load_all()
    
    return loader


def reset_plugin_loader() -> None:
    """重置全局插件加载器（用于测试）"""
    global _global_plugin_loader
    _global_plugin_loader = None