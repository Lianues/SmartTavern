/**
 * 资源预加载管理器
 * 负责追踪并加载所有外部 CDN 资源（字体、脚本等）
 * 提供实时进度反馈
 *
 * 所有 CDN 资源链接统一在此管理，方便后续维护和替换
 */

// ========== CDN 资源链接配置（统一管理） ==========

/**
 * Google Fonts 字体链接
 * 用于 App.vue 的 @import 和预加载
 */
export const CDN_FONTS = {
  INTER_JETBRAINS: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap',
  CINZEL_CORMORANT: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cormorant+Garamond:wght@400;600;700&display=swap',
} as const

/**
 * 单独的字体链接（用于预加载管理器）
 */
export const CDN_FONT_INTER = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
export const CDN_FONT_JETBRAINS_MONO = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap'
export const CDN_FONT_CINZEL = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&display=swap'
export const CDN_FONT_CORMORANT = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&display=swap'

/**
 * UI 组件脚本链接
 * 用于 useUiAssets.js 和预加载
 */
export const CDN_LUCIDE_ICONS = 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js'
export const CDN_FLOWBITE = 'https://cdn.jsdelivr.net/npm/flowbite@2.0.0/dist/flowbite.min.js'

// ====================================================

interface Resource {
  name: string
  url: string
  type: 'font' | 'script'
}

export interface ProgressData {
  loaded: number
  total: number
  progress: number
  currentResource: string
}

export class ResourceLoader {
  private resources: Resource[]
  private loaded: number
  private total: number
  public onProgress: ((data: ProgressData) => void) | null

  constructor() {
    this.resources = [
      {
        name: 'Google Fonts (Inter)',
        url: CDN_FONT_INTER,
        type: 'font'
      },
      {
        name: 'Google Fonts (JetBrains Mono)',
        url: CDN_FONT_JETBRAINS_MONO,
        type: 'font'
      },
      {
        name: 'Google Fonts (Cinzel)',
        url: CDN_FONT_CINZEL,
        type: 'font'
      },
      {
        name: 'Google Fonts (Cormorant Garamond)',
        url: CDN_FONT_CORMORANT,
        type: 'font'
      },
      {
        name: 'Lucide Icons',
        url: CDN_LUCIDE_ICONS,
        type: 'script'
      },
      {
        name: 'Flowbite Components',
        url: CDN_FLOWBITE,
        type: 'script'
      }
    ]
    
    this.loaded = 0
    this.total = this.resources.length
    this.onProgress = null
  }

  /**
   * 加载单个字体资源
   */
  loadFont(url: string): Promise<void> {
    return new Promise((resolve) => {
      // 检查是否已有该字体的 link 标签
      const existing = document.querySelector(`link[href="${url}"]`)
      if (existing) {
        resolve()
        return
      }

      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = url
      
      // 字体加载通常很快，设置短超时
      const timeout = setTimeout(() => {
        resolve() // 即使超时也继续
      }, 3000)
      
      link.onload = () => {
        clearTimeout(timeout)
        resolve()
      }
      
      link.onerror = () => {
        clearTimeout(timeout)
        resolve() // 加载失败也继续
      }
      
      document.head.appendChild(link)
    })
  }

  /**
   * 加载单个脚本资源
   */
  loadScript(url: string): Promise<void> {
    return new Promise((resolve) => {
      // 检查是否已加载
      const existing = document.querySelector(`script[src="${url}"]`)
      if (existing) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = url
      script.async = true
      
      const timeout = setTimeout(() => {
        resolve() // 超时也继续
      }, 5000)
      
      script.onload = () => {
        clearTimeout(timeout)
        resolve()
      }
      
      script.onerror = () => {
        clearTimeout(timeout)
        resolve() // 加载失败也继续
      }
      
      document.head.appendChild(script)
    })
  }

  /**
   * 更新进度
   */
  private updateProgress(name: string): void {
    this.loaded++
    const progress = Math.floor((this.loaded / this.total) * 100)
    
    if (this.onProgress) {
      this.onProgress({
        loaded: this.loaded,
        total: this.total,
        progress,
        currentResource: name
      })
    }
  }

  /**
   * 加载所有资源
   */
  async loadAll(): Promise<void> {
    for (const resource of this.resources) {
      try {
        if (resource.type === 'font') {
          await this.loadFont(resource.url)
        } else if (resource.type === 'script') {
          await this.loadScript(resource.url)
        }
        this.updateProgress(resource.name)
      } catch (error) {
        console.warn(`Failed to load ${resource.name}:`, error)
        this.updateProgress(resource.name) // 失败也更新进度
      }
    }
    
    // 确保进度达到 100%
    if (this.loaded < this.total) {
      this.loaded = this.total
      if (this.onProgress) {
        this.onProgress({
          loaded: this.total,
          total: this.total,
          progress: 100,
          currentResource: '完成'
        })
      }
    }
  }
}

/**
 * 更新 UI 进度条
 */
export function updateProgressUI(data: ProgressData): void {
  const progressBar = document.getElementById('progress-bar')
  const progressText = document.getElementById('progress-text')
  
  if (progressBar) {
    progressBar.style.width = `${data.progress}%`
  }
  
  if (progressText) {
    if (data.progress === 100) {
      progressText.textContent = '加载完成'
    } else {
      progressText.textContent = `正在加载: ${data.currentResource} (${data.progress}%)`
    }
  }
}

/**
 * 隐藏加载遮罩
 */
export function hideLoadingOverlay(): void {
  const overlay = document.getElementById('loading-overlay')
  if (overlay) {
    overlay.classList.add('hidden')
    // 动画结束后移除元素
    setTimeout(() => {
      overlay.style.display = 'none'
    }, 300)
  }
}