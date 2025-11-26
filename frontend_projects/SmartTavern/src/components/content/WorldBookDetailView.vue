<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import WorldBookCard from './cards/WorldBookCard.vue'
import Host from '@/workflow/core/host'
import * as Catalog from '@/workflow/channels/catalog'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  worldbookData: { type: Object, default: null },
  file: { type: String, default: '' }
})


/** 深拷贝工具 */
function deepClone(x) {
  return JSON.parse(JSON.stringify(x))
}

/** 规范化后端/外部传入的数据到本组件内部结构 */
function normalizeWorldbookData(src) {
  if (!src || typeof src !== 'object') return null
  const name = src.name || '世界书'
  const description = src.description || ''
  // 兼容两种结构：
  // - 内部结构：{ world_books: [...] }
  // - 后端文件/接口：{ entries: [...] }
  const entries = Array.isArray(src.world_books)
    ? src.world_books
    : Array.isArray(src.entries)
      ? src.entries
      : []
  const mapped = entries.map(e => ({
    id: e?.id ?? e?.identifier ?? '',
    name: e?.name ?? e?.title ?? '',
    enabled: e?.enabled !== false,
    content: e?.content ?? e?.text ?? '',
    mode: e?.mode ?? 'always',
    position: e?.position ?? 'before_char',
    order: typeof e?.order === 'number' ? e.order : 100,
    depth: typeof e?.depth === 'number' ? e.depth : 0,
    condition: e?.condition ?? '',
  }))
  return { name, description, world_books: mapped }
}

// 当前编辑的数据（内存中）
const currentData = ref(
  deepClone(
    normalizeWorldbookData(props.worldbookData) || { name: '', description: '', world_books: [] }
  )
)

// 当外部传入的 worldbookData 变化时，重新规范化并刷新图标
watch(() => props.worldbookData, async (v) => {
  currentData.value = deepClone(normalizeWorldbookData(v) || { name: '', description: '', world_books: [] })
  await nextTick()
  window.lucide?.createIcons?.()
})

// 新增条目
const newId = ref('')
const newName = ref('')
const addError = ref(null)

async function addEntry() {
  addError.value = null
  const id = newId.value.trim()
  const name = newName.value.trim()
  if (!id) {
    addError.value = t('detail.worldBook.errors.idRequired')
    return
  }
  if (!name) {
    addError.value = t('detail.worldBook.errors.nameRequired')
    return
  }
  const list = currentData.value.world_books || []
  if (list.some(e => e.id === id)) {
    addError.value = t('detail.worldBook.errors.idExists')
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
    condition: '',
  }
  if (!currentData.value.world_books) currentData.value.world_books = []
  currentData.value.world_books.push(entry)
  newId.value = ''
  newName.value = ''
  await nextTick()
  window.lucide?.createIcons?.()
}

// 条目更新和删除
function onEntryUpdate(updated) {
  const list = currentData.value.world_books || []
  // 如果 ID 改变了，需要找到原 ID
  const oldId = updated._oldId || updated.id
  const idx = list.findIndex(w => w.id === oldId)
  if (idx >= 0) {
    const { _oldId, ...cleanData } = updated
    list[idx] = cleanData
  }
}

function onEntryDelete(id) {
  currentData.value.world_books = (currentData.value.world_books || []).filter(w => w.id !== id)
}

// 拖拽排序
const dragging = ref(null)
const dragOverId = ref(null)
const dragOverBefore = ref(true)

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

function onDragStart(id, ev) {
  dragging.value = id
  try {
    ev.dataTransfer?.setData('text/plain', id)
    ev.dataTransfer.effectAllowed = 'move'
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    ev.dataTransfer?.setDragImage(canvas, 0, 0)
  } catch {}
}

function onDragOver(overId, ev) {
  if (!dragging.value) return
  ev.preventDefault()
  startAutoScroll(ev)
  try {
    const el = ev.currentTarget
    if (el) {
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      dragOverBefore.value = ev.clientY < mid
    }
  } catch {}
  dragOverId.value = overId
}

function onDrop(overId, ev) {
  if (!dragging.value) return
  ev.preventDefault()
  const dId = dragging.value
  const list = [...(currentData.value.world_books || [])]
  let ids = list.map(i => i.id)
  const fromIdx = ids.indexOf(dId)
  if (fromIdx < 0) return
  ids.splice(fromIdx, 1)
  if (overId && overId !== dId) {
    const toIdx = ids.indexOf(overId)
    let insertIdx = toIdx < 0 ? ids.length : toIdx + (dragOverBefore.value ? 0 : 1)
    if (insertIdx < 0) insertIdx = 0
    if (insertIdx > ids.length) insertIdx = ids.length
    ids.splice(insertIdx, 0, dId)
  } else {
    ids.push(dId)
  }
  currentData.value.world_books = ids.map(id => list.find(w => w.id === id)).filter(Boolean)
  dragging.value = null
  dragOverId.value = null
  window.lucide?.createIcons?.()
}

function onDropEnd(ev) {
  onDrop(null, ev)
}

function onDragEnd() {
  dragging.value = null
  dragOverId.value = null
}

// 初始化 Lucide 图标
onMounted(() => {
  window.lucide?.createIcons?.()
})

watch(() => currentData.value.world_books, async () => {
  await nextTick()
  window.lucide?.createIcons?.()
}, { flush: 'post' })

const __eventOffs = [] // 事件监听清理器
const saving = ref(false)

onBeforeUnmount(() => {
  try {
    __eventOffs?.forEach(fn => { try { fn?.() } catch (_) {} })
    __eventOffs.length = 0
  } catch (_) {}
})

// 保存到后端（事件驱动）
async function save() {
  const file = props.file
  if (!file) {
    try { alert(t('error.missingFilePath')); } catch (_) {}
    return
  }
  // 将内部 world_books 转换为 entries
  const entries = (currentData.value.world_books || []).map(w => ({
    id: w?.id ?? '',
    name: w?.name ?? '',
    content: w?.content ?? '',
    enabled: w?.enabled !== false,
    mode: w?.mode ?? 'always',
    position: w?.position ?? 'before_char',
    order: typeof w?.order === 'number' ? w.order : 100,
    depth: typeof w?.depth === 'number' ? w.depth : 0,
    condition: w?.condition ?? '',
  }))
  const content = {
    name: currentData.value.name || '',
    description: currentData.value.description || '',
    entries
  }
  
  saving.value = true
  const tag = `worldbook_save_${Date.now()}`
  
  // 监听保存结果（一次性）
  const offOk = Host.events.on(Catalog.EVT_CATALOG_WORLDBOOK_UPDATE_OK, ({ file: resFile, tag: resTag }) => {
    if (resFile !== file || resTag !== tag) return
    console.log('[WorldBookDetailView] 保存成功（事件）')
    saving.value = false
    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  
  const offFail = Host.events.on(Catalog.EVT_CATALOG_WORLDBOOK_UPDATE_FAIL, ({ file: resFile, message, tag: resTag }) => {
    if (resFile && resFile !== file) return
    if (resTag && resTag !== tag) return
    console.error('[WorldBookDetailView] 保存失败（事件）:', message)
    try { alert(t('detail.worldBook.saveFailed') + '：' + message) } catch (_) {}
    saving.value = false
    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  
  __eventOffs.push(offOk, offFail)
  
  // 发送保存请求事件
  Host.events.emit(Catalog.EVT_CATALOG_WORLDBOOK_UPDATE_REQ, {
    file,
    content,
    name: content.name,
    description: content.description,
    tag
  })
}
</script>

<template>
  <section class="space-y-6">
    <!-- 页面标题 -->
    <div class="bg-white rounded-4 card-shadow border border-gray-200 p-6 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <i data-lucide="book-open" class="w-5 h-5 text-black"></i>
          <h2 class="text-lg font-bold text-black">{{ currentData.name || t('detail.worldBook.pageTitle') }}</h2>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft disabled:opacity-50"
            :disabled="saving"
            @click="save"
            :title="t('detail.preset.saveToBackend')"
          >{{ saving ? t('common.saving') : t('common.save') }}</button>
          <div class="px-3 py-1 rounded-4 bg-gray-100 border border-gray-300 text-black text-sm">
            {{ t('detail.worldBook.editMode') }}
          </div>
        </div>
      </div>
      <p class="mt-2 text-xs text-black/60">{{ t('detail.worldBook.editHint') }}</p>
    </div>

    <!-- 基本信息（名称/描述） -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="id-card" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.worldBook.basicInfo') }}</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('common.name') }}</label>
          <input
            v-model="currentData.name"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">{{ t('common.description') }}</label>
          <textarea
            v-model="currentData.description"
            rows="2"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          ></textarea>
        </div>
      </div>
    </div>

    <!-- 工具栏：新增 -->
    <div class="bg-white rounded-4 border border-gray-200 p-4 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between gap-3">
        <div class="text-sm text-black/70">
          {{ t('detail.worldBook.toolbar.entryCount') }}：{{ (currentData.world_books || []).length }}
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="newId"
            :placeholder="t('detail.worldBook.toolbar.idPlaceholder')"
            class="w-32 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          <input
            v-model="newName"
            :placeholder="t('detail.worldBook.toolbar.namePlaceholder')"
            class="w-40 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          <button
            class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
            @click="addEntry"
          >
            {{ t('common.add') }}
          </button>
        </div>
      </div>
      <p v-if="addError" class="text-xs text-red-600 mt-2">* {{ addError }}</p>
    </div>

    <!-- 条目区域容器 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="settings-2" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.worldBook.editor.title') }}</h3>
      </div>

      <!-- 列表（可拖拽排序） -->
      <div class="space-y-2">
        <div
          v-for="w in (currentData.world_books || [])"
          :key="w.id"
          class="flex items-stretch gap-2 group draglist-item"
          :class="{
            'dragging-item': dragging && dragging === w.id,
            'drag-over-top': dragging && dragOverId === w.id && dragOverBefore,
            'drag-over-bottom': dragging && dragOverId === w.id && !dragOverBefore
          }"
          @dragover.prevent="onDragOver(w.id, $event)"
          @drop.prevent="onDrop(w.id, $event)"
        >
          <div
            class="w-6 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
            draggable="true"
            @dragstart="onDragStart(w.id, $event)"
            @dragend="onDragEnd"
            :title="t('detail.preset.prompts.dragToSort')"
          >
            <i data-lucide="grip-vertical" class="icon-grip w-4 h-4 text-black opacity-60 group-hover:opacity-100"></i>
          </div>
          <div class="flex-1">
            <WorldBookCard
              :entry="w"
              @update="onEntryUpdate"
              @delete="onEntryDelete"
            />
          </div>
        </div>

        <div
          class="h-3 draglist-end"
          :class="{ 'drag-over-end': dragging && dragOverId === null }"
          @dragover.prevent="onDragOver(null, $event)"
          @drop.prevent="onDropEnd($event)"
        />
      </div>

      <div v-if="(currentData.world_books || []).length === 0" class="text-center py-8 text-black/50 text-sm">
        {{ t('detail.worldBook.editor.empty') }}
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