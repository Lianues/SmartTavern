import { createApp } from 'vue'
import App from './App.vue'
import CustomScrollbar from '@/components/common/CustomScrollbar.vue'
import CustomScrollbar2 from '@/components/common/CustomScrollbar2.vue'
import './tailwind.css'
import './styles/tokens.css'
import './styles/global.css'
// @ts-ignore - JS module without types
import ThemeManager from '@/features/themes/manager'
// @ts-ignore - JS module without types
import BackgroundsManager from '@/features/backgrounds/manager'
// @ts-ignore - JS module without types
import Host from '@/workflow/core/host'
// 国际化系统
import { i18n } from '@/locales'
import { registerHomeMenuBuiltins } from '@/workflow/slots/homeMenu/bootstrap'
import { registerSidebarBuiltins } from '@/workflow/slots/sidebar/bootstrap'
import { createPinia, setActivePinia } from 'pinia'
import { PluginLoader } from '@/workflow/loader.js'
import { initCompletionBridge } from '@/workflow/controllers/completionBridge'
import { initMessageBridge } from '@/workflow/controllers/messageBridge'
import { initBranchBridge } from '@/workflow/controllers/branchBridge'
import { initCatalogBridge } from '@/workflow/controllers/catalogBridge'
import { initSettingsBridge } from '@/workflow/controllers/settingsBridge'
import { initConversationBridge } from '@/workflow/controllers/conversationBridge'
// 后处理事件桥接（全局暴露 window.STPostprocessBridge / STSandbox.PostprocessBridge）
import '@/workflow/channels/postprocessBridge'
import { ResourceLoader, updateProgressUI, hideLoadingOverlay, type ProgressData } from '@/utils/resourceLoader'
// @ts-ignore - JS module without types
import DataCatalog from '@/services/dataCatalog.js'

interface PluginItem {
  dir?: string
  [key: string]: any
}

interface PluginError {
  file?: string
  [key: string]: any
}

interface PluginsListResponse {
  items?: PluginItem[]
  errors?: PluginError[]
}

interface PluginsSwitchResponse {
  enabled?: string[]
  [key: string]: any
}

// 先加载外部资源，再启动应用
async function preloadResources(): Promise<void> {
  const loader = new ResourceLoader()
  
  // 设置进度回调
  loader.onProgress = (data: ProgressData) => {
    updateProgressUI(data)
  }
  
  // 加载所有资源
  await loader.loadAll()
  
  // 稍微延迟以确保 UI 更新
  await new Promise(resolve => setTimeout(resolve, 200))
  
  // 隐藏加载遮罩
  hideLoadingOverlay()
}

// 启动应用
async function bootstrapApp(): Promise<void> {
  // 1. 预加载外部资源
  await preloadResources()
  
  // 2. 创建 Vue 应用实例
  const app = createApp(App)

  // 3. 注册全局组件
  app.component('CustomScrollbar', CustomScrollbar)
  app.component('CustomScrollbar2', CustomScrollbar2)

  // 4. 注册 Pinia（供 Host 与各模块在组件外部访问 Store）
  const pinia = createPinia()
  app.use(pinia)
  // 在组件外（如 Host 模块）访问 Pinia Store，需要设置 active pinia
  try { setActivePinia(pinia) } catch (_) {
    // Ignore errors
  }

  /**
   * 5. 初始化全局后端基址（优先顺序）：
   * 1) localStorage('st.backend_base')
   * 2) window.ST_BACKEND_BASE
   * 3) import.meta.env.VITE_API_BASE
   * 4) 'http://localhost:8050'
   */
  (function initBackendBase(): void {
    try {
      const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {} as Record<string, any>
      const def = env.VITE_API_BASE || 'http://localhost:8050'
      let base = def
      if (typeof window !== 'undefined') {
        const fromLS = (function(): string | null { 
          try { 
            return localStorage.getItem('st.backend_base') 
          } catch(_) { 
            return null 
          } 
        })()
        base = ((window as any).ST_BACKEND_BASE || fromLS || def)
        ;(window as any).ST_BACKEND_BASE = String(base).replace(/\/+$/, '')
      }
    } catch (_) {
      // Ignore errors
    }
  })()

  // 6. 初始化国际化系统
  try {
    i18n.init()
    console.log('[bootstrap] i18n initialized, locale:', i18n.getLocale())
  } catch (e) {
    console.warn('[bootstrap] i18n init failed', e)
  }

  // 7. 初始化主题运行时后再挂载，减少样式闪烁
  ThemeManager.init().finally(async () => {
  // 8. 初始化背景图片管理器（在主题之后，以便主题可以覆盖背景）
  try {
    await BackgroundsManager.initialize()
    console.log('[bootstrap] BackgroundsManager initialized')
  } catch (e) {
    console.warn('[bootstrap] BackgroundsManager init failed', e)
  }

  // 初始化工作流 Host 并注册开始页内置按钮与侧边栏项
  Host.init({ exposeToWindow: true })
  try { registerHomeMenuBuiltins() } catch (e) { console.warn('[bootstrap] homeMenu', e) }
  try { registerSidebarBuiltins() } catch (e) { console.warn('[bootstrap] sidebar', e) }

  // 初始化补全事件桥接（统一请求入口与过程事件广播）
  try {
    const disposeCompletionBridge = initCompletionBridge()
    if (typeof window !== 'undefined') (window as any).disposeCompletionBridge = disposeCompletionBridge
  } catch (e) {
    console.warn('[bootstrap] completion bridge', e)
  }

  // 初始化消息事件桥接（发送/编辑 -> ChatBranches，并广播成功/失败）
  try {
    const disposeMessageBridge = initMessageBridge()
    if (typeof window !== 'undefined') (window as any).disposeMessageBridge = disposeMessageBridge
  } catch (e) {
    console.warn('[bootstrap] message bridge', e)
  }

  // 初始化分支事件桥接（分支表/切换/删除/重试）
  try {
    const disposeBranchBridge = initBranchBridge()
    if (typeof window !== 'undefined') (window as any).disposeBranchBridge = disposeBranchBridge
  } catch (e) {
    console.warn('[bootstrap] branch bridge', e)
  }

  // 初始化数据目录桥接（角色/人设/预设/世界书/正则/LLM配置）
  try {
    initCatalogBridge(Host.events)
  } catch (e) {
    console.warn('[bootstrap] catalog bridge', e)
  }

  // 初始化设置管理桥接（获取/更新对话设置）
  try {
    initSettingsBridge(Host.events)
  } catch (e) {
    console.warn('[bootstrap] settings bridge', e)
  }

  // 初始化对话生命周期桥接（创建/加载/保存/删除对话）
  try {
    initConversationBridge(Host.events)
  } catch (e) {
    console.warn('[bootstrap] conversation bridge', e)
  }

  // 自动加载插件（受 plugins_switch.json 控制）
  try {
    PluginLoader.init()
    if (typeof window !== 'undefined') (window as any).loader = PluginLoader

    async function loadPluginsFromSwitch(): Promise<void> {
      // 1) 加载前端固定工作流（内置编排）
      const frontendWorkflows = [
        { url: '/src/workflow/workflows/default-thread-orchestrator.js', name: 'default-thread-orchestrator' }
      ]
      for (const wf of frontendWorkflows) {
        try {
          await PluginLoader.load(wf.url, { id: wf.name })
          console.log(`[bootstrap] loaded frontend workflow: ${wf.name}`)
        } catch (e) {
          console.warn(`[bootstrap] frontend workflow load failed: ${wf.name}`, e)
        }
      }

      // 2) 读取开关文件与插件清单
      let enabledNames: string[] | null = null // null = 全量模式
      try {
        const sw: PluginsSwitchResponse = await DataCatalog.getPluginsSwitch()
        if (Array.isArray(sw?.enabled)) {
          enabledNames = sw.enabled.map(x => String(x))
        } else {
          Host.pushToast?.({ type: 'error', message: '缺失插件开关文件（plugins_switch.json）', timeout: 2800 })
          return
        }
      } catch (e) {
        console.warn('[bootstrap] getPluginsSwitch failed', e)
        Host.pushToast?.({ type: 'error', message: '读取插件开关文件失败', timeout: 2600 })
        return
      }

      // 3) 基于开关文件（或全量清单）加载插件
      try {
        const res: PluginsListResponse = await DataCatalog.listPlugins()
        const allItems = Array.isArray(res?.items) ? res.items : []
        const allDirs = allItems.map(it => String(it.dir || ''))
        // 错误提示：文件中声明但目录缺失
        const errs = Array.isArray(res?.errors) ? res.errors : []
        for (const er of errs) {
          try {
            Host.pushToast?.({ type: 'warning', message: `插件目录缺失：${er?.file || ''}`, timeout: 2600 })
          } catch (_) {
            // Ignore errors
          }
        }

        // 计算要加载的 dir 列表
        let toLoadDirs: string[] = []
        if (enabledNames === null) {
          // 全量模式：清单中的所有插件目录
          toLoadDirs = allDirs
        } else {
          // 按开关文件启用项筛选
          const nameOf = (dir: string): string => {
            const s = String(dir).replace(/\\/g, '/')
            const parts = s.split('/')
            return parts[parts.length - 1] || s
          }
          const set = new Set(enabledNames)
          toLoadDirs = allDirs.filter((dir) => set.has(nameOf(dir)))
        }

        // 加载每个启用插件（通过目录解析入口）
        let loaded = 0
        for (const dir of toLoadDirs) {
          try {
            await PluginLoader.loadPluginByDir(dir, { replace: true })
            loaded++
          } catch (e) {
            console.warn('[bootstrap] load plugin failed:', dir, e)
            Host.pushToast?.({ type: 'error', message: `插件加载失败：${dir}`, timeout: 2200 })
          }
        }
        if (loaded > 0) {
          Host.pushToast?.({ type: 'success', message: `已加载 ${loaded} 个插件`, timeout: 2000 })
        }
      } catch (e) {
        console.warn('[bootstrap] failed to load plugins', e)
      }
    }

    loadPluginsFromSwitch().catch((e) => console.error('[bootstrap] plugin loading error', e))
  } catch (e) {
    console.warn('[bootstrap] plugin init failed', e)
  }

    app.mount('#app')
  })
}

// 启动应用
bootstrapApp().catch(error => {
  console.error('[Bootstrap] Failed to start app:', error)
  // 即使出错也隐藏加载遮罩
  hideLoadingOverlay()
})