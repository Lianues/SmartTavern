"""
简化的工作流编排器 (可选模块)
通过函数名连接输入输出，支持任意复杂的数据流
这是一个可选的编排工具，可以被使用或删除
"""
from typing import Any, Dict, List, Optional, Callable
from dataclasses import dataclass
from collections import defaultdict
import asyncio
from concurrent.futures import ThreadPoolExecutor
from ..core.api_registry import get_registry, FunctionSpec


@dataclass
class FlowConnection:
    """数据流连接"""
    from_func: str  # 源函数名
    from_output: str  # 源函数的输出字段
    to_func: str  # 目标函数名
    to_input: str  # 目标函数的输入参数


class SimpleWorkflow:
    """
    简化的工作流编排器
    只需要函数名和连接关系即可
    """
    
    def __init__(self, name: str = "workflow"):
        self.name = name
        self.registry = get_registry()
        self.connections: List[FlowConnection] = []
        self.initial_inputs: Dict[str, Dict[str, Any]] = {}  # 函数名 -> 初始输入
        self.results: Dict[str, Any] = {}  # 存储执行结果
    
    def set_input(self, func_name: str, **kwargs) -> 'SimpleWorkflow':
        """
        设置函数的初始输入
        
        Args:
            func_name: 函数名
            **kwargs: 输入参数
            
        Returns:
            self: 支持链式调用
        """
        if func_name not in self.registry.functions:
            raise ValueError(f"函数 {func_name} 未注册")
        
        self.initial_inputs[func_name] = kwargs
        return self
    
    def connect(self, 
                from_func: str,
                to_func: str,
                mapping: Dict[str, str] = None) -> 'SimpleWorkflow':
        """
        连接两个函数
        
        Args:
            from_func: 源函数名
            to_func: 目标函数名  
            mapping: 输出到输入的映射 {输出字段: 输入参数}
                    如果不提供，尝试自动映射
            
        Returns:
            self: 支持链式调用
        """
        # 验证函数存在
        if from_func not in self.registry.functions:
            raise ValueError(f"函数 {from_func} 未注册")
        if to_func not in self.registry.functions:
            raise ValueError(f"函数 {to_func} 未注册")
        
        # 获取函数规范
        from_spec = self.registry.get_spec(from_func)
        to_spec = self.registry.get_spec(to_func)
        
        # 如果没有提供映射，尝试自动映射
        if mapping is None:
            mapping = {}
            # 尝试匹配同名的输出和输入
            for output in from_spec.outputs:
                if output in to_spec.inputs:
                    mapping[output] = output
            
            # 如果只有一个输出和一个输入，直接映射
            if not mapping and len(from_spec.outputs) == 1 and len(to_spec.inputs) == 1:
                mapping[from_spec.outputs[0]] = to_spec.inputs[0]
        
        # 创建连接
        for from_output, to_input in mapping.items():
            conn = FlowConnection(from_func, from_output, to_func, to_input)
            self.connections.append(conn)
            print(f"✓ 连接: {from_func}.{from_output} -> {to_func}.{to_input}")
        
        return self
    
    def chain(self, *func_names: str) -> 'SimpleWorkflow':
        """
        串联多个函数（简化的连接方式）
        自动将前一个函数的输出连接到下一个函数的输入
        
        Args:
            *func_names: 函数名序列
            
        Returns:
            self: 支持链式调用
        """
        for i in range(len(func_names) - 1):
            self.connect(func_names[i], func_names[i + 1])
        return self
    
    def _get_execution_order(self) -> List[str]:
        """获取执行顺序（拓扑排序）"""
        # 构建依赖关系
        dependencies = defaultdict(set)
        dependents = defaultdict(set)
        
        for conn in self.connections:
            dependencies[conn.to_func].add(conn.from_func)
            dependents[conn.from_func].add(conn.to_func)
        
        # 获取所有函数
        all_funcs = set(self.initial_inputs.keys())
        for conn in self.connections:
            all_funcs.add(conn.from_func)
            all_funcs.add(conn.to_func)
        
        # 拓扑排序
        ready = [func for func in all_funcs if func not in dependencies]
        order = []
        
        while ready:
            func = ready.pop(0)
            order.append(func)
            
            for dependent in dependents[func]:
                dependencies[dependent].discard(func)
                if not dependencies[dependent]:
                    ready.append(dependent)
        
        return order
    
    def execute(self) -> Dict[str, Any]:
        """
        执行工作流
        
        Returns:
            Dict[str, Any]: 所有函数的执行结果
        """
        # 获取执行顺序
        order = self._get_execution_order()
        
        # 清空结果
        self.results = {}
        
        print(f"\n开始执行工作流: {self.name}")
        print(f"执行顺序: {' -> '.join(order)}")
        
        for func_name in order:
            # 准备输入
            inputs = self.initial_inputs.get(func_name, {}).copy()
            
            # 从连接中收集输入
            for conn in self.connections:
                if conn.to_func == func_name and conn.from_func in self.results:
                    from_result = self.results[conn.from_func]
                    if isinstance(from_result, dict) and conn.from_output in from_result:
                        inputs[conn.to_input] = from_result[conn.from_output]
            
            # 执行函数
            print(f"  执行: {func_name} 输入: {list(inputs.keys())}")
            result = self.registry.call(func_name, **inputs)
            self.results[func_name] = result
            print(f"  完成: {func_name} 输出: {list(result.keys()) if isinstance(result, dict) else type(result).__name__}")
        
        print(f"工作流执行完成\n")
        return self.results
    
    async def execute_async(self) -> Dict[str, Any]:
        """异步执行工作流"""
        order = self._get_execution_order()
        self.results = {}
        
        # 按依赖批次执行
        executed = set()
        
        while len(executed) < len(order):
            # 找出可以并行执行的函数
            ready = []
            for func_name in order:
                if func_name not in executed:
                    # 检查依赖是否都已完成
                    deps_ready = True
                    for conn in self.connections:
                        if conn.to_func == func_name and conn.from_func not in executed:
                            deps_ready = False
                            break
                    if deps_ready:
                        ready.append(func_name)
            
            if not ready:
                break
            
            # 并行执行
            tasks = []
            for func_name in ready:
                task = self._execute_func_async(func_name)
                tasks.append(task)
            
            results = await asyncio.gather(*tasks)
            
            for func_name, result in zip(ready, results):
                self.results[func_name] = result
                executed.add(func_name)
        
        return self.results
    
    async def _execute_func_async(self, func_name: str) -> Any:
        """异步执行单个函数"""
        # 准备输入
        inputs = self.initial_inputs.get(func_name, {}).copy()
        
        for conn in self.connections:
            if conn.to_func == func_name and conn.from_func in self.results:
                from_result = self.results[conn.from_func]
                if isinstance(from_result, dict) and conn.from_output in from_result:
                    inputs[conn.to_input] = from_result[conn.from_output]
        
        # 在线程池中执行
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self.registry.call,
                func_name,
                inputs
            )
        return result
    
    def parallel(self, *branches: List[str]) -> Dict[str, Any]:
        """
        并行执行多个分支
        
        Args:
            *branches: 每个分支是函数名列表
            
        Returns:
            Dict[str, Any]: 所有分支的结果
        """
        with ThreadPoolExecutor(max_workers=len(branches)) as executor:
            futures = []
            
            for branch in branches:
                # 创建分支工作流
                branch_wf = SimpleWorkflow(f"{self.name}_branch")
                branch_wf.registry = self.registry
                
                # 串联分支中的函数
                for i, func_name in enumerate(branch):
                    if i == 0:
                        # 复制初始输入
                        if func_name in self.initial_inputs:
                            branch_wf.set_input(func_name, **self.initial_inputs[func_name])
                    if i < len(branch) - 1:
                        branch_wf.connect(branch[i], branch[i + 1])
                
                # 提交执行
                future = executor.submit(branch_wf.execute)
                futures.append(future)
            
            # 收集结果
            all_results = {}
            for future in futures:
                branch_results = future.result()
                all_results.update(branch_results)
            
            return all_results
    
    def visualize(self) -> str:
        """
        生成工作流的文本可视化
        
        Returns:
            str: 工作流图的文本表示
        """
        lines = []
        lines.append(f"工作流: {self.name}")
        lines.append("=" * 40)
        
        # 显示函数
        lines.append("\n已注册函数:")
        for func_name in self.registry.list_functions():
            spec = self.registry.get_spec(func_name)
            lines.append(f"  • {spec}")
        
        # 显示连接
        lines.append("\n数据流连接:")
        for conn in self.connections:
            lines.append(f"  {conn.from_func}.{conn.from_output} -> {conn.to_func}.{conn.to_input}")
        
        # 显示初始输入
        if self.initial_inputs:
            lines.append("\n初始输入:")
            for func_name, inputs in self.initial_inputs.items():
                lines.append(f"  {func_name}: {list(inputs.keys())}")
        
        return "\n".join(lines)


# 便捷函数
def create_workflow(name: str = "workflow") -> SimpleWorkflow:
    """创建新的工作流"""
    return SimpleWorkflow(name)