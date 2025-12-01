// SmartTavern composable: usePalette
// 负责从头像或角色生成渐变色，并输出可直接绑定到 style 的 CSS 变量映射

import { ref, type Ref } from 'vue'

export interface ChatMessage {
  id: number | string
  role: 'user' | 'assistant' | 'system' | string
  avatarUrl?: string
  meta?: any
  [key: string]: any
}

export interface RGB {
  r: number
  g: number
  b: number
}

export interface Palette {
  start: string
  end: string
}

export interface UsePaletteAPI {
  palettes: Ref<Record<string | number, Palette>>
  ensurePaletteFor: (msg: ChatMessage) => Promise<void>
  stripeStyle: (msg: ChatMessage) => Record<string, string>
  clearPalette: (id: string | number) => void
  getPalette: (idOrMsg: string | number | ChatMessage) => Palette | null
  roleFallback: (role: string) => Palette
  extractPaletteFromImage: (url: string) => Promise<Palette | null>
}

function clamp(v: number, min: number = 0, max: number = 255): number {
  return Math.max(min, Math.min(max, v))
}

function lighten(rgb: RGB, amt: number = 24): RGB {
  return {
    r: clamp(rgb.r + amt),
    g: clamp(rgb.g + amt),
    b: clamp(rgb.b + amt)
  }
}

function rgbToCss(rgb: RGB, a: number = 1): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`
}

/**
 * 根据角色提供回退渐变色，确保亮/暗主题下均有足够对比度
 */
function roleFallback(role: string): Palette {
  if (role === 'assistant') {
    return { start: 'rgba(14,165,233,1)', end: 'rgba(94,234,212,1)' }
  }
  if (role === 'system') {
    return { start: 'rgba(251,191,36,1)', end: 'rgba(253,230,138,1)' }
  }
  // user：使用主题主色-强调色
  return { start: 'rgb(var(--st-primary))', end: 'rgb(var(--st-accent))' }
}

/**
 * 从头像 URL 提取主色，失败返回 null
 */
async function extractPaletteFromImage(url: string): Promise<Palette | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const w = canvas.width = 24
          const h = canvas.height = 24
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (!ctx) return resolve(null)
          
          ctx.drawImage(img, 0, 0, w, h)
          const data = ctx.getImageData(0, 0, w, h).data
          let r = 0, g = 0, b = 0, count = 0
          for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3] ?? 0
            if (a < 32) continue // 忽略透明像素
            r += data[i] ?? 0
            g += data[i + 1] ?? 0
            b += data[i + 2] ?? 0
            count++
          }
          if (!count) return resolve(null)
          r = Math.round(r / count)
          g = Math.round(g / count)
          b = Math.round(b / count)
          const start = rgbToCss({ r, g, b })
          const end = rgbToCss(lighten({ r, g, b }, 28))
          resolve({ start, end })
        } catch (_) {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = url
    } catch (_) {
      resolve(null)
    }
  })
}

/**
 * 提供消息色条渐变的获取与样式计算
 */
export function usePalette(): UsePaletteAPI {
  const palettes = ref<Record<string | number, Palette>>({})

  /**
   * 计算某消息的色条 CSS 变量映射
   */
  function stripeStyle(msg: ChatMessage): Record<string, string> {
    const pal = palettes.value[msg.id] || roleFallback(msg.role)
    return { '--stripe-start': pal.start, '--stripe-end': pal.end }
  }

  /**
   * 确保为消息准备好调色板（优先头像分析）
   */
  async function ensurePaletteFor(msg: ChatMessage): Promise<void> {
    let pal: Palette | null = null
    if (msg && msg.avatarUrl) {
      pal = await extractPaletteFromImage(msg.avatarUrl)
    }
    if (!pal) pal = roleFallback(msg?.role)
    palettes.value[msg.id] = pal
  }

  /**
   * 清除某条消息的缓存调色板
   */
  function clearPalette(id: string | number): void {
    if (id in palettes.value) {
      delete palettes.value[id]
    }
  }

  /**
   * 读取当前已缓存的调色板
   */
  function getPalette(idOrMsg: string | number | ChatMessage): Palette | null {
    const key = typeof idOrMsg === 'object' ? idOrMsg?.id : idOrMsg
    return key != null ? palettes.value[key] ?? null : null
  }

  return {
    palettes,
    ensurePaletteFor,
    stripeStyle,
    clearPalette,
    getPalette,
    roleFallback,
    extractPaletteFromImage,
  }
}

// 兼容默认导出
export default usePalette