import { postWorkflow } from '@/services/apiClient'
import { usePresetStore } from '@/features/presets/store'
import { useEditorContextStore } from '@/features/workflow/store'
import { buildPromptRawPayload, callPromptRaw, type PromptRawMessage } from '@/features/workflow/promptRaw'

/**
 * 对话页面提示词（user_view）
 * 流程：
 * 1) 从前端上下文装配 RAW（prompt_raw/assemble_full）
 * 2) 将 RAW messages 送入后处理（prompt_postprocess/apply, view=user_view, variables={}）
 */
export async function runDialogView(rawMessages: PromptRawMessage[]): Promise<{ message: PromptRawMessage[]; variables: any }> {
  const preset = usePresetStore()
  const rules = Array.isArray(preset.regexRules) ? preset.regexRules : []
  // prompt_postprocess 接口 schema：{messages, rules, view, variables?}
  const body = {
    messages: rawMessages,
    rules: { rules }, // 允许数组或对象，这里包一层便于后端适配器统一处理
    view: 'user_view',
    variables: {}, // 按要求传入空对象
  }
  const res = await postWorkflow('smarttavern/prompt_postprocess/apply', body)
  if (!res || typeof res !== 'object' || !Array.isArray(res.message)) {
    throw new Error('后端返回格式不正确：缺少 message 数组')
  }
  return { message: res.message as PromptRawMessage[], variables: res.variables ?? {} }
}

/**
 * 发给AI前提示词（assistant_view）
 * 流程：
 * 1) RAW（assemble_full）→ 得到 raw.messages
 * 2) user_view 后处理（prompt_postprocess/apply）
 * 3) 将 user_view 的结果作为新的 history，重新调用 prompt_raw/assemble_full
 * 4) 在 3) 的输出上，对 assistant_view 再做后处理（prompt_postprocess/apply）
 */
export async function runPreflightView(userView: { message: PromptRawMessage[]; variables?: any }): Promise<{ message: PromptRawMessage[]; variables: any }> {
  const preset = usePresetStore()
  const rules = Array.isArray(preset.regexRules) ? preset.regexRules : []

  // 用 user_view 的结果作为新的 history 再装配 RAW
  const ctxStore = useEditorContextStore()
  const ctx = ctxStore.snapshot()
  const payload = buildPromptRawPayload(ctx)
  payload.history = Array.isArray(userView?.message) ? userView.message : []
  const assembled = await callPromptRaw(payload)

  // assistant_view 后处理；将 user_view 的变量结果作为初始变量传入
  const variablesIn = (userView?.variables && (userView.variables.final ?? userView.variables)) || {}
  const body = {
    messages: assembled.messages,
    rules: { rules },
    view: 'assistant_view',
    variables: variablesIn,
  }
  const res = await postWorkflow('smarttavern/prompt_postprocess/apply', body)
  if (!res || typeof res !== 'object' || !Array.isArray(res.message)) {
    throw new Error('后端返回格式不正确：缺少 message 数组')
  }
  return { message: res.message as PromptRawMessage[], variables: res.variables ?? {} }
}