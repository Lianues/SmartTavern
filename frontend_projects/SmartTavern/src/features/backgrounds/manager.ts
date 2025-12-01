/**
 * SmartTavern — Page Backgrounds Manager
 * 
 * 职责：
 * - 初始化时从后端加载页面背景图片（带缓存验证）
 * - 动态设置 CSS 变量（--st-bg-start, --st-bg-threaded, --st-bg-sandbox）
 * - 监听屏幕方向变化，自动切换横版/竖版背景
 * - 提供手动刷新接口
 */

import BackgroundsService, { type PageName, type Orientation } from '@/services/backgroundsService'

// 背景状态
interface BackgroundState {
  orientation: Orientation
  urls: Record<PageName, string | null>
  hashes: Record<PageName, string | null>
  loading: boolean
  error: string | null
}

const state: BackgroundState = {
  orientation: BackgroundsService.detectOrientation(),
  urls: {
    HomePage: null,
    ThreadedChat: null,
    SandboxChat: null,
  },
  hashes: {
    HomePage: null,
    ThreadedChat: null,
    SandboxChat: null,
  },
  loading: false,
  error: null,
}

// CSS 变量映射
const CSS_VAR_MAP: Record<PageName, string> = {
  HomePage: '--st-bg-start',
  ThreadedChat: '--st-bg-threaded',
  SandboxChat: '--st-bg-sandbox',
}

/**
 * 应用背景 URL 到 CSS 变量
 */
function applyBackgroundToCSS(page: PageName, url: string | null): void {
  const varName = CSS_VAR_MAP[page]
  if (!varName) return
  
  const root = document.documentElement
  if (url) {
    root.style.setProperty(varName, `url('${url}')`)
  } else {
    root.style.removeProperty(varName)
  }
}

/**
 * 加载单个页面背景
 */
async function loadPageBackground(page: PageName, orientation?: Orientation): Promise<void> {
  try {
    const { url, hash } = await BackgroundsService.getPageBackground(page, orientation)
    
    // 释放旧的 blob URL
    const oldUrl = state.urls[page]
    if (oldUrl && oldUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(oldUrl)
      } catch (_) {}
    }
    
    // 更新状态
    state.urls[page] = url
    state.hashes[page] = hash
    
    // 应用到 CSS
    applyBackgroundToCSS(page, url)
    
    console.info(`[BackgroundsManager] Loaded ${page} background (${orientation || state.orientation})`)
  } catch (err) {
    console.warn(`[BackgroundsManager] Failed to load ${page} background:`, err)
    // 加载失败时移除 CSS 变量（回退到默认样式）
    applyBackgroundToCSS(page, null)
    throw err
  }
}

/**
 * 加载所有页面背景
 */
async function loadAllBackgrounds(orientation?: Orientation): Promise<void> {
  if (state.loading) {
    console.info('[BackgroundsManager] Already loading backgrounds, skip')
    return
  }
  
  state.loading = true
  state.error = null
  
  const orient = orientation || BackgroundsService.detectOrientation()
  state.orientation = orient
  
  try {
    const pages: PageName[] = ['HomePage', 'ThreadedChat', 'SandboxChat']
    
    // 并发加载所有背景
    const results = await Promise.allSettled(
      pages.map(page => loadPageBackground(page, orient))
    )
    
    // 检查是否有失败的
    const failures = results.filter(r => r.status === 'rejected')
    if (failures.length > 0) {
      console.warn(`[BackgroundsManager] ${failures.length} backgrounds failed to load`)
    }
    
    console.info(`[BackgroundsManager] Loaded ${results.length - failures.length}/${results.length} backgrounds`)
  } catch (err) {
    state.error = String(err)
    console.error('[BackgroundsManager] Failed to load backgrounds:', err)
  } finally {
    state.loading = false
  }
}

/**
 * 处理方向变化
 */
function handleOrientationChange(newOrientation: Orientation): void {
  if (newOrientation === state.orientation) return
  
  console.info(`[BackgroundsManager] Orientation changed: ${state.orientation} -> ${newOrientation}`)
  state.orientation = newOrientation
  
  // 重新加载所有背景
  loadAllBackgrounds(newOrientation).catch(err => {
    console.error('[BackgroundsManager] Failed to reload backgrounds:', err)
  })
}

/**
 * 清理所有背景（释放 blob URLs）
 */
function cleanup(): void {
  const pages: PageName[] = ['HomePage', 'ThreadedChat', 'SandboxChat']
  
  for (const page of pages) {
    const url = state.urls[page]
    if (url && url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url)
      } catch (_) {}
    }
    state.urls[page] = null
    state.hashes[page] = null
    applyBackgroundToCSS(page, null)
  }
}

// 方向监听清理函数
let cleanupOrientationWatcher: (() => void) | null = null

/**
 * 初始化背景管理器
 */
async function initialize(): Promise<void> {
  console.info('[BackgroundsManager] Initializing...')
  
  // 加载所有背景
  await loadAllBackgrounds()
  
  // 设置方向监听
  if (cleanupOrientationWatcher) {
    cleanupOrientationWatcher()
  }
  cleanupOrientationWatcher = BackgroundsService.setupOrientationWatcher()
  
  // 监听方向变化（通过 resize 事件）
  let resizeTimeoutId: number | null = null
  const resizeHandler = () => {
    if (resizeTimeoutId !== null) {
      clearTimeout(resizeTimeoutId)
    }
    resizeTimeoutId = window.setTimeout(() => {
      const newOrientation = BackgroundsService.detectOrientation()
      if (newOrientation !== state.orientation) {
        handleOrientationChange(newOrientation)
      }
    }, 500)
  }
  
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', resizeHandler)
  }
  
  console.info('[BackgroundsManager] Initialized')
}

/**
 * 销毁背景管理器
 */
function destroy(): void {
  cleanup()
  if (cleanupOrientationWatcher) {
    cleanupOrientationWatcher()
    cleanupOrientationWatcher = null
  }
  console.info('[BackgroundsManager] Destroyed')
}

/**
 * 手动刷新所有背景（清除缓存并重新加载）
 */
async function refresh(): Promise<void> {
  console.info('[BackgroundsManager] Refreshing backgrounds...')
  
  // 清除缓存
  await BackgroundsService.clearAllCache()
  
  // 重新加载
  await loadAllBackgrounds()
}

/**
 * 获取当前状态
 */
function getState(): Readonly<BackgroundState> {
  return { ...state }
}

// 导出管理器
const BackgroundsManager = {
  initialize,
  destroy,
  refresh,
  loadAllBackgrounds,
  getState,
}

export default BackgroundsManager