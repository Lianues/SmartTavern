import { defineStore } from 'pinia'

type PersonaDoc = {
  name?: string
  description?: string
  [k: string]: any
}

const STORAGE_KEY = 'prompt_editor_persona_active'

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x))
}

function saveLocal(state: any) {
  try {
    const data = {
      fileName: state.fileName,
      doc: state.doc,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

function loadLocal(): { fileName: string | null; doc: PersonaDoc | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { fileName: null, doc: null }
    const obj = JSON.parse(raw)
    return { fileName: typeof obj?.fileName === 'string' ? obj.fileName : null, doc: obj?.doc ?? null }
  } catch {
    return { fileName: null, doc: null }
  }
}

export const usePersonaStore = defineStore('persona', {
  state: () => ({
    fileName: null as string | null,
    doc: null as PersonaDoc | null,
    loaded: false,
  }),

  getters: {
    name(state): string {
      return String(state.doc?.name ?? '')
    },
    description(state): string {
      return String(state.doc?.description ?? '')
    },
    hasDoc(state): boolean {
      return !!state.doc
    },
  },

  actions: {
    load() {
      if (this.loaded) return
      const { fileName, doc } = loadLocal()
      if (doc) {
        this.setPersona(doc, fileName ?? 'Persona.json')
      } else {
        this.fileName = null
        this.doc = { name: '', description: '' }
      }
      this.loaded = true
    },

    setPersona(json: any, fileName?: string) {
      const d: PersonaDoc = clone(json || {})
      if (d.name != null && typeof d.name !== 'string') d.name = String(d.name)
      if (d.description != null && typeof d.description !== 'string') d.description = String(d.description)
      // 仅保留 name/description 两字段，避免污染
      const cleaned: PersonaDoc = { name: String(d.name ?? ''), description: String(d.description ?? '') }
      this.doc = cleaned
      this.fileName = fileName ?? 'Persona.json'
      saveLocal(this)
    },

    updateName(name: string) {
      if (!this.doc) this.doc = {}
      this.doc.name = String(name ?? '')
      saveLocal(this)
    },

    updateDescription(desc: string) {
      if (!this.doc) this.doc = {}
      this.doc.description = String(desc ?? '')
      saveLocal(this)
    },

    /** 清除用户信息页面缓存（内存 + LocalStorage） */
    clearAll() {
      this.fileName = null
      this.doc = { name: '', description: '' }
      try { localStorage.removeItem('prompt_editor_persona_active') } catch {}
    },

    /** 重命名当前用户信息文件名（仅本面板与导出名） */
    renameFile(newName: string) {
      const nn = String(newName || '').trim()
      if (!nn) return
      this.fileName = nn
      saveLocal(this)
    },

    exportPersona(): { filename: string; json: string } | null {
      const out = clone(this.doc || { name: '', description: '' })
      const filename = (this.fileName?.endsWith('.json') ? this.fileName : `${this.fileName ?? (out.name || 'Persona')}.json`) || 'Persona.json'
      return { filename, json: JSON.stringify(out, null, 2) }
    },
  },
})