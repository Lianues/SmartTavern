// Pinia Store - Toasts (TypeScript)
// 职责：管理轻量提示队列（push/remove/clear），支持可选自动销毁。

import { defineStore } from 'pinia'

// ========== 类型定义 ==========

/**
 * Toast 类型
 */
export type ToastType = 'info' | 'success' | 'warning' | 'error'

/**
 * Toast 配置接口
 */
export interface ToastConfig {
  /** 唯一标识符 */
  id?: string
  /** 提示类型 */
  type?: ToastType
  /** 提示消息 */
  message?: string
  /** 时间戳 */
  ts?: number
  /** 超时时间（毫秒） */
  timeout?: number
  /** 是否自动销毁 */
  autoDismiss?: boolean
}

/**
 * 规范化后的 Toast 对象
 */
export interface Toast {
  /** 唯一标识符 */
  id: string
  /** 提示类型 */
  type: ToastType
  /** 提示消息 */
  message: string
  /** 时间戳 */
  ts: number
  /** 超时时间（毫秒） */
  timeout: number
}

// ========== 工具函数 ==========

/**
 * 规范化 toast 对象
 */
function normalize(toast: ToastConfig = {}): Toast {
  return {
    id: String(toast.id ?? Date.now()),
    type: toast.type || 'info',
    message: String(toast.message ?? ''),
    ts: Number.isFinite(toast.ts) ? Number(toast.ts) : Date.now(),
    timeout: Number.isFinite(toast.timeout) ? Number(toast.timeout) : 4000,
  }
}

// ========== Pinia Store ==========

export const useToastsStore = defineStore('toasts', {
  state: () => ({
    /** Toast 队列 */
    queue: [] as Toast[],
  }),

  getters: {
    /**
     * 获取只读快照（数组引用仍可变更，请组件侧视为只读使用）
     */
    list: (state): Toast[] => state.queue,
  },

  actions: {
    /**
     * 推入一条提示
     * @param toast - Toast 配置
     * @returns 规范化后的 Toast 对象
     */
    push(toast: ToastConfig = {}): Toast {
      const t = normalize(toast)
      this.queue.push(t)

      // 可选自动销毁
      if (toast.autoDismiss !== false && t.timeout > 0) {
        try {
          setTimeout(() => { this.remove(t.id) }, t.timeout)
        } catch {
          /* ignore env without timers */
        }
      }
      return t
    },

    /**
     * 批量替换（用于一次性恢复队列）
     * @param list - Toast 配置数组
     */
    replaceAll(list: ToastConfig[] = []): void {
      const next = list.map(normalize)
      this.queue.splice(0, this.queue.length, ...next)
    },

    /**
     * 移除指定 id 的提示
     * @param id - Toast ID
     */
    remove(id: string): void {
      const i = this.queue.findIndex(x => x.id === id)
      if (i >= 0) this.queue.splice(i, 1)
    },

    /**
     * 清空队列
     */
    clear(): void {
      this.queue.splice(0, this.queue.length)
    },
  },
})

export default useToastsStore

// ========== 全局函数 API ==========

/**
 * showToast 函数的参数类型
 */
export type ShowToastOptions = string | ToastConfig

/**
 * showToast 函数接口（包含快捷方法）
 */
export interface ShowToastFunction {
  (options: ShowToastOptions): Toast | null
  success(message: string, timeout?: number): Toast | null
  error(message: string, timeout?: number): Toast | null
  warning(message: string, timeout?: number): Toast | null
  info(message: string, timeout?: number): Toast | null
}

/**
 * 显示 Toast 提示
 * @param options - 消息内容或配置对象
 * @returns Toast 对象，包含 id 等信息
 */
export const showToast: ShowToastFunction = function(options: ShowToastOptions): Toast | null {
  try {
    const store = useToastsStore()
    
    // 支持字符串快捷方式
    if (typeof options === 'string') {
      return store.push({ message: options, type: 'info' })
    }
    
    return store.push(options)
  } catch (e) {
    console.error('[showToast] Error:', e)
    return null
  }
} as ShowToastFunction

/**
 * 显示成功提示
 * @param message - 消息内容
 * @param timeout - 可选的超时时间（毫秒）
 */
showToast.success = function(message: string, timeout?: number): Toast | null {
  return showToast({ type: 'success', message, timeout })
}

/**
 * 显示错误提示
 * @param message - 消息内容
 * @param timeout - 可选的超时时间（毫秒）
 */
showToast.error = function(message: string, timeout?: number): Toast | null {
  return showToast({ type: 'error', message, timeout })
}

/**
 * 显示警告提示
 * @param message - 消息内容
 * @param timeout - 可选的超时时间（毫秒）
 */
showToast.warning = function(message: string, timeout?: number): Toast | null {
  return showToast({ type: 'warning', message, timeout })
}

/**
 * 显示信息提示
 * @param message - 消息内容
 * @param timeout - 可选的超时时间（毫秒）
 */
showToast.info = function(message: string, timeout?: number): Toast | null {
  return showToast({ type: 'info', message, timeout })
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
      Object.defineProperty(window, 'showToast', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: showToast,
      })
    } catch {
      // 回退直接赋值
      (window as any).showToast = showToast
    }
  }
}

// ========== 全局类型声明 ==========

declare global {
  interface Window {
    showToast: ShowToastFunction
  }
}