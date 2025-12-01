# SmartTavern.image_binding 模块说明

位置：api/modules/SmartTavern/image_binding/

本模块提供“PNG 图片文件绑定”能力：将任意文件（世界书、正则规则、角色卡、预设、用户画像或其它）嵌入 PNG 图片的自定义数据块中，并支持提取、检测和信息查询。支持文件类型自动识别，兼容嵌套 JSON 数据结构。

相关代码
- 注册封装层：[filename](api/modules/SmartTavern/image_binding/image_binding.py)
  - API：嵌入文件到图片 [python.embed_files_to_image()](api/modules/SmartTavern/image_binding/image_binding.py:40)
  - API：从图片提取文件 [python.extract_files_from_image()](api/modules/SmartTavern/image_binding/image_binding.py:78)
  - API：获取嵌入文件信息 [python.get_embedded_files_info()](api/modules/SmartTavern/image_binding/image_binding.py:113)
  - API：检测图片是否包含嵌入文件 [python.is_image_with_embedded_files()](api/modules/SmartTavern/image_binding/image_binding.py:143)
  - API：获取支持的文件类型标签 [python.get_file_type_tags()](api/modules/SmartTavern/image_binding/image_binding.py:170)
- 实现层（核心逻辑）：[filename](api/modules/SmartTavern/image_binding/impl.py)
  - 主类：ImageBindingModule（PNG 块读写、压缩/解压、Base64 编解码与路由）
  - 自定义块名：PNG_CHUNK_NAME = b'stBN'（SmartTavern Binding Name）
- 变量常量： [filename](api/modules/SmartTavern/image_binding/variables.py)

支持的文件类型标签（FILE_TYPE_TAGS）
- "WB" 世界书
- "RX" 正则规则
- "CH" 角色卡
- "PS" 预设
- "PE" 用户画像
- "OT" 其它类型

API 列表
- smarttavern/image_binding/embed_files_to_image（将多个文件嵌入 PNG）
  - 注册定义：[python.embed_files_to_image()](api/modules/SmartTavern/image_binding/image_binding.py:40)
- smarttavern/image_binding/extract_files_from_image（从 PNG 提取文件）
  - 注册定义：[python.extract_files_from_image()](api/modules/SmartTavern/image_binding/image_binding.py:78)
- smarttavern/image_binding/get_embedded_files_info（查询 PNG 内嵌文件信息）
  - 注册定义：[python.get_embedded_files_info()](api/modules/SmartTavern/image_binding/image_binding.py:113)
- smarttavern/image_binding/is_image_with_embedded_files（检测 PNG 是否含嵌入文件）
  - 注册定义：[python.is_image_with_embedded_files()](api/modules/SmartTavern/image_binding/image_binding.py:143)
- smarttavern/image_binding/get_file_type_tags（获取支持的文件类型标签）
  - 注册定义：[python.get_file_type_tags()](api/modules/SmartTavern/image_binding/image_binding.py:170)

模块职责与行为
- 嵌入（embed）
  - 读取 PNG 全部数据块，在 IEND 块前插入自定义数据块（stBN），块内容为 zlib 压缩后的 JSON 字节
  - JSON 结构：{"version":"1.0","timestamp":"ISO8601","files":[{"name","type","content":"base64","size"}]}
  - 文件类型自动识别：基于路径关键词与 JSON 内容启发式判定（世界书/正则/角色卡/预设/用户画像/其他）
- 提取（extract）
  - 从指定 PNG 读取 stBN 块，解压并解析 JSON，将 files 写入指定输出目录（默认 exports/）
  - 支持 filter_types 过滤输出类型（如 ["WB","RX"]）
- 信息（get info）
  - 仅读取 stBN 块内文件列表，不输出内容（去掉 content 字段，减小体积）
- 检测（is_image_with_embedded_files）
  - 扫描 PNG 是否含 stBN 自定义块
- 文件类型标签（get_file_type_tags）
  - 返回 FILE_TYPE_TAGS 中定义的全部标签

输入/输出契约

1) API：embed_files_to_image（smarttavern/image_binding/embed_files_to_image）
- 输入（JSON Schema 概览，详见注册层定义 [python.embed_files_to_image()](api/modules/SmartTavern/image_binding/image_binding.py:40)）
  - image_path: string（必填）PNG 文件路径
  - file_paths: string[]（必填）待嵌入的文件路径列表
  - output_path?: string（可选）输出 PNG 路径，默认在原图路径 + "_embedded"
- 输出（JSON）
  - success: boolean
  - message: string
  - output_path?: string（成功时返回）
  - relative_path?: string（若输出在 shared/SmartTavern 下则为其相对路径）

2) API：extract_files_from_image（smarttavern/image_binding/extract_files_from_image）
- 输入（JSON Schema 概览，详见注册层定义 [python.extract_files_from_image()](api/modules/SmartTavern/image_binding/image_binding.py:78)）
  - image_path: string（必填）PNG 文件路径
  - output_dir?: string（可选）文件输出目录（默认 exports/）
  - filter_types?: string[]（可选）只提取指定类型标签（如 ["WB","RX"]）
- 输出（JSON）
  - success: boolean
  - message: string
  - files: array（提取的文件信息列表）

3) API：get_embedded_files_info（smarttavern/image_binding/get_embedded_files_info）
- 输入（JSON Schema 概览，详见注册层定义 [python.get_embedded_files_info()](api/modules/SmartTavern/image_binding/image_binding.py:113)）
  - image_path: string（必填）
- 输出（JSON）
  - success: boolean
  - message: string
  - files_info: array（不包含 content 字段的文件信息）

4) API：is_image_with_embedded_files（smarttavern/image_binding/is_image_with_embedded_files）
- 输入（JSON Schema 概览，详见注册层定义 [python.is_image_with_embedded_files()](api/modules/SmartTavern/image_binding/image_binding.py:143)）
  - image_path: string（必填）
- 输出（JSON）
  - success: boolean
  - has_embedded_files: boolean
  - message: string

5) API：get_file_type_tags（smarttavern/image_binding/get_file_type_tags）
- 输入：空对象
- 输出（JSON）
  - success: boolean
  - file_type_tags: string[]（["WB","RX","CH","PS","PE","OT"]）
  - message?: string

调用示例（Python SDK）
- 嵌入文件：
```python
import core
res = core.call_api(
  "smarttavern/image_binding/embed_files_to_image",
  {
    "image_path": "assets/cover.png",
    "file_paths": [
      "backend_projects/SmartTavern/data/world_books/参考用main_world.json",
      "backend_projects/SmartTavern/data/presets/Default.json"
    ],
    "output_path": "assets/cover_embedded.png"
  },
  method="POST",
  namespace="modules"
)
# 返回：{"success": true, "output_path": "...", "relative_path": "..."}
```

- 提取文件：
```python
res = core.call_api(
  "smarttavern/image_binding/extract_files_from_image",
  {
    "image_path": "assets/cover_embedded.png",
    "output_dir": "exports/",
    "filter_types": ["WB","RX"]
  },
  method="POST",
  namespace="modules"
)
# 返回：{"success": true, "files": [{"path": "...", "type": "WB", "name": "..."}, ...]}
```

- 查询信息：
```python
res = core.call_api(
  "smarttavern/image_binding/get_embedded_files_info",
  {"image_path": "assets/cover_embedded.png"},
  method="POST",
  namespace="modules"
)
# 返回：{"success": true, "files_info": [{"name":"...","type":"WB","size":1234}, ...]}
```

- 检测是否包含嵌入：
```python
res = core.call_api(
  "smarttavern/image_binding/is_image_with_embedded_files",
  {"image_path": "assets/cover_embedded.png"},
  method="POST",
  namespace="modules"
)
# 返回：{"success": true, "has_embedded_files": true}
```

- 获取类型标签：
```python
res = core.call_api(
  "smarttavern/image_binding/get_file_type_tags",
  {},
  method="POST",
  namespace="modules"
)
# 返回：{"success": true, "file_type_tags": ["WB","RX","CH","PS","PE","OT"]}
```

实现与限制
- PNG 自定义数据块名：b"stBN"（见实现层）
- 数据压缩：zlib，文本 JSON 使用 UTF-8 编码
- 文件内容：嵌入时 Base64 编码；提取时写回原始二进制
- 体积上限：MAX_FILE_SIZE 当前无上限（float('inf')），建议在生产根据需求加限
- 版本字段：BINDING_VERSION="1.0"；跨版本时会打印警告但尽量解析
- 容错：解码失败、JSON 异常、缺失字段时将跳过该条并继续，不影响其它文件

注意事项
- 仅支持 PNG；其它图片格式请先转换
- 嵌入后图片可正常显示，但体积变大；请留意网络传输与存储成本
- 自动类型识别基于启发式规则，并非 100% 精确；可在使用端根据业务覆盖或二次标注
- 嵌入路径建议采用项目内规范目录，便于相对路径转换与跨端识别

参考
- 注册层： [filename](api/modules/SmartTavern/image_binding/image_binding.py)
- 实现层： [filename](api/modules/SmartTavern/image_binding/impl.py)
- 变量常量： [filename](api/modules/SmartTavern/image_binding/variables.py)