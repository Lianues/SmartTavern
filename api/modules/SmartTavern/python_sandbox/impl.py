#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SmartTavern.python_sandbox 实现层
- 仅支持“表达式”求值（禁止赋值/导入/属性访问/推导式）
- 单一变量作用域（dict）
- 未定义变量访问策略：policy.undefined_get = "error"|"empty"，error_token 默认 "[UndefinedVar:{name}]"
- 可用函数：len/abs/min/max/sum/str/int/float/bool/round/sorted + getvar/setvar
- 变量访问：vars["name"] 或 getvar("name")
"""
import ast
import types
import threading
import time
from typing import Any, Dict, Set
import random as _random
import math as _math
import datetime as _datetime
import re as _re

DEFAULT_POLICY = {
    "undefined_get": "error",            # "error" | "empty"
    "error_token": "[UndefinedVar:{name}]",
}

# ---------- Nested variable path helpers ----------
from typing import List as _List, Union as _Union

_PathToken = _Union[str, int]

def _parse_path(path: str) -> _List[_PathToken]:
    s = str(path or "")
    tokens: _List[_PathToken] = []
    i, n = 0, len(s)
    buf: _List[str] = []
    def flush_buf():
        nonlocal buf
        if buf:
            tokens.append("".join(buf))
            buf = []
    while i < n:
        ch = s[i]
        if ch == ".":
            flush_buf(); i += 1; continue
        if ch == "[":
            flush_buf(); i += 1
            if i < n and s[i] in ("'", '"'):
                q = s[i]; i += 1
                qb: _List[str] = []
                while i < n and s[i] != q:
                    qb.append(s[i]); i += 1
                if i < n and s[i] == q: i += 1
                while i < n and s[i] != "]": i += 1
                if i < n and s[i] == "]": i += 1
                tokens.append("".join(qb))
            else:
                nb: _List[str] = []
                while i < n and s[i] != "]":
                    nb.append(s[i]); i += 1
                if i < n and s[i] == "]": i += 1
                raw = "".join(nb).strip()
                if raw.isdigit() or (raw.startswith("-") and raw[1:].isdigit()):
                    try:
                        tokens.append(int(raw))
                    except Exception:
                        tokens.append(raw)
                else:
                    tokens.append(raw)
            continue
        buf.append(ch); i += 1
    flush_buf()
    return [t for t in tokens if t != "" and t is not None]

def _get_by_path(store: Dict[str, Any], path: str, policy: Dict[str, Any]) -> Any:
    toks = _parse_path(path)
    cur: Any = store
    try:
        for t in toks:
            if isinstance(t, int):
                if not isinstance(cur, list) or t < 0 or t >= len(cur):
                    raise KeyError("list index")
                cur = cur[t]
            else:
                if not isinstance(cur, dict) or t not in cur:
                    raise KeyError("dict key")
                cur = cur[t]
        return cur
    except Exception:
        ug = str(policy.get("undefined_get", "error")).lower()
        return _make_error_token(path, policy) if ug == "error" else ""

def _set_by_path(store: Dict[str, Any], path: str, value: Any) -> None:
    toks = _parse_path(path)
    if not toks:
        return
    cur: Any = store
    for idx, t in enumerate(toks):
        last = (idx == len(toks) - 1)
        if last:
            if isinstance(t, int):
                if not isinstance(cur, list):
                    return
                if t >= len(cur):
                    cur.extend([None] * (t - len(cur) + 1))
                cur[t] = value
            else:
                if isinstance(cur, dict):
                    cur[t] = value
                else:
                    return
        else:
            nxt = toks[idx + 1]
            if isinstance(t, int):
                if not isinstance(cur, list):
                    return
                if t >= len(cur):
                    cur.extend([None] * (t - len(cur) + 1))
                if cur[t] is None:
                    cur[t] = [] if isinstance(nxt, int) else {}
                cur = cur[t]
            else:
                if t not in cur or cur[t] is None or not isinstance(cur[t], (dict, list)):
                    cur[t] = [] if isinstance(nxt, int) else {}
                cur = cur[t]

ALLOWED_FUNCS = {
    "len": len,
    "abs": abs,
    "min": min,
    "max": max,
    "sum": sum,
    "str": str,
    "int": int,
    "float": float,
    "bool": bool,
    "round": round,
    "sorted": sorted,
}
ALLOWED_CALL_NAMES: Set[str] = set(ALLOWED_FUNCS.keys()) | {
    "getvar", "setvar",
    # Legacy helper functions exposed to sandbox callers
    "legacy_upper", "legacy_lower", "legacy_reverse",
    "legacy_roll",
    "legacy_time", "legacy_time_utc", "legacy_weekday_cn", "legacy_timediff",
    "legacy_num", "legacy_addvar", "legacy_inc", "legacy_dec"
}

# 允许的模块根与属性白名单
ALLOWED_MODULE_ROOTS = {"random", "math", "datetime", "re"}
ALLOWED_FIRST_ATTRS = {
    "random": {"randint", "choice", "random", "shuffle"},
    "math": {"sqrt", "sin", "cos", "tan", "floor", "ceil"},
    "re": {"match", "search", "findall", "sub"},
    "datetime": {"datetime", "date", "time"},
}
ALLOWED_SECOND_ATTRS = {
    ("datetime", "datetime"): {"now", "utcnow", "strptime"},
    ("datetime", "date"): {"today", "fromtimestamp"},
    ("datetime", "time"): set(),
}

ALLOWED_NODES: Set[type] = {
    ast.Module, ast.Expr,
    ast.Expression, ast.BinOp, ast.UnaryOp, ast.BoolOp, ast.Compare, ast.IfExp, ast.If,
    ast.Call, ast.Name, ast.Load, ast.Store, ast.Constant, ast.Subscript, ast.Slice, ast.Index,
    ast.Dict, ast.List, ast.Tuple, ast.Attribute,
    ast.Assign, ast.AugAssign, ast.AnnAssign,
    # 操作符节点
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow, ast.BitXor,
    ast.UAdd, ast.USub, ast.Not,
    ast.And, ast.Or,
    ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE, ast.In, ast.NotIn, ast.Is, ast.IsNot,
}

FORBIDDEN_NODES: Set[type] = {
    ast.Import, ast.ImportFrom,
    ast.Lambda, ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp,
    ast.While, ast.For, ast.With, ast.Try, ast.FunctionDef, ast.ClassDef, ast.Return, ast.Yield, ast.YieldFrom,
    ast.Delete, ast.Global, ast.Nonlocal, ast.Raise
}


def _make_error_token(name: str, policy: Dict[str, Any]) -> str:
    tpl = str(policy.get("error_token", "[UndefinedVar:{name}]"))
    return tpl.replace("{name}", str(name))


class VarProxy:
    """变量代理，支持路径读写（'a.b[1].c'）；未定义读取时按策略返回占位词或空串"""
    def __init__(self, store: Dict[str, Any], policy: Dict[str, Any]):
        self._store = store
        self._policy = policy

    def __getitem__(self, key: str) -> Any:
        return _get_by_path(self._store, str(key), self._policy)

    def __setitem__(self, key: str, value: Any) -> None:
        _set_by_path(self._store, str(key), value)

    def __repr__(self) -> str:
        return f"VarProxy({self._store!r})"


class _SafeExprChecker(ast.NodeVisitor):
    def generic_visit(self, node: ast.AST):
        t = type(node)
        if t in FORBIDDEN_NODES:
            raise ValueError(f"Forbidden AST node: {t.__name__}")
        if t not in ALLOWED_NODES:
            raise ValueError(f"Not allowed AST node: {t.__name__}")
        super().generic_visit(node)

    def _is_allowed_attr_chain(self, node: ast.AST) -> bool:
        cur = node
        names = []
        while isinstance(cur, ast.Attribute):
            if cur.attr.startswith("_"):
                return False
            names.append(cur.attr)
            cur = cur.value
        if not isinstance(cur, ast.Name):
            return False
        root = cur.id
        # 只允许受限模块上的属性访问
        if root not in ALLOWED_MODULE_ROOTS:
            return False
        chain = list(reversed(names))  # 由内到外: ['datetime','now'] for datetime.datetime.now
        if root == "datetime":
            if len(chain) == 1:
                return chain[0] in ALLOWED_FIRST_ATTRS["datetime"]
            if len(chain) == 2:
                base = chain[0]
                meth = chain[1]
                return base in ALLOWED_FIRST_ATTRS["datetime"] and meth in ALLOWED_SECOND_ATTRS.get(("datetime", base), set())
            return False
        else:
            # 其他模块仅允许一级属性
            return len(chain) == 1 and chain[0] in ALLOWED_FIRST_ATTRS.get(root, set())

    def visit_Attribute(self, node: ast.Attribute):
        if not self._is_allowed_attr_chain(node):
            raise ValueError("Attribute access is forbidden")
        # 继续检查子节点
        self.generic_visit(node.value)

    def visit_Call(self, node: ast.Call):
        # 允许 Name 与允许的 Attribute 调用
        if isinstance(node.func, ast.Name):
            if node.func.id not in ALLOWED_CALL_NAMES and node.func.id not in ALLOWED_FUNCS:
                raise ValueError(f"Call to function '{node.func.id}' is not allowed")
        elif isinstance(node.func, ast.Attribute):
            if not self._is_allowed_attr_chain(node.func):
                raise ValueError("Call on forbidden attribute chain")
        else:
            raise ValueError("Only direct or whitelisted attribute calls are allowed")
        # 检查参数节点
        for a in list(node.args) + [kw.value for kw in node.keywords]:
            self.visit(a)

    def visit_Subscript(self, node: ast.Subscript):
        # 仅允许 vars["name"] 形式
        if not isinstance(node.value, ast.Name) or node.value.id != "vars":
            raise ValueError("Only 'vars[...]' subscript is allowed")
        self.visit(node.slice)


def eval_expr(code: str, variables: Dict[str, Any] = None, policy: Dict[str, Any] = None) -> Dict[str, Any]:
    """安全表达式/语句求值入口（受限模块 + 属性 + 赋值 + 超时测量）"""
    TIMEOUT_SEC = 5.0
    start_ts = time.time()

    store: Dict[str, Any] = dict(variables or {})
    pol: Dict[str, Any] = dict(DEFAULT_POLICY)
    if isinstance(policy, dict):
        pol.update(policy)

    def getvar(name: str) -> Any:
        return _get_by_path(store, str(name), pol)

    def setvar(name: str, value: Any) -> str:
        _set_by_path(store, str(name), value)
        return ""  # 作为表达式一部分时，不污染输出

    # 构造安全上下文
    ctx_globals: Dict[str, Any] = {"__builtins__": {}}
    ctx_globals.update(ALLOWED_FUNCS)

    # 注入受限模块代理（仅暴露白名单函数/类型）
    random_proxy = types.SimpleNamespace(
        randint=_random.randint, choice=_random.choice, random=_random.random, shuffle=_random.shuffle
    )
    math_proxy = types.SimpleNamespace(
        sqrt=_math.sqrt, sin=_math.sin, cos=_math.cos, tan=_math.tan, floor=_math.floor, ceil=_math.ceil
    )
    datetime_proxy = types.SimpleNamespace(
        datetime=_datetime.datetime, date=_datetime.date, time=_datetime.time
    )
    re_proxy = types.SimpleNamespace(
        match=_re.match, search=_re.search, findall=_re.findall, sub=_re.sub
    )

    ctx_globals.update({
        "getvar": getvar,
        "setvar": setvar,
        "vars": VarProxy(store, pol),
        "random": random_proxy,
        "math": math_proxy,
        "datetime": datetime_proxy,
        "re": re_proxy,
    })

    # Legacy-safe helper functions (whitelisted by name in ALLOWED_CALL_NAMES)
    def legacy_upper(s: Any) -> str:
        try:
            return str(s).upper()
        except Exception:
            return str(s)

    def legacy_lower(s: Any) -> str:
        try:
            return str(s).lower()
        except Exception:
            return str(s)

    def legacy_reverse(s: Any) -> str:
        try:
            return "".join(reversed(str(s)))
        except Exception:
            return str(s)

    def legacy_roll(expr_or_n: Any, sides: Any = None) -> str:
        try:
            if sides is None:
                s = str(expr_or_n or "").strip().lower()
                if "d" not in s:
                    return "1"
                left, right = s.split("d", 1)
                num = int(left.strip()) if left.strip() else 1
                sides_i = int(right.strip())
            else:
                num = int(str(expr_or_n))
                sides_i = int(str(sides))
            # clamp
            num = max(1, min(num, 50))
            sides_i = max(2, min(sides_i, 1000))
            total = 0
            for _ in range(num):
                total += _random.randint(1, sides_i)
            return str(total)
        except Exception:
            return "1"

    def legacy_time(fmt: str = "%H:%M:%S") -> str:
        try:
            return _datetime.datetime.now().strftime(fmt)
        except Exception:
            return ""

    def legacy_time_utc(offset: Any = 0, fmt: str = "%H:%M:%S") -> str:
        try:
            off = int(str(offset)) if str(offset) else 0
        except Exception:
            off = 0
        try:
            return (_datetime.datetime.now() + _datetime.timedelta(hours=off)).strftime(fmt)
        except Exception:
            return ""

    def legacy_weekday_cn() -> str:
        try:
            return ["星期一","星期二","星期三","星期四","星期五","星期六","星期日"][_datetime.datetime.now().weekday()]
        except Exception:
            return ""

    def legacy_timediff(t1: Any, t2: Any) -> str:
        s1 = "" if t1 is None else str(t1)
        s2 = "" if t2 is None else str(t2)
        fmts = ['%Y-%m-%d %H:%M:%S','%Y-%m-%d','%H:%M:%S']
        def _parse(s: str):
            for f in fmts:
                try:
                    return _datetime.datetime.strptime(s, f)
                except Exception:
                    continue
            return None
        dt1 = _parse(s1)
        dt2 = _parse(s2)
        if dt1 and dt2:
            diff = dt2 - dt1
            days = diff.days
            secs = diff.seconds
            hours = secs // 3600
            minutes = (secs % 3600) // 60
            return f"{days}天{hours}小时{minutes}分钟"
        return ""

    def legacy_num(v: Any, default: float = 0.0) -> float:
        try:
            if v is None:
                return float(default)
            s = str(v).strip()
            if s.lower().startswith("[undefinedvar"):
                return float(default)
            return float(s)
        except Exception:
            return float(default)

    def legacy_addvar(var_name: Any, inc: Any) -> str:
        name = "" if var_name is None else str(var_name)
        cur = getvar(name)
        # number add if both numbers; else string concat
        try:
            a = legacy_num(cur, 0.0)
            b = legacy_num(inc, 0.0)
            # Heuristic: if both parse cleanly and original strings look numeric, use numeric add
            cur_s = "" if cur is None else str(cur).strip()
            inc_s = "" if inc is None else str(inc).strip()
            def _is_num(x: str) -> bool:
                try:
                    float(x)
                    return True
                except Exception:
                    return False
            if _is_num(cur_s) and _is_num(inc_s):
                setvar(name, str(a + b))
            else:
                setvar(name, str(cur_s) + str(inc_s))
        except Exception:
            setvar(name, str(cur) + str(inc))
        return ""

    def legacy_inc(var_name: Any) -> str:
        name = "" if var_name is None else str(var_name)
        v = legacy_num(getvar(name), 0.0) + 1.0
        setvar(name, str(v))
        return ""

    def legacy_dec(var_name: Any) -> str:
        name = "" if var_name is None else str(var_name)
        v = legacy_num(getvar(name), 0.0) - 1.0
        setvar(name, str(v))
        return ""

    # expose helpers
    ctx_globals.update({
        "legacy_upper": legacy_upper,
        "legacy_lower": legacy_lower,
        "legacy_reverse": legacy_reverse,
        "legacy_roll": legacy_roll,
        "legacy_time": legacy_time,
        "legacy_time_utc": legacy_time_utc,
        "legacy_weekday_cn": legacy_weekday_cn,
        "legacy_timediff": legacy_timediff,
        "legacy_num": legacy_num,
        "legacy_addvar": legacy_addvar,
        "legacy_inc": legacy_inc,
        "legacy_dec": legacy_dec,
    })

    # 先尝试作为表达式
    try:
        tree = ast.parse(code, mode="eval")
        _SafeExprChecker().visit(tree)
        compiled = compile(tree, "<smarttavern_sandbox>", "eval")
        value = eval(compiled, ctx_globals, {})
        out = "" if value is None else str(value)
        elapsed = time.time() - start_ts
        if elapsed > TIMEOUT_SEC:
            return {
                "success": False, "result": "", "error": f"Timeout: {elapsed:.2f}s",
                "variables": {"initial": dict(variables or {}), "final": store}
            }
        return {"success": True, "result": out, "error": None, "variables": {"initial": dict(variables or {}), "final": store}}
    except SyntaxError:
        # 回退为多语句执行（exec）
        pass
    except Exception as e:
        return {"success": False, "result": "", "error": f"RuntimeError: {e}", "variables": {"initial": dict(variables or {}), "final": store}}

    # 多语句执行路径（支持赋值/简单控制流）
    try:
        tree = ast.parse(code, mode="exec")
        _SafeExprChecker().visit(tree)
        compiled = compile(tree, "<smarttavern_sandbox>", "exec")
        _locals: Dict[str, Any] = {}
        exec(compiled, ctx_globals, _locals)
        # 优先从局部作用域读取 result，其次从全局
        value = _locals.get("result", ctx_globals.get("result", ""))
        out = "" if value is None else str(value)
        elapsed = time.time() - start_ts
        if elapsed > TIMEOUT_SEC:
            return {
                "success": False, "result": "", "error": f"Timeout: {elapsed:.2f}s",
                "variables": {"initial": dict(variables or {}), "final": store}
            }
        return {"success": True, "result": out, "error": None, "variables": {"initial": dict(variables or {}), "final": store}}
    except Exception as e:
        return {"success": False, "result": "", "error": f"RuntimeError: {e}", "variables": {"initial": dict(variables or {}), "final": store}}