// SmartTavern Frontend API Client — Data Catalog (v1)
// Calls backend gateway APIs to list presets/world_books/characters/personas/regex_rules.
// Gateway default: http://localhost:8050 (see core/config/api_config.py in backend)
//
// Usage:
//   import DataCatalog from '@/services/dataCatalog'
//   const res = await DataCatalog.listPresets()
//   console.log(res.items) // [{ file, name, description }, ...]
//
// Notes:
// - All endpoints are POST with empty JSON body as per backend contract (no params needed).
// - CORS is enabled by the gateway (allow-origins: *).
// - Errors are thrown with details; UI should handle and display gracefully.

// 类型定义
interface DataItem {
  file: string
  name?: string
  description?: string
  [key: string]: any
}

interface DataListResponse {
  items?: DataItem[]
  [key: string]: any
}

interface DataDetailResponse {
  file?: string
  content?: any
  [key: string]: any
}

interface DataAssetResponse {
  content_base64?: string
  mime?: string
  size?: number
  [key: string]: any
}

interface DataAssetBlobResult {
  blob: Blob
  mime: string
  size: number
}

interface CardItem {
  key: string
  icon: string
  name: string
  desc: string
  file: string
}

type DataType = 'preset' | 'worldbook' | 'character' | 'persona' | 'regex' | 'conversation' | 'llmconfig'

// 扩展 ImportMeta 接口以支持 env
declare global {
  interface ImportMetaEnv {
    VITE_API_BASE?: string
    [key: string]: any
  }
  interface ImportMeta {
    env: ImportMetaEnv
  }
}

const DEFAULT_BACKEND = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || 'http://localhost:8050'

function _readLS(key: string): string | null {
  try {
    return (typeof window !== 'undefined') ? localStorage.getItem(key) : null
  } catch (_) {
    return null
  }
}

function getBackendBase(): string {
  const fromLS = _readLS('st.backend_base')
  const fromWin = (typeof window !== 'undefined') ? (window as any).ST_BACKEND_BASE : null
  const base = String(fromLS || fromWin || DEFAULT_BACKEND || 'http://localhost:8050')
  return base.replace(/\/+$/, '')
}

function ensureBase(): string {
  // modules 命名空间固定拼接
  return `${getBackendBase()}/api/modules`.replace(/\/+$/, '')
}

async function postJSON(path: string, body: any = {}): Promise<any> {
  const base = ensureBase()
  const url = `${base}/${String(path).replace(/^\/+/, '')}`
  let resp: Response
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    })
  } catch (networkError: any) {
    const err: any = new Error(`[DataCatalog] Network error: ${networkError?.message || networkError}`)
    err.cause = networkError
    err.url = url
    throw err
  }

  let data: any = null
  const text = await resp.text().catch(() => '')
  try {
    data = text ? JSON.parse(text) : null
  } catch (parseError: any) {
    const err: any = new Error(`[DataCatalog] Invalid JSON response (${resp.status}): ${text?.slice(0, 200)}`)
    err.cause = parseError
    err.status = resp.status
    err.url = url
    throw err
  }

  if (!resp.ok) {
    const err: any = new Error(`[DataCatalog] HTTP ${resp.status}: ${data && (data.message || data.error) || 'Unknown error'}`)
    err.status = resp.status
    err.url = url
    err.details = data
    throw err
  }
  return data
}

// Public API
const DataCatalog = {
  // All "list_*" endpoints ignore input and return full fields from fixed backend paths.
  listPresets(): Promise<DataListResponse> {
    return postJSON('smarttavern/data_catalog/list_presets', {})
  },
  listWorldBooks(): Promise<DataListResponse> {
    return postJSON('smarttavern/data_catalog/list_world_books', {})
  },
  listCharacters(): Promise<DataListResponse> {
    return postJSON('smarttavern/data_catalog/list_characters', {})
  },
  listPersonas(): Promise<DataListResponse> {
    return postJSON('smarttavern/data_catalog/list_personas', {})
  },
  listRegexRules(): Promise<DataListResponse> {
    return postJSON('smarttavern/data_catalog/list_regex_rules', {})
  },
  listConversations(): Promise<DataListResponse> {
    return postJSON('smarttavern/data_catalog/list_conversations', {})
  },
  listLLMConfigs(): Promise<DataListResponse> {
    return postJSON('smarttavern/data_catalog/list_llm_configs', {})
  },
  listPlugins(): Promise<DataListResponse> {
    return postJSON('smarttavern/data_catalog/list_plugins', {})
  },

  // Plugins switch file
  getPluginsSwitch(): Promise<any> {
    return postJSON('smarttavern/data_catalog/get_plugins_switch', {})
  },
  updatePluginsSwitch(content: any): Promise<any> {
    return postJSON('smarttavern/data_catalog/update_plugins_switch', { content })
  },

  // Lightweight cache (in-memory + localStorage)
  _lsKey: 'st.datacache.v1',
  _mem: new Map<string, any>(),
  _ensureStore(): Record<string, any> {
    if (typeof window === 'undefined') return {}
    try {
      const raw = localStorage.getItem(this._lsKey)
      return raw ? JSON.parse(raw) : {}
    } catch (_) {
      return {}
    }
  },
  _saveStore(store: Record<string, any>): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(this._lsKey, JSON.stringify(store))
    } catch (_) {}
  },
  _ck(type: string, file: string): string {
    return `${type}:${String(file || '')}`
  },
  _getCached(type: string, file: string): any {
    const key = this._ck(type, file)
    if (this._mem.has(key)) return this._mem.get(key)
    const store = this._ensureStore()
    return store[key] || null
  },
  _setCached(type: string, file: string, value: any, persist: boolean = true): void {
    const key = this._ck(type, file)
    this._mem.set(key, value)
    if (persist) {
      const store = this._ensureStore()
      // naive cap: keep last 50 entries to avoid bloat
      store[key] = value
      const keys = Object.keys(store)
      if (keys.length > 50) {
        const toDelete = keys.length - 50
        for (let i = 0; i < toDelete; i++) {
          const keyToDelete = keys[i]
          if (keyToDelete) delete store[keyToDelete]
        }
      }
      this._saveStore(store)
    }
  },

  // Detail fetchers with caching
  async _getDetail(type: DataType, file: string, opts: { useCache?: boolean; persist?: boolean } = {}): Promise<DataDetailResponse> {
    const useCache = opts.useCache !== false
    if (useCache) {
      const cached = this._getCached(type, file)
      if (cached) return cached
    }
    const pathMap: Record<DataType, string> = {
      preset: 'smarttavern/data_catalog/get_preset_detail',
      worldbook: 'smarttavern/data_catalog/get_world_book_detail',
      character: 'smarttavern/data_catalog/get_character_detail',
      persona: 'smarttavern/data_catalog/get_persona_detail',
      regex: 'smarttavern/data_catalog/get_regex_rule_detail',
      conversation: 'smarttavern/data_catalog/get_conversation_detail',
      llmconfig: 'smarttavern/data_catalog/get_llm_config_detail',
    }
    const path = pathMap[type]
    if (!path) throw new Error(`[DataCatalog] Unknown detail type: ${type}`)
    const res = await postJSON(path, { file })
    this._setCached(type, file, res, opts.persist !== false)
    return res
  },

  getPresetDetail(file: string, opts?: { useCache?: boolean; persist?: boolean }): Promise<DataDetailResponse> {
    return this._getDetail('preset', file, opts)
  },
  getWorldBookDetail(file: string, opts?: { useCache?: boolean; persist?: boolean }): Promise<DataDetailResponse> {
    return this._getDetail('worldbook', file, opts)
  },
  getCharacterDetail(file: string, opts?: { useCache?: boolean; persist?: boolean }): Promise<DataDetailResponse> {
    return this._getDetail('character', file, opts)
  },
  getPersonaDetail(file: string, opts?: { useCache?: boolean; persist?: boolean }): Promise<DataDetailResponse> {
    return this._getDetail('persona', file, opts)
  },
  getRegexRuleDetail(file: string, opts?: { useCache?: boolean; persist?: boolean }): Promise<DataDetailResponse> {
    return this._getDetail('regex', file, opts)
  },
  getConversationDetail(file: string, opts?: { useCache?: boolean; persist?: boolean }): Promise<DataDetailResponse> {
    return this._getDetail('conversation', file, opts)
  },
  getLLMConfigDetail(file: string, opts?: { useCache?: boolean; persist?: boolean }): Promise<DataDetailResponse> {
    return this._getDetail('llmconfig', file, opts)
  },

  // Update APIs (create/update)
  updatePresetFile(file: string, content: any, name?: string, description?: string): Promise<any> {
    return postJSON('smarttavern/data_catalog/update_preset_file', { file, content, name, description })
  },
  updateWorldBookFile(file: string, content: any, name?: string, description?: string): Promise<any> {
    return postJSON('smarttavern/data_catalog/update_world_book_file', { file, content, name, description })
  },
  updateCharacterFile(file: string, content: any, name?: string, description?: string): Promise<any> {
    return postJSON('smarttavern/data_catalog/update_character_file', { file, content, name, description })
  },
  updatePersonaFile(file: string, content: any, name?: string, description?: string): Promise<any> {
    return postJSON('smarttavern/data_catalog/update_persona_file', { file, content, name, description })
  },
  updateRegexRuleFile(file: string, content: any, name?: string, description?: string): Promise<any> {
    return postJSON('smarttavern/data_catalog/update_regex_rule_file', { file, content, name, description })
  },
  updateLLMConfigFile(file: string, content: any, name?: string, description?: string): Promise<any> {
    return postJSON('smarttavern/data_catalog/update_llm_config_file', { file, content, name, description })
  },

  // Small helper to map backend items to UI cards (icon per type)
  mapToCards(items: DataItem[], type: string = 'generic'): CardItem[] {
    const iconMap: Record<string, string> = {
      presets: '🧩',
      world_books: '📚',
      characters: '👤',
      personas: '🧠',
      regex_rules: '🧹',
      llm_configs: '🔌',
      generic: '📦',
    }
    const icon = iconMap[type] || iconMap.generic || '📦'

    return (Array.isArray(items) ? items : []).map((it) => {
      const file = String(it.file || '')
      const name = it.name || file.split('/').pop() || '未命名'
      const desc = it.description || ''
      return { key: file, icon, name, desc, file }
    })
  },
  
  // Asset functions (declared here for TypeScript)
  getPluginsAsset: null as any,
  getPluginsAssetBlob: null as any,
  getDataAsset: null as any,
  getDataAssetBlob: null as any,
}

/** Decode base64 string to Uint8Array */
function _b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/**
 * 获取插件资产（Base64 + 元数据）
 * @param file - backend_projects/SmartTavern/plugins/... 相对路径（POSIX）
 */
DataCatalog.getPluginsAsset = function (file: string): Promise<DataAssetResponse> {
  return postJSON('smarttavern/data_catalog/get_plugins_asset', { file })
}

/**
 * 以 Blob 形式获取插件资产
 * @param file
 * @returns { blob: Blob, mime: string, size: number }
 */
DataCatalog.getPluginsAssetBlob = async function (file: string): Promise<DataAssetBlobResult> {
  const res = await DataCatalog.getPluginsAsset(file)
  if (!res || !res.content_base64) {
    const err: any = new Error(`[DataCatalog] no asset content: ${file}`)
    err.details = res
    throw err
  }
  const bytes = _b64ToBytes(res.content_base64)
  const mime = String(res.mime || 'application/octet-stream')
  return { blob: new Blob([bytes.buffer as ArrayBuffer], { type: mime }), mime, size: Number(res.size || bytes.length) }
}

/**
 * 获取数据资产（Base64 + 元数据）
 * @param file - backend_projects/SmartTavern/data/... 相对路径（POSIX）
 */
DataCatalog.getDataAsset = function (file: string): Promise<DataAssetResponse> {
  return postJSON('smarttavern/data_catalog/get_data_asset', { file })
}

/**
 * 以 Blob 形式获取数据资产
 * @param file
 * @returns { blob: Blob, mime: string, size: number }
 */
DataCatalog.getDataAssetBlob = async function (file: string): Promise<DataAssetBlobResult> {
  const res = await DataCatalog.getDataAsset(file)
  if (!res || !res.content_base64) {
    const err: any = new Error(`[DataCatalog] no data asset content: ${file}`)
    err.details = res
    throw err
  }
  const bytes = _b64ToBytes(res.content_base64)
  const mime = String(res.mime || 'application/octet-stream')
  return { blob: new Blob([bytes.buffer as ArrayBuffer], { type: mime }), mime, size: Number(res.size || bytes.length) }
}

export default DataCatalog