// Default Thread Orchestrator Workflow (Demo)
// 职责：将“用户发送成功/重试成功”等事件编排为 UI 占位与 AI 调用请求，实现“组件只做事件+状态响应，工作流负责编排”的闭环。
// 依赖事件：
// - 用户消息发送成功：[javascript.constant(EVT_MESSAGE_SEND_OK)](frontend_projects/SmartTavern/src/workflow/channels/message.js:80)
// - UI 占位创建：[javascript.constant(EVT_THREAD_ASSIST_PLACEHOLDER_CREATE)](frontend_projects/SmartTavern/src/workflow/channels/threaded.js:32)
// - AI 请求入口：[javascript.constant(EVT_COMPLETION_REQ)](frontend_projects/SmartTavern/src/workflow/channels/completion.js:55)
// - 分支重试成功（助手/用户）：[javascript.module(branch.js)](frontend_projects/SmartTavern/src/workflow/channels/branch.js:1)

import * as Message from '/src/workflow/channels/message.js'
import * as Threaded from '/src/workflow/channels/threaded.js'
import * as Completion from '/src/workflow/channels/completion.js'
import * as Branch from '/src/workflow/channels/branch.js'

// 获取 i18n 实例（通过全局暴露的 STI18n）
const getI18n = () => window.STI18n || { t: (key, params) => key }

/**
 * 激活编排插件
 * 约定：返回一个函数用于解绑（dispose）
 */
export function activate(host) {
  const offs = []

  // 策略1：用户发送成功 -> 创建助手占位 -> 触发 AI 自动补全（auto）
  offs.push(host.events.on(Message.EVT_MESSAGE_SEND_OK, (p) => {
    const { conversationFile, role, doc } = p || {}
    if (!conversationFile || role !== 'user') return

    // 使用 append_message 返回的真实助手节点ID作为占位ID与补全 tag
    const realAssId = (doc && doc.latest && doc.latest.node_id) ? String(doc.latest.node_id) : null
    if (!realAssId) return
    // 关键修正：将占位与补全触发放入微任务/异步队列，确保组件对同一事件的“用户消息入列”先执行
    // 渲染顺序：用户消息 -> 助手占位(真实ID) -> 流式内容/结果
    setTimeout(() => {
      try {
        host.events.emit(Threaded.EVT_THREAD_ASSIST_PLACEHOLDER_CREATE, { conversationFile, tempNodeId: realAssId })
        host.events.emit(Completion.EVT_COMPLETION_REQ, { conversationFile, mode: 'auto', tag: realAssId })
      } catch (e) {
        // 保守兜底：占位失败不影响后续流程
        host.pushToast?.({ type: 'error', message: getI18n().t('orchestrator.placeholderCompletionFail', { error: e?.message || e }), timeout: 2200 })
      }
    }, 0)
  }))

  // 策略2：助手消息重试（创建新分支）成功 -> 直接以新节点ID作为 tag 触发 AI
  offs.push(host.events.on(Branch.EVT_BRANCH_RETRY_ASSIST_OK, (p) => {
    const { conversationFile, newNodeId } = p || {}
    if (!conversationFile || !newNodeId) return

    try {
      host.events.emit(Completion.EVT_COMPLETION_REQ, {
        conversationFile,
        mode: 'auto',
        tag: newNodeId,
      })
    } catch (e) {
      host.pushToast?.({ type: 'error', message: getI18n().t('orchestrator.retryCompletionFail', { error: e?.message || e }), timeout: 2200 })
    }
  }))

  // 策略3：用户消息智能重试成功
  // - action === 'create_assistant' -> 使用后端返回的真实助手ID占位 + 触发 AI
  // - action === 'retry_assistant'  -> 为助手消息创建新分支，然后由策略2自动触发AI
  offs.push(host.events.on(Branch.EVT_BRANCH_RETRY_USER_OK, (p) => {
    const { conversationFile, action, assistantNodeId } = p || {}
    if (!conversationFile || !action) return

    if (action === 'create_assistant' && assistantNodeId) {
      try {
        host.events.emit(Threaded.EVT_THREAD_ASSIST_PLACEHOLDER_CREATE, { conversationFile, tempNodeId: assistantNodeId })
        host.events.emit(Completion.EVT_COMPLETION_REQ, { conversationFile, mode: 'auto', tag: assistantNodeId })
      } catch (e) {
        host.pushToast?.({ type: 'error', message: getI18n().t('orchestrator.placeholderCompletionFail', { error: e?.message || e }), timeout: 2200 })
      }
    } else if (action === 'retry_assistant' && assistantNodeId) {
      // 关键修复：创建新分支，然后由 EVT_BRANCH_RETRY_ASSIST_OK 监听器触发AI
      try {
        host.events.emit(Branch.EVT_BRANCH_RETRY_ASSIST_REQ, {
          conversationFile,
          retryNodeId: assistantNodeId,
          tag: `retry_user_assist_${Date.now()}`,
        })
      } catch (e) {
        host.pushToast?.({ type: 'error', message: getI18n().t('orchestrator.createAssistBranchFail', { error: e?.message || e }), timeout: 2200 })
      }
    }
  }))

  // 返回卸载函数
  return () => {
    try { offs.forEach(off => { try { off?.() } catch (_) {} }) } catch (_) {}
    try { offs.length = 0 } catch (_) {}
  }
}

// 默认导出（兼容 Loader 可能的约定）
export default {
  name: 'default-thread-orchestrator',
  activate,
}