import { ensureApiClientReady, postWorkflow } from '@/services/apiClient'
import { useEditorContextStore } from '@/features/workflow/store'
import type { EditorContext } from '@/features/workflow/store'

export type MsgRole = 'system' | 'user' | 'assistant'

export interface PromptRawMessage {
  role: MsgRole
  content: string
  source?: Record<string, any>
}

export interface PromptRawResult {
  messages: PromptRawMessage[]
}

/**
 * 组装后端 RAW 工作流输入
 * - presets: 对象（可为空对象）
 * - world_books: 数组（可空数组）
 * - history: OpenAI messages 数组（可空数组）
 * - character/persona: 若存在则传入，否则省略字段
 */
export function buildPromptRawPayload(ctx: EditorContext): Record<string, any> {
  const body: Record<string, any> = {
    presets: ctx.presets.data ?? {},
    world_books: Array.isArray(ctx.worldbook.entries) ? ctx.worldbook.entries : [],
    history: Array.isArray(ctx.history.messages) ? ctx.history.messages : [],
  }
  if (ctx.characters) body.character = ctx.characters
  if (ctx.user) body.persona = ctx.user
  return body
}

/**
 * 直接调用 RAW 工作流
 * - path: /api/workflow/smarttavern/prompt_raw/assemble_full
 */
export async function callPromptRaw(payload: Record<string, any>): Promise<PromptRawResult> {
  await ensureApiClientReady()
  const res = await postWorkflow('smarttavern/prompt_raw/assemble_full', payload)
  // 结构保障
  if (!res || typeof res !== 'object' || !Array.isArray(res.messages)) {
    throw new Error('后端返回格式不正确：缺少 messages 数组')
  }
  return { messages: res.messages as PromptRawMessage[] }
}

/**
 * 便捷方法：读取前端聚合上下文 → 构造 payload → 调用 RAW 工作流
 */
export async function runPromptRaw(): Promise<PromptRawResult> {
  const store = useEditorContextStore()
  const ctx = store.snapshot()
  const payload = buildPromptRawPayload(ctx)
  return callPromptRaw(payload)
}