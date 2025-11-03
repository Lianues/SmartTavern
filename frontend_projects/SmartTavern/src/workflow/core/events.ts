// SmartTavern Workflow - Core Events (Emitter v1, TypeScript)
// 作用：提供轻量事件总线，供 Host 与各插槽工作流使用。
// 特点：
// - on/once/off/emit/clear API
// - 返回 off 函数便于解除绑定
// - 安全调用监听器（try/catch），避免单个监听器影响全局
// - 无第三方依赖，纯 TypeScript

/**
 * 事件监听器类型
 */
export type EventListener<T = any> = (payload: T) => void | Promise<void>

/**
 * 解除订阅函数类型
 */
export type OffFunction = () => void

/**
 * 事件总线接口
 */
export interface EventEmitter {
  on<T = any>(event: string, callback: EventListener<T>): OffFunction
  once<T = any>(event: string, callback: EventListener<T>): OffFunction
  off(event: string, callback?: EventListener): void
  emit<T = any>(event: string, payload?: T): number
  clear(): void
  listenerCount(event: string): number
}

/**
 * 创建轻量事件总线
 * @returns 事件总线实例
 */
export function createEmitter(): EventEmitter {
  const all = new Map<string, Set<EventListener>>()

  function ensureSet(key: string): Set<EventListener> {
    let set = all.get(key)
    if (!set) {
      set = new Set()
      all.set(key, set)
    }
    return set
  }

  /**
   * 订阅事件
   * @param event 事件名称
   * @param cb 回调函数
   * @returns off 解除函数
   */
  function on<T = any>(event: string, cb: EventListener<T>): OffFunction {
    const key = String(event || '')
    if (!key) throw new Error('[events.on] event required')
    if (typeof cb !== 'function') throw new Error('[events.on] callback must be function')
    const set = ensureSet(key)
    set.add(cb as EventListener)
    return () => off(key, cb as EventListener)
  }

  /**
   * 一次性订阅
   * @param event 事件名称
   * @param cb 回调函数
   * @returns off 解除函数
   */
  function once<T = any>(event: string, cb: EventListener<T>): OffFunction {
    const key = String(event || '')
    if (!key) throw new Error('[events.once] event required')
    if (typeof cb !== 'function') throw new Error('[events.once] callback must be function')
    const offFn = on(key, (payload: T) => {
      try { cb(payload) }
      finally { offFn() }
    })
    return offFn
  }

  /**
   * 解除订阅
   * @param event 事件名称
   * @param cb 回调函数（可选，不传则解除该事件的所有监听器）
   */
  function off(event: string, cb?: EventListener): void {
    const key = String(event || '')
    const set = all.get(key)
    if (!set) return
    if (cb) {
      set.delete(cb)
      if (set.size === 0) all.delete(key)
    } else {
      all.delete(key)
    }
  }

  /**
   * 派发事件
   * @param event 事件名称
   * @param payload 事件负载
   * @returns 调用的监听器数量
   */
  function emit<T = any>(event: string, payload?: T): number {
    const key = String(event || '')
    const set = all.get(key)
    if (!set || set.size === 0) return 0
    let called = 0
    // 复制快照，防止监听器内 on/off 影响当前循环
    const listeners = Array.from(set)
    for (const fn of listeners) {
      try {
        fn(payload)
        called++
      } catch (e) {
        // 避免单个监听器异常中断总线
        console.warn('[events.emit] listener error for', key, e)
      }
    }
    return called
  }

  /** 清空所有事件监听 */
  function clear(): void {
    all.clear()
  }

  /** 获取某事件监听数量 */
  function listenerCount(event: string): number {
    const key = String(event || '')
    return all.get(key)?.size || 0
  }

  return { on, once, off, emit, clear, listenerCount }
}

export default createEmitter