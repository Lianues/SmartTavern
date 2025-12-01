import { defineStore } from 'pinia'

type MsgRole = 'system' | 'user' | 'assistant'
export interface OpenAIMessage {
  role: MsgRole
  content: string
}

export interface HistoryFile {
  name: string
  enabled: boolean
  data: any
}

const STORAGE_KEY = 'prompt_editor_history_files'

function clone<T>(x: T): T {
  return x == null ? (x as any) : JSON.parse(JSON.stringify(x))
}

function loadLocal(): { files: HistoryFile[]; activeName: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { files: [], activeName: null }
    const obj = JSON.parse(raw)
    const files = Array.isArray(obj?.files) ? obj.files : []
    const activeName = typeof obj?.activeName === 'string' ? obj.activeName : (files[0]?.name ?? null)
    return { files, activeName }
  } catch {
    return { files: [], activeName: null }
  }
}

function saveLocal(payload: { files: HistoryFile[]; activeName: string | null }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {}
}

/**
 * 从对话历史 JSON 推导 OpenAI messages 数组
 * 兼容几种常见形态：
 * - chat-branches V2：{ schema:{name:'chat-branches'}, nodes, children, active_path }
 * - { messages:[{role, content}]} 或 { openai_messages: [...] }
 * - fallback：[]
 */
export function deriveMessagesFromHistory(doc: any): OpenAIMessage[] {
  try {
    if (!doc || typeof doc !== 'object') return []

    // 1) 显式 messages/openai_messages
    if (Array.isArray(doc.messages)) {
      return (doc.messages as any[])
        .map((m) => ({
          role: (m?.role ?? 'user') as MsgRole,
          content: String(m?.content ?? ''),
        }))
        .filter((m) => m.content != null)
    }
    if (Array.isArray(doc.openai_messages)) {
      return (doc.openai_messages as any[])
        .map((m) => ({
          role: (m?.role ?? 'user') as MsgRole,
          content: String(m?.content ?? ''),
        }))
        .filter((m) => m.content != null)
    }

    // 2) chat-branches v2
    const isBranches =
      doc?.schema?.name === 'chat-branches' &&
      doc?.nodes &&
      doc?.children &&
      (doc?.active_path || doc?.root)

    if (isBranches) {
      const nodes = doc.nodes || {}
      const activePath: string[] = Array.isArray(doc.active_path) ? doc.active_path.slice() : []
      const root: string = doc.root || (activePath.length ? activePath[0] : null)

      const path: string[] = activePath.length
        ? activePath
        : root
        ? [root]
        : []

      const out: OpenAIMessage[] = []
      for (const nid of path) {
        const node = nodes[nid]
        if (!node) continue
        const role = node.role as MsgRole
        if (role === 'system' || role === 'user' || role === 'assistant') {
          out.push({ role, content: String(node.content ?? '') })
        }
      }
      return out
    }

    // fallback
    return []
  } catch {
    return []
  }
}
// ==== Local types for chat-branches editing (front-end only) ====
interface BranchNode {
  pid: string | null
  role: MsgRole
  content?: string | null
}

interface BranchDoc {
  schema: { name: 'chat-branches'; version: number }
  meta?: { id?: string; title?: string | null } | Record<string, any>
  root: string
  nodes: Record<string, BranchNode>
  children: Record<string, string[]>
  active_path: string[]
}

export const useHistoryStore = defineStore('history', {
  state: () => ({
    files: [] as HistoryFile[],
    activeName: null as string | null,
    loaded: false,
  }),

  getters: {
    activeIndex(state): number {
      if (!state.activeName) return -1
      return state.files.findIndex((f) => f.name === state.activeName)
    },
    activeFile(state): HistoryFile | null {
      const idx = (this as any).activeIndex as number
      return idx >= 0 ? state.files[idx] ?? null : null
    },
    activeData(): any | null {
      return (this as any).activeFile?.data ?? null
    },
    messages(): OpenAIMessage[] {
      const data = (this as any).activeData
      return deriveMessagesFromHistory(data)
    },
  },

  actions: {
    load() {
      if (this.loaded) return
      const { files, activeName } = loadLocal()
      // 仅做轻度形状校验
      this.files = Array.isArray(files) ? files.filter((f) => f && f.name) : []
      this.activeName = typeof activeName === 'string' ? activeName : (this.files[0]?.name ?? null)
      this.loaded = true
    },

    persist() {
      saveLocal({ files: this.files, activeName: this.activeName })
    },

    setActive(name: string) {
      if (this.files.some((f) => f.name === name)) {
        this.activeName = name
        this.persist()
      }
    },

    /** 重命名当前激活文件 */
    renameActive(newName: string): boolean {
      const nn = String(newName || '').trim()
      if (!nn) return false
      if (!this.activeName) return false
      const idx = this.files.findIndex(f => f.name === this.activeName)
      if (idx < 0) return false
      if (this.files.some((f, i) => i !== idx && f.name === nn)) return false
      const rec = this.files[idx]
      if (!rec) return false
      rec.name = nn
      this.activeName = nn
      this.persist()
      return true
    },

    toggleEnable(name: string) {
      const f = this.files.find((x) => x.name === name)
      if (f) {
        f.enabled = !f.enabled
        this.persist()
      }
    },

    deleteFile(name: string) {
      const idx = this.files.findIndex((x) => x.name === name)
      if (idx >= 0) {
        this.files.splice(idx, 1)
        if (this.activeName === name) {
          this.activeName = this.files[0]?.name ?? null
        }
        this.persist()
      }
    },

    clearAll() {
      this.files = []
      this.activeName = null
      this.persist()
    },

    upsertFile(entry: HistoryFile) {
      const idx = this.files.findIndex((f) => f.name === entry.name)
      const rec: HistoryFile = {
        name: entry.name,
        enabled: entry.enabled ?? true,
        data: clone(entry.data),
      }
      if (idx >= 0) this.files.splice(idx, 1, rec)
      else this.files.unshift(rec)
      this.activeName = rec.name
      this.persist()
    },

    async importFromFile(file: File): Promise<void> {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('read error'))
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.readAsText(file)
      })
      let json: any
      try {
        const clean = text.replace(/\uFEFF/g, '')
        json = JSON.parse(clean)
      } catch {
        throw new Error('JSON 解析失败')
      }
      const entry: HistoryFile = { name: file.name, enabled: true, data: json }
      this.upsertFile(entry)
    },

    setDoc(json: any, fileName?: string) {
      const name = fileName ?? this.activeName ?? 'History.json'
      const idx = this.files.findIndex((f) => f.name === name)
      const rec: HistoryFile = {
        name,
        enabled: true,
        data: clone(json),
      }
      if (idx >= 0) this.files.splice(idx, 1, rec)
      else this.files.unshift(rec)
      this.activeName = name
      this.persist()
    },

    exportActive(): { filename: string; json: string } | null {
      const file = this.activeFile
      if (!file) return null
      const filename = file.name.endsWith('.json') ? file.name : `${file.name}.json`
      const json = JSON.stringify(file.data ?? {}, null, 2)
      return { filename, json }
    },

    // ===== Chat-Branches 前端本地实现（不调用后端，修改缓存 JSON） =====

    /** 确保当前活动文档为 chat-branches 结构；否则将线性 messages 适配为分支结构 */
    _ensureBranchDoc(): void {
      const file = this.activeFile
      if (!file) return
      const doc = file.data
      const isBranches =
        doc?.schema?.name === 'chat-branches' &&
        doc?.nodes &&
        doc?.children &&
        (doc?.active_path || doc?.root)

      if (isBranches) return

      // 回退：从 messages / openai_messages 推导线性分支
      const msgs = deriveMessagesFromHistory(doc)
      const nodes: Record<string, any> = {}
      const children: Record<string, string[]> = {}
      const root = 'n_root'
      nodes[root] = { pid: null, role: 'system', content: '对话记录' }
      let prev = root
      const active_path: string[] = [root]
      let i = 0
      for (const m of msgs) {
        const id = `n_${++i}`
        nodes[id] = { pid: prev, role: m.role, content: m.content }
        const arr = children[prev] ?? (children[prev] = [])
        arr.push(id)
        prev = id
        active_path.push(id)
      }
      const out = {
        schema: { name: 'chat-branches', version: 2 },
        meta: { id: (doc?.meta?.id ?? 'conversation_1'), title: doc?.meta?.title ?? '对话' },
        root,
        nodes,
        children,
        active_path,
      }
      this.setDoc(out)
    },

    /** 读取当前 active_path（保证 root 在首位） */
    _activePath(): string[] {
      const d: any = this.activeData
      if (!d) return []
      const root = String(d.root ?? '')
      const ap: string[] = Array.isArray(d.active_path) ? d.active_path.slice() : []
      if (!ap.length && root) ap.push(root)
      if (root && ap[0] !== root) ap.unshift(root)
      return ap
    },

    /** 生成节点 ID */
    _genId(prefix = 'n_'): string {
      const rand = Math.random().toString(36).slice(2, 6)
      return `${prefix}${Date.now().toString(36)}_${rand}`
    },

    /** 追加一条消息到当前活动路径尾部 */
    append(role: 'user' | 'assistant' | 'system', content: string) {
      this._ensureBranchDoc()
      const d = this.activeData as BranchDoc
      if (!d) return
      const ap = this._activePath()
      const tail: string = (ap[ap.length - 1] ?? d.root) as string
      const id = this._genId()
      d.nodes[id] = { pid: tail ?? null, role, content: String(content ?? '') }
      const arr = d.children[tail] ?? (d.children[tail] = [])
      arr.push(id)
      d.active_path = ap.concat(id)
      this.setDoc(d)
    },

    /** 计算 root→nid 的路径（基于 pid 逐级上溯） */
    _pathToNode(d: BranchDoc, nid: string): string[] {
      if (!d || !d.nodes) return []
      const path: string[] = []
      let cur: string | null | undefined = nid
      while (typeof cur !== 'undefined' && cur !== null) {
        path.push(cur as string)
        const node: BranchNode | undefined = d.nodes[cur as string]
        cur = node ? node.pid : null
      }
      path.reverse()
      const root = String(d.root ?? '')
      if (root && path[0] !== root) path.unshift(root)
      return path
    },

    /** 在指定节点下追加子节点，并将 active_path 切到新节点 */
    appendAt(nodeId: string, role: 'user' | 'assistant' | 'system', content: string) {
      this._ensureBranchDoc()
      const d: any = this.activeData
      if (!d) return
      if (!d.nodes?.[nodeId]) return
      const id = this._genId()
      d.nodes[id] = { pid: nodeId, role, content: String(content ?? '') }
      d.children[nodeId] = (d.children[nodeId] ?? []).concat(id)
      const prefix = this._pathToNode(d, nodeId)
      d.active_path = prefix.concat(id)
      this.setDoc(d)
    },
 
    /** 修剪：仅保留前 keepDepth 个节点为活动路径，删除其后的分支子树 */
    truncateAfter(keepDepth: number) {
      this._ensureBranchDoc()
      const d: any = this.activeData
      if (!d) return
      const ap = this._activePath()
      if (!keepDepth || keepDepth < 1) keepDepth = 1
      if (keepDepth >= ap.length) return

      const keepPath = ap.slice(0, keepDepth)
      const toDeleteStart = ap[keepDepth]

      // 广度删除 toDeleteStart 子树
      const queue: string[] = []
      if (toDeleteStart) queue.push(toDeleteStart)
      while (queue.length) {
        const nid = queue.shift()!
        const kids = d.children[nid] ?? []
        for (const k of kids) queue.push(k)
        delete d.nodes[nid]
        delete d.children[nid]
      }

      // 从父节点孩子列表移除可见尾节点
      const parent = keepPath[keepPath.length - 1]!
      const parentKids = d.children[parent] ?? []
      d.children[parent] = parentKids.filter((x: string) => x !== toDeleteStart)

      d.active_path = keepPath
      this.setDoc(d)
    },

    /** 返回指定层的 j/n 指示（兄弟序号/总数，层从 1 开始；root 为 1） */
    branchIndicatorAt(depth: number): { j: number | null; n: number | null } {
      this._ensureBranchDoc()
      const d: any = this.activeData
      if (!d) return { j: null, n: null }
      const ap = this._activePath()
      const childId: string | undefined = ap[depth - 1]
      const parentId: string | undefined = ap[depth - 2]
      if (!childId || !parentId) return { j: null, n: null }
      const siblings: string[] = d.children[parentId] ?? []
      const idx = siblings.indexOf(childId)
      const j = idx >= 0 ? idx + 1 : null
      const n = siblings.length || null
      return { j, n }
    },

    /**
     * 切换分支：
     * - atDepth >= 2
     * - left: 选择前一个兄弟（若存在）
     * - right: 若存在后一个兄弟则选之，否则在父节点下新建 assistant 子节点并选中
     */
    switchBranch(atDepth: number, direction: 'left' | 'right') {
      this._ensureBranchDoc()
      const d: any = this.activeData
      if (!d) return
      const ap = this._activePath()
      if (atDepth < 2 || atDepth > ap.length) return
      const parentId = ap[atDepth - 2]!
      const curId: string | undefined = ap[atDepth - 1]
      const siblings: string[] = d.children[parentId] ?? []
      const idx = typeof curId === 'string' ? siblings.indexOf(curId) : -1
      const n = siblings.length

      let targetId: string | null = null
      if (direction === 'left') {
        if (idx > 0) targetId = siblings[idx - 1]!
      } else {
        if (idx >= 0 && idx < n - 1) {
          targetId = siblings[idx + 1]!
        } else {
          // 右切换到不存在分支 → 新建 assistant 子节点
          const newId = this._genId()
          d.nodes[newId] = { pid: parentId, role: 'assistant', content: '' }
          d.children[parentId] = (d.children[parentId] ?? []).concat(newId)
          targetId = newId
        }
      }
      if (!targetId) return
      d.active_path = ap.slice(0, atDepth - 1).concat(targetId)
      this.setDoc(d)
    },

    /** 导出当前活动路径为 OpenAI messages 数组 */
    openAIMessages(): OpenAIMessage[] {
      this._ensureBranchDoc()
      const d: any = this.activeData
      if (!d) return []
      const ap = this._activePath()
      const out: OpenAIMessage[] = []
      for (const nid of ap) {
        const node = d.nodes?.[nid]
        if (!node) continue
        const r = node.role as MsgRole
        if (r === 'system' || r === 'user' || r === 'assistant') {
          out.push({ role: r, content: String(node.content ?? '') })
        }
      }
      return out
    },
  },
})