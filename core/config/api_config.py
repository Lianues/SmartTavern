"""
核心统一API配置（不使用环境变量）
- 配置文件路径：core/config/api_config.py
- 统一定义整体 API 接口：
    base_url: http://localhost:8050
    api_prefix: /api
- 供 core 层（如 api_client、api_gateway）直接读取使用
"""

from dataclasses import dataclass

@dataclass(frozen=True)
class APIConfig:
    base_url: str
    api_prefix: str

DEFAULT_BASE_URL: str = "http://localhost:8050"
DEFAULT_API_PREFIX: str = "/api"

def _normalize_prefix(prefix: str) -> str:
    """
    规范化API前缀，确保以单个斜杠开头且无尾部斜杠
    """
    s = (prefix or "/api").strip()
    if not s.startswith("/"):
        s = "/" + s
    return s.rstrip("/")

def get_api_config() -> APIConfig:
    """
    返回核心统一API配置
    """
    return APIConfig(
        base_url=DEFAULT_BASE_URL.rstrip("/"),
        api_prefix=_normalize_prefix(DEFAULT_API_PREFIX),
    )