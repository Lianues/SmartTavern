import { defineStore } from 'pinia'

export type PreviewMode = 'raw' | 'message' | 'preflight'

const STORAGE_KEY = 'prompt_editor_preview_mode'

interface State {
  mode: PreviewMode
}

export const usePreviewStore = defineStore('preview', {
  state: (): State => ({
    mode: 'raw',
  }),
  getters: {
    label(state): string {
      switch (state.mode) {
        case 'raw':
          return '原始提示词'
        case 'message':
          return '消息页面提示词'
        case 'preflight':
          return '发给AI前提示词'
        default:
          return '原始提示词'
      }
    },
  },
  actions: {
    load() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved === 'raw' || saved === 'message' || saved === 'preflight') {
          this.mode = saved as PreviewMode
        }
      } catch {
        // ignore
      }
    },
    setMode(mode: PreviewMode) {
      this.mode = mode
      try {
        localStorage.setItem(STORAGE_KEY, mode)
      } catch {
        // ignore
      }
    },
  },
})