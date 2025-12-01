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

import { i18n } from '@/locales'

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

// 导入/导出相关类型
type ImportDataType = 'preset' | 'character' | 'worldbook' | 'persona' | 'regex_rule' | 'llm_config'

interface ImportDataResponse {
  success: boolean
  message?: string
  error?: string
  data_type?: string
  name?: string
  folder?: string
  file?: string
  extra_files?: string[]
  [key: string]: any
}

interface ExportDataResponse {
  success: boolean
  message?: string
  error?: string
  data_type?: string
  name?: string
  format?: 'zip' | 'png'
  filename?: string
  content_base64?: string
  size?: number
  [key: string]: any
}

interface SupportedTypesResponse {
  success: boolean
  types?: Array<{
    type: string
    dir: string
    main_file: string
  }>
  formats?: string[]
  [key: string]: any
}

interface CheckNameExistsResponse {
  success: boolean
  exists?: boolean
  folder_name?: string
  suggested_name?: string | null
  error?: string
  message?: string
  [key: string]: any
}

interface DeleteDataFolderResponse {
  success: boolean
  deleted_path?: string
  data_type?: string
  error?: string
  message?: string
  [key: string]: any
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

/** Decode base64 string to Uint8Array */
function _b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** Convert File/Blob to base64 string */
async function _fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.includes(',') ? (result.split(',')[1] || '') : result
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
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
  
  // Plugin detail functions
  getPluginDetail(dir: string): Promise<DataDetailResponse> {
    return postJSON('smarttavern/data_catalog/get_plugin_detail', { dir })
  },

  // Update APIs (create/update)
  updatePresetFile(file: string, content: any, name?: string, description?: string, iconBase64?: string): Promise<any> {
    return postJSON('smarttavern/data_catalog/update_preset_file', { file, content, name, description, icon_base64: iconBase64 })
  },
  updateWorldBookFile(file: string, content: any, name?: string, description?: string, iconBase64?: string): Promise<any> {
    return postJSON('smarttavern/data_catalog/update_world_book_file', { file, content, name, description, icon_base64: iconBase64 })
  },
  updateCharacterFile(file: string, content: any, name?: string, description?: string, iconBase64?: string, avatarBase64?: string): Promise<any> {
    return postJSON('smarttavern/data_catalog/update_character_file', { file, content, name, description, icon_base64: iconBase64, avatar_base64: avatarBase64 })
  },
  updatePersonaFile(file: string, content: any, name?: string, description?: string, iconBase64?: string, avatarBase64?: string): Promise<any> {
    return postJSON('smarttavern/data_catalog/update_persona_file', { file, content, name, description, icon_base64: iconBase64, avatar_base64: avatarBase64 })
  },
  updateRegexRuleFile(file: string, content: any, name?: string, description?: string, iconBase64?: string): Promise<any> {
    return postJSON('smarttavern/data_catalog/update_regex_rule_file', { file, content, name, description, icon_base64: iconBase64 })
  },
  updateLLMConfigFile(file: string, content: any, name?: string, description?: string, iconBase64?: string): Promise<any> {
    return postJSON('smarttavern/data_catalog/update_llm_config_file', { file, content, name, description, icon_base64: iconBase64 })
  },
  updatePluginFile(dir: string, name?: string, description?: string, iconBase64?: string): Promise<any> {
    return postJSON('smarttavern/data_catalog/update_plugin_file', { dir, name, description, icon_base64: iconBase64 })
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
      const name = it.name || file.split('/').pop() || i18n.t('services.dataCatalog.unnamed')
      const desc = it.description || ''
      // 保留原始数据的所有字段（如 type），展开在前面以便后续字段覆盖
      return { ...it, key: file, icon, name, desc, file }
    })
  },
  
  // Asset functions (declared here for TypeScript)
  getPluginsAsset: null as any,
  getPluginsAssetBlob: null as any,
  getDataAsset: null as any,
  getDataAssetBlob: null as any,
  
  // Import/Export functions (declared here for TypeScript)
  importData: null as any,
  importDataFromFile: null as any,
  exportData: null as any,
  exportDataAsBlob: null as any,
  downloadExportedData: null as any,
  getSupportedTypes: null as any,
  checkNameExists: null as any,
  
  // Delete functions (declared here for TypeScript)
  deleteDataFolder: null as any,
  
  // Create functions (declared here for TypeScript)
  createDataFolder: null as any,
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

// ==================== 导入/导出 API ====================

/**
 * 导入数据
 * @param dataType - 数据类型: preset, character, worldbook, persona, regex_rule, llm_config
 * @param fileContentBase64 - Base64 编码的文件内容
 * @param filename - 原始文件名
 * @param targetName - 目标名称（可选）
 * @param overwrite - 是否覆盖已存在的数据
 */
DataCatalog.importData = function (
  dataType: ImportDataType,
  fileContentBase64: string,
  filename: string,
  targetName?: string,
  overwrite: boolean = false
): Promise<ImportDataResponse> {
  return postJSON('smarttavern/data_import/import_data', {
    data_type: dataType,
    file_content_base64: fileContentBase64,
    filename,
    target_name: targetName,
    overwrite,
  })
}

/**
 * 从 File 对象导入数据（便捷方法）
 * @param dataType - 数据类型
 * @param file - File 对象
 * @param targetName - 目标名称（可选）
 * @param overwrite - 是否覆盖
 */
DataCatalog.importDataFromFile = async function (
  dataType: ImportDataType,
  file: File,
  targetName?: string,
  overwrite: boolean = false
): Promise<ImportDataResponse> {
  const base64 = await _fileToBase64(file)
  return DataCatalog.importData(dataType, base64, file.name, targetName, overwrite)
}

/**
 * 导出数据
 * @param folderPath - 要导出的目录路径
 * @param dataType - 数据类型（可选，自动检测）
 * @param embedImageBase64 - 嵌入图片的 Base64（可选，提供则输出 PNG，否则输出 ZIP）
 * @param exportFormat - 导出格式（可选：'zip', 'png', 'json'，默认根据 embedImageBase64 决定）
 */
DataCatalog.exportData = function (
  folderPath: string,
  dataType?: ImportDataType,
  embedImageBase64?: string,
  exportFormat?: 'zip' | 'png' | 'json'
): Promise<ExportDataResponse> {
  return postJSON('smarttavern/data_import/export_data', {
    folder_path: folderPath,
    data_type: dataType,
    embed_image_base64: embedImageBase64,
    export_format: exportFormat,
  })
}

/**
 * 导出数据并返回 Blob
 * @param folderPath - 要导出的目录路径
 * @param dataType - 数据类型（可选）
 * @param embedImageBase64 - 嵌入图片的 Base64（可选）
 * @param exportFormat - 导出格式（可选：'zip', 'png', 'json'）
 */
DataCatalog.exportDataAsBlob = async function (
  folderPath: string,
  dataType?: ImportDataType,
  embedImageBase64?: string,
  exportFormat?: 'zip' | 'png' | 'json'
): Promise<{ blob: Blob; filename: string; mime: string; size: number }> {
  const res = await DataCatalog.exportData(folderPath, dataType, embedImageBase64, exportFormat)
  if (!res.success || !res.content_base64) {
    const err: any = new Error(`[DataCatalog] Export failed: ${res.message || res.error || 'Unknown error'}`)
    err.details = res
    throw err
  }
  const bytes = _b64ToBytes(res.content_base64)
  const mimeMap: Record<string, string> = {
    'png': 'image/png',
    'json': 'application/json',
    'zip': 'application/zip',
  }
  const mime = mimeMap[res.format || 'zip'] || 'application/zip'
  const filename = res.filename || `export.${res.format || 'zip'}`
  return {
    blob: new Blob([bytes.buffer as ArrayBuffer], { type: mime }),
    filename,
    mime,
    size: Number(res.size || bytes.length),
  }
}

/**
 * 导出数据并触发下载
 * @param folderPath - 要导出的目录路径
 * @param dataType - 数据类型（可选）
 * @param embedImageBase64 - 嵌入图片的 Base64（可选）
 * @param exportFormat - 导出格式（可选：'zip', 'png', 'json'）
 */
DataCatalog.downloadExportedData = async function (
  folderPath: string,
  dataType?: ImportDataType,
  embedImageBase64?: string,
  exportFormat?: 'zip' | 'png' | 'json'
): Promise<void> {
  const { blob, filename } = await DataCatalog.exportDataAsBlob(folderPath, dataType, embedImageBase64, exportFormat)
  
  // 创建下载链接
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 获取支持的导入/导出类型
 */
DataCatalog.getSupportedTypes = function (): Promise<SupportedTypesResponse> {
  return postJSON('smarttavern/data_import/get_supported_types', {})
}

/**
 * 检查名称是否已存在
 * @param dataType - 数据类型
 * @param name - 要检查的名称
 */
DataCatalog.checkNameExists = function (
  dataType: ImportDataType,
  name: string
): Promise<CheckNameExistsResponse> {
  return postJSON('smarttavern/data_import/check_name_exists', {
    data_type: dataType,
    name,
  })
}

// ==================== 删除 API ====================

/**
 * 删除数据目录
 * @param folderPath - 要删除的目录路径（POSIX 风格）
 *
 * 仅允许删除以下类型的目录：
 * - 预设 (backend_projects/SmartTavern/data/presets/...)
 * - 世界书 (backend_projects/SmartTavern/data/world_books/...)
 * - 角色卡 (backend_projects/SmartTavern/data/characters/...)
 * - 用户画像 (backend_projects/SmartTavern/data/personas/...)
 * - 正则规则 (backend_projects/SmartTavern/data/regex_rules/...)
 * - LLM配置 (backend_projects/SmartTavern/data/llm_configs/...)
 * - 插件 (backend_projects/SmartTavern/plugins/...)
 */
DataCatalog.deleteDataFolder = function (folderPath: string): Promise<DeleteDataFolderResponse> {
  return postJSON('smarttavern/data_catalog/delete_data_folder', {
    folder_path: folderPath,
  })
}

// ==================== 创建 API ====================

/**
 * 创建新的数据文件夹
 * @param dataType - 数据类型: preset, worldbook, character, persona, regex_rule, llm_config
 * @param name - 名称
 * @param description - 描述
 * @param folderName - 文件夹名称
 * @param iconBase64 - 图标的Base64编码（可选）
 */
DataCatalog.createDataFolder = function (
  dataType: string,
  name: string,
  description: string,
  folderName: string,
  iconBase64?: string | null
): Promise<any> {
  return postJSON('smarttavern/data_catalog/create_data_folder', {
    data_type: dataType,
    name,
    description,
    folder_name: folderName,
    icon_base64: iconBase64 || null,
  })
}

export default DataCatalog