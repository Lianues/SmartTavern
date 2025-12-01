"""
核心门面导出
- 外部项目只需 `import core` 即可使用统一入口
- 暴露方法/对象：
  • call_api: 便捷一次性调用入口
  • get_client: 获取/创建全局客户端（可覆盖 base_url、api_prefix、timeout）
  • ApiClient: 客户端类，支持鉴权与细粒度控制
  • get_api_config: 读取核心统一 API 配置（core/config/api_config.py）
  • client: 已初始化的全局客户端单例，适合复用
"""

from .api_client import ApiClient, call_api, get_client
from .config.api_config import get_api_config
from .api_registry import get_registered_api, get_registry, register_api
from .services import get_service_manager, get_current_globals
from .project_config_interface import load_project_config, ProjectConfigInterface, DefaultProjectConfig, validate_config_script

# 为避免循环依赖，使用延迟导入包装 core.api_gateway.get_api_gateway
def get_api_gateway(*args, **kwargs):
    from .api_gateway import get_api_gateway as _get_api_gateway
    return _get_api_gateway(*args, **kwargs)

# 全局客户端单例（复用 requests.Session，适合多次调用场景）
client: ApiClient = get_client()

__all__ = [
    "call_api",
    "get_client",
    "get_api_config",
    "get_registry",
    "get_registered_api",
    "register_api",
    "get_service_manager",
    "get_current_globals",
    "get_api_gateway",
    "load_project_config",
    "ProjectConfigInterface",
    "DefaultProjectConfig",
    "validate_config_script",
    "ApiClient",
    "client",
]