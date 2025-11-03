<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import RegexRuleCard from './cards/RegexRuleCard.vue'
import Host from '@/workflow/core/host'
import * as Catalog from '@/workflow/channels/catalog'

const props = defineProps({
  regexData: { type: Object, default: null },
  file: { type: String, default: '' }
})


// 当前编辑的数据（内存中）
/** 深拷贝 */
function deepClone(x) { return JSON.parse(JSON.stringify(x)) }
/** 规范化 正则规则集 结构 */
function normalizeRegexData(src) {
  if (!src || typeof src !== 'object') return null
  const name = src.name || '正则规则集'
  let rules = []
  if (Array.isArray(src.regex_rules)) rules = src.regex_rules
  else if (Array.isArray(src)) rules = src
  else if (src.find_regex || src.replace_regex || src.id) rules = [src]
  return { name, regex_rules: rules }
}
const currentData = ref(
  deepClone(
    normalizeRegexData(props.regexData) || { name: '', description: '', regex_rules: [] }
  )
)
// 外部数据变更时同步
watch(() => props.regexData, async (v) => {
  currentData.value = deepClone(
    normalizeRegexData(v) || { name: '', description: '', regex_rules: [] }
  )
  await nextTick()
  window.lucide?.createIcons?.()
})

// 新增规则
const newId = ref('')
const newName = ref('')
const error = ref(null)

async function addRule() {
  error.value = null
  const id = newId.value.trim()
  const name = newName.value.trim()
  if (!id) {
    error.value = '请填写 id'
    return
  }
  if (!name) {
    error.value = '请填写 名称'
    return
  }
  const rules = currentData.value.regex_rules || []
  if (rules.some(r => r.id === id)) {
    error.value = 'id 已存在'
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
    mode: 'always',
    condition: '',
    views: [],
  }
  if (!currentData.value.regex_rules) currentData.value.regex_rules = []
  currentData.value.regex_rules.push(rule)
  newId.value = ''
  newName.value = ''
  await nextTick()
  window.lucide?.createIcons?.()
}

// 规则更新和删除
function onRegexUpdate(updated) {
  const idx = currentData.value.regex_rules.findIndex(r => r.id === updated.id)
  if (idx >= 0) {
    currentData.value.regex_rules[idx] = updated
  }
}

function onRegexDelete(id) {
  currentData.value.regex_rules = currentData.value.regex_rules.filter(r => r.id !== id)
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
  const list = [...(currentData.value.regex_rules || [])]
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
  currentData.value.regex_rules = ids.map(id => list.find(r => r.id === id)).filter(Boolean)
  dragging.value = null
  dragOverId.value = null
  window.lucide?.createIcons?.()
}

function onDropEnd(ev) {
  onDrop(null, ev)
}

function onDragEnd() {
  stopAutoScroll()
  dragging.value = null
  dragOverId.value = null
}

// 初始化 Lucide 图标
onMounted(() => {
  window.lucide?.createIcons?.()
})

watch(() => currentData.value.regex_rules, async () => {
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
    try { alert('缺少文件路径，无法保存'); } catch (_) {}
    return
  }
  const content = {
    name: currentData.value.name || '',
    description: currentData.value.description || '',
    regex_rules: Array.isArray(currentData.value.regex_rules) ? currentData.value.regex_rules : []
  }
  
  saving.value = true
  const tag = `regex_save_${Date.now()}`
  
  // 监听保存结果（一次性）
  const offOk = Host.events.on(Catalog.EVT_CATALOG_REGEX_UPDATE_OK, ({ file: resFile, tag: resTag }) => {
    if (resFile !== file || resTag !== tag) return
    console.log('[RegexRuleDetailView] 保存成功（事件）')
    saving.value = false
    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  
  const offFail = Host.events.on(Catalog.EVT_CATALOG_REGEX_UPDATE_FAIL, ({ file: resFile, message, tag: resTag }) => {
    if (resFile && resFile !== file) return
    if (resTag && resTag !== tag) return
    console.error('[RegexRuleDetailView] 保存失败（事件）:', message)
    try { alert('保存失败：' + message) } catch (_) {}
    saving.value = false
    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  
  __eventOffs.push(offOk, offFail)
  
  // 发送保存请求事件
  Host.events.emit(Catalog.EVT_CATALOG_REGEX_UPDATE_REQ, {
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
          <i data-lucide="code" class="w-5 h-5 text-black"></i>
          <h2 class="text-lg font-bold text-black">正则规则编辑</h2>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft disabled:opacity-50"
            :disabled="saving"
            @click="save"
            title="保存到后端"
          >{{ saving ? '保存中...' : '保存' }}</button>
          <div class="px-3 py-1 rounded-4 bg-gray-100 border border-gray-300 text-black text-sm">
            编辑模式
          </div>
        </div>
      </div>
      <p class="mt-2 text-xs text-black/60">此页面用于编辑独立的正则规则集，支持新增、编辑、删除和拖拽排序</p>
    </div>

    <!-- 基本信息（名称/描述） -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="id-card" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">基本信息</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-black mb-2">名称</label>
          <input
            v-model="currentData.name"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">描述</label>
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
          规则数量：{{ (currentData.regex_rules || []).length }}
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="newId"
            placeholder="id"
            class="w-32 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          <input
            v-model="newName"
            placeholder="名称"
            class="w-40 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          <button
            class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
            @click="addRule"
          >
            添加
          </button>
        </div>
      </div>
      <p v-if="error" class="text-xs text-red-600 mt-2">* {{ error }}</p>
    </div>

    <!-- 正则规则列表 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="sliders" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">正则规则列表</h3>
      </div>

      <!-- 列表（可拖拽排序） -->
      <div class="space-y-2">
        <div
          v-for="r in (currentData.regex_rules || [])"
          :key="r.id"
          class="flex items-stretch gap-2 group draglist-item"
          :class="{
            'dragging-item': dragging && dragging === r.id,
            'drag-over-top': dragging && dragOverId === r.id && dragOverBefore,
            'drag-over-bottom': dragging && dragOverId === r.id && !dragOverBefore
          }"
          @dragover.prevent="onDragOver(r.id, $event)"
          @drop.prevent="onDrop(r.id, $event)"
        >
          <div
            class="w-6 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
            draggable="true"
            @dragstart="onDragStart(r.id, $event)"
            @dragend="onDragEnd"
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
          :class="{ 'drag-over-end': dragging && dragOverId === null }"
          @dragover.prevent="onDragOver(null, $event)"
          @drop.prevent="onDropEnd($event)"
        />
      </div>

      <div v-if="(currentData.regex_rules || []).length === 0" class="text-center py-8 text-black/50 text-sm">
        暂无正则规则，请在右上角输入后点击添加
      </div>
    </div>

    <!-- 说明 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="info" class="w-4 h-4 text-black"></i>
        <h3 class="text-sm font-semibold text-black">使用说明</h3>
      </div>
      <div class="text-xs text-black/60 leading-relaxed space-y-2">
        <p>• 正则规则用于文本后处理，支持查找和替换操作</p>
        <p>• 每个规则可以设置目标（targets）和视图（views）</p>
        <p>• 支持深度过滤（min_depth / max_depth）</p>
        <p>• 点击"编辑"按钮展开完整的编辑表单</p>
        <p>• 使用左侧握把图标拖拽可以调整规则执行顺序</p>
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

/* 深色主题适配 */
[data-theme="dark"] .bg-white {
  background-color: rgb(23, 27, 36) !important;
}

[data-theme="dark"] .bg-gray-100 {
  background-color: rgb(33, 39, 52) !important;
}

[data-theme="dark"] .text-black {
  color: rgb(232, 236, 244) !important;
}

[data-theme="dark"] .text-black\/50 {
  color: rgba(232, 236, 244, 0.5) !important;
}

[data-theme="dark"] .text-black\/60 {
  color: rgba(232, 236, 244, 0.6) !important;
}

[data-theme="dark"] .text-black\/70 {
  color: rgba(232, 236, 244, 0.7) !important;
}

[data-theme="dark"] .border-gray-200 {
  border-color: rgb(45, 54, 70) !important;
}

[data-theme="dark"] .border-gray-300 {
  border-color: rgb(55, 64, 80) !important;
}

[data-theme="dark"] .border-gray-800 {
  border-color: rgb(200, 205, 215) !important;
}

[data-theme="dark"] .border-gray-900 {
  border-color: rgb(200, 205, 215) !important;
}

[data-theme="dark"] .hover\:bg-gray-100:hover {
  background-color: rgb(33, 39, 52) !important;
}

[data-theme="dark"] .text-red-600 {
  color: rgb(248, 113, 113) !important;
}
</style>