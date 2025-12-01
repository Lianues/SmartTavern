"""
通用LLM API模块变量
"""

# 支持的提供商列表
SUPPORTED_PROVIDERS = ["openai", "anthropic", "gemini", "openai_compatible", "custom"]

# 默认模型列表
DEFAULT_MODELS = {
    "openai": [
        "gpt-4",
        "gpt-4-turbo",
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-3.5-turbo",
        "gpt-3.5-turbo-16k"
    ],
    "anthropic": [
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022"
    ],
    "gemini": [
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-1.0-pro",
        "gemini-2.0-flash-exp"
    ],
    "openai_compatible": [
        "gpt-3.5-turbo",
        "gpt-4",
        "custom-model"
    ]
}

# HTTP错误消息映射
HTTP_ERROR_MESSAGES = {
    400: "请求格式错误",
    401: "API密钥无效或未提供",
    403: "权限被拒绝",
    404: "API端点不存在",
    429: "请求频率过高，已被限制",
    500: "服务器内部错误",
    502: "网关错误",
    503: "服务不可用",
    504: "网关超时"
}

# 请求配置
DEFAULT_TIMEOUT = 60  # 默认超时时间(秒)
DEFAULT_CONNECT_TIMEOUT = 10  # 连接超时时间(秒)
MAX_REQUEST_SIZE = 1024 * 1024 * 10  # 最大请求大小 (10MB)

# 日志级别
DEFAULT_LOG_LEVEL = "WARNING"

# 统计跟踪
ENABLE_USAGE_TRACKING = True