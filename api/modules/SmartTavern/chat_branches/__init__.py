"""
SmartTavern.chat_branches 模块包

结构说明：
- impl.py                -> 内部实现（纯Python内存引擎，无HTTP）
- chat_branches.py       -> API 封装层，使用 @core.register_api 暴露能力（按 DEVELOPMENT_NOTES 规范）
- README.md              -> 接口文档（入参/出参/示例）
- test_chat_branches.py  -> 本地测试脚本（通过 core.call_api 验证所有接口）
"""
__all__ = []