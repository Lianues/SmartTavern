<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useHistoryStore, deriveMessagesFromHistory } from '@/features/history/store'

/**
 * 分支对话可视化 + 本地分支编辑（前端缓存 json，不调用后端）
 * - 优先使用 chat-branches v2 标准结构
 * - 否则从 messages 推导为线性分支树
 *
 * 参考：
 * - [python.chat_branches.export](api/modules/SmartTavern/chat_branches/chat_branches.py:237)
 * - [python.chat_branches.branch_table](api/modules/SmartTavern/chat_branches/chat_branches.py:222)
 * - [python.chat_branches.get_path](api/modules/SmartTavern/chat_branches/chat_branches.py:61)
 * - [python.chat_branches.openai_messages](api/modules/SmartTavern/chat_branches/chat_branches.py:207)
 */

type MsgRole = 'system' | 'user' | 'assistant'

interface BranchDoc {
  schema: { name: 'chat-branches'; version: number }
  meta: { id: string; title?: string | null }
  root: string
  nodes: Record<string, { pid: string | null; role: MsgRole; content?: string | null }>
  children: Record<string, string[]>
  active_path: string[]
}
interface BranchTable {
  session_id: string
  latest: { depth: number; j: number | null; n: number | null; node_id: string | null }
  levels: { depth: number; node_id: string; j: number | null; n: number | null }[]
}
interface PathView {
  session_id: string
  status: string
  path: { id: string; depth: number; role: MsgRole; content: string | null; branch_j: number | null; branch_n: number | null }[]
}
interface OpenAIView {
  conversation_id: string
  session_id: string
  messages: { role: MsgRole; content: string }[]
}

const props = defineProps<{
  branchDoc?: BranchDoc
  branchTable?: BranchTable
  pathView?: PathView
  messagesView?: OpenAIView
  title?: string
}>()

// 使用 Store 活动文档或 props，回退 demo；并在非 chat-branches 时生成线性树
const history = useHistoryStore()
history.load()

const sourceAny = computed<any>(() => history.activeData)

const messages = computed<{ role: MsgRole; content: string }[]>(() => deriveMessagesFromHistory(sourceAny.value))

const doc = computed<BranchDoc>(() => {
  const v: any = sourceAny.value
  // 若为标准 chat-branches 结构，直接使用
  if (v && v.schema?.name === 'chat-branches' && v.nodes && v.children && v.root) {
    return v as BranchDoc
  }
  // 否则根据 messages 生成一棵线性分支树（root -> 消息1 -> 消息2 ...）
  const msgs = messages.value
  const nodes: Record<string, { pid: string | null; role: MsgRole; content?: string | null }> = {}
  const children: Record<string, string[]> = {}
  const root = 'n_root'
  nodes[root] = { pid: null, role: 'system', content: '对话记录' }
  let prev = root
  const active_path: string[] = [root]
  let i = 0
  for (const m of msgs) {
    const id = `n_${++i}`
    nodes[id] = { pid: prev, role: m.role, content: m.content }
    const arr = (children[prev] ?? (children[prev] = []))
    arr.push(id)
    prev = id
    active_path.push(id)
  }
  return {
    schema: { name: 'chat-branches', version: 2 },
    meta: { id: 'linear', title: '线性对话（由 messages 推导）' },
    root,
    nodes,
    children,
    active_path,
  }
})

// 原始 JSON 文本编辑（保持与 Store 同步）
const jsonText = ref('')
watch(sourceAny, (v) => {
  try {
    jsonText.value = JSON.stringify(v ?? {}, null, 2)
  } catch {
    jsonText.value = ''
  }
}, { immediate: true })

function handleFormat() {
  try {
    const obj = JSON.parse(jsonText.value)
    jsonText.value = JSON.stringify(obj, null, 2)
  } catch {
    alert('JSON 解析失败，无法格式化')
  }
}
function handleSave() {
  try {
    const obj = JSON.parse(jsonText.value)
    history.setDoc(obj)
  } catch {
    alert('JSON 解析失败，无法保存')
  }
}
function handleReset() {
  try {
    jsonText.value = JSON.stringify(sourceAny.value ?? {}, null, 2)
  } catch {
    jsonText.value = ''
  }
}

// 归一化 active_path（确保 root 开头）
const activePath = computed<string[]>(() => {
  const ap = (doc.value.active_path ?? []).slice()
  if (!ap.length) return [doc.value.root]
  if (ap[0] !== doc.value.root) ap.unshift(doc.value.root)
  return ap
})

function listDepthFirst(d: BranchDoc): string[] {
  const order: string[] = []
  const dfs = (nid: string) => {
    order.push(nid)
    const kids = d.children[nid] ?? []
    for (const k of kids) dfs(k)
  }
  dfs(d.root)
  return order
}

function parentMap(d: BranchDoc): Record<string, string | null> {
  const m: Record<string, string | null> = {}
  for (const [pid, arr] of Object.entries(d.children)) {
    for (const cid of arr) m[cid] = pid
  }
  m[d.root] = null
  return m
}

function depthOf(d: BranchDoc, nid: string): number {
  const pm: Record<string, string | null> = parentMap(d)
  let cur: string | null = nid
  let depth = 0
  while (cur !== null) {
    const parentVal: string | null | undefined = pm[cur as string]
    if (parentVal === null || typeof parentVal === 'undefined') break
    depth++
    cur = parentVal
  }
  return depth
}

function jnOf(d: BranchDoc, nid: string): { j: number | null; n: number | null } {
  const pm: Record<string, string | null> = parentMap(d)
  const pid: string | null | undefined = pm[nid]
  if (pid === null || typeof pid === 'undefined') return { j: null, n: null }
  const siblings: string[] = d.children[pid] ?? []
  const idx = siblings.indexOf(nid)
  const j: number | null = idx >= 0 ? idx + 1 : null
  const n: number | null = siblings.length ? siblings.length : null
  return { j, n }
}

function branchLevelsFromDoc(d: BranchDoc): { depth: number; node_id: string; j: number | null; n: number | null }[] {
  const ap: string[] = activePath.value
  const levels: { depth: number; node_id: string; j: number | null; n: number | null }[] = []
  for (let depth = 2; depth <= ap.length; depth++) {
    const parentId: string = ap[depth - 2] as string
    const childId: string | undefined = ap[depth - 1]
    if (typeof childId === 'undefined') continue
    const siblings: string[] = d.children[parentId] ?? []
    const idx = siblings.indexOf(childId)
    const j: number | null = idx >= 0 ? idx + 1 : null
    const n: number | null = siblings.length ? siblings.length : null
    levels.push({ depth, node_id: childId, j, n })
  }
  return levels
}

// messages 已基于 deriveMessagesFromHistory(sourceAny) 计算（见顶部 messages 计算属性）

const onlyActive = ref(false)
const order = computed(() => (onlyActive.value ? activePath.value : listDepthFirst(doc.value)))
const levels = computed(() => props.branchTable?.levels ?? branchLevelsFromDoc(doc.value))

const latest = computed(() => {
  const ap: string[] = activePath.value
  const depth = ap.length
  const node_id = ap.length ? ap[ap.length - 1] : null
  if (depth < 2 || !node_id) return { depth, j: null as number | null, n: null as number | null, node_id }
  const jn = jnOf(doc.value, node_id)
  return { depth, j: jn.j, n: jn.n, node_id }
})

const metaTitle = computed(() => props.title ?? doc.value.meta?.title ?? '分支会话')

// UI helpers（需暴露给模板）
function isInActivePath(nid: string): boolean {
  return activePath.value.includes(nid)
}

// 本地分支编辑（前端缓存修改）
const appendRole = ref<'user' | 'assistant' | 'system'>('user')
const appendText = ref('')
const trimDepth = ref<number>(2)

function onAppend() {
  if (!appendText.value.trim()) return
  history.append(appendRole.value, appendText.value)
  appendText.value = ''
}

function onTrim() {
  if (!trimDepth.value || trimDepth.value < 1) return
  history.truncateAfter(trimDepth.value)
}

function onSwitch(dir: 'left' | 'right') {
  const depth = latest.value?.depth ?? 2
  if (!depth || depth < 2) return
  history.switchBranch(depth, dir)
}

// 节点上下文菜单与内联追加
const menuFor = ref<string | null>(null)
const inlineFor = ref<string | null>(null)
const inlineRole = ref<'user' | 'assistant' | 'system'>('user')
const inlineText = ref('')

function pruneToHere(nid: string) {
  const idx = activePath.value.indexOf(nid)
  if (idx === -1) return
  history.truncateAfter(idx + 1)
  menuFor.value = null
}

function switchAtHere(nid: string, dir: 'left' | 'right') {
  const idx = activePath.value.indexOf(nid)
  if (idx === -1) return
  history.switchBranch(idx + 1, dir)
  menuFor.value = null
}

function submitInline() {
  if (!inlineFor.value || !inlineText.value.trim()) return
  history.appendAt(inlineFor.value, inlineRole.value, inlineText.value)
  inlineText.value = ''
  inlineFor.value = null
}

// 导出 chat-branches（按当前 activeFile.data）
function handleExportBranches() {
  try {
    const file = history.activeFile
    if (!file) {
      alert('无可导出的活动文件')
      return
    }
    const json = JSON.stringify(file.data ?? {}, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const base = file.name.endsWith('.json') ? file.name.slice(0, -5) : file.name
    a.download = `${base}.chat-branches.json`
    a.href = url
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('导出失败')
  }
}

onMounted(() => {
  ;(window as any).lucide?.createIcons?.()
})

import { useFileManagerStore } from '@/features/files/fileManager'
const fm = useFileManagerStore()
const hasDoc = computed(() => !!history.activeData)

const fileTitle = ref<string>('')
watch(() => history.activeName, (v) => { fileTitle.value = v ?? '' }, { immediate: true })
function renameHistoryFile() {
  const oldName = history.activeName || ''
  const nn = (fileTitle.value || '').trim()
  if (!nn || !oldName || nn === oldName) return
  const ok = (history as any).renameActive?.(nn)
  if (ok) {
    try { fm.renameFile('history', oldName, nn) } catch {}
  }
}

// TS 插件模板可见性兼容
void handleFormat
void handleSave
void handleReset
void onAppend
void onTrim
void onSwitch
void pruneToHere
void switchAtHere
void submitInline
void handleExportBranches
</script>

<template>
  <section class="space-y-6">
    <!-- 顶部：标题与统计 -->
    <div class="bg-white rounded-4 card-shadow border border-gray-200 p-6 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <i data-lucide="git-branch" class="w-6 h-6 text-black"></i>
          <h2>{{ metaTitle }}</h2>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="fileTitle"
            placeholder="文件名.json"
            class="w-56 px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            @keyup.enter="renameHistoryFile"
            @blur="renameHistoryFile"
          />
          <button
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
            @click="renameHistoryFile"
          >重命名</button>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <span class="text-xs text-black/60">Active Path:</span>
        <span v-for="nid in activePath" :key="nid" class="text-xs px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent">{{ nid }}</span>
      </div>

      <div class="mt-2 flex flex-wrap items-center gap-2">
        <span class="text-xs text-black/60">j/n 指示：</span>
        <span
          v-for="r in levels"
          :key="r.depth"
          class="text-xs px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent"
        >
          d{{ r.depth }} → j={{ r.j ?? '—' }} / n={{ r.n ?? '—' }}
        </span>
      </div>

      <!-- 图例与切换方向提示 -->
      <div class="mt-3 bg-white rounded-4 border border-gray-200 p-3">
        <div class="flex items-center gap-2 mb-2">
          <i data-lucide="info" class="w-4 h-4 text-black"></i>
          <span class="text-sm font-medium text-black">图例与切换方向提示</span>
        </div>
        <div class="text-xs text-black/70 leading-6">
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <span class="px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent">j/n</span>
            <span>同一父节点下的兄弟序号/总数（1 开始）</span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <i data-lucide="arrow-left" class="w-4 h-4 text-black"></i>
            <span>左切换：选择同层前一个兄弟（j-1，最小为 1）</span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <i data-lucide="arrow-right" class="w-4 h-4 text-black"></i>
            <span>右切换：若 j < n → 选择 j+1；若 j = n → 新建 assistant 子节点（n+1）</span>
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-black/70">
            <span class="text-black/60">当前末层：</span>
            <span class="px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent">d{{ latest.depth }}</span>
            <span class="px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent">j={{ latest.j ?? '—' }}/n={{ latest.n ?? '—' }}</span>
            <span class="px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent" v-if="(latest.j ?? 0) > 1">
              ← 可切左 (j-1)
            </span>
            <span class="px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent" v-if="latest.j !== null && latest.n !== null && latest.j < latest.n">
              → 可切右 (j+1)
            </span>
            <span class="px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent" v-if="latest.j !== null && latest.n !== null && latest.j === latest.n">
              → 新建 (n+1)
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态提示 -->
    <div v-if="!hasDoc" class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="text-sm text-black/70">当前无对话 JSON，请使用右上角“新建”或“导入”。</div>
    </div>

    <!-- 本地分支编辑工具栏（前端缓存 json） -->
    <div v-if="hasDoc" class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-3 mb-3">
        <i data-lucide="hammer" class="w-4 h-4 text-black"></i>
        <span class="text-sm font-medium text-black">本地分支编辑（前端缓存 json）</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <!-- 追加消息（多行输入 + Ctrl+Enter 发送） -->
        <div class="md:col-span-2">
          <div class="flex gap-2">
            <select v-model="appendRole" class="h-10 px-2 border border-gray-900 rounded-4 bg-white text-black">
              <option value="user">user</option>
              <option value="assistant">assistant</option>
              <option value="system">system</option>
            </select>
            <textarea
              v-model="appendText"
              placeholder="输入消息内容（支持多行，Ctrl+Enter 快速追加）"
              class="flex-1 h-24 px-3 py-2 border border-gray-200 rounded-4 bg-white text-black resize-y"
              @keydown.ctrl.enter.prevent="onAppend"
            ></textarea>
            <button
              class="px-3 h-10 rounded-4 border border-gray-900 text-black bg-white hover:bg-gray-100 transition"
              @click="onAppend"
            >追加</button>
          </div>
        </div>

        <!-- 修剪 -->
        <div class="flex gap-2">
          <input v-model.number="trimDepth" type="number" min="1" class="w-24 h-10 px-2 border border-gray-200 rounded-4 bg-white text-black" />
          <button
            class="px-3 h-10 rounded-4 border border-gray-900 text-black bg-white hover:bg-gray-100 transition"
            @click="onTrim"
          >修剪到深度</button>
        </div>
      </div>

      <div class="mt-3 flex gap-2">
        <button
          class="px-3 h-10 rounded-4 border border-gray-900 text-black bg-white hover:bg-gray-100 transition"
          @click="onSwitch('left')"
        >左切换</button>
        <button
          class="px-3 h-10 rounded-4 border border-gray-900 text-black bg-white hover:bg-gray-100 transition"
          @click="onSwitch('right')"
        >右切换/新建</button>
      </div>
    </div>

    <!-- 树视图 -->
    <div v-if="hasDoc" class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <i data-lucide="tree-deciduous" class="w-4 h-4 text-black"></i>
          <span class="text-sm font-medium text-black">分支树</span>
        </div>
        <label class="inline-flex items-center gap-2 select-none">
          <input
            type="checkbox"
            v-model="onlyActive"
            class="w-5 h-5 border border-gray-400 rounded-4 accent-black focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          />
          <span class="text-sm text-black/80">仅显示活动路径</span>
        </label>
      </div>

      <div>
        <div
          v-for="nid in order"
          :key="nid"
          class="py-2 border-b last:border-b-0 border-gray-100"
          :style="{ paddingLeft: `${Math.max(0, depthOf(doc, nid)) * 16}px` }"
        >
          <div class="flex items-center gap-2 relative">
            <span class="text-xs px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent">{{ nid }}</span>
            <span class="text-2xs px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent">{{ doc.nodes[nid]?.role || 'unknown' }}</span>
            <span class="text-2xs px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent">
              d{{ (depthOf(doc, nid) + 1) }}
            </span>
            <span
              v-if="jnOf(doc, nid).j !== null"
              class="text-2xs px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent"
            >
              {{ jnOf(doc, nid).j }}/{{ jnOf(doc, nid).n ?? '—' }}
            </span>
            <span
              v-if="isInActivePath(nid)"
              class="text-2xs px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-gray-100"
            >active</span>

            <button
              class="ml-auto p-1 rounded-4 border border-gray-200 hover:bg-gray-50"
              @click="menuFor = (menuFor === nid ? null : nid)"
              title="更多操作"
            >
              <i data-lucide="more-horizontal" class="w-4 h-4 text-black"></i>
            </button>

            <!-- 上下文菜单 -->
            <div
              v-if="menuFor === nid"
              class="absolute right-0 top-6 z-10 w-48 bg-white border border-gray-200 rounded-4 shadow"
            >
              <button
                class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                @click="inlineFor = nid; menuFor = null"
              >追加子节点…</button>
              <button
                class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                :disabled="!isInActivePath(nid)"
                @click="pruneToHere(nid)"
              >修剪至此</button>
              <button
                class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                :disabled="!isInActivePath(nid) || (jnOf(doc, nid).j ?? 0) <= 1"
                @click="switchAtHere(nid, 'left')"
              >从此层向左切换</button>
              <button
                class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                :disabled="!isInActivePath(nid)"
                @click="switchAtHere(nid, 'right')"
              >从此层向右切换/新建</button>
            </div>
          </div>

          <!-- 内联追加输入 -->
          <div v-if="inlineFor === nid" class="mt-2">
            <div class="flex gap-2">
              <select v-model="inlineRole" class="h-10 px-2 border border-gray-900 rounded-4 bg-white text-black">
                <option value="user">user</option>
                <option value="assistant">assistant</option>
                <option value="system">system</option>
              </select>
              <textarea
                v-model="inlineText"
                placeholder="输入子节点内容（Ctrl+Enter 添加）"
                class="flex-1 h-24 px-3 py-2 border border-gray-200 rounded-4 bg-white text-black resize-y"
                @keydown.ctrl.enter.prevent="submitInline"
              ></textarea>
            </div>
            <div class="mt-2 flex gap-2">
              <button
                class="px-3 h-10 rounded-4 border border-gray-900 text-black bg-white hover:bg-gray-100 transition"
                @click="submitInline"
              >添加</button>
              <button
                class="px-3 h-10 rounded-4 border border-gray-900 text-black bg-white hover:bg-gray-100 transition"
                @click="inlineFor = null; inlineText = ''"
              >取消</button>
            </div>
          </div>

          <div class="mt-1 text-sm text-black/70 leading-6 break-words">
            {{ doc.nodes[nid]?.content || '（无内容）' }}
          </div>
        </div>
      </div>
    </div>

    <!-- OpenAI messages 预览 -->
    <div v-if="hasDoc" class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-2">
        <i data-lucide="messages-square" class="w-4 h-4 text-black"></i>
        <span class="text-sm font-medium text-black">OpenAI 消息视图（按活动路径）</span>
      </div>
      <div class="space-y-2">
        <div v-for="(m, idx) in messages" :key="idx" class="border border-gray-200 rounded-4 p-3">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent">{{ m.role }}</span>
            <span class="text-xs text-black/60">#{{ idx + 1 }}</span>
          </div>
          <div class="text-sm text-black/70 leading-6 break-words">{{ m.content }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 局部样式最小化，遵循黑白主题与 4/8pt 间距系统 */
</style>