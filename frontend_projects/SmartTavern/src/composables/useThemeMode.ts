import { ref, type Ref } from 'vue'
import ThemeManager from '@/features/themes/manager'

/**
 * useThemeMode：统一管理主题模式（system/dark/light）
 * - 暴露：theme / applyTheme / onThemeUpdate / initTheme
 * - 行为：跟随系统时监听 prefers-color-scheme 变化；与 ThemeManager 同步；持久化本地存储
 *
 * 用法：
 *   import { useThemeMode } from '@/composables/useThemeMode'
 *   const { theme, initTheme, onThemeUpdate, applyTheme } = useThemeMode()
 *   onMounted(() => initTheme()) // 优先于 UI 渲染，避免白屏闪烁
 */

export type ThemeMode = 'system' | 'dark' | 'light'

export interface UseThemeModeAPI {
  theme: Ref<ThemeMode>
  applyTheme: (t: ThemeMode) => void
  onThemeUpdate: (t: ThemeMode) => void
  initTheme: () => void
}

let __themeMql: MediaQueryList | null = null
let __onSchemeChange: ((e: MediaQueryListEvent) => void) | null = null

export function useThemeMode(): UseThemeModeAPI {
  const theme = ref<ThemeMode>('system')

  function detectInitialTheme(): ThemeMode {
    try {
      const attrTheme = document?.documentElement?.getAttribute?.('data-theme')
      const savedTheme = localStorage.getItem('st.theme')
      return (attrTheme === 'dark' || attrTheme === 'light') ? attrTheme
           : (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'system') ? savedTheme as ThemeMode
           : 'system'
    } catch (_) {
      return 'system'
    }
  }

  function applyTheme(t: ThemeMode): void {
    const root = document.documentElement
    // detach previous system watcher if any
    if (__themeMql && t !== 'system' && __onSchemeChange) {
      try { 
        __themeMql.removeEventListener('change', __onSchemeChange) 
      } catch (_) {
        // Ignore errors
      }
      __themeMql = null
    }
    if (t === 'dark' || t === 'light') {
      root.setAttribute('data-theme', t)
      return
    }
    // system: follow OS prefers-color-scheme (and react to changes)
    const mql = window.matchMedia?.('(prefers-color-scheme: dark)')
    const setByMql = (mq: MediaQueryList | MediaQueryListEvent | null | undefined): void => {
      try {
        root.setAttribute('data-theme', mq?.matches ? 'dark' : 'light')
      } catch (_) {
        // Ignore errors
      }
    }
    setByMql(mql)
    if (mql) {
      __onSchemeChange = (e: MediaQueryListEvent) => setByMql(e)
      try { 
        mql.addEventListener('change', __onSchemeChange) 
      } catch (_) {
        // Ignore errors
      }
      __themeMql = mql
    }
  }

  function onThemeUpdate(t: ThemeMode): void {
    theme.value = t
    applyTheme(t)
    try { 
      ThemeManager.setColorMode?.(t) 
    } catch (_) {
      // Ignore errors
    }
    try { 
      localStorage.setItem('st.theme', t) 
    } catch (_) {
      // Ignore errors
    }
  }

  function initTheme(): void {
    const init = detectInitialTheme()
    if (init !== 'system') {
      theme.value = init
    }
    applyTheme(theme.value)
    try { 
      ThemeManager.setColorMode?.(theme.value) 
    } catch (_) {
      // Ignore errors
    }
  }

  return {
    theme,
    applyTheme,
    onThemeUpdate,
    initTheme,
  }
}

export default useThemeMode