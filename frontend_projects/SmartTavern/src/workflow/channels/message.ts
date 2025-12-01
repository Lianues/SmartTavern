// SmartTavern Workflow - Message Channels (TS)
// 标准事件通道：用于"消息发送/编辑"的请求与结果广播，便于插件监听并进行消息增强。
// 通过 Host 事件总线派发与监听，API 见 [`Host.events.on()`](frontend_projects/SmartTavern/src/workflow/core/host.js:58)
//
// 目标：
// - 统一消息发送/编辑的事件协议（request/success/failure）
// - 插件与外部逻辑可在 success 阶段做后处理（如情感分析、关键词提取、自动打标签、回显提示等）
// - 组件与服务层可逐步迁移为"事件驱动"，保持向后兼容（组件在成功/失败后也可主动广播事件）

// ============ Type Definitions ============

/** 消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system'

/** 发送消息请求 Payload */
export interface MessageSendRequestPayload {
  conversationFile: string;
  parentId: string;
  nodeId?: string;
  role: MessageRole;
  content: string;
  tag?: string;
}

/** 发送消息成功 Payload */
export interface MessageSendSuccessPayload {
  conversationFile: string;
  nodeId: string;
  role: string;
  content: string;
  doc?: any;
  tag?: string;
}

/** 发送消息失败 Payload */
export interface MessageSendFailurePayload {
  conversationFile?: string;
  message: string;
  detail?: any;
  tag?: string;
}

/** 编辑消息请求 Payload */
export interface MessageEditRequestPayload {
  conversationFile: string;
  nodeId: string;
  content: string;
  tag?: string;
}

/** 编辑消息成功 Payload */
export interface MessageEditSuccessPayload {
  conversationFile: string;
  nodeId: string;
  content: string;
  doc?: any;
  tag?: string;
}

/** 编辑消息失败 Payload */
export interface MessageEditFailurePayload {
  conversationFile?: string;
  nodeId?: string;
  message: string;
  detail?: any;
  tag?: string;
}

// ============ Event Constants ============

// 事件与载荷（payload）约定：
//
// 1) 发送请求
//    EVT_MESSAGE_SEND_REQ = 'workflow.message.send.request'
//    payload: {
//      conversationFile: string,
//      parentId: string,       // 父节点（active_path 末尾）
//      nodeId?: string,        // 新消息节点 id（可选；如不提供由桥接器生成）
//      role: 'user'|'assistant'|'system',
//      content: string,
//      tag?: string            // 可选通道标记，便于关联后续事件
//    }
//
// 2) 发送结果
//    EVT_MESSAGE_SEND_OK  = 'workflow.message.send.success'
//    payload: {
//      conversationFile: string,
//      nodeId: string,
//      role: string,
//      content: string,
//      doc?: any,              // 完整文档（用于状态同步）
//      tag?: string
//    }
//
//    EVT_MESSAGE_SEND_FAIL = 'workflow.message.send.failure'
//    payload: {
//      conversationFile?: string,
//      message: string,
//      detail?: any,
//      tag?: string
//    }
//
// 3) 编辑请求
//    EVT_MESSAGE_EDIT_REQ = 'workflow.message.edit.request'
//    payload: {
//      conversationFile: string,
//      nodeId: string,
//      content: string,
//      tag?: string
//    }
//
// 4) 编辑结果
//    EVT_MESSAGE_EDIT_OK  = 'workflow.message.edit.success'
//    payload: {
//      conversationFile: string,
//      nodeId: string,
//      content: string,
//      doc?: any,
//      tag?: string
//    }
//
//    EVT_MESSAGE_EDIT_FAIL = 'workflow.message.edit.failure'
//    payload: {
//      conversationFile?: string,
//      nodeId?: string,
//      message: string,
//      detail?: any,
//      tag?: string
//    }
//
// 使用示例（插件侧）：
//   import * as Msg from '/src/workflow/channels/message'
//   // 监听用户消息发送成功，做增强处理（如追加系统提示/打标签）
//   const off = host.events.on(Msg.EVT_MESSAGE_SEND_OK, (p) => {
//     if (p.role === 'user') {
//       host.appendMessage({ role: 'system', content: `已收到消息（长度=${p.content.length}）` })
//     }
//   })

export const EVT_MESSAGE_SEND_REQ = 'workflow.message.send.request'
export const EVT_MESSAGE_SEND_OK = 'workflow.message.send.success'
export const EVT_MESSAGE_SEND_FAIL = 'workflow.message.send.failure'

export const EVT_MESSAGE_EDIT_REQ = 'workflow.message.edit.request'
export const EVT_MESSAGE_EDIT_OK = 'workflow.message.edit.success'
export const EVT_MESSAGE_EDIT_FAIL = 'workflow.message.edit.failure'

// 默认导出：常量聚合
const MessageChannels = {
  EVT_MESSAGE_SEND_REQ,
  EVT_MESSAGE_SEND_OK,
  EVT_MESSAGE_SEND_FAIL,
  EVT_MESSAGE_EDIT_REQ,
  EVT_MESSAGE_EDIT_OK,
  EVT_MESSAGE_EDIT_FAIL,
}

export default MessageChannels