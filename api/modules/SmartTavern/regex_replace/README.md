# SmartTavern.regex_replace 模块说明
位置：api/modules/SmartTavern/regex_replace/

本模块提供“基于规则的正则替换”能力，支持对消息数组或纯文本进行替换，区分 before_macro/after_macro 两个阶段，并按视图（user_view/assistant_view）选择性应用规则。对 messages 的处理仅替换 content 字段，保留 role/source 等其他字段不变。

相关代码
- 注册封装层：[python.regex_replace.regex_replace.py](api/modules/SmartTavern/regex_replace/regex_replace.py:1)
  - API：消息数组单视图 [python.apply_messages()](api/modules/SmartTavern/regex_replace/regex_replace.py:70)
  - API：纯文本单视图 [python.apply_text()](api/modules/SmartTavern/regex_replace/regex_replace.py:120)
- 实现层（核心逻辑）：[python.regex_replace.impl.py](api/modules/SmartTavern/regex_replace/impl.py:1)
  - 消息单视图实现：[python.apply_regex_messages_view()](api/modules/SmartTavern/regex_replace/impl.py:324)
  - 文本单视图实现：[python.apply_regex_text_view()](api/modules/SmartTavern/regex_replace/impl.py:368)
  - 规则规范化：[python._normalize_rules()](api/modules/SmartTavern/regex_replace/impl.py:47)
  - 深度计算（messages）：[python._compute_depths()](api/modules/SmartTavern/regex_replace/impl.py:93)
  - 目标匹配（基于 source.type 前缀/精确）：[python._matches_targets()](api/modules/SmartTavern/regex_replace/impl.py:137)
  - 过滤 placement 与视图：[python._filter_rules_by_view_and_placement()](api/modules/SmartTavern/regex_replace/impl.py:188)
- 测试用例：
  - [python.test_regex_replace.py](api/modules/SmartTavern/regex_replace/test_regex_replace.py:1)
- 示例规则数据（格式参考）：
  - [json.Default Presets.regex_rules](backend_projects/SmartTavern/data/presets/Default.json:12)

API 列表
- smarttavern/regex_replace/apply_messages（对“消息数组”的单视图替换）
  - 注册定义：[python.apply_messages()](api/modules/SmartTavern/regex_replace/regex_replace.py:70)
- smarttavern/regex_replace/apply_text（对“纯文本”的单视图替换）
  - 注册定义：[python.apply_text()](api/modules/SmartTavern/regex_replace/regex_replace.py:120)

模块职责与处理语义
- 视图与阶段：
  - view: "user_view" | "assistant_view"（必选单视图）
  - placement: "before_macro" | "after_macro"
- 对 messages 的处理：
  - 规则会先按 placement 过滤，再按 view 过滤
  - 计算每条消息的 depth 值（参见 [python._compute_depths()](api/modules/SmartTavern/regex_replace/impl.py:93)），仅在 depth 窗口内的消息会应用对应规则
  - 仅替换 content 字段；role/source 等原样保留
  - targets 匹配基于 source.type（精确或前缀大类），角色不参与 targets 匹配
- 对 text 的处理：
  - 忽略 depth 与 targets，默认对整段文本应用符合 placement+view 的规则
  - 返回单个 text 字段
- 规则数组来源：
  - 可直接传数组，或传 {"regex_rules": [...]} 容器（见 [python._normalize_rules()](api/modules/SmartTavern/regex_replace/impl.py:47)）

规则字段约定
- enabled: boolean（true 时启用）
- mode: "always" | "conditional"（默认为 "always"）
- condition: string（当 mode=="conditional" 时生效；宏表达式必须输出 'true' 或 'false'（大小写均可）；'true' 才应用该规则）
- find_regex: string（正则表达式）
- replace_regex: string（替换表达式，支持 $1 → \g<1> 自动转换）
- placement: "before_macro" | "after_macro"（必需）
- views: ["user_view","assistant_view"]（至少一个）
- targets: string[]（仅 messages；与 source.type 匹配）
  - 精确匹配：完整 source.type，例如 "preset.in-chat"、"world_book.before_char"
  - 前缀大类：支持 "preset" | "world_book" | "history" | "char" | "persona"
    - 命中规则：stype == prefix 或 stype 以 "prefix." 开头
- min_depth / max_depth: number（仅 messages；缺省等价于 [0, +∞)）
- 其他任意自定义字段允许被透传（不影响执行）
- variables（由上游工作流透传，可选）：作为宏求值的初始变量环境；本模块不会修改该对象

深度（depth）计算规则（仅 messages，详见实现注释）
- 过滤掉 source.type 为 relative 预设的消息（仅用于锚点过滤，不影响最终输出），参见 [python._is_relative_preset_source()](api/modules/SmartTavern/regex_replace/impl.py:81)
- 将 role ∈ {"user","assistant"} 的消息索引作为锚点
- 对每个索引 i，depth(i) = “锚点索引中 ≥ i 的数量”
- 若无锚点，所有消息 depth=0
- 规则的 depth 窗口为 [min_depth, max_depth]（闭区间；各自缺省为 0 和 +∞）

API：apply_messages（smarttavern/regex_replace/apply_messages）
- 输入（JSON Schema 概览，详见注册层定义 [python.apply_messages()](api/modules/SmartTavern/regex_replace/regex_replace.py:22)）
  - regex_rules: array | object（数组或 {regex_rules:[...]}）
  - placement: "before_macro" | "after_macro"
  - view: "user_view" | "assistant_view"
  - messages: [{role, content, source?}]
    - role ∈ {"system","user","assistant","thinking"}
    - content: string
    - source: object（建议包含 type 以便 targets 匹配）
- 输出（JSON）
  - message: 与输入 messages 等长的数组，仅 content 可能变化

API：apply_text（smarttavern/regex_replace/apply_text）
- 输入（JSON Schema 概览，详见注册层定义 [python.apply_text()](api/modules/SmartTavern/regex_replace/regex_replace.py:96)）
  - regex_rules: array | object（数组或 {regex_rules:[...]}）
  - placement: "before_macro" | "after_macro"
  - view: "user_view" | "assistant_view"
  - text: string
- 输出（JSON）
  - text: 替换后的字符串

调用示例（Python SDK）
- 对 messages 的单视图替换：
  ```python
  import core
  payload = {
    "regex_rules": [
      {
        "id": "remove_xml_tags_rule",
        "name": "Remove XML Tags",
        "enabled": True,
        "find_regex": "<([a-zA-Z0-9]+)>(.|\\n)*?</\\1>",
        "replace_regex": "移除xml",
        "targets": ["preset", "world_book", "history"],
        "placement": "before_macro",
        "views": ["user_view", "assistant_view"]
      }
    ],
    "placement": "before_macro",
    "view": "user_view",
    "messages": [
      {"role": "user", "content": "你好 <tag>X</tag> world", "source": {"type":"history.user","id":"h0","index":0}}
    ]
  }
  res = core.call_api("smarttavern/regex_replace/apply_messages", payload, method="POST", namespace="modules")
  # res = {"message":[{...}]}
  ```
- 对 text 的单视图替换：
  ```python
  payload = {
    "regex_rules": {"regex_rules":[
      {"enabled": True, "find_regex": "<x>(.*?)</x>", "replace_regex": "移除xml", "placement":"before_macro", "views":["assistant_view"]}
    ]},
    "placement": "before_macro",
    "view": "assistant_view",
    "text": "<x>abc</x> 123"
  }
  res = core.call_api("smarttavern/regex_replace/apply_text", payload, method="POST", namespace="modules")
  # res = {"text":"移除xml 123"}
  ```

与工作流集成
- 后处理工作流会分别按视图调用本模块的 apply_messages，形成两条流水线（before_macro → 宏? → after_macro）：
  - 工作流注册层：[python.prompt_postprocess.prompt_postprocess.py](api/workflow/smarttavern/prompt_postprocess/prompt_postprocess.py:25)
  - 工作流实现层中调用本模块：[python._regex_apply_messages()](api/workflow/smarttavern/prompt_postprocess/impl.py:61)

行为细节与边界
- view 非法或未提供：不执行替换，直接返回原数据（messages 原样或 text 原文）
- placement 非法：不执行替换
- 规则视图为空或非法：规则被忽略
- find_regex 编译失败：忽略该规则，不抛异常
- replace_regex 的 $1/$2 将自动转为 Python 风格 \g<1>（见 [python._transform_replacement()](api/modules/SmartTavern/regex_replace/impl.py:60)）
- messages 的 content 若非字符串，将尝试转字符串；None 视为空串
- targets 未提供或空：视为匹配所有来源类型
- targets 仅基于 source.type 前缀/精确匹配，不再支持按 role 过滤
- 深度窗口仅对 messages 生效；text 忽略深度/targets

测试
- 内置测试覆盖 messages/text 与 before_macro/after_macro 两种情形：
  - [python.test_regex_replace.py](api/modules/SmartTavern/regex_replace/test_regex_replace.py:1)
- 运行（仓库根目录）：
  ```bash
  python api/modules/SmartTavern/regex_replace/test_regex_replace.py
  ```

参考
- 注册层： [python.regex_replace.regex_replace.py](api/modules/SmartTavern/regex_replace/regex_replace.py:1)
- 实现层： [python.regex_replace.impl.py](api/modules/SmartTavern/regex_replace/impl.py:1)
- 工作流： [python.prompt_postprocess.prompt_postprocess.py](api/workflow/smarttavern/prompt_postprocess/prompt_postprocess.py:1), [python.impl.apply()](api/workflow/smarttavern/prompt_postprocess/impl.py:139)
- 示例规则： [json.Default.json.regex_rules](backend_projects/SmartTavern/data/presets/Default.json:12)