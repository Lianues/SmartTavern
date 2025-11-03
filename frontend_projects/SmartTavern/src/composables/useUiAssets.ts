import { nextTick } from 'vue'
import { CDN_LUCIDE_ICONS, CDN_FLOWBITE } from '@/utils/resourceLoader'

/**
 * useUiAssets：统一管理 UI 依赖（Lucide 图标 / Flowbite JS）的按需加载与刷新
 *
 * - ensureUIAssets(): 按需加载脚本并完成一次性初始化
 * - refreshIcons(): 在动态节点更新后刷新图标与 Flowbite 组件（建议在 nextTick 中调用）
 *
 * CDN 链接已统一管理在 src/utils/resourceLoader.ts
 * 方便后续维护和替换
 *
 * 用法：
 *   import { useUiAssets } from '@/composables/useUiAssets'
 *   const { ensureUIAssets, refreshIcons } = useUiAssets()
 *   onMounted(() => { ensureUIAssets() })
 *   // 任意需要刷新图标/交互组件的地方：
 *   refreshIcons()
 */

export interface UseUiAssetsAPI {
  ensureUIAssets: () => Promise<void>
  refreshIcons: () => void
}

export function useUiAssets(): UseUiAssetsAPI {
  async function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (document.querySelector(`script[src="${src}"]`)) return resolve()
        const s = document.createElement('script')
        s.src = src
        s.async = true
        s.onload = () => resolve()
        s.onerror = (e) => reject(e)
        document.head.appendChild(s)
      } catch (e) {
        // 无法创建 script 节点时直接 resolve，避免阻塞
        resolve()
      }
    })
  }

  async function ensureUIAssets(): Promise<void> {
    try {
      // Lucide（图标） - 使用统一管理的 CDN 链接
      await loadScript(CDN_LUCIDE_ICONS)
    } catch (_) {
      // Ignore errors
    }

    try {
      // Flowbite（交互组件） - 使用统一管理的 CDN 链接
      await loadScript(CDN_FLOWBITE)
    } catch (_) {
      // Ignore errors
    }

    try { 
      (window as any)?.lucide?.createIcons?.() 
    } catch (_) {
      // Ignore errors
    }
    if (typeof (window as any).initFlowbite === 'function') {
      try { 
        (window as any).initFlowbite() 
      } catch (_) {
        // Ignore errors
      }
    }
  }

  function refreshIcons(): void {
    nextTick(() => {
      try { 
        (window as any)?.lucide?.createIcons?.() 
      } catch (_) {
        // Ignore errors
      }
      if (typeof (window as any).initFlowbite === 'function') {
        try { 
          (window as any).initFlowbite() 
        } catch (_) {
          // Ignore errors
        }
      }
    })
  }

  return {
    ensureUIAssets,
    refreshIcons,
  }
}

export default useUiAssets