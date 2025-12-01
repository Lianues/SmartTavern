/**
 * SmartTavern 工作流 - EventSource 辅助工具 (TypeScript)
 * 
 * 提供创建和操作 EventSource 的实用函数
 * 定义所有事件负载中可选的 source 字段结构，用于标识事件来源。
 * 工作流插件可基于 source 信息做更精细的决策和路由。
 * 
 * @module workflow/core/eventSource
 * @version 1.0.0
 * @since 2025-01-17
 */

/**
 * 事件来源标识接口
 * 
 * 所有事件通道的请求/响应负载都可以包含此可选字段，
 * 用于标识事件的发起方、上下文、意图等元信息。
 */
export interface EventSource {
  /**
   * 组件实例唯一标识
   * 
   * 格式建议：`${componentType}_${timestamp}` 或使用 UUID
   * 用于区分同一类型组件的不同实例
   * 
   * @example 'threaded_chat_1705467890123'
   * @example 'sidebar_panel_abc123'
   */
  componentId?: string

  /**
   * 组件类型名称
   * 
   * Vue 组件的名称或标识符，便于工作流基于组件类型做决策
   * 
   * @example 'ThreadedChatPreview'
   * @example 'SandboxView'
   * @example 'CharactersPanel'
   */
  componentType?: string

  /**
   * 视图类型标识
   * 
   * 标识事件发生在哪种视图模式下，用于区分不同的 UI 上下文
   * 
   * @example 'threaded' - 线程式对话视图
   * @example 'sandbox' - 沙盒视图
   * @example 'start' - 开始页
   */
  viewType?: string

  /**
   * 操作意图类型
   * 
   * 标识用户/系统的操作意图，用于区分同一事件的不同使用场景
   * 
   * @example 'send' - 正常发送
   * @example 'retry' - 重试操作
   * @example 'edit' - 编辑操作
   * @example 'batch' - 批量操作
   * @example 'auto' - 自动触发
   */
  intentType?: string

  /**
   * 用户标识
   * 
   * 在多用户场景下标识操作的用户，用于权限控制和审计
   * 
   * @example 'user_123'
   * @example 'admin@example.com'
   */
  userId?: string

  /**
   * 会话标识
   * 
   * 标识用户的当前会话，用于关联同一会话内的多个操作
   * 
   * @example 'session_xyz789'
   */
  sessionId?: string

  /**
   * 工作流标识
   * 
   * 标识触发此事件的工作流插件，用于工作流间的协调
   * 
   * @example 'auto-saver'
   * @example 'message-enhancer'
   */
  workflowId?: string

  /**
   * 优先级
   * 
   * 标识事件的优先级，工作流可基于此决定处理顺序
   * 
   * @example 'high' - 高优先级（如用户直接操作）
   * @example 'normal' - 普通优先级
   * @example 'low' - 低优先级（如后台自动操作）
   */
  priority?: 'high' | 'normal' | 'low'

  /**
   * 批次标识
   * 
   * 用于标识批量操作中的批次，便于关联同一批次的多个事件
   * 
   * @example 'batch_1705467890123'
   */
  batchId?: string

  /**
   * 父级事件标识
   * 
   * 用于标识事件链，记录当前事件是由哪个事件触发的
   * 
   * @example 'evt_parent_123'
   */
  parentEventId?: string

  /**
   * 扩展元数据
   * 
   * 存储其他自定义元信息，避免频繁扩展接口
   * 
   * @example { theme: 'dark', lang: 'zh-CN' }
   */
  metadata?: Record<string, any>
}

/**
 * 带 source 的事件负载基础接口
 * 
 * 所有事件负载都可以继承此接口以获得 source 支持
 */
export interface EventPayloadWithSource {
  /**
   * 事件来源标识（可选）
   */
  source?: EventSource
}

/**
 * 预定义的视图类型常量
 */
export const ViewType = {
  THREADED: 'threaded',
  SANDBOX: 'sandbox',
  START: 'start',
  GALLERY: 'gallery'
} as const

/**
 * 预定义的意图类型常量
 */
export const IntentType = {
  SEND: 'send',
  RETRY: 'retry',
  EDIT: 'edit',
  DELETE: 'delete',
  SWITCH: 'switch',
  CREATE: 'create',
  LOAD: 'load',
  BATCH: 'batch',
  AUTO: 'auto'
} as const

/**
 * 预定义的优先级常量
 */
export const Priority = {
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'low'
} as const

/**
 * 创建标准 EventSource 对象
 * 
 * @param componentType - 组件类型名称
 * @param options - 其他选项
 * @returns 标准化的 EventSource 对象
 * 
 * @example
 * // 基础用法
 * const source = createEventSource('ThreadedChatPreview')
 * 
 * @example
 * // 完整选项
 * const source = createEventSource('ThreadedChatPreview', {
 *   viewType: ViewType.THREADED,
 *   intentType: IntentType.SEND,
 *   priority: Priority.HIGH,
 *   metadata: { theme: 'dark' }
 * })
 */
export function createEventSource(componentType: string, options: Partial<EventSource> = {}): EventSource {
  return {
    componentId: options.componentId || `${componentType}_${Date.now()}`,
    componentType,
    ...options
  }
}

/**
 * 检查 source 是否匹配指定条件
 * 
 * @param source - 待检查的 EventSource
 * @param criteria - 匹配条件（部分字段）
 * @returns 是否匹配所有条件
 * 
 * @example
 * const source = { componentType: 'ThreadedChatPreview', viewType: 'threaded' }
 * matchesSource(source, { viewType: 'threaded' }) // true
 * matchesSource(source, { viewType: 'sandbox' })  // false
 */
export function matchesSource(source: EventSource | undefined, criteria: Partial<EventSource>): boolean {
  if (!source) return false
  
  for (const [key, value] of Object.entries(criteria)) {
    if (source[key as keyof EventSource] !== value) {
      return false
    }
  }
  
  return true
}

/**
 * 从 source 中提取组件信息摘要
 * 
 * @param source - EventSource 对象
 * @returns 人类可读的摘要字符串
 * 
 * @example
 * const source = {
 *   componentType: 'ThreadedChatPreview',
 *   viewType: 'threaded',
 *   intentType: 'send'
 * }
 * summarizeSource(source) // 'ThreadedChatPreview @threaded [send]'
 */
export function summarizeSource(source: EventSource | undefined): string {
  if (!source) return 'unknown'
  
  const parts: string[] = []
  if (source.componentType) parts.push(source.componentType)
  if (source.viewType) parts.push(`@${source.viewType}`)
  if (source.intentType) parts.push(`[${source.intentType}]`)
  
  return parts.length > 0 ? parts.join(' ') : 'unknown'
}

/**
 * 检查 source 是否来自特定视图类型
 * 
 * @param source - EventSource 对象
 * @param viewType - 要检查的视图类型
 * @returns 是否匹配
 * 
 * @example
 * isFromView(source, ViewType.THREADED)
 */
export function isFromView(source: EventSource | undefined, viewType: string): boolean {
  return source?.viewType === viewType
}

/**
 * 检查 source 是否具有特定意图
 * 
 * @param source - EventSource 对象
 * @param intentType - 要检查的意图类型
 * @returns 是否匹配
 * 
 * @example
 * hasIntent(source, IntentType.RETRY)
 */
export function hasIntent(source: EventSource | undefined, intentType: string): boolean {
  return source?.intentType === intentType
}

/**
 * 检查 source 是否来自特定组件类型
 * 
 * @param source - EventSource 对象
 * @param componentType - 要检查的组件类型
 * @returns 是否匹配
 * 
 * @example
 * isFromComponent(source, 'ThreadedChatPreview')
 */
export function isFromComponent(source: EventSource | undefined, componentType: string): boolean {
  return source?.componentType === componentType
}

/**
 * 检查 source 是否为高优先级
 * 
 * @param source - EventSource 对象
 * @returns 是否为高优先级
 * 
 * @example
 * if (isHighPriority(source)) {
 *   // 优先处理
 * }
 */
export function isHighPriority(source: EventSource | undefined): boolean {
  return source?.priority === Priority.HIGH
}

/**
 * 克隆并扩展 EventSource
 * 
 * @param source - 原始 EventSource
 * @param extensions - 要添加/覆盖的字段
 * @returns 新的 EventSource 对象
 * 
 * @example
 * const newSource = extendSource(originalSource, {
 *   intentType: IntentType.RETRY,
 *   parentEventId: 'evt_123'
 * })
 */
export function extendSource(source: EventSource, extensions: Partial<EventSource>): EventSource {
  return {
    ...source,
    ...extensions
  }
}

/**
 * 为事件负载添加 source 信息
 * 
 * @param payload - 原始事件负载
 * @param source - EventSource 对象
 * @returns 包含 source 的新负载
 * 
 * @example
 * const payload = withSource({ conversationFile, nodeId }, source)
 * Host.bus.emit('some.event', payload)
 */
export function withSource<T extends Record<string, any>>(payload: T, source: EventSource): T & EventPayloadWithSource {
  return {
    ...payload,
    source
  }
}

// 默认导出
export default {
  ViewType,
  IntentType,
  Priority,
  createEventSource,
  matchesSource,
  summarizeSource,
  isFromView,
  hasIntent,
  isFromComponent,
  isHighPriority,
  extendSource,
  withSource
}