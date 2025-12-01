# SmartTavern AI 对话补全工作流

统一的 AI 对话补全能力，整合对话管理与 LLM 调用。

## 功能

### 非流式补全 (`complete`)
- 读取对话文件获取完整 messages
- 调用 LLM API 生成响应
- 保存 AI 响应到对话文件
- 返回完整结果

### 流式补全 (`complete_stream`)
- 逐块返回 AI 生成内容（SSE）
- 实时显示生成进度
- 生成完成后自动保存

## 使用方法

### 非流式调用
```python
import core

result = core.call_api(
    "smarttavern/chat_completion/complete",
    {
        "conversation_file": "backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json",
        "llm_config_file": "backend_projects/SmartTavern/data/llm_configs/openai_gpt4.json"
    },
    method="POST",
    namespace="workflow"
)

if result["success"]:
    print(f"AI响应: {result['content']}")
    print(f"节点ID: {result['node_id']}")
    print(f"用量: {result['usage']}")
```

### 流式调用（前端）
```javascript
const eventSource = new EventSource(
  'http://localhost:8050/api/workflow/smarttavern/chat_completion/complete_stream?' +
  new URLSearchParams({
    conversation_file: 'backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json',
    llm_config_file: 'backend_projects/SmartTavern/data/llm_configs/openai_gpt4.json'
  })
)

eventSource.onmessage = (e) => {
  const data = JSON.parse(e.data)
  
  switch(data.type) {
    case 'chunk':
      console.log('收到块:', data.content)
      break
    case 'saved':
      console.log('已保存:', data.node_id)
      break
    case 'end':
      eventSource.close()
      break
  }
}
```

## LLM 配置文件格式

配置文件存放在：`backend_projects/SmartTavern/data/llm_configs/`

### OpenAI 格式
```json
{
  "name": "OpenAI GPT-4",
  "provider": "openai",
  "api_key": "${OPENAI_API_KEY}",
  "base_url": "https://api.openai.com/v1",
  "model": "gpt-4",
  "temperature": 0.7,
  "max_tokens": 2000,
  "stream": true
}
```

### Gemini 格式
```json
{
  "name": "Google Gemini Pro",
  "provider": "gemini",
  "api_key": "${GEMINI_API_KEY}",
  "base_url": "https://generativelanguage.googleapis.com/v1beta",
  "model": "gemini-pro",
  "temperature": 0.7,
  "max_tokens": 2048
}
```

## 工作流程

1. 读取对话文件 → 调用 `chat_branches/openai_messages`
2. 读取 LLM 配置文件
3. 调用 `llm_api/chat` 进行 AI 对话
4. 保存响应 → 调用 `chat_branches/append_message`
5. 返回结果（包含新节点ID和更新后的文档）

## 注意事项

- LLM 配置文件必须在 `backend_projects/SmartTavern/data/llm_configs/` 目录内
- API key 可以使用环境变量占位符：`${OPENAI_API_KEY}`
- 流式响应使用 SSE（Server-Sent Events）
- 非流式响应一次性返回完整JSON