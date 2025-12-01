// SmartTavern - 当前世界书列表状态（Pinia Store TypeScript）与全局获取函数
// 目标：
//  1) 以 Pinia 存储"当前世界书列表"的结构化状态（files/metas）
//  2) 提供状态驱动的刷新 action：从当前对话 settings 解析世界书列表，并尝试加载各个 worldbook.json
//  3) 暴露便捷函数 getWorldBooks（返回世界书列表状态或指定字段）
//  4) 提供 registerGlobalFunctions()，注册 window.getWorldBooks 供 Vue 与前端沙盒 HTML 调用

import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useChatSettingsStore } from './chatSettings'
import DataCatalog from '@/services/dataCatalog'

// ========== 类型定义 ==========

/**
 * 世界书元数据接口
 */
export interface WorldBookMeta {
  name?: string
  description?: string
  [key: string]: any
}

/**
 * 世界书状态接口
 */
export interface WorldBooksState {
  currentWorldBookFiles: string[]
  metas: Record<string, WorldBookMeta | null>
  loading: boolean
  error: string
}

// ========== 内部工具 ==========

/** POSIX 路径拼接（确保仅使用 /） */
function toPosix(p: string): string {
  return String(p || '').replace(/\\/g, '/')
}

/** 尝试解析 JSON（失败返回 null） */
async function readJsonFromBlob(blob: Blob): Promise<WorldBookMeta | null> {
  try {
    const text = await blob.text()
    try {
      return JSON.parse(text)
    } catch {
      const buf = await blob.arrayBuffer()
      const dec = new TextDecoder('utf-8', { fatal: false })
      const t2 = dec.decode(new Uint8Array(buf))
      return JSON.parse(t2)
    }
  } catch {
    return null
  }
}

// ========== Pinia Store 定义 ==========

export const useWorldBooksStore = defineStore('worldBooks', () => {
  // 状态：存储多个世界书文件路径及其元数据
  const currentWorldBookFiles = ref<string[]>([])  // Array<string>: backend_projects/.../world_books/.../worldbook.json
  const metas = ref<Record<string, WorldBookMeta | null>>({})  // { [file: string]: meta } 世界书元数据字典
  const loading = ref<boolean>(false)
  const error = ref<string>('')

  /** 从"对话文件"刷新当前世界书列表状态：监听 chatSettings 自动响应 */
  async function refreshFromConversation(): Promise<void> {
    // 不再需要手动处理，由 watch 自动监听 chatSettings.worldBooksFiles
  }
  
  // 监听 chatSettings.worldBooksFiles 的变化，自动加载世界书
  const chatSettingsStore = useChatSettingsStore()
  watch(
    () => chatSettingsStore.worldBooksFiles,
    async (newFiles) => {
      const worldBookFiles = Array.isArray(newFiles)
        ? newFiles.map(f => toPosix(f))
        : []
      
      if (!worldBookFiles.length) {
        _setAll([], {})
        return
      }
      
      loading.value = true
      error.value = ''
      try {
        await refreshFromWorldBookFiles(worldBookFiles)
      } catch (e) {
        error.value = (e as Error)?.message || String(e)
        _setAll([], {})
      } finally {
        loading.value = false
      }
    },
    { immediate: true, deep: true }
  )

  /** 直接从"世界书文件路径列表"刷新状态（绕过 settings） */
  async function refreshFromWorldBookFiles(worldBookFiles: string[]): Promise<void> {
    const files = Array.isArray(worldBookFiles) 
      ? worldBookFiles.map(f => toPosix(f)).filter(Boolean)
      : []
    
    loading.value = true
    error.value = ''
    try {
      const nextMetas: Record<string, WorldBookMeta | null> = {}

      // 并发加载所有世界书的元数据
      await Promise.all(
        files.map(async (wbFile) => {
          try {
            const { blob } = await (DataCatalog as any).getDataAssetBlob(wbFile)
            const meta = await readJsonFromBlob(blob)
            nextMetas[wbFile] = meta
          } catch {
            nextMetas[wbFile] = null
          }
        })
      )

      _setAll(files, nextMetas)
    } catch (e) {
      error.value = (e as Error)?.message || String(e)
      _setAll([], {})
    } finally {
      loading.value = false
    }
  }

  function _setAll(files: string[], nextMetas: Record<string, WorldBookMeta | null>): void {
    currentWorldBookFiles.value = files || []
    metas.value = nextMetas || {}
  }

  return {
    // 状态
    currentWorldBookFiles,
    metas,
    loading,
    error,

    // 行为
    refreshFromConversation,
    refreshFromWorldBookFiles,
  }
})

export default useWorldBooksStore

// ========== 全局函数 ==========

/**
 * 全局函数：获取世界书列表的完整状态或指定字段
 * @param key - 可选，字段路径
 *              - 不传参数：返回完整状态 { currentWorldBookFiles, metas, loading, error }
 *              - 传入字段路径（如 'metas'）：返回指定字段
 * @returns 完整状态对象或指定字段的值
 */
export function getWorldBooks(key?: string): any {
  try {
    const store = useWorldBooksStore()
    const state: WorldBooksState = {
      currentWorldBookFiles: store.currentWorldBookFiles,
      metas: store.metas,
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
    console.error('[getWorldBooks] Error:', e)
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
      Object.defineProperty(window, 'getWorldBooks', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: function (key?: string): any {
          return getWorldBooks(key)
        },
      })
    } catch {
      // 回退直接赋值
      (window as any).getWorldBooks = (key?: string) => getWorldBooks(key)
    }
  }
}

// ========== 全局类型声明 ==========

declare global {
  interface Window {
    getWorldBooks(key?: string): any
  }
}