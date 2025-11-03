<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { usePresetStore } from '@/features/presets/store'
import type { WorldBookEntry } from '@/features/presets/types'
import WorldBookCard from '@/features/worldbook/components/WorldBookCard.vue'
import { useFileManagerStore } from '@/features/files/fileManager'

const store = usePresetStore()
const fm = useFileManagerStore()

const fileTitle = ref<string>('')
const renameError = ref<string | null>(null)
watch(
  () => store.activeFile?.name,
  (v) => { fileTitle.value = v ?? '' },
  { immediate: true }
)
function renameWorldbookFile() {
  renameError.value = null
  const oldName = store.activeFile?.name || ''
  const nn = (fileTitle.value || '').trim()
  if (!nn) { renameError.value = '文件名不能为空'; return }
  if (nn === oldName) return
  const ok = (store as any).renameActive?.(nn)
  if (!ok) { renameError.value = '重命名失败：可能与现有文件重名'; return }
  try { fm.renameFile('worldbook', oldName, nn) } catch {}
}

/* 世界书面板：导入/导出复用顶部按钮；使用当前活动文件的 world_books */

onMounted(() => {
  if (!store.loaded) store.load()
  ;(window as any).lucide?.createIcons?.()
})

// 变更后刷新 lucide 图标
watch(
  () => store.activeData?.world_books?.length ?? 0,
  async () => {
    await nextTick()
    ;(window as any).lucide?.createIcons?.()
  },
  { flush: 'post' }
)

// 右上角：新增条目（id + 名称 + 添加）
const newId = ref<string>('') 
const newName = ref<string>('')

async function addEntry() {
  const id = newId.value.trim()
  const name = newName.value.trim()
  if (!id) { alert('请填写 id'); return }
  if (!name) { alert('请填写 名称'); return }
  const list = (store.activeData?.world_books || []) as WorldBookEntry[]
  if (list.some(e => e.id === id)) { alert('id 已存在'); return }
  const entry: WorldBookEntry = {
    id,
    name,
    enabled: true,
    content: '',
    mode: 'always',
    // position 可为 framing(before_char/after_char) 或 in-chat(user/assistant/system)
    position: 'before_char',
    order: 100,
    depth: 0,
    keys: [],
  }
  store.addWorldBook(entry)
  newId.value = ''
  newName.value = ''
  await nextTick()
  ;(window as any).lucide?.createIcons?.()
}

// 导入/导出逻辑复用右上角按钮（App.vue），此处不再提供独立导入/导出

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
  const list = [...((store.activeData?.world_books || []) as WorldBookEntry[])]
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
  store.reorderWorldBooks(ids)
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
          <i data-lucide="book-open" class="w-5 h-5 text-black"></i>
          <h2>世界书（独立面板）</h2>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="fileTitle"
            placeholder="文件名.json"
            class="w-56 px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            @keyup.enter="renameWorldbookFile"
            @blur="renameWorldbookFile"
          />
          <button
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
            @click="renameWorldbookFile"
          >重命名</button>
        </div>
      </div>
      <p class="mt-2 text-xs text-black/60">使用右上角 导入/导出 · 参考：backend_projects/SmartTavern/data/world_books/参考用main_world.json</p>
      <p v-if="renameError" class="text-xs text-red-600 mt-1">* {{ renameError }}</p>
    </div>

    <!-- 工具栏：仅新增（导入/导出请使用右上角按钮） -->
    <div class="bg-white rounded-4 border border-gray-200 p-4 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between gap-3">
        <div class="text-sm text-black/70">
          条目数量：{{ (store.activeData?.world_books || []).length }}
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
            @click="addEntry"
          >
            添加
          </button>
        </div>
      </div>
      <p class="text-xs text-black/50 mt-2">导入/导出请使用右上角按钮</p>
    </div>

    <!-- 条目区域容器（白色背景，小标题：世界书编辑） -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="settings-2" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">世界书编辑</h3>
      </div>

      <!-- 列表（可拖拽排序，左侧握把 + 黑线插入预览） -->
      <div class="space-y-2">
        <div
          v-for="w in (store.activeData?.world_books || [])"
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
            title="拖拽排序"
          >
            <i data-lucide="grip-vertical" class="icon-grip w-4 h-4 text-black opacity-60 group-hover:opacity-100"></i>
          </div>
          <div class="flex-1">
            <WorldBookCard :entry="w" />
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

/* 拖拽动效与黑线插入预览（与预设/正则页面一致） */
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