# SmartTavern.macro 模块说明

位置：api/modules/SmartTavern/macro/

本模块提供“顺序宏处理”能力，支持在消息数组或单个纯文本中按从左到右、内层优先的策略解析并执行宏。宏仅替换 content（或纯文本）内容，不改变其他字段，并维护单一变量表（variables.initial → variables.final）。

相关代码
- 注册封装层：api/modules/SmartTavern/macro/macro.py
- 实现层：api/modules/SmartTavern/macro/impl.py
- 沙盒依赖：api/modules/SmartTavern/python_sandbox/python_sandbox.py
- 变量约定：api/modules/SmartTavern/macro/SYSTEM_VARIABLES.md

API 列表
- smarttavern/macro/process（处理消息数组）
- smarttavern/macro/process_text（处理纯文本）

统一策略
- 严格模式默认启用（未定义变量 getvar 输出 [UndefinedVar:{name}]）。客户端请求不接受 policy 字段。

宏语法
- 定界符：{{ ... }} 与 << ... >>（等价，可嵌套）
- 宏种类：
  - python:EXPR
  - setvar:NAME:VALUE 或 setvar:NAME::VALUE（返回空串）
  - getvar:NAME
  - 传统宏（legacy，转译为 Python 后在沙盒执行）：newline, noop, enable, trim, random, pick, roll, add, sub, mul, div, max, min, upper, lower, length, reverse, time, date, weekday, isotime, isodate, datetimeformat, time_utc, input, lastmessage, lastusermessage, lastcharmessage, messagecount, usermessagecount, conversationlength, user, char, description, personality, scenario, persona, getglobalvar, setglobalvar, addglobalvar, incglobalvar, decglobalvar, addvar, incvar, decvar, timediff, keywords

执行机制（简述）
- 单条文本处理流程：
  1) 扫描寻找“最内层可识别宏”片段。
  2) 分类：
     - python → 调用沙盒 API 求值，结果转字符串。
     - setvar → 更新变量表，替换为空串。
     - getvar → 读取变量；未定义输出占位词。
     - legacy → 转译为 Python，再走沙盒。
  3) 用结果替换原片段，继续下一轮，直到无可替换项或达到保护上限。
- 嵌套解析：内层优先，避免跨层误替换。
- 历史相关宏：统一按“系统变量”读取，上游应在 variables 中注入，例如 chat_last_message、user_name、character_name 等，详见 SYSTEM_VARIABLES.md。

API：messages 数组处理（smarttavern/macro/process）
- 输入
  - messages: [{role, content, ...}]（仅修改 content，保留其他字段）
  - variables?: 对话上下文变量初值
- 输出
  - messages: 替换后的数组
  - variables: {initial, final}
- 调用示例（Python SDK）
  - 示例代码：
    - core.call_api("smarttavern/macro/process", {"messages": [...], "variables": {...}}, method="POST", namespace="modules")

API：纯文本处理（smarttavern/macro/process_text）
- 输入
  - text: string
  - variables?: 对话上下文变量初值
- 输出
  - text: 替换后的字符串
  - variables: {initial, final}
- 调用示例（Python SDK）
  - 示例代码：
    - core.call_api("smarttavern/macro/process_text", {"text": "a={{setvar:x:1}} b={{getvar:x}} c={{getvar:y}} d=<<python:3+4>>", "variables": {"pre": "v"}}, method="POST", namespace="modules")
  - 示例返回：
    - {"text": "a= b=1 c=[UndefinedVar:y] d=7", "variables": {"initial": {"pre": "v"}, "final": {"pre": "v", "x": "1"}}}

变量与策略
- 单一作用域（dict），输入 variables 作为 initial，执行后输出 final。
- 严格模式：undefined_get="error"，error_token="[UndefinedVar:{name}]"。

错误与边界
- 未识别宏：不替换（产出空串）。
- 沙盒失败：结果视为""；变量表仍以沙盒返回为准（final 合并）。
- 保护上限：单文本最多 10000 次替换迭代，防止死循环。

相关实现要点（源码索引）
- 注册 API：macro.py
- 主处理：impl.py 中的 _process_text、process_messages、_legacy_to_python、_find_next_recognized_span

示例（messages）
- 输入 messages：
  - [{"role":"user","content":"{{setvar:x:1}}"}, {"role":"assistant","content":"x={{getvar:x}}"}]
- 输出 messages：
  - [{"role":"user","content":""}, {"role":"assistant","content":"x=1"}]

许可与安全
- 所有 python/legacy 宏均在受限沙盒内执行，禁止导入/任意 IO/反射等危险操作。

参考
- api/modules/SmartTavern/macro/macro.py
- api/modules/SmartTavern/macro/impl.py
- api/modules/SmartTavern/macro/SYSTEM_VARIABLES.md
- api/modules/SmartTavern/macro/test_macro.py

嵌套变量路径支持
- 现已支持通过“点号 + 方括号”混合路径访问与赋值变量（适用于 setvar/getvar 与所有传统变量宏：getglobalvar/setglobalvar/addvar/incvar/decvar 等）。
- 路径示例：
  - a.b.c
  - a.b[2].c
  - a['复杂.key'] 或 a["复杂.key"]
  - a.b[0]['k']
- 自动容器推断：
  - 下一跳为数字索引 → 自动创建/扩容 list
  - 否则 → 自动创建 dict
- 示例：
  - {{setvar:profile.name::Alice}}{{getvar:profile.name}} → Alice
  - {{setglobalvar:stats.hp::10}}{{incvar:stats.hp}}{{addvar:stats.hp::5}}{{getvar:stats.hp}} → 16.0
- 实现位置：impl._parse_path/_get_by_path/_set_by_path；policy.undefined_get 行为保持一致（未定义读取返回占位符或空串）。

## 新增：keywords 宏 与 条件（condition）布尔规范

- keywords 宏
  - 语法：<<keywords:kw1,kw2,kw3>> 或 {{keywords:kw1,kw2,kw3}}
  - 语义：判断变量 chat_history_text 是否包含任一关键字；严格返回 'true' 或 'false'（小写/大写均可）。
  - 依赖：上游需在 variables 中提供 chat_history_text（in_chat_constructor 已自动注入聊天历史拼接文本；正则阶段可由工作流透传）。
  - 示例：
    - "<<keywords:艾拉,工程师>>" → 若历史文本包含“艾拉”或“工程师”，输出 'true'，否则 'false'。

- 条件字段（condition）布尔规范
  - 用途：世界书条目/预设/正则规则在 mode="conditional" 时，通过 condition 的宏表达式决定是否生效。
  - 严格规则：仅当宏最终输出的纯文本为 'true'（大小写不敏感）判定为 True；'false' 判定为 False；其他任意输出一律视为 False。
  - 推荐写法：
    - 关键词触发："<<keywords:关键字1,关键字2>>"
    - Python 表达式："{{python:legacy_num(getvar('stat_data.心.醋意值[0]'),0) >= 30}}"
  - 与 enabled、mode 的组合（AND 语义）：
    - enabled 为 True 且（mode="always" 或 mode="conditional" 且 condition == 'true'）时才使用该条目。
    - 原有 keys 字段已废弃，不再兼容；请改用 condition。