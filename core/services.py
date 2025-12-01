"""
统一服务管理系统 (Unified Service Management System)

提供框架级别的服务定位、动态模块发现与加载，以及共享资源访问的基础能力。
本版本采用纯“API 封装层自动发现”模式：
- 启动时仅扫描框架根目录下的 api/* 子包并导入其实现文件，从而触发封装层内的 @register_api 装饰器注册。
- 不再维护项目列表/当前项目/项目配置的读写，相关接口已删除。
"""

import os
import importlib
from typing import Any, Dict, List, Optional, Callable
from pathlib import Path
from dataclasses import dataclass, field
import threading


@dataclass
class ServiceRegistry:
    """服务注册表"""
    globals_services: Dict[str, Any] = field(default_factory=dict)
    module_services: Dict[str, Any] = field(default_factory=dict)
    function_services: Dict[str, Callable] = field(default_factory=dict)
    workflow_services: Dict[str, Callable] = field(default_factory=dict)


class UnifiedServiceManager:
    """
    统一服务管理器（无项目配置文件版）

    负责：
    1. 动态模块发现和加载（仅扫描 modules/*）
    2. 服务注册与定位
    3. 共享资源的统一访问（如有需要可扩展）

    说明：
    - 已移除对 backend_projects/backend-projects.json 的读取与保存逻辑
    - 已删除项目级接口（注册项目、切换项目、获取当前项目等）
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if hasattr(self, "_initialized"):
            return

        self._initialized = True
        self.services = ServiceRegistry()
        self._base_path = Path.cwd()
        self._verbose = False

    # ========== 动态模块发现与加载 ==========

    def discover_modules(self) -> List[str]:
        """
        在框架根目录下仅扫描 api/*，发现每个子包的“实现文件”并返回可导入路径。
        
        规则：
        - 任意包含 __init__.py 的目录，若其中存在与目录同名的 .py 实现文件，则加入导入列表
        - 例如：
            api/modules/web_server/web_server.py         -> api.modules.web_server.web_server
            api/workflow/image_binding/image_binding.py  -> api.workflow.image_binding.image_binding
        """
        module_paths: List[str] = []
        
        for root_name in ("api",):
            root_dir = self._base_path / root_name
            if not root_dir.exists():
                continue
            
            # 递归查找：任意包含 __init__.py 的目录，若其中存在同名实现文件，则加入导入列表
            for init_file in root_dir.rglob("__init__.py"):
                package_dir = init_file.parent
                # 尝试定位“实现文件”：与目录同名 .py 文件
                impl_file = package_dir / f"{package_dir.name}.py"
                if impl_file.exists():
                    try:
                        relative_to_root = package_dir.relative_to(self._base_path)
                        import_path = str(relative_to_root).replace(os.path.sep, ".")
                        # 形成最终导入路径：<package path>.<impl filename>（不带后缀）
                        full_import_path = f"{import_path}.{package_dir.name}"
                        if full_import_path not in module_paths:
                            module_paths.append(full_import_path)
                    except ValueError:
                        # 不是在当前工程根下，跳过
                        continue
        
        return module_paths

    def load_project_modules(self) -> int:
        """
        加载所有模块（仅根级 modules/* 动态发现）。
        通过 import 导入实现文件以触发模块内的函数/工作流注册。
        """
        total_loaded_count = 0
        discovered = self.discover_modules()

        for module_path in discovered:
            try:
                module = importlib.import_module(module_path)
                total_loaded_count += 1
                # 将模块记录到服务注册表（以 core.<module_name> 为键，保持与历史行为相近）
                # 模块名取倒数第二段（实现文件前的那个目录名）
                parts = module_path.split(".")
                module_name = parts[-2] if len(parts) >= 2 else parts[-1]
                service_key = f"core.{module_name}"
                self.services.module_services[service_key] = module
                if self._verbose:
                    print(f"  ✓ 加载模块: {service_key} ({module_path})")
            except ImportError as e:
                print(f"  ✗ 模块加载失败 {module_path}: {e}")

        return total_loaded_count
    
    def initialize_plugins(self) -> int:
        """
        初始化后端插件系统
        
        自动加载所有启用的插件及其 Hook
        
        返回：
            成功加载的插件数量
        """
        try:
            from api.plugins.SmartTavern import initialize_plugins
            
            loader = initialize_plugins(auto_load=True)
            loaded_plugins = loader.get_loaded_plugins()
            
            successful_count = sum(1 for info in loaded_plugins.values() if info.loaded)
            
            if self._verbose:
                print(f"  ✓ 插件系统初始化完成: {successful_count}/{len(loaded_plugins)} 个插件成功加载")
            
            return successful_count
        
        except Exception as e:
            print(f"  ✗ 插件系统初始化失败: {e}")
            return 0

    # ========== 共享资源访问（占位，可扩展） ==========

    def get_globals(self) -> Optional[Any]:
        """
        获取全局共享的 globals 模块（如有需要可扩展动态发现逻辑）。
        当前返回 None；保留接口以兼容调用方。
        """
        return None

    # ========== 服务定位接口 ==========

    def register_service(self, name: str, service: Any, service_type: str = "general"):
        """注册服务到统一注册表"""
        if service_type == "function":
            self.services.function_services[name] = service
        elif service_type == "workflow":
            self.services.workflow_services[name] = service
        elif service_type == "module":
            self.services.module_services[name] = service
        elif service_type == "globals":
            self.services.globals_services[name] = service

    def get_service(self, name: str, service_type: str = None) -> Optional[Any]:
        """按类型与名称获取服务"""
        if service_type == "function" or service_type is None:
            if name in self.services.function_services:
                return self.services.function_services[name]

        if service_type == "workflow" or service_type is None:
            if name in self.services.workflow_services:
                return self.services.workflow_services[name]

        if service_type == "module" or service_type is None:
            if name in self.services.module_services:
                return self.services.module_services[name]

        if service_type == "globals" or service_type is None:
            if name in self.services.globals_services:
                return self.services.globals_services[name]

        return None

    def list_services(self, service_type: str = None) -> Dict[str, List[str]]:
        """列出所有已注册服务"""
        if service_type:
            if service_type == "function":
                return {service_type: list(self.services.function_services.keys())}
            elif service_type == "workflow":
                return {service_type: list(self.services.workflow_services.keys())}
            elif service_type == "module":
                return {service_type: list(self.services.module_services.keys())}
            elif service_type == "globals":
                return {service_type: list(self.services.globals_services.keys())}

        return {
            "function": list(self.services.function_services.keys()),
            "workflow": list(self.services.workflow_services.keys()),
            "module": list(self.services.module_services.keys()),
            "globals": list(self.services.globals_services.keys()),
        }

    # ========== 便捷访问接口 ==========

    def g(self):
        """便捷的 globals 访问接口（当前返回 None）"""
        return self.get_globals()

    def current_g(self):
        """同 g()，保留兼容接口"""
        return self.get_globals()

    def set_verbose(self, verbose: bool = True):
        """设置详细输出模式"""
        self._verbose = verbose


# ========== 全局服务管理器实例与便捷函数 ==========

service_manager = UnifiedServiceManager()


def get_service_manager() -> UnifiedServiceManager:
    """获取全局服务管理器"""
    return service_manager


def get_current_globals():
    """获取当前全局 globals（当前返回 None）"""
    return service_manager.current_g()


# 向后兼容的 globals 访问（用于渐进式迁移）
def get_legacy_globals():
    """
    向后兼容的 globals 访问。若当前不可用，则尝试导入历史路径。
    """
    try:
        g = service_manager.current_g()
        if g is not None:
            return g

        # 历史后备方案（如不存在将捕获 ImportError）
        from shared.SmartTavern import globals as legacy_g  # type: ignore
        return legacy_g
    except ImportError:
        print("⚠️ 无法访问globals模块")
        return None