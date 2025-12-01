# SmartTavern 后端插件系统 - 使用指南

## 概述

SmartTavern 现在支持后端 Python Hook 系统，将前端 JavaScript 的路由处理逻辑迁移到后端，实现：

- ✅ **减少网络传输**：前端只传文件路径，不再传输完整 JSON 配置
- ✅ **集中处理**：后端统一执行所有 Hook 和路由逻辑
- ✅ **热重载**：支持插件动态加载，无需重启服务器
- ✅ **更强功能**：Python Hook 功能比 JavaScript 更强大
- ✅ **性能提升**：后端处理效率更高

## 架构对比

### 旧架构（前端路由）
```
前端 → 传输完整配置JSON → 后端API → 返回结果
     ↓ (每次几十KB)
   前端执行Hook
```

### 新架构（后端路由）
```
前端 → 只传文件路径 → 后端路由API → 自动加载配置
                                    ↓
                              执行后端Hook
                                    ↓
                              返回处理结果
```

## 核心组件

### 1. Hook 管理器（`api/plugins/SmartTavern/hook_manager.py`）

负责管理所有 Hook 策略的注册、注销和执行。

```python
from api.plugins.SmartTavern import get_hook_manager

# 获取全局 Hook 管理器
hook_manager = get_hook_manager()

# 注册 Hook 策略
hook_manager.register_strategy(
    strategy_id="my_plugin",
    hooks_dict={
        "beforeRaw": my_before_raw_hook,
        "afterPostprocess": my_after_postprocess_hook,
    },
    order=100  # 优先级，越大越先执行
)

# 执行 Hook
result = await hook_manager.run_hooks('beforeRaw', data, ctx)
```

### 2. 插件加载器（`api/plugins/SmartTavern/plugin_loader.py`）

自动扫描并加载插件目录下的所有 Hook 脚本。

```python
from api.plugins.SmartTavern import initialize_plugins

# 初始化并加载所有插件
initialize_plugins(auto_load=True)
```

### 3. 路由 API（`api/workflow/smarttavern/prompt_router/router_api.py`）

提供统一的路由接口，只需传文件路径。

## Hook 点列表

### 提示词处理 Hook（11个）

这些 Hook 在 `route_with_hooks` 和 `complete_with_hooks` 中都会执行：

1. **beforeNormalizeAssets** - 资产归一化前
2. **afterNormalizeAssets** - 资产归一化后
3. **beforeRaw** - RAW 装配前
4. **afterInsert** - 插入后（过渡阶段）
5. **afterRaw** - RAW 装配后
6. **beforePostprocessUser** - 后处理前（user_view）
7. **afterPostprocessUser** - 后处理后（user_view）
8. **beforePostprocessAssistant** - 后处理前（assistant_view）
9. **afterPostprocessAssistant** - 后处理后（assistant_view）
10. **beforeVariablesSave** - 变量保存前
11. **afterVariablesSave** - 变量保存后

**注意**：后处理 Hook 按视图类型区分：
- `user_view`（前端显示）使用 `beforePostprocessUser` / `afterPostprocessUser`
- `assistant_view`（发送给AI）使用 `beforePostprocessAssistant` / `afterPostprocessAssistant`

### LLM 调用 Hook（4个）

这些 Hook 只在 `complete_with_hooks` 中执行，用于控制 AI 调用过程：

12. **beforeLLMCall** - LLM 调用前
    - 数据：`{messages: [...], llm_params: {...}}`
    - 可修改：发送给 AI 的消息、模型参数

13. **afterLLMCall** - LLM 调用后
    - 数据：`{content: "...", usage: {...}, finish_reason: "...", model_used: "..."}`
    - 可修改：AI 响应内容、用量信息

14. **beforeSaveResponse** - 保存响应前
    - 数据：`{node_id: "...", content: "...", parent_id: "...", is_update: bool}`
    - 可修改：保存的节点 ID、内容、父节点

15. **afterSaveResponse** - 保存响应后
    - 数据：`{node_id: "...", doc: {...}, usage: {...}, content: "..."}`
    - 用途：通知、后续处理、日志记录

### API 对比

| API | 提示词 Hook | LLM Hook | 总计 |
|-----|------------|----------|------|
| `route_with_hooks` | ✅ 11个 | ❌ | 11个 |
| `complete_with_hooks` | ✅ 11个 | ✅ 4个 | **15个** |

这样设计的好处：
- **代码复用**：LLM Hook 复用提示词 Hook，无需重复编写
- **职责清晰**：提示词处理和 LLM 调用分离
- **灵活控制**：插件可以在整个流程的任何阶段介入

## 插件开关管理

### 插件开关文件

所有插件的启用/禁用由 `plugins_switch.json` 控制：

```json
{
  "enabled": [
    "prompt-router",
    "context-variables",
    "my-plugin"
  ],
  "disabled": []
}
```

- **enabled**: 列表中的插件会在启动时自动加载
- **disabled**: 保留字段，暂未使用

### 启用/禁用插件

1. **编辑 `plugins_switch.json`**
   ```json
   {
     "enabled": [
       "prompt-router",
       "context-variables"
     ]
   }
   ```

2. **重启服务器或热重载**
   ```bash
   # 方法1：重启服务器（推荐）
   # 停止服务器并重新启动
   
   # 方法2：热重载
   curl -X POST http://localhost:8050/api/workflow/smarttavern/prompt_router/reload_plugins
   ```

### 自动加载

插件系统会在服务器启动时自动：
1. 读取 `plugins_switch.json`
2. 扫描 `backend_projects/SmartTavern/plugins/` 目录
3. 只加载 `enabled` 列表中的插件
4. 注册插件的所有 Hook

启动日志示例：
```
🔌 初始化后端插件系统...
✓ 从 plugins_switch.json 加载插件开关配置
启用的插件: {'prompt-router', 'context-variables'}
✓ 成功加载插件: context-variables
✓ 后端插件系统初始化完成，加载了 1 个插件
```

## 创建插件

### 步骤1：创建插件目录

在 `backend_projects/SmartTavern/plugins/` 下创建你的插件目录：

```
backend_projects/SmartTavern/plugins/
├── plugins_switch.json  （插件开关配置）
└── my-plugin/
    ├── manifest.json    （可选，用于前端）
    └── hooks.py         （必需，后端 Hook）
```

### 步骤2：编写 hooks.py

```python
# backend_projects/SmartTavern/plugins/my-plugin/hooks.py
import logging

logger = logging.getLogger(__name__)


async def my_before_raw_hook(data, ctx):
    """
    在 RAW 装配前执行的 Hook
    
    参数：
        data: 输入数据（历史消息数组）
        ctx: 上下文 {"conversationFile": "...", "view": "..."}
    
    返回：
        修改后的数据 或 None（不修改）
    """
    try:
        # 在这里处理数据
        logger.info(f"My Plugin Hook 执行: {len(data)} messages")
        
        # 返回修改后的数据
        return data
    
    except Exception as e:
        logger.error(f"Hook 执行失败: {e}")
        return None


async def my_after_postprocess_user_hook(data, ctx):
    """
    user_view 后处理后执行的 Hook
    
    参数：
        data: {messages: [...], rules: [...], variables: {...}}
        ctx: 上下文 {"conversationFile": "...", "view": "user_view"}
    """
    try:
        variables = data.get('variables', {})
        
        # 注入自定义变量（仅对 user_view）
        variables['my_plugin_user_processed'] = True
        
        return {
            'messages': data.get('messages'),
            'rules': data.get('rules'),
            'variables': variables
        }
    
    except Exception as e:
        logger.error(f"Hook 执行失败: {e}")
        return None


async def my_after_postprocess_assistant_hook(data, ctx):
    """
    assistant_view 后处理后执行的 Hook
    
    参数：
        data: {messages: [...], rules: [...], variables: {...}}
        ctx: 上下文 {"conversationFile": "...", "view": "assistant_view"}
    """
    try:
        # 可以针对 assistant_view 做不同的处理
        messages = data.get('messages', [])
        
        # 例如：在发送给AI前添加特殊标记
        logger.info(f"准备发送给AI的消息数量: {len(messages)}")
        
        return data
    
    except Exception as e:
        logger.error(f"Hook 执行失败: {e}")
        return None


def register_hooks(hook_manager):
    """
    注册插件的所有 Hook
    
    这个函数会在插件加载时自动调用
    
    参数：
        hook_manager: HookManager 实例
    
    返回：
        注册的策略 ID 列表（可选）
    """
    strategy_id = "my-plugin"
    
    # 注册 Hook 策略（可以为不同视图注册不同的处理）
    hook_manager.register_strategy(
        strategy_id=strategy_id,
        hooks_dict={
            'beforeRaw': my_before_raw_hook,
            'afterPostprocessUser': my_after_postprocess_user_hook,
            'afterPostprocessAssistant': my_after_postprocess_assistant_hook,
        },
        order=50  # 优先级：0-100，越大越先执行
    )
    
    logger.info(f"My Plugin 已注册后端 Hooks")
    
    return [strategy_id]


def unregister_hooks(hook_manager):
    """
    卸载插件的所有 Hook（可选）
    
    在插件重载或卸载时调用
    """
    hook_manager.unregister_strategy("my-plugin")
    logger.info(f"My Plugin 已卸载后端 Hooks")
```

### 步骤3：重新加载插件

插件会在服务器启动时自动加载。如果需要热重载：

**方法1：通过 API**
```bash
curl -X POST http://localhost:8050/api/workflow/smarttavern/prompt_router/reload_plugins
```

**方法2：通过前端**
```typescript
import RouterClient from '@/services/routerClient'

await RouterClient.reloadPlugins()
```

**方法3：通过 Python**
```python
from api.plugins.SmartTavern import get_plugin_loader

loader = get_plugin_loader()
loader.reload_plugin('my-plugin')  # 重载单个插件
# 或
loader.reload_all()  # 重载所有插件
```

## 使用新的路由 API

### 后端使用

```python
from api.workflow.smarttavern.prompt_router import router_api

# 处理视图（带 Hook 执行）
result = await router_api.route_with_hooks(
    conversation_file="/data/conversations/chat1.json",
    view="user_view",
    output="full"
)

# 返回：
# {
#   "success": True,
#   "messages": [...],
#   "variables": {...}
# }
```

### 前端使用

```typescript
import RouterClient from '@/services/routerClient'

// 新方法：使用后端路由（推荐）
const result = await RouterClient.routeWithHooksBackend({
  conversationFile: '/data/conversations/chat1.json',
  view: 'user_view',
  output: 'full'
})

// 旧方法：使用前端路由（兼容）
const result = await RouterClient.processMessagesView({
  conversationFile: '/data/conversations/chat1.json',
  view: 'user_view',
  output: 'full'
})
```

### API 端点

#### 1. 带 Hook 的视图处理
```
POST /api/workflow/smarttavern/prompt_router/route_with_hooks

请求体：
{
  "conversation_file": "/data/conversations/chat1.json",
  "view": "user_view",
  "output": "full"
}

响应：
{
  "success": true,
  "messages": [...],
  "variables": {...}
}
```

#### 2. 带 Hook 的 AI 调用
```
POST /api/workflow/smarttavern/prompt_router/complete_with_hooks

请求体：
{
  "conversation_file": "/data/conversations/chat1.json"
}

说明：
- llm_config 会从 conversation 对应的 settings.json 自动读取
- 无需手动传入任何配置文件路径
```

#### 3. 重新加载插件
```
POST /api/workflow/smarttavern/prompt_router/reload_plugins

响应：
{
  "success": true,
  "loaded_plugins": ["context-variables", "my-plugin"],
  "total": 2
}
```

#### 4. 列出已加载插件
```
POST /api/workflow/smarttavern/prompt_router/list_plugins

响应：
{
  "plugins": [
    {"plugin_id": "context-variables", "loaded": true, "error": null},
    {"plugin_id": "my-plugin", "loaded": true, "error": null}
  ],
  "total": 2
}
```

## Hook 数据格式

### beforeRaw / afterInsert
```python
# 输入：消息数组
data = [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi there"}
]

# 输出：修改后的消息数组 或 {"history": [...]}
```

### afterRaw
```python
# 输入：RAW 装配后的消息
data = [
    {"role": "system", "content": "...", "source": {...}},
    {"role": "user", "content": "...", "source": {...}}
]

# 输出：修改后的消息数组 或 {"messages": [...]}
```

### beforeNormalizeAssets / afterNormalizeAssets
```python
# 输入：资产对象
data = {
    "preset": {...},
    "world_books": {...},
    "character": {...},
    "regex_files": {...}
}

# 输出：修改后的资产对象（部分字段也可以）
```

### beforePostprocess / afterPostprocess
```python
# 输入：后处理对象
data = {
    "messages": [...],
    "rules": [...],
    "variables": {...}
}

# 输出：修改后的对象（部分字段也可以）
```

### beforeVariablesSave / afterVariablesSave
```python
# 输入：变量对象
data = {
    "var1": "value1",
    "var2": "value2"
}

# 输出：修改后的变量对象 或 {"finalVars": {...}}
```

## 最佳实践

### 1. 错误处理
```python
async def my_hook(data, ctx):
    try:
        # 处理逻辑
        return modified_data
    except Exception as e:
        logger.error(f"Hook 失败: {e}")
        return None  # 返回 None 表示不修改数据
```

### 2. 性能优化
```python
async def my_hook(data, ctx):
    # 避免不必要的深拷贝
    # 只修改需要修改的部分
    if should_process(ctx):
        return process(data)
    return None  # 不处理时返回 None
```

### 3. 优先级设置
```python
# 高优先级（先执行）
hook_manager.register_strategy("critical-plugin", hooks, order=100)

# 中等优先级
hook_manager.register_strategy("normal-plugin", hooks, order=50)

# 低优先级（后执行）
hook_manager.register_strategy("optional-plugin", hooks, order=10)
```

## 迁移指南

### 从前端 Hook 迁移到后端 Hook

1. **找到前端 Hook 代码**（在 `prompt-router.js` 或插件中）
2. **创建后端插件目录**
3. **编写 `hooks.py`**，将 JavaScript 逻辑转换为 Python
4. **测试验证**
5. **逐步迁移前端调用**到新的 `routeWithHooksBackend` 方法

## 故障排查

### 插件未加载
```bash
# 检查插件列表
curl -X POST http://localhost:8050/api/workflow/smarttavern/prompt_router/list_plugins

# 查看日志
tail -f logs/server.log | grep "Plugin"
```

### Hook 未执行
1. 确认插件已加载
2. 检查 Hook 函数名称是否正确
3. 查看日志中的错误信息
4. 确认 `register_hooks` 函数返回了策略 ID

### 性能问题
1. 检查 Hook 中是否有耗时操作
2. 使用 `async/await` 处理异步操作
3. 避免在 Hook 中进行大量 I/O 操作

## 示例插件

参考 `backend_projects/SmartTavern/plugins/context-variables/hooks.py` 作为示例。

## 下一步

- 阅读[插件与工作流开发指南](../../../frontend_projects/SmartTavern/docs/插件与工作流_开发指南.md)
- 查看 `api/plugins/SmartTavern/hook_manager.py` 了解更多细节
- 开始创建你的第一个后端插件！