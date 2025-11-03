# SmartTavern.prompt_postprocess 工作流说明

位置：api/workflow/smarttavern/prompt_postprocess/

本工作流对一份“规范化的 messages（带或不带 source）”执行单视图的后处理流水线，仅处理入参指定的 view（user_view 或 assistant_view），流水线固定为：
- before_macro 的正则替换（按视图）
- 宏处理（始终执行，仅读写 content，保留其他字段）
- after_macro 的正则替换（按视图）

相关代码
- 注册封装层：[python.prompt_postprocess.prompt_postprocess.py](api/workflow/smarttavern/prompt_postprocess/prompt_postprocess.py:1)
  - API 注册与 Schema：[python.function(apply)](api/workflow/smarttavern/prompt_postprocess/prompt_postprocess.py:69)
- 实现层（核心逻辑）：[python.prompt_postprocess.impl.py](api/workflow/smarttavern/prompt_postprocess/impl.py:1)
  - 工作流主入口（单视图）：[python.function(apply)](api/workflow/smarttavern/prompt_postprocess/impl.py:94)
  - 单视图正则适配器（messages）：[python.function(_regex_apply_messages)](api/workflow/smarttavern/prompt_postprocess/impl.py:37)
  - 宏处理适配器（messages，返回 variables）：[python.function(_macro_process_messages)](api/workflow/smarttavern/prompt_postprocess/impl.py:63)
- 依赖模块
  - 正则模块（单视图 API）：[python.regex_replace.regex_replace.py](api/modules/SmartTavern/regex_replace/regex_replace.py:22)
  - 宏模块：smarttavern/macro/process，参考模块文档：[filename](api/modules/SmartTavern/macro/README.md)
- 测试用例： [filename](api/workflow/smarttavern/prompt_postprocess/test_prompt_postprocess_workflow.py)

API 列表
- smarttavern/prompt_postprocess/apply（单视图后处理流水线）
  - 注册位置：[python.function(apply)](api/workflow/smarttavern/prompt_postprocess/prompt_postprocess.py:69)

功能与规则
- 输入是一份 canonical messages（建议来自 framing_prompt 或 in_chat_constructor 的输出），输出为单视图结果与宏变量表。
- 正则替换
  - 使用 modules/smarttavern/regex_replace/apply_messages 单视图 API
  - placement ∈ {"before_macro","after_macro"}
  - 规则按 view 过滤，按 targets（基于 source.type）命中消息，仅替换 content
- 宏处理
  - 使用 modules/smarttavern/macro/process
  - 始终执行；仅替换 content，保留 message 的 role 与 source
  - 输出 variables: {initial, final}

输入/输出契约
- 输入（JSON Schema 概览，详见注册层定义：[python.function(apply)](api/workflow/smarttavern/prompt_postprocess/prompt_postprocess.py:46)）
  - messages: array（[{role, content, source?}]）
    - role ∈ {"system","user","assistant","thinking"}
    - content: string
    - source: object（建议包含 source.type 以便正则 targets 命中）
  - regex_rules: array | object（数组或 {regex_rules:[...]} 容器；格式参考 [filename](backend_projects/SmartTavern/data/presets/Default.json) 的 regex_rules）
  - view: "user_view" | "assistant_view"
  - variables: object（可选；作为宏初始变量注入）
    - 提示：variables 支持“点号 + 方括号”的嵌套路径访问与赋值（如 a.b[1].c、a['复杂.key']），宏与沙盒均已支持
- 输出（JSON）
  - message: array（单视图处理后的消息数组，仅 content 可能被改变）
  - variables: {initial:object, final:object}

处理流程（单视图）
1) before_macro: 调用 regex_replace/apply_messages 执行本视图的 before_macro 规则
2) macro: 调用 macro/process 替换 content（保留 source），并产出 variables
3) after_macro: 再次调用 regex_replace/apply_messages 执行本视图的 after_macro 规则

调用示例（Python SDK）
```python
import core

messages = [
  {"role":"system","content":"<b>System</b>", "source":{"type":"preset.relative","position":"relative","id":"p0"}},
  {"role":"user","content":"你好 <x>标签</x>", "source":{"type":"history.user","id":"history_0","index":0}},
  {"role":"assistant","content":"<StatusPlaceHolderImpl/> 回复", "source":{"type":"history.assistant","id":"history_1","index":1}},
]

rules = {
  "regex_rules": [
    {
      "id":"remove_xml_tags",
      "enabled": True,
      "find_regex": "<([a-zA-Z0-9]+)>(.|\\n)*?</\\1>",
      "replace_regex": "移除xml",
      "targets": ["preset","history","world_book"],
      "placement": "before_macro",
      "views": ["user_view","assistant_view"]
    },
    {
      "id":"status_bar_demo",
      "enabled": True,
      "find_regex": "<StatusPlaceHolderImpl/>",
      "replace_regex": "这里是状态栏",
      "targets": ["history"],
      "placement": "after_macro",
      "views": ["user_view"]
    }
  ]
}

res = core.call_api(
  "smarttavern/prompt_postprocess/apply",
  {"messages": messages, "regex_rules": rules, "view": "user_view", "variables": {"x": "y"}},
  method="POST",
  namespace="workflow"
)
# 返回：{"message":[...], "variables": {"initial":{...}, "final":{...}}}
```

注意事项与边界
- 规则视图过滤：view 不匹配的规则不会应用到该视图
- placement 错配或非法：正则调用将直接回退输出原 messages
- 规则 find_regex 编译失败：忽略该条规则，不抛异常
- 宏处理失败：回退原 messages（仅该阶段回退），variables 为空对象
- messages 的 content 非字符串会被转为字符串（None → ""）
- depth 窗口与 targets 匹配逻辑由 regex_replace 模块负责，详见其 README 与实现

与其他模块关系
- framing_prompt：负责“对话前缀（relative + before/after 世界书）”的装配与来源规范化，参考：[filename](api/modules/SmartTavern/framing_prompt/README.md)
- in_chat_constructor：负责“对话内注入（in-chat 预设/世界书）”，参考：[filename](api/modules/SmartTavern/in_chat_constructor/README.md)
- regex_replace：本工作流调用其单视图 API 完成按视图的正则替换，参考：[filename](api/modules/SmartTavern/regex_replace/README.md)
- macro：宏系统作为中间阶段，参考：[filename](api/modules/SmartTavern/macro/README.md)

运行与测试
- 建议先通过 framing_prompt/in_chat_constructor 产出带 source 的 messages，再调用本工作流验证
- 测试脚本： [filename](api/workflow/smarttavern/prompt_postprocess/test_prompt_postprocess_workflow.py)