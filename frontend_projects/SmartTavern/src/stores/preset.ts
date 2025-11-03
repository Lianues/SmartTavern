// SmartTavern - 当前预设状态（Pinia Store TypeScript）与全局获取函数
// 目标：
//  1) 以 Pinia 存储"当前预设"的结构化状态（file/meta）
//  2) 提供状态驱动的刷新 action：从当前对话 settings 解析预设，并尝试加载 preset.json
//  3) 暴露便捷函数 getPreset（返回预设状态或指定字段）
//  4) 提供 registerGlobalFunctions()，注册 window.getPreset 供 Vue 与前端沙盒 HTML 调用

import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useChatSettingsStore } from './chatSettings'
import DataCatalog from '@/services/dataCatalog'

// ========== 类型定义 ==========

/**
 * 预设元数据接口
 */
export interface PresetMeta {
  name?: string
  description?: string
  [key: string]: any
}

/**
 * 预设状态接口
 */
export interface PresetState {
  currentPresetFile: string | null
  meta: PresetMeta | null
  loading: boolean
  error: string
}

// ========== 内部工具 ==========

/** POSIX 路径拼接（确保仅使用 /） */
function toPosix(p: string): string {
  return String(p || '').replace(/\\/g, '/')
}

/** 尝试解析 JSON（失败返回 null） */
async function readJsonFromBlob(blob: Blob): Promise<PresetMeta | null> {
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

export const usePresetStore = defineStore('preset', () => {
  // 状态
  const currentPresetFile = ref<string | null>(null)   // backend_projects/.../presets/.../preset.json
  const meta = ref<PresetMeta | null>(null)            // 预设 JSON（可选）
  const loading = ref<boolean>(false)
  const error = ref<string>('')

  /** 从"对话文件"刷新当前预设状态：监听 chatSettings 自动响应 */
  async function refreshFromConversation(): Promise<void> {
    // 不再需要手动处理，由 watch 自动监听 chatSettings.presetFile
  }
  
  // 监听 chatSettings.presetFile 的变化，自动加载预设
  const chatSettingsStore = useChatSettingsStore()
  watch(
    () => chatSettingsStore.presetFile,
    async (newFile) => {
      const presetFile = toPosix(newFile || '')
      if (!presetFile) {
        _setAll(null, null)
        return
      }
      loading.value = true
      error.value = ''
      try {
        await refreshFromPresetFile(presetFile)
      } catch (e) {
        error.value = (e as Error)?.message || String(e)
        _setAll(null, null)
      } finally {
        loading.value = false
      }
    },
    { immediate: true }
  )

  /** 直接从"预设文件路径"刷新状态（绕过 settings） */
  async function refreshFromPresetFile(presetFile: string): Promise<void> {
    const pf = toPosix(presetFile || '')
    loading.value = true
    error.value = ''
    try {
      let nextMeta: PresetMeta | null = null

      // 元数据
      try {
        const { blob } = await (DataCatalog as any).getDataAssetBlob(pf)
        nextMeta = await readJsonFromBlob(blob)
      } catch {
        nextMeta = null
      }

      _setAll(pf, nextMeta)
    } catch (e) {
      error.value = (e as Error)?.message || String(e)
      _setAll(null, null)
    } finally {
      loading.value = false
    }
  }

  function _setAll(pf: string | null, nextMeta: PresetMeta | null): void {
    currentPresetFile.value = pf || null
    meta.value = nextMeta || null
  }

  return {
    // 状态
    currentPresetFile,
    meta,
    loading,
    error,

    // 行为
    refreshFromConversation,
    refreshFromPresetFile,
  }
})

export default usePresetStore

// ========== 全局函数 ==========

/**
 * 全局函数：获取预设的完整状态或指定字段
 * @param key - 可选，字段路径（如 'meta.name'）
 *              - 不传参数：返回当前预设完整状态
 *              - 传入字段路径：返回当前预设的指定字段
 * @returns 完整状态对象或指定字段的值
 */
export function getPreset(key?: string): any {
  try {
    const store = usePresetStore()
    const state: PresetState = {
      currentPresetFile: store.currentPresetFile,
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
    console.error('[getPreset] Error:', e)
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
      Object.defineProperty(window, 'getPreset', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: function (key?: string): any {
          return getPreset(key)
        },
      })
    } catch {
      // 回退直接赋值
      (window as any).getPreset = (key?: string) => getPreset(key)
    }
  }
}

// ========== 全局类型声明 ==========

declare global {
  interface Window {
    getPreset(key?: string): any
  }
}