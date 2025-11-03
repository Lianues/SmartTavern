# SmartTavern 工作流 API 参考

本文档提供 SmartTavern 前端工作流系统的完整 API 参考，包括所有可用的事件、方法和状态。

**版本**: 2.0  
**最后更新**: 2025-01-17

---

## 📚 目录

1. [Host API](#host-api)
2. [事件总线 API](#事件总线-api)
3. [标准事件通道](#标准事件通道)
   - [Chat 通道](#chat-通道)
   - [Message 通道](#message-通道)
   - [Completion 通道](#completion-通道)
   - [Branch 通道](#branch-通道)
   - [Catalog 通道](#catalog-通道)
   - [Settings 通道](#settings-通道)
4. [响应式状态](#响应式状态)
5. [EventSource API](#eventsource-api)
6. [类型定义](#类型定义)

---

## Host API

**模块**: [`host.js`](frontend_projects/SmartTavern/src/workflow/core/host.js:1)

Host 是工作流系统的核心对象，提供稳定的 JavaScript API 供插件使用。

### 初始化

#### `Host.init(options)`

初始化 Host 对象，可选择是否暴露到全局 window。

**参数**:
- `options.exposeToWindow` (boolean, 默认: true) - 是否将 Host 暴露为 `window.STHost`

**返回**: Host 对象

**示例**:
```javascript
Host.init({ exposeToWindow: true })
// 现在可以在控制台访问 window.STHost
```

### UI 插槽管理

#### `Host.registerHomeButton(entry)`

注册开始页按钮到 HomeMenu。

**参数**:
- `entry` (Object) - 按钮配置对象
  - `id` (string, 必填) - 唯一标识符
  - `label` (string, 必填) - 显示文本
  - `actionId` (string, 必填) - 点击时触发的事件 ID
  - `icon` (string, 可选) - Lucide 图标名
  - `order` (number, 可选) - 排序值（越小越靠上）
  - `params` (Object, 可选) - 事件参数
  - `tooltip` (string, 可选) - 工具提示
  - `visibleWhen` (Function, 可选) - 可见性判断函数
  - `disabledWhen` (Function, 可选) - 禁用判断函数

**返回**: 注册的按钮 ID

**示例**:
```javascript
Host.registerHomeButton({
  id: 'my-action',
  label: '自定义操作',
  actionId: 'ui.home.custom',
  icon: 'star',
  order: 100
})
```

#### `Host.unregisterHomeButton(id)`

移除已注册的开始页按钮。

**参数**:
- `id` (string) - 按钮 ID

**返回**: 是否成功移除

#### `Host.listHomeButtons(context)`

列出所有注册的开始页按钮。

**参数**:
- `context` (Object, 可选) - 上下文信息（用于 visibleWhen/disabledWhen 判断）

**返回**: 按钮数组

### 消息与提示

#### `Host.appendMessage(message)`

追加一条消息到消息队列（用于工作流回显）。

**参数**:
- `message` (Object) - 消息对象
  - `role` (string) - 角色 ('user'/'assistant'/'system')
  - `content` (string) - 消息内容
  - `timestamp` (number, 可选) - 时间戳

**示例**:
```javascript
Host.appendMessage({
  role: 'system',
  content: '工作流执行完成'
})
```

#### `Host.pushToast(toast)`

显示一个 Toast 提示。

**参数**:
- `toast` (Object) - Toast 配置
  - `type` (string) - 类型 ('info'/'success'/'warning'/'error')
  - `message` (string) - 提示内容
  - `duration` (number, 可选, 默认: 3000) - 显示时长（毫秒）

**示例**:
```javascript
Host.pushToast({
  type: 'success',
  message: '操作成功',
  duration: 2000
})
```

### 状态访问

#### `Host.state`

只读属性，提供聚合的状态快照。

**返回**: 包含以下字段的对象
- `messages` - 消息列表
- `toasts` - Toast 列表
- `slots.homeMenu` - HomeMenu 按钮列表

**示例**:
```javascript
console.log(Host.state.messages) // 查看消息队列
console.log(Host.state.slots.homeMenu) // 查看按钮列表
```

---

## 事件总线 API

**模块**: [`events.js`](frontend_projects/SmartTavern/src/workflow/core/events.js:1)

事件总线提供发布-订阅模式的事件通信。

### `Host.events.on(eventName, handler)`

订阅事件。

**参数**:
- `eventName` (string) - 事件名称（支持通配符 '*' 监听所有事件）
- `handler` (Function) - 事件处理函数

**返回**: 取消订阅函数

**示例**:
```javascript
const unsubscribe = Host.events.on('workflow.message.send.success', (payload) => {
  console.log('消息发送成功:', payload)
})

// 取消订阅
unsubscribe()
```

### `Host.events.once(eventName, handler)`

订阅事件（仅触发一次后自动取消）。

**参数**: 同 `on`

**返回**: 取消订阅函数

### `Host.events.off(eventName, handler)`

取消订阅。

**参数**:
- `eventName` (string) - 事件名称
- `handler` (Function) - 之前注册的处理函数

### `Host.events.emit(eventName, payload)`

发布事件。

**参数**:
- `eventName` (string) - 事件名称
- `payload` (any) - 事件负载

**示例**:
```javascript
Host.events.emit('workflow.message.send.request', {
  conversationFile: '/data/conversations/222.json',
  role: 'user',
  content: 'Hello!'
})
```

### `Host.events.clear(eventName?)`

清除事件监听器。

**参数**:
- `eventName` (string, 可选) - 事件名称（省略则清除所有监听器）

### `Host.events.listenerCount(eventName)`

获取事件的监听器数量。

**参数**:
- `eventName` (string) - 事件名称

**返回**: 监听器数量

---

## 标准事件通道

### Chat 通道

**模块**: [`chat.js`](frontend_projects/SmartTavern/src/workflow/channels/chat.js:1)

对话创建和加载相关事件。

#### 事件列表

| 事件常量 | 事件名 | 说明 |
|---------|--------|------|
| `EVT_OPEN_NEW_CHAT` | `ui.modal.openNewChat` | 打开新建对话模态框 |
| `EVT_OPEN_LOAD` | `ui.modal.openLoad` | 打开加载存档模态框 |
| `EVT_CHAT_CREATE_REQ` | `workflow.chat.create.request` | 请求创建对话 |
| `EVT_CHAT_CREATE_OK` | `workflow.chat.create.success` | 创建对话成功 |
| `EVT_CHAT_CREATE_FAIL` | `workflow.chat.create.failure` | 创建对话失败 |
| `EVT_CHAT_LOAD_REQ` | `workflow.chat.load.request` | 请求加载对话 |
| `EVT_CHAT_LOAD_OK` | `workflow.chat.load.success` | 加载对话成功 |
| `EVT_CHAT_LOAD_FAIL` | `workflow.chat.load.failure` | 加载对话失败 |

#### 事件负载

**CREATE_REQ**:
```typescript
{
  type?: 'threaded' | 'sandbox',
  meta?: any,
  source?: EventSource
}
```

**CREATE_OK**:
```typescript
{
  file?: string,
  doc?: any,
  meta?: any,
  source?: EventSource
}
```

**LOAD_REQ**:
```typescript
{
  file?: string,  // 省略则打开选择模态框
  source?: EventSource
}
```

**LOAD_OK**:
```typescript
{
  file: string,
  doc?: any,
  meta?: any,
  source?: EventSource
}
```

---

### Message 通道

**模块**: [`message.js`](frontend_projects/SmartTavern/src/workflow/channels/message.js:1)

消息发送和编辑相关事件。

#### 事件列表

| 事件常量 | 事件名 | 说明 |
|---------|--------|------|
| `EVT_MESSAGE_SEND_REQ` | `workflow.message.send.request` | 请求发送消息 |
| `EVT_MESSAGE_SEND_OK` | `workflow.message.send.success` | 发送消息成功 |
| `EVT_MESSAGE_SEND_FAIL` | `workflow.message.send.failure` | 发送消息失败 |
| `EVT_MESSAGE_EDIT_REQ` | `workflow.message.edit.request` | 请求编辑消息 |
| `EVT_MESSAGE_EDIT_OK` | `workflow.message.edit.success` | 编辑消息成功 |
| `EVT_MESSAGE_EDIT_FAIL` | `workflow.message.edit.failure` | 编辑消息失败 |

#### 事件负载

**SEND_REQ**:
```typescript
{
  conversationFile: string,
  parentId: string,
  nodeId?: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  tag?: string,
  source?: EventSource
}
```

**SEND_OK**:
```typescript
{
  conversationFile: string,
  nodeId: string,
  role: string,
  content: string,
  message?: any,
  doc?: any,
  tag?: string,
  source?: EventSource
}
```

**EDIT_REQ**:
```typescript
{
  conversationFile: string,
  nodeId: string,
  content: string,
  tag?: string,
  source?: EventSource
}
```

---

### Completion 通道

**模块**: [`completion.js`](frontend_projects/SmartTavern/src/workflow/channels/completion.js:1)

AI 补全相关事件。

#### 事件列表

| 事件常量 | 事件名 | 说明 |
|---------|--------|------|
| `EVT_COMPLETION_REQ` | `workflow.completion.request` | 请求 AI 补全 |
| `EVT_COMPLETION_CHUNK` | `workflow.completion.chunk` | 接收流式内容片段 |
| `EVT_COMPLETION_FINISH` | `workflow.completion.finish` | 补全完成（流式） |
| `EVT_COMPLETION_USAGE` | `workflow.completion.usage` | Token 使用统计 |
| `EVT_COMPLETION_SAVED` | `workflow.completion.saved` | 补全内容已保存 |
| `EVT_COMPLETION_ERROR` | `workflow.completion.error` | 补全出错 |
| `EVT_COMPLETION_END` | `workflow.completion.end` | 补全流程结束 |
| `EVT_COMPLETION_ABORT` | `workflow.completion.abort` | 请求中止补全 |
| `EVT_COMPLETION_ABORTED` | `workflow.completion.aborted` | 补全已中止 |

#### 事件负载

**REQ**:
```typescript
{
  conversationFile: string,
  llmConfigFile?: string,
  mode?: 'auto' | 'stream' | 'single',
  tag?: string,
  source?: EventSource
}
```

**CHUNK**:
```typescript
{
  conversationFile: string,
  content: string,
  tag?: string,
  source?: EventSource
}
```

**SAVED**:
```typescript
{
  conversationFile: string,
  node_id: string,
  doc: any,
  content?: string,
  usage?: any,
  tag?: string,
  source?: EventSource
}
```

---

### Branch 通道

**模块**: [`branch.js`](frontend_projects/SmartTavern/src/workflow/channels/branch.js:1)

分支操作相关事件。

#### 事件列表

| 事件常量 | 事件名 | 说明 |
|---------|--------|------|
| `EVT_BRANCH_TABLE_REQ` | `workflow.branch.table.request` | 请求分支表 |
| `EVT_BRANCH_TABLE_OK` | `workflow.branch.table.success` | 获取分支表成功 |
| `EVT_BRANCH_TABLE_FAIL` | `workflow.branch.table.failure` | 获取分支表失败 |
| `EVT_BRANCH_SWITCH_REQ` | `workflow.branch.switch.request` | 请求切换分支 |
| `EVT_BRANCH_SWITCH_OK` | `workflow.branch.switch.success` | 切换分支成功 |
| `EVT_BRANCH_SWITCH_FAIL` | `workflow.branch.switch.failure` | 切换分支失败 |
| `EVT_BRANCH_DELETE_REQ` | `workflow.branch.delete.request` | 请求删除分支 |
| `EVT_BRANCH_DELETE_OK` | `workflow.branch.delete.success` | 删除分支成功 |
| `EVT_BRANCH_DELETE_FAIL` | `workflow.branch.delete.failure` | 删除分支失败 |
| `EVT_BRANCH_RETRY_ASSIST_REQ` | `workflow.branch.retry.assistant.request` | 请求重试助手消息 |
| `EVT_BRANCH_RETRY_ASSIST_OK` | `workflow.branch.retry.assistant.success` | 重试助手消息成功 |
| `EVT_BRANCH_RETRY_ASSIST_FAIL` | `workflow.branch.retry.assistant.failure` | 重试助手消息失败 |
| `EVT_BRANCH_RETRY_USER_REQ` | `workflow.branch.retry.user.request` | 请求重试用户消息 |
| `EVT_BRANCH_RETRY_USER_OK` | `workflow.branch.retry.user.success` | 重试用户消息成功 |
| `EVT_BRANCH_RETRY_USER_FAIL` | `workflow.branch.retry.user.failure` | 重试用户消息失败 |
| `EVT_BRANCH_TRUNCATE_REQ` | `workflow.branch.truncate.request` | 请求修剪分支 |
| `EVT_BRANCH_TRUNCATE_OK` | `workflow.branch.truncate.success` | 修剪分支成功 |
| `EVT_BRANCH_TRUNCATE_FAIL` | `workflow.branch.truncate.failure` | 修剪分支失败 |

#### 事件负载示例

**TABLE_REQ**:
```typescript
{
  conversationFile: string,
  tag?: string,
  source?: EventSource
}
```

**SWITCH_REQ**:
```typescript
{
  conversationFile: string,
  targetJ: number,
  tag?: string,
  source?: EventSource
}
```

**DELETE_REQ**:
```typescript
{
  conversationFile: string,
  nodeId: string,
  tag?: string,
  source?: EventSource
}
```

---

### Catalog 通道

**模块**: [`catalog.js`](frontend_projects/SmartTavern/src/workflow/channels/catalog.js:1)

数据目录查询相关事件。

#### 事件列表

| 事件常量 | 事件名 | 说明 |
|---------|--------|------|
| `EVT_CATALOG_CHARACTERS_REQ` | `catalog:characters:req` | 请求角色列表 |
| `EVT_CATALOG_CHARACTERS_RES` | `catalog:characters:res` | 返回角色列表 |
| `EVT_CATALOG_PERSONAS_REQ` | `catalog:personas:req` | 请求人设列表 |
| `EVT_CATALOG_PERSONAS_RES` | `catalog:personas:res` | 返回人设列表 |
| `EVT_CATALOG_PRESETS_REQ` | `catalog:presets:req` | 请求预设列表 |
| `EVT_CATALOG_PRESETS_RES` | `catalog:presets:res` | 返回预设列表 |
| `EVT_CATALOG_WORLDBOOKS_REQ` | `catalog:worldbooks:req` | 请求世界书列表 |
| `EVT_CATALOG_WORLDBOOKS_RES` | `catalog:worldbooks:res` | 返回世界书列表 |
| `EVT_CATALOG_REGEX_REQ` | `catalog:regex:req` | 请求正则规则列表 |
| `EVT_CATALOG_REGEX_RES` | `catalog:regex:res` | 返回正则规则列表 |
| `EVT_CATALOG_LLMCONFIGS_REQ` | `catalog:llmconfigs:req` | 请求 LLM 配置列表 |
| `EVT_CATALOG_LLMCONFIGS_RES` | `catalog:llmconfigs:res` | 返回 LLM 配置列表 |

#### 响应式状态

Catalog 通道提供以下响应式状态（Vue ref）：

| 状态 | 类型 | 说明 |
|-----|------|------|
| `characters` | `Ref<Array>` | 角色列表缓存 |
| `personas` | `Ref<Array>` | 人设列表缓存 |
| `presets` | `Ref<Array>` | 预设列表缓存 |
| `worldbooks` | `Ref<Array>` | 世界书列表缓存 |
| `regexRules` | `Ref<Array>` | 正则规则列表缓存 |
| `llmConfigs` | `Ref<Array>` | LLM 配置列表缓存 |
| `loadingStates` | `Ref<Object>` | 加载状态映射 |
| `errorStates` | `Ref<Object>` | 错误状态映射 |

#### 辅助函数

| 函数 | 说明 |
|------|------|
| `resetCatalogState(type)` | 重置指定类型的缓存和状态 |
| `clearAllCatalog()` | 清空所有缓存和状态 |

---

### Settings 通道

**模块**: [`settings.js`](frontend_projects/SmartTavern/src/workflow/channels/settings.js:1)

对话设置管理相关事件。

#### 事件列表

| 事件常量 | 事件名 | 说明 |
|---------|--------|------|
| `EVT_SETTINGS_GET_REQ` | `settings:get:req` | 请求获取设置 |
| `EVT_SETTINGS_GET_RES` | `settings:get:res` | 返回设置数据 |
| `EVT_SETTINGS_UPDATE_REQ` | `settings:update:req` | 请求更新设置 |
| `EVT_SETTINGS_UPDATE_RES` | `settings:update:res` | 返回更新结果 |

#### 事件负载

**GET_REQ**:
```typescript
{
  conversationFile: string,
  requestId?: number,
  source?: EventSource
}
```

**GET_RES**:
```typescript
{
  conversationFile: string,
  success: boolean,
  settings?: any,
  error?: string,
  requestId?: number,
  source?: EventSource
}
```

**UPDATE_REQ**:
```typescript
{
  conversationFile: string,
  patch: object,
  requestId?: number,
  source?: EventSource
}
```

#### 响应式状态

| 状态 | 类型 | 说明 |
|-----|------|------|
| `settingsCache` | `Ref<Object>` | 设置缓存 { [conversationFile]: settings } |
| `loadingStates` | `Ref<Object>` | 加载状态 { [conversationFile]: boolean } |
| `errorStates` | `Ref<Object>` | 错误状态 { [conversationFile]: string } |

#### 辅助函数

| 函数 | 说明 |
|------|------|
| `getSettings(conversationFile)` | 获取指定对话的设置 |
| `getSettingField(conversationFile, field)` | 获取指定字段 |
| `updateSettingsCache(conversationFile, settings)` | 更新缓存 |
| `clearSettingsCache(conversationFile)` | 清除指定对话的缓存 |
| `clearAllSettings()` | 清空所有缓存 |
| `isLoading(conversationFile)` | 检查加载状态 |
| `setLoading(conversationFile, loading)` | 设置加载状态 |
| `getError(conversationFile)` | 获取错误状态 |
| `setError(conversationFile, error)` | 设置错误状态 |

---

## 响应式状态

### Pinia Stores

工作流系统使用 Pinia 管理响应式状态。

#### HomeMenu Store

**模块**: [`homeMenu.js`](frontend_projects/SmartTavern/src/stores/workflow/homeMenu.js:1)

**状态**:
- `items` - 按钮列表

**方法**:
- `register(entry)` - 注册按钮
- `unregister(id)` - 移除按钮
- `list(context)` - 列出按钮

#### Messages Store

**模块**: [`messages.js`](frontend_projects/SmartTavern/src/stores/workflow/messages.js:1)

**状态**:
- `list` - 消息列表

**方法**:
- `append(message)` - 追加消息
- `clear()` - 清空消息

#### Toasts Store

**模块**: [`toasts.js`](frontend_projects/SmartTavern/src/stores/workflow/toasts.js:1)

**状态**:
- `list` - Toast 列表

**方法**:
- `push(toast)` - 添加 Toast
- `remove(id)` - 移除 Toast

---

## EventSource API

**模块**: [`eventSource.js`](frontend_projects/SmartTavern/src/workflow/core/eventSource.js:1)

EventSource 提供事件来源追踪功能。

### 类型定义

```typescript
interface EventSource {
  componentId?: string        // 组件实例 ID
  componentType?: string      // 组件类型
  viewType?: string           // 视图类型
  intentType?: string         // 操作意图
  userId?: string             // 用户 ID
  sessionId?: string          // 会话 ID
  workflowId?: string         // 工作流 ID
  priority?: 'high' | 'normal' | 'low'
  batchId?: string            // 批次 ID
  parentEventId?: string      // 父级事件 ID
  metadata?: Record<string, any>
}
```

### 函数

#### `createEventSource(componentType, options)`

创建标准 EventSource 对象。

**参数**:
- `componentType` (string) - 组件类型
- `options` (Object, 可选) - 其他选项

**返回**: EventSource 对象

#### `matchesSource(source, criteria)`

检查 source 是否匹配条件。

**参数**:
- `source` (EventSource) - 待检查的 source
- `criteria` (Object) - 匹配条件

**返回**: boolean

#### `summarizeSource(source)`

提取可读摘要。

**参数**:
- `source` (EventSource) - EventSource 对象

**返回**: string

#### `isFromView(source, viewType)`

检查是否来自特定视图。

**参数**:
- `source` (EventSource)
- `viewType` (string)

**返回**: boolean

#### `hasIntent(source, intentType)`

检查是否具有特定意图。

**参数**:
- `source` (EventSource)
- `intentType` (string)

**返回**: boolean

#### `isFromComponent(source, componentType)`

检查是否来自特定组件。

**参数**:
- `source` (EventSource)
- `componentType` (string)

**返回**: boolean

#### `isHighPriority(source)`

检查是否为高优先级。

**参数**:
- `source` (EventSource)

**返回**: boolean

#### `extendSource(source, extensions)`

克隆并扩展 EventSource。

**参数**:
- `source` (EventSource) - 原始 source
- `extensions` (Object) - 要添加/覆盖的字段

**返回**: EventSource

#### `withSource(payload, source)`

为事件负载添加 source。

**参数**:
- `payload` (Object) - 原始负载
- `source` (EventSource) - EventSource 对象

**返回**: 包含 source 的负载

### 预定义常量

#### ViewType

```javascript
{
  THREADED: 'threaded',
  SANDBOX: 'sandbox',
  START: 'start',
  GALLERY: 'gallery'
}
```

#### IntentType

```javascript
{
  SEND: 'send',
  RETRY: 'retry',
  EDIT: 'edit',
  DELETE: 'delete',
  SWITCH: 'switch',
  CREATE: 'create',
  LOAD: 'load',
  BATCH: 'batch',
  AUTO: 'auto'
}
```

#### Priority

```javascript
{
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'low'
}
```

---

## 类型定义

完整的 TypeScript 类型定义请参考：

- [`eventSource.d.ts`](frontend_projects/SmartTavern/src/workflow/core/eventSource.d.ts:1) - EventSource 接口
- [`contract.d.ts`](frontend_projects/SmartTavern/src/workflow/slots/homeMenu/contract.d.ts:1) - HomeMenu 按钮契约

---

## 快速参考

### 常用事件发送示例

```javascript
// 发送消息
Host.events.emit('workflow.message.send.request', {
  conversationFile,
  parentId,
  role: 'user',
  content: 'Hello!',
  source: { componentType: 'MyComponent' }
})

// 请求 AI 补全
Host.events.emit('workflow.completion.request', {
  conversationFile,
  tag: 'my-task',
  source: { priority: 'high' }
})

// 切换分支
Host.events.emit('workflow.branch.switch.request', {
  conversationFile,
  targetJ: 1,
  source: { intentType: 'switch' }
})

// 获取角色列表
Host.events.emit('catalog:characters:req', {
  requestId: Date.now(),
  source: { componentType: 'CharactersPanel' }
})
```

### 常用监听器示例

```javascript
// 监听消息发送成功
Host.events.on('workflow.message.send.success', (payload) => {
  console.log('消息已发送:', payload.content)
})

// 监听补全片段
Host.events.on('workflow.completion.chunk', (payload) => {
  console.log('新内容:', payload.content)
})

// 监听所有事件
Host.events.on('*', (eventName, payload) => {
  console.log(`事件: ${eventName}`, payload)
})
```

---

## 版本历史

- **2.0** (2025-01-17)
  - 新增 EventSource 标准规范
  - 新增 Catalog 和 Settings 通道
  - 完善 Branch 通道
  - 添加响应式状态说明

- **1.0** (2024-12-01)
  - 初始版本
  - 基础事件通道（Chat, Message, Completion）

---

## 相关文档

- [插件与工作流开发指南](./插件与工作流_开发指南.md) - 完整的开发指南
- [EventSource 类型定义](../src/workflow/core/eventSource.d.ts) - TypeScript 类型定义
- [示例工作流](../public/workflows/) - 工作流示例代码