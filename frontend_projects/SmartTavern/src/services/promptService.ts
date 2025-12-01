// Prompt Service
// 提供提示词装配和后处理功能

import { useCharacterStore } from '@/stores/character'
import { usePersonaStore } from '@/stores/persona'
import { usePresetStore } from '@/stores/preset'
import { useWorldBooksStore } from '@/stores/worldBooks'
import { useRegexRulesStore } from '@/stores/regexRules'
import { useChatVariablesStore } from '@/stores/chatVariables'

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
interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  source?: string
}

interface PresetDocument {
  prompts?: any[]
  [key: string]: any
}

interface WorldBookDocument {
  [key: string]: any
}

interface CharacterDocument {
  meta?: any
  world_book?: any
  [key: string]: any
}

interface PersonaDocument {
  meta?: any
  [key: string]: any
}

interface Variables {
  [key: string]: any
}

interface AssemblePromptParams {
  presets: PresetDocument
  world_books: WorldBookDocument[] | WorldBookDocument | any
  history: ChatMessage[]
  character?: CharacterDocument
  persona?: PersonaDocument
  variables?: Variables
}

interface AssemblePromptResult {
  messages: ChatMessage[]
}

interface PostprocessPromptParams {
  messages: ChatMessage[]
  regex_rules: any[] | any
  view: 'user_view' | 'assistant_view'
  variables?: Variables
}

interface PostprocessPromptResult {
  message: ChatMessage[]
  variables: {
    initial: Variables
    final: Variables
  }
}

/**
 * 提示词装配（RAW：prefix + in-chat）
 * 
 * @param params - 参数对象
 * @param params.presets - 预设文档对象，包含 prompts 数组
 * @param params.world_books - 世界书条目数组/嵌套数组/对象
 * @param params.history - OpenAI Chat messages 数组 [{role, content}]
 * @param params.character - 可选，角色文档对象
 * @param params.persona - 可选，用户画像文档对象
 * @param params.variables - 可选，变量对象
 * 
 * @returns { messages: [...] } - 完整提示词数组，每条结构 {role, content, source}
 * 
 * @example
 * const result = await assemblePrompt({
 *   presets: { prompts: [...] },
 *   world_books: [...],
 *   history: [{ role: 'user', content: 'Hello!' }],
 *   character: { meta: {...}, world_book: {...} },
 *   persona: { meta: {...} },
 *   variables: { name: 'Alice' }
 * })
 * console.log(result.messages)
 */
export async function assemblePrompt({
  presets,
  world_books,
  history,
  character,
  persona,
  variables
}: AssemblePromptParams): Promise<AssemblePromptResult> {
  // 参数验证
  if (!presets || typeof presets !== 'object') {
    throw new Error('presets must be an object')
  }
  if (!Array.isArray(history)) {
    throw new Error('history must be an array')
  }

  // 构建请求参数
  const params: any = {
    presets,
    world_books: world_books || [],
    history
  }

  // 添加可选参数
  if (character !== undefined) params.character = character
  if (persona !== undefined) params.persona = persona
  if (variables !== undefined) params.variables = variables

  const response = await fetch(`${ensureWorkflowBase()}/smarttavern/prompt_raw/assemble_full`, {
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

/**
 * 使用当前对话配置进行提示词装配
 * 自动从 stores 读取当前的 preset、world_books、character、persona、variables
 * 
 * @param params - 参数对象
 * @param params.history - 必需，OpenAI Chat messages 数组 [{role, content}]
 * 
 * @returns { messages: [...] } - 完整提示词数组
 * 
 * @throws Error 如果缺少必需的配置
 * 
 * @example
 * // 只需提供 history，其他配置自动读取
 * const result = await assemblePromptWithCurrentConfig({
 *   history: [
 *     { role: 'user', content: 'Hello!' },
 *     { role: 'assistant', content: 'Hi there!' }
 *   ]
 * })
 * console.log(result.messages)
 */
export async function assemblePromptWithCurrentConfig({
  history
}: {
  history: ChatMessage[]
}): Promise<AssemblePromptResult> {
  // 参数验证
  if (!Array.isArray(history)) {
    throw new Error('history must be an array')
  }

  // 从 stores 获取当前配置
  const presetStore = usePresetStore()
  const worldBooksStore = useWorldBooksStore()
  const characterStore = useCharacterStore()
  const personaStore = usePersonaStore()
  const variablesStore = useChatVariablesStore()

  // 获取 preset
  const presets = presetStore.meta
  if (!presets) {
    throw new Error('No preset loaded. Please load a preset first.')
  }

  // 获取 world_books（获取完整的文档数组）
  const world_books = Object.values(worldBooksStore.metas).filter((m): m is WorldBookDocument => m !== null)

  // 获取 character（获取完整文档）
  const character = characterStore.meta || undefined

  // 获取 persona（获取完整文档）
  const persona = personaStore.meta || undefined

  // 获取 variables（获取完整变量对象）
  const variables = variablesStore.meta || {}

  // 调用基础函数
  return await assemblePrompt({
    presets,
    history,
    world_books,
    character,
    persona,
    variables
  })
}

/**
 * 提示词后处理（单视图：正则 + 宏）
 * 
 * @param params - 参数对象
 * @param params.messages - OpenAI Chat 消息数组 [{role, content, source?}]
 * @param params.regex_rules - 正则规则（数组或 {"regex_rules":[...]}）
 * @param params.view - 视图选择 ('user_view' | 'assistant_view')
 * @param params.variables - 可选，变量对象
 * 
 * @returns { message: [...], variables: { initial: {}, final: {} } }
 * 
 * @example
 * const result = await postprocessPrompt({
 *   messages: [{ role: 'user', content: 'Hello {{name}}!' }],
 *   regex_rules: [{ pattern: '...', replacement: '...' }],
 *   view: 'user_view',
 *   variables: { name: 'Alice' }
 * })
 * console.log(result.message)
 * console.log(result.variables.final)
 */
export async function postprocessPrompt({
  messages,
  regex_rules,
  view,
  variables
}: PostprocessPromptParams): Promise<PostprocessPromptResult> {
  // 参数验证
  if (!Array.isArray(messages)) {
    throw new Error('messages must be an array')
  }
  if (!['user_view', 'assistant_view'].includes(view)) {
    throw new Error('view must be "user_view" or "assistant_view"')
  }

  // 构建请求参数
  const params: any = {
    messages,
    regex_rules: regex_rules || [],
    view
  }

  // 添加可选参数
  if (variables !== undefined) params.variables = variables

  const response = await fetch(`${ensureWorkflowBase()}/smarttavern/prompt_postprocess/apply`, {
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

/**
 * 使用当前对话配置进行提示词后处理
 * 自动从 stores 读取当前的 regex_rules 和 variables
 * 
 * @param params - 参数对象
 * @param params.messages - 必需，OpenAI Chat 消息数组 [{role, content}]
 * @param params.view - 必需，视图选择 ('user_view' | 'assistant_view')
 * 
 * @returns { message: [...], variables: { initial: {}, final: {} } }
 * 
 * @throws Error 如果缺少必需的配置
 * 
 * @example
 * // 只需提供 messages 和 view，其他配置自动读取
 * const result = await postprocessPromptWithCurrentConfig({
 *   messages: [
 *     { role: 'user', content: 'Hello {{name}}!' }
 *   ],
 *   view: 'user_view'
 * })
 * console.log(result.message)
 */
export async function postprocessPromptWithCurrentConfig({
  messages,
  view
}: {
  messages: ChatMessage[]
  view: 'user_view' | 'assistant_view'
}): Promise<PostprocessPromptResult> {
  // 参数验证
  if (!Array.isArray(messages)) {
    throw new Error('messages must be an array')
  }
  if (!['user_view', 'assistant_view'].includes(view)) {
    throw new Error('view must be "user_view" or "assistant_view"')
  }

  // 从 stores 获取当前配置
  const regexRulesStore = useRegexRulesStore()
  const variablesStore = useChatVariablesStore()

  // 获取 regex_rules（获取完整的文档数组）
  const regex_rules = Object.values(regexRulesStore.metas).filter((m): m is any => m !== null)

  // 获取 variables（获取完整变量对象）
  const variables = variablesStore.meta || {}

  // 调用基础函数
  return await postprocessPrompt({
    messages,
    regex_rules,
    view,
    variables
  })
}