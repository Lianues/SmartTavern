# SmartTavern.in_chat_constructor 模块说明

位置：api/modules/SmartTavern/in_chat_constructor/

本模块在“对话历史”基础上，按 depth/order 规则将 in-chat 预设与世界书（非 before/after 的条目）注入为带来源字段的 OpenAI Chat messages 序列。模块只做“对话内（in-chat）”的注入与来源标注，不合并相邻同角色消息，且对“条件触发（mode + condition）”进行判断；condition 是宏表达式，必须输出 'true'/'false'。

相关代码
- 注册封装层：[python.in_chat_constructor.in_chat_constructor.py](api/modules/SmartTavern/in_chat_constructor/in_chat_constructor.py:1)
  - 注册与 Schema 定义：[python.register_api()](api/modules/SmartTavern/in_chat_constructor/in_chat_constructor.py:11)
  - 封装层入口：[python.construct()](api/modules/SmartTavern/in_chat_constructor/in_chat_constructor.py:58)
- 实现层（核心逻辑）：[python.in_chat_constructor.impl.py](api/modules/SmartTavern/in_chat_constructor/impl.py:1)
  - 入口实现：[python.construct()](api/modules/SmartTavern/in_chat_constructor/impl.py:162)
  - 世界书/预设扁平化：[python._flatten_world_books()](api/modules/SmartTavern/in_chat_constructor/impl.py:37)
  - 候选排序（order → 角色优先级 → internal_order）：[python._sort_sources()](api/modules/SmartTavern/in_chat_constructor/impl.py:56)
  - 历史文本拼接（供 keywords 宏判定）：[python.function(_collect_history_text)](api/modules/SmartTavern/in_chat_constructor/impl.py:69)
  - 条件触发（mode + condition）：[python.function(_eval_condition_text)](api/modules/SmartTavern/in_chat_constructor/impl.py:186)
  - 历史来源构造（规范化 type）：[python._build_source_for_history()](api/modules/SmartTavern/in_chat_constructor/impl.py:104)
  - 预设来源构造（preset.in-chat）：[python._build_source_for_preset()](api/modules/SmartTavern/in_chat_constructor/impl.py:123)
  - 世界书来源构造（world_book.in-chat）：[python._build_source_for_wb()](api/modules/SmartTavern/in_chat_constructor/impl.py:140)
- 测试脚本：
  - [python.test_in_chat_constructor.py](api/modules/SmartTavern/in_chat_constructor/test_in_chat_constructor.py:1)
- 参考数据：
  - [json.Default Presets（示例）](backend_projects/SmartTavern/data/presets/Default.json:1)
  - [json.World Books（示例）](backend_projects/SmartTavern/data/world_books/参考用main_world.json:1)

API 列表
- smarttavern/in_chat_constructor/construct（对话内构造）
  - 注册定义：[python.register_api()](api/modules/SmartTavern/in_chat_constructor/in_chat_constructor.py:11)
  - 封装层函数：[python.construct()](api/modules/SmartTavern/in_chat_constructor/in_chat_constructor.py:58)

模块职责与规则
- 输入 history 按原顺序作为基底，首先被标准化为带来源的消息：
  - source 形如 {"type":"history.user|history.assistant|history.thinking","id":"history_i","index":i}（见 [python._build_source_for_history()](api/modules/SmartTavern/in_chat_constructor/impl.py:104)）
- 仅处理 position=="in-chat" 的预设条目与“非 before_char/after_char”的世界书条目
- 过滤规则：
  - 预设：position=="in-chat" 且 enabled 视为启用；content 为非空字符串
  - 世界书：position 不在 {"before_char","after_char"}；enabled；content 非空；当 mode=="conditional" 时需 condition 宏为 'true'
- 条件触发 condition（严格布尔）：
  - mode=="conditional" 时，执行 condition 宏表达式，输出 'true' 或 'false'（大小写均可）；结果为 'true' 才注入
  - condition 典型写法：
    - "<<keywords:艾拉,工程师>>"（基于 variables.chat_history_text 的关键词任一命中）
    - "{{python:legacy_num(getvar('stat_data.心.醋意值[0]'),0) >= 30}}"
  - 本模块在求值前自动注入 variables.chat_history_text（由历史消息 content 拼接）
- 排序与插入：
  - 候选（预设/世界书）统一按 order 升序 → 角色优先级（assistant < user < system）→ internal_order 稳定排序（见 [python._sort_sources()](api/modules/SmartTavern/in_chat_constructor/impl.py:56)）
  - 按 depth 分组；每组的插入下标 insertion_index = len(constructed) - depth（若为负置 0）
  - 组内逆序插入，以保持排序后的相对顺序
- 角色与来源：
  - 预设：使用条目 role（非法值回退为 user），source.type 固定为 preset.in-chat（见 [python._build_source_for_preset()](api/modules/SmartTavern/in_chat_constructor/impl.py:123)）
  - 世界书：role 由 position→role 映射（assistant/user/system），source.type 固定为 world_book.in-chat（见 [python._build_source_for_wb()](api/modules/SmartTavern/in_chat_constructor/impl.py:140)）
  - 世界书原始 id 字段会迁移为 source.wb_id，避免与 source.id 冲突

API：construct（smarttavern/in_chat_constructor/construct）
- 输入（JSON Schema 概览，详见注册层定义 [python.register_api()](api/modules/SmartTavern/in_chat_constructor/in_chat_constructor.py:11)）
  - history: array（必填）
    - OpenAI Chat messages：[{role: "system|user|assistant|thinking", content: string}]
    - 模块会为其补充 source 字段并作为构造基底
  - presets_in_chat: array（必填）
    - 仅识别 position=="in-chat" 且 enabled 的条目；读取字段 role/depth/order/content
  - world_books: array | object（必填）
    - 支持嵌套 [[{...}], {...}]；仅处理 position 非 {"before_char","after_char"} 的条目
    - 条目字段示例可参考 [json.参考用main_world.json](backend_projects/SmartTavern/data/world_books/参考用main_world.json:1)
- 输出（JSON）
  - messages: array
    - 每条消息含 { role, content, source }，source.type 枚举包含：
      - history.user / history.assistant / history.thinking（来自基底历史）
      - preset.in-chat（来自 in-chat 预设）
      - world_book.in-chat（来自 in-chat 世界书）

行为细节
- 历史标准化：非字符串 content 将转换为字符串（None→""）；非法 role 抛出异常
- 预设候选：identifier/name/depth/order/role 等原字段会按“原条目键顺序”复制到 source，保持 UI 可追溯性
- 世界书候选：
  - mode=="always"：直接加入候选
  - mode=="conditional"：仅当 condition 宏为 'true' 时加入（见 [python.function(_eval_condition_text)](api/modules/SmartTavern/in_chat_constructor/impl.py:186)）
  - position→role 映射：assistant/user/system（见 [python._map_wb_pos_to_role()](api/modules/SmartTavern/in_chat_constructor/impl.py:28)）
- 插入顺序：
  - 先排序，后按 depth 组分发插入；不同 depth 可能插入到历史末尾之前的不同位置
  - 不合并相邻同角色，保持单条来源标注
- 变量与宏：
  - 模块在求值 condition 前会注入 variables.chat_history_text 作为历史拼接文本
  - keywords 宏严格返回 'true'/'false'；详见 [markdown.file(macro/README.md)](api/modules/SmartTavern/macro/README.md:1)
  - keys 字段已废弃且不再兼容，请统一使用 mode + condition

调用示例（Python SDK）
- 见 [python.core.call_api()](core/api_client.py:227)
- 请求：
  {
    "history": [
      {"role": "system", "content": "系统开场"},
      {"role": "user", "content": "你好艾拉"}
    ],
    "presets_in_chat": [
      {"position":"in-chat","enabled":true,"role":"system","depth":0,"order":98,"identifier":"示例","content":"系统注入示例"}
    ],
    "world_books": [
      [
        {"id":2,"name":"艾拉的背景","condition":"<<keywords:艾拉,工程师>>","content":"艾拉是机械工程师","mode":"conditional","position":"user","depth":0,"order":101,"enabled":true}
      ]
    ]
  }
- 代码：
  res = core.call_api(
    "smarttavern/in_chat_constructor/construct",
    {
      "history": [
        {"role":"system","content":"系统开场"},
        {"role":"user","content":"你好艾拉"}
      ],
      "presets_in_chat": [
        {"position":"in-chat","enabled":True,"role":"system","depth":0,"order":98,"identifier":"示例","content":"系统注入示例"}
      ],
      "world_books": [
        [{"id":2,"name":"艾拉的背景","condition":"<<keywords:艾拉,工程师>>","content":"艾拉是机械工程师","mode":"conditional","position":"user","depth":0,"order":101,"enabled":True}]
      ]
    },
    method="POST",
    namespace="modules"
  )

curl 示例（假设网关端口 8050）
- POST http://127.0.0.1:8050/api/modules/smarttavern/in_chat_constructor/construct
- 请求体（JSON）与上例相同

返回示例（节选）
- messages:
  [
    {"role":"system","content":"系统开场","source":{"type":"history.system","id":"history_0","index":0}},
    {"role":"user","content":"你好艾拉","source":{"type":"history.user","id":"history_1","index":1}},
    {"role":"system","content":"系统注入示例","source":{"type":"preset.in-chat","id":"preset_示例","identifier":"示例","depth":0,"order":98,"role":"system", "...": "..."}},
    {"role":"user","content":"艾拉是机械工程师","source":{"type":"world_book.in-chat","id":"wb_2","wb_id":2,"name":"艾拉的背景","mode":"conditional","position":"user","depth":0,"order":101,"role":"user"}}
  ]

错误与边界
- 非法 role（不在 system/user/assistant/thinking）：实现层将抛出 ValueError
- content 不是字符串：将转换为字符串（None → ""）
- 预设/世界书条目字段结构非法或缺失时：会被跳过
- keys 判定大小写敏感；keys 缺失/为空数组/==0 时均视为“不触发”

测试
- 内置测试脚本（会启动网关、加载模块并断言返回结构）：
  - [python.test_in_chat_constructor.py](api/modules/SmartTavern/in_chat_constructor/test_in_chat_constructor.py:1)
- 运行（仓库根目录）：
  python api/modules/SmartTavern/in_chat_constructor/test_in_chat_constructor.py

参考
- 注册层： [python.in_chat_constructor.in_chat_constructor.py](api/modules/SmartTavern/in_chat_constructor/in_chat_constructor.py:1)
- 实现层： [python.in_chat_constructor.impl.py](api/modules/SmartTavern/in_chat_constructor/impl.py:1)
- 相关模块（framing/prefix 构建 before/after 世界书与预设）： [python.framing_prompt.framing_prompt.py](api/modules/SmartTavern/framing_prompt/framing_prompt.py:1), [python.assemble()](api/modules/SmartTavern/framing_prompt/impl.py:297)