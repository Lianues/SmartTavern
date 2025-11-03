"""
函数/能力注册与编排系统（API Registry）

新规范：
- 统一使用 @register_api(path, input_schema, output_schema, name?, description?)
- 路径为斜杠风格（不包含传输层前缀），命名空间根据函数文件位置自动解析：
  • api/modules/* => modules
  • api/workflow/* => workflow
- 输入与输出采用严格 JSON Schema（draft-07/2020-12），不再使用 inputs/outputs 列表
"""
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass
import inspect


@dataclass
class FunctionSpec:
    """函数规范 - 新版，以 JSON Schema 与斜杠路径为核心"""
    name: str                   # 函数内部标识（默认函数名）
    description: str            # 描述（内部属性）
    path: str                   # 相对业务路径（斜杠风格，不含 /api 前缀）
    namespace: str              # 命名空间：modules | workflow（自动解析）
    input_schema: Dict[str, Any]   # 请求体 JSON Schema
    output_schema: Dict[str, Any]  # 响应体 JSON Schema

    def __repr__(self):
        return f"{self.namespace}:{self.path} [{self.name}]"


class FunctionRegistry:
    """函数与工作流注册中心（新版）"""

    def __init__(self):
        # 使用 path 作为唯一键
        self.functions: Dict[str, Callable] = {}
        self.specs: Dict[str, FunctionSpec] = {}
        self.workflows: Dict[str, Callable] = {}  # 兼容保留

    def _derive_namespace(self, func: Callable) -> str:
        mod = getattr(func, "__module__", "") or ""
        if mod.startswith("api.modules"):
            return "modules"
        if mod.startswith("api.workflow"):
            return "workflow"
        if mod.startswith("api.plugins"):
            return "plugins"
        raise ValueError(f"无法解析命名空间（函数不在 api/modules 或 api/workflow 或 api/plugins 下）：module={mod}")

    def register(
        self,
        path: str,
        func: Callable,
        input_schema: Dict[str, Any],
        output_schema: Dict[str, Any],
        name: Optional[str] = None,
        description: str = "",
    ) -> None:
        """
        注册一个函数/能力（API 统一入口 - 新版）

        Args:
            path: 相对业务路径（斜杠风格），例如 "project_manager/start_project"
            func: 可调用对象
            input_schema: 输入 JSON Schema
            output_schema: 输出 JSON Schema
            name: 函数内部名称（默认取函数名）
            description: 描述
        """
        if not isinstance(path, str) or not path:
            raise ValueError("path 必须为非空字符串")
        path = path.lstrip("/")

        ns = self._derive_namespace(func)

        if not isinstance(input_schema, dict) or not isinstance(output_schema, dict):
            raise ValueError("input_schema / output_schema 必须为字典(JSON Schema)")

        func_name = name or func.__name__
        spec = FunctionSpec(
            name=func_name,
            description=description or "",
            path=path,
            namespace=ns,
            input_schema=input_schema,
            output_schema=output_schema,
        )

        self.functions[path] = func
        self.specs[path] = spec

        try:
            print(f"✓ 已注册API: {spec}")
        except UnicodeEncodeError:
            print(f"[OK] 已注册API: {spec}")

    def call(self, path: str, **kwargs) -> Any:
        """按 path 调用注册的函数"""
        if path not in self.functions:
            raise ValueError(f"函数 {path} 未注册")
        func = self.functions[path]
        return func(**kwargs) if kwargs else func()

    def list_functions(self) -> List[str]:
        """列出所有已注册的 API 路径（斜杠风格）"""
        return list(self.functions.keys())

    def get_spec(self, path: str) -> Optional[FunctionSpec]:
        """获取函数规范（按 path）"""
        return self.specs.get(path)

    # 兼容保留：工作流注册（不影响新版 API 规范）
    def register_workflow(self, name: str, workflow: Callable):
        if name in self.workflows:
            try:
                print(f"警告: 工作流 '{name}' 已被覆盖。")
            except UnicodeEncodeError:
                print(f"[WARNING] 工作流 '{name}' 已被覆盖。")
        self.workflows[name] = workflow
        try:
            print(f"✓ 已注册工作流: {name}")
        except UnicodeEncodeError:
            print(f"[OK] 已注册工作流: {name}")

    def get_workflow(self, name: str) -> Optional[Callable]:
        return self.workflows.get(name)

    def list_workflows(self) -> List[str]:
        return list(self.workflows.keys())


# 全局注册器
_registry = FunctionRegistry()


def get_registry() -> FunctionRegistry:
    """获取全局注册器"""
    return _registry


def register_workflow(name: str):
    """装饰器：注册工作流（兼容保留）"""
    def decorator(func):
        _registry.register_workflow(name, func)
        return func
    return decorator


def register_api(
    path: str,
    input_schema: Dict[str, Any],
    output_schema: Dict[str, Any],
    name: Optional[str] = None,
    description: str = "",
):
    """
    装饰器：注册API（新规范）
    使用方法:
        @register_api(
            path="web_server/restart_project",
            input_schema={...},
            output_schema={...},
            description="重启前端项目"
        )
        def restart_frontend_project(...):
            ...
    """
    def decorator(func):
        # 仅在底层 register 中打印一次，避免重复打印“已注册API”
        _registry.register(path, func, input_schema, output_schema, name=name, description=description)
        return func
    return decorator


def get_registered_api(path: str) -> Callable:
    """
    获取已注册的API（按斜杠路径）
    """
    if path not in _registry.functions:
        raise ValueError(f"API {path} 未注册")
    return _registry.functions[path]