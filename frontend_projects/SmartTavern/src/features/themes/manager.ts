// SmartTavern Theme Runtime - Manager (v1)
// 作用：
// - 负责主题运行时初始化（恢复本地持久化主题、解析 URL 主题参数）
// - 汇总公共 API（应用/重置/导入），并桥接到 ThemeStore
// - 保留脚本执行扩展位（默认禁用，安全优先）
// - 在 window.STTheme 挂载调试入口（可选）
//
// 依赖：./store.ts（已实现 tokens/CSS 注入与本地持久化）
//
// URL 参数约定（仅供开发/演示使用）：
// - ?themeUrl=<绝对或相对URL>         远程拉取 JSON 主题包并应用
// - ?themeData=<base64的JSON字符串>    直接携带 JSON 主题包并应用
// - ?themePersist=0/1                  是否持久化（默认 1）

import ThemeStore from '@/features/themes/store'
import type { ThemePackV1, ThemeApplyOptions } from '@/features/themes/pack'

const PARAM_URL = 'themeUrl'
const PARAM_DATA = 'themeData'
const PARAM_PERSIST = 'themePersist'

// Type definitions
interface ThemeExtension {
  id: string
  enabled?: boolean
  priority?: number
  scopes?: string[]
  applyAppearance?: (snapshot: Record<string, any>) => void
}

interface ThemeManagerInitOptions {
  exposeToWindow?: boolean
}

type EventCallback = (payload?: any) => void

/* Theme extension registry (v1, optional; no script execution) */
const __extensions = new Map<string, ThemeExtension>()

/**
 * Register a theme extension. Returns disposer function.
 */
function registerExtension(ext: ThemeExtension): () => void {
  if (!ext || typeof ext.id !== 'string' || !ext.id) {
    throw new Error('[ThemeManager] extension.id required')
  }
  __extensions.set(ext.id, { ...ext })
  return () => unregisterExtension(ext.id)
}

function unregisterExtension(id: string): void {
  try { __extensions.delete(id) } catch (_) {}
}

function getExtensions(): ThemeExtension[] {
  return Array.from(__extensions.values())
}

/**
 * Broadcast current Appearance snapshot to all registered extensions.
 * The snapshot is a plain object; extensions may selectively consume fields.
 */
function applyAppearanceSnapshot(snapshot: Record<string, any>): void {
  for (const ext of __extensions.values()) {
    try {
      if (ext && ext.enabled !== false && typeof ext.applyAppearance === 'function') {
        ext.applyAppearance(snapshot)
      }
    } catch (e) {
      console.warn('[ThemeManager] extension.applyAppearance error:', e)
    }
  }
}

function isObject(v: any): v is Record<string, any> {
  return v && typeof v === 'object' && !Array.isArray(v)
}

function base64Decode(str: string): string {
  try {
    // 兼容 URL 安全 base64（- _）
    const normalized = str.replace(/-/g, '+').replace(/_/g, '/')
    // atob 在非 ASCII 时需转码
    const bin = atob(normalized)
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
    const decoder = new TextDecoder('utf-8')
    return decoder.decode(bytes)
  } catch (e) {
    console.warn('[ThemeManager] base64Decode failed:', e)
    return ''
  }
}

function parseJson(text: string): any {
  try { return JSON.parse(text) } catch (e) {
    console.warn('[ThemeManager] JSON parse failed:', e)
    return null
  }
}

// 规范化主题包：去除不支持的字段，保证 tokens/css 类型
function normalizePack(input: any): ThemePackV1 {
  const p = isObject(input) ? { ...input } : {}
  // 仅保留已知字段
  const out: ThemePackV1 = {
    id: p.id ?? null,
    name: p.name ?? null,
    version: p.version ?? null,
    tokens: isObject(p.tokens) ? { ...p.tokens } : undefined,
    tokensLight: isObject(p.tokensLight) ? { ...p.tokensLight } : undefined,
    tokensDark: isObject(p.tokensDark) ? { ...p.tokensDark } : undefined,
    css: typeof p.css === 'string' ? p.css : undefined,
    cssLight: typeof p.cssLight === 'string' ? p.cssLight : undefined,
    cssDark: typeof p.cssDark === 'string' ? p.cssDark : undefined,
  }
  
  // Process script with proper type checking
  if (isObject(p.script)) {
    out.script = {
      code: typeof p.script.code === 'string' ? p.script.code : '',
      permissions: isObject(p.script.permissions)
        ? {
            dom: !!p.script.permissions.dom,
            network: !!p.script.permissions.network,
          }
        : undefined,
      scopes: Array.isArray(p.script.scopes) ? p.script.scopes.filter((s: any) => typeof s === 'string') : undefined,
    }
  }
  
  return out
}

async function fetchJson(url: string): Promise<any> {
  try {
    const res = await fetch(url, { credentials: 'omit', mode: 'cors' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data
  } catch (e) {
    console.warn('[ThemeManager] fetchJson failed:', e)
    return null
  }
}

// 从 URL 参数加载主题（若存在）
async function maybeApplyFromURL(): Promise<boolean> {
  const u = new URL(window.location.href)
  const persistParam = u.searchParams.get(PARAM_PERSIST)
  const persist = persistParam == null ? true : persistParam !== '0'

  const dataBase64 = u.searchParams.get(PARAM_DATA)
  if (dataBase64) {
    const jsonText = base64Decode(dataBase64)
    const obj = parseJson(jsonText)
    if (obj) {
      const pack = normalizePack(obj)
      await ThemeStore.applyThemePack(pack, { persist, allowScript: false })
      console.info('[ThemeManager] Applied theme from URL themeData.')
      return true
    }
  }

  const urlParam = u.searchParams.get(PARAM_URL)
  if (urlParam) {
    // 支持相对路径（相对当前 origin/path）
    const absUrl = new URL(urlParam, window.location.href).toString()
    const obj = await fetchJson(absUrl)
    if (obj) {
      const pack = normalizePack(obj)
      await ThemeStore.applyThemePack(pack, { persist, allowScript: false })
      console.info('[ThemeManager] Applied theme from URL themeUrl.')
      return true
    }
  }

  return false
}

// 对外 API

/**
 * 初始化主题运行时：
 * - 恢复本地持久化主题
 * - 解析并应用 URL 主题（若存在）
 * - 挂载 window.STTheme（可选）
 */
async function init(options: ThemeManagerInitOptions = {}): Promise<any> {
  const { exposeToWindow = true } = options
  await ThemeStore.init()
  // 若 URL 指定主题，覆盖持久化主题
  await maybeApplyFromURL()

  if (exposeToWindow && typeof window !== 'undefined') {
    // 提供调试入口（在控制台可用）
    ;(window as any).STTheme = {
      applyThemePack,
      resetTheme,
      importFromText,
      importFromFile,
      get: ThemeStore.getCurrentTheme,
      store: ThemeStore,
      version: ThemeStore.getVersion(),
    }
  }
  return ThemeStore.getState()
}

/**
 * 直接应用主题包对象
 */
async function applyThemePack(pack: ThemePackV1, options: ThemeApplyOptions = {}): Promise<ThemePackV1 | null> {
  const safe = normalizePack(pack)
  const { persist = true, allowScript = false } = options
  // 安全：默认不执行脚本
  return ThemeStore.applyThemePack(safe, { persist, allowScript: !!allowScript && false })
}

/**
 * 重置主题（移除 CSS，清空持久化）
 */
async function resetTheme(options: { persist?: boolean } = {}): Promise<void> {
  return ThemeStore.resetTheme(options)
}

/**
 * 从 JSON 文本导入并应用
 */
async function importFromText(text: string, options: ThemeApplyOptions = {}): Promise<ThemePackV1 | null> {
  const obj = parseJson(text)
  if (!obj) throw new Error('Invalid JSON')
  return applyThemePack(obj, options)
}

/**
 * 从文件导入并应用（.json 或 .sttheme.json）
 */
async function importFromFile(file: File, options: ThemeApplyOptions = {}): Promise<ThemePackV1 | null> {
  if (!file) throw new Error('No file')
  const text = await file.text()
  return importFromText(text, options)
}

// 事件透传
function on(event: string, cb: EventCallback): () => void { return ThemeStore.on(event, cb) }
function off(event: string, cb: EventCallback): void { return ThemeStore.off(event, cb) }

// Color mode control (system/light/dark) forwarded to store
function setColorMode(mode: 'system' | 'light' | 'dark'): void {
  try { ThemeStore?.setColorMode?.(mode) } catch (_) {}
}

const ThemeManager = {
  init,
  applyThemePack,
  resetTheme,
  importFromText,
  importFromFile,
  on,
  off,
  // Extensions API (beautification hooks)
  registerExtension,
  unregisterExtension,
  getExtensions,
  applyAppearanceSnapshot,
  // Query
  getCurrentTheme: ThemeStore.getCurrentTheme,
  getState: ThemeStore.getState,
  getVersion: ThemeStore.getVersion,
  // expose underlying store for advanced usages (e.g., setToken)
  store: ThemeStore,
  // Color mode control
  setColorMode,
}

export default ThemeManager