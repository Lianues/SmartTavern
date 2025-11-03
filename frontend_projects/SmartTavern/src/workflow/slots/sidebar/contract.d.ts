// SmartTavern Workflow - Sidebar Slot Contract (TypeScript Definitions)
// 协议：侧边栏导航项注册与上下文约定

/**
 * 侧边栏项配置
 */
export interface SidebarItemEntry {
  /** 唯一标识（必填） */
  id: string
  
  /** 显示文本（必填） */
  label: string
  
  /** lucide 图标名（必填） */
  icon: string
  
  /** 描述文本（可选） */
  desc?: string
  
  /** 排序优先级（小在前，默认 50） */
  order?: number
  
  /** 点击触发的事件 ID（默认 `sidebar.${id}`） */
  actionId?: string
  
  /** 事件参数（可选） */
  params?: Record<string, any>
  
  /**
   * 可见性判断函数（可选）
   * @param ctx - 侧边栏上下文
   * @returns true=显示，false=隐藏
   */
  visibleWhen?: (ctx: SidebarContext) => boolean
  
  /**
   * 禁用判断函数（可选）
   * @param ctx - 侧边栏上下文
   * @returns true=禁用，false=可用
   */
  disabledWhen?: (ctx: SidebarContext) => boolean
}

/**
 * 侧边栏上下文（传入 visibleWhen/disabledWhen）
 */
export interface SidebarContext {
  /** 当前视图：'start' | 'threaded' | 'sandbox' */
  view?: string
  
  /** 当前主题：'system' | 'light' | 'dark' */
  theme?: string
  
  /** 是否移动端 */
  isMobile?: boolean
  
  /** 当前语言 */
  lang?: string
  
  /** 其他上下文扩展（可选） */
  [key: string]: any
}

/**
 * Host API - 侧边栏插槽方法
 */
export interface SidebarSlotAPI {
  /**
   * 注册侧边栏项
   * @param entry 侧边栏项配置
   * @returns dispose - 卸载函数
   */
  registerSidebarItem(entry: SidebarItemEntry): () => void
  
  /**
   * 卸载侧边栏项
   * @param id 侧边栏项 ID
   * @returns 是否成功卸载
   */
  unregisterSidebarItem(id: string): boolean
  
  /**
   * 列出所有侧边栏项（根据 order 排序，过滤不可见项）
   * @param ctx 上下文
   * @returns 侧边栏项数组
   */
  listSidebarItems(ctx?: SidebarContext): Array<SidebarItemEntry & { disabled: boolean }>
}