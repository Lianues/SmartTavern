// LLM 配置 Pinia Store (TypeScript)
// 用于管理当前对话使用的 LLM 配置状态

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import dataCatalog from '@/services/dataCatalog'
import { useChatSettingsStore } from './chatSettings'

// ========== 类型定义 ==========

/**
 * LLM 配置元数据接口
 */
export interface LLMConfigMeta {
  /** 供应商（如 'openai', 'anthropic' 等） */
  provider?: string
  /** 模型名称 */
  model?: string
  /** 温度参数 */
  temperature?: number
  /** 最大 tokens */
  max_tokens?: number
  /** API 密钥 */
  api_key?: string
  /** 其他配置字段 */
  [key: string]: any
}

/**
 * LLM 配置详情响应接口
 */
export interface LLMConfigDetailResponse {
  content: LLMConfigMeta
  [key: string]: any
}

// ========== Pinia Store ==========

export const useLlmConfigStore = defineStore('llmConfig', () => {
  // 当前 LLM 配置文件路径
  const currentLlmConfigFile = ref<string | null>(null)
  
  // 当前 LLM 配置元数据（与其他 stores 保持一致的命名）
  const meta = ref<LLMConfigMeta | null>(null)
  
  // 加载状态
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)

  /**
   * 从当前对话的 settings 加载 LLM 配置：监听 chatSettings 自动响应
   */
  async function loadLlmConfigFromConversation(): Promise<LLMConfigMeta | null> {
    // 不再需要手动处理，由 watch 自动监听 chatSettings.llmConfigFile
    return null
  }
  
  // 监听 chatSettings.llmConfigFile 的变化，自动加载 LLM 配置
  const chatSettingsStore = useChatSettingsStore()
  watch(
    () => chatSettingsStore.llmConfigFile,
    async (newFile) => {
      if (!newFile) {
        error.value = 'No llm_config found in chat settings'
        currentLlmConfigFile.value = null
        meta.value = null
        return
      }

      loading.value = true
      error.value = null
      
      try {
        await loadLlmConfigFile(newFile)
      } catch (err) {
        error.value = (err as Error).message || 'Failed to load LLM config'
        console.error('[llmConfig] Failed to load:', err)
      } finally {
        loading.value = false
      }
    },
    { immediate: true }
  )

  /**
   * 直接加载指定的 llm_config 文件
   * @param llmConfigFile - LLM 配置文件路径
   * @returns LLM 配置元数据
   */
  async function loadLlmConfigFile(llmConfigFile: string): Promise<LLMConfigMeta | null> {
    if (!llmConfigFile) {
      error.value = 'No LLM config file provided'
      return null
    }

    loading.value = true
    error.value = null
    
    try {
      const result: LLMConfigDetailResponse = await dataCatalog.getLLMConfigDetail(llmConfigFile)
      
      if (!result || !result.content) {
        throw new Error('Failed to load LLM config file')
      }
      
      currentLlmConfigFile.value = llmConfigFile
      meta.value = result.content
      
      return meta.value
    } catch (err) {
      error.value = (err as Error).message || 'Failed to load LLM config file'
      console.error('[llmConfig] Failed to load file:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取当前 LLM 配置
   * @returns 当前 LLM 配置对象
   */
  function getLlmConfig(): LLMConfigMeta | null {
    return meta.value
  }

  /**
   * 获取当前 LLM 配置的特定字段
   * @param key - 配置字段名（如 'provider', 'model', 'temperature'）
   * @returns 字段值，如果不存在返回 undefined
   */
  function getLlmConfigField<K extends keyof LLMConfigMeta>(key: K): LLMConfigMeta[K] | undefined
  function getLlmConfigField(key: string): any
  function getLlmConfigField(key: string): any {
    if (!meta.value) {
      return undefined
    }
    return meta.value[key]
  }

  /**
   * 从当前对话刷新 LLM 配置
   */
  async function refreshFromConversation(): Promise<LLMConfigMeta | null> {
    return await loadLlmConfigFromConversation()
  }

  /**
   * 清空当前状态
   */
  function clear(): void {
    currentLlmConfigFile.value = null
    meta.value = null
    error.value = null
  }

  return {
    // 状态
    currentLlmConfigFile,
    meta,
    loading,
    error,
    
    // 方法
    loadLlmConfigFromConversation,
    loadLlmConfigFile,
    getLlmConfig,
    getLlmConfigField,
    refreshFromConversation,
    clear
  }
})

export default useLlmConfigStore

// ========== 全局函数 API ==========

/**
 * 注册全局函数到 window 对象
 */
export interface RegisterGlobalFunctionsOptions {
  exposeToWindow?: boolean
}

export function registerGlobalFunctions({ exposeToWindow = false }: RegisterGlobalFunctionsOptions = {}): void {
  if (!exposeToWindow) return

  const store = useLlmConfigStore()

  // 获取当前 LLM 配置
  const getLlmConfig = (): LLMConfigMeta | null => {
    return store.getLlmConfig()
  }

  // 获取 LLM 配置字段
  const getLlmConfigField = (key: string): any => {
    if (typeof key !== 'string') {
      throw new Error('Key must be a string')
    }
    return store.getLlmConfigField(key)
  }

  // 注册到 window 对象
  try {
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'getLlmConfig', {
        value: getLlmConfig,
        writable: false,
        configurable: true
      })

      Object.defineProperty(window, 'getLlmConfigField', {
        value: getLlmConfigField,
        writable: false,
        configurable: true
      })
    }
  } catch (err) {
    console.error('[llmConfig] Failed to register global functions:', err)
  }
}

// ========== 全局类型声明 ==========

declare global {
  interface Window {
    getLlmConfig(): LLMConfigMeta | null
    getLlmConfigField(key: string): any
  }
}