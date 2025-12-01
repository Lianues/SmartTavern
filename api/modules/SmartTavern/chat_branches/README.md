# SmartTavern.chat_branches 模块说明（无状态版）

位置：api/modules/SmartTavern/chat_branches/

本模块提供"分支对话"的无状态视图计算能力，仅负责从单个对话文件（最小分支树结构）导出 OpenAI messages 与分支情况表（j/n），不管理会话状态。

相关代码
- 注册封装层（API 定义/Schema）：[filename](api/modules/SmartTavern/chat_branches/chat_branches.py:1)
  - OpenAI 消息导出（无状态）：[python.function(openai_messages)](api/modules/SmartTavern/chat_branches/chat_branches.py:31)
  - 分支情况表（无状态）：[python.function(branch_table)](api/modules/SmartTavern/chat_branches/chat_branches.py:64)
- 实现层（无状态视图计算）：[filename](api/modules/SmartTavern/chat_branches/impl.py:1)
  - 文件/对象加载工具：[python.function(_load_doc_from_file_or_obj)](api/modules/SmartTavern/chat_branches/impl.py:51)
  - OpenAI 消息导出：[python.function(openai_messages_from_doc)](api/modules/SmartTavern/chat_branches/impl.py:142)
  - 分支情况表计算：[python.function(branch_table_from_doc)](api/modules/SmartTavern/chat_branches/impl.py:168)
  - 辅助工具：[python.function(_buckets_from_doc)](api/modules/SmartTavern/chat_branches/impl.py:86), [python.function(_normalize_path_from_doc)](api/modules/SmartTavern/chat_branches/impl.py:111)
- 测试脚本：[filename](api/modules/SmartTavern/chat_branches/test_chat_branches.py:1)
- 示例数据（最小分支树文件）：[filename](backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json:1)

最小分支树文件结构
```json
{
  "root": "node_id",
  "nodes": {
    "node_id": { "pid": "parent_id|null", "role": "system|user|assistant", "content": "..." }
  },
  "children": { "parent_id": ["child_id1", "child_id2"] },  // 可选
  "active_path": ["root", "...", "leafId"]                  // 可选
}
```

API 列表（modules 命名空间）

1. smarttavern/chat_branches/openai_messages（无状态）
   - 输入（二选一）：
     - doc: object（最小分支树 JSON 对象）
     - file: string（对话文件路径，相对仓库根，如 "backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json"）
   - 输出：{ messages: [{role, content}], path: ["node_id", ...] }
   
2. smarttavern/chat_branches/branch_table（无状态）
   - 输入（二选一）：
     - doc: object（最小分支树 JSON 对象）
     - file: string（对话文件路径）
   - 输出：{ latest: {depth, j, n, node_id}, levels: [{depth, node_id, j, n}] }

3. smarttavern/chat_branches/get_latest_message（无状态）
   - 输入（二选一）：
     - doc: object（最小分支树 JSON 对象）
     - file: string（对话文件路径）
   - 输出：{ node_id: "...", role: "system|user|assistant", content: "...", depth: number }
   - 说明：根据 active_path 提取最后一条消息；若 active_path 为空或无效，返回 root 节点

4. smarttavern/chat_branches/update_message（修改消息内容）
   - 输入：
     - node_id: string（要修改的节点 ID）
     - content: string（新内容）
     - doc/file: 二选一
   - 输出：更新后的完整 doc（含 updated_at 时间戳）

5. smarttavern/chat_branches/truncate_after（修剪消息树）
   - 输入：
     - node_id: string（保留到此节点，删除其所有子孙）
     - doc/file: 二选一
   - 输出：更新后的完整 doc（nodes 删除子树，children 清理，active_path 截断，updated_at 更新）
   - 说明：级联删除所有子孙节点；若 node_id 在 active_path 中，截断到该节点

6. smarttavern/chat_branches/append_message（追加新消息）
   - 输入：
     - node_id: string（新节点 ID，必须唯一）
     - pid: string（父节点 ID，必须存在）
     - role: string（system|user|assistant）
     - content: string（消息内容）
     - doc/file: 二选一
   - 输出：更新后的完整 doc（nodes 新增，children 更新父节点，active_path 追加新节点，updated_at 更新）
   - 说明：若 pid 是 active_path 的最后一个节点，新消息会自动追加到 active_path 末尾

使用示例（Python SDK）

方式1：传入 doc 对象
```python
import json
from pathlib import Path

# 读取对话文件
with open("backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json") as f:
    doc = json.load(f)

# 导出 OpenAI messages
msgs = core.call_api(
    "smarttavern/chat_branches/openai_messages",
    {"doc": doc},
    method="POST",
    namespace="modules"
)

# 计算分支情况表
table = core.call_api(
    "smarttavern/chat_branches/branch_table",
    {"doc": doc},
    method="POST",
    namespace="modules"
)
```

方式2：传入 file 路径（推荐，避免手动读取）
```python
# 导出 OpenAI messages
msgs = core.call_api(
    "smarttavern/chat_branches/openai_messages",
    {"file": "backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json"},
    method="POST",
    namespace="modules"
)

# 计算分支情况表
table = core.call_api(
    "smarttavern/chat_branches/branch_table",
    {"file": "backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json"},
    method="POST",
    namespace="modules"
)

# 获取最后一条消息
latest = core.call_api(
    "smarttavern/chat_branches/get_latest_message",
    {"file": "backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json"},
    method="POST",
    namespace="modules"
)
# 返回：{"node_id": "n_ass3", "role": "assistant", "content": "...", "depth": 5}

# 修改消息内容
updated = core.call_api(
    "smarttavern/chat_branches/update_message",
    {
        "file": "backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json",
        "node_id": "n_ass1",
        "content": "修改后的内容"
    },
    method="POST",
    namespace="modules"
)
# 返回：完整 doc（含 updated_at）

# 修剪消息树（删除 n_ass1 的所有子孙）
truncated = core.call_api(
    "smarttavern/chat_branches/truncate_after",
    {
        "file": "backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json",
        "node_id": "n_ass1"
    },
    method="POST",
    namespace="modules"
)
# 返回：完整 doc（n_user2、n_ass3 已删除，active_path 截断到 n_ass1）

# 追加新消息
appended = core.call_api(
    "smarttavern/chat_branches/append_message",
    {
        "file": "backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json",
        "node_id": "n_new_user",
        "pid": "n_ass3",
        "role": "user",
        "content": "这是新追加的用户消息"
    },
    method="POST",
    namespace="modules"
)
# 返回：完整 doc（新节点已创建，children 已更新，active_path 已追加）
```

行为细节与边界
- 输入模式（二选一）：
  - doc: 直接传入最小分支树 JSON 对象
  - file: 传入对话文件路径（相对仓库根），模块自动读取并验证范围（仅允许 conversations 目录）
- active_path 规范化：
  - 若缺省或不连通，自动从 root 开始规范化路径（见 [python.function(_normalize_path_from_doc)](api/modules/SmartTavern/chat_branches/impl.py:111)）
- children 构建：
  - 优先采用显式 doc.children；若缺省则从 nodes[*].pid 反向推导（见 [python.function(_buckets_from_doc)](api/modules/SmartTavern/chat_branches/impl.py:86)）
- 分支指示 j/n：
  - j = 当前子节点在父节点 children 中的位置（1-based）
  - n = 父节点 children 总数
  - 若无法判定则为 null

测试
- 内置测试脚本验证 doc 与 file 两种输入方式：
  - [filename](api/modules/SmartTavern/chat_branches/test_chat_branches.py:1)
- 运行（仓库根目录）：
  ```bash
  python api/modules/SmartTavern/chat_branches/test_chat_branches.py
  ```
- 预期输出：
  - 验证 openai_messages(doc) 与 openai_messages(file) 结果一致
  - 验证 branch_table(doc) 与 branch_table(file) 结果一致

参考
- API 封装层： [filename](api/modules/SmartTavern/chat_branches/chat_branches.py:1)
- 实现层： [filename](api/modules/SmartTavern/chat_branches/impl.py:1)
- 示例对话文件： [filename](backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json:1)