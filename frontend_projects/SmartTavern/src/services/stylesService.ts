/**
 * SmartTavern Frontend API Client — Styles/Themes Service (v1)
 * 
 * 调用后端主题 API 来列出/加载/删除主题。
 * 
 * 用法:
 *   import StylesService from '@/services/stylesService'
 *   const themes = await StylesService.listThemes()
 *   const themePack = await StylesService.getThemeEntries('backend_projects/SmartTavern/styles/demo-ocean.sttheme')
 */

// 类型定义
export interface ThemeItem {
  dir: string
  name: string | null
  description: string | null
  entries: string[]
  enabled: boolean
  icon: string | null
}

export interface ThemeListResponse {
  folder: string
  total: number
  items: ThemeItem[]
  errors?: Array<{ file: string | null; error: string }>
}

export interface StylesSwitchResponse {
  file: string
  enabled: string[] | null
  disabled: string[] | null
  order: string[] | null
  error?: string
  message?: string
}

export interface ThemeDetailResponse {
  dir: string
  name: string | null
  description: string | null
  entries: string[]
  manifest: Record<string, any>
  error?: string
  message?: string
}

export interface ThemePackV1 {
  id?: string | null
  name?: string | null
  version?: string | null
  tokens?: Record<string, string | number>
  tokensLight?: Record<string, string | number>
  tokensDark?: Record<string, string | number>
  css?: string
  cssLight?: string
  cssDark?: string
}

export interface ThemeEntriesResponse {
  dir: string
  name: string | null
  merged_pack: ThemePackV1
  entries: Array<{ file: string; content: Record<string, any> }>
  errors?: Array<{ file: string; error: string }>
  error?: string
  message?: string
}

export interface ThemeAssetResponse {
  file: string
  mime: string
  size: number
  content_base64: string
  error?: string
  message?: string
}

export interface DeleteThemeResponse {
  success: boolean
  deleted_path?: string
  error?: string
  message?: string
}

export interface AllEnabledThemesResponse {
  enabled_count: number
  enabled_themes: string[]
  merged_pack: ThemePackV1 | null
}

// 页面背景图片相关类型
export interface PageBackgroundHashesResponse {
  landscape?: Record<string, string | null>
  portrait?: Record<string, string | null>
  combined_hash?: string | null
}

export interface PageBackgroundResponse {
  page: string
  orientation: string
  file: string
  hash: string
  mime: string
  size: number
  content_base64: string
  error?: string
  message?: string
}

export interface PageBackgroundsListResponse {
  images_dir: string
  landscape: Record<string, { file: string; hash: string | null; size: number } | null>
  portrait: Record<string, { file: string; hash: string | null; size: number } | null>
}

// 导入/导出相关类型
export interface ImportStyleResponse {
  success: boolean
  message?: string
  error?: string
  data_type?: string
  name?: string
  folder?: string
  file?: string
  extra_files?: string[]
  registered?: boolean
  register_warning?: string
  folder_name?: string
  suggested_name?: string
  expected_type?: string
  actual_type?: string
}

export interface ExportStyleResponse {
  success: boolean
  message?: string
  error?: string
  data_type?: string
  name?: string
  format?: 'zip' | 'png' | 'json'
  filename?: string
  content_base64?: string
  size?: number
}

// 扩展 ImportMeta 接口
declare global {
  interface Window { ST_BACKEND_BASE?: string }
  interface ImportMetaEnv { VITE_API_BASE?: string }
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
  return `${getBackendBase()}/api/modules`.replace(/\/+$/, '')
}

async function postJSON<T = any>(path: string, body: any = {}): Promise<T> {
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
    const err: any = new Error(`[StylesService] Network error: ${networkError?.message || networkError}`)
    err.cause = networkError
    err.url = url
    throw err
  }

  let data: any = null
  const text = await resp.text().catch(() => '')
  try {
    data = text ? JSON.parse(text) : null
  } catch (parseError: any) {
    const err: any = new Error(`[StylesService] Invalid JSON response (${resp.status}): ${text?.slice(0, 200)}`)
    err.cause = parseError
    err.status = resp.status
    err.url = url
    throw err
  }

  if (!resp.ok) {
    const err: any = new Error(`[StylesService] HTTP ${resp.status}: ${data && (data.message || data.error) || 'Unknown error'}`)
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

// 主题服务 API
const StylesService = {
  /**
   * 列出所有主题
   */
  listThemes(): Promise<ThemeListResponse> {
    return postJSON<ThemeListResponse>('smarttavern/styles/list_themes', {})
  },

  /**
   * 获取主题开关文件
   */
  getStylesSwitch(): Promise<StylesSwitchResponse> {
    return postJSON<StylesSwitchResponse>('smarttavern/styles/get_styles_switch', {})
  },

  /**
   * 更新主题开关文件
   * @param content - { enabled: string[], disabled?: string[], order?: string[] }
   */
  updateStylesSwitch(content: { enabled: string[]; disabled?: string[]; order?: string[] }): Promise<StylesSwitchResponse> {
    return postJSON<StylesSwitchResponse>('smarttavern/styles/update_styles_switch', { content })
  },

  /**
   * 更新主题排序
   * @param order - 主题目录名称数组（按优先级排序，靠前的优先级更高）
   */
  async updateThemesOrder(order: string[]): Promise<StylesSwitchResponse> {
    // 获取当前开关状态
    const current = await this.getStylesSwitch()
    const enabledList = Array.isArray(current.enabled) ? [...current.enabled] : []
    const disabledList = Array.isArray(current.disabled) ? [...current.disabled] : []
    
    return this.updateStylesSwitch({ enabled: enabledList, disabled: disabledList, order })
  },

  /**
   * 获取主题详情（manifest.json 内容）
   * @param themeDir - 主题目录路径
   */
  getThemeDetail(themeDir: string): Promise<ThemeDetailResponse> {
    return postJSON<ThemeDetailResponse>('smarttavern/styles/get_theme_detail', { theme_dir: themeDir })
  },

  /**
   * 获取主题入口文件内容（合并后的 ThemePackV1）
   * @param themeDir - 主题目录路径
   */
  getThemeEntries(themeDir: string): Promise<ThemeEntriesResponse> {
    return postJSON<ThemeEntriesResponse>('smarttavern/styles/get_theme_entries', { theme_dir: themeDir })
  },

  /**
   * 获取主题资产（二进制文件）
   * @param file - 文件路径
   */
  getThemeAsset(file: string): Promise<ThemeAssetResponse> {
    return postJSON<ThemeAssetResponse>('smarttavern/styles/get_theme_asset', { file })
  },

  /**
   * 获取主题资产为 Blob
   * @param file - 文件路径
   */
  async getThemeAssetBlob(file: string): Promise<{ blob: Blob; mime: string; size: number }> {
    const res = await this.getThemeAsset(file)
    if (!res || !res.content_base64) {
      const err: any = new Error(`[StylesService] no asset content: ${file}`)
      err.details = res
      throw err
    }
    const bytes = _b64ToBytes(res.content_base64)
    const mime = String(res.mime || 'application/octet-stream')
    return {
      blob: new Blob([bytes.buffer as ArrayBuffer], { type: mime }),
      mime,
      size: Number(res.size || bytes.length)
    }
  },

  /**
   * 删除主题
   * @param themeDir - 主题目录路径
   */
  deleteTheme(themeDir: string): Promise<DeleteThemeResponse> {
    return postJSON<DeleteThemeResponse>('smarttavern/styles/delete_theme', { theme_dir: themeDir })
  },

  /**
   * 获取所有启用主题的合并包
   * 按 order 顺序合并，顺序靠前的优先级更高
   */
  getAllEnabledThemes(): Promise<AllEnabledThemesResponse> {
    return postJSON<AllEnabledThemesResponse>('smarttavern/styles/get_all_enabled_themes', {})
  },

  /**
   * 启用/禁用指定主题（支持多主题同时启用）
   * @param themeDir - 主题目录路径
   * @param enabled - 是否启用
   */
  async setThemeEnabled(themeDir: string, enabled: boolean): Promise<StylesSwitchResponse> {
    // 获取当前开关状态
    const current = await this.getStylesSwitch()
    const enabledList = Array.isArray(current.enabled) ? [...current.enabled] : []
    const disabledList = Array.isArray(current.disabled) ? [...current.disabled] : []
    
    // 提取主题目录名
    const themeName = themeDir.split('/').pop() || themeDir
    
    if (enabled) {
      // 启用：从 disabled 移除，添加到 enabled（支持多主题同时启用）
      const disabledIdx = disabledList.indexOf(themeName)
      if (disabledIdx >= 0) disabledList.splice(disabledIdx, 1)
      if (!enabledList.includes(themeName)) enabledList.push(themeName)
    } else {
      // 禁用：从 enabled 移除，添加到 disabled
      const enabledIdx = enabledList.indexOf(themeName)
      if (enabledIdx >= 0) enabledList.splice(enabledIdx, 1)
      if (!disabledList.includes(themeName)) disabledList.push(themeName)
    }
    
    return this.updateStylesSwitch({ enabled: enabledList, disabled: disabledList })
  },

  // ==================== 导入/导出 API ====================

  /**
   * 导入主题
   * @param fileContentBase64 - Base64 编码的文件内容
   * @param filename - 原始文件名
   * @param targetName - 目标名称（可选）
   * @param overwrite - 是否覆盖已存在的数据
   */
  importStyle(
    fileContentBase64: string,
    filename: string,
    targetName?: string,
    overwrite: boolean = false
  ): Promise<ImportStyleResponse> {
    return postJSON<ImportStyleResponse>('smarttavern/data_import/import_data', {
      data_type: 'style',
      file_content_base64: fileContentBase64,
      filename,
      target_name: targetName,
      overwrite,
    })
  },

  /**
   * 从 File 对象导入主题（便捷方法）
   * @param file - File 对象
   * @param targetName - 目标名称（可选）
   * @param overwrite - 是否覆盖
   */
  async importStyleFromFile(
    file: File,
    targetName?: string,
    overwrite: boolean = false
  ): Promise<ImportStyleResponse> {
    const base64 = await _fileToBase64(file)
    return this.importStyle(base64, file.name, targetName, overwrite)
  },

  /**
   * 导出主题
   * @param folderPath - 要导出的目录路径
   * @param embedImageBase64 - 嵌入图片的 Base64（可选）
   * @param exportFormat - 导出格式（可选：'zip', 'png'）
   */
  exportStyle(
    folderPath: string,
    embedImageBase64?: string,
    exportFormat?: 'zip' | 'png'
  ): Promise<ExportStyleResponse> {
    return postJSON<ExportStyleResponse>('smarttavern/data_import/export_data', {
      folder_path: folderPath,
      data_type: 'style',
      embed_image_base64: embedImageBase64,
      export_format: exportFormat,
    })
  },

  /**
   * 导出主题并返回 Blob
   * @param folderPath - 要导出的目录路径
   * @param embedImageBase64 - 嵌入图片的 Base64（可选）
   * @param exportFormat - 导出格式（可选：'zip', 'png'）
   */
  async exportStyleAsBlob(
    folderPath: string,
    embedImageBase64?: string,
    exportFormat?: 'zip' | 'png'
  ): Promise<{ blob: Blob; filename: string; mime: string; size: number }> {
    const res = await this.exportStyle(folderPath, embedImageBase64, exportFormat)
    if (!res.success || !res.content_base64) {
      const err: any = new Error(`[StylesService] Export failed: ${res.message || res.error || 'Unknown error'}`)
      err.details = res
      throw err
    }
    const bytes = _b64ToBytes(res.content_base64)
    const mimeMap: Record<string, string> = {
      'png': 'image/png',
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
  },

  /**
   * 导出主题并触发下载
   * @param folderPath - 要导出的目录路径
   * @param embedImageBase64 - 嵌入图片的 Base64（可选）
   * @param exportFormat - 导出格式（可选：'zip', 'png'）
   */
  async downloadExportedStyle(
    folderPath: string,
    embedImageBase64?: string,
    exportFormat?: 'zip' | 'png'
  ): Promise<void> {
    const { blob, filename } = await this.exportStyleAsBlob(folderPath, embedImageBase64, exportFormat)
    
    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  /**
   * 更新主题 manifest.json 文件
   * @param themeDir - 主题目录路径
   * @param payload - 包含 name 和/或 description 的对象
   */
  updateThemeFile(
    themeDir: string,
    payload: { name?: string; description?: string }
  ): Promise<ThemeDetailResponse> {
    return postJSON<ThemeDetailResponse>('smarttavern/styles/update_theme_file', {
      theme_dir: themeDir,
      payload,
    })
  },

  // ==================== 页面背景图片 API ====================

  /**
   * 获取页面背景图片的哈希值（用于缓存验证）
   * @param orientation - 方向：'landscape'（横版）或 'portrait'（竖版）
   */
  getPageBackgroundsHash(orientation?: 'landscape' | 'portrait'): Promise<PageBackgroundHashesResponse> {
    return postJSON<PageBackgroundHashesResponse>('smarttavern/styles/get_page_backgrounds_hash', {
      orientation,
    })
  },

  /**
   * 获取指定页面的背景图片
   * @param page - 页面名称：'HomePage', 'ThreadedChat', 'SandboxChat'
   * @param orientation - 方向：'landscape' 或 'portrait'
   */
  getPageBackground(page: string, orientation: 'landscape' | 'portrait' = 'landscape'): Promise<PageBackgroundResponse> {
    return postJSON<PageBackgroundResponse>('smarttavern/styles/get_page_background', {
      page,
      orientation,
    })
  },

  /**
   * 获取页面背景图片为 Blob
   * @param page - 页面名称
   * @param orientation - 方向
   */
  async getPageBackgroundBlob(
    page: string,
    orientation: 'landscape' | 'portrait' = 'landscape'
  ): Promise<{ blob: Blob; mime: string; size: number; hash: string }> {
    const res = await this.getPageBackground(page, orientation)
    if (res.error || !res.content_base64) {
      const err: any = new Error(`[StylesService] Failed to get page background: ${res.message || res.error || 'Unknown'}`)
      err.details = res
      throw err
    }
    const bytes = _b64ToBytes(res.content_base64)
    const mime = String(res.mime || 'image/png')
    return {
      blob: new Blob([bytes.buffer as ArrayBuffer], { type: mime }),
      mime,
      size: Number(res.size || bytes.length),
      hash: res.hash,
    }
  },

  /**
   * 列出所有可用的页面背景图片
   */
  listPageBackgrounds(): Promise<PageBackgroundsListResponse> {
    return postJSON<PageBackgroundsListResponse>('smarttavern/styles/list_page_backgrounds', {})
  },

  /**
   * 上传/更新页面背景图片
   * @param page - 页面名称
   * @param orientation - 方向
   * @param imageBase64 - Base64 编码的图片内容
   */
  uploadPageBackground(
    page: string,
    orientation: 'landscape' | 'portrait',
    imageBase64: string
  ): Promise<{ success: boolean; page: string; orientation: string; file: string; hash: string; size: number; message: string; error?: string }> {
    return postJSON('smarttavern/styles/upload_page_background', {
      page,
      orientation,
      image_base64: imageBase64,
    })
  },

  /**
   * 从 File 对象上传页面背景图片（便捷方法）
   * @param page - 页面名称
   * @param orientation - 方向
   * @param file - File 对象
   */
  async uploadPageBackgroundFromFile(
    page: string,
    orientation: 'landscape' | 'portrait',
    file: File
  ): Promise<{ success: boolean; page: string; orientation: string; file: string; hash: string; size: number; message: string; error?: string }> {
    const base64 = await _fileToBase64(file)
    return this.uploadPageBackground(page, orientation, base64)
  },
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

export default StylesService