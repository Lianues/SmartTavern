import { defineStore } from 'pinia'
import { runPromptRaw } from '../workflow/promptRaw'
import { runDialogView, runPreflightView } from '../workflow/promptFlows'
import { usePreviewStore, type PreviewMode } from './store'

type Messages = { role: 'system' | 'user' | 'assistant'; content: string; source?: Record<string, any> }

type DialogResult = { message: Messages[]; variables?: any }
type PreflightResult = { message: Messages[]; variables?: any }
type RawResult = { messages: Messages[] }

export const usePreviewRuntime = defineStore('previewRuntime', {
  state: () => ({
    generating: false as boolean,
    lastError: '' as string,
    lastGeneratedAt: 0 as number,
    // 针对三种视图的最近结果（仅进程内存储，不持久化）
    results: {
      raw: null as RawResult | null,
      dialog: null as DialogResult | null,
      preflight: null as PreflightResult | null,
    },
    // 防抖计时器
    _debounce: null as any,
  }),
  actions: {
    clear() {
      this.generating = false
      this.lastError = ''
      this.lastGeneratedAt = 0
      this.results.raw = null
      this.results.dialog = null
      this.results.preflight = null
      if (this._debounce) {
        clearTimeout(this._debounce)
        this._debounce = null
      }
    },

    schedule(mode?: PreviewMode, delay = 1000) {
      const preview = usePreviewStore()
      const m = mode || preview.mode
      if (this._debounce) {
        clearTimeout(this._debounce)
        this._debounce = null
      }
      this._debounce = setTimeout(() => {
        this._debounce = null
        // 调用 generateNow，按当前模式计算
        this.generateNow(m)
      }, Math.max(0, delay))
    },

    async generateNow(mode?: PreviewMode) {
      if (this.generating) {
        // 若已经在生成中，简单忽略（可扩展队列/合并策略）
        return
      }
      const preview = usePreviewStore()
      const current: PreviewMode = mode || preview.mode

      this.generating = true
      this.lastError = ''
      try {
        if (current === 'raw') {
          const raw = await runPromptRaw()
          this.results.raw = raw
        } else if (current === 'message') {
          // RAW → user_view（variables={}）
          const raw = await runPromptRaw()
          const dialog = await runDialogView(raw.messages)
          this.results.dialog = dialog
        } else if (current === 'preflight') {
          // RAW → user_view（{}）→ assistant_view（携带 user_view 的 variables）
          const raw = await runPromptRaw()
          const dialog = await runDialogView(raw.messages)
          const preflight = await runPreflightView(dialog)
          this.results.preflight = preflight
        }
        this.lastGeneratedAt = Date.now()
      } catch (e: any) {
        this.lastError = String(e?.message || e || '执行失败')
      } finally {
        this.generating = false
      }
    },
  },
})