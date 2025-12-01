# SmartTavern.prompt_raw 工作流说明

位置：api/workflow/smarttavern/prompt_raw/

本工作流负责“原始装配（RAW）”：基于输入的预设文档、世界书、原始对话历史（可不含 source）、角色与用户画像，组装得到完整的提示词 messages（含来源字段 source）。内部调度 in_chat_constructor（对话内注入）与 framing_prompt（前缀装配），输出单一 messages 数组，顺序即最终送模的提示词顺序。

相关代码
- 注册封装层：[filename](api/workflow/smarttavern/prompt_raw/prompt_raw.py)
  - 工作流 API 注册：[python.function(assemble_full)](api/workflow/smarttavern/prompt_raw/prompt_raw.py:71)
- 实现层（核心逻辑）：[filename](api/workflow/smarttavern/prompt_raw/impl.py)
  - 入口实现与流程：[python.function(assemble_full)](api/workflow/smarttavern/prompt_raw/impl.py:35)
  - 提取 prompts 数组工具：[python.function(_extract_prompts)](api/workflow/smarttavern/prompt_raw/impl.py:13)
  - 拆分 relative/in-chat 工具：[python.function(_split_presets)](api/workflow/smarttavern/prompt_raw/impl.py:21)
- 测试用例：
  - [filename](api/workflow/smarttavern/prompt_raw/test_prompt_workflow.py)

API 列表
- smarttavern/prompt_raw/assemble_full（RAW 装配：prefix + in-chat）
  - 注册定义：[python.function(assemble_full)](api/workflow/smarttavern/prompt_raw/prompt_raw.py:71)

模块职责与流程
- 输入均为“JSON 文档对象/数组”，不读取文件路径。文档格式参考 backend_projects/SmartTavern/data。
- 装配流程：
  1) 组合世界书（不做深度合并）：上游直接传入最终 world_books（必要时可把角色文档的 entries 自行合入）
  2) in-chat 注入：拆分 presets 内 position=="in-chat" 的预设，调用 modules/smarttavern/in_chat_constructor/construct，得到“带来源”的 in-chat 对话块
     - 调用点：[python.function(assemble_full)](api/workflow/smarttavern/prompt_raw/impl.py:67)
  3) 前缀装配：将步骤 2 的结果放入 framing 的 history（容器 {"messages":[...]}），调用 modules/smarttavern/framing_prompt/assemble，产出最终 messages（prefix + in-chat 块）
     - 调用点：[python.function(assemble_full)](api/workflow/smarttavern/prompt_raw/impl.py:84)
- 输出的 messages 中每条都含 {role, content, source}，source.type 枚举覆盖 history.*, preset.*, world_book.*, char.description, persona.description 等

输入/输出契约
- 输入（JSON Schema 概览。详细请见注册层定义：[python.function(assemble_full)](api/workflow/smarttavern/prompt_raw/prompt_raw.py:25)）
  - presets: object（必填）
    - 包含 prompts 数组，结构参考 [filename](backend_projects/SmartTavern/data/presets/Default.json)
  - world_books: array | object（必填）
    - 支持嵌套 [[{...}], {...}]，结构参考 [filename](backend_projects/SmartTavern/data/world_books/参考用main_world.json)
  - history: array（必填）
    - OpenAI Chat messages：[{role, content}]；可不含 source；也可传 {"messages":[...]} 的容器
  - character?: object（可选）
    - 角色文档对象，若 framing 需要 charDescription 占位符会读取 description 字段
  - persona?: object（可选）
    - 用户画像文档对象，若 framing 需要 personaDescription 占位符会读取 description 字段
- 输出（JSON）
  - messages: array
    - 完整提示词数组，元素为 { role, content, source }；字段顺序 role → content → source

内部调用的下游模块
- in_chat_constructor（对话内注入）
  - 接口：modules/smarttavern/in_chat_constructor/construct
  - 文档：[filename](api/modules/SmartTavern/in_chat_constructor/README.md)
- framing_prompt（前缀装配）
  - 接口：modules/smarttavern/framing_prompt/assemble
  - 文档：[filename](api/modules/SmartTavern/framing_prompt/README.md)

触发与过滤（说明）
- in_chat_constructor
  - 仅处理 position=="in-chat" 的预设与非 before_char/after_char 的世界书
  - 世界书 mode=="conditional" 且 keys 命中“原始历史文本”（区分大小写）才会注入；keys==0 表示不触发
- framing_prompt
  - 仅处理 relative 预设；在 chatHistory 占位处插入步骤 2 的“带来源历史”
  - 处理 before_char / after_char 世界书；conditional + keys 匹配逻辑等价；keys==0 表示不触发

调用示例（Python SDK）
```python
import core, json

# 假设已从磁盘读入以下文档对象（示例）：
# presets_doc = json.load(open("backend_projects/SmartTavern/data/presets/Default.json"))
# world_books_doc = json.load(open("backend_projects/SmartTavern/data/world_books/参考用main_world.json"))
# conversation_doc = json.load(open("backend_projects/SmartTavern/data/conversations/111.json"))

payload = {
  "presets": presets_doc,
  "world_books": world_books_doc,
  "history": conversation_doc,
  "character": {"name":"心与露","description":"角色设定：温柔体贴。"},
  "persona": {"name":"用户甲","description":"画像：程序员。"}
}

res = core.call_api("smarttavern/prompt_raw/assemble_full", payload, method="POST", namespace="workflow")
# 返回：{"messages":[...]}，每条含 {role, content, source}
```

测试
- 测试脚本： [filename](api/workflow/smarttavern/prompt_raw/test_prompt_workflow.py)
- 运行（仓库根目录）：
  ```bash
  python api/workflow/smarttavern/prompt_raw/test_prompt_workflow.py
  ```
- 测试覆盖点：
  - 输入为“原始 history（无 source）”时，最终 messages 中应存在 source.type=="history.*" 的消息
  - 覆盖用户位世界书（mode="conditional"）在有关键词时被触发的断言

注意事项与边界
- 本工作流不做文件 IO；仅面向 JSON 文档对象
- 世界书/预设的精确“触发、排序、插入、来源”逻辑由下游模块负责；本工作流只调度
- 若下游模块异常，建议上层采用回退策略（测试脚本示例中提供了 framing/in-chat 的回退组合调用）
- 建议在调用本工作流之前，尽量将预设/世界书整理为最终可用的结构，避免工作流中额外合并逻辑

实现索引（源码锚点）
- 工作流注册：[python.function(assemble_full)](api/workflow/smarttavern/prompt_raw/prompt_raw.py:71)
- 工作流实现流程：[python.function(assemble_full)](api/workflow/smarttavern/prompt_raw/impl.py:35)
- in-chat 调用点：[python.function(assemble_full)](api/workflow/smarttavern/prompt_raw/impl.py:67)
- framing 调用点：[python.function(assemble_full)](api/workflow/smarttavern/prompt_raw/impl.py:84)