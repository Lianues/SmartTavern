<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useCharacterStore } from '@/features/characters/store'
import CharWorldBookCard from '@/features/characters/components/CharWorldBookCard.vue'
import CharRegexRuleCard from '@/features/characters/components/CharRegexRuleCard.vue'
import type { WorldBookEntry, RegexRule } from '@/features/presets/types'
import { useFileManagerStore } from '@/features/files/fileManager'

const store = useCharacterStore()
const fm = useFileManagerStore()

const fileTitle = ref<string>('Character.json')
const renameError = ref<string | null>(null)
watch(
  () => store.fileName,
  (v) => { fileTitle.value = v || 'Character.json' },
  { immediate: true }
)
function renameCharacterFile() {
  renameError.value = null
  const oldName = store.fileName || 'Character.json'
  const nn = (fileTitle.value || '').trim()
  if (!nn) { renameError.value = '文件名不能为空'; return }
  if (nn === oldName) return
  ;(store as any).renameFile?.(nn)
  try { fm.renameFile('characters', oldName, nn) } catch {}
}

onMounted(() => {
  store.load()
  ;(window as any).lucide?.createIcons?.()
})

watch(
  () => [store.worldEntries.length, store.regexRules.length],
  async () => {
    await nextTick()
    ;(window as any).lucide?.createIcons?.()
  },
  { deep: false }
)

/* 基本信息编辑 */
const nameDraft = ref<string>('')
const descDraft = ref<string>('')

const hasDoc = computed(() => store.hasDoc)

watch(
  () => store.name,
  (v) => { nameDraft.value = v ?? '' },
  { immediate: true }
)
watch(
  () => store.description,
  (v) => { descDraft.value = v ?? '' },
  { immediate: true }
)

function saveMeta() {
  store.updateName(nameDraft.value)
  store.updateDescription(descDraft.value)
}

/* 初始消息编辑（读取/写入 doc.message） */
const messageEdits = ref<string[]>([])
const editingMsgIndex = ref<number | null>(null)

const messages = computed(() => store.messages)

watch(
  messages,
  (arr) => {
    messageEdits.value = (arr || []).map(x => String(x ?? ''))
  },
  { immediate: true }
)

function onEditMsg(i: number) {
  editingMsgIndex.value = i
}
function onCancelMsg(i: number) {
  if (!messages.value) return
  messageEdits.value[i] = String(messages.value[i] ?? '')
  editingMsgIndex.value = null
}
function onSaveMsg(i: number) {
  if (i < 0 || i >= messageEdits.value.length) return
  store.setMessage(i, messageEdits.value[i] ?? '')
  editingMsgIndex.value = null
}
function removeMessage(i: number) {
  store.removeMessage(i)
}
function addMessage() {
  store.addMessage('')
  editingMsgIndex.value = (messages.value?.length ?? 1) - 1
  nextTick(() => (window as any).lucide?.createIcons?.())
}

/* 内嵌世界书面板（与独立面板类似，复用卡片组件） */
const newWbId = ref<string>('')
const newWbName = ref<string>('')

// 拖拽：世界书
const draggingWb = ref<string | null>(null)
const dragOverWbId = ref<string | null>(null)
const dragOverWbBefore = ref<boolean>(true)

function onDragStartWb(id: string, ev: DragEvent) {
  draggingWb.value = id
  try {
    ev.dataTransfer?.setData('text/plain', id)
    ev.dataTransfer!.effectAllowed = 'move'
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1
    ev.dataTransfer?.setDragImage(canvas, 0, 0)
  } catch {}
}

function onDragOverWb(overId: string | null, ev: DragEvent) {
  if (!draggingWb.value) return
  ev.preventDefault()
  try {
    const el = ev.currentTarget as HTMLElement | null
    if (el) {
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      dragOverWbBefore.value = ev.clientY < mid
    }
  } catch {}
  dragOverWbId.value = overId
}

function onDropWb(overId: string | null, ev: DragEvent) {
  if (!draggingWb.value) return
  ev.preventDefault()
  const dId = draggingWb.value
  const list = [...(store.worldEntries || [])]
  let ids = list.map(i => (i as any).id)
  const fromIdx = ids.indexOf(dId)
  if (fromIdx < 0) return
  ids.splice(fromIdx, 1)
  if (overId && overId !== dId) {
    const toIdx = ids.indexOf(overId)
    let insertIdx = toIdx < 0 ? ids.length : toIdx + (dragOverWbBefore.value ? 0 : 1)
    if (insertIdx < 0) insertIdx = 0
    if (insertIdx > ids.length) insertIdx = ids.length
    ids.splice(insertIdx, 0, dId)
  } else {
    ids.push(dId)
  }
  store.reorderWorldBooks(ids)
  draggingWb.value = null
  dragOverWbId.value = null
  ;(window as any).lucide?.createIcons?.()
}
function onDropEndWb(ev: DragEvent) { onDropWb(null, ev) }
function onDragEndWb() { draggingWb.value = null; dragOverWbId.value = null }

// 拖拽：正则
const draggingRx = ref<string | null>(null)
const dragOverRxId = ref<string | null>(null)
const dragOverRxBefore = ref<boolean>(true)

function onDragStartRx(id: string, ev: DragEvent) {
  draggingRx.value = id
  try {
    ev.dataTransfer?.setData('text/plain', id)
    ev.dataTransfer!.effectAllowed = 'move'
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1
    ev.dataTransfer?.setDragImage(canvas, 0, 0)
  } catch {}
}

function onDragOverRx(overId: string | null, ev: DragEvent) {
  if (!draggingRx.value) return
  ev.preventDefault()
  try {
    const el = ev.currentTarget as HTMLElement | null
    if (el) {
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      dragOverRxBefore.value = ev.clientY < mid
    }
  } catch {}
  dragOverRxId.value = overId
}

function onDropRx(overId: string | null, ev: DragEvent) {
  if (!draggingRx.value) return
  ev.preventDefault()
  const dId = draggingRx.value
  const list = [...(store.regexRules || [])]
  let ids = list.map(i => i.id)
  const fromIdx = ids.indexOf(dId)
  if (fromIdx < 0) return
  ids.splice(fromIdx, 1)
  if (overId && overId !== dId) {
    const toIdx = ids.indexOf(overId)
    let insertIdx = toIdx < 0 ? ids.length : toIdx + (dragOverRxBefore.value ? 0 : 1)
    if (insertIdx < 0) insertIdx = 0
    if (insertIdx > ids.length) insertIdx = ids.length
    ids.splice(insertIdx, 0, dId)
  } else {
    ids.push(dId)
  }
  store.reorderRegexRules(ids)
  draggingRx.value = null
  dragOverRxId.value = null
  ;(window as any).lucide?.createIcons?.()
}
function onDropEndRx(ev: DragEvent) { onDropRx(null, ev) }
function onDragEndRx() { draggingRx.value = null; dragOverRxId.value = null }

function addWorldEntry() {
  const id = newWbId.value.trim()
  const name = newWbName.value.trim()
  if (!id) { alert('请填写世界书 ID'); return }
  if (!name) { alert('请填写 世界书名称'); return }
  const list = store.worldEntries
  if (list.some(e => (e as any)?.id === id)) { alert('ID 已存在'); return }
  const entry: WorldBookEntry = {
    id,
    name,
    enabled: true,
    content: '',
    mode: 'always',
    position: 'before_char',
    order: 100,
    depth: 0,
    keys: [],
  }
  store.addWorldBook(entry)
  newWbId.value = ''
  newWbName.value = ''
  nextTick(() => (window as any).lucide?.createIcons?.())
}

/* 内嵌正则面板（与独立面板类似，复用卡片组件的字符版） */
const newRuleId = ref<string>('')
const newRuleName = ref<string>('')
const ruleError = ref<string | null>(null)

function addRegexRule() {
  ruleError.value = null
  const id = newRuleId.value.trim()
  const name = newRuleName.value.trim()
  if (!id) { ruleError.value = '请填写 规则 id'; return }
  if (!name) { ruleError.value = '请填写 规则名称'; return }
  const rules = store.regexRules || []
  if (rules.some(r => r.id === id)) { ruleError.value = '该 id 已存在'; return }
  const rule: RegexRule = {
    id, name, enabled: true,
    find_regex: '', replace_regex: '',
    targets: [], placement: 'after_macro', views: [],
  }
  store.addRegexRule(rule)
  newRuleId.value = ''
  newRuleName.value = ''
  nextTick(() => (window as any).lucide?.createIcons?.())
}
</script>

<template>
  <section class="space-y-6">
    <!-- 顶部卡片：角色卡编辑入口 -->
    <div class="bg-white rounded-4 card-shadow border border-gray-200 p-6 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <i data-lucide="user" class="w-5 h-5 text-black"></i>
          <h2>角色卡（单文件导入/导出）</h2>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="fileTitle"
            placeholder="文件名.json"
            class="w-56 px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            @keyup.enter="renameCharacterFile"
            @blur="renameCharacterFile"
          />
          <button
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
            @click="renameCharacterFile"
          >重命名</button>
        </div>
      </div>
      <p class="mt-2 text-xs text-black/60">
        使用右上角导入按钮选择单个角色卡 JSON（结构参考：backend_projects/SmartTavern/data/characters/*/character.json）。导出也在右上角完成。
      </p>
    </div>

    <!-- 基本设定 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="id-card" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">基本设定</h3>
      </div>

      <div v-if="!hasDoc" class="text-sm text-black/60">
        暂无已加载的角色卡，请使用右上角“导入”加载单个角色卡 JSON。
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-black mb-2">名称</label>
          <input v-model="nameDraft" @blur="saveMeta" class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800" />
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">描述</label>
          <textarea v-model="descDraft" @blur="saveMeta" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800" />
        </div>
      </div>
    </div>

    <!-- 初始消息（message[]） -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <i data-lucide="message-square" class="w-4 h-4 text-black"></i>
          <h3 class="text-base font-semibold text-black">初始消息（message）</h3>
        </div>
        <div class="flex items-center gap-2">
          <button class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100"
                  @click="addMessage">新增</button>
        </div>
      </div>

      <div v-if="!hasDoc" class="text-xs text-black/60">未加载角色卡</div>

      <div v-else class="space-y-3">
        <div v-for="(m, i) in messageEdits" :key="i" class="border border-gray-200 rounded-4 p-3">
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="text-xs text-black/60">#{{ i + 1 }} · 长度：{{ (m || '').length }}</div>
            <div class="flex items-center gap-2">
              <template v-if="editingMsgIndex === i">
                <button class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100"
                        @click="onSaveMsg(i)">保存</button>
                <button class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100"
                        @click="onCancelMsg(i)">取消</button>
              </template>
              <template v-else>
                <button class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100"
                        @click="onEditMsg(i)">编辑</button>
                <button class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100"
                        @click="removeMessage(i)">删除</button>
              </template>
            </div>
          </div>
          <template v-if="editingMsgIndex === i">
            <textarea v-model="messageEdits[i]" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800" />
          </template>
          <template v-else>
            <div class="text-sm text-black/70 whitespace-pre-wrap">{{ m }}</div>
          </template>
        </div>
      </div>
    </div>

    <!-- 内嵌 · 世界书 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 mb-3">
          <i data-lucide="book-open" class="w-4 h-4 text-black"></i>
          <h3 class="text-base font-semibold text-black">世界书编辑</h3>
        </div>
        <div class="flex items-center gap-2">
          <input v-model="newWbId" placeholder="id" class="w-32 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800" />
          <input v-model="newWbName" placeholder="名称" class="w-40 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800" />
          <button class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100"
                  @click="addWorldEntry">添加</button>
        </div>
      </div>

      <div v-if="!hasDoc" class="text-xs text-black/60">未加载角色卡</div>

      <div v-else class="space-y-2">
        <div
          v-for="w in store.worldEntries"
          :key="(w as any).id"
          class="flex items-stretch gap-2 group draglist-item"
          :class="{
            'dragging-item': draggingWb && draggingWb === (w as any).id,
            'drag-over-top': draggingWb && dragOverWbId === (w as any).id && dragOverWbBefore,
            'drag-over-bottom': draggingWb && dragOverWbId === (w as any).id && !dragOverWbBefore
          }"
          @dragover.prevent="onDragOverWb((w as any).id, $event)"
          @drop.prevent="onDropWb((w as any).id, $event)"
        >
          <div
            class="w-6 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
            draggable="true"
            @dragstart="onDragStartWb((w as any).id, $event)"
            @dragend="onDragEndWb"
            title="拖拽排序"
          >
            <i data-lucide="grip-vertical" class="icon-grip w-4 h-4 text-black opacity-60 group-hover:opacity-100"></i>
          </div>
          <div class="flex-1">
            <CharWorldBookCard :entry="w" />
          </div>
        </div>
        <div
          class="h-3 draglist-end"
          :class="{ 'drag-over-end': draggingWb && dragOverWbId === null }"
          @dragover.prevent="onDragOverWb(null, $event)"
          @drop.prevent="onDropEndWb($event)"
        />
      </div>
    </div>

    <!-- 内嵌 · 正则 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 mb-3">
          <i data-lucide="code" class="w-4 h-4 text-black"></i>
          <h3 class="text-base font-semibold text-black">正则编辑</h3>
        </div>
        <div class="flex items-center gap-2">
          <input v-model="newRuleId" placeholder="规则 id" class="w-32 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800" />
          <input v-model="newRuleName" placeholder="规则名称" class="w-40 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800" />
          <button class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100"
                  @click="addRegexRule">添加</button>
        </div>
      </div>
      <p v-if="ruleError" class="text-xs text-red-600 mb-2">* {{ ruleError }}</p>

      <div v-if="!hasDoc" class="text-xs text-black/60">未加载角色卡</div>

      <div v-else class="space-y-2">
        <div
          v-for="r in store.regexRules"
          :key="r.id"
          class="flex items-stretch gap-2 group draglist-item"
          :class="{
            'dragging-item': draggingRx && draggingRx === r.id,
            'drag-over-top': draggingRx && dragOverRxId === r.id && dragOverRxBefore,
            'drag-over-bottom': draggingRx && dragOverRxId === r.id && !dragOverRxBefore
          }"
          @dragover.prevent="onDragOverRx(r.id, $event)"
          @drop.prevent="onDropRx(r.id, $event)"
        >
          <div
            class="w-6 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
            draggable="true"
            @dragstart="onDragStartRx(r.id, $event)"
            @dragend="onDragEndRx"
            title="拖拽排序"
          >
            <i data-lucide="grip-vertical" class="icon-grip w-4 h-4 text-black opacity-60 group-hover:opacity-100"></i>
          </div>
          <div class="flex-1">
            <CharRegexRuleCard :rule="r" />
          </div>
        </div>
        <div
          class="h-3 draglist-end"
          :class="{ 'drag-over-end': draggingRx && dragOverRxId === null }"
          @dragover.prevent="onDragOverRx(null, $event)"
          @drop.prevent="onDropEndRx($event)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
/* lucide 加载失败时的握把占位符 */
.icon-grip::before {
  content: '⋮⋮';
  display: inline-block;
  line-height: 1;
  font-weight: 700;
  color: #111;
}

/* 拖拽动效与黑线插入预览（与独立页面一致） */
.draglist-item { position: relative; }
.drag-over-top::before {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  top: -6px;
  height: 2px;
  background: #111;
  border-radius: 2px;
}
.drag-over-bottom::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: -6px;
  height: 2px;
  background: #111;
  border-radius: 2px;
}
.dragging-item {
  transform: scale(0.98);
  box-shadow: 0 12px 24px rgba(0,0,0,0.18);
  opacity: 0.92;
  z-index: 1;
  transition: transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease;
}
.draglist-end { position: relative; }
.drag-over-end::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  top: 5px;
  height: 2px;
  background: #111;
  border-radius: 2px;
}
</style>