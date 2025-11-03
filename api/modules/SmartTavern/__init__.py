"""
SmartTavern 模块命名空间（api/modules/SmartTavern）

说明：
- 该包用于注册 SmartTavern 相关的公共模块 API（遵循 DEVELOPMENT_NOTES 中的注册规范）
- 子模块采用“封装层 + 实现层”结构，例如：
  - chat_branches/impl.py     -> 内部实现（不可直接对外）
  - chat_branches/chat_branches.py -> 封装为公共 API（@core.register_api）

注意：
- 统一通过 import core 门面进行跨模块调用，不直接 import 其他模块的 impl
- 该 __init__.py 文件用于确保服务发现（rglob("__init__.py")）能识别此为包
"""
__all__ = []