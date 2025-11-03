import { defineStore } from 'pinia'
import { usePresetStore } from '@/features/presets/store'
import { useCharacterStore } from '@/features/characters/store'
import { usePersonaStore } from '@/features/persona/store'
import { useHistoryStore } from '@/features/history/store'

export type TypeKey = 'presets' | 'worldbook' | 'characters' | 'regex' | 'user' | 'history'

type FileRecord = {
  name: string
  data: any
  createdAt?: number
  updatedAt?: number
  enabled?: boolean
}

type TypeBucket = {
  files: FileRecord[]
  activeName: string | null
}

const STORAGE_KEY = 'prompt_editor_file_manager'

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x))
}

function freshBuckets(): Record<TypeKey, TypeBucket> {
  return {
    presets: { files: [], activeName: null },
    worldbook: { files: [], activeName: null },
    characters: { files: [], activeName: null },
    regex: { files: [], activeName: null },
    user: { files: [], activeName: null },
    history: { files: [], activeName: null },
  }
}

export const useFileManagerStore = defineStore('fileManager', {
  state: () => ({
    buckets: freshBuckets() as Record<TypeKey, TypeBucket>,
    currentType: 'presets' as TypeKey,
    loaded: false,
  }),
  getters: {
    list: (state) => {
      return (type: TypeKey): FileRecord[] => state.buckets[type]?.files ?? []
    },
    activeName: (state) => {
      return (type: TypeKey): string | null => state.buckets[type]?.activeName ?? null
    },
    getCurrentType: (state): TypeKey => state.currentType,
  },
  actions: {
    load() {
      if (this.loaded) return
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const obj = JSON.parse(raw)
          if (obj && typeof obj === 'object') {
            if (obj.buckets) this.buckets = obj.buckets
            if (obj.currentType) this.currentType = obj.currentType
          }
        }
      } catch {}
      this.loaded = true
    },
    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ buckets: this.buckets, currentType: this.currentType }))
      } catch {}
    },
    setCurrentType(type: TypeKey) {
      this.currentType = type
      this.persist()
    },
    clearAll() {
      this.buckets = freshBuckets()
      this.persist()
    },
    clearType(type: TypeKey) {
      if (!this.buckets[type]) return
      this.buckets[type] = { files: [], activeName: null }
      this.persist()
    },
    upsertFile(type: TypeKey, name: string, data: any) {
      this.load()
      const bucket = this.buckets[type]
      if (!bucket) return
      const idx = bucket.files.findIndex(f => f.name === name)
      const now = Date.now()
      const prev = idx >= 0 ? bucket.files[idx] : undefined
      const rec: FileRecord = {
        name,
        data: clone(data),
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
        enabled: prev?.enabled ?? true,
      }
      if (idx >= 0) bucket.files.splice(idx, 1, rec)
      else bucket.files.unshift(rec)
      if (!bucket.activeName) bucket.activeName = name
      this.persist()
    },
    setActive(type: TypeKey, name: string) {
      const bucket = this.buckets[type]
      if (!bucket) return
      if (!bucket.files.some(f => f.name === name)) return
      bucket.activeName = name
      this.persist()
      this._mirrorToPanels(type, name)
    },

    toggleEnable(type: TypeKey, name: string) {
      const bucket = this.buckets[type]
      if (!bucket) return
      const rec = bucket.files.find(f => f.name === name)
      if (!rec) return
      rec.enabled = !rec.enabled
      this.persist()
    },
    removeFile(type: TypeKey, name: string) {
      const bucket = this.buckets[type]
      if (!bucket) return
      const idx = bucket.files.findIndex(f => f.name === name)
      if (idx >= 0) {
        bucket.files.splice(idx, 1)
        if (bucket.activeName === name) {
          bucket.activeName = bucket.files[0]?.name ?? null
        }
        this.persist()
      }
    },

    /**
     * 重命名文件库内指定类型文件，并同步镜像到对应面板
     */
    renameFile(type: TypeKey, oldName: string, newName: string): boolean {
      this.load()
      const bucket = this.buckets[type]
      if (!bucket) return false
      const nn = String(newName || '').trim()
      const on = String(oldName || '').trim()
      if (!nn || !on) return false
      const idx = bucket.files.findIndex(f => f.name === on)
      if (idx < 0) return false
      if (bucket.files.some((f, i) => i !== idx && f.name === nn)) return false
      const rec = bucket.files[idx]
      if (!rec) return false
      rec.name = nn
      if (bucket.activeName === on) bucket.activeName = nn
      this.persist()
      try { this._mirrorToPanels(type, nn) } catch {}
      return true
    },
    _mirrorToPanels(type: TypeKey, name: string) {
      try {
        const bucket = this.buckets[type]
        const found = bucket.files.find(f => f.name === name)
        if (!found) return
        const json = found.data
        if (type === 'presets') {
          const preset = usePresetStore()
          preset.upsertFile({ name: found.name, enabled: true, data: clone(json) } as any)
          preset.setActive(found.name)
        } else if (type === 'worldbook') {
          const preset = usePresetStore()
          let entries: any[] = []
          if (Array.isArray(json?.entries)) entries = json.entries
          else if (Array.isArray(json?.world_book?.entries)) entries = json.world_book.entries
          else if (Array.isArray(json)) entries = json
          else entries = []
          preset.setWorldBooks(entries as any)
        } else if (type === 'regex') {
          const preset = usePresetStore()
          const rules: any[] = Array.isArray(json) ? json : (Array.isArray(json?.regex_rules) ? json.regex_rules : [])
          preset.setRegexRules(rules as any)
        } else if (type === 'characters') {
          const chars = useCharacterStore()
          chars.setCharacter(clone(json), found.name)
        } else if (type === 'user') {
          const persona = usePersonaStore()
          persona.setPersona(clone(json), found.name)
        } else if (type === 'history') {
          const history = useHistoryStore()
          history.setDoc(clone(json), found.name)
        }
      } catch {}
    },
  },
})