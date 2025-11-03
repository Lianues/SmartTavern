# SmartTavern AI 调用集成指南

## 后端工作流

已创建 AI 对话补全工作流：`api/workflow/smarttavern/chat_completion/`

- **非流式**：`smarttavern/chat_completion/complete`
- **流式**：`smarttavern/chat_completion/complete_stream`

## 前端服务层

已创建：`src/services/chatCompletion.js`

## 使用示例

### 方式1：非流式调用（简单场景）

```javascript
import ChatCompletion from '@/services/chatCompletion.js'

async function callAI() {
  try {
    const result = await ChatCompletion.complete({
      conversationFile: 'backend_projects/SmartTavern/data/conversations/branch_demo/conversation.json',
      llmConfigFile: 'backend_projects/SmartTavern/data/llm_configs/openai_gpt4.json'
    })
    
    if (result.success) {
      console.log('AI响应:', result.content)
      console.log('新节点ID:', result.node_id)
      console.log('用量:', result.usage)
      
      // 更新前端状态
      // 1. 添加新消息到列表
      messages.push({
        id: result.node_id,
        role: 'assistant',
        content: result.content
      })
      
      // 2. 更新文档
      Object.assign(conversationDoc, result.doc)
      
      // 3. 重新加载分支信息
      await loadBranchInfo()
    }
  } catch (error) {
    console.error('AI调用失败:', error)
  }
}
```

### 方式2：流式调用（实时显示）

```javascript
import ChatCompletion from '@/services/chatCompletion.js'

function callAIStreaming() {
  // 创建占位消息
  const placeholderMsg = {
    id: `temp_${Date.now()}`,
    role: 'assistant',
    content: ''
  }
  messages.push(placeholderMsg)
  
  const eventSource = ChatCompletion.completeStream({
    conversationFile: props.conversationFile,
    llmConfigFile: 'backend_projects/SmartTavern/data/llm_configs/openai_gpt4.json',
    callbacks: {
      onChunk: (content) => {
        // 逐块追加内容
        placeholderMsg.content += content
      },
      
      onSaved: ({ node_id, doc, usage }) => {
        // 保存成功，更新真实ID
        placeholderMsg.id = node_id
        console.log('已保存:', node_id)
        console.log('用量:', usage)
        
        // 更新文档
        Object.assign(conversationDoc, doc)
      },
      
      onError: (message) => {
        console.error('AI错误:', message)
        // 显示错误提示
      },
      
      onEnd: async () => {
        console.log('流式调用完成')
        // 重新加载分支信息
        await loadBranchInfo()
        eventSource.close()
      }
    }
  })
  
  // 保存 eventSource 引用，用于取消
  return eventSource
}
```

## 集成到 ThreadedChatPreview.vue

修改 `onSubmit` 函数，在发送用户消息后自动调用AI：

```javascript
async function onSubmit(text) {
  // ... 现有代码：发送用户消息 ...
  
  // 调用AI生成响应（可选：根据用户设置决定是否自动调用）
  if (autoCallAI) {
    const llmConfigFile = 'backend_projects/SmartTavern/data/llm_configs/openai_gpt4.json'
    
    // 创建占位消息
    const aiPlaceholder = {
      id: `temp_${Date.now()}`,
      role: 'assistant',
      content: ''
    }
    props.messages.push(aiPlaceholder)
    
    // 流式调用
    ChatCompletion.completeStream({
      conversationFile: props.conversationFile,
      llmConfigFile: llmConfigFile,
      callbacks: {
        onChunk: (content) => {
          aiPlaceholder.content += content
        },
        onSaved: ({ node_id, doc }) => {
          aiPlaceholder.id = node_id
          Object.assign(props.conversationDoc, doc)
        },
        onError: (message) => {
          console.error('AI调用失败:', message)
          // 显示错误并移除占位消息
        },
        onEnd: async () => {
          await loadBranchInfo()
          refreshIcons()
        }
      }
    })
  }
}
```

## LLM 配置管理

建议在侧边栏添加"AI配置"面板，让用户：
1. 选择LLM配置文件
2. 编辑配置（API key、模型、参数等）
3. 测试连接
4. 设置是否自动调用AI

配置文件位置：`backend_projects/SmartTavern/data/llm_configs/*.json`

## 注意事项

1. **API Key安全**：不要在前端硬编码API key
2. **错误处理**：提供友好的错误提示
3. **用户控制**：让用户选择是否/何时调用AI
4. **流式体验**：实时显示生成内容，提升交互体验
5. **文档同步**：调用后更新 `conversationDoc` 和分支信息