# SmartTavern.framing_prompt 模块说明

位置：api/modules/SmartTavern/framing_prompt/

本模块用于在对话历史之前构建“框架提示词（framing/prefix）”，将 relative 预设占位符与世界书（before/after）转换为带来源标注的对话消息数组，并规范化历史消息的来源字段，便于后续处理链（宏、正则、渲染两视图等）。

相关代码
- 注册封装层：[python.framing_prompt.framing_prompt.py](api/modules/SmartTavern/framing_prompt/framing_prompt.py:1)
- 实现层（核心逻辑）：[python.framing_prompt.impl.py](api/modules/SmartTavern/framing_prompt/impl.py:1)
  - 入口实现：[python.assemble()](api/modules/SmartTavern/framing_prompt/impl.py:297)
  - 世界书抽取与排序：[python._world_info_messages()](api/modules/SmartTavern/framing_prompt/impl.py:239)
  - 历史文本拼接（用于 keys 匹配）：[python._collect_history_text()](api/modules/SmartTavern/framing_prompt/impl.py:82)
  - 条件触发（conditional + keys）：[python._is_triggered_by_keys()](api/modules/SmartTavern/framing_prompt/impl.py:94)
  - 历史来源规范化：[python._build_source_for_history()](api/modules/SmartTavern/framing_prompt/impl.py:119)
- 测试用例：
  - [python.test_framing_prompt.py](api/modules/SmartTavern/framing_prompt/test_framing_prompt.py:1)
  - [python.test_source_types_framing.py](api/modules/SmartTavern/framing_prompt/test_source_types_framing.py:1)
- 参考数据（示例）：
  - [json.Default Presets](backend_projects/SmartTavern/data/presets/Default.json:1)
  - [json.World Books 示例](backend_projects/SmartTavern/data/world_books/参考用main_world.json:1)
  - [json.Persona 示例](backend_projects/SmartTavern/data/persona/用户2.json:1)

API 列表
- smarttavern/framing_prompt/assemble（构建前缀提示词）
  - 注册定义：[python.assemble()](api/modules/SmartTavern/framing_prompt/framing_prompt.py:63)

模块职责与规则
- 输入 history 可为：
  1) 原始 OpenAI messages（不含 source）；将自动补齐来源 source={"type":"history.user|assistant|thinking","id":"history_i","index":i}（见 [python._build_source_for_history()](api/modules/SmartTavern/framing_prompt/impl.py:119)）
  2) 已处理过的 messages（含 source）；将透传原 source，不覆盖
- 仅处理 relative 位置的预设条目（presets_relative 或 presets_doc.prompts 中 position=="relative" 且 enabled==True）
- 预设占位符（identifier）支持：
  - chatHistory：在当前位置插入“规范化历史”
  - charBefore：插入世界书 position=="before_char" 的条目
  - charAfter：插入世界书 position=="after_char" 的条目
  - charDescription：插入角色描述（character.description）
  - personaDescription：插入用户画像描述（persona.description）
  - 其他 identifier：当作普通 relative 文本直接输出
- 世界书处理（仅 before_char/after_char；in-chat 留给 in_chat_constructor 模块）
  - 过滤：enabled==True 且 content 非空
  - 条件触发：当 mode=="conditional" 且 keys 命中原始历史文本时才插入；若 keys 缺失/为 0/为空数组则不触发（见 [python._is_triggered_by_keys()](api/modules/SmartTavern/framing_prompt/impl.py:94)）
    - keys==0 表示“没有关键词/不触发”
    - 匹配区分大小写（history_text 来自 [python._collect_history_text()](api/modules/SmartTavern/framing_prompt/impl.py:82)）
  - 排序：order 升序 → 角色优先级（assistant < user < system）→ internal_order（见 [python._sort_sources()](api/modules/SmartTavern/framing_prompt/impl.py:71)）
  - 角色映射：before_char/after_char 都映射为 role=="system"（见 [python._map_wb_pos_to_role()](api/modules/SmartTavern/framing_prompt/impl.py:38)）
  - 来源标注：source.type 为 world_book.before_char / world_book.after_char（见 [python._build_source_for_wb()](api/modules/SmartTavern/framing_prompt/impl.py:153)）
- 输出消息字段顺序统一：role → content → source（source 内尽量保持来源条目字段顺序）

API：assemble（smarttavern/framing_prompt/assemble）
- 输入（JSON Schema 概览，详见注册层定义 [python.assemble()](api/modules/SmartTavern/framing_prompt/framing_prompt.py:11)）
  - history: array | object
    - 可为 OpenAI messages 数组（[{role, content}]），或 {"messages":[...]} 容器
  - world_books?: array | object
    - 支持嵌套 [[{...}], {...}]；仅处理 position ∈ {"before_char","after_char"} 的条目
    - 世界书条目字段参考示例：[json.参考用main_world.json](backend_projects/SmartTavern/data/world_books/参考用main_world.json:1)
  - presets_relative?: array
    - 仅识别 position=="relative" 且 enabled==True；保持文档出现顺序
  - presets_doc?: object
    - 若未显式传 presets_relative，可传入文档对象，本模块会自动在 prompts 内筛选 position=="relative"
  - character?: object
    - 用于 charDescription 占位符注入，读取 character.description
  - persona?: object
    - 用于 personaDescription 占位符注入，读取 persona.description
- 输出（JSON）
  - messages: array
    - 每条消息含 { role, content, source }，其中 source.type 覆盖：
      - history.user / history.assistant / history.thinking（来自原始或规范化历史）
      - preset.relative（relative 预设）
      - world_book.before_char / world_book.after_char（世界书）
      - char.description / persona.description（描述占位符）

行为细节
- 相对预设遍历顺序与输入文档一致（不另行排序）
- chatHistory 在出现位置按当时 accumulated 列表插入“规范化历史”
- 普通 relative 文本：原样输出文本内容与来源（source.id= preset_{identifier|name}）
- 角色/画像描述：当 description 非空串时插入；source.id 固定为 char_description / persona_description
- 世界书 source 中若原始条目含 id，则迁移为 wb_id，避免与 source.id 冲突（见 [python._build_source_for_wb()](api/modules/SmartTavern/framing_prompt/impl.py:153)）

调用示例（Python SDK）
- 最小化示例：
  - 见 [python.core.call_api()](core/api_client.py:227)
  - 请求：
    {
      "history": [{"role":"user","content":"你好艾拉"}],
      "world_books": [
        {"id":"wb_before_1","enabled":true,"position":"before_char","mode":"always","content":"世界书：在角色描述前","order":10},
        {"id":"wb_after_1","enabled":true,"position":"after_char","mode":"always","content":"世界书：在角色描述后","order":20}
      ],
      "presets_relative": [
        {"position":"relative","enabled":true,"role":"system","identifier":"charBefore","order":1},
        {"position":"relative","enabled":true,"role":"system","identifier":"chatHistory","order":2},
        {"position":"relative","enabled":true,"role":"system","identifier":"charAfter","order":3}
      ],
      "character": {"name":"心与露","description":"角色设定：温柔体贴。"},
      "persona": {"name":"用户甲","description":"画像：程序员。"}
    }
  - 代码：
    res = core.call_api(
      "smarttavern/framing_prompt/assemble",
      {
        "history": [{"role":"user","content":"你好艾拉"}],
        "world_books": [{"id":"wb_before_1","enabled":True,"position":"before_char","mode":"always","content":"世界书：在角色描述前","order":10}],
        "presets_relative": [{"position":"relative","enabled":True,"role":"system","identifier":"charBefore","order":1}],
        "character": {"name":"心与露","description":"角色设定：温柔体贴。"},
        "persona": {"name":"用户甲","description":"画像：程序员。"}
      },
      method="POST",
      namespace="modules"
    )
- 复杂示例可参考测试：
  - [python.test_source_types_framing.py](api/modules/SmartTavern/framing_prompt/test_source_types_framing.py:41)

关键注意事项
- 条件触发 keys
  - mode="conditional" 且 keys 命中原始历史文本时才插入
  - keys 可以是 string 或 string[]；去空白后逐项包含匹配（区分大小写）
  - keys==0 表示“没有关键词/不触发”
- 历史规范化
  - 原始 messages 会被补齐 source.type 为 history.user / history.assistant / history.thinking
  - 传入已带 source 的历史将被透传，不覆盖
- 职责边界
  - framing_prompt 仅处理相对预设与 before/after 世界书；in-chat 条目（position=="in-chat" 或世界书非 before/after）由 in_chat_constructor 模块负责（见 [python.in_chat_constructor.in_chat_constructor.py](api/modules/SmartTavern/in_chat_constructor/in_chat_constructor.py:1)）
- 顺序与稳定性
  - relative 预设保持输入顺序；世界书按 order → 角色优先级 → internal_order 稳定排序

返回示例（节选）
- messages:
  [
    {"role":"system","content":"世界书：在角色描述前","source":{"type":"world_book.before_char","id":"wb_wb_before_1","wb_id":"wb_before_1", "...": "..."}},
    {"role":"user","content":"你好艾拉","source":{"type":"history.user","id":"history_0","index":0}},
    {"role":"system","content":"世界书：在角色描述后","source":{"type":"world_book.after_char","id":"wb_wb_after_1","wb_id":"wb_after_1", "...": "..."}}
  ]

错误与边界
- 非法结构会被跳过（如非 dict 的条目、空 content）
- 角色未知将回退为 user（历史归一化时）或 system（世界书角色映射时）
- 输入 history 为空时，chatHistory 将插入空列表

参考
- 注册层： [python.framing_prompt.framing_prompt.py](api/modules/SmartTavern/framing_prompt/framing_prompt.py:1)
- 实现层： [python.framing_prompt.impl.py](api/modules/SmartTavern/framing_prompt/impl.py:1)
- 测试： [python.test_framing_prompt.py](api/modules/SmartTavern/framing_prompt/test_framing_prompt.py:1), [python.test_source_types_framing.py](api/modules/SmartTavern/framing_prompt/test_source_types_framing.py:1)
- 相关模块： [python.in_chat_constructor.in_chat_constructor.py](api/modules/SmartTavern/in_chat_constructor/in_chat_constructor.py:1)