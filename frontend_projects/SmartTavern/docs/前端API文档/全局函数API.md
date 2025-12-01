# 全局函数API

## 角色卡头像 API

### getCharAvatarPath

获取当前角色卡头像URL。

```typescript
function getCharAvatarPath(): string
```

**返回值：**
- `string` - 头像 URL（总是返回 URL 或默认头像 data:URL）

**示例：**
```javascript
// 获取当前角色卡头像（总是有返回值）
const avatar = getCharAvatarPath()
document.querySelector('#avatar').src = avatar
```

---

## 用户画像头像 API

### getPersonaAvatarPath

获取当前用户画像头像URL。

```typescript
function getPersonaAvatarPath(): string
```

**返回值：**
- `string` - 头像 URL（总是返回 URL 或默认头像 data:URL）

**示例：**
```javascript
// 获取当前用户画像头像（总是有返回值）
const avatar = getPersonaAvatarPath()
document.querySelector('#user-avatar').src = avatar
```

---

## 角色卡状态 API

### getChar

获取当前角色卡的完整状态或指定字段。

```typescript
function getChar(key?: string): any
```

**参数：**
- `key?: string` - 可选，要获取的字段路径（支持嵌套，如 `'meta.name'`）

**返回值：**
- 不传参数：返回当前角色卡完整状态对象
- 传入 key：返回当前角色卡对应字段的值，不存在则返回 `undefined`

**状态对象结构：**
```typescript
{
  currentCharacterFile: string | null,  // 角色卡文件路径
  avatarUrl: string | null,             // 头像 URL
  iconUrl: string | null,               // 图标 URL
  meta: object | null,                  // character.json 内容
  loading: boolean,
  error: string
}
```

**示例：**
```javascript
// 获取当前角色卡完整状态
const state = getChar()
console.log(state.avatarUrl)

// 获取当前角色卡指定字段
const name = getChar('meta.name')
const avatar = getChar('avatarUrl')

// 获取嵌套字段
const charName = getChar('meta.character_name')
```

---

## 用户画像状态 API

### getPersona

获取当前用户画像的完整状态或指定字段。

```typescript
function getPersona(key?: string): any
```

**参数：**
- `key?: string` - 可选，要获取的字段路径（支持嵌套，如 `'meta.persona_name'`）

**返回值：**
- 不传参数：返回当前用户画像完整状态对象
- 传入 key：返回当前用户画像对应字段的值，不存在则返回 `undefined`

**状态对象结构：**
```typescript
{
  currentPersonaFile: string | null,  // 用户画像文件路径
  avatarUrl: string | null,           // 头像 URL
  meta: object | null,                // persona.json 内容
  loading: boolean,
  error: string
}
```

**示例：**
```javascript
// 获取当前用户画像完整状态
const state = getPersona()
console.log(state.avatarUrl)

// 获取当前用户画像指定字段
const name = getPersona('meta.persona_name')
const avatar = getPersona('avatarUrl')
```

---

## 预设状态 API

### getPreset

获取当前预设的完整状态或指定字段。

```typescript
function getPreset(key?: string): any
```

**参数：**
- `key?: string` - 可选，要获取的字段路径（支持嵌套）

**返回值：**
- 不传参数：返回当前预设完整状态对象
- 传入 key：返回当前预设对应字段的值，不存在则返回 `undefined`

**状态对象结构：**
```typescript
{
  currentPresetFile: string | null,  // 预设文件路径
  meta: object | null,               // preset.json 内容
  loading: boolean,
  error: string
}
```

**示例：**
```javascript
// 获取当前预设完整状态
const state = getPreset()
console.log(state.meta)

// 获取当前预设指定字段
const name = getPreset('meta.name')
const temperature = getPreset('meta.temperature')
```

---

## 世界书列表 API

### getWorldBooks

获取当前世界书列表的完整状态或指定字段。

```typescript
function getWorldBooks(key?: string): any
```

**参数：**
- `key?: string` - 可选，要获取的字段路径

**返回值：**
- 不传参数：返回当前世界书列表完整状态对象
- 传入 key：返回对应字段的值，不存在则返回 `undefined`

**状态对象结构：**
```typescript
{
  currentWorldBookFiles: string[],    // 世界书文件路径数组
  metas: { [file: string]: object },  // 世界书元数据字典
  loading: boolean,
  error: string
}
```

**示例：**
```javascript
// 获取当前世界书列表完整状态
const state = getWorldBooks()
console.log(state.currentWorldBookFiles)  // 文件路径数组
console.log(state.metas)                  // 元数据字典

// 获取世界书文件路径列表
const files = getWorldBooks('currentWorldBookFiles')

// 获取所有世界书元数据
const metas = getWorldBooks('metas')

// 遍历所有世界书
const worldBooks = getWorldBooks()
worldBooks.currentWorldBookFiles.forEach(file => {
  const meta = worldBooks.metas[file]
  console.log(`世界书: ${file}`, meta)
})
```

---

## 正则规则列表 API

### getRegexRules

获取当前正则规则列表的完整状态或指定字段。

```typescript
function getRegexRules(key?: string): any
```

**参数：**
- `key?: string` - 可选，要获取的字段路径

**返回值：**
- 不传参数：返回当前正则规则列表完整状态对象
- 传入 key：返回对应字段的值，不存在则返回 `undefined`

**状态对象结构：**
```typescript
{
  currentRegexRuleFiles: string[],    // 正则规则文件路径数组
  metas: { [file: string]: object },  // 正则规则元数据字典
  loading: boolean,
  error: string
}
```

**示例：**
```javascript
// 获取当前正则规则列表完整状态
const state = getRegexRules()
console.log(state.currentRegexRuleFiles)  // 文件路径数组
console.log(state.metas)                  // 元数据字典

// 获取正则规则文件路径列表
const files = getRegexRules('currentRegexRuleFiles')

// 获取所有正则规则元数据
const metas = getRegexRules('metas')

// 遍历所有正则规则
const regexRules = getRegexRules()
regexRules.currentRegexRuleFiles.forEach(file => {
  const meta = regexRules.metas[file]
  console.log(`规则: ${file}`, meta)
})
```

---

## 变量访问 API

### getVariable

获取当前对话的单个变量值。

```typescript
function getVariable(key: string): Promise<any>
```

**参数：**
- `key: string` - 变量路径，支持三种格式：
  - 点表示法：`"user.name"`
  - 方括号表示法：`"user['name']"` 或 `"['user']['name']"`
  - 数组索引：`"items[0].id"`

**返回值：**
- `any` - 变量值，不存在则返回 `undefined`

**示例：**
```javascript
// 点表示法
const userName = await getVariable('user.name');

// 方括号表示法
const userAge = await getVariable("user['age']");

// 数组索引
const firstItemId = await getVariable('items[0].id');

// 嵌套路径
const deepValue = await getVariable('data.config.settings.theme');
```

---

### getVariables

获取当前对话的多个变量值。

```typescript
function getVariables(...keys: string[]): Promise<object>
```

**参数：**
- `...keys: string[]` - 变量路径列表

**返回值：**
- `object` - 变量字典，键为路径，值为对应的变量值

**示例：**
```javascript
// 获取多个变量
const vars = await getVariables('user.name', 'user.age', 'items[0].id');
console.log(vars);
// {
//   'user.name': 'Alice',
//   'user.age': 25,
//   'items[0].id': 'item-001'
// }

// 不存在的键返回 undefined
const vars2 = await getVariables('user.name', 'nonexistent.key');
console.log(vars2);
// {
//   'user.name': 'Alice',
//   'nonexistent.key': undefined
// }
```

---

### getVariableJSON

获取变量路径对应的 JSON 值（不传则返回整个变量对象）。路径不存在时返回 `undefined`。

```typescript
function getVariableJSON(key?: string): Promise<any>
```

**参数：**
- `key?: string` - 可选，变量路径；支持 `a.b`, `a['b']`, `arr[0]` 等混合写法

**返回值：**
- `any` - 当路径对应对象/数组时返回对象/数组；对应基本类型则返回该值；不传则返回整个变量对象；路径不存在返回 `undefined`

**示例：**
```javascript
// 获取整个变量对象
const allVars = await getVariableJSON()

// 获取嵌套对象
const stats = await getVariableJSON('stat_overrides.心')

// 获取数组
const positions = await getVariableJSON('心.当前位置')

// 获取数组元素
const firstPos = await getVariableJSON('心.当前位置[0]')
```

---

## LLM 配置 API

### getLlmConfig

获取当前对话使用的 LLM 配置。

```typescript
function getLlmConfig(): object | null
```

**返回值：**
- `object | null` - LLM 配置对象，如果未加载则返回 null

**示例：**
```javascript
const config = getLlmConfig()
console.log(config)
// {
//   provider: 'openai',
//   api_key: 'sk-...',
//   base_url: 'https://api.openai.com/v1',
//   model: 'gpt-4',
//   temperature: 0.7,
//   max_tokens: 2048,
//   ...
// }
```

---

### getLlmConfigField

获取当前 LLM 配置的特定字段。

```typescript
function getLlmConfigField(key: string): any
```

**参数：**
- `key: string` - 配置字段名（如 'provider', 'model', 'temperature'）

**返回值：**
- `any` - 字段值，如果不存在返回 undefined

**示例：**
```javascript
const provider = getLlmConfigField('provider')  // 'openai'
const model = getLlmConfigField('model')        // 'gpt-4'
const temp = getLlmConfigField('temperature')   // 0.7
```

---

## AI 聊天补全 API

### chatCompletion

使用自定义参数直接调用 LLM API 进行聊天补全。

```typescript
function chatCompletion(params: {
  provider: 'openai' | 'anthropic' | 'gemini' | 'openai_compatible',
  api_key: string,
  base_url: string,
  messages: Array<{role: string, content: string}>,
  model: string,
  stream?: boolean,
  max_tokens?: number,
  temperature?: number,
  top_p?: number,
  custom_params?: object
}): Promise<object | EventSource>
```

**参数：**
- `provider: string` - **必需**，API 提供商，只能是以下之一：
  - `'openai'` - OpenAI
  - `'anthropic'` - Anthropic (Claude)
  - `'gemini'` - Google Gemini
  - `'openai_compatible'` - OpenAI 兼容格式
- `api_key: string` - **必需**，API 密钥（可以为空字符串 `""`）
- `base_url: string` - **必需**，API 基础 URL
- `messages: Array` - **必需**，消息数组，每个消息必须包含 `role` 和 `content`
- `model: string` - **必需**，模型名称
- `stream: boolean` - 可选，是否流式返回（默认 `false`）
- `max_tokens: number` - 可选，最大 token 数
- `temperature: number` - 可选，温度参数（0-2）
- `top_p: number` - 可选，top_p 参数（0-1）
- `custom_params: object` - 可选，自定义参数对象，会直接合并到请求体中

**返回值：**
- 非流式（`stream: false`）：`Promise<object>` - 包含 `{success, content, usage, ...}`
- 流式（`stream: true`）：`Promise<EventSource>` - 类似 EventSource 的流式对象

**示例：**
```javascript
// 非流式调用
const result = await chatCompletion({
  provider: 'openai',
  api_key: 'sk-...',
  base_url: 'https://api.openai.com/v1',
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ],
  temperature: 0.7,
  max_tokens: 1000,
  custom_params: {
    frequency_penalty: 0.5,
    presence_penalty: 0.5,
    stop: ["\n\n"]
  }
})
console.log(result.content)

// 流式调用
const eventSource = await chatCompletion({
  provider: 'openai',
  api_key: 'sk-...',
  base_url: 'https://api.openai.com/v1',
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Tell me a story' }],
  stream: true
})

eventSource.addEventListener('message', (e) => {
  const data = JSON.parse(e.data)
  if (data.type === 'chunk') {
    console.log(data.content)
  } else if (data.type === 'end') {
    eventSource.close()
  }
})
```

---

### chatCompletionWithCurrentConfig

使用当前对话的 LLM 配置进行聊天补全。

```typescript
function chatCompletionWithCurrentConfig(params: {
  messages: Array<{role: string, content: string}>,
  stream?: boolean,
  custom_params?: object
}): Promise<object | EventSource>
```

**参数：**
- `messages: Array` - **必需**，消息数组，每个消息必须包含 `role` 和 `content`
- `stream: boolean` - 可选，是否流式返回。不提供则使用配置文件的值
- `custom_params: object` - 可选，自定义参数对象，会覆盖配置文件的 `custom_params`

**返回值：**
- 非流式（`stream: false`）：`Promise<object>` - 包含 `{success, content, usage, ...}`
- 流式（`stream: true`）：`Promise<EventSource>` - 类似 EventSource 的流式对象

**注意：**
- 必须先加载对话才能使用此函数
- 会自动使用当前对话的 LLM 配置（provider, api_key, model, temperature 等）
- 可选参数（`stream`, `custom_params`）如果提供，会覆盖配置文件的对应值

**示例：**
```javascript
// 基本调用（使用配置文件的所有值）
const result = await chatCompletionWithCurrentConfig({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum physics simply.' }
  ]
})
console.log(result.content)

// 覆盖流式设置
const result2 = await chatCompletionWithCurrentConfig({
  messages: [{ role: 'user', content: 'Quick question' }],
  stream: false
})

// 覆盖自定义参数
const result3 = await chatCompletionWithCurrentConfig({
  messages: [{ role: 'user', content: 'Tell me a story' }],
  custom_params: {
    max_tokens: 5000,
    stop: ["\n\n"]
  }
})

// 流式调用
const eventSource = await chatCompletionWithCurrentConfig({
  messages: [{ role: 'user', content: 'Write a poem about nature.' }],
  stream: true
})

let fullText = ''
eventSource.addEventListener('message', (e) => {
  const data = JSON.parse(e.data)
  
  switch(data.type) {
    case 'chunk':
      fullText += data.content
      console.log(data.content)
      break
      
    case 'finish':
      console.log('Finish reason:', data.finish_reason)
      break
      
    case 'usage':
      console.log('Token usage:', data.usage)
      break
      
    case 'error':
      console.error('Error:', data.message)
      break
      
    case 'end':
      console.log('Stream ended. Full text:', fullText)
      eventSource.close()
      break
  }
})
```

**流式事件类型：**
- `chunk` - 文本块，包含 `content` 字段
- `finish` - 完成标志，包含 `finish_reason` 字段
- `usage` - Token 使用统计，包含 `usage` 对象
- `error` - 错误信息，包含 `message` 字段
- `end` - 流结束标志

---

## 提示词处理 API

### assemblePrompt

使用自定义参数进行提示词装配（RAW：prefix + in-chat）。

```typescript
function assemblePrompt(params: {
  presets: object,
  history: Array<{role: string, content: string}>,
  world_books?: Array | object,
  character?: object,
  persona?: object,
  variables?: object
}): Promise<{messages: Array}>
```

**参数：**
- `presets: object` - **必需**，预设文档对象，包含 prompts 数组
- `history: Array` - **必需**，OpenAI Chat messages 数组 [{role, content}]
- `world_books: Array|object` - 可选，世界书条目数组/嵌套数组/对象
- `character: object` - 可选，角色文档对象
- `persona: object` - 可选，用户画像文档对象
- `variables: object` - 可选，变量对象

**返回值：**
- `Promise<{messages: Array}>` - 包含完整提示词数组的对象，每条结构 {role, content, source}

**示例：**
```javascript
const result = await assemblePrompt({
  presets: { prompts: [...] },
  history: [
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: 'Hi there!' }
  ],
  world_books: [...],
  character: { meta: {...}, world_book: {...} },
  persona: { meta: {...} },
  variables: { name: 'Alice', location: 'Shanghai' }
})
console.log(result.messages)
```

---

### assemblePromptWithCurrentConfig

使用当前对话配置进行提示词装配。

```typescript
function assemblePromptWithCurrentConfig(params: {
  history: Array<{role: string, content: string}>
}): Promise<{messages: Array}>
```

**参数：**
- `history: Array` - **必需**，OpenAI Chat messages 数组 [{role, content}]

**返回值：**
- `Promise<{messages: Array}>` - 包含完整提示词数组的对象

**注意：**
- 必须先加载对话才能使用此函数
- 会自动从当前配置读取 preset、world_books、character、persona、variables

**示例：**
```javascript
// 只需提供 history，其他配置自动读取
const result = await assemblePromptWithCurrentConfig({
  history: [
    { role: 'user', content: 'Hello!' },
    { role: 'assistant', content: 'Hi there!' }
  ]
})
console.log(result.messages)
```

---

### postprocessPrompt

使用自定义参数进行提示词后处理（单视图：正则 + 宏）。

```typescript
function postprocessPrompt(params: {
  messages: Array<{role: string, content: string}>,
  regex_rules: Array | object,
  view: 'user_view' | 'assistant_view',
  variables?: object
}): Promise<{message: Array, variables: object}>
```

**参数：**
- `messages: Array` - **必需**，OpenAI Chat 消息数组
- `regex_rules: Array|object` - **必需**，正则规则（数组或 {"regex_rules":[...]}）
- `view: string` - **必需**，视图选择，只能是以下之一：
  - `'user_view'` - 用户视图
  - `'assistant_view'` - 助手视图
- `variables: object` - 可选，变量对象

**返回值：**
- `Promise<{message: Array, variables: object}>` - 包含处理后的消息和变量状态

**示例：**
```javascript
const result = await postprocessPrompt({
  messages: [
    { role: 'user', content: 'Hello {{name}}!' }
  ],
  regex_rules: [
    { pattern: '...', replacement: '...' }
  ],
  view: 'user_view',
  variables: { name: 'Alice' }
})
console.log(result.message)      // 处理后的消息
console.log(result.variables)    // 变量状态 {initial, final}
```

---

### postprocessPromptWithCurrentConfig

使用当前对话配置进行提示词后处理。

```typescript
function postprocessPromptWithCurrentConfig(params: {
  messages: Array<{role: string, content: string}>,
  view: 'user_view' | 'assistant_view'
}): Promise<{message: Array, variables: object}>
```

**参数：**
- `messages: Array` - **必需**，OpenAI Chat 消息数组
- `view: string` - **必需**，视图选择 ('user_view' | 'assistant_view')

**返回值：**
- `Promise<{message: Array, variables: object}>` - 包含处理后的消息和变量状态

**注意：**
- 必须先加载对话才能使用此函数
- 会自动从当前配置读取 regex_rules 和 variables

**示例：**
```javascript
// 只需提供 messages 和 view，其他配置自动读取
const result = await postprocessPromptWithCurrentConfig({
  messages: [
    { role: 'user', content: 'Hello {{name}}!' }
  ],
  view: 'user_view'
})
console.log(result.message)
console.log(result.variables.final)  // 最终变量状态
```

---

### setVariable

设置当前对话的单个变量值。

```typescript
function setVariable(key: string, value: any): Promise<void>
```

**参数：**
- `key: string` - 变量路径
- `value: any` - 要设置的值

**返回值：**
- `Promise<void>` - 设置完成后的 Promise

**示例：**
```javascript
// 设置简单值
await setVariable('user.name', 'Alice');

// 设置对象
await setVariable('user.profile', { age: 25, city: 'Shanghai' });

// 设置数组元素
await setVariable('items[0].quantity', 10);

// 如果路径不存在，会自动创建
await setVariable('newObject.newField', 'value');
```

---

### setVariables

批量设置当前对话的变量值。

```typescript
function setVariables(data: object): Promise<void>
```

**参数：**
- `data: object` - 变量字典，键为路径，值为对应的变量值

**返回值：**
- `Promise<void>` - 设置完成后的 Promise

**示例：**
```javascript
// 批量设置多个变量
await setVariables({
  'user.name': 'Bob',
  'user.age': 30,
  'config.theme': 'dark'
});

// 设置复杂结构
await setVariables({
  'game.player.health': 100,
  'game.player.position': { x: 10, y: 20 },
  'game.level': 5
});
```

---

### deleteVariable

删除当前对话的单个变量。

```typescript
function deleteVariable(key: string): Promise<void>
```

**参数：**
- `key: string` - 变量路径

**返回值：**
- `Promise<void>` - 删除完成后的 Promise

**示例：**
```javascript
// 删除简单变量
await deleteVariable('user.tempData');

// 删除嵌套变量
await deleteVariable('config.cache.outdated');

// 删除数组元素
await deleteVariable('items[2]');
```

---

### deleteVariables

批量删除当前对话的变量。

```typescript
function deleteVariables(keys: string[]): Promise<void>
```

**参数：**
- `keys: string[]` - 变量路径数组

**返回值：**
- `Promise<void>` - 删除完成后的 Promise

**示例：**
```javascript
// 批量删除多个变量
await deleteVariables([
  'user.tempData',
  'cache.oldValue',
  'debug.log'
]);

// 删除数组元素
await deleteVariables(['items[0]', 'items[1]']);
```

**注意事项：**
1. **路径自动创建**：设置时，如果路径不存在会自动创建
2. **保留其他变量**：只更新/删除指定的变量，其他变量保持不变
3. **智能合并**：设置使用 `merge`，删除使用 `set` 全量保存
4. **自动缓存更新**：操作后自动更新前端缓存

---

## 选项面板 API

### showOptions

显示选项面板，支持单选、多选、不定项三种类型。

```typescript
function showOptions(config: {
  type: 'single' | 'multiple' | 'any',
  title?: string,
  subtitle?: string,
  message?: string,
  options: Array<string | {label: string, value: any}>
}): Promise<any>
```

**参数：**
- `type: string` - **必需**，选项类型：
  - `'single'` - 单选（点击即确认）
  - `'multiple'` - 多选（需点击确定按钮）
  - `'any'` - 不定项（允许选0个或多个）
- `title?: string` - 可选，标题
- `subtitle?: string` - 可选，副标题
- `message?: string` - 可选，内容说明
- `options: Array` - **必需**，选项数组
  - 字符串数组：`['选项1', '选项2']`
  - 对象数组：`[{label: '显示文本', value: '实际值'}]`

**返回值：**
- 单选（`type: 'single'`）：`Promise<any>` - 用户选择的单个值
- 多选/不定项（`type: 'multiple'` | `'any'`）：`Promise<Array>` - 用户选择的值数组
- 取消：Promise 被 reject

**示例：**
```javascript
// 单选
const choice = await showOptions({
  type: 'single',
  title: '选择难度',
  message: '请选择游戏难度等级',
  options: ['简单', '普通', '困难', '地狱']
})
console.log(choice) // '普通'

// 多选
const choices = await showOptions({
  type: 'multiple',
  title: '选择装备',
  subtitle: '可以选择多个',
  options: [
    { label: '长剑', value: 'sword' },
    { label: '盾牌', value: 'shield' },
    { label: '药水', value: 'potion' }
  ]
})
console.log(choices) // ['sword', 'shield']

// 不定项（允许不选）
const tags = await showOptions({
  type: 'any',
  title: '添加标签',
  message: '选择标签（可选0个或多个）',
  options: ['冒险', '战斗', '探索', '剧情']
})
console.log(tags) // [] 或 ['冒险', '战斗']

// 处理取消
try {
  const result = await showOptions({
    type: 'single',
    title: '确认操作',
    options: ['确定', '取消']
  })
  console.log('用户选择:', result)
} catch (e) {
  console.log('用户取消了选择')
}
```

---

### showOptions.single

显示单选面板（快捷方法）。

```typescript
function showOptions.single(config: {
  title?: string,
  subtitle?: string,
  message?: string,
  options: Array<string | {label: string, value: any}>
}): Promise<any>
```

**参数：** 同 showOptions，但 type 自动设为 `'single'`

**示例：**
```javascript
const difficulty = await showOptions.single({
  title: '选择难度',
  options: ['简单', '普通', '困难']
})
```

---

### showOptions.multiple

显示多选面板（快捷方法）。

```typescript
function showOptions.multiple(config: {
  title?: string,
  subtitle?: string,
  message?: string,
  options: Array<string | {label: string, value: any}>
}): Promise<Array>
```

**参数：** 同 showOptions，但 type 自动设为 `'multiple'`

**示例：**
```javascript
const equipment = await showOptions.multiple({
  title: '选择装备',
  options: ['武器', '防具', '道具']
})
```

---

### showOptions.any

显示不定项面板（快捷方法）。

```typescript
function showOptions.any(config: {
  title?: string,
  subtitle?: string,
  message?: string,
  options: Array<string | {label: string, value: any}>
}): Promise<Array>
```

**参数：** 同 showOptions，但 type 自动设为 `'any'`

**示例：**
```javascript
const tags = await showOptions.any({
  title: '添加标签',
  message: '可选可不选',
  options: ['标签1', '标签2', '标签3']
})
```

**选项类型说明：**

| 类型 | 行为 | 返回值 | 适用场景 |
|------|------|--------|---------|
| `single` | 点击即确认 | 单个值 | 单选题、确认对话框 |
| `multiple` | 需点击确定 | 值数组 | 多选题、批量选择 |
| `any` | 需点击确定 | 值数组（可为空） | 可选标签、筛选条件 |

**使用建议：**
1. **单选**：用于必须选择一项的场景，如难度选择、确认操作
2. **多选**：用于至少选择一项的场景，如装备选择、功能开关
3. **不定项**：用于可选可不选的场景，如标签添加、筛选条件

---

## Toast 提示 API

### showToast

显示 Toast 提示消息。

```typescript
function showToast(
  options: string | {
    type?: 'info' | 'success' | 'warning' | 'error',
    message: string,
    timeout?: number
  }
): object | null
```

**参数：**
- `options: string | object` - 消息内容或配置对象
  - 字符串：直接作为消息内容，类型默认为 `'info'`
  - 对象：
    - `type?: string` - 提示类型（`'info'` | `'success'` | `'warning'` | `'error'`），默认 `'info'`
    - `message: string` - **必需**，消息内容
    - `timeout?: number` - 显示时长（毫秒），默认 4000ms，设为 0 则不自动关闭

**返回值：**
- `object | null` - Toast 对象（包含 id 等信息），失败返回 null

**示例：**
```javascript
// 字符串快捷方式（默认 info 类型）
showToast('操作完成');

// 完整配置
showToast({
  type: 'success',
  message: '保存成功！',
  timeout: 3000
});

// 错误提示
showToast({
  type: 'error',
  message: '操作失败，请重试',
  timeout: 5000
});

// 不自动关闭
showToast({
  type: 'warning',
  message: '重要提示：请确认操作',
  timeout: 0
});
```

---

### showToast.success

显示成功提示（快捷方法）。

```typescript
function showToast.success(message: string, timeout?: number): object | null
```

**参数：**
- `message: string` - **必需**，消息内容
- `timeout?: number` - 可选，显示时长（毫秒）

**示例：**
```javascript
showToast.success('操作成功！');
showToast.success('数据已保存', 3000);
```

---

### showToast.error

显示错误提示（快捷方法）。

```typescript
function showToast.error(message: string, timeout?: number): object | null
```

**参数：**
- `message: string` - **必需**，消息内容
- `timeout?: number` - 可选，显示时长（毫秒）

**示例：**
```javascript
showToast.error('操作失败');
showToast.error('网络连接超时', 5000);
```

---

### showToast.warning

显示警告提示（快捷方法）。

```typescript
function showToast.warning(message: string, timeout?: number): object | null
```

**参数：**
- `message: string` - **必需**，消息内容
- `timeout?: number` - 可选，显示时长（毫秒）

**示例：**
```javascript
showToast.warning('请注意检查输入');
showToast.warning('即将超时', 3000);
```

---

### showToast.info

显示信息提示（快捷方法）。

```typescript
function showToast.info(message: string, timeout?: number): object | null
```

**参数：**
- `message: string` - **必需**，消息内容
- `timeout?: number` - 可选，显示时长（毫秒）

**示例：**
```javascript
showToast.info('正在处理请求...');
showToast.info('已添加到队列', 2000);
```

**Toast 类型说明：**

| 类型 | 颜色 | 适用场景 |
|------|------|---------|
| `success` | 绿色 | 操作成功、保存完成、提交成功 |
| `error` | 红色 | 操作失败、错误信息、异常提示 |
| `warning` | 橙色 | 警告信息、注意事项、确认提示 |
| `info` | 蓝色 | 一般信息、状态更新、提示说明 |

**使用建议：**
1. **简洁明了**：消息内容应简短清晰，一般不超过 20 字
2. **及时反馈**：在用户操作后立即显示，增强交互体验
3. **适当时长**：成功/信息类 2-3 秒，警告类 3-4 秒，错误类 4-5 秒
4. **避免滥用**：不要同时显示过多 Toast，会影响用户体验

---

## 带 Router Hook 的提示词处理和 AI 调用 API

### routePromptWithHooks

使用后端路由处理提示词（带完整 Hook 执行）。

```typescript
function routePromptWithHooks(params?: {
  conversation_file?: string,
  view?: 'user_view' | 'assistant_view',
  output?: 'full' | 'partial'
}): Promise<{messages: Array, variables?: object}>
```

**参数：**
- `conversation_file?: string` - 可选，对话文件路径。不传则自动使用当前加载的对话文件
- `view?: string` - 可选，视图选择 ('user_view' | 'assistant_view')，默认 'user_view'
- `output?: string` - 可选，输出模式 ('full' | 'partial')，默认 'full'

**返回值：**
- `Promise<{messages: Array, variables?: {initial, final}}>` - 处理后的消息数组和变量状态

**Hook 执行顺序：**
该函数会执行所有提示词处理 Hook（11个Hook点）：
- beforeAssemble → afterAssemble
- beforeInChat → afterInChat
- beforePostprocessUser → afterPostprocessUser（user_view）
- beforePostprocessAssistant → afterPostprocessAssistant（assistant_view）

**与 assemblePrompt/postprocessPrompt 的区别：**
- `assemblePrompt/postprocessPrompt` - 底层 RAW API，无 Hook 执行，需要手动传入完整配置
- `routePromptWithHooks` - 高层 Router API，带完整 Hook 执行，只传文件路径（或使用当前对话），后端自动读取配置

**示例：**
```javascript
// 使用指定对话文件
const result = await routePromptWithHooks({
  conversation_file: 'data/conversations/my-chat/conversation.json',
  view: 'user_view'
})

// 使用当前对话文件（最常用）
const result2 = await routePromptWithHooks({
  view: 'assistant_view'
})

// 简化调用（使用所有默认参数）
const result3 = await routePromptWithHooks()
```

---

### completeWithHooks

使用后端路由进行 AI 调用（带完整 Hook 执行）。

```typescript
function completeWithHooks(params?: {
  conversation_file?: string,
  stream?: boolean
}): Promise<object | EventSource>
```

**参数：**
- `conversation_file?: string` - 可选，对话文件路径。不传则自动使用当前加载的对话文件
- `stream?: boolean` - 可选，是否流式返回（默认 false）

**返回值：**
- 非流式（`stream: false`）：`Promise<{success, content, usage, ...}>`
- 流式（`stream: true`）：`Promise<EventSource>` - 类似 EventSource 的流式对象

**Hook 执行顺序：**
该函数会执行所有提示词处理 Hook（11个）+ 所有 LLM Hook（4个），共15个Hook点：
- **提示词 Hook（11个）**：beforeAssemble → afterAssemble → beforeInChat → afterInChat → beforePostprocessUser → afterPostprocessUser → beforePostprocessAssistant → afterPostprocessAssistant
- **LLM Hook（4个）**：beforeLLMCall → afterLLMCall → beforeStreamChunk → afterStreamChunk

**与 chatCompletion 的区别：**
- `chatCompletion/chatCompletionWithCurrentConfig` - 底层 RAW API，无 Hook 执行，需要手动传入配置和消息
- `completeWithHooks` - 高层 Router API，带完整 Hook 执行（15个Hook），只传文件路径（或使用当前对话），后端自动处理一切

**示例：**
```javascript
// 使用指定对话文件（非流式）
const result = await completeWithHooks({
  conversation_file: 'data/conversations/my-chat/conversation.json'
})
console.log(result.content)

// 使用当前对话文件（最常用）
const result2 = await completeWithHooks()

// 流式调用
const eventSource = await completeWithHooks({ stream: true })

let fullText = ''
eventSource.addEventListener('message', (e) => {
  const data = JSON.parse(e.data)
  
  switch(data.type) {
    case 'chunk':
      fullText += data.content
      console.log(data.content)
      break
      
    case 'finish':
      console.log('Finish reason:', data.finish_reason)
      break
      
    case 'usage':
      console.log('Token usage:', data.usage)
      break
      
    case 'error':
      console.error('Error:', data.message)
      break
      
    case 'end':
      console.log('Stream ended. Full text:', fullText)
      eventSource.close()
      break
  }
})
```

**API 层级说明：**

| API 类型 | 函数 | Hook 执行 | 配置传输 | 适用场景 |
|---------|------|----------|---------|---------|
| **底层 RAW API** | assemblePrompt<br>postprocessPrompt<br>chatCompletion | 无 Hook | 需要手动传入完整配置 JSON | 需要完全自定义控制，绕过 Hook 系统 |
| **高层 Router API** | routePromptWithHooks<br>completeWithHooks | 完整 Hook（11-15个） | 只传文件路径，后端自动读取 | 推荐使用，网络传输少，自动执行插件 Hook |

**推荐使用 Router API 的理由：**
1. **网络传输优化** - 只传文件路径（几十字节）而非完整配置（几十KB）
2. **自动 Hook 执行** - 所有插件 Hook 在后端统一执行，无需前端管理
3. **热插拔支持** - 插件可以通过 `plugins_switch.json` 动态启用/禁用
4. **统一管理** - Hook 逻辑集中在后端，便于维护和调试

---

## 工作流事件总线

### HostEvents.emit

在沙盒内发送工作流事件到父窗口。

```typescript
interface HostEvents {
  emit(eventName: string, data?: any): void
}
```

**参数：**
- `eventName: string` - 事件名称
- `data: any` - 事件数据（可选）

**返回值：** 无

**示例：**
```javascript
HostEvents.emit('custom.event', { message: 'Hello' });
```

---

### HostEvents.on

在沙盒内监听父窗口的工作流事件。

```typescript
interface HostEvents {
  on(eventName: string, handler: Function): Function
}
```

**参数：**
- `eventName: string` - 事件名称
- `handler: Function` - 事件处理函数

**返回值：**
- `Function` - 取消监听的函数

**示例：**
```javascript
const off = HostEvents.on('message.received', (data) => {
  console.log('Message:', data);
});
// 取消监听
off();
```

---

## 沙盒工具对象

### STSandbox

沙盒环境专用的便捷工具对象，集成所有桥接 API。

```typescript
interface STSandbox {
  // 角色卡头像 API
  getCharAvatarPath(): string
  
  // 用户画像头像 API
  getPersonaAvatarPath(): string
  
  // 角色卡状态 API
  getChar(key?: string): any
  
  // 用户画像状态 API
  getPersona(key?: string): any
  
  // 预设状态 API
  getPreset(key?: string): any
  
  // 世界书列表 API
  getWorldBooks(key?: string): any
  
  // 正则规则列表 API
  getRegexRules(key?: string): any
  
  // 变量访问 API
  getVariable(key: string): Promise<any>
  getVariables(...keys: string[]): Promise<object>
  getVariableJSON(key?: string): Promise<any>
  setVariable(key: string, value: any): Promise<void>
  setVariables(data: object): Promise<void>
  deleteVariable(key: string): Promise<void>
  deleteVariables(keys: string[]): Promise<void>
  
  // LLM 配置 API
  getLlmConfig(): object | null
  getLlmConfigField(key: string): any
  
  // AI 聊天补全 API
  chatCompletion(params: ChatCompletionParams): Promise<object | EventSource>
  chatCompletionWithCurrentConfig(params: ChatCompletionWithConfigParams): Promise<object | EventSource>
  
  // 工作流事件总线
  HostEvents: {
    emit(eventName: string, data?: any): void
    on(eventName: string, handler: Function): Function
  }
  
  version: string
}
```

**说明：**

STSandbox 对象在沙盒 HTML 中自动可用，提供统一的 API 访问入口。

**示例：**
```javascript
// 获取头像
const charAvatar = STSandbox.getCharAvatarPath();
const personaAvatar = STSandbox.getPersonaAvatarPath();

// 获取状态
const charState = STSandbox.getChar();
const charName = STSandbox.getChar('meta.name');
const personaState = STSandbox.getPersona();
const personaName = STSandbox.getPersona('meta.persona_name');

// 获取预设
const preset = STSandbox.getPreset();
const presetName = STSandbox.getPreset('meta.name');

// 获取世界书列表
const worldBooks = STSandbox.getWorldBooks();
const worldBookFiles = STSandbox.getWorldBooks('currentWorldBookFiles');
const worldBookMetas = STSandbox.getWorldBooks('metas');

// 获取正则规则列表
const regexRules = STSandbox.getRegexRules();
const regexRuleFiles = STSandbox.getRegexRules('currentRegexRuleFiles');
const regexRuleMetas = STSandbox.getRegexRules('metas');

// 获取变量
const userName = await STSandbox.getVariable('user.name');
const multiVars = await STSandbox.getVariables('user.name', 'user.age');
const allVars = await STSandbox.getVariableJSON();

// 设置变量
await STSandbox.setVariable('user.level', 5);
await STSandbox.setVariables({
  'user.score': 100,
  'game.status': 'playing'
});

// 删除变量
await STSandbox.deleteVariable('user.tempData');
await STSandbox.deleteVariables(['cache.old', 'debug.log']);

// LLM 配置
const config = STSandbox.getLlmConfig();
const model = STSandbox.getLlmConfigField('model');

// AI 聊天补全（使用当前配置）
const result = await STSandbox.chatCompletionWithCurrentConfig({
  messages: [{ role: 'user', content: 'Hello!' }]
});
console.log(result.content);

// 监听事件
STSandbox.HostEvents.on('chat.updated', (data) => {
  console.log('Chat updated:', data);
});

// 查看版本
console.log('Sandbox API version:', STSandbox.version);
```

---

## 使用环境

这些函数在以下环境中可用：

1. **Vue 组件内**：直接调用函数
2. **沙盒 HTML 内**：通过桥接自动可用，无需 `parent` 前缀；推荐使用 `STSandbox` 对象
3. **插件脚本内**：通过 `window` 全局对象访问

## API 设计原则

1. **默认当前**：所有函数默认操作当前对话/角色/用户画像/预设/世界书/正则规则
2. **语义清晰**：get/set/delete 三种操作
3. **一致性**：所有获取函数采用相同的模式和返回值结构
4. **简洁性**：移除不必要的参数，专注当前状态的获取