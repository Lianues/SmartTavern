// Postprocess Bridge - 前端后处理事件桥接（TypeScript 版）
// 作用：
// - 为后端发送/解析出来的 postprocess 指令提供统一分发能力
// - 后处理编排器（后端）只负责解析/广播，具体行为由前端插件按 stid/op 注册处理

export interface PostprocessContext {
  conversationFile?: string
  nodeId?: string
  usage?: any
  [key: string]: any
}

export interface PostprocessItem {
  op: string
  data?: any
}

export type PostprocessDict = Record<string, PostprocessItem[]>

export interface PostprocessEventPayload {
  stid: string
  op: string
  data?: any
  ctx?: PostprocessContext
}

export type PostprocessHandler = (e: PostprocessEventPayload) => void | Promise<void>

const handlers: Map<string, Set<PostprocessHandler>> = new Map()

function keyOf(stid: string, op: string): string {
  return `${String(stid)}:${String(op)}`
}

/**
 * 注册处理器
 */
export function on(stid: string, op: string, handler: PostprocessHandler): () => void {
  if (!stid || !op || typeof handler !== 'function') return () => {}
  const k = keyOf(stid, op)
  let set = handlers.get(k)
  if (!set) {
    set = new Set<PostprocessHandler>()
    handlers.set(k, set)
  }
  set.add(handler)
  return () => { try { set!.delete(handler) } catch (_) {} }
}

/**
 * 分发单条事件
 */
export async function emit(stid: string, op: string, data?: any, ctx: PostprocessContext = {}): Promise<void> {
  const k = keyOf(stid, op)
  const set = handlers.get(k)
  if (!set || set.size === 0) return
  for (const fn of Array.from(set)) {
    try {
      await fn({ stid, op, data, ctx })
    } catch (_) {}
  }
}

/**
 * 批量分发（统一协议）：{"stid":[{"op":"...","data":{...}}, ...], ...}
 */
export async function dispatch(dict: PostprocessDict | null | undefined, ctx: PostprocessContext = {}): Promise<void> {
  if (!dict || typeof dict !== 'object') return
  const stids = Object.keys(dict)
  for (const stid of stids) {
    const items = Array.isArray(dict[stid]) ? dict[stid] : []
    for (const item of items) {
      const op = String(item?.op || '').trim()
      if (!op) continue
      await emit(stid, op, item?.data, ctx)
    }
  }
}

const Bridge = { on, emit, dispatch }

// 将桥接暴露到全局，供插件/沙盒直接使用
declare global {
  interface Window {
    STPostprocessBridge?: typeof Bridge
    STSandbox?: any
  }
}

try {
  if (typeof window !== 'undefined') {
    window.STPostprocessBridge = Bridge
    if (!window.STSandbox) window.STSandbox = {}
    window.STSandbox.PostprocessBridge = Bridge
  }
} catch (_) {}

export default Bridge


