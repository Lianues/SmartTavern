# SmartTavern 宏系统（传统宏 → Python）迁移说明与系统变量清单

说明：本迁移已将全部“传统宏”统一转换为受限 Python 片段，并交由沙盒 API 执行。调用方需要在 variables 中提供必要的“系统变量”，以替代原先依赖历史/输入缓存的宏取值。

相关实现文件
- [api/modules/SmartTavern/macro/impl.py](api/modules/SmartTavern/macro/impl.py)
- [api/modules/SmartTavern/macro/macro.py](api/modules/SmartTavern/macro/macro.py)
- [api/modules/SmartTavern/python_sandbox/impl.py](api/modules/SmartTavern/python_sandbox/impl.py)
- [api/modules/SmartTavern/python_sandbox/python_sandbox.py](api/modules/SmartTavern/python_sandbox/python_sandbox.py)

1) 执行链路（摘要）
- 宏解析与转换：在 macro/impl 中识别 {{...}} 或 <<...>>，传统宏会被转换为 Python 代码片段，再通过 SmartTavern.python_sandbox 执行，结果替换到 content 中，仅改写 content 字段，保留 source。
- 变量作用域：采用单一作用域 variables；输入 initial 会被拷贝到运行态，执行完成后返回 final 并同步。
- 策略：policy.undefined_get 可选 error|empty，默认 error；未定义变量在 error 模式下返回占位符 [UndefinedVar:{name}]。
- 沙盒约束：允许表达式与少量语句（赋值、简单 If），禁止 import/循环/异常处理/with 等；仅暴露受限模块 random/math/datetime/re 与少量 legacy_* 辅助函数。

2) API 调用方式
- Endpoint: modules → smarttavern/macro/process
- 入参：
  - messages: [{role, content, ...}]，顺序处理，仅替换 content
  - variables: dict（单作用域变量表）
  - policy: { undefined_get: "error"|"empty", error_token?: string }
- 出参：
  - { messages, variables: {initial, final} }

3) 必须/建议提供的系统变量清单
说明：以下键全部位于 variables 单一字典内。未提供时，涉及的宏将按 policy 输出空串或占位符。

3.1 用户与角色元信息
- user_name: 用户的称呼/显示名（替代旧宏 user）
- persona_description: 用户画像的描述文本（替代旧宏 persona）
- character_name: 角色名称（替代旧宏 char）
- character_description: 角色的详细描述（替代旧宏 description）
- character_personality: 角色的性格描述（替代旧宏 personality）
- scenario_description: 场景/背景的描述（替代旧宏 scenario）

3.2 会话快照（用于替代依赖“历史/输入”的传统宏）
- user_input_text: 当前/最新一条用户输入文本（替代旧宏 input）
- chat_last_message: 最近一条消息的全文（替代旧宏 lastMessage）
- chat_last_user_message: 最近一条用户消息的全文（替代旧宏 lastUserMessage）
- chat_last_assistant_message: 最近一条助手消息的全文（替代旧宏 lastCharMessage）
- chat_message_count: 当前消息条数（替代旧宏 messageCount）
- chat_user_message_count: 用户消息条数（替代旧宏 userMessageCount）
- chat_conversation_length: 会话内容总长度（字符数）（替代旧宏 conversationLength）

注：
- 以上快照数据由上游在“调用前”一次性注入，不在本模块内计算或缓存。
- 数值类字段建议使用字符串或数字均可；内部在需要时会做健壮转换。

4) 传统宏迁移对照表（核心条目）

4.1 转为 Python 表达式（直接）
- // 注释 → ''
- newline → '\n'
- noop/trim → ''
- enable → 'True'
- random/pick → random.choice([...])
- add/sub/mul/div/max/min → 数值运算（内部使用 legacy_num 做健壮转换）
- length → len('text')
- reverse → ('text')[::-1]

4.2 通过沙盒辅助函数（统一/安全）
- upper/lower → legacy_upper('text') / legacy_lower('Text')
- roll NdM → legacy_roll('2d6') 或 legacy_roll(2,6)
- time/isotime/date/isodate/datetimeformat → legacy_time('%H:%M:%S' | '%Y-%m-%d' | 自定义fmt)
- time_UTC±n → legacy_time_utc(n, '%H:%M:%S')
- weekday → legacy_weekday_cn()
- timediff → legacy_timediff(t1, t2)（自动识别常见时间格式）
- 变量操作：addvar/incvar/decvar、get/set/add/inc/dec globalvar → 统一至 getvar/setvar/legacy_addvar/legacy_inc/legacy_dec

4.3 依赖“历史/输入”的传统宏（已改为读取系统变量）
- input → getvar('user_input_text')
- lastMessage → getvar('chat_last_message')
- lastUserMessage → getvar('chat_last_user_message')
- lastCharMessage → getvar('chat_last_assistant_message')
- messageCount → getvar('chat_message_count')
- userMessageCount → getvar('chat_user_message_count')
- conversationLength → getvar('chat_conversation_length')

4.4 “系统变量类”的传统宏（由上游注入）
- user → getvar('user_name')
- char → getvar('character_name')
- description → getvar('character_description')
- personality → getvar('character_personality')
- scenario → getvar('scenario_description')
- persona → getvar('persona_description')

5) 沙盒约束与可用函数
- 受限内置：len/abs/min/max/sum/str/int/float/bool/round/sorted 等
- 受限模块：random/math/datetime/re（仅白名单属性链）
- 注入变量接口：getvar(name)、setvar(name, value)、vars[...]（可读写）
  - 嵌套路径：上述接口均支持“点号 + 方括号”的嵌套路径（如 a.b[1].c、a['复杂.key']）；自动容器推断：下一跳为整数索引 → list，否则 dict
- 注入辅助函数：legacy_upper/legacy_lower/legacy_roll/legacy_time/legacy_time_utc/legacy_weekday_cn/legacy_timediff/legacy_num/legacy_addvar/legacy_inc/legacy_dec
- 禁止：import、循环（for/while）、with/try、函数/类定义、推导式、异常抛出等
详情见：
- [api/modules/SmartTavern/python_sandbox/impl.py](api/modules/SmartTavern/python_sandbox/impl.py)

6) 最小调用示例
请求：
```
{
  "messages": [
    {"role": "system", "content": "Hello {{getvar:user_name}} / {{upper:world}} / {{roll:2d6}}"},
    {"role": "user", "content": "最近一条用户消息：{{lastUserMessage}}"}
  ],
  "variables": {
    "user_name": "Alice",
    "persona_description": "一位安静的读者",
    "character_name": "心",
    "character_description": "温柔的圣女",
    "character_personality": "天然呆，重视日常",
    "scenario_description": "教堂与小镇的日常",

    "user_input_text": "你好",
    "chat_last_message": "上一条综合消息",
    "chat_last_user_message": "这是用户的上一条消息",
    "chat_last_assistant_message": "这是助手的上一条消息",
    "chat_message_count": 5,
    "chat_user_message_count": 3,
    "chat_conversation_length": 128
  },
  "policy": { "undefined_get": "empty" }
}
```
响应（示意）：
- messages[0].content 可能变为：Hello Alice / WORLD / 7
- messages[1].content 变为：最近一条用户消息：这是用户的上一条消息
- variables.final 同步包含以上键值

7) 与数据格式的对应关系（参考 backend_projects/SmartTavern/data）
- 人物与画像字段通常来自：
  - character: [backend_projects/SmartTavern/data/characters/*/character.json](backend_projects/SmartTavern/data/characters/心与露/character.json)
  - persona: [backend_projects/SmartTavern/data/personas/*/persona.json](backend_projects/SmartTavern/data/personas/用户2/persona.json)
- world_books 与预设说明见：
  - [backend_projects/SmartTavern/data/world_books/参考用main_world/worldbook.json](backend_projects/SmartTavern/data/world_books/参考用main_world/worldbook.json)
  - [backend_projects/SmartTavern/data/presets/Default/preset.json](backend_projects/SmartTavern/data/presets/Default/preset.json)
- 上游应在调用 smarttavern/macro/process 前，将上述字段抽取/映射为本文件第 3 节定义的系统变量键名。

8) 清理与兼容
- 旧模块 macro_module 与 python_sandbox_module 已废弃，调用请统一迁移至：
  - 宏处理：smarttavern/macro/process（POST）
  - Python 沙盒：smarttavern/python_sandbox/eval（POST）
- 如果有历史代码直接导入旧模块，请改为通过 import core → core.call_api 调用上述 API。

9) 变更摘要
- 传统宏全部转为 Python 统一执行，历史依赖改为系统变量读取，变量作用域单一。
- 不再在宏层维护会话历史；不记录、不缓存历史。
- 保留 setvar/getvar 与 vars[...] 行为一致；policy 控制未定义读取。

附注：世界书“conditional + keys”逻辑
- keys 为 0 → 不触发；为字符串或字符串数组时采用大小写敏感的子串匹配；命中才注入。
- 处理位置：in-chat（assistant/user/system 位置的世界书）与 framing（before_char/after_char）均执行同一逻辑，见对应实现文件。
- 相关文件：
  - [api/modules/SmartTavern/in_chat_constructor/impl.py](api/modules/SmartTavern/in_chat_constructor/impl.py)
  - [api/modules/SmartTavern/framing_prompt/impl.py](api/modules/SmartTavern/framing_prompt/impl.py)