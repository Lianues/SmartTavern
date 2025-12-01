/**
 * RouterClient — 统一路由前端服务（严格路由，无回退/兼容）
 * 前端所有动作统一经路由器插件调用，不再直接访问后端固定 API。
 * 动作：
 * - completion.auto / completion.stream / completion.single
 * - prompt.process_view
 */

import { i18n } from '@/locales'

// 类型定义
interface RouterCallbacks {
  onChunk?: (content: string) => void
  onComplete?: (result: any) => void
  onError?: (error: Error) => void
  [key: string]: any
}

interface CompletionPayload {
  conversationFile: string
  llmConfigFile?: string | null
}

interface ProcessMessagesViewPayload {
  conversationFile: string
  view?: 'user_view' | 'assistant_view'
  output?: 'full' | 'partial' | 'history' | 'delta'
}

interface STPromptRouter {
  call: (action: string, payload: any, callbacks: RouterCallbacks) => Promise<any>
}

declare global {
  interface Window {
    STPromptRouter?: STPromptRouter
  }
}

function getRouter(): STPromptRouter | null {
  try {
    return typeof window !== 'undefined' ? window.STPromptRouter || null : null
  } catch (_) {
    return null
  }
}

// ===== Backend base helpers (match other services) =====
declare global {
  interface Window { ST_BACKEND_BASE?: string }
  interface ImportMetaEnv { VITE_API_BASE?: string }
}

const DEFAULT_BACKEND: string = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_BASE) || 'http://localhost:8050'

function _readLS(key: string): string | null {
  try { return (typeof window !== 'undefined') ? window.localStorage.getItem(key) : null } catch (_) { return null }
}

function getBackendBase(): string {
  const fromLS = _readLS('st.backend_base')
  const fromWin = (typeof window !== 'undefined') ? (window as any).ST_BACKEND_BASE : null
  const base = String(fromLS || fromWin || DEFAULT_BACKEND || 'http://localhost:8050')
  return base.replace(/\/+$/, '')
}

function ensureWorkflowBase(): string {
  return `${getBackendBase()}/api/workflow`.replace(/\/+$/, '')
}

const RouterClient = {
  async call(action: string, payload: any = {}, callbacks: RouterCallbacks = {}): Promise<any> {
    const router = getRouter()
    if (!router || typeof router.call !== 'function') {
      throw new Error(`RouterClient: ${i18n.t('services.routerClient.routerNotInjected')}`)
    }
    return router.call(String(action || ''), payload, callbacks)
  },

  async completeAuto(
    { conversationFile, llmConfigFile = null }: CompletionPayload,
    callbacks: RouterCallbacks = {}
  ): Promise<any> {
    return this.call('completion.auto', { conversationFile, llmConfigFile }, callbacks)
  },

  async completeSingle(
    { conversationFile, llmConfigFile }: CompletionPayload,
    callbacks: RouterCallbacks = {}
  ): Promise<any> {
    return this.call('completion.single', { conversationFile, llmConfigFile }, callbacks)
  },

  completeStream(
    { conversationFile, llmConfigFile }: CompletionPayload,
    callbacks: RouterCallbacks = {}
  ): Promise<any> {
    return this.call('completion.stream', { conversationFile, llmConfigFile }, callbacks)
  },

  async processMessagesView({
    conversationFile,
    view = 'user_view',
    output = 'full'
  }: ProcessMessagesViewPayload): Promise<any> {
    return this.call('prompt.process_view', { conversationFile, view, output }, {})
  },

  // === 新增：后端路由方法（推荐使用） ===
  
  /**
   * 使用后端路由处理视图（带 Hook 执行）
   *
   * 优势：
   * - 只传文件路径，不传完整配置 JSON
   * - 后端自动执行所有插件 Hook
   * - 减少网络传输，性能更好
   *
   * @param conversationFile - 对话文件路径
   * @param view - 视图类型
   * @param output - 输出模式
   */
  async routeWithHooksBackend({
    conversationFile,
    view = 'user_view',
    output = 'full'
  }: ProcessMessagesViewPayload): Promise<any> {
    const API_BASE = ensureWorkflowBase()
    const response = await fetch(`${API_BASE}/smarttavern/prompt_router/route_with_hooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_file: conversationFile, view, output })
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    return await response.json()
  },

  /**
   * 增量视图处理（后端 Hook）
   * 仅返回有变化的消息内容与变量（通过指纹比对）。
   */
  async routeWithHooksDelta({
    conversationFile,
    view = 'user_view',
    routerSessionId,
  }: {
    conversationFile: string
    view?: 'user_view' | 'assistant_view'
    routerSessionId?: string | null
  }): Promise<any> {
    const API_BASE = ensureWorkflowBase()
    const body: any = {
      conversation_file: conversationFile,
      view,
      output: 'delta',
      router_id: ((): string => {
        const sid = typeof routerSessionId === 'string' && routerSessionId ? routerSessionId : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
        return sid
      })(),
    }
    const response = await fetch(`${API_BASE}/smarttavern/prompt_router/route_with_hooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    return await response.json()
  },

  /**
   * 使用后端路由进行 AI 调用（带 Hook 执行）
   *
   * 优势：
   * - 只传 conversationFile，llm_config 从 settings.json 自动读取
   * - 自动执行所有插件 Hook
   * - 减少网络传输
   *
   * @param conversationFile - 对话文件路径
   */
  async completeWithHooksBackend(conversationFile: string): Promise<any> {
    const API_BASE = ensureWorkflowBase()
    const response = await fetch(`${API_BASE}/smarttavern/prompt_router/complete_with_hooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_file: conversationFile
      })
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    const result = await response.json()
    
    // 检查返回的 success 字段
    if (result && typeof result.success === 'boolean' && !result.success) {
      throw new Error(result.error || 'AI 调用失败')
    }
    
    return result
  },

  /**
   * 重新加载所有后端插件（热重载）
   */
  async reloadPlugins(): Promise<any> {
    const API_BASE = ensureWorkflowBase()
    const response = await fetch(`${API_BASE}/smarttavern/prompt_router/reload_plugins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    return await response.json()
  },

  /**
   * 列出所有已加载的后端插件
   */
  async listPlugins(): Promise<any> {
    const API_BASE = ensureWorkflowBase()
    const response = await fetch(`${API_BASE}/smarttavern/prompt_router/list_plugins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    return await response.json()
  }
}

export default RouterClient