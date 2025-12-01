// SmartTavern Workflow - Sidebar Store (Pinia TypeScript)
// 职责：管理侧边栏导航项的注册与状态（支持动态插拔）
// 设计：侧边栏项可由内置或插件动态注册，支持 order 排序与 visible/disabled 条件函数

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ========== 类型定义 ==========

/**
 * 侧边栏条目输入接口
 */
export interface SidebarEntry {
  /** 唯一标识 */
  id: string
  /** 显示文本（静态）或翻译 key（以 $ 开头表示使用 i18n） */
  label: string
  /** 翻译 key（用于动态语言切换，优先级高于 label） */
  labelKey?: string
  /** lucide 图标名 */
  icon: string
  /** 描述文本 */
  desc?: string
  /** 描述翻译 key */
  descKey?: string
  /** 排序优先级（小在前） */
  order?: number
  /** 点击触发的事件 ID */
  actionId?: string
  /** 事件参数 */
  params?: any
  /** 可见性判断函数 */
  visibleWhen?: (ctx: any) => boolean
  /** 禁用判断函数 */
  disabledWhen?: (ctx: any) => boolean
}

/**
 * 规范化后的侧边栏条目
 */
export interface NormalizedSidebarEntry {
  id: string
  label: string
  labelKey: string | null
  icon: string
  desc: string
  descKey: string | null
  order: number
  actionId: string
  params: any
  visibleWhen: ((ctx: any) => boolean) | null
  disabledWhen: ((ctx: any) => boolean) | null
}

/**
 * 计算后的侧边栏条目（含禁用状态）
 */
export interface ComputedSidebarEntry extends NormalizedSidebarEntry {
  disabled: boolean
}

// ========== Pinia Store 定义 ==========

export const useSidebarStore = defineStore('workflow.sidebar', () => {
  // 内部注册表：id -> 侧边栏项配置
  const _items = ref<Map<string, NormalizedSidebarEntry>>(new Map())

  /**
   * 注册侧边栏项
   * @returns dispose - 卸载函数
   */
  function register(entry: SidebarEntry): () => void {
    if (!entry || typeof entry !== 'object') {
      console.warn('[sidebar] invalid entry:', entry)
      return () => {}
    }
    const id = String(entry.id || '')
    if (!id) {
      console.warn('[sidebar] entry.id required')
      return () => {}
    }
    if (_items.value.has(id)) {
      console.warn(`[sidebar] id already exists: ${id}`)
      return () => {}
    }
    
    // 规范化配置
    const normalized: NormalizedSidebarEntry = {
      id,
      label: String(entry.label || id),
      labelKey: entry.labelKey ? String(entry.labelKey) : null,
      icon: String(entry.icon || 'circle'),
      desc: entry.desc ? String(entry.desc) : '',
      descKey: entry.descKey ? String(entry.descKey) : null,
      order: typeof entry.order === 'number' ? entry.order : 50,
      actionId: entry.actionId ? String(entry.actionId) : `sidebar.${id}`,
      params: entry.params || {},
      visibleWhen: typeof entry.visibleWhen === 'function' ? entry.visibleWhen : null,
      disabledWhen: typeof entry.disabledWhen === 'function' ? entry.disabledWhen : null,
    }
    
    _items.value.set(id, normalized)
    
    // 返回卸载函数
    return () => {
      _items.value.delete(id)
    }
  }

  /**
   * 卸载侧边栏项
   * @returns 是否成功卸载
   */
  function unregister(id: string): boolean {
    return _items.value.delete(id)
  }

  /**
   * 列出所有侧边栏项（根据 order 排序，过滤不可见项）
   * @param ctx - 上下文（用于 visibleWhen/disabledWhen 判断）
   * @returns 侧边栏项数组
   */
  function list(ctx: any = {}): ComputedSidebarEntry[] {
    const all = Array.from(_items.value.values())
    // 排序
    all.sort((a, b) => a.order - b.order)
    // 过滤不可见项
    return all
      .filter(item => {
        if (typeof item.visibleWhen === 'function') {
          try {
            return item.visibleWhen(ctx)
          } catch (e) {
            console.warn(`[sidebar] visibleWhen error for ${item.id}:`, e)
            return true
          }
        }
        return true
      })
      .map(item => {
        // 计算 disabled 状态
        let disabled = false
        if (typeof item.disabledWhen === 'function') {
          try {
            disabled = item.disabledWhen(ctx)
          } catch (e) {
            console.warn(`[sidebar] disabledWhen error for ${item.id}:`, e)
          }
        }
        return { ...item, disabled }
      })
  }

  // 响应式 items 列表（供组件使用）
  const items = computed(() => list())

  return {
    // state
    items,
    
    // actions
    register,
    unregister,
    list,
  }
})

export default useSidebarStore