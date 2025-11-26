<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import WorldBookCard from './cards/WorldBookCard.vue'
import RegexRuleCard from './cards/RegexRuleCard.vue'

const props = defineProps({
  characterData: { type: Object, default: null }
})


/** 深拷贝 */
function deepClone(x) { return JSON.parse(JSON.stringify(x)) }
/** 规范化后端/外部传入的角色卡结构到本组件内部期望结构 */
function normalizeCharacterData(src) {
  if (!src || typeof src !== 'object') return null
  const name = src.name || '角色'
  const description = src.description || ''
  const message = Array.isArray(src.message) ? src.message
                 : Array.isArray(src.messages) ? src.messages
                 : []
  // world_book 可能是对象 { name, entries } 或直接 entries 数组
  let world_book
  if (Array.isArray(src.entries)) {
    world_book = { name: src.world_book?.name || '角色世界书', entries: src.entries }
  } else if (Array.isArray(src.world_book?.entries)) {
    world_book = { name: src.world_book.name || '角色世界书', entries: src.world_book.entries }
  } else if (Array.isArray(src.worldbook?.entries)) {
    world_book = { name: src.worldbook.name || '角色世界书', entries: src.worldbook.entries }
  } else {
    world_book = { name: src.world_book?.name || '角色世界书', entries: [] }
  }
  const regex_rules = Array.isArray(src.regex_rules)
    ? src.regex_rules
    : (src.find_regex || src.replace_regex || src.id) ? [src] : []
  return { name, description, message, world_book, regex_rules }
}
// 当前编辑的数据（内存中）
const currentData = ref(
  deepClone(
    normalizeCharacterData(props.characterData) || {
      name: '',
      description: '',
      message: [],
      world_book: { name: '', entries: [] },
      regex_rules: []
    }
  )
)
// 外部数据变更时同步
watch(() => props.characterData, async (v) => {
  currentData.value = deepClone(
    normalizeCharacterData(v) || {
      name: '',
      description: '',
      message: [],
      world_book: { name: '', entries: [] },
      regex_rules: []
    }
  )
  await nextTick()
  window.lucide?.createIcons?.()
})

// 基本信息编辑
const nameDraft = ref(currentData.value.name || '')
const descDraft = ref(currentData.value.description || '')

function saveMeta() {
  currentData.value.name = nameDraft.value
  currentData.value.description = descDraft.value
}

// 初始消息编辑
const messageEdits = ref([...(currentData.value.message || [])])
const editingMsgIndex = ref(null)

watch(
  () => currentData.value.message,
  (arr) => {
    messageEdits.value = [...(arr || [])]
  },
  { deep: true }
)

function onEditMsg(i) {
  editingMsgIndex.value = i
}

function onCancelMsg(i) {
  messageEdits.value[i] = currentData.value.message[i]
  editingMsgIndex.value = null
}

function onSaveMsg(i) {
  if (i < 0 || i >= messageEdits.value.length) return
  currentData.value.message[i] = messageEdits.value[i]
  editingMsgIndex.value = null
}

function removeMessage(i) {
  currentData.value.message.splice(i, 1)
  messageEdits.value.splice(i, 1)
}

function addMessage() {
  if (!currentData.value.message) currentData.value.message = []
  currentData.value.message.push('')
  messageEdits.value.push('')
  editingMsgIndex.value = currentData.value.message.length - 1
  nextTick(() => window.lucide?.createIcons?.())
}

// 内嵌世界书
const newWbId = ref('')
const newWbName = ref('')
const wbError = ref(null)

function addWorldEntry() {
  wbError.value = null
  const id = newWbId.value.trim()
  const name = newWbName.value.trim()
  if (!id) {
    wbError.value = '请填写世界书 ID'
    return
  }
  if (!name) {
    wbError.value = '请填写世界书名称'
    return
  }
  if (!currentData.value.world_book) {
    currentData.value.world_book = { name: '角色世界书', entries: [] }
  }
  const list = currentData.value.world_book.entries || []
  if (list.some(e => e.id === id)) {
    wbError.value = 'ID 已存在'
    return
  }
  const entry = {
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
  if (!currentData.value.world_book.entries) currentData.value.world_book.entries = []
  currentData.value.world_book.entries.push(entry)
  newWbId.value = ''
  newWbName.value = ''
  nextTick(() => window.lucide?.createIcons?.())
}

function onWbUpdate(updated) {
  const list = currentData.value.world_book?.entries || []
  const oldId = updated._oldId || updated.id
  const idx = list.findIndex(w => w.id === oldId)
  if (idx >= 0) {
    const { _oldId, ...cleanData } = updated
    list[idx] = cleanData
  }
}

function onWbDelete(id) {
  if (currentData.value.world_book?.entries) {
    currentData.value.world_book.entries = currentData.value.world_book.entries.filter(w => w.id !== id)
  }
}

// 拖拽：世界书
const draggingWb = ref(null)
const dragOverWbId = ref(null)
const dragOverWbBefore = ref(true)

// 拖拽时自动滚动
let autoScrollInterval = null

function startAutoScroll(ev) {
  const scrollContainer = ev.target.closest('.modal-scroll')?.querySelector('.scroll-container')
  if (!scrollContainer) return
  const rect = scrollContainer.getBoundingClientRect()
  const mouseY = ev.clientY
  const edgeSize = 80
  const distanceFromTop = mouseY - rect.top
  const distanceFromBottom = rect.bottom - mouseY
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval)
    autoScrollInterval = null
  }
  if (distanceFromTop < edgeSize && distanceFromTop > 0) {
    const speed = Math.max(2, (edgeSize - distanceFromTop) / 4)
    autoScrollInterval = setInterval(() => {
      scrollContainer.scrollTop -= speed
    }, 16)
  } else if (distanceFromBottom < edgeSize && distanceFromBottom > 0) {
    const speed = Math.max(2, (edgeSize - distanceFromBottom) / 4)
    autoScrollInterval = setInterval(() => {
      scrollContainer.scrollTop += speed
    }, 16)
  }
}

function stopAutoScroll() {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval)
    autoScrollInterval = null
  }
}

function onDragStartWb(id, ev) {
  draggingWb.value = id
  try {
    ev.dataTransfer?.setData('text/plain', id)
    ev.dataTransfer.effectAllowed = 'move'
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    ev.dataTransfer?.setDragImage(canvas, 0, 0)
  } catch {}
}

function onDragOverWb(overId, ev) {
  if (!draggingWb.value) return
  ev.preventDefault()
  startAutoScroll(ev)
  try {
    const el = ev.currentTarget
    if (el) {
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      dragOverWbBefore.value = ev.clientY < mid
    }
  } catch {}
  dragOverWbId.value = overId
}

function onDropWb(overId, ev) {
  if (!draggingWb.value) return
  ev.preventDefault()
  const dId = draggingWb.value
  const list = [...(currentData.value.world_book?.entries || [])]
  let ids = list.map(i => i.id)
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
  currentData.value.world_book.entries = ids.map(id => list.find(w => w.id === id)).filter(Boolean)
  draggingWb.value = null
  dragOverWbId.value = null
  window.lucide?.createIcons?.()
}

function onDropEndWb(ev) {
  onDropWb(null, ev)
}

function onDragEndWb() {
  stopAutoScroll()
  draggingWb.value = null
  dragOverWbId.value = null
}

// 内嵌正则规则
const newRuleId = ref('')
const newRuleName = ref('')
const ruleError = ref(null)

function addRegexRule() {
  ruleError.value = null
  const id = newRuleId.value.trim()
  const name = newRuleName.value.trim()
  if (!id) {
    ruleError.value = '请填写规则 id'
    return
  }
  if (!name) {
    ruleError.value = '请填写规则名称'
    return
  }
  const rules = currentData.value.regex_rules || []
  if (rules.some(r => r.id === id)) {
    ruleError.value = '该 id 已存在'
    return
  }
  const rule = {
    id,
    name,
    enabled: true,
    find_regex: '',
    replace_regex: '',
    targets: [],
    placement: 'after_macro',
    views: [],
  }
  if (!currentData.value.regex_rules) currentData.value.regex_rules = []
  currentData.value.regex_rules.push(rule)
  newRuleId.value = ''
  newRuleName.value = ''
  nextTick(() => window.lucide?.createIcons?.())
}

function onRegexUpdate(updated) {
  const idx = currentData.value.regex_rules.findIndex(r => r.id === updated.id)
  if (idx >= 0) {
    currentData.value.regex_rules[idx] = updated
  }
}

function onRegexDelete(id) {
  currentData.value.regex_rules = currentData.value.regex_rules.filter(r => r.id !== id)
}

// 拖拽：正则
const draggingRx = ref(null)
const dragOverRxId = ref(null)
const dragOverRxBefore = ref(true)

function onDragStartRx(id, ev) {
  draggingRx.value = id
  try {
    ev.dataTransfer?.setData('text/plain', id)
    ev.dataTransfer.effectAllowed = 'move'
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    ev.dataTransfer?.setDragImage(canvas, 0, 0)
  } catch {}
}

function onDragOverRx(overId, ev) {
  if (!draggingRx.value) return
  ev.preventDefault()
  try {
    const el = ev.currentTarget
    if (el) {
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      dragOverRxBefore.value = ev.clientY < mid
    }
  } catch {}
  dragOverRxId.value = overId
}

function onDropRx(overId, ev) {
  if (!draggingRx.value) return
  ev.preventDefault()
  const dId = draggingRx.value
  const list = [...(currentData.value.regex_rules || [])]
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
  currentData.value.regex_rules = ids.map(id => list.find(r => r.id === id)).filter(Boolean)
  draggingRx.value = null
  dragOverRxId.value = null
  window.lucide?.createIcons?.()
}

function onDropEndRx(ev) {
  onDropRx(null, ev)
}

function onDragEndRx() {
  draggingRx.value = null
  dragOverRxId.value = null
}

// 初始化 Lucide 图标
onMounted(() => {
  window.lucide?.createIcons?.()
})

watch([
  () => currentData.value.message,
  () => currentData.value.world_book?.entries,
  () => currentData.value.regex_rules
], async () => {
  await nextTick()
  window.lucide?.createIcons?.()
}, { flush: 'post' })
</script>

<template>
  <section class="space-y-6">
    <!-- 页面标题 -->
    <div class="bg-white rounded-4 card-shadow border border-gray-200 p-6 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <i data-lucide="user" class="w-5 h-5 text-black"></i>
          <h2 class="text-lg font-bold text-black">角色卡编辑</h2>
        </div>
        <div class="px-3 py-1 rounded-4 bg-gray-100 border border-gray-300 text-black text-sm">
          编辑模式
        </div>
      </div>
      <p class="mt-2 text-xs text-black/60">此页面支持编辑角色的基本信息、初始消息、内嵌世界书和正则规则</p>
    </div>

    <!-- 基本设定 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="id-card" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">基本设定</h3>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-black mb-2">角色名称</label>
          <input 
            v-model="nameDraft" 
            @blur="saveMeta" 
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" 
          />
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">角色描述</label>
          <textarea 
            v-model="descDraft" 
            @blur="saveMeta" 
            rows="3" 
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" 
          />
        </div>
      </div>
    </div>

    <!-- 初始消息 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <i data-lucide="message-square" class="w-4 h-4 text-black"></i>
          <h3 class="text-base font-semibold text-black">初始消息 ({{ messageEdits.length }})</h3>
        </div>
        <button 
          class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
          @click="addMessage"
        >
          新增消息
        </button>
      </div>

      <div v-if="messageEdits.length === 0" class="text-center py-8 text-black/50 text-sm">
        暂无初始消息，点击右上角"新增消息"按钮添加
      </div>

      <div class="space-y-3">
        <div 
          v-for="(m, i) in messageEdits" 
          :key="i" 
          class="border border-gray-200 rounded-4 p-3 bg-white transition-all duration-200 ease-soft hover:shadow-elevate"
        >
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="text-xs text-black/60">消息 #{{ i + 1 }} · 字符数：{{ (m || '').length }}</div>
            <div class="flex items-center gap-2">
              <template v-if="editingMsgIndex === i">
                <button 
                  class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100"
                  @click="onSaveMsg(i)"
                >保存</button>
                <button 
                  class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100"
                  @click="onCancelMsg(i)"
                >取消</button>
              </template>
              <template v-else>
                <button 
                  class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100"
                  @click="onEditMsg(i)"
                >编辑</button>
                <button 
                  class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100"
                  @click="removeMessage(i)"
                >删除</button>
              </template>
            </div>
          </div>
          <template v-if="editingMsgIndex === i">
            <textarea 
              v-model="messageEdits[i]" 
              rows="4" 
              class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" 
            />
          </template>
          <template v-else>
            <div class="text-sm text-black/70 whitespace-pre-wrap leading-relaxed">{{ m }}</div>
          </template>
        </div>
      </div>
    </div>

    <!-- 内嵌世界书 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <i data-lucide="book-open" class="w-4 h-4 text-black"></i>
          <h3 class="text-base font-semibold text-black">内嵌世界书</h3>
        </div>
        <div class="flex items-center gap-2">
          <input 
            v-model="newWbId" 
            placeholder="id" 
            class="w-32 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800" 
          />
          <input 
            v-model="newWbName" 
            placeholder="名称" 
            class="w-40 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800" 
          />
          <button 
            class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
            @click="addWorldEntry"
          >
            添加
          </button>
        </div>
      </div>
      <p v-if="wbError" class="text-xs text-red-600 mb-2">* {{ wbError }}</p>

      <div class="space-y-2">
        <div
          v-for="w in (currentData.world_book?.entries || [])"
          :key="w.id"
          class="flex items-stretch gap-2 group draglist-item"
          :class="{
            'dragging-item': draggingWb && draggingWb === w.id,
            'drag-over-top': draggingWb && dragOverWbId === w.id && dragOverWbBefore,
            'drag-over-bottom': draggingWb && dragOverWbId === w.id && !dragOverWbBefore
          }"
          @dragover.prevent="onDragOverWb(w.id, $event)"
          @drop.prevent="onDropWb(w.id, $event)"
        >
          <div
            class="w-6 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
            draggable="true"
            @dragstart="onDragStartWb(w.id, $event)"
            @dragend="onDragEndWb"
            title="拖拽排序"
          >
            <i data-lucide="grip-vertical" class="icon-grip w-4 h-4 text-black opacity-60 group-hover:opacity-100"></i>
          </div>
          <div class="flex-1">
            <WorldBookCard 
              :entry="w" 
              @update="onWbUpdate"
              @delete="onWbDelete"
            />
          </div>
        </div>
        <div
          class="h-3 draglist-end"
          :class="{ 'drag-over-end': draggingWb && dragOverWbId === null }"
          @dragover.prevent="onDragOverWb(null, $event)"
          @drop.prevent="onDropEndWb($event)"
        />
      </div>

      <div v-if="(currentData.world_book?.entries || []).length === 0" class="text-center py-8 text-black/50 text-sm">
        暂无世界书条目
      </div>
    </div>

    <!-- 内嵌正则规则 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <i data-lucide="code" class="w-4 h-4 text-black"></i>
          <h3 class="text-base font-semibold text-black">正则规则</h3>
        </div>
        <div class="flex items-center gap-2">
          <input 
            v-model="newRuleId" 
            placeholder="规则 id" 
            class="w-32 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800" 
          />
          <input 
            v-model="newRuleName" 
            placeholder="规则名称" 
            class="w-40 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800" 
          />
          <button 
            class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
            @click="addRegexRule"
          >
            添加
          </button>
        </div>
      </div>
      <p v-if="ruleError" class="text-xs text-red-600 mb-2">* {{ ruleError }}</p>

      <div class="space-y-2">
        <div
          v-for="r in (currentData.regex_rules || [])"
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
            <RegexRuleCard 
              :rule="r" 
              @update="onRegexUpdate"
              @delete="onRegexDelete"
            />
          </div>
        </div>
        <div
          class="h-3 draglist-end"
          :class="{ 'drag-over-end': draggingRx && dragOverRxId === null }"
          @dragover.prevent="onDragOverRx(null, $event)"
          @drop.prevent="onDropEndRx($event)"
        />
      </div>

      <div v-if="(currentData.regex_rules || []).length === 0" class="text-center py-8 text-black/50 text-sm">
        暂无正则规则
      </div>
    </div>
  </section>
</template>

<style scoped>
.rounded-4 {
  border-radius: 10px;
}

.card-shadow {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.hover\:shadow-elevate:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.ease-soft {
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* 拖拽相关样式 */
.cursor-grab {
  cursor: grab;
}

.cursor-grab:active {
  cursor: grabbing;
}

.icon-grip::before {
  content: '⋮⋮';
  display: inline-block;
  line-height: 1;
  font-weight: 700;
  color: #111;
}

[data-theme="dark"] .icon-grip::before {
  color: rgb(232, 236, 244);
}

.draglist-item {
  position: relative;
}

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

[data-theme="dark"] .drag-over-top::before {
  background: rgb(232, 236, 244);
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

[data-theme="dark"] .drag-over-bottom::after {
  background: rgb(232, 236, 244);
}

.dragging-item {
  transform: scale(0.98);
  box-shadow: 0 12px 24px rgba(0,0,0,0.18);
  opacity: 0.92;
  z-index: 1;
  transition: transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease;
}

.draglist-end {
  position: relative;
}

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

[data-theme="dark"] .drag-over-end::after {
  background: rgb(232, 236, 244);
}

/* 深色主题适配 - 使用中性灰色 */
[data-theme="dark"] .bg-white {
  background-color: rgb(28, 28, 30) !important;
}

[data-theme="dark"] .bg-gray-100 {
  background-color: rgb(38, 38, 42) !important;
}

[data-theme="dark"] .text-black {
  color: rgb(235, 235, 240) !important;
}

[data-theme="dark"] .text-black\/50 {
  color: rgba(235, 235, 240, 0.5) !important;
}

[data-theme="dark"] .text-black\/60 {
  color: rgba(235, 235, 240, 0.6) !important;
}

[data-theme="dark"] .text-black\/70 {
  color: rgba(235, 235, 240, 0.7) !important;
}

[data-theme="dark"] .border-gray-200 {
  border-color: rgb(50, 50, 55) !important;
}

[data-theme="dark"] .border-gray-300 {
  border-color: rgb(60, 60, 65) !important;
}

[data-theme="dark"] .border-gray-800 {
  border-color: rgb(200, 200, 205) !important;
}

[data-theme="dark"] .border-gray-900 {
  border-color: rgb(200, 200, 205) !important;
}

[data-theme="dark"] .hover\:bg-gray-100:hover {
  background-color: rgb(38, 38, 42) !important;
}

[data-theme="dark"] .text-red-600 {
  color: rgb(248, 113, 113) !important;
}

/* 暗色主题 - 输入框适配 */
[data-theme="dark"] input,
[data-theme="dark"] textarea,
[data-theme="dark"] select {
  background-color: rgb(38, 38, 42) !important;
  color: rgb(235, 235, 240) !important;
  border-color: rgb(60, 60, 65) !important;
}

[data-theme="dark"] input::placeholder,
[data-theme="dark"] textarea::placeholder {
  color: rgba(235, 235, 240, 0.5) !important;
}

[data-theme="dark"] input:focus,
[data-theme="dark"] textarea:focus,
[data-theme="dark"] select:focus {
  border-color: rgb(100, 100, 110) !important;
  box-shadow: 0 0 0 2px rgba(140, 140, 160, 0.2) !important;
}

[data-theme="dark"] select option {
  background-color: rgb(38, 38, 42) !important;
  color: rgb(235, 235, 240) !important;
}

</style>