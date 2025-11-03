// SmartTavern Workflow - Threaded Chat UI Channels (TS)
// 职责：定义"线程式聊天组件"的 UI 事件协议，使组件仅响应事件与状态更新；业务流程由工作流 JS（插件）编排。
// 事件通过 Host 事件总线派发与监听：见 [`Host.events.on()`](frontend_projects/SmartTavern/src/workflow/core/host.js:58)
//
// 设计目标：
// - 组件只负责响应事件（创建占位、更新状态、渲染），不直接依赖服务层。
// - 工作流 JS 负责根据业务逻辑（消息发送成功后触发 AI 等）去 emit 这些 UI 事件。
// - 事件载荷包含最小必要上下文（conversationFile + nodeId/tag），便于过滤与并行编排。

// ============ Type Definitions ============

/** 创建助手占位消息 Payload */
export interface ThreadedAssistantPlaceholderCreatePayload {
  conversationFile: string;
  tempNodeId: string;
  meta?: any;
}

// ============ Event Constants ============

// 事件约定：
//
// 1) 创建助手占位消息（由工作流发起，组件负责渲染与等待态）
//    EVT_THREAD_ASSIST_PLACEHOLDER_CREATE = 'ui.threaded.assistant.placeholder.create'
//    payload: {
//      conversationFile: string,
//      tempNodeId: string,   // 用于 UI 渲染与 Completion 事件 tag 对齐
//      meta?: any            // 可选附加元数据（如来源、策略）
//    }
//
// 2) （可选拓展）占位移除/状态更新等事件，可在后续需求中补充
//    如：'ui.threaded.assistant.placeholder.remove' / 'ui.threaded.state.update' 等
//
// 使用示例（工作流 JS 侧）：
//   import * as Threaded from '/src/workflow/channels/threaded'
//   import * as Completion from '/src/workflow/channels/completion'
//   // 在"用户消息发送成功"后：
//   const tempId = `temp_${Date.now()}`
//   host.events.emit(Threaded.EVT_THREAD_ASSIST_PLACEHOLDER_CREATE, { conversationFile, tempNodeId: tempId })
//   host.events.emit(Completion.EVT_COMPLETION_REQ, { conversationFile, llmConfigFile, mode: 'auto', tag: tempId })

export const EVT_THREAD_ASSIST_PLACEHOLDER_CREATE = 'ui.threaded.assistant.placeholder.create'

// 默认导出：常量聚合（便于一次性导入）
const ThreadedUiChannels = {
  EVT_THREAD_ASSIST_PLACEHOLDER_CREATE,
}

export default ThreadedUiChannels