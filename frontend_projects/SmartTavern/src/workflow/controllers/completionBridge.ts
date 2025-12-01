// SmartTavern Workflow - Completion Bridge (TS)
// 职责：桥接"AI 补全事件通道"与路由器插件，统一请求入口与过程事件广播。
// 监听：[`EVT_COMPLETION_REQ`](frontend_projects/SmartTavern/src/workflow/channels/completion.ts:1)、[`EVT_COMPLETION_ABORT`](frontend_projects/SmartTavern/src/workflow/channels/completion.ts:1)
// 广播：chunk/finish/usage/saved/error/end/aborted（见事件常量定义）
//
// 依赖：Host 单例与 RouterClient 路由器（通过 window.STPromptRouter 注入）
import Host from '@/workflow/core/host'
import * as Completion from '@/workflow/channels/completion'
import { i18n } from '@/locales'

// 类型定义
interface RouterProvider {
  call(action: string, request: any, callbacks: any): Promise<{ abort?: () => void } | void>
}

interface NormalizedRequest {
  conversationFile: string
  llmConfigFile: string | null
  mode: 'stream' | 'single' | 'auto'
  tag?: string
}

interface ActiveRecord {
  abort?: () => void
  info: {
    tag?: string
    conversationFile: string
  }
}

type DisposerFn = () => void

// 路由器提供者（由前端插件注册）
let __router: RouterProvider | null = null
try {
  Host.events.on('workflow.router.set', (provider: any) => {
    if (provider && typeof provider.call === 'function') {
      __router = provider as RouterProvider
      try { if (typeof window !== 'undefined') (window as any).STPromptRouter = provider } catch (_) {}
    } else {
      __router = null
      try { if (typeof window !== 'undefined') (window as any).STPromptRouter = null } catch (_) {}
    }
  })
} catch (_) {}

function buildKey({ tag, conversationFile }: { tag?: string; conversationFile?: string }): string {
  return String(tag || conversationFile || `unknown_${Date.now()}`)
}

function normalizeRequest(p: any = {}): NormalizedRequest {
  const conversationFile = String(p.conversationFile || '').trim()
  const llmConfigFile = p.llmConfigFile ? String(p.llmConfigFile).trim() : null
  const mode = (p.mode === 'stream' || p.mode === 'single') ? p.mode : 'auto'
  const tag = p.tag ? String(p.tag) : undefined
  if (!conversationFile) {
    throw new Error('[completionBridge] conversationFile required')
  }
  return { conversationFile, llmConfigFile, mode, tag }
}

export function initCompletionBridge(): DisposerFn {
  const active = new Map<string, ActiveRecord>()
  const offs: DisposerFn[] = []

  function release(key: string): void {
    try { active.delete(key) } catch (_) {}
  }

  function emitError(message: string, detail: any, info: any = {}): void {
    try {
      Host.events.emit(Completion.EVT_COMPLETION_ERROR, { message: String(message || 'Unknown error'), detail, ...info })
    } catch (_) {}
    try {
      Host.pushToast?.({ type: 'error', message: String(message || i18n.t('workflow.controllers.completion.completionFail')), timeout: 2500 })
    } catch (_) {}
  }

  offs.push(Host.events.on(Completion.EVT_COMPLETION_REQ, async (payload: any) => {
    let req: NormalizedRequest
    try {
      req = normalizeRequest(payload)
    } catch (e: any) {
      emitError(e?.message || e, e, {})
      return
    }

    const key = buildKey(req)
    if (active.has(key)) {
      try {
        active.get(key)?.abort?.()
        Host.events.emit(Completion.EVT_COMPLETION_ABORTED, { tag: req.tag, conversationFile: req.conversationFile })
      } catch (_) {}
      release(key)
    }

    const info = { tag: req.tag, conversationFile: req.conversationFile }

    const callbacks = {
      onChunk(content: string) { try { Host.events.emit(Completion.EVT_COMPLETION_CHUNK, { content, ...info }) } catch (_) {} },
      onFinish(finish_reason: string) { try { Host.events.emit(Completion.EVT_COMPLETION_FINISH, { finish_reason, ...info }) } catch (_) {} },
      onUsage(usage: any) { try { Host.events.emit(Completion.EVT_COMPLETION_USAGE, { usage, ...info }) } catch (_) {} },
      onSaved({ node_id, doc, usage, content }: any) { try { Host.events.emit(Completion.EVT_COMPLETION_SAVED, { node_id, doc, usage, content, ...info }) } catch (_) {} },
      onError(message: string) { emitError(message, null, info) },
      onEnd() { try { Host.events.emit(Completion.EVT_COMPLETION_END, { ...info }) } catch (_) {}; release(key) },
    }

    try {
      // 路由器严格模式：必须存在
      if (!__router || typeof __router.call !== 'function') {
        emitError(i18n.t('workflow.controllers.completion.routerNotInjected'), null, info)
        callbacks.onEnd?.()
        return
      }
      const action = (req.mode === 'stream') ? 'completion.stream' : (req.mode === 'single' ? 'completion.single' : 'completion.auto')
      const maybe = await __router.call(action, req, callbacks)
      if (maybe && typeof maybe.abort === 'function') {
        active.set(key, { abort: maybe.abort, info })
      }
    } catch (e: any) {
      emitError(e?.message || e, e, info)
      callbacks.onEnd?.()
    }
  }))

  offs.push(Host.events.on(Completion.EVT_COMPLETION_ABORT, (payload: any = {}) => {
    const key = buildKey({ tag: payload.tag, conversationFile: payload.conversationFile })
    const rec = active.get(key)
    if (!rec) {
      for (const [k, v] of active.entries()) {
        try { v.abort?.() } catch (_) {}
        try { Host.events.emit(Completion.EVT_COMPLETION_ABORTED, { tag: v.info?.tag, conversationFile: v.info?.conversationFile }) } catch (_) {}
        release(k)
      }
      return
    }
    try { rec.abort?.() } catch (_) {}
    try { Host.events.emit(Completion.EVT_COMPLETION_ABORTED, { tag: rec.info?.tag, conversationFile: rec.info?.conversationFile }) } catch (_) {}
    release(key)
    try { Host.pushToast?.({ type: 'warning', message: i18n.t('workflow.controllers.completion.completionCancelled'), timeout: 1500 }) } catch (_) {}
  }))

  return () => {
    try {
      offs.forEach(fn => { try { fn?.() } catch (_) {} })
      offs.length = 0
    } catch (_) {}
    try {
      for (const [k, v] of active.entries()) {
        try { v.abort?.() } catch (_) {}
        release(k)
      }
    } catch (_) {}
  }
}

export default initCompletionBridge