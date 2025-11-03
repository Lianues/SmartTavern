import { defineStore } from 'pinia'
import type { RegexRule, WorldBookEntry } from '@/features/presets/types'

type CharacterDoc = {
  name?: string
  description?: string
  message?: string[]
  world_book?: {
    name?: string
    entries: WorldBookEntry[]
  }
  regex_rules?: RegexRule[]
  [k: string]: any
}

const STORAGE_KEY = 'prompt_editor_character_active'

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x))
}

function normalizeWorldEntry(w: any): void {
  if (!w || typeof w !== 'object') return
  if (typeof w.id !== 'string') w.id = String(w.id ?? '')
  if (typeof w.name !== 'string') w.name = String(w.name ?? w.id ?? '')
  w.enabled = w.enabled === true ? true : w.enabled === false ? false : true
  if (typeof w.content !== 'string') w.content = String(w.content ?? '')
  if (typeof w.mode !== 'string') w.mode = 'always'
  if (typeof w.condition !== 'string') w.condition = String(w.condition ?? '')
  if (typeof w.position !== 'string') w.position = 'system'
  if (w.order != null) w.order = Number(w.order)
  if (w.depth != null) w.depth = Number(w.depth)
  if (w.mode === 'conditional') {
    if (!Array.isArray(w.keys)) {
      if (w.keys != null) {
        const s = String(w.keys)
        w.keys = s.split(/;/).map((x: string) => x.trim()).filter(Boolean)
      } else {
        w.keys = []
      }
    } else {
      w.keys = w.keys.map((x: any) => String(x ?? '')).map((x: string) => x.trim()).filter(Boolean)
    }
  } else {
    w.keys = []
  }
}

function normalizeRegexRule(r: any): void {
  if (!r || typeof r !== 'object') return
  r.id = String(r.id ?? '')
  r.name = String(r.name ?? r.id)
  r.enabled = r.enabled === true
  r.find_regex = String(r.find_regex ?? '')
  r.replace_regex = String(r.replace_regex ?? '')
  if (!Array.isArray(r.targets)) r.targets = []
  r.placement = typeof r.placement === 'string' ? r.placement : 'after_macro'
  if (!Array.isArray(r.views)) r.views = []
  if (typeof r.mode !== 'string') r.mode = 'always'
  if (typeof r.condition !== 'string') r.condition = String(r.condition ?? '')
  if (r.min_depth != null) r.min_depth = Number(r.min_depth)
  if (r.max_depth != null) r.max_depth = Number(r.max_depth)
  if (r.description != null && typeof r.description !== 'string') r.description = String(r.description)
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

function loadLocal(): { fileName: string | null; doc: CharacterDoc | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { fileName: null, doc: null }
    const obj = JSON.parse(raw)
    return { fileName: typeof obj?.fileName === 'string' ? obj.fileName : null, doc: obj?.doc ?? null }
  } catch {
    return { fileName: null, doc: null }
  }
}

export const useCharacterStore = defineStore('character', {
  state: () => ({
    fileName: null as string | null,
    doc: null as CharacterDoc | null,
    loaded: false,
  }),

  getters: {
    hasDoc(state): boolean {
      return !!state.doc
    },
    name(state): string {
      return String(state.doc?.name ?? '')
    },
    description(state): string {
      return String(state.doc?.description ?? '')
    },
    messages(state): string[] {
      const arr = state.doc?.message
      if (!Array.isArray(arr)) return []
      return arr.map(x => (typeof x === 'string' ? x : String(x ?? '')))
    },
    worldEntries(state): WorldBookEntry[] {
      const entries = state.doc?.world_book?.entries
      return Array.isArray(entries) ? (entries as any) : []
    },
    regexRules(state): RegexRule[] {
      const rules = state.doc?.regex_rules
      return Array.isArray(rules) ? (rules as any) : []
    },
  },

  actions: {
    load() {
      if (this.loaded) return
      const { fileName, doc } = loadLocal()
      if (doc) {
        this.setCharacter(doc, fileName ?? 'Character.json')
      } else {
        this.fileName = null
        this.doc = null
      }
      this.loaded = true
    },

    setCharacter(json: any, fileName?: string) {
      const d: CharacterDoc = clone(json || {})
      // name/description
      if (d.name != null && typeof d.name !== 'string') d.name = String(d.name)
      if (d.description != null && typeof d.description !== 'string') d.description = String(d.description)

      // message
      if (!Array.isArray(d.message)) d.message = []
      d.message = d.message.map((m: any) => (typeof m === 'string' ? m : String(m ?? '')))

      // world_book
      if (!d.world_book || typeof d.world_book !== 'object') d.world_book = { entries: [] }
      if (!Array.isArray(d.world_book.entries)) d.world_book.entries = []
      for (const w of d.world_book.entries as any[]) {
        normalizeWorldEntry(w)
      }

      // regex_rules
      if (!Array.isArray(d.regex_rules)) d.regex_rules = []
      for (const r of d.regex_rules as any[]) {
        normalizeRegexRule(r)
      }

      this.doc = d
      this.fileName = fileName ?? 'Character.json'
      saveLocal(this)
    },

    // meta
    updateName(name: string) {
      if (!this.doc) return
      this.doc.name = String(name ?? '')
      saveLocal(this)
    },
    updateDescription(desc: string) {
      if (!this.doc) return
      this.doc.description = String(desc ?? '')
      saveLocal(this)
    },

    // messages
    setMessage(index: number, text: string) {
      if (!this.doc || !Array.isArray(this.doc.message)) return
      if (index < 0 || index >= this.doc.message.length) return
      this.doc.message.splice(index, 1, String(text ?? ''))
      saveLocal(this)
    },
    addMessage(text?: string) {
      if (!this.doc) return
      if (!Array.isArray(this.doc.message)) this.doc.message = []
      this.doc.message.push(String(text ?? ''))
      saveLocal(this)
    },
    removeMessage(index: number) {
      if (!this.doc || !Array.isArray(this.doc.message)) return
      if (index < 0 || index >= this.doc.message.length) return
      this.doc.message.splice(index, 1)
      saveLocal(this)
    },

    // world book
    addWorldBook(entry: WorldBookEntry) {
      if (!this.doc) return
      const list = (this.doc.world_book?.entries ?? []) as WorldBookEntry[]
      const i = list.findIndex(w => w && (w as any).id === (entry as any).id)
      if (i >= 0) list.splice(i, 1, entry as any)
      else list.unshift(entry as any)
      if (!this.doc.world_book) this.doc.world_book = { entries: [] }
      this.doc.world_book.entries = list
      saveLocal(this)
    },
    replaceWorldBook(updated: WorldBookEntry) {
      if (!this.doc || !Array.isArray(this.doc.world_book?.entries)) return
      const list = this.doc.world_book!.entries as WorldBookEntry[]
      const idx = list.findIndex(w => w && (w as any).id === (updated as any).id)
      if (idx >= 0) {
        list.splice(idx, 1, updated as any)
        saveLocal(this)
      }
    },
    removeWorldBook(id: string) {
      if (!this.doc || !Array.isArray(this.doc.world_book?.entries)) return
      const list = this.doc.world_book!.entries as WorldBookEntry[]
      const idx = list.findIndex(w => w && (w as any).id === id)
      if (idx >= 0) {
        list.splice(idx, 1)
        saveLocal(this)
      }
    },
    upsertWorldBookWithOldId(updated: WorldBookEntry, oldId?: string | null) {
      if (!this.doc) return
      if (!this.doc.world_book) this.doc.world_book = { entries: [] }
      if (!Array.isArray(this.doc.world_book.entries)) this.doc.world_book.entries = []
      const list = this.doc.world_book.entries as WorldBookEntry[]
      const next: any = { ...(updated as any) }
      try { normalizeWorldEntry(next) } catch {}

      const old = (oldId ?? next.id) as string
      const oldIdx = list.findIndex(w => w && (w as any).id === old)

      const dupIdx = list.findIndex(w => w && (w as any).id === next.id)
      if (dupIdx >= 0 && dupIdx !== oldIdx) {
        if (oldIdx >= 0) {
          const keep = { ...(list[oldIdx] as any), ...(next as any), id: old } as any
          try { normalizeWorldEntry(keep) } catch {}
          list.splice(oldIdx, 1, keep)
          saveLocal(this)
        }
        return
      }

      if (oldIdx >= 0) list.splice(oldIdx, 1, next as any)
      else list.unshift(next as any)
      saveLocal(this)
    },

    // regex
    addRegexRule(rule: RegexRule) {
      if (!this.doc) return
      if (!Array.isArray(this.doc.regex_rules)) this.doc.regex_rules = []
      const i = this.doc.regex_rules.findIndex(r => r && (r as any).id === (rule as any).id)
      if (i >= 0) this.doc.regex_rules.splice(i, 1, rule as any)
      else this.doc.regex_rules.unshift(rule as any)
      saveLocal(this)
    },
    replaceRegexRule(updated: RegexRule) {
      if (!this.doc || !Array.isArray(this.doc.regex_rules)) return
      const idx = this.doc.regex_rules.findIndex(r => r && (r as any).id === (updated as any).id)
      if (idx >= 0) {
        this.doc.regex_rules.splice(idx, 1, updated as any)
        saveLocal(this)
      }
    },
    removeRegexRule(id: string) {
      if (!this.doc || !Array.isArray(this.doc.regex_rules)) return
      const idx = this.doc.regex_rules.findIndex(r => r && (r as any).id === id)
      if (idx >= 0) {
        this.doc.regex_rules.splice(idx, 1)
        saveLocal(this)
      }
    },

    // 排序：世界书（与独立面板一致）
    reorderWorldBooks(orderedIds: string[]) {
      if (!this.doc || !Array.isArray(this.doc.world_book?.entries)) return
      const items = (this.doc.world_book!.entries || []) as WorldBookEntry[]
      const idSet = new Set(items.map(i => (i as any).id))
      const normalized = (orderedIds || []).filter((id): id is string => !!id && idSet.has(id))
      const missing = items.map(i => (i as any).id).filter(id => !normalized.includes(id))
      const finalIds = normalized.concat(missing)
      const map = new Map<string, WorldBookEntry>(items.map(i => [(i as any).id, i]))
      const next: WorldBookEntry[] = []
      for (const id of finalIds) {
        const x = map.get(id)
        if (x) next.push(x)
      }
      this.doc.world_book!.entries.splice(0, items.length, ...(next as any))
      saveLocal(this)
    },

    // 排序：正则（与独立面板一致）
    reorderRegexRules(orderedIds: string[]) {
      if (!this.doc || !Array.isArray(this.doc.regex_rules)) return
      const items = this.doc.regex_rules as RegexRule[]
      const idSet = new Set(items.map(i => (i as any).id))
      const normalized = (orderedIds || []).filter((id): id is string => !!id && idSet.has(id))
      const missing = items.map(i => (i as any).id).filter(id => !normalized.includes(id))
      const finalIds = normalized.concat(missing)
      const map = new Map<string, RegexRule>(items.map(i => [(i as any).id, i]))
      const next: RegexRule[] = []
      for (const id of finalIds) {
        const x = map.get(id)
        if (x) next.push(x)
      }
      this.doc.regex_rules.splice(0, items.length, ...(next as any))
      saveLocal(this)
    },
    /** 清除角色卡页面缓存（内存 + LocalStorage） */
    clearAll() {
      this.fileName = null
      this.doc = null
      try { localStorage.removeItem('prompt_editor_character_active') } catch {}
    },

    /** 重命名当前角色卡文件名（仅本面板与导出名） */
    renameFile(newName: string) {
      const nn = String(newName || '').trim()
      if (!nn) return
      this.fileName = nn
      saveLocal(this)
    },

    exportCharacter(): { filename: string; json: string } | null {
      if (!this.doc) return null
      const out = clone(this.doc)
      // 强制字符串 id
      if (out.world_book?.entries) {
        for (const e of out.world_book.entries as any[]) {
          e.id = String(e.id ?? '')
        }
      }
      const filename = (this.fileName?.endsWith('.json') ? this.fileName : `${this.fileName ?? (out.name || 'Character')}.json`) || 'Character.json'
      return { filename, json: JSON.stringify(out, null, 2) }
    },
  },
})