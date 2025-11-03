// SmartTavern Workflow - Core Host (v2, Pinia-backed, TypeScript)
// 职责：事件编排与对外 API；状态承载委托 Pinia Stores。
// 对外 API 兼容 v1：registerHomeButton/unregisterHomeButton/listHomeButtons、appendMessage、pushToast、events.on/emit/off。

import createEmitter from './events'
import type { EventEmitter } from './events'
import { useHomeMenuStore } from '@/stores/workflow/homeMenu'
import type { HomeMenuEntry } from '@/stores/workflow/homeMenu'
import { useMessagesStore } from '@/stores/workflow/messages'
import { useToastsStore } from '@/stores/workflow/toasts'
import { useSidebarStore } from '@/stores/workflow/sidebar'
import type { SidebarEntry } from '@/stores/workflow/sidebar'

// 类型定义
interface Message {
  id?: string
  content: string
  role?: 'user' | 'assistant' | 'system'
  [key: string]: any
}

interface Toast {
  id?: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  timeout?: number
  [key: string]: any
}

interface HostInitOptions {
  exposeToWindow?: boolean
}

interface HostState {
  messages: any[]
  toasts: any[]
  slots: {
    homeMenu: any[]
    sidebar: any[]
  }
}

interface Host {
  init(options?: HostInitOptions): Host
  events: EventEmitter
  readonly state: HostState
  listHomeButtons(ctx?: Record<string, any>): any[]
  registerHomeButton(entry: HomeMenuEntry): string
  unregisterHomeButton(id: string): void
  listSidebarItems(ctx?: Record<string, any>): any[]
  registerSidebarItem(entry: SidebarEntry): string
  unregisterSidebarItem(id: string): void
  appendMessage(msg: Message): void
  pushToast(toast: Toast): void
}

// 事件总线
const __events = createEmitter()

// Store 访问助手（依赖 main.js/main.ts 中 setActivePinia 已设置）
function getStores() {
  const home = useHomeMenuStore()
  const msgs = useMessagesStore()
  const toasts = useToastsStore()
  const sidebar = useSidebarStore()
  return { home, msgs, toasts, sidebar }
}

// API：注册/撤销 开始页按钮（home-menu）
function registerHomeButton(entry: HomeMenuEntry): string {
  const { home } = getStores()
  home.register(entry)
  return entry.id
}

function unregisterHomeButton(id: string): void {
  const { home } = getStores()
  home.unregister(id)
}

function listHomeButtons(ctx: Record<string, any> = {}): any[] {
  const { home } = getStores()
  return home.list(ctx)
}

// API：注册/撤销 侧边栏项（sidebar）
function registerSidebarItem(entry: SidebarEntry): string {
  const { sidebar } = getStores()
  sidebar.register(entry)
  return entry.id
}

function unregisterSidebarItem(id: string): void {
  const { sidebar } = getStores()
  sidebar.unregister(id)
}

function listSidebarItems(ctx: Record<string, any> = {}): any[] {
  const { sidebar } = getStores()
  return sidebar.list(ctx)
}

// API：消息/提示（委托 Pinia）
function appendMessage(msg: Message): void {
  const { msgs } = getStores()
  msgs.append(msg)
}

function pushToast(toast: Toast): void {
  const { toasts } = getStores()
  toasts.push(toast)
}

// 导出单例 Host
const Host: Host = {
  // 初始化（可扩展：挂到 window）
  init(options: HostInitOptions = {}): Host {
    const { exposeToWindow = true } = options
    if (exposeToWindow && typeof window !== 'undefined') {
      (window as any).STHost = Host
    }
    return Host
  },

  // 事件总线
  events: {
    on: __events.on,
    once: __events.once,
    off: __events.off,
    emit: __events.emit,
    clear: __events.clear,
    listenerCount: __events.listenerCount,
  },

  // 受控的状态/插槽 API（委托 Pinia）
  // state 提供聚合只读视图（为兼容旧代码而保留）
  get state(): HostState {
    const { home, msgs, toasts, sidebar } = getStores()
    return {
      messages: msgs.list,
      toasts: toasts.list,
      slots: {
        homeMenu: home.items,
        sidebar: sidebar.items,
      },
    }
  },

  listHomeButtons,
  registerHomeButton,
  unregisterHomeButton,

  listSidebarItems,
  registerSidebarItem,
  unregisterSidebarItem,

  appendMessage,
  pushToast,
}

export default Host