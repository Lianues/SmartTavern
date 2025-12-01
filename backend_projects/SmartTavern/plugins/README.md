# SmartTavern 后端工作流/插件系统 — 开发与使用指南

本指南面向希望在 SmartTavern 体系中开发“工作流/插件”的工程师，特别是需要在提示词处理链（RAW 前/后、资产合并、后处理、变量保存）中插入自定义策略的开发者。本文覆盖两条开发路径、加载与路由机制、Hooks（侵入点）模型、策略注册与执行顺序，以及完整的示例与最佳实践。

—

## 总览

- 插件加载来源（后端优先）
  - 工作流脚本位于：`backend_projects/SmartTavern/plugins/**/`.js
  - 前端启动时递归扫描并加载后端脚本，后端可覆盖前端固定脚本
  - 加载逻辑入口：[javascript.function(loadWorkflows)](frontend_projects/SmartTavern/src/main.js:111)

新增（2025-10）：统一后端地址配置（前端读取约定）

- 前端统一变量：仅使用 VITE_API_BASE（定义于 [filename](frontend_projects/SmartTavern/.env)），并在运行时优先读取 localStorage('st.backend_base') 与 window.ST_BACKEND_BASE。
- 插件 JS 发起后端调用时，请不要直接使用 window.location.origin 作为后端地址，改用如下解析：
  ```js
  const base =
    (typeof window !== 'undefined' && (window.ST_BACKEND_BASE || localStorage.getItem('st.backend_base'))) ||
    ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ? import.meta.env.VITE_API_BASE : 'http://localhost:8050');
  // 示例：调用插件后端 API
  const res = await fetch(`${base}/api/plugins/smarttavern/example_backend/info`, { method: 'GET' }).then(r => r.json());
  ```
  参考实现：[filename](backend_projects/SmartTavern/plugins/example-backend-client/index.js)
- CORS 与 WebSocket：
  - 若前后端跨域部署，请在后端启用 CORS 并允许前端来源。
  - WebSocket 地址基于同一 base（http→ws），如 `${base.replace('http','ws')}/ws`（见 [filename](frontend_projects/ProjectManager/js/api.js)）。

- 路由器统一入口（仅保留两条动作）
  - 自动补全：`completion.auto`（是否走流式由 LLM 配置 `detail.stream` 自动判定）
    - 统一动作实现：[javascript.function(routerProvider.call)](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:428)
  - 视图处理：`prompt.process_view`
    - 调用链路（完整处理 + Hooks）：[javascript.function(routeProcessView)](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:262)

- 新增（2025-10）：插件资产读取 + 原生相对导入
  - 后端资产读取 API：
    - 实现：[python.function(get_plugins_asset_impl)](api/modules/SmartTavern/data_catalog/impl.py:1116)
    - 对外注册：[python.function(get_plugins_asset)](api/modules/SmartTavern/data_catalog/data_catalog.py:990)
  - 前端 Loader 自动改写相对导入：
    - 入口：\[javascript.function(loadBackendWorkflow)](frontend_projects/SmartTavern/src/workflow/loader.js:212)
    - 在入口 JS 内对非 .js/.mjs/.cjs 的相对导入（如 .png/.jpg/.svg/.json）自动生成“导出资源 URL 字符串”的 JS 模块，并替换原导入。
  - 使用范式：
    ```js
    // 图片/二进制
    import logoUrl from './assets/logo.png'
    img.src = logoUrl

    // JSON：返回 URL，再 fetch 解析
    const cfgUrl = (await import('./config.json')).default
    const cfg = await fetch(cfgUrl).then(r => r.json())
    ```
  - 边界与安全：
    - 仅允许“同插件文件夹内”的相对路径（./ 或 ../）；跨插件相对导入将被拒绝。
    - 所有生成的 Blob URL 在卸载插件时由 Loader 统一 revoke，避免泄漏。

- 提示词策略挂载（Hooks 管理器）
  - Hooks 模块（集中管理更细侵入点 & 执行顺序）：[`javascript.module(Hooks)`](backend_projects/SmartTavern/plugins/prompt-router/hooks.js:1)
  - 可用 Hook：
    - beforeNormalizeAssets / afterNormalizeAssets
    - beforeRaw / afterInsert / afterRaw
    - beforePostprocess / afterPostprocess
    - beforeVariablesSave / afterVariablesSave
  - 执行顺序（同一 Hook 内）：
    1) order 降序（越大越先）[javascript.function(sortHooks)](backend_projects/SmartTavern/plugins/prompt-router/hooks.js:62)
    2) id 字母序（稳定一致）[javascript.function(sortHooks)](backend_projects/SmartTavern/plugins/prompt-router/hooks.js:62)
    3) 注册序 seq（先注册先执行）[javascript.declaration(registry item)](backend_projects/SmartTavern/plugins/prompt-router/hooks.js:54), [javascript.function(registerStrategy → push)](backend_projects/SmartTavern/plugins/prompt-router/hooks.js:82)

—

## 两条开发路径

### 1) 通用独立插件（工作流模块）

- 形式：在后端目录新增独立 JS 文件，默认导出 `activate(host)`，插件内部可自行维护事件、UI、桥接等逻辑。
- 用途：通用功能（非提示词链路）、UI 扩展、数据桥接。
- 加载与运行：
  - 后端工作流清单与详情 API（递归扫描）：[python.function(list_workflows_impl)](api/modules/SmartTavern/data_catalog/impl.py:851), [python.function(get_workflow_detail_impl)](api/modules/SmartTavern/data_catalog/impl.py:926)
  - 前端启动时加载：[`javascript.function(loadWorkflows)`](frontend_projects/SmartTavern/src/main.js:111)
  - Loader 白名单（允许 blob:/data:）：[`javascript.function(isAllowed)`](frontend_projects/SmartTavern/src/workflow/loader.js:37)

代码骨架（最小可运行）：
```js
// backend_projects/SmartTavern/plugins/my-plugin/index.js
export default function activate(host) {
  // 订阅自定义事件或扩展 UI/桥接
  const off = host.events.on('my.feature.trigger', payload => {
    host.pushToast?.({ type: 'success', message: '触发成功', timeout: 1500 })
    // ... your logic
  })
  // 清理函数：卸载时撤销事件
  return () => { try { off?.() } catch (_) {} }
}
```

### 2) 提示词后处理策略插件（建议路径）

- 形式：在独立插件 JS 内构造“策略对象”并注册到路由器 Hooks（统一事件），无需修改主路由器文件。
- 注册/注销事件（由插件触发，路由器转发到 Hooks）：
  - 注册：`host.events.emit('prompt.router.strategy.register', strategy)` → [`javascript.function(Hooks.registerStrategy)`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:33)
  - 注销：`host.events.emit('prompt.router.strategy.unregister', strategy.id)` → [`javascript.function(Hooks.unregisterStrategy)`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:38)

策略对象结构（JS 实例形态，直接拷贝使用）：
```js
// 在 activate(host) 中构造并注册策略对象（按需提供函数）
const strategy = {
  id: 'my.router.strategy',    // 建议唯一，用于去重/注销
  order: 80,                   // 权重（降序，越大越先；默认 0）

  // 资产阶段（返回全部或部分字段；未返回的字段保持原值）
  beforeNormalizeAssets(assets, ctx) {
    // assets: { preset, world_books, character, regex_files }
    // 可对 assets 做预处理/注入规则
    return { preset: assets.preset, world_books: assets.world_books, character: assets.character, regex_files: assets.regex_files }
  },
  afterNormalizeAssets(assets, ctx) {
    // 可对归一化后的资产做二次整理；不修改返回 null
    return null
  },

  // RAW 阶段（可返回 Array 或 { history } / { messages }）
  beforeRaw(history, ctx) {
    // history: Array<{ role, content, ... }>
    const out = Array.isArray(history) ? history.map(m => ({ role: String(m.role||'').toLowerCase(), content: String(m.content||'').trim() })) : []
    return { history: out }
  },
  afterInsert(history, ctx) {
    // RAW 前后过渡阶段微调
    return null
  },
  afterRaw(messages, ctx) {
    // RAW 装配后的消息：Array<{ role, content, source?, ... }>
    const out = Array.isArray(messages) ? messages.filter(m => String(m?.content||'').trim().length > 0) : []
    return { messages: out }
  },

  // 后处理阶段（统一调整消息/规则/变量；可返回部分字段）
  beforePostprocess(payload, ctx) {
    // payload: { messages, rules, variables }
    return { messages: payload.messages, rules: payload.rules, variables: payload.variables }
  },
  afterPostprocess(payload, ctx) {
    // 例如：打标记、收集统计
    return null
  },

  // 变量阶段（可返回对象或 { finalVars }）
  beforeVariablesSave(finalVars, ctx) {
    // 可新增标记或时间戳
    const v = Object.assign({}, finalVars||{})
    v.last_save_ts = Date.now()
    return v // 或者：return { finalVars: v }
  },
  afterVariablesSave(finalVars, ctx) {
    // 例如：提示或上报
    return null
  },
}

// 注册/卸载（路由器主文件转发到 Hooks 管理器）
host.events.emit('prompt.router.strategy.register', strategy)
return () => host.events.emit('prompt.router.strategy.unregister', strategy.id)
```

快速上手（无需阅读内部源码）
- 步骤 1：在后端数据目录创建插件文件夹与入口 JS 文件：
  - 例如：[`filename`](backend_projects/SmartTavern/plugins/my-plugin/index.js)
- 步骤 2：在入口中导出 `activate(host)`，构造并注册策略对象（如上 JS 形态）。
- 步骤 3：使用严格清单声明要加载的 JS 文件（manifest-only）：
  - 示例清单：[`filename`](backend_projects/SmartTavern/plugins/example-manifest-bundle/manifest.json)
- 步骤 4：启动应用，前端 Loader 会按清单逐项加载并调用 activate(host)：
  - 加载入口：[`javascript.function(loadWorkflows)`](frontend_projects/SmartTavern/src/main.js:111)
  - 动态加载 API：[`javascript.function(load)`](frontend_projects/SmartTavern/src/workflow/loader.js:72)
- 步骤 5：验证与调试
  - 打开控制台观察 `Host.pushToast` 的提示，或在窗口中调用 `window.loader.list()` 查看加载状态
  - 查看 Hooks 执行点与顺序：[`javascript.Hooks`](backend_projects/SmartTavern/plugins/prompt-router/hooks.js:1)

—

## Hooks 数据契约与返回规范

- beforeRaw / afterInsert
  - 输入：`history:Array<{role,content,...}>`
  - 返回：`Array` 或 `{ history:Array }`

- afterRaw
  - 输入：`messages:Array<{role,content,source?,...}>`（来自 RAW 装配）
  - 返回：`Array` 或 `{ messages:Array }`

- before/afterNormalizeAssets
  - 输入/输出对象：`{ preset, world_books, character, regex_files }`
  - 可返回部分字段（未返回的字段保持原值）

- before/afterPostprocess
  - 输入/输出对象：`{ messages, rules, variables }`
  - 可返回部分字段（未返回的字段保持原值）

- before/afterVariablesSave
  - 输入：最终变量对象 `finalVars` 或 `{ finalVars }`
  - 返回：对象将合并；返回非空对象即可更新部分或全部变量

—

## 执行顺序与冲突处理（重要）

同一 Hook 内的多策略执行顺序采用“三级排序”：
1) `order` 降序（默认 0；值越大越先执行）  
   代码位置：[javascript.function(sortHooks)](backend_projects/SmartTavern/plugins/prompt-router/hooks.js:62)

2) `id` 字母序（不区分大小写；为空则视为最后）  
   代码位置：[javascript.function(sortHooks)](backend_projects/SmartTavern/plugins/prompt-router/hooks.js:62)

3) 注册序 `seq`（先注册先执行；由 Hooks 管理器自增记录）  
   字段定义与赋值：[javascript.declaration(registry item with seq)](backend_projects/SmartTavern/plugins/prompt-router/hooks.js:54), [javascript.function(registerStrategy → push)](backend_projects/SmartTavern/plugins/prompt-router/hooks.js:82)

建议：
- 为策略设置明确 `order`，并提供稳定 `id`（如 `my.router.strategy`）
- 如需在相同 `order` 强制先后，可通过 `id` 命名约定（字母序）或控制注册顺序达成

—

## 路由器行为与完整处理链

- 视图处理（`prompt.process_view`）中 Hooks 调用点位：
  - 资产阶段：[`javascript.function(routeProcessView)`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:299)
    - beforeNormalizeAssets → normalize → afterNormalizeAssets
  - RAW 阶段：[`javascript.function(routeProcessView)`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:339)
    - beforeRaw → afterInsert → assemble_full
  - RAW 后阶段：[`javascript.function(routeProcessView)`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:355)
    - afterRaw
  - 后处理阶段：[`javascript.function(routeProcessView)`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:362)
    - beforePostprocess → prompt_postprocess.apply → afterPostprocess
  - 变量阶段：[`javascript.function(routeProcessView)`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:389)
    - beforeVariablesSave → 保存 → afterVariablesSave

- 自动补全（`completion.auto`）
  - 是否流式由 LLM 配置 `detail.stream` 决定；不再支持单独的 `completion.stream/single`：
    - 动作入口：[`javascript.function(routerProvider.call)`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:428)


—

## 示例：编写提示词策略插件（多 Hook）

示例 1：RAW 前与 RAW 后最小处理
```js
// backend_projects/SmartTavern/plugins/prompt-strategy-minimal/index.js
export default function activate(host) {
  const strategy = {
    id: 'prompt.strategy.minimal',
    order: 50,
    beforeRaw(history, ctx) {
      // 规范化：role 小写，content 去除多余空白
      const out = Array.isArray(history) ? history.map(m => ({
        role: String(m.role || '').toLowerCase(),
        content: String(m.content || '').trim()
      })) : []
      return { history: out }
    },
    afterRaw(messages, ctx) {
      // 清理：去除空内容消息
      const out = Array.isArray(messages) ? messages.filter(m => String(m?.content || '').trim().length > 0) : []
      return { messages: out }
    }
  }
  host.events.emit('prompt.router.strategy.register', strategy)
  return () => host.events.emit('prompt.router.strategy.unregister', strategy.id)
}
```

示例 2：资产阶段与后处理阶段联合调整
```js
// backend_projects/SmartTavern/plugins/prompt-strategy-assets-post/index.js
export default function activate(host) {
  const strategy = {
    id: 'prompt.strategy.assets.post',
    order: 80,
    beforeNormalizeAssets(assets, ctx) {
      // 合并额外 world_book（示例），或注入临时 regex_rules
      const wb = Object.assign({}, assets.world_books || {})
      wb['wb_extra'] = { name: '临时世界书', items: [] }
      const rx = Object.assign({}, assets.regex_files || {})
      rx.regex_rules = (rx.regex_rules || []).concat([
        { id: 'cleanup-debug', enabled: true, find_regex: '\\(debug\\)', replace_regex: '' }
      ])
      return { world_books: wb, regex_files: rx }
    },
    afterPostprocess(payload, ctx) {
      // 统一追加后处理标记变量
      const vars = Object.assign({}, payload.variables || {})
      vars.postprocessed = true
      return { variables: vars }
    }
  }
  host.events.emit('prompt.router.strategy.register', strategy)
  return () => host.events.emit('prompt.router.strategy.unregister', strategy.id)
}
```

示例 3：变量保存前后扩展
```js
// backend_projects/SmartTavern/plugins/prompt-strategy-vars/index.js
export default function activate(host) {
  const strategy = {
    id: 'prompt.strategy.vars',
    order: 60,
    beforeVariablesSave(finalVars, ctx) {
      const v = Object.assign({}, finalVars || {})
      v.last_save_ts = Date.now()
      return v // 直接返回对象
    },
    afterVariablesSave(finalVars, ctx) {
      // 可发送事件或写日志；此处仅提示
      host.pushToast?.({ type: 'info', message: `变量已保存：${Object.keys(finalVars||{}).length} 项`, timeout: 1500 })
      return null
    }
  }
  host.events.emit('prompt.router.strategy.register', strategy)
  return () => host.events.emit('prompt.router.strategy.unregister', strategy.id)
}
```

—

## 开发流程（清单）

1) 在 `backend_projects/SmartTavern/plugins/` 下新建你的插件文件夹与 JS 文件
   - 推荐：`my-plugin/index.js`
2) 在 JS 中导出 `activate(host)`，内部注册策略对象（含 `id` 与适当的 `order`）
   - 注册：`host.events.emit('prompt.router.strategy.register', strategy)`
   - 卸载：`host.events.emit('prompt.router.strategy.unregister', strategy.id)`
3) 启动应用，前端自动从后端拉取并加载你的脚本（后端优先）
   - 入口：[`javascript.function(loadWorkflows)`](frontend_projects/SmartTavern/src/main.js:111)
4) 通过浏览器控制台查看加载状态（开发期）
   - `window.loader.list()` / 手动卸载 `window.loader.unload(id)`（id 以加载时设置的稳定 id 为准）
5) 观察提示与日志
   - 插件可通过 `host.pushToast()` 发送提示消息（见 Hooks 集成）

—

## 目录组织与命名建议

- 每个插件独立文件夹；名称语义清晰：`prompt-strategy-minimal/`、`prompt-strategy-assets-post/`
- 脚本头部可加入元数据注释（清单解析使用）：
  ```js
  // @name Prompt Strategy Minimal
  // @description RAW前规范化与RAW后清理
  ```
- 稳定 id 生成（加载器内部）：由相对路径派生（去前缀与 `.js`，斜杠替换为 `-`），如：
  - `prompt-router/prompt-router.js` → `prompt-router-prompt-router`
  - `prompt-strategy-minimal/index.js` → `prompt-strategy-minimal-index`

—

## 性能与安全建议

- 避免在 Hook 中执行长阻塞操作；如需调用后端 API，务必做好异常兜底
- 确保 `role` 限于 `{system,user,assistant}` 且 `content` 为字符串（后续模块契约要求）
- 多策略并行时优先做好“幂等处理”与“最小化修改”原则，减少不同插件之间的冲突
- 谨慎使用正则批处理（规则过多可能影响性能）；建议在资产阶段聚合一次统一规则集

—

## 迁移说明（与旧版本差异）

- 路由器动作规范化：仅支持 `completion.auto` 与 `prompt.process_view`
  - 已移除：`completion.stream/single`（改用 `completion.auto`，流式由 LLM 配置自动判定）
  - 动作入口：[javascript.function(routerProvider.call)](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:428)

- 完整保存策略：
  - 旧：“始终追加新节点”
  - 新：“优先更新占位助手节点（失败回退追加）”
  - 实现位置：[javascript.function(routeLLMPostprocess)](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:196), [javascript.block(save-full-strategy)](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:241)

—

## 关键文件速查（点击直达）

- 路由器主文件（Hook 接入/统一动作接口）：[`prompt-router/prompt-router.js`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js)
- Hooks 管理器（侵入点与顺序）：[`prompt-router/hooks.js`](backend_projects/SmartTavern/plugins/prompt-router/hooks.js)
- 后端工作流清单/详情 API（递归扫描）：[`impl.py`](api/modules/SmartTavern/data_catalog/impl.py)
- 前端启动加载后端工作流（排序与稳定 id 派生）：[javascript.function(loadWorkflows)](frontend_projects/SmartTavern/src/main.js:111)
- 运行时 Loader（动态导入与白名单）：[`loader.js`](frontend_projects/SmartTavern/src/workflow/loader.js)

—

## FAQ

- Q：我只写一个独立 JS 插件，不处理提示词，可以吗？
  - A：可以，走“通用独立插件”路径。不需要注册策略对象；如需影响提示词链路，再向 Hooks 注册。

- Q：两个策略在同一 Hook 使用相同 order，如何确定先后？
  - A：排序为三级：order 降序 → id 字母序 → 注册序 seq。请设置稳定 id 或控制注册顺序。

- Q：如何只用一个入口决定流式/非流式？
  - A：使用 `completion.auto`；是否流式由 LLM 配置 `detail.stream` 决定。

- Q：是否必须修改路由器文件才能新增策略？
  - A：不需要。策略注册统一走事件 → 路由器转发 → Hooks 管理与执行。

—

如需更多示例或扩展 Hook 点位（例如宏处理前后更细分阶段），可在 [`javascript.function(routeProcessView)`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:262) 中增加调用位置，同时保持统一注册与顺序规则。建议优先使用现有九个 Hook 点，它们覆盖大多数提示词处理场景。

## 插件入口声明（manifest.json / entry.js / index.js）

为更精确地控制“后端加载哪些 JS 文件”，每个插件文件夹可声明入口文件，数据目录 API 将按以下优先级解析：

加载优先级规则
1) manifest.json（推荐）
   - 支持字段：
     - entries: string[]（相对插件根目录的路径）
     - 或 entry: string（单入口）
   - 每个条目必须是 .js 文件且存在
2) 约定入口文件
   - entry.js 或 index.js（位于插件根）
3) 回退策略（兼容旧结构）
   - 扫描插件文件夹顶层的 *.js（不递归）
   - 同时保留根 workflows 目录下的 *.js（向后兼容）

实现位置
- 工作流清单扫描：[`python.function(list_workflows_impl)`](api/modules/SmartTavern/data_catalog/impl.py:851)
- 入口文件解析（manifest/entry/index/fallback）：[`python.function(list_workflows_impl)`](api/modules/SmartTavern/data_catalog/impl.py:884)

示例：manifest.json 声明多个入口
```
backend_projects/SmartTavern/plugins/my-plugin/
├─ manifest.json
├─ index.js
├─ strategies/
│  ├─ normalize-assets.js
│  └─ raw-phase.js
└─ ui/
   └─ panel.js
```

manifest.json
```json
{
  "name": "My Plugin Bundle",
  "description": "示例插件：声明多入口以便后端精确加载",
  "entries": [
    "index.js",
    "strategies/normalize-assets.js",
    "strategies/raw-phase.js",
    "ui/panel.js"
  ]
}
```

各入口 JS 的 activate(host) 约定
- 每个入口均应导出 `activate(host)`（默认或命名导出），由 Loader 动态导入并调用：
  - Loader 动态加载：[`javascript.function(load)`](frontend_projects/SmartTavern/src/workflow/loader.js:72)
  - 路由器策略注册（如需挂载 Hooks）：[`javascript.function(activate → register/unregister)`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:26)

index.js（独立工作流入口示例）
```js
// backend_projects/SmartTavern/plugins/my-plugin/index.js
export default function activate(host) {
  const off = host.events.on('my.plugin.hello', () => {
    host.pushToast?.({ type: 'success', message: 'Hello from my-plugin!', timeout: 1500 })
  })
  return () => off?.()
}
```

strategies/normalize-assets.js（提示词策略入口示例：资产阶段）
```js
// backend_projects/SmartTavern/plugins/my-plugin/strategies/normalize-assets.js
export default function activate(host) {
  const strategy = {
    id: 'my.plugin.normalize-assets',
    order: 90,
    beforeNormalizeAssets(assets, ctx) {
      const rx = Object.assign({}, assets.regex_files || {})
      rx.regex_rules = (rx.regex_rules || []).concat([
        { id: 'strip-debug', enabled: true, find_regex: '\\(debug\\)', replace_regex: '' }
      ])
      return { regex_files: rx }
    },
    afterNormalizeAssets(assetsOut, ctx) {
      // 保持返回规范；若不需要修改可返回 null
      return null
    }
  }
  host.events.emit('prompt.router.strategy.register', strategy)
  return () => host.events.emit('prompt.router.strategy.unregister', strategy.id)
}
```

strategies/raw-phase.js（提示词策略入口示例：RAW 前/后阶段）
```js
// backend_projects/SmartTavern/plugins/my-plugin/strategies/raw-phase.js
export default function activate(host) {
  const strategy = {
    id: 'my.plugin.raw-phase',
    order: 80,
    beforeRaw(history, ctx) {
      const out = Array.isArray(history) ? history.map(m => ({
        role: String(m.role || '').toLowerCase(),
        content: String(m.content || '').trim()
      })) : []
      return { history: out }
    },
    afterRaw(messages, ctx) {
      const out = Array.isArray(messages) ? messages.filter(m => String(m?.content || '').trim().length > 0) : []
      return { messages: out }
    }
  }
  host.events.emit('prompt.router.strategy.register', strategy)
  return () => host.events.emit('prompt.router.strategy.unregister', strategy.id)
}
```

ui/panel.js（UI 入口示例：非提示词链路）
```js
// backend_projects/SmartTavern/plugins/my-plugin/ui/panel.js
export default function activate(host) {
  const disposeBtn = host.registerHomeButton?.({
    id: 'my.plugin.panel',
    label: '插件面板',
    icon: 'panel',
    order: 40,
    actionId: 'my.plugin.panel.open'
  })
  const offOpen = host.events.on('my.plugin.panel.open', () => {
    host.pushToast?.({ type: 'info', message: '打开插件面板（示例）', timeout: 1500 })
  })
  return () => { try { disposeBtn?.(); offOpen?.() } catch (_) {} }
}
```

注意事项
- manifest.json 仅对后端清单接口有效（控制接口返回哪些入口文件）；前端 Loader 将按清单逐项动态加载。
- 若同一插件需要拆分多个入口，请将“策略入口”与“通用入口（UI/桥接等）”分别列出，避免在单文件中混合过多逻辑，提升维护性。
- 若未提供 manifest.json，将按入口约定或回退策略加载：entry.js → index.js → 顶层 *.js。
- 清单/详情 API 仍返回 POSIX 风格路径（统一 `file` 字段），Loader 会将其转换为 Blob URL 进行 ESM 导入：[`javascript.function(loadWorkflows)`](frontend_projects/SmartTavern/src/main.js:111)

迁移指引
- 旧式“递归扫描所有 *.js”已调整为“根+子文件夹入口”策略，便于插件 bundle 精确控制加载范围。
- 对已有插件：若希望控制加载文件，请在插件根目录添加 manifest.json 并列出入口文件；否则保持向后兼容行为不受影响。

FAQ（入口与清单）
- Q：一个插件能否有多个入口？
  - A：可以，用 manifest.json 的 entries 数组列出多个相对路径； Loader 会逐个加载。
- Q：入口文件是否必须导出 activate(host)？
  - A：必须。Loader 仅识别导出 activate(host) 的模块（默认或命名导出），否则将报错：[`javascript.function(load)`](frontend_projects/SmartTavern/src/workflow/loader.js:72)
- Q：如何控制策略执行顺序？
  - A：在策略对象中设置 order，并提供稳定 id；同一 Hook 内顺序规则为“order 降序 → id 字母序 → 注册序 seq”：[`javascript.function(sortHooks)`](backend_projects/SmartTavern/plugins/prompt-router/hooks.js:62)

## 修订说明：manifest.json 存储 JS 文件路径（非递归，直载 JS）

最新规范
- 仅扫描每个插件子文件夹内的 manifest.json 文件；未提供则跳过该插件目录。
- manifest.json 的 entries 列表必须存储“JS 文件的相对路径”（相对于插件根），例如 "strategies/raw-phase/index.js"、"ui/panel/index.js"。
- 后端不再做目录映射（不将目录自动映射为目录/index.js），也不尝试 entry.js/index.js 等约定入口，更不递归扫描 *.js。
- 后端清单接口直接返回这些 JS 文件路径，前端 Loader 按清单逐项动态加载并调用 activate(host)。

实现位置
- 清单扫描与解析（严格 JS 文件路径）：[python.function(_manifest_js_files)](api/modules/SmartTavern/data_catalog/impl.py:884)
- 前端启动加载（按后端清单逐项动态导入）：[javascript.function(loadWorkflows)](frontend_projects/SmartTavern/src/main.js:111)
- Loader 动态导入 activate(host)：[javascript.function(load)](frontend_projects/SmartTavern/src/workflow/loader.js:72)

manifest.json 示例（严格 JS 文件路径）
- 插件包根目录：backend_projects/SmartTavern/plugins/example-manifest-bundle
- 文件：[filename](backend_projects/SmartTavern/plugins/example-manifest-bundle/manifest.json)
```json
{
  "name": "Example Manifest Bundle",
  "description": "严格模式：manifest.json 存储 JS 文件相对路径，后端直接返回这些路径供前端加载",
  "entries": [
    "strategies/raw-phase/index.js",
    "ui/panel/index.js"
  ]
}
```

入口 JS 示例
- RAW 阶段策略入口：[filename](backend_projects/SmartTavern/plugins/example-manifest-bundle/strategies/raw-phase/index.js)
  - 注册 Hooks 策略（beforeRaw/afterRaw），无需修改主路由器
- UI 面板入口：[filename](backend_projects/SmartTavern/plugins/example-manifest-bundle/ui/panel/index.js)
  - 注册开始页按钮与事件，演示非提示词链路入口

迁移指引（从“目录声明”到“JS 文件声明”）
- 若你的 manifest.json 之前仅声明目录（如 "strategies/raw-phase"），请改为明确 JS 文件路径（"strategies/raw-phase/index.js"）。
- 确保每个声明的文件存在且导出 activate(host)，否则 Loader 将报错（activate(host) 必须存在）。
- 未提供 manifest.json 的插件目录将不被加载（严格模式）。

FAQ 更新
- Q：entries 是否可以填子目录？
  - A：不可以。entries 必须是 JS 文件路径（相对于插件根），例如 "xxx/index.js"。后端不再做目录到 index.js 的映射。
- Q：一个插件能否声明多个 JS 入口？
  - A：可以。entries 列表可包含多个 JS 文件路径，前端 Loader 会逐项加载。
- Q：是否仍支持递归或顶层 *.js 自动加载？
  - A：不支持。严格模式仅根据 manifest.json entries 加载指定 JS 文件。

注：路由器动作接口仍保持简化（completion.auto 与 prompt.process_view），流式选择由 LLM 配置 detail.stream 自动判定；插件策略的 Hook 点与三级排序规则保持不变（order 降序 → id 字母序 → 注册序 seq）。

## 插件系统功能速查与示例大全（结合现有示例与前端桥接）

本章节在原有路由与 Hooks 指南基础上，系统性梳理插件系统“可用能力”、常见用法模式与完整示例，帮助开发者快速构建后端插件（位于 `backend_projects/SmartTavern/plugins`）并与前端运行时桥接协作。

概览
- 插件结构：每个插件为一个独立 JS 模块（导出 `activate(host)`），可在卸载时返回清理函数
- 加载机制：前端使用 Loader 动态加载，支持后端优先覆盖，详情见 [filename](frontend_projects/SmartTavern/src/workflow/loader.js)
- 事件桥接：Completion/Message/Branch/Catalog/Settings 等通道通过 Host.events 广播与订阅，参考 [filename](frontend_projects/SmartTavern/docs/API参考_事件与状态.md)
- 提示词链路：建议通过“策略对象 + Hooks”实现提示词后处理；注册事件在路由器中转，参考 [filename](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js)

— 

可用宿主能力（Host 提供）
- 事件总线（发布/订阅/清理）：详见 [filename](frontend_projects/SmartTavern/src/workflow/core/events.js)
- UI 插槽
  - 开始页按钮：注册/注销/列出，详见 [filename](frontend_projects/SmartTavern/src/workflow/slots/homeMenu/bootstrap.js)
  - 侧边栏项：注册/注销/显隐控制，详见 [filename](frontend_projects/SmartTavern/src/workflow/slots/sidebar/bootstrap.js)
- 全局提示与消息
  - pushToast：全局提示，参考 [filename](frontend_projects/SmartTavern/src/components/common/ToastsOverlay.vue)
  - appendMessage：追加工作流回显消息，参考 [filename](frontend_projects/SmartTavern/src/stores/messages.js)
- 运行时路由器注入（供 CompletionBridge 使用）
  - 通过事件注入路由器提供者：详见 [filename](frontend_projects/SmartTavern/src/workflow/controllers/completionBridge.js)

— 

前端桥接与事件通道（可监听/可触发）
- Completion（AI 调用过程）
  - 入口与过程事件：详见 [filename](frontend_projects/SmartTavern/src/workflow/channels/completion.js)
  - 桥接控制：详见 [filename](frontend_projects/SmartTavern/src/workflow/controllers/completionBridge.js)
- Message（发送/编辑）
  - 事件常量与流程：详见 [filename](frontend_projects/SmartTavern/src/workflow/channels/message.js)
  - 桥接层：详见 [filename](frontend_projects/SmartTavern/src/workflow/controllers/messageBridge.js)
- Branch（分支表/切换/删除/重试）
  - 事件常量：详见 [filename](frontend_projects/SmartTavern/src/workflow/channels/branch.js)
  - 桥接层：详见 [filename](frontend_projects/SmartTavern/src/workflow/controllers/branchBridge.js)
- Catalog（数据目录）
  - 事件常量：详见 [filename](frontend_projects/SmartTavern/src/workflow/channels/catalog.js)
  - 前端 API（直接调用后端模块网关）：详见 [filename](frontend_projects/SmartTavern/src/services/dataCatalog.js)
- Settings（对话设置）
  - 事件常量：详见 [filename](frontend_projects/SmartTavern/src/workflow/channels/settings.js)
  - 桥接层：详见 [filename](frontend_projects/SmartTavern/src/workflow/controllers/settingsBridge.js)
- Conversation（对话生命周期）
  - 桥接层：详见 [filename](frontend_projects/SmartTavern/src/workflow/controllers/conversationBridge.js)
- EventSource（事件来源标准）
  - 类型与辅助方法：详见 [filename](frontend_projects/SmartTavern/src/workflow/core/eventSource.js), [filename](frontend_projects/SmartTavern/src/workflow/core/eventSource.d.ts)

— 

插件模式与典型场景

1) UI 扩展：开始页按钮与事件提示
- 示例参考：[`filename`](backend_projects/SmartTavern/plugins/demo-home/demo-home.js)
- 要点：
  - 通过 host.registerHomeButton 注册按钮
  - 使用 host.events.on 订阅 actionId 对应事件
  - 使用 host.pushToast 与 host.appendMessage 回显状态

2) 侧边栏扩展：动态可见/禁用控制
- 示例参考：[`filename`](backend_projects/SmartTavern/plugins/demo-sidebar/demo-sidebar.js)
- 要点：
  - registerSidebarItem 支持 visibleWhen/disabledWhen，接收上下文（view/theme 等）
  - 在 threaded 视图展示、暗色主题禁用等条件控制

3) 事件增强：消息发送/编辑过程监听
- 示例参考：[`filename`](backend_projects/SmartTavern/plugins/demo-message-enhancer/demo-message-enhancer.js)
- 要点：
  - 动态 import 事件通道（同源路径），获取通道常量
  - 监听发送/编辑成功/失败并提示，追加系统回显
  - 适合关键词提醒、简单情感分析、统计通知等轻量增强

4) 外部转发：用户消息转发到外部服务
- 示例参考：[`filename`](backend_projects/SmartTavern/plugins/message-forwarder/message-forwarder.js), [`filename`](backend_projects/SmartTavern/plugins/message-forwarder-config/message-forwarder-config.js)
- 要点：
  - 监听 `EVT_MESSAGE_SEND_REQ`，构造外部 HTTP 请求并回显结果
  - 配置入口（开始页按钮）通过 Settings 通道写入对话 settings.plugins.messageForwarder
  - 失败时安全兜底回显，不阻塞原消息流程

5) 来源感知：根据 EventSource 决策策略
- 示例参考：[`filename`](backend_projects/SmartTavern/plugins/demo-source-aware/demo-source-aware.js)
- 要点：
  - 使用 payload.source.viewType/intentType/priority 等字段进行差异化处理
  - 批量操作追踪（batchId）、跨组件事件协调（componentId），定期输出统计
  - 适合“智能 UI 助手”与“操作审计/分析”场景

6) 视图内注入：DOM 操作实现右侧悬浮卡片
- 示例参考：[`filename`](backend_projects/SmartTavern/plugins/demo-threaded-image/demo-threaded-image.js)
- 要点：
  - 在激活时注册侧边栏入口，点击后通过原生 DOM API 操作插入面板元素
  - 注意样式与清理（卸载时移除 DOM；icon 需调用 lucide.createIcons）

7) 路由器接管与提示词策略（Hooks）
- 路由器主文件与统一动作：[`filename`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js)
- Hooks 管理器与顺序控制：[`filename`](backend_projects/SmartTavern/plugins/prompt-router/hooks.js)
- 策略注册事件：
  - 注册：`host.events.emit('prompt.router.strategy.register', strategy)`（路由器转发至 Hooks）
  - 注销：`host.events.emit('prompt.router.strategy.unregister', strategy.id)`
- 典型策略：
  - RAW 前规范化、RAW 后过滤空消息
  - 资产阶段合并/注入规则
  - 后处理前后调整消息/变量/规则
  - 变量保存前后扩展标记/上报

— 

清单与加载（严格 manifest-only 模式）
- 说明：后端仅加载 manifest.json 中 entries 列出的 JS 文件，详见“修订说明”章节与示例 [`filename`](backend_projects/SmartTavern/plugins/example-manifest-bundle/manifest.json)
- 运行时加载入口：[`filename`](frontend_projects/SmartTavern/src/main.js)
  - 加载顺序：先前端固定工作流，再后端清单项（后端可覆盖同名）
  - 后端项排序策略示例：优先加载 prompt-router 相关项（确保路由器先注入）

— 

Cookbook：常见需求速解

- 注册路由器并统一调用 completion.auto/prompt.process_view
  - 通过 emit('workflow.router.set', provider) 注入，参考 [`filename`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js)
  - Completion 桥接自动转发 chunk/finish/saved/usage/error/end 事件，参考 [`filename`](frontend_projects/SmartTavern/src/workflow/controllers/completionBridge.js)

- 读取对话设置与资产详情
  - 调用后端模块网关：settings/get 与 data_catalog/get_* 系列，参考 [`filename`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js)
  - 统一资产归一化：modules/assets_normalizer/normalize（后续进入 Hooks）

- 替换/卸载已加载插件
  - Loader 提供 unload/unloadAll/list/has，参考 [`filename`](frontend_projects/SmartTavern/src/workflow/loader.js)

- 动态导入前端事件通道模块
  - 使用 `const baseUrl = window.location.origin; await import(\`\${baseUrl}/src/workflow/channels/message.js\`)`
  - 注：在插件运行环境为浏览器同源上下文，路径解析与 Vite 开发服务器兼容

— 

最佳实践与注意事项
- 功能拆分：将“提示词策略入口”与“UI/桥接入口”分离为多个 JS，通过 manifest.json entries 明确列出
- 幂等与最小化修改：多个策略并存时，应尽量减少相互干扰并保证重复执行安全
- 同源约束与白名单：Loader 默认允许 same-origin/blob/data，与 `/public/workflows/`、`/workflows/` 前缀，参考 [`javascript.function(isAllowed)`](frontend_projects/SmartTavern/src/workflow/loader.js:37)
- 事件清理与 DOM 释放：卸载时务必调用返回的清理函数，移除事件与 DOM 节点
- 错误与提示：统一使用 Host.pushToast 反馈；后端调用失败应有兜底逻辑
- 顺序策略：为策略设置 order 并赋予稳定 id；冲突时使用“三级排序”规则
- 性能：避免 Hook 内长阻塞；正则与宏在后处理视图统一执行，减少重复

— 

扩展示例（基于现有示例的组合与提升）

示例 A：“来源感知 + RAW 策略联动”
- 在一个插件中注册两个入口：
  - A1: 策略入口（beforeRaw/afterRaw），依据 ctx.view 差异化处理
  - A2: 事件入口（监听 completion.done），依据 source.componentType 进行提示
- 组合参考：[`filename`](backend_projects/SmartTavern/plugins/demo-source-aware/demo-source-aware.js), [`filename`](backend_projects/SmartTavern/plugins/example-manifest-bundle/strategies/raw-phase/index.js)

示例 B：“外部转发 + 配置入口”
- 使用 Settings 通道写入 plugins.messageForwarder 配置，并在消息请求事件中读取并转发
- 组合参考：[`filename`](backend_projects/SmartTavern/plugins/message-forwarder/message-forwarder.js), [`filename`](backend_projects/SmartTavern/plugins/message-forwarder-config/message-forwarder-config.js)

示例 C：“线程视图 UI + 路由器策略”
- 在 threaded 视图注册面板入口，结合路由器策略对该视图的 RAW 组装进行定制
- 组合参考：[`filename`](backend_projects/SmartTavern/plugins/demo-threaded-image/demo-threaded-image.js), [`filename`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js), [`filename`](backend_projects/SmartTavern/plugins/prompt-router/hooks.js)

— 

后续操作（清理示例/测试插件）
- 当你熟悉上述能力并完成自有插件开发后，可删除示例/测试插件目录以保持整洁：
  - demo-home、demo-message-enhancer、demo-sidebar、demo-source-aware、demo-threaded-image
  - example-backend、message-forwarder、message-forwarder-config
  - 示例 manifest bundle（example-manifest-bundle）
- 删除前请确保关键生产插件（如 prompt-router）已通过 manifest.json 声明，并在清单接口返回列表中可见，否则路由器不会加载。

## FAQ：模块导入与静态资源（manifest-only 严格模式补充说明）

问题 1：同一插件包内除了入口 JS，还包含其他“组件/工具”JS 文件；manifest.json 只写入口 JS 时，入口能否使用这些额外 JS？能否使用其他插件文件夹里的 JS？

结论
- 入口 JS 可以“使用同包内的其他逻辑”，但不建议通过相对 ESM import（原因见下）。推荐两种方式：
  1) 将同包内的辅助逻辑“内联到入口 JS”（最简做法）。
  2) 将共用逻辑放到前端源码共享目录（例如：[`filename`](frontend_projects/SmartTavern/src/workflow/libs/myShared.js)），入口通过同源绝对路径导入（白名单前缀允许运行时导入）。

- 严格不建议跨插件包之间直接 import 彼此的 JS 文件。若需要“跨插件复用”，统一将共享逻辑上移到前端源码的共享模块目录，然后各插件入口以同源路径导入。

原因与细节
- Loader 加载后端清单项时，会将每个入口 JS 源码转成 Blob URL 动态导入：[`javascript.function(load)`](frontend_projects/SmartTavern/src/workflow/loader.js:95)。在浏览器原生 ESM 中，位于 blob: 的模块做相对 import 往往无法正确解析（相对路径相对的是 blob URL，本身不可解析成你的后端数据目录）。
- 允许的导入路径（白名单）：[`javascript.declaration(__whitelist)`](frontend_projects/SmartTavern/src/workflow/loader.js:31)
  - same-origin、blob:、data:、`/public/workflows/`、`/workflows/`、`/src/workflow/workflows/`
  - 因此，建议“共享模块”放置在前端源码目录（例：[`filename`](frontend_projects/SmartTavern/src/workflow/libs/myShared.js)），并用同源绝对路径导入：
    ```js
    const base = window.location.origin
    const Shared = await import(`${base}/src/workflow/libs/myShared.js`)
    ```
- 若确有“同包内多 JS”的强需求：
  - 做法 A：manifest.json 的 entries 中“分别列出多个入口 JS”，每个入口独立被 Loader 加载并通过事件协作（而不是 import 彼此）。示例清单：[`filename`](backend_projects/SmartTavern/plugins/example-manifest-bundle/manifest.json)
  - 做法 B：将辅助 JS 合并为一个入口（打包/拷贝内联到同一个入口文件）。

问题 2：如果插件需要图片、JSON、配置等静态资源，是否必须全部写进 manifest.json？

结论
- 不需要将静态资源写入 manifest.json。manifest.json 仅用于“声明要直接加载的 JS 模块入口”。
- 静态资源的加载方式取决于其存放位置：
  - 前端公共资源：将图片等静态文件放在 [`filename`](frontend_projects/SmartTavern/public/) 下，按同源路径直接引用（例如 `/images/ThreadedChat.png`），无需清单声明。
  - 后端数据资源：若资源位于后端数据目录（例如 `backend_projects/...`），请通过后端 API 读取后在前端使用（例如 DataCatalog/自定义模块网关）；这些资源本身不在前端静态服务器路径下，不能直接 `/...` 引用。

建议实践
- UI 直接展示的静态文件（图标/图片）放入前端 public 目录（无需清单），由插件入口使用同源路径引用。
- 需要运行时读取的规则/配置/JSON 等，走后端 API（例如：[`javascript.module(dataCatalog.js)`](frontend_projects/SmartTavern/src/services/dataCatalog.js:1)），或者为你的插件新增专用模块网关 API。
- 跨插件共享 JS：将共享逻辑置于前端源码（`/src/workflow/libs/...`），通过同源绝对路径 `import`；避免插件间彼此 import 后端数据目录中的 JS 文件。

简例：插件入口导入共享模块与使用图片（无需清单写图片）
```js
// backend_projects/SmartTavern/plugins/my-plugin/index.js
export default function activate(host) {
  const base = window.location.origin

  // 导入前端共享模块（同源绝对路径，白名单允许）
  (async () => {
    const Utils = await import(`${base}/src/workflow/libs/myShared.js`)
    // 使用共享方法
    const id = Utils.makeId('my-plugin')
    host.pushToast?.({ type: 'info', message: `共享模块可用：${id}`, timeout: 1800 })
  })().catch(e => host.pushToast?.({ type: 'error', message: `共享模块导入失败：${e}`, timeout: 2000 }))

  // 展示前端 public 下的静态图片（无需 manifest 声明）
  host.appendMessage?.({
    role: 'system',
    content: '![Demo Image](/images/ThreadedChat.png)',
  })

  return () => {}
}
```

关键点回顾
- manifest.json 仅声明“需要由 Loader 直接加载的 JS 文件入口”；非 JS 静态资源不写进清单。
- 同包内多 JS：优先合并/内联为一个入口；或 entries 列多个入口并用事件协作，不做模块间直接 import。
- 跨插件复用：将共享逻辑放到前端源码共享目录，通过同源绝对路径导入。
- 后端数据资源：通过后端 API 获取内容与路径，不直接 `/...` 引用后端文件系统。

如需将共享模块或静态资源的“访问规范”写入你团队内规范，可参考以上做法并在你们的编码规范文档补充“同源绝对路径导入 + public 资源目录”原则。

---
## 附录：prompt-router 插件清单（manifest）规范与示例

- 插件目录：[`backend_projects/SmartTavern/plugins/prompt-router`](backend_projects/SmartTavern/plugins/prompt-router)
- 清单文件：[`backend_projects/SmartTavern/plugins/prompt-router/manifest.json`](backend_projects/SmartTavern/plugins/prompt-router/manifest.json:1)
- 建议清单内容（仅声明“入口 JS 模块”，内部相对导入由 Loader 改写支持）：
{
  "entries": [
    "prompt-router.js"
  ]
}

重要说明
- 不要将 hooks.js 写入 entries。hooks.js 不是入口模块，不导出 [`javascript.function(activate)`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:27)；它由路由器入口 [`javascript.module(prompt-router.js)`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:1) 通过动态导入引用：[`javascript.expression(import('./hooks.js'))`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:32)。
- 同包相对导入支持：运行时 Loader 的后端包加载器会读取入口源码，替换其中的相对静态/动态导入为 Blob URL 并注入加载：
  - 加载入口：[`javascript.function(loadBackendWorkflow)`](frontend_projects/SmartTavern/src/workflow/loader.js:212)
  - 静态 import/ export 识别：[`javascript.variable(RE_STATIC)`](frontend_projects/SmartTavern/src/workflow/loader.js:232)
  - 动态 import(...) 识别：[`javascript.variable(RE_DYNAMIC)`](frontend_projects/SmartTavern/src/workflow/loader.js:233)
  - 转换逻辑与替换：[`javascript.function(transform)`](frontend_projects/SmartTavern/src/workflow/loader.js:298)

故障排查
- 若浏览器控制台出现“Failed to resolve module specifier './hooks.js'”：
  1) 确认使用了最新的 Loader，动态 import 正则应为：[`javascript.variable(RE_DYNAMIC)`](frontend_projects/SmartTavern/src/workflow/loader.js:233)（形如 `import\s*\(\s*['"]([^'"]+)['"]\s*\)`）。
  2) 确认清单仅包含入口 JS（prompt-router.js），不要将 hooks.js 写入 entries（hooks.js 无 [`javascript.function(activate)`](backend_projects/SmartTavern/plugins/prompt-router/prompt-router.js:27)）。
  3) 确认后端 DataCatalog 清单接口能够返回 plugins 路径：[`python.function(list_workflows_impl)`](api/modules/SmartTavern/data_catalog/impl.py:853)

进阶建议
- 单入口优先：将内部依赖内联或使用相对导入，保持清单 entries 精简（每项应为可直接被 Loader 调用的入口，导出 activate(host)）。
- 多入口场景：同一插件如需多个独立入口（均导出 activate），可分别列出多个 JS 文件，Loader 将逐项加载与调用：
  - 清单示例与说明：[`filename`](backend_projects/SmartTavern/plugins/example-manifest-bundle/manifest.json)
  - Loader 加载器：[`javascript.function(load)`](frontend_projects/SmartTavern/src/workflow/loader.js:80)

与本文其它章节的一致性
- 本附录与“清单与加载（严格 manifest-only 模式）”章节一致：manifest.json 仅声明“需要直接加载的 JS 入口文件”；同包内资源与相对导入由 Loader 在浏览器端改写与注入，不需要写入清单。

# 后端插件 API（Python）规范与示例（新增）

目标
- 为 SmartTavern 的插件提供“后端 API”能力，统一通过 /api/plugins 命名空间暴露，无需改动核心路由器或模块。
- 与现有“后端 JS 工作流加载”并行：前端负责 JS 插件；后端 Python 插件通过自动发现与注册对外提供 API。

核心机制
- 自动命名空间推断：函数所属模块以 "api.plugins" 开头时，命名空间自动解析为 "plugins"（实现见 [python.function(FunctionRegistry._derive_namespace)](core/api_registry.py:39)）。
- 注册装饰器：插件入口函数使用 [python.function(register_api)](core/api_registry.py:148) 装饰器完成 API 注册。
- 启动器导入：启动器扫描并导入 api/plugins 下所有模块，触发注册（入口见 [python.function(load_all_api_modules)](start_all_apis.py:60)）。
- 路由与文档：API 网关依据注册表在 /api/plugins 下生成路由与 OpenAPI（实现见 [python.function(APIGateway._register_endpoints_to_fastapi)](core/api_gateway.py:449)）。
- 客户端调用：HTTP 客户端已支持 'plugins' 命名空间；未指定时按 modules → workflow → plugins 顺序尝试（逻辑见 [python.function(ApiClient._paths_for)](core/api_client.py:62)）。

目录结构与命名规范
- 插件后端 Python 入口统一存放在仓库根的 `api/plugins/SmartTavern/` 下，按插件名分包：
  ```
  api/
  └─ plugins/
     └─ SmartTavern/
        └─ <plugin_id>/
           ├─ __init__.py
           └─ <plugin_id>.py   # 建议：实现文件与目录同名
  ```
- 必须提供 `__init__.py` 以声明包结构。
- 函数路径约定：`path="SmartTavern/<plugin_id>/<action_name>"`，最终对外暴露为 `/api/plugins/SmartTavern/<plugin_id>/<action_name>`。

最小示例
- 文件：[`api/plugins/smarttavern/example_backend/example_backend.py`](api/plugins/smarttavern/example_backend/example_backend.py)
- 入口代码（示例）：
  ```python
  from core.api_registry import register_api

  @register_api(
      path="smarttavern/example_backend/echo",
      input_schema={
          "type": "object",
          "properties": {"text": {"type": "string"}},
          "required": ["text"]
      },
      output_schema={
          "type": "object",
          "properties": {"echo": {"type": "string"}}
      },
      description="Echo input text"
  )
  def echo(text: str):
      return {"echo": text}

  @register_api(
      path="smarttavern/example_backend/info",
      input_schema={"type": "object", "properties": {}},
      output_schema={
          "type": "object",
          "properties": {
              "project": {"type": "string"},
              "plugin": {"type": "string"}
          }
      },
      description="Plugin info"
  )
  def info():
      return {"project": "SmartTavern", "plugin": "example_backend"}
  ```
- 启动后会自动注册并暴露以下路由：
  - GET/POST `/api/plugins/smarttavern/example_backend/echo`
  - GET/POST `/api/plugins/smarttavern/example_backend/info`

运行与验证
- 启动 API 网关：
  - 方式一（开发热重载）：`python start_all_apis.py --reload`
  - 方式二（常规）：`python start_all_apis.py`
- 控制台日志会打印导入统计并列出注册 API 数量（调用链见 [python.function(create_app)](start_all_apis.py:82)、[python.function(main)](start_all_apis.py:108)）。
- 打开文档：`http://localhost:8050/docs`，可查看 `/api/plugins/...` 下的 API。
- 直接 HTTP 验证：
  - `POST http://localhost:8050/api/plugins/smarttavern/example_backend/echo`，JSON体：`{"text":"hello"}`
  - 期望响应：`{"echo":"hello"}`

客户端调用示例（前端或脚本）
- 若使用统一客户端，可显式指定命名空间：
  - 逻辑路径拼接参考 [python.function(ApiClient._paths_for)](core/api_client.py:62)
- 在浏览器端或 Node 侧直接调用 HTTP：
  - `fetch('/api/plugins/smarttavern/example_backend/info', { method: 'GET' })`

注意事项
- 包与文件命名：
  - 为保证自动导入与命名空间推断有效，入口模块必须位于 `api/plugins/...` 包路径下，且包含 `__init__.py`。
  - 启动器会跳过 `__*`、`tests`、`test`、`example`（仅当目录名恰为这些关键字）等路径；请避免将正式插件放在这些保留名称的目录下。
- JSON Schema 严格约束：
  - `input_schema` 与 `output_schema` 必须为 JSON Schema 对象（draft-07/2020-12），网关会根据注册表生成文档并做基础校验。
- 与 JS 插件的协作：
  - JS 插件（后端数据目录下的工作流）用于 UI/事件桥接与提示词策略；Python 插件提供后端服务接口。
  - 如需在 JS 插件中调用后端 Python 插件 API，直接向 `/api/plugins/...` 发起 HTTP 请求或通过你们的统一客户端封装调用。

迁移与拓展
- 若已有“模块网关” API（位于 `api/modules/...` 或 `api/workflow/...`），保持不变；本章节新增的是“插件专用命名空间”，用于插件后端自包含功能。
- 可选增强（后续）：
  - 运行时管理：提供 `plugins/list | reload | unload` 管理 API，用于热更新插件模块（需实现安全卸载与注册表重建）。
  - 多项目支持：扩展 `api/plugins/<ProjectName>/...` 命名空间结构，以便多个项目共享同一框架。

设计原则与收益
- 自包含与解耦：插件的后端 API 与其 JS 入口同一语义空间，便于版本管理与独立发布。
- 最小侵入：仅扩展命名空间推断与启动器导入，无需改动现有模块网关与路由器。
- 前后端分离友好：后端统一暴露 `/api/plugins/...`，前端按需调用；清晰的路径约定减少心智负担与冲突。

相关实现位置（速查）
- 命名空间推断：`api.plugins` → `plugins` [python.function(FunctionRegistry._derive_namespace)](core/api_registry.py:39)
- 注册装饰器（API 入口）：[python.function(register_api)](core/api_registry.py:148)
- 启动器导入：扫描并导入 `api/plugins` [python.function(load_all_api_modules)](start_all_apis.py:60)
- 路由与 OpenAPI：根据注册表生成 `/api/<namespace>/<path>` [python.function(APIGateway._register_endpoints_to_fastapi)](core/api_gateway.py:449)
- 客户端路径策略：支持 `plugins` 命名空间 [python.function(ApiClient._paths_for)](core/api_client.py:62)

## 选择性注册后端 API（manifest.backend_entries）——新增

目标
- 支持“仅根据插件清单 manifest.json 指定的后端入口”进行加载与注册，避免扫描未声明的模块。
- 既可精确到“入口文件（.py）”，也可精确到“入口目录”，目录将按约定自动解析同名实现文件。

变更范围与是否大改
- 非侵入式增强：新增加载器文件与启动器调用，无需修改现有模块网关或前端加载逻辑。
  - 加载器：[`core/plugins_backend_loader.py`](core/plugins_backend_loader.py)
  - 启动器接入：[`start_all_apis.py`](start_all_apis.py)
- 无需新增后端 HTTP API。此能力仅影响后端导入阶段（启动时选择性注册），对运行时路由与调用方式无影响。
- 已保留原有 api/modules 与 api/workflow 自动导入；插件后端 API 不再全量扫描 api/plugins，而是严格按 manifest 声明加载。

manifest.json 新字段（后端入口）
- 后端入口字段优先使用 backend_entries（string[]），兼容别名 backend_entry（string|string[]）、backend（string|string[]）、backend_api_entries（string[]）。
- 每个条目支持三种写法（按优先顺序解析）：
  1) 点式模块路径：如 "api.plugins.smarttavern.example_backend.example_backend"
  2) 仓库相对文件：如 "api/plugins/smarttavern/example_backend/example_backend.py"
  3) 仓库相对目录：如 "api/plugins/smarttavern/example_backend"（约定该目录下存在同名实现文件 example_backend.py）

- 若使用“目录级”声明，加载器会寻找“与目录同名的实现文件”，例如：
  - 目录 api/plugins/smarttavern/foo/ 对应实现文件 api/plugins/smarttavern/foo/foo.py

安全与约束
- 仅允许导入 api/* 包下的模块（api.plugins / api.modules / api.workflow）。
- 命名空间仍由函数所在模块的 __module__ 自动解析（例如 api.plugins.* → plugins），详见 [`core/api_registry.py`](core/api_registry.py)。
- 建议项目名在路径中使用小写 smarttavern，与示例保持一致。

加载行为（启动时）
- 启动器在完成 api/modules 与 api/workflow 导入后，调用选择性加载器，仅按 manifest.json 的 backend_entries 进行导入。
  - 入口：[`start_all_apis.py`](start_all_apis.py)
  - 加载器实现：[`core/plugins_backend_loader.py`](core/plugins_backend_loader.py)
- 当前默认 manifest_only=True：未提供 backend_entries 的插件将被跳过（不导入 api/plugins 下对应模块）。
- 可选回退（manifest_only=False 才会生效）：若未声明 backend_entries，则尝试按约定回退扫描 api/plugins/<project>/<plugin> 目录的同名实现文件。

声明示例
- 文件级：
  {
    "name": "Example Backend",
    "backend_entries": [
      "api/plugins/smarttavern/example_backend/example_backend.py"
    ]
  }
- 目录级：
  {
    "name": "Example Backend",
    "backend_entries": [
      "api/plugins/smarttavern/example_backend"
    ]
  }
- 点式模块：
  {
    "name": "Example Backend",
    "backend_entries": [
      "api.plugins.smarttavern.example_backend.example_backend"
    ]
  }
- 混合：
  {
    "name": "Example Backend",
    "backend_entries": [
      "api/plugins/smarttavern/foo",
      "api/plugins/smarttavern/bar/bar.py",
      "api.plugins.smarttavern.baz.baz"
    ]
  }

常见问答
- 是否需要新增 HTTP API 来管理加载？
  - 不需要。本次仅影响启动阶段的导入行为；路由仍由注册表与网关自动生成，调用路径不变（/api/<namespace>/<path>）。
- 是否需要修改现有插件 JS 清单 entries？
  - 不需要。前端 JS 的 entries 与后端 Python 的 backend_entries 相互独立；JS 仍由前端 Loader 加载，Python 由后端加载器按 manifest 声明导入。
- 如果后端文件不在 api/* 包下可以加载吗？
  - 不可以。为保持命名空间解析与自动路由的一致性，后端 API 必须位于 api/* 包下（api.plugins / api.modules / api.workflow）。

完成后的调用方式不变
- 例如示例后端插件：
  - 代码：[`api/plugins/SmartTavern/example_backend/example_backend.py`](api/plugins/SmartTavern/example_backend/example_backend.py)
  - 已将 path 使用小写 "smarttavern/example_backend/..."，最终路由为：
    - GET/POST /api/plugins/smarttavern/example_backend/echo
    - GET/POST /api/plugins/smarttavern/example_backend/info

迁移建议
- 需要“选择性注册”的插件，为其 backend_projects/SmartTavern/plugins/<plugin>/manifest.json 添加 backend_entries 字段，按需列出目录或文件路径。
- 纯 JS 插件不受影响，仅在有后端 Python API 时补充 backend_entries。

## 前端与后端清单协同（manifest）— 实战示例与规范补充

场景
- 仅当 manifest.json 显式声明后端入口时，后端 Python API 才会被注册（选择性注册）
- 同一个插件既可以包含“前端 entries”（JS），也可以同时包含“后端 backend_entries”（Python）
- 也支持“前后端分离成两个插件目录”，各自有独立 manifest

运行机制（回顾）
- 启动器先加载 modules/workflow：
  - [python.function(load_all_api_modules)](start_all_apis.py:60)
- 然后按清单选择性导入 plugins（后端）：
  - [python.function(load_backend_plugin_apis)](core/plugins_backend_loader.py:263)
- Python 端的路由注册通过装饰器触发：
  - [python.function(register_api)](core/api_registry.py:148)
- 规范：API 实际对外路由使用小写 smarttavern 前缀（如 /api/plugins/smarttavern/...）；仓库真实路径可保留 SmartTavern（大写 S）目录名

推荐命名与路径规范
- 后端 Python 文件放在 api/plugins/SmartTavern/&lt;plugin&gt;/&lt;plugin&gt;.py（保持仓库路径真实大小写）
- register_api 的 path 使用全小写：smarttavern/&lt;plugin&gt;/&lt;action&gt;
- 前端 JS 插件按 Loader 规范提供 entries（如 index.js）

一、前端+后端同清单（单目录）示例
- 清单：[`filename`](backend_projects/SmartTavern/plugins/example-backend-client/manifest.json)
- 入口 JS：[`javascript.function(activate)`](backend_projects/SmartTavern/plugins/example-backend-client/index.js:1)
- 后端 Python：[`filename`](api/plugins/SmartTavern/example_backend/example_backend.py)

清单写法（同时声明 entries 与 backend_entries）：
```json
{
  "name": "Example Backend Client",
  "description": "Frontend plugin that calls backend plugin APIs",
  "entries": ["index.js"],
  "backend_entries": [
    "api/plugins/SmartTavern/example_backend/example_backend.py"
  ]
}
```

可选后端入口写法（backend_entries 的每一项三选一）：
- 文件路径（仓库相对）：`"api/plugins/SmartTavern/example_backend/example_backend.py"`
- 目录路径（会自动寻找“同名实现文件 example_backend.py”）：`"api/plugins/SmartTavern/example_backend"`
- 点式模块路径：`"api.plugins.SmartTavern.example_backend.example_backend"`

二、仅后端（独立目录，仅注册 Python API）示例
- 为了与前端解耦，可以为后端单独建一个插件目录并仅提供 backend_entries

示例清单（仅后端）：
```json
{
  "name": "Example Backend (server only)",
  "backend_entries": [
    "api/plugins/SmartTavern/example_backend/example_backend.py"
  ]
}
```

三、前端调用后端 API 示例（fetch）
- 后端已注册如下路由（小写 smarttavern）：
  - GET/POST `/api/plugins/smarttavern/example_backend/info`
  - GET/POST `/api/plugins/smarttavern/example_backend/echo`

最小调用示例：
```js
const base = window.location.origin;

// Echo
await fetch(`${base}/api/plugins/smarttavern/example_backend/echo`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ text: 'hello' })
}).then(r => r.json());

// Info
await fetch(`${base}/api/plugins/smarttavern/example_backend/info`, { method: 'GET' })
  .then(r => r.json());
```

四、加载验证与日志
- 启动后端时会打印：
  - “Plugin backend loader: manifests=&lt;数量&gt;, imported=&lt;成功模块数&gt;, skipped=&lt;跳过项&gt;”
- imported ≥ 1 表示至少有一个 backend_entries 成功导入并触发了路由注册

五、常见问题
- 清单中一定要写 backend_entries 吗？
  - 若启用“选择性注册”模式（已默认开启），需要。否则后端不会注册该插件的 Python API
- backend_entries 的路径大小写如何填写？
  - 与仓库真实路径一致（如 api/plugins/SmartTavern/...）
- 为什么路由是小写 smarttavern？
  - 约定 register_api 的 path 使用小写（如 "smarttavern/example_backend/echo"），统一外部访问路径
- 能否动态 reload/unload 插件后端？
  - 当前选择性注册发生在启动时。若需运行时管理，可后续扩展管理 API（如 /api/plugins_admin/reload），不在本次范围内

六、开发 checklist
- 后端
  - 在 api/plugins/SmartTavern/&lt;plugin&gt;/&lt;plugin&gt;.py 中实现并使用 [python.function(register_api)](core/api_registry.py:148) 注册，path 使用小写 smarttavern 前缀
  - 在插件清单中声明 backend_entries（文件/目录/点式模块三种写法任意其一）
- 前端
  - 在 manifest.json 的 entries 中声明入口 JS（如 index.js）
  - 通过 fetch('/api/plugins/smarttavern/...') 调用后端
  - 参考示例 JS：[`javascript.function(activate)`](backend_projects/SmartTavern/plugins/example-backend-client/index.js:1)
