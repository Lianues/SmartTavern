// Pinia Store - HomeMenu (TypeScript)
// 仅用于"开始页按钮注册表"的状态管理：注册/反注册/获取视图（排序+可见性计算）
// 与契约一致：见 src/workflow/slots/homeMenu/contract.d.ts（类型提示，不参与运行时）

import { defineStore } from 'pinia'

// ========== 类型定义 ==========

/**
 * 按钮条目接口
 */
export interface HomeMenuEntry {
  /** 唯一标识 */
  id: string
  /** 显示标签（静态，作为 fallback） */
  label: string
  /** 翻译 key（用于动态语言切换，优先级高于 label） */
  labelKey?: string
  /** 动作 ID */
  actionId: string
  /** 图标名称 */
  icon?: string
  /** 排序优先级 */
  order?: number
  /** 动作参数 */
  params?: any
  /** 提示文本 */
  tooltip?: string
  /** 可见性条件 */
  visibleWhen?: boolean | ((ctx: any) => boolean)
  /** 禁用条件 */
  disabledWhen?: boolean | ((ctx: any) => boolean)
}

/**
 * 规范化后的按钮条目
 */
export interface NormalizedEntry {
  id: string
  label: string
  labelKey: string | null
  actionId: string
  icon: string
  order: number
  params: any
  tooltip: string
  visibleWhen: boolean | ((ctx: any) => boolean)
  disabledWhen: boolean | ((ctx: any) => boolean)
}

/**
 * 计算后的按钮条目（含可见性和禁用状态）
 */
export interface ComputedEntry extends NormalizedEntry {
  visible: boolean
  disabled: boolean
}

// ========== 工具函数 ==========

/**
 * 标准化按钮条目
 */
function normalize(input: HomeMenuEntry): NormalizedEntry {
  if (!input || typeof input !== 'object') {
    throw new Error('[homeMenuStore] entry must be object')
  }
  const id = String(input.id ?? '').trim()
  const label = String(input.label ?? '').trim()
  const actionId = String(input.actionId ?? '').trim()
  if (!id) throw new Error('[homeMenuStore] id required')
  if (!label) throw new Error('[homeMenuStore] label required')
  if (!actionId) throw new Error('[homeMenuStore] actionId required')
  
  return {
    id,
    label,
    labelKey: input.labelKey ? String(input.labelKey) : null,
    actionId,
    icon: input.icon ? String(input.icon) : '',
    order: Number.isFinite(input.order) ? Number(input.order) : 0,
    params: input.params ?? null,
    tooltip: input.tooltip ? String(input.tooltip) : '',
    visibleWhen: input.visibleWhen ?? true,
    disabledWhen: input.disabledWhen ?? false,
  }
}

/**
 * 计算可见/禁用状态
 */
function computeFlags(btn: NormalizedEntry, ctx: any): { visible: boolean; disabled: boolean } {
  const visible = typeof btn.visibleWhen === 'function' ? !!btn.visibleWhen(ctx) : !!btn.visibleWhen
  const disabled = typeof btn.disabledWhen === 'function' ? !!btn.disabledWhen(ctx) : !!btn.disabledWhen
  return { visible, disabled }
}

// ========== Pinia Store 定义 ==========

export const useHomeMenuStore = defineStore('homeMenu', {
  state: () => ({
    items: [] as NormalizedEntry[],
  }),

  getters: {
    /**
     * 获取排序后 + 可见性计算的按钮快照
     */
    list: (state) => (ctx: any = {}): ComputedEntry[] => {
      const sorted = state.items.slice().sort((a, b) => {
        const ao = Number.isFinite(a.order) ? a.order : 0
        const bo = Number.isFinite(b.order) ? b.order : 0
        if (ao !== bo) return ao - bo
        return a.label.localeCompare(b.label, 'zh-CN')
      })
      return sorted
        .map(b => {
          const f = computeFlags(b, ctx)
          return { ...b, ...f }
        })
        .filter(b => b.visible)
    },
  },

  actions: {
    /**
     * 注册一个按钮（同 id 则更新）
     * @returns disposer 卸载函数
     */
    register(entry: HomeMenuEntry): () => void {
      const btn = normalize(entry)
      const idx = this.items.findIndex(it => it.id === btn.id)
      if (idx >= 0) {
        this.items[idx] = { ...this.items[idx], ...btn }
      } else {
        this.items.push(btn)
      }
      return () => this.unregister(btn.id)
    },

    /**
     * 撤销一个按钮
     */
    unregister(id: string): void {
      const i = this.items.findIndex(it => it.id === id)
      if (i >= 0) this.items.splice(i, 1)
    },

    /** 清空所有按钮（谨慎使用） */
    clear(): void {
      this.items.splice(0, this.items.length)
    },
  },
})

export default useHomeMenuStore