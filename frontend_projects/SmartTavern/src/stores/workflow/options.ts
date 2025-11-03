// Pinia Store - Options Panel (TypeScript)
// 职责：管理选项显示面板，支持单选、多选、不定项三种类型

import { defineStore } from 'pinia'
import { ref } from 'vue'

// ========== 类型定义 ==========

/**
 * 选项类型
 */
export type OptionType = 'single' | 'multiple' | 'any'

/**
 * 单个选项接口
 */
export interface OptionItem {
  /** 显示标签 */
  label: string
  /** 实际值 */
  value: any
}

/**
 * 选项配置接口
 */
export interface OptionsConfig {
  /** 唯一标识符 */
  id?: string
  /** 选项类型 */
  type?: OptionType
  /** 标题 */
  title?: string
  /** 副标题 */
  subtitle?: string
  /** 内容文本 */
  message?: string
  /** 选项数组 */
  options?: Array<string | OptionItem>
  /** 时间戳 */
  ts?: number
}

/**
 * 规范化后的选项对象（内部使用）
 */
export interface NormalizedOption {
  /** 唯一标识符 */
  id: string
  /** 选项类型 */
  type: OptionType
  /** 标题 */
  title: string
  /** 副标题 */
  subtitle: string
  /** 内容文本 */
  message: string
  /** 规范化的选项数组 */
  options: OptionItem[]
  /** 当前选中的值数组 */
  selected: any[]
  /** Promise resolve 函数 */
  resolve: ((value: any) => void) | null
  /** Promise reject 函数 */
  reject: ((reason?: any) => void) | null
  /** 时间戳 */
  ts: number
}

// ========== 工具函数 ==========

/**
 * 规范化选项对象
 */
function normalizeOption(option: OptionsConfig & { 
  resolve?: (value: any) => void
  reject?: (reason?: any) => void
} = {}): NormalizedOption {
  // 选项数组规范化
  const options = Array.isArray(option.options)
    ? option.options.map(opt => {
        if (typeof opt === 'string') {
          return { label: opt, value: opt }
        }
        return {
          label: String(opt.label ?? opt.value ?? ''),
          value: opt.value ?? opt.label ?? ''
        }
      })
    : []

  return {
    id: String(option.id ?? Date.now()),
    type: option.type || 'single',
    title: option.title || '',
    subtitle: option.subtitle || '',
    message: option.message || '',
    options: options,
    selected: [],
    resolve: option.resolve || null,
    reject: option.reject || null,
    ts: Number.isFinite(option.ts) ? Number(option.ts) : Date.now(),
  }
}

// ========== Pinia Store ==========

export const useOptionsStore = defineStore('options', () => {
  // 当前显示的选项面板
  const current = ref<NormalizedOption | null>(null)

  /**
   * 显示选项面板
   * @param config - 配置对象
   * @returns Promise，解析为用户选择的值
   */
  function show(config: OptionsConfig = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const option = normalizeOption({
        ...config,
        resolve,
        reject
      })

      current.value = option
    })
  }

  /**
   * 切换选项选中状态（仅用于多选和不定项）
   * @param value - 选项值
   */
  function toggleSelection(value: any): void {
    if (!current.value) return

    const selected = current.value.selected
    const index = selected.indexOf(value)
    
    if (index >= 0) {
      // 已选中，移除
      selected.splice(index, 1)
    } else {
      // 未选中，添加
      selected.push(value)
    }
  }

  /**
   * 确认选择
   * @param result - 选择结果
   */
  function confirm(result: any): void {
    if (!current.value) return

    const { resolve } = current.value

    try {
      if (resolve) resolve(result)
    } catch (e) {
      console.error('[OptionsStore] confirm error:', e)
    }

    current.value = null
  }

  /**
   * 取消选择
   */
  function cancel(): void {
    if (!current.value) return

    const { reject } = current.value

    try {
      if (reject) reject(new Error('User cancelled'))
    } catch (e) {
      console.error('[OptionsStore] cancel error:', e)
    }

    current.value = null
  }

  /**
   * 清除当前面板
   */
  function clear(): void {
    current.value = null
  }

  return {
    current,
    show,
    toggleSelection,
    confirm,
    cancel,
    clear,
  }
})

export default useOptionsStore

// ========== 全局函数 API ==========

/**
 * showOptions 函数接口（包含快捷方法）
 */
export interface ShowOptionsFunction {
  (config: OptionsConfig): Promise<any>
  single(config: OptionsConfig): Promise<any>
  multiple(config: OptionsConfig): Promise<any[]>
  any(config: OptionsConfig): Promise<any[]>
}

/**
 * 显示选项面板
 * @param config - 配置对象
 * @returns Promise，解析为用户选择的值
 */
export const showOptions: ShowOptionsFunction = async function(config: OptionsConfig): Promise<any> {
  try {
    const store = useOptionsStore()
    return await store.show(config)
  } catch (e) {
    console.error('[showOptions] Error:', e)
    throw e
  }
} as ShowOptionsFunction

/**
 * 显示单选面板（快捷方法）
 * @param config - 配置对象（type 固定为 'single'）
 * @returns Promise，解析为用户选择的值
 */
showOptions.single = async function(config: OptionsConfig): Promise<any> {
  return await showOptions({ ...config, type: 'single' })
}

/**
 * 显示多选面板（快捷方法）
 * @param config - 配置对象（type 固定为 'multiple'）
 * @returns Promise，解析为用户选择的值数组
 */
showOptions.multiple = async function(config: OptionsConfig): Promise<any[]> {
  return await showOptions({ ...config, type: 'multiple' })
}

/**
 * 显示不定项面板（快捷方法）
 * @param config - 配置对象（type 固定为 'any'）
 * @returns Promise，解析为用户选择的值数组
 */
showOptions.any = async function(config: OptionsConfig): Promise<any[]> {
  return await showOptions({ ...config, type: 'any' })
}

/**
 * 注册全局函数到 window 对象
 */
export interface RegisterGlobalFunctionsOptions {
  exposeToWindow?: boolean
}

export function registerGlobalFunctions({ exposeToWindow = true }: RegisterGlobalFunctionsOptions = {}): void {
  if (typeof window === 'undefined') return
  if (exposeToWindow) {
    try {
      Object.defineProperty(window, 'showOptions', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: showOptions,
      })
    } catch {
      // 回退直接赋值
      (window as any).showOptions = showOptions
    }
  }
}

// ========== 全局类型声明 ==========

declare global {
  interface Window {
    showOptions: ShowOptionsFunction
  }
}