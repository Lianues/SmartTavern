// Router Service with Hooks
// 提供带 Router Hook 的提示词处理和 AI 调用功能

import { useMessagesStore } from '../stores/chatMessages'

// ===== Backend base helpers (match other services) =====
declare global {
  interface Window { ST_BACKEND_BASE?: string }
  interface ImportMetaEnv { VITE_API_BASE?: string }
}

const DEFAULT_BACKEND: string = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_BASE) || 'http://localhost:8050'

function _readLS(key: string): string | null {
  try { return (typeof window !== 'undefined') ? localStorage.getItem(key) : null } catch (_) { return null }
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

// 类型定义
type ChatRole = 'system' | 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
  source?: string
}

interface CustomEventSource {
  _reader: ReadableStreamDefaultReader<Uint8Array> | null
  _decoder: TextDecoder
  _listeners: Record<string, Array<(event: any) => void>>
  addEventListener(type: string, callback: (event: any) => void): void
  removeEventListener(type: string, callback: (event: any) => void): void
  close(): void
  _start(): Promise<void>
}

interface RoutePromptWithHooksParams {
  conversation_file?: string
  view?: 'user_view' | 'assistant_view'
  output?: 'full' | 'partial'
}

interface RoutePromptResult {
  messages: ChatMessage[]
  variables?: {
    initial: Record<string, any>
    final: Record<string, any>
  }
}

interface CompleteWithHooksParams {
  conversation_file?: string
  stream?: boolean
}

interface CompleteResult {
  success?: boolean
  content?: string
  usage?: any
  [key: string]: any
}

/**
 * 使用后端路由处理提示词（带完整 Hook 执行）
 *
 * 该函数会：
 * 1. 从 conversation_file 读取完整配置（preset, character, persona, world_books, regex_rules, variables）
 * 2. 执行所有提示词处理 Hook（11个Hook点）
 * 3. 返回处理后的消息数组和变量状态
 *
 * Hook 执行顺序：
 * - beforeAssemble → afterAssemble
 * - beforeInChat → afterInChat
 * - beforePostprocessUser → afterPostprocessUser（user_view）
 * - beforePostprocessAssistant → afterPostprocessAssistant（assistant_view）
 *
 * @param params - 参数对象
 * @param params.conversation_file - 可选，对话文件路径。不传则使用当前加载的对话文件
 * @param params.view - 可选，视图选择 ('user_view' | 'assistant_view')，默认 'user_view'
 * @param params.output - 可选，输出模式 ('full' | 'partial')，默认 'full'
 *
 * @returns Promise<{messages: Array, variables?: {initial, final}}>
 *
 * @throws Error 如果未传 conversation_file 且没有加载对话
 *
 * @example
 * // 使用指定对话文件
 * const result = await routePromptWithHooks({
 *   conversation_file: 'data/conversations/my-chat/conversation.json'
 * })
 *
 * // 使用当前对话文件（最常用）
 * const result2 = await routePromptWithHooks({
 *   view: 'user_view'
 * })
 *
 * // 简化调用（使用默认参数）
 * const result3 = await routePromptWithHooks({})
 */
export async function routePromptWithHooks({
  conversation_file,
  view = 'user_view',
  output = 'full'
}: RoutePromptWithHooksParams = {}): Promise<RoutePromptResult> {
  // 如果没有传 conversation_file，使用当前对话文件
  let targetFile = conversation_file
  if (!targetFile) {
    const messagesStore = useMessagesStore()
    const currentFile = messagesStore.conversationFile
    if (!currentFile) {
      throw new Error('No conversation loaded. Please load a conversation first or provide conversation_file parameter.')
    }
    targetFile = currentFile
  }

  const response = await fetch(`${ensureWorkflowBase()}/smarttavern/prompt_router/route_with_hooks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      conversation_file: targetFile,
      view,
      output
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return await response.json()
}

/**
 * 使用后端路由进行 AI 调用（带完整 Hook 执行）
 * 
 * 该函数会：
 * 1. 执行所有提示词处理 Hook（11个Hook点）
 * 2. 执行所有 LLM Hook（4个Hook点）
 * 3. 调用 AI API 并返回结果
 * 
 * Hook 执行顺序：
 * 提示词处理 Hook（11个） + LLM Hook（4个）：
 * - beforeLLMCall
 * - afterLLMCall
 * - beforeStreamChunk
 * - afterStreamChunk
 * 
 * @param params - 参数对象
 * @param params.conversation_file - 必需，对话文件路径
 * @param params.stream - 可选，是否流式返回（默认 false）
 * 
 * @returns 非流式：Promise<{success, content, usage, ...}>
 * @returns 流式：Promise<CustomEventSource>
 * 
 * @example
 * // 非流式调用
 * const result = await completeWithHooks({
 *   conversation_file: 'data/conversations/my-chat/conversation.json'
 * })
 * console.log(result.content)
 * 
 * // 流式调用
 * const eventSource = await completeWithHooks({
 *   conversation_file: 'data/conversations/my-chat/conversation.json',
 *   stream: true
 * })
 * 
 * eventSource.addEventListener('message', (e) => {
 *   const data = JSON.parse(e.data)
 *   if (data.type === 'chunk') {
 *     console.log(data.content)
 *   } else if (data.type === 'end') {
 *     eventSource.close()
 *   }
 * })
 */
export async function completeWithHooks({
  conversation_file,
  stream = false
}: CompleteWithHooksParams): Promise<CompleteResult | CustomEventSource> {
  if (stream) {
    // 流式调用
    const url = `${ensureWorkflowBase()}/smarttavern/prompt_router/complete_with_hooks`
    
    return new Promise((resolve, reject) => {
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversation_file,
          stream: true
        })
      }).then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body reader')
        }
        
        const decoder = new TextDecoder()
        
        const eventSource: CustomEventSource = {
          _reader: reader,
          _decoder: decoder,
          _listeners: {},
          
          addEventListener(type: string, callback: (event: any) => void) {
            if (!this._listeners[type]) {
              this._listeners[type] = []
            }
            this._listeners[type].push(callback)
          },
          
          removeEventListener(type: string, callback: (event: any) => void) {
            if (this._listeners[type]) {
              this._listeners[type] = this._listeners[type].filter(cb => cb !== callback)
            }
          },
          
          close() {
            if (this._reader) {
              this._reader.cancel()
            }
          },
          
          async _start() {
            try {
              while (true) {
                if (!this._reader) break
                const { done, value } = await this._reader.read()
                if (done) break
                
                const chunk = this._decoder.decode(value, { stream: true })
                const lines = chunk.split('\n')
                
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6)
                    if (data.trim()) {
                      const event = { data }
                      if (this._listeners['message']) {
                        this._listeners['message'].forEach(cb => cb(event))
                      }
                    }
                  }
                }
              }
            } catch (err) {
              if (this._listeners['error']) {
                this._listeners['error'].forEach(cb => cb(err))
              }
            }
          }
        }
        
        eventSource._start()
        resolve(eventSource)
      }).catch(reject)
    })
  } else {
    // 非流式调用
  const response = await fetch(`${ensureWorkflowBase()}/smarttavern/prompt_router/complete_with_hooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        conversation_file,
        stream: false
      })
    })

    if (!response.ok) {
      // 尝试从响应体中获取详细错误信息
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.detail || errorData.error || errorData.message || `HTTP ${response.status}`
      throw new Error(errorMessage)
    }

    return await response.json()
  }
}

/**
 * 使用当前对话配置进行 AI 调用（带完整 Hook 执行）
 * 
 * 该函数会自动使用当前加载的对话文件，无需手动指定路径。
 * 其他行为与 completeWithHooks 完全相同。
 * 
 * @param params - 参数对象
 * @param params.stream - 可选，是否流式返回（默认 false）
 * 
 * @returns 非流式：Promise<{success, content, usage, ...}>
 * @returns 流式：Promise<CustomEventSource>
 * 
 * @throws Error 如果没有加载对话
 * 
 * @example
 * // 非流式调用
 * const result = await completeWithHooksAndCurrentConfig()
 * console.log(result.content)
 * 
 * // 流式调用
 * const eventSource = await completeWithHooksAndCurrentConfig({ stream: true })
 * 
 * let fullText = ''
 * eventSource.addEventListener('message', (e) => {
 *   const data = JSON.parse(e.data)
 *   
 *   switch(data.type) {
 *     case 'chunk':
 *       fullText += data.content
 *       console.log(data.content)
 *       break
 *       
 *     case 'finish':
 *       console.log('Finish reason:', data.finish_reason)
 *       break
 *       
 *     case 'usage':
 *       console.log('Token usage:', data.usage)
 *       break
 *       
 *     case 'error':
 *       console.error('Error:', data.message)
 *       break
 *       
 *     case 'end':
 *       console.log('Stream ended. Full text:', fullText)
 *       eventSource.close()
 *       break
 *   }
 * })
 */
export async function completeWithHooksAndCurrentConfig({
  stream = false
}: {
  stream?: boolean
} = {}): Promise<CompleteResult | CustomEventSource> {
  // 获取当前对话文件
  const messagesStore = useMessagesStore()
  const conversationFile = messagesStore.conversationFile

  if (!conversationFile) {
    throw new Error('No conversation loaded. Please load a conversation first.')
  }

  return await completeWithHooks({
    conversation_file: conversationFile,
    stream
  })
}