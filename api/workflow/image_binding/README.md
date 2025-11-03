# image_binding 工作流说明

位置：api/workflow/image_binding/

本工作流提供对 SmartTavern.image_binding 模块的一组“转发式”API封装，遵循斜杠路径与 JSON Schema 规范。它不直接实现业务逻辑，而是将请求适配并转发至模块层 API（smarttavern/image_binding/*），统一对外暴露工作流命名空间的调用入口。

相关代码
- 工作流封装（注册层）：[python.image_binding.image_binding.py](api/workflow/image_binding/image_binding.py:1)
  - 嵌入文件到图片：[python.api_embed_files_to_image()](api/workflow/image_binding/image_binding.py:37)
  - 从图片提取文件：[python.api_extract_files_from_image()](api/workflow/image_binding/image_binding.py:69)
  - 获取嵌入文件信息：[python.api_get_embedded_files_info()](api/workflow/image_binding/image_binding.py:97)
  - 检测图片是否包含嵌入文件：[python.api_is_image_with_embedded_files()](api/workflow/image_binding/image_binding.py:125)
  - 获取文件类型标签：[python.api_get_file_type_tags()](api/workflow/image_binding/image_binding.py:149)
  - 一键测试（集成演示）：[python.api_test_image_binding()](api/workflow/image_binding/image_binding.py:182)
- 空模块初始化文件：[filename](api/workflow/image_binding/__init__.py)

依赖的模块 API（被动转发目标）
- 模块文档参见：[filename](api/modules/SmartTavern/image_binding/README.md)
- 目标 API 路径（modules 命名空间）：
  - smarttavern/image_binding/embed_files_to_image
  - smarttavern/image_binding/extract_files_from_image
  - smarttavern/image_binding/get_embedded_files_info
  - smarttavern/image_binding/is_image_with_embedded_files
  - smarttavern/image_binding/get_file_type_tags

API 列表（workflow 命名空间）

1) image_binding/embed_files_to_image（工作流:嵌入文件到图片）
- 注册定义：[python.api_embed_files_to_image()](api/workflow/image_binding/image_binding.py:37)
- 输入（JSON）：
  - image_path: string（必填）PNG 路径
  - file_paths: string[]（必填）待嵌入文件路径数组
  - output_path?: string（可选）输出 PNG 路径（默认原图路径加后缀）
- 输出（JSON）：
  - success: boolean
  - message: string
  - output_path?: string
  - relative_path?: string

2) image_binding/extract_files_from_image（工作流:从图片提取文件）
- 注册定义：[python.api_extract_files_from_image()](api/workflow/image_binding/image_binding.py:69)
- 输入（JSON）：
  - image_path: string（必填）PNG 路径
  - output_dir?: string（可选）输出目录，默认 exports/
  - filter_types?: string[]（可选）文件类型标签过滤（如 ["WB","RX"]）
- 输出（JSON）：
  - success: boolean
  - message: string
  - files: string[]（提取出的文件路径列表）

3) image_binding/get_embedded_files_info（工作流:获取嵌入文件信息）
- 注册定义：[python.api_get_embedded_files_info()](api/workflow/image_binding/image_binding.py:97)
- 输入（JSON）：
  - image_path: string（必填）
- 输出（JSON）：
  - success: boolean
  - message: string
  - files_info: object[]（不含 content 的文件信息数组）

4) image_binding/is_image_with_embedded_files（工作流:检测图片是否包含嵌入文件）
- 注册定义：[python.api_is_image_with_embedded_files()](api/workflow/image_binding/image_binding.py:125)
- 输入（JSON）：
  - image_path: string（必填）
- 输出（JSON）：
  - success: boolean
  - has_embedded_files: boolean
  - message: string

5) image_binding/get_file_type_tags（工作流:获取文件类型标签）
- 注册定义：[python.api_get_file_type_tags()](api/workflow/image_binding/image_binding.py:149)
- 输入（JSON）：{}
- 输出（JSON）：
  - success: boolean
  - file_type_tags: string[]（["WB","RX","CH","PS","PE","OT"]）
  - message?: string

6) image_binding/test（工作流:图像绑定测试）
- 注册定义：[python.api_test_image_binding()](api/workflow/image_binding/image_binding.py:182)
- 输入（JSON）：
  - image_path?: string（可选，默认 shared/SmartTavern/测试图片.png）
  - test_files?: string[]（可选，默认内置一组 world/preset/regex 等）
- 输出（JSON）：
  - success: boolean
  - message: string
  - embed_result: object（嵌入步骤返回）
  - info_result: object（信息查询步骤返回）
  - extract_result: object（提取步骤返回）
  - test_output_image: string（测试输出图）
  - test_output_dir: string（提取输出目录）

调用示例（Python SDK）
- 嵌入文件（工作流命名空间调用）：
```python
import core
res = core.call_api(
  "image_binding/embed_files_to_image",
  {
    "image_path": "assets/cover.png",
    "file_paths": [
      "backend_projects/SmartTavern/data/world_books/参考用main_world.json",
      "backend_projects/SmartTavern/data/presets/Default.json"
    ],
    "output_path": "assets/cover_embedded.png"
  },
  method="POST",
  namespace="workflow"
)
# 结果与模块层一致：{"success": true, "output_path": "...", "relative_path": "..."}
```

- 一键测试：
```python
res = core.call_api(
  "image_binding/test",
  {
    "image_path": "shared/SmartTavern/测试图片.png",
    "test_files": [
      "backend_projects/SmartTavern/data/world_books/参考用main_world.json",
      "backend_projects/SmartTavern/data/regex_rules/remove_xml_tags.json",
      "backend_projects/SmartTavern/data/presets/Default.json"
    ]
  },
  method="POST",
  namespace="workflow"
)
# 结果包含 embed/info/extract 三阶段返回，用于端到端验证
```

注意事项
- 本工作流为“薄封装”，仅负责转发调用与返回值形态校验/包装；核心逻辑在模块层实现
- image_path 必须为 PNG 文件
- 当模块层返回非字典或异常时，本工作流将包装为 {success:false, message:"..."} 的错误响应形式
- 测试接口会在 shared/SmartTavern/test_image_binding 下创建测试输出与提取目录

参考
- 工作流封装： [python.image_binding.image_binding.py](api/workflow/image_binding/image_binding.py:1)
- 模块实现文档： [filename](api/modules/SmartTavern/image_binding/README.md)