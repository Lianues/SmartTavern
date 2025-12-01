// SmartTavern Workflow - Chat Channels (TS)
// 约定一组标准事件，用于"新建对话 / 读取历史对话"在不同模块/插件之间的解耦通信。
// 使用 Host 事件总线派发和监听：Host.events.on/emit（见 [`Host.events.on()`](frontend_projects/SmartTavern/src/workflow/core/host.js:58)）
//
// 命名规范：
// - UI 意图（打开模态等）：ui.modal.*
// - 工作流动作：workflow.chat.*
//
// 载荷（payload）约定说明：
// - 所有 *request 事件允许空载荷：空载荷通常意味着"仅打开对应 UI，让用户选择/确认"
// - 若直接提供参数，将尝试立即执行（例如 load.request 传入 file 则直接加载该存档）

// ============ Type Definitions ============

/** 创建对话请求 Payload */
export interface ChatCreateRequestPayload {
  type?: 'threaded' | 'sandbox';
  meta?: any;
  preset?: any;
  persona?: any;
  ui?: boolean;
  [key: string]: any;
}

/** 创建对话成功 Payload */
export interface ChatCreateSuccessPayload {
  file?: string;
  doc?: any;
  meta?: any;
}

/** 创建对话失败 Payload */
export interface ChatCreateFailurePayload {
  error: string;
  detail?: any;
}

/** 加载对话请求 Payload */
export interface ChatLoadRequestPayload {
  file?: string;
}

/** 加载对话成功 Payload */
export interface ChatLoadSuccessPayload {
  file: string;
  doc?: any;
  meta?: any;
}

/** 加载对话失败 Payload */
export interface ChatLoadFailurePayload {
  error: string;
  detail?: any;
}

// ============ Event Constants ============

export const EVT_OPEN_NEW_CHAT = 'ui.modal.openNewChat'
export const EVT_OPEN_LOAD = 'ui.modal.openLoad'

export const EVT_CHAT_CREATE_REQ = 'workflow.chat.create.request'
export const EVT_CHAT_CREATE_OK = 'workflow.chat.create.success'
export const EVT_CHAT_CREATE_FAIL = 'workflow.chat.create.failure'

export const EVT_CHAT_LOAD_REQ = 'workflow.chat.load.request'
export const EVT_CHAT_LOAD_OK = 'workflow.chat.load.success'
export const EVT_CHAT_LOAD_FAIL = 'workflow.chat.load.failure'

// 事件一览：
// 1) 打开"新建对话"模态（不直接执行创建）
//    - EVT_OPEN_NEW_CHAT
//    - payload: 无
// 2) 打开"读取存档"模态（不直接执行加载）
//    - EVT_OPEN_LOAD
//    - payload: 无
//
// 3) 请求创建对话（可直接创建或仅打开模态由用户确认）
//    - EVT_CHAT_CREATE_REQ
//    - payload: { type?: 'threaded'|'sandbox', meta?: any, preset?: any, persona?: any, ... } | { ui?: true }
//      说明：当前默认实现中，未提供完整后端直连创建参数时，将回退为打开"新建对话"模态；
//            若后续提供"立即创建"的参数协议，可在 App 层或控制器中直连创建后发出 *_OK/*_FAIL。
// 4) 创建成功/失败回执（供监听）
//    - EVT_CHAT_CREATE_OK:   payload: { file?: string, doc?: any, meta?: any }
//    - EVT_CHAT_CREATE_FAIL: payload: { error: string, detail?: any }
//
// 5) 请求加载对话（传入 file 直接加载；否则打开"读取存档"模态）
//    - EVT_CHAT_LOAD_REQ
//    - payload: { file?: string }
// 6) 加载成功/失败回执（供监听）
//    - EVT_CHAT_LOAD_OK:   payload: { file: string, doc?: any, meta?: any }
//    - EVT_CHAT_LOAD_FAIL: payload: { error: string, detail?: any }
//
// 示例（插件侧）：
//   import * as Chat from '@/workflow/channels/chat'
//   host.events.emit(Chat.EVT_CHAT_LOAD_REQ, { file: '/data/conversations/222.json' })
//   host.events.emit(Chat.EVT_OPEN_NEW_CHAT)
//
// 示例（应用侧监听）：在 App.vue 中订阅这些事件并桥接到现有 UI/服务。
// 见实现参考：[`App.vue`](frontend_projects/SmartTavern/src/App.vue:1)

const ChatChannels = {
  EVT_OPEN_NEW_CHAT,
  EVT_OPEN_LOAD,
  EVT_CHAT_CREATE_REQ,
  EVT_CHAT_CREATE_OK,
  EVT_CHAT_CREATE_FAIL,
  EVT_CHAT_LOAD_REQ,
  EVT_CHAT_LOAD_OK,
  EVT_CHAT_LOAD_FAIL,
}

export default ChatChannels