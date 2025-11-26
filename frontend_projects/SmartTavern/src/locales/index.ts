/**
 * SmartTavern 国际化（i18n）系统
 * 
 * 功能特性：
 * - 内置简体中文（zh-CN）语言包
 * - 支持插件动态注册语言包
 * - 支持语言包热替换和合并
 * - 支持嵌套键路径访问
 * - 支持带参数的翻译
 * 
 * 目录结构：
 * - locales/
 *   - index.ts          - 入口文件，导出 i18n 服务
 *   - zh-CN.ts          - 简体中文语言包（内置）
 * 
 * 插件语言包：
 * - 插件可以通过 registerLocale() 注册新语言
 * - 插件可以通过 mergeMessages() 扩展现有语言
 * - 插件目录: backend_projects/SmartTavern/plugins/<plugin-name>/
 * 
 * 使用方法：
 * 1. 在组件中导入 useI18n composable
 *    import { useI18n } from '@/locales'
 *    const { t } = useI18n()
 * 
 * 2. 使用 t 函数获取翻译文本
 *    t('common.import')  // => "导入"
 *    t('panel.presets.title')  // => "预设 Presets"
 * 
 * 3. 支持带参数的翻译
 *    t('common.loadFailed', { error: '网络错误' })  // => "加载失败：网络错误"
 * 
 * 4. 插件注册新语言
 *    i18n.registerLocale('ja-JP', jaMessages, { name: '日本語', nativeName: '日本語' })
 * 
 * 5. 插件扩展现有语言
 *    i18n.mergeMessages('zh-CN', { plugin: { myKey: '我的文本' } })
 */

import { ref, computed } from 'vue'
import zhCN from './zh-CN'
import enUS from './en-US'

// ==================== 类型定义 ====================

/** 支持的语言代码 */
export type LocaleCode = string

/** 语言包消息类型（支持嵌套对象） */
export type LocaleMessages = Record<string, any>

/** 语言元信息 */
export interface LocaleMeta {
  /** 语言名称（英文） */
  name: string
  /** 语言原生名称 */
  nativeName: string
  /** 语言方向（默认 ltr） */
  direction?: 'ltr' | 'rtl'
  /** 来源：内置或插件名 */
  source?: 'builtin' | string
}

/** 已注册的语言信息 */
export interface RegisteredLocale {
  code: LocaleCode
  messages: LocaleMessages
  meta: LocaleMeta
}

// ==================== 内置语言 ====================

/** 内置支持的语言列表 */
const BUILTIN_LOCALES: LocaleCode[] = ['zh-CN', 'en-US']

/** 语言包存储 */
const localeMessages = new Map<LocaleCode, LocaleMessages>()

/** 语言元信息存储 */
const localeMetas = new Map<LocaleCode, LocaleMeta>()

// 注册内置中文
localeMessages.set('zh-CN', zhCN)
localeMetas.set('zh-CN', {
  name: 'Chinese (Simplified)',
  nativeName: '简体中文',
  direction: 'ltr',
  source: 'builtin'
})

// 注册内置英文
localeMessages.set('en-US', enUS)
localeMetas.set('en-US', {
  name: 'English',
  nativeName: 'English',
  direction: 'ltr',
  source: 'builtin'
})

// ==================== 响应式状态 ====================

/** 当前语言 */
const currentLocale = ref<LocaleCode>('zh-CN')

/** 已注册的语言代码列表（响应式） */
const registeredLocales = ref<LocaleCode[]>([...BUILTIN_LOCALES])

// ==================== 工具函数 ====================

/**
 * 深度合并对象
 */
function deepMerge(target: any, source: any): any {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

/**
 * 获取嵌套对象的值
 */
function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.')
  let result = obj
  for (const key of keys) {
    if (result === undefined || result === null) return undefined
    result = result[key]
  }
  return typeof result === 'string' ? result : undefined
}

// ==================== 核心功能 ====================

/**
 * 翻译函数
 * @param key 翻译键（支持点号分隔的嵌套路径）
 * @param params 替换参数
 * @returns 翻译后的文本
 */
function translate(key: string, params?: Record<string, string | number>): string {
  const messages = localeMessages.get(currentLocale.value)
  let text = messages ? getNestedValue(messages, key) : undefined
  
  // 如果当前语言没找到，尝试使用中文作为 fallback
  if (text === undefined && currentLocale.value !== 'zh-CN') {
    const fallback = localeMessages.get('zh-CN')
    text = fallback ? getNestedValue(fallback, key) : undefined
  }
  
  // 如果还是没找到，返回 key 本身
  if (text === undefined) {
    console.warn(`[i18n] Missing translation for key: ${key}`)
    return key
  }
  
  // 替换参数 {param}
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  
  return text
}

/**
 * 设置当前语言
 */
function setLocale(locale: LocaleCode): boolean {
  if (!localeMessages.has(locale)) {
    console.warn(`[i18n] Locale not registered: ${locale}`)
    return false
  }
  
  currentLocale.value = locale
  
  // 保存到 localStorage
  try {
    localStorage.setItem('st:locale', locale)
  } catch (e) {
    console.warn('[i18n] Failed to save locale to localStorage:', e)
  }
  
  // 更新 HTML lang 属性
  document.documentElement.lang = locale
  
  // 更新文字方向
  const meta = localeMetas.get(locale)
  document.documentElement.dir = meta?.direction || 'ltr'
  
  console.log(`[i18n] Locale changed to: ${locale}`)
  return true
}

/**
 * 获取当前语言
 */
function getLocale(): LocaleCode {
  return currentLocale.value
}

/**
 * 获取所有已注册的语言列表
 */
function getAvailableLocales(): RegisteredLocale[] {
  return Array.from(localeMessages.entries()).map(([code, messages]) => ({
    code,
    messages,
    meta: localeMetas.get(code) || { name: code, nativeName: code }
  }))
}

// ==================== 插件接口 ====================

/**
 * 注册新语言（供插件使用）
 * @param code 语言代码（如 'ja-JP'）
 * @param messages 语言包内容
 * @param meta 语言元信息
 * @returns 是否注册成功
 *
 * 注意：内置语言（zh-CN, en-US）不允许被覆盖
 */
function registerLocale(
  code: LocaleCode,
  messages: LocaleMessages,
  meta: Partial<LocaleMeta> & { name: string; nativeName: string }
): boolean {
  try {
    // 检查是否是内置语言，内置语言不允许被覆盖
    if (BUILTIN_LOCALES.includes(code)) {
      console.warn(`[i18n] Cannot register builtin locale: ${code}. Builtin locales cannot be overridden by plugins.`)
      return false
    }
    
    // 检查是否已存在（非内置）
    if (localeMessages.has(code)) {
      console.warn(`[i18n] Locale already registered: ${code}, use mergeMessages() to extend it`)
      return false
    }
    
    // 注册语言包
    localeMessages.set(code, messages)
    localeMetas.set(code, {
      direction: 'ltr',
      source: 'plugin',
      ...meta
    })
    
    // 更新响应式列表
    if (!registeredLocales.value.includes(code)) {
      registeredLocales.value = [...registeredLocales.value, code]
    }
    
    console.log(`[i18n] Registered new locale: ${code} (${meta.nativeName})`)
    return true
  } catch (e) {
    console.error(`[i18n] Failed to register locale ${code}:`, e)
    return false
  }
}

/**
 * 合并/扩展现有语言的消息（供插件使用）
 * @param code 语言代码
 * @param messages 要合并的消息
 * @param source 来源标识（插件名）
 * @returns 是否合并成功
 *
 * 注意：对于内置语言，只能添加新键，不会覆盖已有键
 */
function mergeMessages(
  code: LocaleCode,
  messages: LocaleMessages,
  source?: string
): boolean {
  try {
    const existing = localeMessages.get(code)
    if (!existing) {
      console.warn(`[i18n] Cannot merge: locale not found: ${code}`)
      return false
    }
    
    // 对于内置语言，使用安全合并（不覆盖已有键）
    const isBuiltin = BUILTIN_LOCALES.includes(code)
    const merged = isBuiltin ? safeMerge(existing, messages) : deepMerge(existing, messages)
    localeMessages.set(code, merged)
    
    console.log(`[i18n] Merged messages into ${code}${source ? ` (from ${source})` : ''}${isBuiltin ? ' (builtin: existing keys preserved)' : ''}`)
    return true
  } catch (e) {
    console.error(`[i18n] Failed to merge messages for ${code}:`, e)
    return false
  }
}

/**
 * 安全合并：只添加新键，不覆盖已有键（用于保护内置语言包）
 */
function safeMerge(target: any, source: any): any {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (!(key in target)) {
      // 目标没有这个键，可以添加
      result[key] = source[key]
    } else if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      // 两边都是对象，递归安全合并
      result[key] = safeMerge(target[key], source[key])
    }
    // 如果目标已有该键且不是对象，则保留原值（不覆盖）
  }
  return result
}

/**
 * 注销语言（供插件使用）
 * @param code 语言代码
 * @returns 是否注销成功
 */
function unregisterLocale(code: LocaleCode): boolean {
  // 不允许注销内置语言
  if (BUILTIN_LOCALES.includes(code)) {
    console.warn(`[i18n] Cannot unregister builtin locale: ${code}`)
    return false
  }
  
  if (!localeMessages.has(code)) {
    return false
  }
  
  // 如果当前正在使用该语言，切换回中文
  if (currentLocale.value === code) {
    setLocale('zh-CN')
  }
  
  localeMessages.delete(code)
  localeMetas.delete(code)
  registeredLocales.value = registeredLocales.value.filter(c => c !== code)
  
  console.log(`[i18n] Unregistered locale: ${code}`)
  return true
}

/**
 * 检查语言是否已注册
 */
function hasLocale(code: LocaleCode): boolean {
  return localeMessages.has(code)
}

/**
 * 获取语言元信息
 */
function getLocaleMeta(code: LocaleCode): LocaleMeta | undefined {
  return localeMetas.get(code)
}

// ==================== 初始化 ====================

/**
 * 初始化：从 localStorage 或浏览器设置获取语言
 */
function initLocale(): void {
  try {
    // 优先使用 localStorage 保存的设置
    const saved = localStorage.getItem('st:locale')
    if (saved && localeMessages.has(saved)) {
      setLocale(saved)
      return
    }
    
    // 其次使用浏览器语言设置
    const browserLang = navigator.language || (navigator as any).userLanguage
    if (browserLang) {
      // 尝试精确匹配
      if (localeMessages.has(browserLang)) {
        setLocale(browserLang)
        return
      }
      // 尝试前缀匹配（如 zh -> zh-CN）
      const prefix = browserLang.split('-')[0]
      const matched = Array.from(localeMessages.keys()).find(l => l.startsWith(prefix))
      if (matched) {
        setLocale(matched)
        return
      }
    }
  } catch (e) {
    console.warn('[i18n] Failed to init locale:', e)
  }
  
  // 默认使用中文
  setLocale('zh-CN')
}

// ==================== Vue Composable ====================

/**
 * Vue Composable: useI18n
 */
export function useI18n() {
  return {
    /** 翻译函数 */
    t: translate,
    /** 当前语言（响应式） */
    locale: computed(() => currentLocale.value),
    /** 设置语言 */
    setLocale,
    /** 获取当前语言 */
    getLocale,
    /** 已注册语言列表（响应式） */
    availableLocales: computed(() => getAvailableLocales()),
    /** 检查语言是否已注册 */
    hasLocale,
    /** 获取语言元信息 */
    getLocaleMeta,
  }
}

// ==================== 全局 i18n 对象 ====================

/**
 * 检查语言是否为内置语言
 */
function isBuiltinLocale(code: LocaleCode): boolean {
  return BUILTIN_LOCALES.includes(code)
}

/**
 * 全局 i18n 对象
 * - 可直接使用，也可通过 useI18n() composable 使用
 * - 插件应使用此对象的 registerLocale / mergeMessages 方法
 */
export const i18n = {
  // 核心功能
  t: translate,
  locale: currentLocale,
  setLocale,
  getLocale,
  init: initLocale,
  
  // 查询功能
  hasLocale,
  getLocaleMeta,
  getAvailableLocales,
  availableLocales: registeredLocales,
  isBuiltinLocale,
  
  // 插件接口
  registerLocale,
  mergeMessages,
  unregisterLocale,
  
  // 常量
  BUILTIN_LOCALES,
}

// 挂载到全局 window 对象（供插件使用）
if (typeof window !== 'undefined') {
  ;(window as any).STI18n = i18n
}

// 默认导出
export default i18n