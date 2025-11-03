<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { usePresetStore } from '@/features/presets/store'
import RegexRuleCard from '@/features/regex/components/RegexRuleCard.vue'
import type { PresetData, PresetFile, PresetSetting, RegexRule } from '@/features/presets/types'
import { useFileManagerStore } from '@/features/files/fileManager'

const store = usePresetStore()
const fm = useFileManagerStore()


// 默认 Setting（用于占位，便于 Store 通过统一的 PresetData 管理）
const DEFAULT_SETTING: PresetSetting = {
  temperature: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  top_p: 1,
  top_k: 0,
  max_context: 4095,
  max_tokens: 300,
  stream: true,
}

function ensureRegexPanelActive() {
  if (!store.loaded) store.load()
  // 若已有激活文件，直接使用
  if (store.activeFile && store.activeData) return
  // 否则尝试选择一个包含 regex_rules 的文件
  const anyWithRegex = store.files.find(f => Array.isArray((f as any)?.data?.regex_rules))
  if (anyWithRegex) {
    store.setActive(anyWithRegex.name)
    return
  }
  // 否则创建一个新的承载文件
  const data: PresetData = { setting: DEFAULT_SETTING, regex_rules: [], prompts: [] }
  const entry: PresetFile = { name: 'RegexRules', enabled: true, data }
  store.upsertFile(entry)
}

onMounted(() => {
  ensureRegexPanelActive()
  ;(window as any).lucide?.createIcons?.()
})

watch(
  () => store.activeData?.regex_rules?.length ?? 0,
  async () => {
    await nextTick()
    ;(window as any).lucide?.createIcons?.()
  },
  { flush: 'post' }
)

const fileTitle = ref<string>('')
const renameError = ref<string | null>(null)
watch(
  () => store.activeFile?.name,
  (v) => { fileTitle.value = v ?? '' },
  { immediate: true }
)
function renameRegexFile() {
  renameError.value = null
  const oldName = store.activeFile?.name || ''
  const nn = (fileTitle.value || '').trim()
  if (!nn) { renameError.value = '文件名不能为空'; return }
  if (nn === oldName) return
  const ok = (store as any).renameActive?.(nn)
  if (!ok) { renameError.value = '重命名失败：可能与现有文件重名'; return }
  try { fm.renameFile('regex', oldName, nn) } catch {}
}

// 右上角：新增规则
const newId = ref<string>('')
const newName = ref<string>('')
const error = ref<string | null>(null)

async function addRule() {
  error.value = null
  const id = newId.value.trim()
  const name = newName.value.trim()
  if (!id) { error.value = '请填写 id'; return }
  if (!name) { error.value = '请填写 名称'; return }
  const rules = store.activeData?.regex_rules ?? []
  if (rules.some(r => r.id === id)) { error.value = 'id 已存在'; return }
  const rule: RegexRule = {
    id, name, enabled: true, find_regex: '', replace_regex: '', targets: [], placement: 'after_macro', views: [],
  }
  store.addRegexRule(rule)
  newId.value = ''
  newName.value = ''
  await nextTick()
  ;(window as any).lucide?.createIcons?.()
}

// 导入/导出（数组 JSON，参考 backend_projects/SmartTavern/data/regex_rules/remove_xml_tags.json）
const fileInput = ref<HTMLInputElement | null>(null)

function triggerImport() {
  fileInput.value?.click()
}

async function onImportChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files && input.files[0]
  if (!file) return
  try {
    const text = await file.text()
    const json = JSON.parse(text)
    if (!Array.isArray(json)) {
      error.value = '文件内容应为数组（参考 backend_projects/SmartTavern/data/regex_rules/remove_xml_tags.json）'
      input.value = ''
      return
    }
    store.setRegexRules(json as RegexRule[])
    error.value = null
  } catch {
    error.value = '导入失败：JSON 解析错误'
  } finally {
    input.value = ''
  }
}

function exportRules() {
  const res = store.exportRegexRules()
  if (!res) return
  const blob = new Blob([res.json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = res.filename
  a.click()
  URL.revokeObjectURL(url)
}

/* 拖拽排序（黑线插入预览） */
const dragging = ref<string | null>(null)
const dragOverId = ref<string | null>(null)
const dragOverBefore = ref<boolean>(true)

function onDragStart(id: string, ev: DragEvent) {
  dragging.value = id
  try {
    ev.dataTransfer?.setData('text/plain', id)
    ev.dataTransfer!.effectAllowed = 'move'
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1
    ev.dataTransfer?.setDragImage(canvas, 0, 0)
  } catch {}
}

function onDragOver(overId: string | null, ev: DragEvent) {
  if (!dragging.value) return
  ev.preventDefault()
  try {
    const el = ev.currentTarget as HTMLElement | null
    if (el) {
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      dragOverBefore.value = ev.clientY < mid
    }
  } catch {}
  dragOverId.value = overId
}

function onDrop(overId: string | null, ev: DragEvent) {
  if (!dragging.value) return
  ev.preventDefault()
  const dId = dragging.value
  const list = [...(store.activeData?.regex_rules || [])]
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
  store.reorderRegexRules(ids)
  dragging.value = null
  dragOverId.value = null
  ;(window as any).lucide?.createIcons?.()
}

function onDropEnd(ev: DragEvent) { onDrop(null, ev) }
function onDragEnd() { dragging.value = null; dragOverId.value = null }

</script>

<template>
  <section class="space-y-6">
    <!-- 标题 -->
    <div class="bg-white rounded-4 card-shadow border border-gray-200 p-6 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <i data-lucide="code" class="w-5 h-5 text-black"></i>
          <h2>正则规则（独立面板）</h2>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="fileTitle"
            placeholder="文件名.json"
            class="w-56 px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            @keyup.enter="renameRegexFile"
            @blur="renameRegexFile"
          />
          <button
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
            @click="renameRegexFile"
          >重命名</button>
        </div>
      </div>
      <p class="mt-2 text-xs text-black/60">导入/导出参考：backend_projects/SmartTavern/data/regex_rules/remove_xml_tags.json</p>
      <p v-if="renameError" class="text-xs text-red-600 mt-1">* {{ renameError }}</p>
    </div>

    <!-- 工具栏：导入/导出 + 新增 -->
    <div class="bg-white rounded-4 border border-gray-200 p-4 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between gap-3">
        <div class="text-sm text-black/70">
          规则数量：{{ (store.activeData?.regex_rules || []).length }}
        </div>
        <div class="flex items-center gap-2">
          <input ref="fileInput" type="file" accept="application/json" class="hidden" @change="onImportChange" />
          <button
            class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
            @click="triggerImport"
          >
            导入
          </button>
          <button
            class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
            @click="exportRules"
          >
            导出
          </button>
          <div class="w-px h-5 bg-gray-300 mx-1"></div>
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

    <!-- 条目区域容器（白色背景，小标题：正则编辑） -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="sliders" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">正则编辑</h3>
      </div>

      <!-- 列表（可拖拽排序，左侧握把 + 黑线插入预览） -->
      <div class="space-y-2">
        <div
          v-for="r in (store.activeData?.regex_rules || [])"
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
            <RegexRuleCard :rule="r" />
          </div>
        </div>

        <div
          class="h-3 draglist-end"
          :class="{ 'drag-over-end': dragging && dragOverId === null }"
          @dragover.prevent="onDragOver(null, $event)"
          @drop.prevent="onDropEnd($event)"
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

/* 拖拽动效与黑线插入预览（与预设页面一致） */
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