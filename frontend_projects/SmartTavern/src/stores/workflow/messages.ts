// Pinia Store - Messages (TypeScript)
// 职责：管理全局消息数组（仅最小 API），用于后续工作流回显/调试。

import { defineStore } from 'pinia'

// ========== 类型定义 ==========

/**
 * 消息接口
 */
export interface Message {
  /** 消息 ID */
  id: string
  /** 角色 */
  role: string
  /** 消息内容 */
  content: string
}

/**
 * 输入消息接口（部分字段可选）
 */
export interface MessageInput {
  id?: string
  role?: string
  content?: string
}

// ========== 工具函数 ==========

/**
 * 规范化消息对象
 */
function normalize(msg: MessageInput = {}): Message {
  return {
    id: String(msg.id ?? Date.now()),
    role: String(msg.role ?? 'system'),
    content: String(msg.content ?? ''),
  }
}

// ========== Pinia Store 定义 ==========

export const useMessagesStore = defineStore('messages', {
  state: () => ({
    items: [] as Message[],
  }),

  getters: {
    /**
     * 获取消息只读快照（数组引用仍可变更，请组件侧视为只读使用）
     */
    list: (state): Message[] => state.items,
  },

  actions: {
    /**
     * 追加一条消息
     */
    append(msg: MessageInput = {}): Message {
      const m = normalize(msg)
      this.items.push(m)
      return m
    },

    /**
     * 批量替换（一次性加载）
     */
    replaceAll(list: MessageInput[] = []): void {
      const next = list.map(normalize)
      this.items.splice(0, this.items.length, ...next)
    },

    /** 清空消息（谨慎使用） */
    clear(): void {
      this.items.splice(0, this.items.length)
    },

    /**
     * 按 id 移除
     */
    remove(id: string): void {
      const i = this.items.findIndex(x => x.id === id)
      if (i >= 0) this.items.splice(i, 1)
    },
  },
})

export default useMessagesStore