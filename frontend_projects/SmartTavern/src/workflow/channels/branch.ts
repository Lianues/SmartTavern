// SmartTavern Workflow - Branch Channels (TS)
// 职责：将"分支相关操作"（读取分支表/切换分支/删除分支/重试创建新分支/用户消息智能重试等）抽象为标准事件协议。
// 组件仅订阅这些事件的 OK/FAIL 来更新本地 UI 状态；真正的服务调用由桥接器负责。
// 事件总线：见 [Host.events](frontend_projects/SmartTavern/src/workflow/core/host.js)
//
// 设计目标：
// - 彻底去除组件对服务层的直接依赖；所有分支操作均事件化。
// - 工作流脚本/插件可拦截或编排这些事件，实现更灵活的行为组合。
// - 事件载荷具有最小必要上下文（conversationFile + nodeId/j 等），并允许 tag 做通道隔离。
//
// 基本术语：
// - conversationFile: 后端对话 JSON 文件路径
// - nodeId: 节点 ID（形如 n_user123/n_ass123）
// - j/n: 当前分支位置/总分支数（来自后端分支表）
// - tag: 可选的请求标识（用于插件或 UI 并行请求的隔离）

// ============ Type Definitions ============

/** 分支表请求 Payload */
export interface BranchTableRequestPayload {
  conversationFile: string;
  tag?: string;
}

/** 分支表成功 Payload */
export interface BranchTableSuccessPayload {
  conversationFile: string;
  result: any;
  tag?: string;
}

/** 分支表失败 Payload */
export interface BranchTableFailurePayload {
  conversationFile?: string;
  message: string;
  detail?: any;
  tag?: string;
}

/** 切换分支请求 Payload */
export interface BranchSwitchRequestPayload {
  conversationFile: string;
  targetJ: number;
  tag?: string;
}

/** 切换分支成功 Payload */
export interface BranchSwitchSuccessPayload {
  conversationFile: string;
  node?: any;
  doc?: any;
  tag?: string;
}

/** 切换分支失败 Payload */
export interface BranchSwitchFailurePayload {
  conversationFile?: string;
  message: string;
  detail?: any;
  tag?: string;
}

/** 删除分支请求 Payload */
export interface BranchDeleteRequestPayload {
  conversationFile: string;
  nodeId: string;
  tag?: string;
}

/** 删除分支成功 Payload */
export interface BranchDeleteSuccessPayload {
  conversationFile: string;
  doc?: any;
  active_path?: string[];
  switchedToNodeId?: string;
  tag?: string;
}

/** 删除分支失败 Payload */
export interface BranchDeleteFailurePayload {
  conversationFile?: string;
  nodeId?: string;
  message: string;
  detail?: any;
  tag?: string;
}

/** 重试助手消息请求 Payload */
export interface BranchRetryAssistRequestPayload {
  conversationFile: string;
  retryNodeId: string;
  newNodeId?: string;
  role?: 'assistant';
  content?: string;
  tag?: string;
}

/** 重试助手消息成功 Payload */
export interface BranchRetryAssistSuccessPayload {
  conversationFile: string;
  doc?: any;
  newNodeId: string;
  tag?: string;
}

/** 重试助手消息失败 Payload */
export interface BranchRetryAssistFailurePayload {
  conversationFile?: string;
  retryNodeId?: string;
  message: string;
  detail?: any;
  tag?: string;
}

/** 重试用户消息请求 Payload */
export interface BranchRetryUserRequestPayload {
  conversationFile: string;
  userNodeId: string;
  tag?: string;
}

/** 重试用户消息成功 Payload */
export interface BranchRetryUserSuccessPayload {
  conversationFile: string;
  action: 'retry_assistant' | 'create_assistant';
  assistantNodeId?: string;
  doc?: any;
  tag?: string;
}

/** 重试用户消息失败 Payload */
export interface BranchRetryUserFailurePayload {
  conversationFile?: string;
  userNodeId?: string;
  message: string;
  detail?: any;
  tag?: string;
}

/** 修剪分支请求 Payload */
export interface BranchTruncateRequestPayload {
  conversationFile: string;
  nodeId: string;
  tag?: string;
}

/** 修剪分支成功 Payload */
export interface BranchTruncateSuccessPayload {
  conversationFile: string;
  doc?: any;
  tag?: string;
}

/** 修剪分支失败 Payload */
export interface BranchTruncateFailurePayload {
  conversationFile?: string;
  nodeId?: string;
  message: string;
  detail?: any;
  tag?: string;
}

// ============ Event Constants ============

// ---------------------------------------------------------
// 1) 分支表（Branch Table）
// ---------------------------------------------------------
// 请求：读取某对话的分支表（各层最后节点的 j/n 等信息），用于 UI 显示"分支切换器"。
export const EVT_BRANCH_TABLE_REQ = 'workflow.branch.table.request'
// 成功：返回 levels/或桥接器约定的数据结构（供组件构建 nodeId -> {j,n} 映射）
export const EVT_BRANCH_TABLE_OK = 'workflow.branch.table.success'
// 失败：返回 error 消息与 detail
export const EVT_BRANCH_TABLE_FAIL = 'workflow.branch.table.failure'

// ---------------------------------------------------------
// 2) 切换分支（Switch Branch）
// ---------------------------------------------------------
// 请求：切换 active_path 最后节点到目标分支序号 j
export const EVT_BRANCH_SWITCH_REQ = 'workflow.branch.switch.request'
// 成功：返回新节点数据与完整文档，组件可据此更新当前消息与文档
export const EVT_BRANCH_SWITCH_OK = 'workflow.branch.switch.success'
// 失败
export const EVT_BRANCH_SWITCH_FAIL = 'workflow.branch.switch.failure'

// ---------------------------------------------------------
// 3) 删除分支（Delete Branch）
// ---------------------------------------------------------
// 请求：删除单个分支节点并进行"智能切换"（如果有兄弟分支）
export const EVT_BRANCH_DELETE_REQ = 'workflow.branch.delete.request'
export const EVT_BRANCH_DELETE_OK = 'workflow.branch.delete.success'
export const EVT_BRANCH_DELETE_FAIL = 'workflow.branch.delete.failure'

// ---------------------------------------------------------
// 4) 重试助手消息（Retry Assistant -> 创建新分支）
// ---------------------------------------------------------
// 请求：以某个"旧的助手节点"为参照创建一个"新的助手分支节点"，通常用于"重试"。
export const EVT_BRANCH_RETRY_ASSIST_REQ = 'workflow.branch.retry.assistant.request'
export const EVT_BRANCH_RETRY_ASSIST_OK = 'workflow.branch.retry.assistant.success'
export const EVT_BRANCH_RETRY_ASSIST_FAIL = 'workflow.branch.retry.assistant.failure'

// ---------------------------------------------------------
// 5) 用户消息智能重试（Retry User Message -> 由后端判断创建助手或重试既有助手）
// ---------------------------------------------------------
export const EVT_BRANCH_RETRY_USER_REQ = 'workflow.branch.retry.user.request'
export const EVT_BRANCH_RETRY_USER_OK = 'workflow.branch.retry.user.success'
export const EVT_BRANCH_RETRY_USER_FAIL = 'workflow.branch.retry.user.failure'

// ---------------------------------------------------------
// 6) 可选：修剪分支（Truncate After）
// ---------------------------------------------------------
// 请求：删除指定节点及其所有子孙
export const EVT_BRANCH_TRUNCATE_REQ = 'workflow.branch.truncate.request'
export const EVT_BRANCH_TRUNCATE_OK = 'workflow.branch.truncate.success'
export const EVT_BRANCH_TRUNCATE_FAIL = 'workflow.branch.truncate.failure'

// ---------------------------------------------------------
// 用法示例（工作流/插件侧）：
// ---------------------------------------------------------
// import Host from '@/workflow/core/host'
// import * as Branch from '@/workflow/channels/branch'
//
// // 读取分支表
// Host.events.emit(Branch.EVT_BRANCH_TABLE_REQ, { conversationFile: '/data/conversations/222.json' })
// const off = Host.events.on(Branch.EVT_BRANCH_TABLE_OK, (p) => {
//   if (p.conversationFile === '/data/conversations/222.json') {
//     console.log('分支表：', p.result)
//   }
// })
//
// // 切换到下一个分支 j+1
// Host.events.emit(Branch.EVT_BRANCH_SWITCH_REQ, { conversationFile: '/data/conversations/222.json', targetJ: 2 })
//
// // 删除当前分支节点
// Host.events.emit(Branch.EVT_BRANCH_DELETE_REQ, { conversationFile: '/data/conversations/222.json', nodeId: 'n_ass123' })
//
// // 助手消息重试（创建新分支）
// Host.events.emit(Branch.EVT_BRANCH_RETRY_ASSIST_REQ, { conversationFile: '/data/conversations/222.json', retryNodeId: 'n_ass123' })
//
// // 用户消息智能重试
// Host.events.emit(Branch.EVT_BRANCH_RETRY_USER_REQ, { conversationFile: '/data/conversations/222.json', userNodeId: 'n_user789' })

// ---------------------------------------------------------
// 默认导出：常量聚合（便于一次性导入）
// ---------------------------------------------------------
const BranchChannels = {
  EVT_BRANCH_TABLE_REQ,
  EVT_BRANCH_TABLE_OK,
  EVT_BRANCH_TABLE_FAIL,

  EVT_BRANCH_SWITCH_REQ,
  EVT_BRANCH_SWITCH_OK,
  EVT_BRANCH_SWITCH_FAIL,

  EVT_BRANCH_DELETE_REQ,
  EVT_BRANCH_DELETE_OK,
  EVT_BRANCH_DELETE_FAIL,

  EVT_BRANCH_RETRY_ASSIST_REQ,
  EVT_BRANCH_RETRY_ASSIST_OK,
  EVT_BRANCH_RETRY_ASSIST_FAIL,

  EVT_BRANCH_RETRY_USER_REQ,
  EVT_BRANCH_RETRY_USER_OK,
  EVT_BRANCH_RETRY_USER_FAIL,

  EVT_BRANCH_TRUNCATE_REQ,
  EVT_BRANCH_TRUNCATE_OK,
  EVT_BRANCH_TRUNCATE_FAIL,
}

export default BranchChannels