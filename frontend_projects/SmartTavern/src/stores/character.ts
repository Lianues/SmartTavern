// SmartTavern - 当前角色卡状态（Pinia Store）与全局头像获取函数 (TypeScript)
// 目标：
//  1) 以 Pinia 存储"当前角色卡"的结构化状态（file/meta/icon/avatar）
//  2) 提供状态驱动的刷新 action：从当前对话 settings 解析角色卡，并尝试加载 character.png/icon.png/character.json
//  3) 暴露便捷函数 getCurrentCharAvatarPath（返回可直接用于 <img src> 的 URL；缺省返回内置默认头像）
//  4) 提供 registerGlobalFunctions()，注册 window.getCurrentCharAvatarPath 供 Vue 与前端沙盒 HTML 调用

import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useChatSettingsStore } from './chatSettings'
import DataCatalog from '@/services/dataCatalog'
import { i18n } from '@/locales'

// DataCatalog 是 JS 模块，需要类型断言
const DataCatalogTyped = DataCatalog as any

// ========== 类型定义 ==========

/**
 * 角色卡元数据接口
 */
export interface CharacterMeta {
  /** 角色名称 */
  name?: string
  /** 角色描述 */
  description?: string
  /** 其他元数据字段 */
  [key: string]: any
}

/**
 * 角色卡状态接口
 */
export interface CharacterState {
  /** 当前角色卡文件路径 */
  currentCharacterFile: string | null
  /** 头像 URL（ObjectURL 或 data:URL） */
  avatarUrl: string | null
  /** 图标 URL（ObjectURL 或 data:URL，可选） */
  iconUrl: string | null
  /** 角色卡元数据 */
  meta: CharacterMeta | null
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string
}

/**
 * DataCatalog API 响应接口
 */
interface DataCatalogBlobResponse {
  blob: Blob
  [key: string]: any
}

// ========== 内部工具 ==========

/** POSIX 路径拼接（确保仅使用 /） */
function toPosix(p: string | null | undefined): string {
  return String(p || '').replace(/\\/g, '/')
}

/** 取父目录 */
function dirname(p: string): string {
  const s = toPosix(p)
  return s.replace(/[^/]+$/, '')
}

/** 生成默认头像（圆角卡片字母占位）为 Data URL */
function buildDefaultAssistantAvatar(letter?: string): string {
  const defaultLetter = letter || i18n.t('stores.character.defaultAvatarLetter')
  const size = 256
  const bg = '#E5E7EB'     // tailwind: gray-200
  const fg = '#111827'     // tailwind: gray-900
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
async function readJsonFromBlob(blob: Blob): Promise<CharacterMeta | null> {
  try {
    const text = await blob.text()
    try {
      return JSON.parse(text) as CharacterMeta
    } catch {
      // 再尝试以 UTF-8 解码（兼容某些编码路径；多数情况下与上面等价）
      const buf = await blob.arrayBuffer()
      const dec = new TextDecoder('utf-8', { fatal: false })
      const t2 = dec.decode(new Uint8Array(buf))
      return JSON.parse(t2) as CharacterMeta
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

export const useCharacterStore = defineStore('character', () => {
  // 状态
  const currentCharacterFile = ref<string | null>(null)   // backend_projects/.../characters/.../character.json
  const avatarUrl = ref<string | null>(null)              // ObjectURL 或 data:URL
  const iconUrl = ref<string | null>(null)                // ObjectURL 或 data:URL（可选）
  const meta = ref<CharacterMeta | null>(null)            // 角色卡 JSON（可选）
  const loading = ref<boolean>(false)
  const error = ref<string>('')

  // 内部记录以便释放
  let __prevAvatar: string | null = null
  let __prevIcon: string | null = null

  /** 从"对话文件"刷新当前角色卡状态：监听 chatSettings 自动响应 */
  async function refreshFromConversation(): Promise<void> {
    // 不再需要手动处理，由 watch 自动监听 chatSettings.characterFile
    // 这个方法保留是为了保持 API 兼容性
  }
  
  // 监听 chatSettings.characterFile 的变化，自动加载角色卡
  const chatSettingsStore = useChatSettingsStore()
  watch(
    () => chatSettingsStore.characterFile,
    async (newFile) => {
      const characterFile = toPosix(newFile)
      if (!characterFile) {
        _setAll(null, null, null, null)
        return
      }
      loading.value = true
      error.value = ''
      try {
        await refreshFromCharacterFile(characterFile)
      } catch (e) {
        error.value = (e as Error)?.message || String(e)
        _setAll(null, null, null, null)
      } finally {
        loading.value = false
      }
    },
    { immediate: true }
  )

  /** 直接从"角色卡文件路径"刷新状态（绕过 settings） */
  async function refreshFromCharacterFile(characterFile: string): Promise<void> {
    const cf = toPosix(characterFile)
    loading.value = true
    error.value = ''
    try {
      const dir = dirname(cf)
      let nextAvatar: string | null = null
      let nextIcon: string | null = null
      let nextMeta: CharacterMeta | null = null

      // 头像
      try {
        const { blob } = await DataCatalogTyped.getDataAssetBlob(`${dir}character.png`) as DataCatalogBlobResponse
        const url = URL.createObjectURL(blob)
        nextAvatar = url
      } catch {
        nextAvatar = null
      }

      // 图标（可选）
      try {
        const { blob } = await DataCatalogTyped.getDataAssetBlob(`${dir}icon.png`) as DataCatalogBlobResponse
        const url = URL.createObjectURL(blob)
        nextIcon = url
      } catch {
        nextIcon = null
      }

      // 元数据（可选）
      try {
        const { blob } = await DataCatalogTyped.getDataAssetBlob(cf) as DataCatalogBlobResponse
        nextMeta = await readJsonFromBlob(blob)
      } catch {
        nextMeta = null
      }

      _setAll(cf, nextAvatar, nextIcon, nextMeta)
    } catch (e) {
      error.value = (e as Error)?.message || String(e)
      _setAll(null, null, null, null)
    } finally {
      loading.value = false
    }
  }

  function _setAll(
    cf: string | null,
    nextAvatar: string | null,
    nextIcon: string | null,
    nextMeta: CharacterMeta | null
  ): void {
    currentCharacterFile.value = cf || null

    if (avatarUrl.value && avatarUrl.value !== nextAvatar) safeRevoke(__prevAvatar)
    __prevAvatar = nextAvatar
    avatarUrl.value = nextAvatar || null

    if (iconUrl.value && iconUrl.value !== nextIcon) safeRevoke(__prevIcon)
    __prevIcon = nextIcon
    iconUrl.value = nextIcon || null

    meta.value = nextMeta || null
  }

  /** 返回头像 URL（优先实际头像，其次默认头像 DataURL） */
  function getCurrentCharAvatarPathSync(letter?: string): string {
    return avatarUrl.value || buildDefaultAssistantAvatar(letter)
  }

  return {
    // 状态
    currentCharacterFile,
    avatarUrl,
    iconUrl,
    meta,
    loading,
    error,

    // 行为
    refreshFromConversation,
    refreshFromCharacterFile,

    // 工具
    getCurrentCharAvatarPathSync,
  }
})

export default useCharacterStore

// ========== 全局函数 API ==========

/**
 * 全局函数：获取当前角色卡头像 URL
 * @param name - 可选的角色名称（用于生成默认头像）
 * @returns 头像 URL（总是返回 URL 或默认头像）
 */
export function getCharAvatarPath(name?: string): string {
  const store = useCharacterStore()
  return store.getCurrentCharAvatarPathSync(name)
}

/**
 * 全局函数：获取角色卡的完整状态或指定字段
 * @param key - 可选，字段路径（如 'meta.name'）
 *              - 不传参数：返回当前角色卡完整状态
 *              - 传入字段路径：返回当前角色卡的指定字段
 * @returns 完整状态对象或指定字段的值
 */
export function getChar(key?: string): any {
  try {
    const store = useCharacterStore()
    const state: CharacterState = {
      currentCharacterFile: store.currentCharacterFile,
      avatarUrl: store.avatarUrl,
      iconUrl: store.iconUrl,
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
    console.error('[getCurrentChar] Error:', e)
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
      Object.defineProperty(window, 'getCharAvatarPath', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: async function (name?: string): Promise<string> {
          return await getCharAvatarPath(name)
        },
      })
      Object.defineProperty(window, 'getChar', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: function (key?: string): any {
          return getChar(key)
        },
      })
    } catch {
      // 回退直接赋值
      (window as any).getCharAvatarPath = async (name?: string) => await getCharAvatarPath(name);
      (window as any).getChar = (key?: string) => getChar(key)
    }
  }
}

// 便于外部复用/测试：导出默认头像生成器
export function getDefaultAssistantAvatarDataURL(letter?: string): string {
  return buildDefaultAssistantAvatar(letter)
}

// ========== 全局类型声明 ==========

declare global {
  interface Window {
    getCharAvatarPath(name?: string): Promise<string>
    getChar(key?: string): any
  }
}