// Chat Completion Service
// 提供聊天补全功能：自定义配置调用和使用当前对话配置调用

import { useMessagesStore } from '@/stores/chatMessages'

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
type Provider = 'openai' | 'anthropic' | 'gemini' | 'openai_compatible'
type ChatRole = 'system' | 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
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

interface ChatCompletionParams {
  provider: Provider
  api_key?: string
  base_url: string
  messages: ChatMessage[]
  model: string
  stream?: boolean
  max_tokens?: number
  temperature?: number
  top_p?: number
  custom_params?: Record<string, any>
}

interface ChatCompletionResult {
  success?: boolean
  content?: string
  usage?: any
  [key: string]: any
}

interface ChatCompletionWithConfigParams {
  messages: ChatMessage[]
  stream?: boolean
  custom_params?: Record<string, any>
}

/**
 * 验证 provider 参数
 * @param provider - API 提供商
 * @throws Error 如果 provider 无效
 */
function validateProvider(provider: string): asserts provider is Provider {
  const validProviders: Provider[] = ['openai', 'anthropic', 'gemini', 'openai_compatible']
  if (!validProviders.includes(provider as Provider)) {
    throw new Error(`Invalid provider: ${provider}. Must be one of: ${validProviders.join(', ')}`)
  }
}

/**
 * 验证 messages 数组
 * @param messages - 消息数组
 * @throws Error 如果 messages 无效
 */
function validateMessages(messages: ChatMessage[]): void {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages must be a non-empty array')
  }
  
  for (const msg of messages) {
    if (!msg.role || !msg.content) {
      throw new Error('Each message must have role and content')
    }
    if (!['system', 'user', 'assistant'].includes(msg.role)) {
      throw new Error(`Invalid role: ${msg.role}. Must be system, user, or assistant`)
    }
  }
}

/**
 * 自定义参数聊天补全（直接调用 LLM API）
 * 
 * @param params - 参数对象
 * @param params.provider - API提供商 ('openai'|'anthropic'|'gemini'|'openai_compatible')
 * @param params.api_key - API密钥（可以为空字符串）
 * @param params.base_url - API基础URL
 * @param params.messages - 消息数组 [{role: 'user', content: '...'}]
 * @param params.model - 模型名称
 * @param params.stream - 是否流式返回
 * @param params.max_tokens - 最大token数
 * @param params.temperature - 温度参数
 * @param params.top_p - top_p参数
 * @param params.custom_params - 自定义参数对象，会直接合并到请求体中
 *
 * @returns 非流式返回：{success, content, usage, ...}
 * @returns 流式返回：CustomEventSource对象
 * 
 * @example
 * // 非流式调用
 * const result = await chatCompletion({
 *   provider: 'openai',
 *   api_key: 'sk-...',
 *   base_url: 'https://api.openai.com/v1',
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * })
 * 
 * // 流式调用
 * const eventSource = await chatCompletion({
 *   provider: 'openai',
 *   api_key: 'sk-...',
 *   base_url: 'https://api.openai.com/v1',
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   stream: true
 * })
 * eventSource.addEventListener('message', (e) => {
 *   const data = JSON.parse(e.data)
 *   if (data.type === 'chunk') console.log(data.content)
 * })
 */
export async function chatCompletion({
  provider,
  api_key = '',
  base_url,
  messages,
  model,
  stream = false,
  max_tokens,
  temperature,
  top_p,
  custom_params
}: ChatCompletionParams): Promise<ChatCompletionResult | CustomEventSource> {
  // 参数验证
  validateProvider(provider)
  validateMessages(messages)
  
  if (!base_url) {
    throw new Error('base_url is required')
  }
  if (!model) {
    throw new Error('model is required')
  }

  // 构建请求参数
  const params: any = {
    provider,
    api_key,
    base_url,
    messages,
    model,
    stream
  }

  // 添加可选参数
  if (max_tokens !== undefined) params.max_tokens = max_tokens
  if (temperature !== undefined) params.temperature = temperature
  if (top_p !== undefined) params.top_p = top_p
  if (custom_params !== undefined) params.custom_params = custom_params

  if (stream) {
    // 流式调用：返回 CustomEventSource
    const queryParams = new URLSearchParams({ stream: 'true' })
    const url = `${ensureWorkflowBase()}/llm_api/chat?${queryParams}`
    
    return new Promise((resolve, reject) => {
      try {
        // 使用 fetch 手动实现 SSE
        fetch(url.replace('?stream=true', ''), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(params)
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
      } catch (err) {
        reject(err)
      }
    })
  } else {
    // 非流式调用：返回 JSON
    const response = await fetch(`${ensureWorkflowBase()}/llm_api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  }
}

/**
 * 使用当前对话配置进行聊天补全
 * 
 * @param params - 参数对象
 * @param params.messages - 消息数组 [{role: 'user', content: '...'}]
 * @param params.stream - 可选，是否流式返回。不提供则使用配置文件的值
 * @param params.custom_params - 可选，自定义参数对象，会覆盖配置文件的 custom_params
 *
 * @returns 非流式返回：{success, content, usage, ...}
 * @returns 流式返回：CustomEventSource对象
 * 
 * @throws Error 如果没有加载对话或没有 LLM 配置
 * 
 * @example
 * // 非流式调用
 * const result = await chatCompletionWithCurrentConfig({
 *   messages: [
 *     { role: 'system', content: 'You are a helpful assistant.' },
 *     { role: 'user', content: 'Hello!' }
 *   ]
 * })
 * 
 * // 流式调用
 * const eventSource = await chatCompletionWithCurrentConfig({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   stream: true
 * })
 * eventSource.addEventListener('message', (e) => {
 *   const data = JSON.parse(e.data)
 *   if (data.type === 'chunk') console.log(data.content)
 *   else if (data.type === 'end') eventSource.close()
 * })
 */
export async function chatCompletionWithCurrentConfig({
  messages,
  stream,
  custom_params
}: ChatCompletionWithConfigParams): Promise<ChatCompletionResult | CustomEventSource> {
  // 参数验证
  validateMessages(messages)

  // 获取当前对话文件
  const messagesStore = useMessagesStore()
  const conversationFile = messagesStore.conversationFile

  if (!conversationFile) {
    throw new Error('No conversation loaded. Please load a conversation first.')
  }

  // 构建请求参数
  const params: any = {
    conversation_file: conversationFile,
    messages
  }
  
  // 添加可选参数（只有明确提供时才添加）
  if (stream !== undefined) params.stream = stream
  if (custom_params !== undefined) params.custom_params = custom_params

  // 判断是否流式（优先使用参数，否则默认 false）
  const useStream = stream !== undefined ? stream : false
  
  if (useStream) {
    // 流式调用
    const url = `${ensureWorkflowBase()}/smarttavern/chat_completion/chat_with_config`
    
    return new Promise((resolve, reject) => {
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
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
    const response = await fetch(`${ensureWorkflowBase()}/smarttavern/chat_completion/chat_with_config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  }
}