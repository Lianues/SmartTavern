// 对话设置 Pinia Store (TypeScript)
// 用于管理当前对话的 settings.json（包含 preset, llm_config, character, persona, world_books, regex_rules 等）

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import ChatBranches from '@/services/chatBranches'
import { useMessagesStore } from './chatMessages'

// ========== 类型定义 ==========

/**
 * 对话设置接口
 */
export interface ChatSettings {
  /** 预设文件路径 */
  preset?: string
  /** LLM 配置文件路径 */
  llm_config?: string
  /** 角色卡文件路径 */
  character?: string
  /** 用户信息文件路径 */
  persona?: string
  /** 世界书文件路径数组 */
  world_books?: string[]
  /** 正则规则文件路径数组 */
  regex_rules?: string[]
  /** 其他设置字段 */
  [key: string]: any
}

/**
 * ChatBranches.settings API 响应接口
 */
interface ChatBranchesSettingsResponse {
  settings: ChatSettings
  [key: string]: any
}

// ========== Pinia Store ==========

export const useChatSettingsStore = defineStore('chatSettings', () => {
  // 当前 settings 对象
  const settings = ref<ChatSettings | null>(null)
  
  // 加载状态
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)

  // 计算属性：各个配置文件路径
  const presetFile = computed(() => settings.value?.preset || null)
  const llmConfigFile = computed(() => settings.value?.llm_config || null)
  const characterFile = computed(() => settings.value?.character || null)
  const personaFile = computed(() => settings.value?.persona || null)
  const worldBooksFiles = computed(() => settings.value?.world_books || [])
  const regexRulesFiles = computed(() => settings.value?.regex_rules || [])
  const type = computed(() => settings.value?.type || 'threaded')

  /**
   * 从当前对话加载 settings
   * 自动从 messages store 获取当前对话文件
   */
  async function loadSettings(): Promise<ChatSettings | null> {
    const messagesStore = useMessagesStore()
    const conversationFile = messagesStore.conversationFile
    
    if (!conversationFile) {
      error.value = 'No conversation file in messages store'
      console.warn('[chatSettings] No conversation file, cannot load settings')
      return null
    }

    loading.value = true
    error.value = null
    
    try {
      // 使用 ChatBranches.settings API 读取 settings.json
      const res = await (ChatBranches as any).settings({
        action: 'get',
        file: conversationFile
      }) as ChatBranchesSettingsResponse
      
      if (!res || !res.settings) {
        throw new Error('No settings found in response')
      }
      
      settings.value = res.settings
      
      console.log('[chatSettings] Loaded settings:', settings.value)
      return settings.value
    } catch (err) {
      error.value = (err as Error).message || 'Failed to load settings'
      console.error('[chatSettings] Failed to load:', err)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 刷新 settings（对话加载或切换时调用）
   */
  async function refresh(): Promise<ChatSettings | null> {
    return await loadSettings()
  }

  /**
   * 获取指定字段的值
   * @param key - settings 字段名（如 'preset', 'llm_config', 'character'）
   * @returns 字段值，如果不存在返回 undefined
   */
  function getField(key: string): any {
    if (!settings.value) {
      return undefined
    }
    return settings.value[key]
  }

  /**
   * 获取完整的 settings 对象
   * @returns settings 对象
   */
  function getSettings(): ChatSettings | null {
    return settings.value
  }

  /**
   * 检查是否有指定的配置文件
   * @param key - 配置字段名
   * @returns 是否存在
   */
  function hasField(key: string): boolean {
    return settings.value != null && settings.value[key] != null
  }

  /**
   * 清空当前状态
   */
  function clear(): void {
    settings.value = null
    error.value = null
  }

  return {
    // 状态
    settings,
    loading,
    error,
    
    // 计算属性（便捷访问）
    presetFile,
    llmConfigFile,
    characterFile,
    personaFile,
    worldBooksFiles,
    regexRulesFiles,
    type,
    
    // 方法
    loadSettings,
    refresh,
    getField,
    getSettings,
    hasField,
    clear
  }
})

export default useChatSettingsStore

// ========== 全局函数 API ==========

/**
 * 注册全局函数到 window 对象
 */
export interface RegisterGlobalFunctionsOptions {
  exposeToWindow?: boolean
}

export function registerGlobalFunctions({ exposeToWindow = false }: RegisterGlobalFunctionsOptions = {}): void {
  if (!exposeToWindow) return

  const store = useChatSettingsStore()

  // 获取当前对话的 settings
  const getChatSettings = (): ChatSettings | null => {
    return store.getSettings()
  }

  // 获取 settings 的特定字段
  const getChatSettingsField = (key: string): any => {
    if (typeof key !== 'string') {
      throw new Error('Key must be a string')
    }
    return store.getField(key)
  }

  // 注册到 window 对象
  try {
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'getChatSettings', {
        value: getChatSettings,
        writable: false,
        configurable: true
      })

      Object.defineProperty(window, 'getChatSettingsField', {
        value: getChatSettingsField,
        writable: false,
        configurable: true
      })
    }
  } catch (err) {
    console.error('[chatSettings] Failed to register global functions:', err)
  }
}

// ========== 全局类型声明 ==========

declare global {
  interface Window {
    getChatSettings(): ChatSettings | null
    getChatSettingsField(key: string): any
  }
}