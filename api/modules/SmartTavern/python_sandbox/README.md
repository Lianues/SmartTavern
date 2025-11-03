# SmartTavern.python_sandbox 模块说明

位置：api/modules/SmartTavern/python_sandbox/

本模块提供受限 Python 表达式/语句求值能力，作为宏系统的安全执行后端。先尝试将输入作为表达式 eval，若发生 SyntaxError 再回退为受限 exec（允许赋值/简单 if）。执行期间可读写单一变量表（variables），并严格限制可用函数、属性与 AST 节点。

相关代码
- 注册封装层：api/modules/SmartTavern/python_sandbox/python_sandbox.py
- 实现层：api/modules/SmartTavern/python_sandbox/impl.py

API 列表
- smarttavern/python_sandbox/eval（受限求值）

输入/输出契约
- 输入（JSON）：
  - code: string，待执行的表达式或简单语句。
  - variables?: object，变量初值（单一作用域）。
  - policy?: object，可选（默认严格）；字段：
    - undefined_get: "error" | "empty"（默认 "error"）
    - error_token: string（默认 "[UndefinedVar:{name}]"）
- 输出（JSON）：
  - success: boolean，是否执行成功。
  - result: string，表达式求值或多语句后的 result 变量字符串化结果；失败时为空串。
  - error: string | null，错误描述（失败时提供）。
  - variables: { initial: object, final: object }，执行前后的变量快照。

执行流程
1) 表达式路径：parse(mode="eval") → AST 校验 → compile/eval → 字符串化。
2) 语句路径：表达式解析失败时 parse(mode="exec") → AST 校验 → compile/exec → 读取全局 result。
3) 超时保护：默认 5 秒超时。
4) 变量同步：输入 variables 为 initial，执行后返回 final。

变量访问与辅助
- 读取：getvar(name) 与 vars["name"]（未定义时按策略返回占位词或空串）。
- 写入：setvar(name, value)（返回空串）。
- 已注入 helper：legacy_upper/legacy_lower/legacy_roll/legacy_time/legacy_time_utc/legacy_weekday_cn/legacy_timediff/legacy_num/legacy_addvar/legacy_inc/legacy_dec。

可用内置函数（白名单）
- len, abs, min, max, sum, str, int, float, bool, round, sorted

允许模块与属性（只读代理 + 白名单链）
- random: randint, choice, random, shuffle
- math: sqrt, sin, cos, tan, floor, ceil
- datetime: datetime, date, time（允许 datetime.datetime.now/utcnow/strptime；date.today/fromtimestamp）
- re: match, search, findall, sub

AST 安全规则
- 允许：Module, Expr, Expression, BinOp, UnaryOp, BoolOp, Compare, IfExp, If, Call, Name, Load, Constant, Subscript, Slice, Index, Dict, List, Tuple, Attribute, Assign, AugAssign, AnnAssign，以及运算/比较节点（Add/Sub/Mult/Div/Mod/Pow/.../Eq/NotEq/Lt/LtE/Gt/GtE/In/NotIn/Is/IsNot）。
- 禁止：Import, ImportFrom, Lambda, ListComp/SetComp/DictComp/GeneratorExp, While, For, With, Try, FunctionDef, ClassDef, Return, Yield/YieldFrom, Delete, Global, Nonlocal, Raise。
- 属性链：仅允许在 random/math/datetime/re 上按白名单访问；禁止以 "_" 开头的属性。
- 下标：仅允许 vars[...] 形式。

策略（Policy）
- 默认严格（undefined_get="error"，error_token="[UndefinedVar:{name}]")。
- 建议上游不要覆盖该策略；宏模块默认严格调用。

使用示例（Python SDK）
- 表达式：
  - 请求：{"code": "3 + 4"}
  - 返回：{"success": true, "result": "7", "error": null, "variables": {"initial": {}, "final": {}}}
- 变量读写（语句）：
  - 请求：{"code": "setvar('x', 1)\nx=int(vars['x'])\nsetvar('x', x+1)\nresult=f'{vars['x']}'", "variables": {"pre": "v"}}
- 正则与时间（表达式）：
  - 请求：{"code": "re.sub('a','A','abc') + ' ' + datetime.datetime.now().strftime('%H')"}

错误与返回
- 运行错误/超时：success=false，result=""，error 含描述；variables.final 始终回传。
- exec 路径未设置 result：result 为空串。

安全注意事项
- 禁止导入/文件或网络 IO/反射/任意属性访问；仅暴露白名单能力。
- 变量仅在本次求值上下文生效；上游负责合并 final。

参考
- api/modules/SmartTavern/python_sandbox/python_sandbox.py
- api/modules/SmartTavern/python_sandbox/impl.py

嵌套变量路径支持
- VarProxy 支持“以路径为键”的读写：vars['a.b[1].c']，可与 getvar('a.b[1].c')/setvar('a.b[1].c', v) 混用。
- 路径语法：点号 + 方括号，支持引号键与数组索引（如 a['复杂.key']、a[2]）。
- 自动容器推断：下一跳为整数索引 → 自动创建/扩容 list，否则创建 dict。
- AST 调整：允许 Store 节点以支持安全的赋值语句；exec 路径返回值优先读取局部作用域 result。
- 示例：
  - setvar('a.b[1].c', 42); result = str(getvar('a.b[1].c'))  → "42"
  - vars['profile.name'] = 'Alice'; result = vars['profile.name'] → "Alice"