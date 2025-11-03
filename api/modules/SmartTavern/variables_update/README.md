# SmartTavern.variables_update 模块说明

本模块提供“变量 JSON 操作策略”的统一 API，用于对任意两份 JSON（`base` 与 `overrides`）执行可配置的合并、替换、数组拼接/去重以及路径删除等操作。  
工作流侧也提供对“对话变量文件（conversations/{name}/variables.json）”的一键读取 + 策略应用。

- 模块实现核心：
  - 深度合并器：[_merge_arrays()](api/modules/SmartTavern/variables_update/impl.py:47)、[deep_merge()](api/modules/SmartTavern/variables_update/impl.py:65)
  - 策略调度器：[apply_operation()](api/modules/SmartTavern/variables_update/impl.py:213)
- 模块 API 封装（统一策略接口，仅此一个端点）：[api/modules/SmartTavern/variables_update/variables_update.py](api/modules/SmartTavern/variables_update/variables_update.py)
- 工作流封装与实现（读取对话 variables 再应用策略）：
  - 工作流封装：[api/workflow/smarttavern/variables_update/variables_update.py](api/workflow/smarttavern/variables_update/variables_update.py)
  - 工作流实现：[apply_to_conversation()](api/workflow/smarttavern/variables_update/impl.py:21)

---

## 1. 模块 API（统一策略接口）

- 路径：`/api/modules/smarttavern/variables_update/apply`
- 方法：POST
- 入参（JSON）：
  - `base` object：原始 JSON
  - `overrides` object：用于覆盖/合并/拼接的 JSON
  - `operation` string：操作策略（见下文）
    - 可选值：`"replace" | "shallow_merge" | "merge" | "deep_merge" | "append" | "union" | "remove"`
      - `"deep_merge"` 为 `"merge"` 的别名
  - `options` object（可选）：
    - `array_strategy` string：数组策略（见下文）
      - 可选值：`"replace" | "concat" | "union" | "prepend" | "union_by_key"`
    - `array_key` string：当 `array_strategy="union_by_key"` 时，用于从数组项对象读取唯一键的路径（支持点/方括号）
      - 例："items[0].id"、"items[].id"、"['id']"
    - `remove_paths` array：(string|integer)[] 用于路径删除（operation="remove" 或与合并组合使用）
      - 支持：`a.b[0]`、`x['k']`、`stats.角色.好感度` 等
- 出参（JSON）：
  - `result` object：策略应用后的完整 JSON

实现参考：[apply_operation()](api/modules/SmartTavern/variables_update/impl.py:213)

---

## 2. 操作策略（operation）

- `replace`：整体替换为 `overrides`
  - 忽略 `array_strategy`
- `shallow_merge`：顶层浅合并（Python dict.update 语义）
  - 仅对第一层键做覆盖/新增，不下钻
- `merge` / `deep_merge`：深度合并
  - 字典：递归合并；`overrides` 的键覆盖/新增 `base`
  - 数组：遵循 `options.array_strategy`（见下节）
  - 标量：`overrides` 覆盖 `base`
- `append`：深度合并 + 数组强制使用 `concat`（即便未传 `array_strategy`）
- `union`：深度合并 + 数组强制使用 `union`（按 JSON 序列化去重）
- `remove`：基于合并（默认深度合并，或配合 `array_strategy`）后，按 `options.remove_paths` 批量删除路径键
  - 亦可仅用于删除：令 `overrides={}`、`operation="remove"`、传入 `remove_paths`

底层行为由 [deep_merge()](api/modules/SmartTavern/variables_update/impl.py:65) 与 [_merge_arrays()](api/modules/SmartTavern/variables_update/impl.py:47) 保证。

---

## 3. 数组策略（options.array_strategy）

- `replace`（默认）：`baseArray` 被 `overridesArray` 整体替换
- `concat`：拼接 `base + overrides`
- `prepend`：前置拼接 `overrides + base`（当希望新条目排在前面时）
- `union`：按 JSON 值去重的并集（`base` 在前，后遇到重复则忽略）
- `union_by_key`：对“对象数组”按 `options.array_key` 指定的键进行去重并集
  - 如果某个数组项对象取不到 `array_key`，退化为按 JSON 值去重
  - `array_key` 语法支持点号与方括号，如：
    - `"id"`、`"item.id"`、`"items[0].id"`、`"['id']"`
    - 一般建议传 `"id"` 或 `"code"` 等单键路径

实现参考：[_merge_arrays()](api/modules/SmartTavern/variables_update/impl.py:47)

---

## 4. 路径删除（options.remove_paths）

- 作用：对合并结果进行后置“键删除”
- 语法支持：
  - 点号链路：`stats.角色.好感度`
  - 方括号索引：`arr[0]`
  - 方括号键名：`obj['k']` 或 `obj["k"]`
- 容错：越界或缺失路径将被忽略（不抛错）
- 实现参考：`_parse_path` 与 `_delete_by_path`（同文件内）

---

## 5. 示例

### 5.1 深度合并 + union 去重

请求
```json
POST /api/modules/smarttavern/variables_update/apply
{
  "base": { "a": 1, "arr": [1,2], "nested": { "k": "v", "rm": 0 } },
  "overrides": { "b": 2, "arr": [2,3], "nested": { "k": "v2" } },
  "operation": "merge",
  "options": { "array_strategy": "union", "remove_paths": ["nested.rm"] }
}
```

结果
```json
{
  "result": {
    "a": 1,
    "b": 2,
    "arr": [1,2,3],
    "nested": { "k": "v2" }
  }
}
```

### 5.2 前置拼接（prepend）

请求
```json
POST /api/modules/smarttavern/variables_update/apply
{
  "base": { "list": [2,3] },
  "overrides": { "list": [1] },
  "operation": "merge",
  "options": { "array_strategy": "prepend" }
}
```

结果
```json
{ "result": { "list": [1,2,3] } }
```

### 5.3 union_by_key（按键去重：对象数组）

请求
```json
POST /api/modules/smarttavern/variables_update/apply
{
  "base": { "items": [{ "id": 1, "v": "a" }, { "id": 2, "v": "b" }] },
  "overrides": { "items": [{ "id": 2, "v": "b2" }, { "id": 3, "v": "c" }] },
  "operation": "merge",
  "options": { "array_strategy": "union_by_key", "array_key": "id" }
}
```

结果（按 id 去重，保留顺序，重复 id=2 只保留第一次出现的对象）
```json
{
  "result": {
    "items": [
      { "id": 1, "v": "a" },
      { "id": 2, "v": "b" },
      { "id": 3, "v": "c" }
    ]
  }
}
```

### 5.4 仅删除路径（不合并）

请求
```json
POST /api/modules/smarttavern/variables_update/apply
{
  "base": { "nested": { "rm": true, "keep": 1 }, "arr": [10, 11] },
  "overrides": {},
  "operation": "remove",
  "options": { "remove_paths": ["nested.rm", "arr[0]"] }
}
```

结果
```json
{
  "result": {
    "nested": { "keep": 1 },
    "arr": [11]
  }
}
```

### 5.5 工作流：对话 variables 文件按策略应用

- 路径：`/api/workflow/smarttavern/variables_update/apply`
- 入参：
  - `file`: 对话主文件路径（仓库根相对），如 `"backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json"`
  - `overrides`: 变量覆盖 JSON（结构任意）
  - `operation`: 同上，默认 `"merge"`
  - `options`: 同上（支持 `array_strategy` / `array_key` / `remove_paths`）

请求
```json
POST /api/workflow/smarttavern/variables_update/apply
{
  "file": "backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json",
  "overrides": { "stat_overrides": { "心": { "好感度": 120 } } },
  "operation": "merge",
  "options": { "array_strategy": "union" }
}
```

结果（不落盘；如需持久化可调用 chat_branches.variables action=set）
```json
{
  "variables": {
    "...": "合并后的 variables JSON"
  },
  "variables_file": "backend_projects/SmartTavern/data/conversations/branch_demo/variables.json"
}
```

工作流实现参考：[apply_to_conversation()](api/workflow/smarttavern/variables_update/impl.py:21)

---

## 6. 典型使用场景

- 新建对话变量模板后，按“合并 + 去重”增量更新复杂嵌套结构（`operation=merge`, `array_strategy=union`）
- 对象数组基于业务主键去重（`operation=merge`, `array_strategy=union_by_key`, `array_key="id"`）
- 对话 UI 配置中，将用户输入覆盖在默认配置前面（`operation=merge`, `array_strategy=prepend`）
- 清理某些临时键（`operation=remove`, `remove_paths=["temp", "nodes.retry"]`）

---

## 7. 设计与兼容性

- 仅保留统一端点 `/api/modules/smarttavern/variables_update/apply`；不再提供单独 `merge` API。  
- 深度合并与数组策略通过 [deep_merge()](api/modules/SmartTavern/variables_update/impl.py:65) 和 [_merge_arrays()](api/modules/SmartTavern/variables_update/impl.py:47) 实现，保证可预测、可扩展。  
- 工作流结果默认不写回文件；需要保存时请调用对话模块 `/api/modules/smarttavern/chat_branches/variables`：
  - `{"action":"set", "file":"...", "data":"<上述返回的 variables>"}`

---

## 8. 注意事项 / 边界条件

- `union_by_key` 仅在数组元素为对象时才能按键去重；无法取到 `array_key` 时退化为按值去重。  
- `remove_paths` 中的路径若不存在/越界，会被忽略，不报错。  
- 若 `operation="replace"`，`array_strategy` 与 `remove_paths` 不起作用（直接替换）。  
- 对于非常深的嵌套与大型数组，请注意性能；必要时建议分块处理或约束数据规模。

---

## 9. 相关链接

- 核心策略函数：[apply_operation()](api/modules/SmartTavern/variables_update/impl.py:213)  
- 深度合并实现：[deep_merge()](api/modules/SmartTavern/variables_update/impl.py:65)  
- 数组合并实现：[_merge_arrays()](api/modules/SmartTavern/variables_update/impl.py:47)  
- 工作流实现：[apply_to_conversation()](api/workflow/smarttavern/variables_update/impl.py:21)
