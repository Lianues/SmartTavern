// SmartTavern Workflow - Branch Bridge (TS)
// 职责：桥接"分支操作事件通道"和后端 ChatBranches 服务。
// 监听：branch.ts 中的 *REQUEST 事件；调用服务；广播 *OK/*FAIL；并弹出必要的 Toast。
// 事件通道定义见：[`branch.ts`](frontend_projects/SmartTavern/src/workflow/channels/branch.ts:1)

import Host from '@/workflow/core/host'
import * as Branch from '@/workflow/channels/branch'
import ChatBranches from '@/services/chatBranches'
import { i18n } from '@/locales'

// 类型定义
interface ToastPayload {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  timeout: number
}

type DisposerFn = () => void

// 生成新节点ID（用于重试助手创建新分支时）
// 使用 'retry' 标识，以便后端可以识别并过滤空占位节点
function genAssId(): string {
  return `n_retry_ass${Date.now()}`
}

function emitFail(evt: string, payload: Record<string, any>, toastMsg?: string): void {
  try { Host.events.emit(evt, payload) } catch (_) {}
  if (toastMsg) {
    try { Host.pushToast?.({ type: 'error', message: toastMsg, timeout: 2200 } as ToastPayload) } catch (_) {}
  }
}

/**
 * 初始化 Branch Bridge
 * - 订阅：分支表/切换/删除/重试/修剪 等请求事件
 * - 调用 ChatBranches 服务
 * - 广播：对应的 *OK / *FAIL 事件
 * @returns {DisposerFn} disposer
 */
export function initBranchBridge(): DisposerFn {
  const offs: DisposerFn[] = []

  // 1) 读取分支表
  offs.push(Host.events.on(Branch.EVT_BRANCH_TABLE_REQ, async (p: Branch.BranchTableRequestPayload = {} as Branch.BranchTableRequestPayload) => {
    const conversationFile = String(p.conversationFile || '').trim()
    const tag = p.tag ? String(p.tag) : undefined
    if (!conversationFile) {
      return emitFail(Branch.EVT_BRANCH_TABLE_FAIL, { message: 'conversationFile required', tag }, i18n.t('workflow.controllers.branch.readTableFailMissingParam'))
    }
    try {
      const result = await ChatBranches.branchTableByFile(conversationFile)
      try {
        Host.events.emit(Branch.EVT_BRANCH_TABLE_OK, { conversationFile, result, tag })
      } catch (_) {}
    } catch (e: any) {
      emitFail(Branch.EVT_BRANCH_TABLE_FAIL, {
        conversationFile,
        message: e?.message || i18n.t('workflow.controllers.branch.readTableFail'),
        detail: e,
        tag,
      }, i18n.t('workflow.controllers.branch.readTableFail'))
    }
  }))

  // 2) 切换分支
  offs.push(Host.events.on(Branch.EVT_BRANCH_SWITCH_REQ, async (p: Branch.BranchSwitchRequestPayload = {} as Branch.BranchSwitchRequestPayload) => {
    const conversationFile = String(p.conversationFile || '').trim()
    const targetJ = Number(p.targetJ)
    const tag = p.tag ? String(p.tag) : undefined
    if (!conversationFile || !targetJ || targetJ < 1) {
      return emitFail(Branch.EVT_BRANCH_SWITCH_FAIL, { conversationFile, message: 'Incomplete parameters', tag }, i18n.t('workflow.controllers.branch.switchFailIncompleteParam'))
    }
    try {
      const result: any = await ChatBranches.switchBranch({ file: conversationFile, target_j: targetJ })
      try {
        Host.events.emit(Branch.EVT_BRANCH_SWITCH_OK, {
          conversationFile,
          node: result?.node,
          active_path: result?.active_path,
          latest: result?.latest,
          tag,
        })
      } catch (_) {}
      try { Host.pushToast?.({ type: 'success', message: i18n.t('workflow.controllers.branch.switchSuccess'), timeout: 1200 } as ToastPayload) } catch (_) {}
    } catch (e: any) {
      emitFail(Branch.EVT_BRANCH_SWITCH_FAIL, {
        conversationFile,
        message: e?.message || i18n.t('workflow.controllers.branch.switchFail'),
        detail: e,
        tag,
      }, i18n.t('workflow.controllers.branch.switchFail'))
    }
  }))

  // 3) 删除分支（智能切换）
  offs.push(Host.events.on(Branch.EVT_BRANCH_DELETE_REQ, async (p: Branch.BranchDeleteRequestPayload = {} as Branch.BranchDeleteRequestPayload) => {
    const conversationFile = String(p.conversationFile || '').trim()
    const nodeId = String(p.nodeId || '').trim()
    const tag = p.tag ? String(p.tag) : undefined
    if (!conversationFile || !nodeId) {
      return emitFail(Branch.EVT_BRANCH_DELETE_FAIL, { conversationFile, nodeId, message: 'Incomplete parameters', tag }, i18n.t('workflow.controllers.branch.deleteFailIncompleteParam'))
    }
    try {
      const resp: any = await ChatBranches.deleteBranch({ file: conversationFile, node_id: nodeId })
      const ap = Array.isArray(resp?.active_path) ? resp.active_path : []
      const switchedToNodeId = (resp?.switched_to) || (ap.length ? ap[ap.length - 1] : undefined)
      try {
        Host.events.emit(Branch.EVT_BRANCH_DELETE_OK, {
          conversationFile,
          active_path: ap,
          latest: resp?.latest,
          switchedToNodeId,
          tag,
        })
      } catch (_) {}
      // 组件侧将基于 delete 成功回调触发一次分支表刷新，避免这里重复请求
      try { Host.pushToast?.({ type: 'success', message: i18n.t('workflow.controllers.branch.deleteSuccess'), timeout: 1200 } as ToastPayload) } catch (_) {}
    } catch (e: any) {
      emitFail(Branch.EVT_BRANCH_DELETE_FAIL, {
        conversationFile,
        nodeId,
        message: e?.message || i18n.t('workflow.controllers.branch.deleteFail'),
        detail: e,
        tag,
      }, i18n.t('workflow.controllers.branch.deleteFail'))
    }
  }))

  // 4) 重试助手消息（创建新分支）
  offs.push(Host.events.on(Branch.EVT_BRANCH_RETRY_ASSIST_REQ, async (p: Branch.BranchRetryAssistRequestPayload = {} as Branch.BranchRetryAssistRequestPayload) => {
    const conversationFile = String(p.conversationFile || '').trim()
    const retryNodeId = String(p.retryNodeId || '').trim()
    const newNodeId = String(p.newNodeId || genAssId())
    const content = p.content !== undefined ? String(p.content) : ''
    const role = p.role === 'assistant' ? 'assistant' : 'assistant'
    const tag = p.tag ? String(p.tag) : undefined
    if (!conversationFile || !retryNodeId) {
      return emitFail(Branch.EVT_BRANCH_RETRY_ASSIST_FAIL, { conversationFile, retryNodeId, message: 'Incomplete parameters', tag }, i18n.t('workflow.controllers.branch.retryFailIncompleteParam'))
    }
    try {
      const resp: any = await ChatBranches.retryBranch({
        file: conversationFile,
        new_node_id: newNodeId,
        retry_node_id: retryNodeId,
        role,
        content,
      })
      try {
        Host.events.emit(Branch.EVT_BRANCH_RETRY_ASSIST_OK, {
          conversationFile,
          newNodeId,
          active_path: resp?.active_path,
          latest: resp?.latest,
          node_updated_at: resp?.node_updated_at,
          tag,
        })
      } catch (_) {}

      try { Host.pushToast?.({ type: 'success', message: i18n.t('workflow.controllers.branch.retryAssistSuccess'), timeout: 1200 } as ToastPayload) } catch (_) {}
    } catch (e: any) {
      emitFail(Branch.EVT_BRANCH_RETRY_ASSIST_FAIL, {
        conversationFile,
        retryNodeId,
        message: e?.message || i18n.t('workflow.controllers.branch.retryAssistFail'),
        detail: e,
        tag,
      }, i18n.t('workflow.controllers.branch.retryAssistFail'))
    }
  }))

  // 5) 用户消息智能重试
  offs.push(Host.events.on(Branch.EVT_BRANCH_RETRY_USER_REQ, async (p: Branch.BranchRetryUserRequestPayload = {} as Branch.BranchRetryUserRequestPayload) => {
    const conversationFile = String(p.conversationFile || '').trim()
    const userNodeId = String(p.userNodeId || '').trim()
    const tag = p.tag ? String(p.tag) : undefined
    if (!conversationFile || !userNodeId) {
      return emitFail(Branch.EVT_BRANCH_RETRY_USER_FAIL, { conversationFile, userNodeId, message: 'Incomplete parameters', tag }, i18n.t('workflow.controllers.branch.retryFailIncompleteParam'))
    }
    try {
      const result = await ChatBranches.retryUserMessage({ file: conversationFile, user_node_id: userNodeId })
      try {
        Host.events.emit(Branch.EVT_BRANCH_RETRY_USER_OK, {
          conversationFile,
          action: result?.action,
          assistantNodeId: result?.assistant_node_id,
          doc: result?.doc,
          tag,
        })
      } catch (_) {}
      try { Host.pushToast?.({ type: 'info', message: i18n.t('workflow.controllers.branch.retryUserSuccess'), timeout: 1200 } as ToastPayload) } catch (_) {}
    } catch (e: any) {
      emitFail(Branch.EVT_BRANCH_RETRY_USER_FAIL, {
        conversationFile,
        userNodeId,
        message: e?.message || i18n.t('workflow.controllers.branch.retryUserFail'),
        detail: e,
        tag,
      }, i18n.t('workflow.controllers.branch.retryUserFail'))
    }
  }))

  // 6) 修剪分支（删除指定节点及其子孙）
  offs.push(Host.events.on(Branch.EVT_BRANCH_TRUNCATE_REQ, async (p: Branch.BranchTruncateRequestPayload = {} as Branch.BranchTruncateRequestPayload) => {
    const conversationFile = String(p.conversationFile || '').trim()
    const nodeId = String(p.nodeId || '').trim()
    const tag = p.tag ? String(p.tag) : undefined
    if (!conversationFile || !nodeId) {
      return emitFail(Branch.EVT_BRANCH_TRUNCATE_FAIL, { conversationFile, nodeId, message: 'Incomplete parameters', tag }, i18n.t('workflow.controllers.branch.truncateFailIncompleteParam'))
    }
    try {
      const doc = await ChatBranches.truncateAfter({ file: conversationFile, node_id: nodeId })
      try {
        Host.events.emit(Branch.EVT_BRANCH_TRUNCATE_OK, {
          conversationFile,
          doc,
          tag,
        })
      } catch (_) {}
      try { Host.pushToast?.({ type: 'success', message: i18n.t('workflow.controllers.branch.truncateSuccess'), timeout: 1200 } as ToastPayload) } catch (_) {}
    } catch (e: any) {
      emitFail(Branch.EVT_BRANCH_TRUNCATE_FAIL, {
        conversationFile,
        nodeId,
        message: e?.message || i18n.t('workflow.controllers.branch.truncateFail'),
        detail: e,
        tag,
      }, i18n.t('workflow.controllers.branch.truncateFail'))
    }
  }))

  // 返回统一清理
  return () => {
    try { offs.forEach(fn => { try { fn?.() } catch (_) {} }) } catch (_) {}
    try { offs.length = 0 } catch (_) {}
  }
}

export default initBranchBridge