// SmartTavern Composable: useThemeHost (v1)
// 作用：为组件提供主题宿主（ThemeManager/ThemeStore）的响应式封装与便捷 API。
// 安全：默认不执行脚本；仅应用 tokens 与 CSS。脚本开关需要后续显式开启并加沙箱。
// 依赖：src/features/themes/manager.ts

import { ref, reactive, onMounted, onBeforeUnmount, type Ref } from 'vue'
import ThemeManager from '@/features/themes/manager'
import type { ThemePackV1, ThemeApplyOptions } from '@/features/themes/pack'
import type { ThemeExtension, ThemeAppearanceSnapshot } from '@/types/theme'

let __inited = false
let __initPromise: Promise<void> | null = null

const currentTheme = ref<ThemePackV1 | null>(null)
const state = reactive({
  version: null as string | null,
  ready: false,
})

let _themeChangeUnsub: (() => void) | null = null

async function ensureInit(): Promise<void> {
  if (__inited) return
  if (!__initPromise) {
    __initPromise = ThemeManager.init({ exposeToWindow: false }).then(() => {
      state.version = ThemeManager.getVersion?.() || 'v1'
      state.ready = true
      currentTheme.value = ThemeManager.getCurrentTheme?.() || null
      // 订阅主题变化
      _themeChangeUnsub = ThemeManager.on('change', () => {
        currentTheme.value = ThemeManager.getCurrentTheme?.() || null
      })
      __inited = true
    })
  }
  await __initPromise
}

/**
 * 导入并应用主题包（JSON 文本）
 */
async function importFromText(text: string, options: ThemeApplyOptions = { persist: true }): Promise<ThemePackV1 | null> {
  await ensureInit()
  return ThemeManager.importFromText(text, options)
}

/**
 * 从文件导入并应用主题包（.json/.sttheme.json）
 */
async function importFromFile(file: File, options: ThemeApplyOptions = { persist: true }): Promise<ThemePackV1 | null> {
  await ensureInit()
  return ThemeManager.importFromFile(file, options)
}

/**
 * 直接应用主题包对象
 */
async function applyThemePack(pack: ThemePackV1, options: ThemeApplyOptions = { persist: true }): Promise<ThemePackV1 | null> {
  await ensureInit()
  return ThemeManager.applyThemePack(pack, options)
}

/**
 * 重置主题（移除 CSS，清空持久化）
 */
async function resetTheme(options: { persist?: boolean } = { persist: true }): Promise<void> {
  await ensureInit()
  return ThemeManager.resetTheme(options)
}

/**
 * 动态设置单个 token（会写入当前 pack 的 tokens 并持久化，若 persist!==false）
 */
async function setToken(name: string, value: string | number, options: { persist?: boolean } = { persist: true }): Promise<void> {
  await ensureInit()
  // ThemeStore.setToken 在 manager/store 内部可用（此处通过 manager 暴露 store 时可直接 setToken）
  try {
    ThemeManager?.store?.setToken?.(name, value, options)
  } catch (_) {
    // 回退：尝试直接应用到 root（不会写回包）
    document.documentElement.style.setProperty(name, String(value))
  }
}

/**
 * 主题扩展接口：注册/注销/广播（不执行脚本，仅用于美化扩展监听外观快照）
 */
async function registerExtension(ext: ThemeExtension): Promise<() => void> {
  await ensureInit()
  // 返回一个注销函数，若宿主未实现则返回空函数
  return ThemeManager?.registerExtension?.(ext) ?? (() => {})
}

function unregisterExtension(id: string): void {
  try { 
    ThemeManager?.unregisterExtension?.(id) 
  } catch (_) {
    // Ignore errors
  }
}

function getExtensions(): ThemeExtension[] {
  try { 
    return ThemeManager?.getExtensions?.() ?? [] 
  } catch (_) { 
    return [] 
  }
}

async function applyAppearanceSnapshot(snapshot: ThemeAppearanceSnapshot): Promise<void> {
  await ensureInit()
  try { 
    ThemeManager?.applyAppearanceSnapshot?.(snapshot) 
  } catch (_) {
    // Ignore errors
  }
}

export interface UseThemeHostState {
  version: string | null
  ready: boolean
}

export interface UseThemeHostAPI {
  // state
  ready: UseThemeHostState
  version: UseThemeHostState
  currentTheme: Ref<ThemePackV1 | null>

  // actions
  importFromText: (text: string, options?: ThemeApplyOptions) => Promise<ThemePackV1 | null>
  importFromFile: (file: File, options?: ThemeApplyOptions) => Promise<ThemePackV1 | null>
  applyThemePack: (pack: ThemePackV1, options?: ThemeApplyOptions) => Promise<ThemePackV1 | null>
  resetTheme: (options?: { persist?: boolean }) => Promise<void>
  setToken: (name: string, value: string | number, options?: { persist?: boolean }) => Promise<void>
  registerExtension: (ext: ThemeExtension) => Promise<() => void>
  unregisterExtension: (id: string) => void
  getExtensions: () => ThemeExtension[]
  applyAppearanceSnapshot: (snapshot: ThemeAppearanceSnapshot) => Promise<void>
}

/**
 * 组合式函数：返回响应式状态与 API
 */
export function useThemeHost(): UseThemeHostAPI {
  onMounted(async () => {
    await ensureInit()
  })
  onBeforeUnmount(() => {
    // 单例模式：组件卸载时不取消全局订阅
  })

  return {
    // state
    ready: state,
    version: state,
    currentTheme,

    // actions
    importFromText,
    importFromFile,
    applyThemePack,
    resetTheme,
    setToken,
    registerExtension,
    unregisterExtension,
    getExtensions,
    applyAppearanceSnapshot,
  }
}

export default useThemeHost

/** 清理主题订阅（仅在应用卸载时调用） */
export function cleanupThemeHost(): void {
  if (_themeChangeUnsub) {
    _themeChangeUnsub()
    _themeChangeUnsub = null
  }
}