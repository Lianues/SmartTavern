"""
全局API接口配置（核心层）
- 统一定义 base_url 与 api_prefix
- 允许通过环境变量覆盖：
  MODULARFLOW_API_BASE_URL
  MODULARFLOW_API_PREFIX
- 供 core.api_client 等模块使用
"""

from dataclasses import dataclass
import os

@dataclass(frozen=True)
class GlobalAPIConfig:
    base_url: str
    api_prefix: str

def _normalize_prefix(prefix: str) -> str:
    """
    规范化API前缀，确保以单个斜杠开头且无尾部斜杠
    """
    s = (prefix or "/api").strip()
    if not s.startswith("/"):
        s = "/" + s
    return s.rstrip("/")

def get_global_api_config() -> GlobalAPIConfig:
    """
    从环境变量读取或使用默认值，返回全局API配置。
    - MODULARFLOW_API_BASE_URL: 覆盖基础URL（默认: http://localhost:8050）
    - MODULARFLOW_API_PREFIX: 覆盖API前缀（默认: /api）
    """
    base = os.getenv("MODULARFLOW_API_BASE_URL") or "http://localhost:8050"
    prefix = os.getenv("MODULARFLOW_API_PREFIX") or "/api"
    return GlobalAPIConfig(base_url=base.rstrip("/"), api_prefix=_normalize_prefix(prefix))

# 便捷常量（读取一次当前环境），如需动态变更请调用 get_global_api_config()
GLOBAL_API_CONFIG = get_global_api_config()