// SmartTavern Workflow - Message Bridge (TS)
// 职责：桥接"消息事件通道"与 ChatBranches 服务，实现事件驱动的消息发送/编辑与结果广播。
// 监听：发送/编辑请求事件；广播：成功/失败事件；并适当 Toast 提示。

import Host from '@/workflow/core/host'
import * as Msg from '@/workflow/channels/message'
import ChatBranches from '@/services/chatBranches'
import { i18n } from '@/locales'

// 类型定义
type MessageRole = 'user' | 'assistant' | 'system'

interface NormalizedSendRequest {
  conversationFile: string
  parentId: string
  nodeId: string
  role: MessageRole
  content: string
  tag?: string
}

interface NormalizedEditRequest {
  conversationFile: string
  nodeId: string
  content: string
  tag?: string
}

type DisposerFn = () => void

/**
 * 生成节点ID（按角色区分前缀）
 */
function genNodeId(role: MessageRole = 'user'): string {
  const ts = Date.now()
  if (role === 'assistant') return `n_ass${ts}`
  if (role === 'system') return `n_sys${ts}`
  return `n_user${ts}`
}

/**
 * 规范化发送请求载荷
 */
function normalizeSend(p: any = {}): NormalizedSendRequest {
  const conversationFile = String(p.conversationFile || '').trim()
  const parentId = String(p.parentId || '').trim()
  const role: MessageRole = (p.role === 'assistant' || p.role === 'system') ? p.role : 'user'
  const content = String(p.content || '')
  const nodeId = p.nodeId ? String(p.nodeId) : genNodeId(role)
  const tag = p.tag ? String(p.tag) : undefined

  if (!conversationFile) throw new Error('[messageBridge] conversationFile required')
  if (!parentId) throw new Error('[messageBridge] parentId required')
  if (!content) throw new Error('[messageBridge] content required')

  return { conversationFile, parentId, nodeId, role, content, tag }
}

/**
 * 规范化编辑请求载荷
 */
function normalizeEdit(p: any = {}): NormalizedEditRequest {
  const conversationFile = String(p.conversationFile || '').trim()
  const nodeId = String(p.nodeId || '').trim()
  const content = String(p.content || '')
  const tag = p.tag ? String(p.tag) : undefined

  if (!conversationFile) throw new Error('[messageBridge] conversationFile required')
  if (!nodeId) throw new Error('[messageBridge] nodeId required')
  if (!content) throw new Error('[messageBridge] content required')

  return { conversationFile, nodeId, content, tag }
}

/**
 * 初始化 Message Bridge
 * - 订阅发送/编辑请求事件
 * - 调用 ChatBranches 并广播成功/失败
 * @returns {DisposerFn} disposer
 */
export function initMessageBridge(): DisposerFn {
  const offs: DisposerFn[] = []

  // 发送请求
  offs.push(Host.events.on(Msg.EVT_MESSAGE_SEND_REQ, async (payload: any) => {
    let req: NormalizedSendRequest
    try {
      req = normalizeSend(payload)
    } catch (e: any) {
      try {
        Host.events.emit(Msg.EVT_MESSAGE_SEND_FAIL, {
          conversationFile: payload?.conversationFile,
          message: e?.message || e,
          detail: e,
          tag: payload?.tag,
        })
      } catch (_) {}
      Host.pushToast?.({ type: 'error', message: i18n.t('workflow.controllers.message.sendFailIncompleteParam'), timeout: 2200 })
      return
    }

    try {
      // 发送到后端：append_message
      const updatedDoc = await ChatBranches.appendMessage({
        file: req.conversationFile,
        node_id: req.nodeId,
        pid: req.parentId,
        role: req.role,
        content: req.content,
      })

      // 广播成功，包含占位助手节点的时间戳
      Host.events.emit(Msg.EVT_MESSAGE_SEND_OK, {
        conversationFile: req.conversationFile,
        nodeId: req.nodeId,
        role: req.role,
        content: req.content,
        doc: updatedDoc,
        node_updated_at: updatedDoc?.node_updated_at,
        placeholder_updated_at: updatedDoc?.placeholder_updated_at,
        tag: req.tag,
      })
      Host.pushToast?.({ type: 'success', message: i18n.t('workflow.controllers.message.sendSuccess'), timeout: 1600 })
    } catch (e: any) {
      // 广播失败
      try {
        Host.events.emit(Msg.EVT_MESSAGE_SEND_FAIL, {
          conversationFile: req.conversationFile,
          message: e?.message || i18n.t('workflow.controllers.message.sendFail'),
          detail: e,
          tag: req.tag,
        })
      } catch (_) {}
      Host.pushToast?.({ type: 'error', message: i18n.t('workflow.controllers.message.sendFail'), timeout: 2200 })
    }
  }))

  // 编辑请求
  offs.push(Host.events.on(Msg.EVT_MESSAGE_EDIT_REQ, async (payload: any) => {
    let req: NormalizedEditRequest
    try {
      req = normalizeEdit(payload)
    } catch (e: any) {
      try {
        Host.events.emit(Msg.EVT_MESSAGE_EDIT_FAIL, {
          conversationFile: payload?.conversationFile,
          nodeId: payload?.nodeId,
          message: e?.message || e,
          detail: e,
          tag: payload?.tag,
        })
      } catch (_) {}
      Host.pushToast?.({ type: 'error', message: i18n.t('workflow.controllers.message.editFailIncompleteParam'), timeout: 2200 })
      return
    }

    try {
      // 编辑到后端：update_message
      const updatedDoc = await ChatBranches.updateMessage({
        file: req.conversationFile,
        node_id: req.nodeId,
        content: req.content,
      })

      // 广播成功
      Host.events.emit(Msg.EVT_MESSAGE_EDIT_OK, {
        conversationFile: req.conversationFile,
        nodeId: req.nodeId,
        content: req.content,
        doc: updatedDoc,
        node_updated_at: updatedDoc?.node_updated_at,
        tag: req.tag,
      })
      Host.pushToast?.({ type: 'success', message: i18n.t('workflow.controllers.message.editSuccess'), timeout: 1600 })
    } catch (e: any) {
      // 广播失败
      try {
        Host.events.emit(Msg.EVT_MESSAGE_EDIT_FAIL, {
          conversationFile: req.conversationFile,
          nodeId: req.nodeId,
          message: e?.message || i18n.t('workflow.controllers.message.editFail'),
          detail: e,
          tag: req.tag,
        })
      } catch (_) {}
      Host.pushToast?.({ type: 'error', message: i18n.t('workflow.controllers.message.editFail'), timeout: 2200 })
    }
  }))

  // 返回清理函数
  return () => {
    try { offs.forEach(fn => { try { fn?.() } catch (_) {} }) } catch (_) {}
    offs.length = 0
  }
}

export default initMessageBridge