# -*- coding: utf-8 -*-
"""
SmartTavern 后端 Hook 管理器

职责：
- 管理插件注册的 Hook 策略（类似前端 hooks.js）
- 支持权重排序（order）和按 ID 去重
- 支持热重载机制
- 提供异步 Hook 执行能力

Hook 点列表：
- beforeNormalizeAssets: 资产归一化前
- afterNormalizeAssets: 资产归一化后
- beforeRaw: RAW 装配前
- afterInsert: 插入后（RAW 前后过渡）
- afterRaw: RAW 装配后
 - beforePostprocessUser / afterPostprocessUser: user_view 后处理前/后
 - beforePostprocessAssistant / afterPostprocessAssistant: assistant_view 后处理前/后
- beforeVariablesSave: 变量保存前
- afterVariablesSave: 变量保存后
"""

from __future__ import annotations
import copy
import logging
from typing import Any, Dict, List, Optional, Callable, Awaitable
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class HookStrategy:
    """Hook 策略定义"""
    id: str
    order: int = 0
    seq: int = 0
    hooks: Dict[str, Callable] = field(default_factory=dict)
    
    def __post_init__(self):
        """确保 order 是数字"""
        try:
            self.order = int(self.order)
        except (TypeError, ValueError):
            self.order = 0


class HookManager:
    """
    后端 Hook 管理器
    
    特性：
    - 按权重排序（order 降序，越大越先执行）
    - 支持 ID 去重
    - 异步执行支持
    - 数据深拷贝保护
    """
    
    # 支持的 Hook 点
    HOOK_POINTS = [
        'beforeNormalizeAssets',
        'afterNormalizeAssets',
        'beforeRaw',
        'afterInsert',
        'afterRaw',
        'beforePostprocessUser',      # user_view 后处理前
        'afterPostprocessUser',        # user_view 后处理后
        'beforePostprocessAssistant',  # assistant_view 后处理前
        'afterPostprocessAssistant',   # assistant_view 后处理后
        'beforeVariablesSave',
        'afterVariablesSave',
        # === LLM 调用相关 Hook（仅 complete_with_hooks 使用）===
        'beforeLLMCall',               # LLM 调用前
        'afterLLMCall',                # LLM 调用后
        # === 流式调用分片 Hook（启用流式时触发）===
        'beforeStreamChunk',           # 每个流式分片发送前
        'afterStreamChunk',            # 每个流式分片发送后
        'beforeSaveResponse',          # 保存响应前
        'afterSaveResponse',           # 保存响应后
    ]
    
    def __init__(self):
        """初始化 Hook 注册表"""
        self._registry: Dict[str, List[HookStrategy]] = {
            hook: [] for hook in self.HOOK_POINTS
        }
        self._seq_counter = 0
        self._strategies_by_id: Dict[str, HookStrategy] = {}
    
    def register_strategy(
        self,
        strategy_id: str,
        hooks_dict: Dict[str, Callable],
        order: int = 0
    ) -> None:
        """
        注册一组 Hook 策略
        
        参数：
            strategy_id: 策略唯一标识
            hooks_dict: Hook 函数字典，格式 {"hookName": async_function}
            order: 权重（越大越先执行，默认 0）
        
        示例：
            manager.register_strategy(
                "my_plugin",
                {
                    "beforeRaw": async_hook_function,
                    "afterRaw": another_hook_function,
                },
                order=100
            )
        """
        if not strategy_id or not isinstance(strategy_id, str):
            logger.warning(f"无效的 strategy_id: {strategy_id}")
            return
        
        # 如果已存在，先注销
        if strategy_id in self._strategies_by_id:
            self.unregister_strategy(strategy_id)
        
        # 创建策略对象
        self._seq_counter += 1
        strategy = HookStrategy(
            id=strategy_id,
            order=order,
            seq=self._seq_counter,
            hooks=hooks_dict or {}
        )
        self._strategies_by_id[strategy_id] = strategy
        
        # 注册到各个 Hook 点
        for hook_name, hook_func in (hooks_dict or {}).items():
            if hook_name not in self.HOOK_POINTS:
                logger.warning(f"未知的 Hook 点: {hook_name}")
                continue
            
            if not callable(hook_func):
                logger.warning(f"Hook 函数不可调用: {hook_name}")
                continue
            
            # 添加到注册表并排序
            self._registry[hook_name].append(strategy)
            self._sort_hooks(hook_name)
        
        logger.info(f"注册策略: {strategy_id}, order={order}, hooks={list(hooks_dict.keys())}")
    
    def unregister_strategy(self, strategy_id: str) -> None:
        """
        注销指定策略的所有 Hook
        
        参数：
            strategy_id: 策略 ID
        """
        if strategy_id not in self._strategies_by_id:
            return
        
        strategy = self._strategies_by_id[strategy_id]
        
        # 从所有 Hook 点移除
        for hook_name in self.HOOK_POINTS:
            self._registry[hook_name] = [
                s for s in self._registry[hook_name]
                if s.id != strategy_id
            ]
        
        # 从策略字典移除
        del self._strategies_by_id[strategy_id]
        logger.info(f"注销策略: {strategy_id}")
    
    def _sort_hooks(self, hook_name: str) -> None:
        """
        排序指定 Hook 点的策略列表
        
        排序规则：
        1. order 降序（越大越先）
        2. id 字母序（稳定排序）
        3. seq 升序（注册顺序）
        """
        strategies = self._registry.get(hook_name, [])
        strategies.sort(key=lambda s: (
            -s.order,  # order 降序
            s.id.lower(),  # id 字母序
            s.seq  # 注册序列
        ))
    
    async def run_hooks(
        self,
        hook_name: str,
        data: Any,
        ctx: Optional[Dict[str, Any]] = None
    ) -> Any:
        """
        执行指定 Hook 点的所有策略
        
        参数：
            hook_name: Hook 点名称
            data: 输入数据
            ctx: 上下文信息 {"conversationFile": "...", "view": "...", ...}
        
        返回：
            处理后的数据
        
        执行流程：
        1. 按权重顺序串行执行所有策略
        2. 每个策略返回的数据作为下一个策略的输入
        3. 如果策略返回 None，保持当前数据不变
        4. 单个策略异常不影响其他策略
        """
        if hook_name not in self.HOOK_POINTS:
            logger.warning(f"未知的 Hook 点: {hook_name}")
            return data
        
        strategies = self._registry.get(hook_name, [])
        if not strategies:
            return data
        
        ctx = ctx or {}
        current = self._clone_data_for_hook(hook_name, data)
        
        for strategy in strategies:
            hook_func = strategy.hooks.get(hook_name)
            if not hook_func:
                continue
            
            try:
                # 克隆数据传递给 Hook
                input_data = self._clone_data_for_hook(hook_name, current)
                
                # 执行 Hook（支持同步和异步）
                if callable(hook_func):
                    result = hook_func(input_data, ctx)
                    # 如果是协程，await 它
                    if hasattr(result, '__await__'):
                        result = await result
                    
                    # 合并结果
                    if result is not None:
                        current = self._merge_hook_output(hook_name, current, result)
            
            except Exception as e:
                logger.error(
                    f"Hook 执行失败: {hook_name}, strategy={strategy.id}, "
                    f"error={type(e).__name__}: {e}"
                )
                # 单个策略失败不影响其他策略
                continue
        
        return current
    
    def _clone_data_for_hook(self, hook_name: str, data: Any) -> Any:
        """
        根据 Hook 类型克隆数据
        
        不同 Hook 点有不同的数据结构，需要针对性处理
        """
        try:
            if hook_name in ('beforeRaw', 'afterInsert', 'afterRaw'):
                # 消息数组
                return copy.deepcopy(data) if isinstance(data, list) else []
            
            elif hook_name in ('beforeNormalizeAssets', 'afterNormalizeAssets'):
                # 资产对象 {preset, world_books, character, regex_files}
                if isinstance(data, dict):
                    return {
                        'preset': copy.deepcopy(data.get('preset')),
                        'world_books': copy.deepcopy(data.get('world_books')),
                        'character': copy.deepcopy(data.get('character')),
                        'regex_files': copy.deepcopy(data.get('regex_files')),
                    }
                return {}
            
            elif hook_name in ('beforePostprocessUser', 'afterPostprocessUser',
                              'beforePostprocessAssistant', 'afterPostprocessAssistant'):
                # 后处理对象 {messages, rules, variables}
                if isinstance(data, dict):
                    return {
                        'messages': copy.deepcopy(data.get('messages', [])),
                        'rules': copy.deepcopy(data.get('rules')),
                        'variables': copy.deepcopy(data.get('variables', {})),
                    }
                return {'messages': [], 'rules': [], 'variables': {}}
            
            elif hook_name in ('beforeVariablesSave', 'afterVariablesSave'):
                # 变量对象
                if isinstance(data, dict):
                    return copy.deepcopy(data.get('finalVars') or data)
                return {}
            
            elif hook_name == 'beforeLLMCall':
                # LLM 调用参数 {messages, llm_params}
                if isinstance(data, dict):
                    return {
                        'messages': copy.deepcopy(data.get('messages', [])),
                        'llm_params': copy.deepcopy(data.get('llm_params', {})),
                    }
                return {'messages': [], 'llm_params': {}}
            
            elif hook_name == 'afterLLMCall':
                # LLM 响应 {content, usage, finish_reason, model_used}
                if isinstance(data, dict):
                    return copy.deepcopy(data)
                return {}

            elif hook_name in ('beforeStreamChunk', 'afterStreamChunk'):
                # 流式分片 {content, finish_reason?, usage?}
                if isinstance(data, dict):
                    out = {}
                    if 'content' in data:
                        out['content'] = copy.deepcopy(data.get('content'))
                    if 'finish_reason' in data:
                        out['finish_reason'] = copy.deepcopy(data.get('finish_reason'))
                    if 'usage' in data:
                        out['usage'] = copy.deepcopy(data.get('usage'))
                    return out
                return {}
            
            elif hook_name == 'beforeSaveResponse':
                # 保存参数 {node_id, content, parent_id, is_update}
                if isinstance(data, dict):
                    return copy.deepcopy(data)
                return {}
            
            elif hook_name == 'afterSaveResponse':
                # 保存结果 {node_id, doc, usage}
                if isinstance(data, dict):
                    return copy.deepcopy(data)
                return {}
            
            else:
                return copy.deepcopy(data)
        
        except Exception as e:
            logger.warning(f"数据克隆失败: {hook_name}, error={e}")
            return data
    
    def _merge_hook_output(self, hook_name: str, current: Any, output: Any) -> Any:
        """
        合并 Hook 输出
        
        根据 Hook 类型的不同，采用不同的合并策略
        """
        if output is None:
            return current
        
        try:
            if hook_name in ('beforeRaw', 'afterInsert'):
                # 历史消息：支持返回数组或 {history: [...]}
                if isinstance(output, list):
                    return output
                if isinstance(output, dict) and 'history' in output:
                    return output['history']
                return current
            
            elif hook_name == 'afterRaw':
                # RAW 消息：支持返回数组或 {messages: [...]}
                if isinstance(output, list):
                    return output
                if isinstance(output, dict) and 'messages' in output:
                    return output['messages']
                return current
            
            elif hook_name in ('beforeNormalizeAssets', 'afterNormalizeAssets'):
                # 资产对象：部分字段更新
                if isinstance(output, dict) and isinstance(current, dict):
                    result = dict(current)
                    if 'preset' in output:
                        result['preset'] = output['preset']
                    if 'world_books' in output:
                        result['world_books'] = output['world_books']
                    if 'character' in output:
                        result['character'] = output['character']
                    if 'regex_files' in output:
                        result['regex_files'] = output['regex_files']
                    return result
                return current
            
            elif hook_name in ('beforePostprocessUser', 'afterPostprocessUser',
                              'beforePostprocessAssistant', 'afterPostprocessAssistant'):
                # 后处理对象：部分字段更新
                if isinstance(output, dict) and isinstance(current, dict):
                    result = dict(current)
                    if 'messages' in output:
                        result['messages'] = output['messages']
                    if 'rules' in output:
                        result['rules'] = output['rules']
                    if 'variables' in output:
                        result['variables'] = output['variables']
                    return result
                return current
            
            elif hook_name in ('beforeVariablesSave', 'afterVariablesSave'):
                # 变量对象：直接合并或替换
                if isinstance(output, dict):
                    if 'finalVars' in output:
                        return {**current, **output['finalVars']} if isinstance(current, dict) else output['finalVars']
                    return {**current, **output} if isinstance(current, dict) else output
                return output
            
            elif hook_name == 'beforeLLMCall':
                # LLM 调用参数：部分字段更新
                if isinstance(output, dict) and isinstance(current, dict):
                    result = dict(current)
                    if 'messages' in output:
                        result['messages'] = output['messages']
                    if 'llm_params' in output:
                        result['llm_params'] = output['llm_params']
                    return result
                return current
            
            elif hook_name in ('afterLLMCall', 'beforeSaveResponse', 'afterSaveResponse'):
                # LLM 响应/保存参数/保存结果：完整替换或部分更新
                if isinstance(output, dict) and isinstance(current, dict):
                    return {**current, **output}
                return output if output is not None else current

            elif hook_name in ('beforeStreamChunk', 'afterStreamChunk'):
                # 分片：仅支持覆盖 {content, finish_reason, usage}
                if isinstance(output, dict) and isinstance(current, dict):
                    result = dict(current)
                    if 'content' in output:
                        result['content'] = output['content']
                    if 'finish_reason' in output:
                        result['finish_reason'] = output['finish_reason']
                    if 'usage' in output:
                        result['usage'] = output['usage']
                    return result
                return current
            
            else:
                return output if output is not None else current
        
        except Exception as e:
            logger.warning(f"输出合并失败: {hook_name}, error={e}")
            return current
    
    def get_registered_strategies(self) -> List[str]:
        """获取所有已注册的策略 ID"""
        return list(self._strategies_by_id.keys())
    
    def get_hooks_for_strategy(self, strategy_id: str) -> List[str]:
        """获取指定策略注册的所有 Hook 点"""
        strategy = self._strategies_by_id.get(strategy_id)
        if not strategy:
            return []
        return list(strategy.hooks.keys())
    
    def clear_all(self) -> None:
        """清空所有注册（用于测试或重置）"""
        self._registry = {hook: [] for hook in self.HOOK_POINTS}
        self._strategies_by_id.clear()
        self._seq_counter = 0
        logger.info("清空所有 Hook 注册")


# 全局单例
_global_hook_manager: Optional[HookManager] = None


def get_hook_manager() -> HookManager:
    """获取全局 Hook 管理器实例"""
    global _global_hook_manager
    if _global_hook_manager is None:
        _global_hook_manager = HookManager()
    return _global_hook_manager


def reset_hook_manager() -> None:
    """重置全局 Hook 管理器（用于测试）"""
    global _global_hook_manager
    _global_hook_manager = None