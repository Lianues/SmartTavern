# 模块：SmartTavern.assets_normalizer

位置：`api/modules/SmartTavern/assets_normalizer/`

本模块提供“资产标准化”能力：针对 SmartTavern 项目的预设、世界书、角色卡与独立正则，进行必要的提取与合并，输出工作流友好的单体世界书与单体正则集合，解决下游模块无法直接处理“多世界书/多正则”的问题。

- 默认策略（重要）：
  - 世界书合并：顺序为“原世界书在前 → 角色卡 world_book.entries 在后”；仅按 id 去重；不允许覆盖。
  - 正则合并：顺序为“独立正则 → 预设正则 → 角色卡正则”；内部自动采用“最佳”策略（去重键优先 id，其次 name，再次 find_regex；冲突默认保留先出现者）。

参考数据样例目录：`backend_projects/SmartTavern/data/`

- 预设样例：`presets/Default.json`
- 世界书样例：`world_books/参考用main_world.json`
- 角色卡样例：`characters/心与露.json`
- 正则样例：`regex_rules/remove_xml_tags.json`


## 目录结构

- `assets_normalizer.py`：API 封装层（注册 6 个 API）
- `impl.py`：实现层（提取/合并的核心逻辑）
- `test_assets_normalizer.py`：集成测试（覆盖 6 个 API）


## API 一览

模块命名空间：`/api/modules/smarttavern/assets_normalizer/*`

1) normalize（总入口）
- 路径：`smarttavern/assets_normalizer/normalize`
- 作用：一键完成提取与合并，输出“单世界书 + 单正则 + 回传原始 preset/character + 统计元信息”
- 输入 JSON：
```json
{
  "preset": { "…完整预设…": true },
  "world_books": { "…世界书（对象或数组或嵌套数组）…": true },
  "character": { "…完整角色卡…": true },
  "regex_files": { "…多个正则文件组成的大 JSON（数组或 {items:[…]}）…": true }
}
```
- 输出 JSON（概要）：
```json
{
  "preset": { "…原样回传…" : true },
  "world_book": [ { "…合并后条目…" : true } ],
  "character": { "…原样回传…" : true },
  "merged_regex": { "regex_rules": [ { "…合并规则…" : true } ] },
  "meta": { "stats": { "…计数…" : 0 }, "order": { "regex": [], "world_book": [] }, "warnings": [] }
}
```

2) extract_preset_regex（提取预设正则）
- 路径：`smarttavern/assets_normalizer/extract_preset_regex`
- 输入：
```json
{ "preset": { "…完整预设…" : true } }
```
- 输出：
```json
{ "regex_rules": [ { "…规则…" : true } ], "meta": { "source": "preset", "count": 1 } }
```

3) extract_character_world_book（提取角色卡世界书）
- 路径：`smarttavern/assets_normalizer/extract_character_world_book`
- 输入：
```json
{ "character": { "…完整角色卡…" : true } }
```
- 输出：
```json
{ "items": [ { "…世界书条目…" : true } ], "meta": { "source": "character", "count": 14 } }
```

4) extract_character_regex（提取角色卡正则）
- 路径：`smarttavern/assets_normalizer/extract_character_regex`
- 输入：
```json
{ "character": { "…完整角色卡…" : true } }
```
- 输出：
```json
{ "regex_rules": [ { "…规则…" : true } ], "meta": { "source": "character", "count": 5 } }
```

5) merge_world_books（世界书合并）
- 路径：`smarttavern/assets_normalizer/merge_world_books`
- 说明：按“原世界书在前 → 角色卡 world_book.entries 在后”拼接；仅按 id 去重；不允许覆盖（角色卡同 id 不覆盖原世界书）。
- 输入：
```json
{
  "world_books": { "…对象/数组/嵌套数组…" : true },
  "character_world_book": { "items": [ { "…条目…" : true } ] }
}
```
- 输出：
```json
{
  "world_book": [ { "…合并后条目…" : true } ],
  "meta": {
    "order": ["original_world_books","character_world_book"],
    "input_counts": { "world_books_flat": 2, "character_world_book_items": 14 },
    "dedup_removed_count": 2,
    "total": 14
  }
}
```

6) merge_regex（正则合并）
- 路径：`smarttavern/assets_normalizer/merge_regex`
- 说明：顺序为“独立正则 → 预设正则 → 角色卡正则”；内部采用默认最佳策略（去重键优先 id，其次 name，再次 find_regex；冲突保留先出现者），无需传入 `options`。
- 输入：
```json
{
  "independent_regex": [ { "…规则…" : true } ],
  "preset_regex": { "regex_rules": [ { "…规则…" : true } ] },
  "character_regex": { "regex_rules": [ { "…规则…" : true } ] }
}
```
- 输出：
```json
{
  "merged_regex": { "regex_rules": [ { "…合并后唯一规则…" : true } ] },
  "meta": {
    "order": ["independent","preset","character"],
    "input_counts": { "independent": 2, "preset": 1, "character": 5 },
    "dedup_removed_count": 0,
    "total": 8
  }
}
```


## 策略细则

- 世界书合并
  - 展平规则：兼容 `[{…}, […], …]` 与对象输入，最终使用 `list[dict]` 输出，最大限度兼容现有模块对世界书的读取习惯。
  - 顺序保障：原世界书条目在前，角色卡 world_book.entries 条目在后。
  - 去重依据：仅按 id 去重（id 相同视为同条目）；不允许覆盖（保留先出现者，即原世界书优先）。
  - 字段保留：不强制规范 position/role/order，仅对缺失的 `enabled` 补 `true`（角色卡 entries）。

- 正则合并
  - 顺序保障：严格按“独立 → 预设 → 角色卡”拼接。
  - 去重与冲突：内部采用默认最佳策略（优先使用 id 作为唯一键；退化到 name；再退化到 find_regex），冲突保留先出现者，使独立正则优先级最高。
  - 规则归一化：支持直接数组与 `{"regex_rules":[…]}` 两种形态，并统一注入 `meta.source` 标识来源（independent/preset/character）。


## 使用示例（Python SDK）

以下演示如何在 Python 中调用 6 个 API。

- normalize（推荐总入口）
```python
import core

payload = {
  "preset": { … },
  "world_books": [ … ],
  "character": { … },
  "regex_files": { "items": [ … ] }
}

res = core.call_api("smarttavern/assets_normalizer/normalize", payload, method="POST", namespace="modules")
print(res["world_book"][:1], res["merged_regex"]["regex_rules"][:1])
```

- 提取与合并子功能（若仅需要部分能力）
```python
# 提取预设正则
core.call_api("smarttavern/assets_normalizer/extract_preset_regex", {"preset": preset_doc}, method="POST", namespace="modules")

# 提取角色卡世界书
core.call_api("smarttavern/assets_normalizer/extract_character_world_book", {"character": character_doc}, method="POST", namespace="modules")

# 提取角色卡正则
core.call_api("smarttavern/assets_normalizer/extract_character_regex", {"character": character_doc}, method="POST", namespace="modules")

# 合并世界书（仅 id 去重，不覆盖）
core.call_api("smarttavern/assets_normalizer/merge_world_books", {
    "world_books": world_books_doc,
    "character_world_book": {"items": char_wb_items}
}, method="POST", namespace="modules")

# 合并正则（独立 → 预设 → 角色卡；内部采用默认最佳策略）
core.call_api("smarttavern/assets_normalizer/merge_regex", {
    "independent_regex": independent_rules,
    "preset_regex": {"regex_rules": preset_rules},
    "character_regex": {"regex_rules": char_rules}
}, method="POST", namespace="modules")
```


## 测试

仓库已提供集成测试脚本，可直接运行（需确保网关可启动，默认端口 8050）：
```bash
python -u api/modules/SmartTavern/assets_normalizer/test_assets_normalizer.py
```

测试覆盖点：
- 提取预设正则（应提取到 1 条）
- 提取角色卡世界书（应 ≥ 5 条；样例中为 14 条）
- 提取角色卡正则（应提取到 5 条）
- 合并世界书（顺序与去重符合预期；样例 total=14）
- 合并正则（样例 total=8）
- normalize 总入口（输出单体世界书与单体正则并统计）


## 注意事项

- 世界书输出为"条目数组"而非 `{"entries":[…]}` 包裹，确保与现有模块（例如 in_chat_constructor、framing_prompt）的输入惯例一致。
- 角色卡 world_book.entries 的 `enabled` 若缺失将补 `true`，其余字段不做强制规范化。
- 正则合并策略固定为“独立优先”，禁止通过外部输入改变冲突策略，便于保持一致性与可控性。