// SmartTavern - 当前用户画像状态（Pinia Store TypeScript）与全局头像获取函数
// 目标：
//  1) 以 Pinia 存储"当前用户画像"的结构化状态（file/meta/avatar）
//  2) 提供状态驱动的刷新 action：从当前对话 settings 解析用户画像，并尝试加载 persona.png/persona.json
//  3) 暴露便捷函数 getCurrentPersonaAvatarPath（返回可直接用于 <img src> 的 URL；缺省返回内置默认头像）
//  4) 提供 registerGlobalFunctions()，注册 window.getPersonaAvatarPath 供 Vue 与前端沙盒 HTML 调用

import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useChatSettingsStore } from './chatSettings'
import DataCatalog from '@/services/dataCatalog'
import { i18n } from '@/locales'

// ========== 类型定义 ==========

/**
 * 用户画像元数据接口
 */
export interface PersonaMeta {
  name?: string
  description?: string
  [key: string]: any
}

/**
 * 用户画像状态接口
 */
export interface PersonaState {
  currentPersonaFile: string | null
  avatarUrl: string | null
  meta: PersonaMeta | null
  loading: boolean
  error: string
}

// ========== 内部工具 ==========

/** POSIX 路径拼接（确保仅使用 /） */
function toPosix(p: string): string {
  return String(p || '').replace(/\\/g, '/')
}

/** 取父目录 */
function dirname(p: string): string {
  const s = toPosix(p)
  return s.replace(/[^/]+$/, '')
}

/** 生成默认用户头像（圆角卡片字母占位）为 Data URL */
function buildDefaultUserAvatar(letter?: string): string {
  const defaultLetter = letter || i18n.t('stores.persona.defaultAvatarLetter')
  const size = 256
  const bg = '#DBEAFE'     // tailwind: blue-100
  const fg = '#1E3A8A'     // tailwind: blue-900
  const fontSize = 112
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${Math.round(size*0.18)}" fill="${bg}" />
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
        fill="${fg}" font-size="${fontSize}" font-weight="700" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'WenQuanYi Micro Hei', sans-serif">${defaultLetter}</text>
    </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** 尝试解析 JSON（失败返回 null） */
async function readJsonFromBlob(blob: Blob): Promise<PersonaMeta | null> {
  try {
    const text = await blob.text()
    try {
      return JSON.parse(text)
    } catch {
      // 再尝试以 UTF-8 解码（兼容某些编码路径；多数情况下与上面等价）
      const buf = await blob.arrayBuffer()
      const dec = new TextDecoder('utf-8', { fatal: false })
      const t2 = dec.decode(new Uint8Array(buf))
      return JSON.parse(t2)
    }
  } catch {
    return null
  }
}

/** 安全释放旧的 ObjectURL */
function safeRevoke(url: string | null): void {
  if (!url) return
  try { URL.revokeObjectURL(url) } catch {}
}

// ========== Pinia Store 定义 ==========

export const usePersonaStore = defineStore('persona', () => {
  // 状态
  const currentPersonaFile = ref<string | null>(null)   // backend_projects/.../personas/.../persona.json
  const avatarUrl = ref<string | null>(null)            // ObjectURL 或 data:URL
  const meta = ref<PersonaMeta | null>(null)            // 用户画像 JSON（可选）
  const loading = ref<boolean>(false)
  const error = ref<string>('')

  // 内部记录以便释放
  let __prevAvatar: string | null = null

  /** 从"对话文件"刷新当前用户画像状态：监听 chatSettings 自动响应 */
  async function refreshFromConversation(): Promise<void> {
    // 不再需要手动处理，由 watch 自动监听 chatSettings.personaFile
  }
  
  // 监听 chatSettings.personaFile 的变化，自动加载用户画像
  const chatSettingsStore = useChatSettingsStore()
  watch(
    () => chatSettingsStore.personaFile,
    async (newFile) => {
      const personaFile = toPosix(newFile || '')
      if (!personaFile) {
        _setAll(null, null, null)
        return
      }
      loading.value = true
      error.value = ''
      try {
        await refreshFromPersonaFile(personaFile)
      } catch (e) {
        error.value = (e as Error)?.message || String(e)
        _setAll(null, null, null)
      } finally {
        loading.value = false
      }
    },
    { immediate: true }
  )

  /** 直接从"用户画像文件路径"刷新状态（绕过 settings） */
  async function refreshFromPersonaFile(personaFile: string): Promise<void> {
    const pf = toPosix(personaFile || '')
    loading.value = true
    error.value = ''
    try {
      const dir = dirname(pf)
      let nextAvatar: string | null = null
      let nextMeta: PersonaMeta | null = null

      // 头像
      try {
        const { blob } = await (DataCatalog as any).getDataAssetBlob(`${dir}persona.png`)
        const url = URL.createObjectURL(blob)
        nextAvatar = url
      } catch {
        nextAvatar = null
      }

      // 元数据（可选）
      try {
        const { blob } = await (DataCatalog as any).getDataAssetBlob(pf)
        nextMeta = await readJsonFromBlob(blob)
      } catch {
        nextMeta = null
      }

      _setAll(pf, nextAvatar, nextMeta)
    } catch (e) {
      error.value = (e as Error)?.message || String(e)
      _setAll(null, null, null)
    } finally {
      loading.value = false
    }
  }

  function _setAll(pf: string | null, nextAvatar: string | null, nextMeta: PersonaMeta | null): void {
    currentPersonaFile.value = pf || null

    if (avatarUrl.value && avatarUrl.value !== nextAvatar) safeRevoke(__prevAvatar)
    __prevAvatar = nextAvatar
    avatarUrl.value = nextAvatar || null

    meta.value = nextMeta || null
  }

  /** 返回头像 URL（优先实际头像，其次默认头像 DataURL） */
  function getCurrentPersonaAvatarPathSync(letter?: string): string {
    return avatarUrl.value || buildDefaultUserAvatar(letter)
  }

  return {
    // 状态
    currentPersonaFile,
    avatarUrl,
    meta,
    loading,
    error,

    // 行为
    refreshFromConversation,
    refreshFromPersonaFile,

    // 工具
    getCurrentPersonaAvatarPathSync,
  }
})

export default usePersonaStore

// ========== 全局函数 ==========

/**
 * 全局函数：获取当前用户画像头像 URL
 * @returns 头像 URL（总是返回 URL 或默认头像）
 */
export function getPersonaAvatarPath(): string {
  const store = usePersonaStore()
  return store.getCurrentPersonaAvatarPathSync()
}

/**
 * 全局函数：获取用户画像的完整状态或指定字段
 * @param key - 可选，字段路径（如 'meta.name'）
 *              - 不传参数：返回当前用户画像完整状态
 *              - 传入字段路径：返回当前用户画像的指定字段
 * @returns 完整状态对象或指定字段的值
 */
export function getPersona(key?: string): any {
  try {
    const store = usePersonaStore()
    const state: PersonaState = {
      currentPersonaFile: store.currentPersonaFile,
      avatarUrl: store.avatarUrl,
      meta: store.meta,
      loading: store.loading,
      error: store.error,
    }

    // 不传参数，返回完整状态
    if (!key) {
      return state
    }

    // 解析嵌套键路径
    const keys = String(key).split('.')
    let value: any = state
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return undefined
      }
    }
    return value
  } catch (e) {
    console.error('[getCurrentPersona] Error:', e)
    return undefined
  }
}

/**
 * 注册全局函数到 window 对象
 * - 供 Vue 组件外/iframe 沙盒内脚本使用
 * - 建议在应用 bootstrap（Pinia 设置完成）后调用一次
 */
export interface RegisterGlobalFunctionsOptions {
  exposeToWindow?: boolean
}

export function registerGlobalFunctions({ exposeToWindow = true }: RegisterGlobalFunctionsOptions = {}): void {
  if (typeof window === 'undefined') return
  if (exposeToWindow) {
    try {
      Object.defineProperty(window, 'getPersonaAvatarPath', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: function (): string {
          return getPersonaAvatarPath()
        },
      })
      Object.defineProperty(window, 'getPersona', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: function (key?: string): any {
          return getPersona(key)
        },
      })
    } catch {
      // 回退直接赋值
      (window as any).getPersonaAvatarPath = () => getPersonaAvatarPath();
      (window as any).getPersona = (key?: string) => getPersona(key)
    }
  }
}

// 便于外部复用/测试：导出默认头像生成器
export function getDefaultUserAvatarDataURL(letter?: string): string {
  return buildDefaultUserAvatar(letter)
}

// ========== 全局类型声明 ==========

declare global {
  interface Window {
    getPersonaAvatarPath(): string
    getPersona(key?: string): any
  }
}