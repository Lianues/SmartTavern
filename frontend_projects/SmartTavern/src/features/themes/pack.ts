// SmartTavern Theme Runtime - Pack helpers (v1)
// 提供 Theme Pack 的类型声明、校验/规范化/合并等工具。
// 安全提示：主题脚本默认不执行；仅处理 tokens 与 CSS。脚本相关字段保留但不启用。

export const PACK_VERSION = 'v1'

// Type definitions
export interface ThemeScriptPermissions {
  dom?: boolean  // 允许访问 DOM（默认 false）
  network?: boolean  // 允许网络请求（默认 false）
}

export interface ThemeScript {
  code: string
  permissions?: ThemeScriptPermissions
  scopes?: string[]  // 适用范围（如 'chat-threaded', 'sandbox'）
}

// CSS 自定义属性（--xxx）字典；值推荐字符串（可为 rgb/rgb(...) / 数字/px/% 等）
// 例如：{ "--st-primary": "56 189 248", "--st-card-radius": "8px" }
export type ThemeTokens = Record<string, string | number>

export interface ThemePackV1 {
  id?: string | null
  name?: string | null
  version?: string | null
  tokens?: ThemeTokens
  tokensLight?: ThemeTokens  // Light mode specific tokens
  tokensDark?: ThemeTokens   // Dark mode specific tokens
  css?: string  // 附加 CSS 文本
  cssLight?: string  // Light mode specific CSS
  cssDark?: string   // Dark mode specific CSS
  script?: ThemeScript  // 保留字段（默认不执行）
}

export interface ThemeApplyOptions {
  persist?: boolean  // 应用后是否持久化 (default: true)
  allowScript?: boolean  // 是否允许脚本（default: false）
}

function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * 规范化 ThemePack（移除不支持字段、修正类型）
 */
export function normalizePack(input: any): ThemePackV1 {
  const p = isPlainObject(input) ? input : {}
  const out: ThemePackV1 = {
    id: typeof p.id === 'string' ? p.id : (p.id == null ? null : String(p.id)),
    name: typeof p.name === 'string' ? p.name : (p.name == null ? null : String(p.name)),
    version: typeof p.version === 'string' ? p.version : (p.version == null ? null : String(p.version)),
    tokens: undefined,
    tokensLight: undefined,
    tokensDark: undefined,
    css: typeof p.css === 'string' ? p.css : undefined,
    cssLight: typeof p.cssLight === 'string' ? p.cssLight : undefined,
    cssDark: typeof p.cssDark === 'string' ? p.cssDark : undefined,
    script: undefined,
  }
  
  // Process base tokens
  if (isPlainObject(p.tokens)) {
    out.tokens = {}
    for (const [k, v] of Object.entries(p.tokens)) {
      if (typeof k === 'string' && k.startsWith('--')) {
        out.tokens[k] = (typeof v === 'number' || typeof v === 'string') ? v : String(v)
      }
    }
    if (Object.keys(out.tokens).length === 0) delete out.tokens
  }
  
  // Process light mode tokens
  if (isPlainObject(p.tokensLight)) {
    out.tokensLight = {}
    for (const [k, v] of Object.entries(p.tokensLight)) {
      if (typeof k === 'string' && k.startsWith('--')) {
        out.tokensLight[k] = (typeof v === 'number' || typeof v === 'string') ? v : String(v)
      }
    }
    if (Object.keys(out.tokensLight).length === 0) delete out.tokensLight
  }
  
  // Process dark mode tokens
  if (isPlainObject(p.tokensDark)) {
    out.tokensDark = {}
    for (const [k, v] of Object.entries(p.tokensDark)) {
      if (typeof k === 'string' && k.startsWith('--')) {
        out.tokensDark[k] = (typeof v === 'number' || typeof v === 'string') ? v : String(v)
      }
    }
    if (Object.keys(out.tokensDark).length === 0) delete out.tokensDark
  }
  
  if (isPlainObject(p.script)) {
    out.script = {
      code: typeof p.script.code === 'string' ? p.script.code : '',
      permissions: isPlainObject(p.script.permissions)
        ? {
            dom: !!p.script.permissions.dom,
            network: !!p.script.permissions.network,
          }
        : { dom: false, network: false },
      scopes: Array.isArray(p.script.scopes) ? p.script.scopes.filter(s => typeof s === 'string') : undefined,
    }
    // 注：脚本默认不执行，具体由上层管理器控制 allowScript 开关
  }
  return out
}

/**
 * 校验 ThemePack 内容合法性（非严格）
 */
export function validatePack(pack: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const p = normalizePack(pack)
  if (p.tokens) {
    for (const k of Object.keys(p.tokens)) {
      if (!k.startsWith('--')) errors.push(`Token key must start with "--": ${k}`)
    }
  }
  if (p.css && typeof p.css !== 'string') {
    errors.push('css must be a string')
  }
  // 脚本校验（仅字段形态）
  if (p.script) {
    if (typeof p.script.code !== 'string') errors.push('script.code must be string')
    if (p.script.permissions && typeof p.script.permissions !== 'object') {
      errors.push('script.permissions must be object')
    }
    if (p.script.scopes && !Array.isArray(p.script.scopes)) {
      errors.push('script.scopes must be string[]')
    }
  }
  return { valid: errors.length === 0, errors }
}

/**
 * 合并 tokens（后者覆盖前者）
 */
export function mergeTokens(base: ThemeTokens | undefined, overrides: ThemeTokens | undefined): ThemeTokens | undefined {
  if (!base && !overrides) return undefined
  const out: ThemeTokens = { ...(base || {}) }
  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      if (typeof k === 'string' && k.startsWith('--')) out[k] = v
    }
  }
  return out
}

/**
 * 快速创建 ThemePack
 */
export function createPack(spec: Partial<ThemePackV1> = {}): ThemePackV1 {
  const p = normalizePack(spec || {})
  return p
}

/**
 * 从 JSON 文本解析 ThemePack（安全模式）
 */
export function parsePackFromJSON(text: string): ThemePackV1 | null {
  try {
    const obj = JSON.parse(text)
    return normalizePack(obj)
  } catch (_) {
    return null
  }
}

/**
 * 将 ThemePack 序列化为 JSON（紧凑或美化）
 */
export function stringifyPack(pack: ThemePackV1, pretty: boolean = false): string {
  const n = normalizePack(pack)
  return JSON.stringify(n, null, pretty ? 2 : 0)
}