<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import WorldBookCard from './cards/WorldBookCard.vue'
import Host from '@/workflow/core/host'
import * as Catalog from '@/workflow/channels/catalog'
import { useI18n } from '@/locales'
import { useWorldBooksStore } from '@/stores/worldBooks'
import { useChatSettingsStore } from '@/stores/chatSettings'
import { useCustomDrag } from '@/composables/useCustomDrag'
import DataCatalog from '@/services/dataCatalog'

const { t } = useI18n()

const props = defineProps({
  worldbookData: { type: Object, default: null },
  file: { type: String, default: '' }
})

// 图标上传相关
const iconFile = ref(null)
const iconPreviewUrl = ref('')
const iconInputRef = ref(null)
// 追踪图标是否被用户主动删除（区分"没有图标"和"删除图标"）
const iconDeleted = ref(false)
// 追踪是否已经从后端加载了图标（用于判断是"保持不变"还是"删除"）
const iconLoadedFromServer = ref(false)

// 图标预览URL计算属性
const hasIcon = computed(() => !!iconPreviewUrl.value)

// 图标处理函数
function handleIconSelect(e) {
  const file = e.target.files?.[0]
  if (!file) return
  
  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    return
  }
  
  iconFile.value = file
  
  // 创建预览URL
  if (iconPreviewUrl.value) {
    URL.revokeObjectURL(iconPreviewUrl.value)
  }
  iconPreviewUrl.value = URL.createObjectURL(file)
  iconDeleted.value = false
}

function triggerIconSelect() {
  iconInputRef.value?.click()
}

async function removeIcon() {
  iconFile.value = null
  if (iconPreviewUrl.value) {
    URL.revokeObjectURL(iconPreviewUrl.value)
  }
  iconPreviewUrl.value = ''
  if (iconInputRef.value) {
    iconInputRef.value.value = ''
  }
  // 标记用户主动删除了图标
  iconDeleted.value = true
  // 重新初始化 lucide 图标
  await nextTick()
  window.lucide?.createIcons?.()
}

function resetIconPreview() {
  iconFile.value = null
  if (iconPreviewUrl.value) {
    URL.revokeObjectURL(iconPreviewUrl.value)
  }
  iconPreviewUrl.value = ''
  if (iconInputRef.value) {
    iconInputRef.value.value = ''
  }
  // 重置删除标记和加载标记
  iconDeleted.value = false
  iconLoadedFromServer.value = false
}

// 将文件转换为Base64
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      // 移除 data URL 前缀
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 根据文件路径加载已有图标
async function loadExistingIcon() {
  // 重置当前图标
  resetIconPreview()
  
  if (!props.file) return
  
  // 构建图标路径：将文件路径的 worldbook.json 替换为 icon.png
  const iconPath = props.file.replace(/worldbook\.json$/, 'icon.png')
  
  try {
    // 使用 DataCatalog.getDataAssetBlob 获取图标
    const { blob, mime } = await DataCatalog.getDataAssetBlob(iconPath)
    if (blob.size > 0 && mime.startsWith('image/')) {
      iconPreviewUrl.value = URL.createObjectURL(blob)
      // 标记图标是从服务器加载的
      iconLoadedFromServer.value = true
    }
  } catch (err) {
    // 图标不存在或加载失败，忽略错误
    console.debug('[WorldBookDetailView] No existing icon or failed to load:', err)
    iconLoadedFromServer.value = false
  }
}


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
  // 加载已有图标
  await loadExistingIcon()
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

// 世界书拖拽 - 使用 composable
const {
  dragging,
  dragOverId,
  dragOverBefore,
  startDrag,
} = useCustomDrag({
  scrollContainerSelector: '.modal-scroll .scroll-container2',
  itemSelector: '.draglist-item',
  dataAttribute: 'data-wb-id',
  onReorder: (draggedId, targetId, insertBefore) => {
    const list = [...(currentData.value.world_books || [])]
    let ids = list.map(i => String(i.id))
    const draggedIdStr = String(draggedId)
    const targetIdStr = targetId ? String(targetId) : null
    const fromIdx = ids.indexOf(draggedIdStr)
    
    if (fromIdx >= 0 && draggedIdStr !== targetIdStr) {
      ids.splice(fromIdx, 1)
      if (targetIdStr) {
        const toIdx = ids.indexOf(targetIdStr)
        let insertIdx = toIdx < 0 ? ids.length : toIdx + (insertBefore ? 0 : 1)
        if (insertIdx < 0) insertIdx = 0
        if (insertIdx > ids.length) insertIdx = ids.length
        ids.splice(insertIdx, 0, draggedIdStr)
      } else {
        ids.push(draggedIdStr)
      }
      
      currentData.value.world_books = ids.map(id => list.find(w => String(w.id) === id)).filter(Boolean)
      window.lucide?.createIcons?.()
    }
  },
  getTitleForItem: (id) => {
    const entry = currentData.value.world_books?.find(w => String(w.id) === String(id))
    return entry?.name || id
  }
})

// 初始化 Lucide 图标
onMounted(async () => {
  window.lucide?.createIcons?.()
  // 加载已有图标
  await loadExistingIcon()
})

watch(() => currentData.value.world_books, async () => {
  await nextTick()
  window.lucide?.createIcons?.()
}, { flush: 'post' })

const __eventOffs = [] // 事件监听清理器
const saving = ref(false)
const savedOk = ref(false)
let __saveTimer = null

onBeforeUnmount(() => {
  try {
    __eventOffs?.forEach(fn => { try { fn?.() } catch (_) {} })
    __eventOffs.length = 0
    if (__saveTimer) clearTimeout(__saveTimer)
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
  
  // 处理图标：
  // - 用户选择了新图标 -> 转换为 base64
  // - 用户删除了图标 -> 传空字符串 ''（告诉后端删除）
  // - 没有修改图标 -> 不传（undefined）
  let iconBase64 = undefined
  if (iconFile.value) {
    // 用户选择了新图标
    try {
      iconBase64 = await fileToBase64(iconFile.value)
    } catch (err) {
      console.error('[WorldBookDetailView] Icon conversion failed:', err)
    }
  } else if (iconDeleted.value && iconLoadedFromServer.value) {
    // 用户删除了原有图标（图标曾经从服务器加载，现在被删除）
    iconBase64 = ''
  }
  // 否则 iconBase64 保持 undefined，表示不修改图标
  
  saving.value = true
  const tag = `worldbook_save_${Date.now()}`
  
  if (__saveTimer) { try { clearTimeout(__saveTimer) } catch {} __saveTimer = null }
  
  // 监听保存结果（一次性）
  const offOk = Host.events.on(Catalog.EVT_CATALOG_WORLDBOOK_UPDATE_OK, async ({ file: resFile, tag: resTag }) => {
    if (resFile !== file || resTag !== tag) return
    console.log('[WorldBookDetailView] 保存成功（事件）')
    savedOk.value = true
    saving.value = false
    if (savedOk.value) {
      __saveTimer = setTimeout(() => { savedOk.value = false }, 1800)
    }
    
    // 保存成功后，刷新侧边栏列表
    try {
      console.log('[WorldBookDetailView] 刷新世界书列表')
      Host.events.emit(Catalog.EVT_CATALOG_WORLDBOOKS_REQ, {
        requestId: Date.now()
      })
    } catch (err) {
      console.warn('[WorldBookDetailView] 刷新世界书列表失败:', err)
    }
    
    // 保存成功后，检查是否是当前使用的世界书之一，如果是则刷新 store
    try {
      const chatSettingsStore = useChatSettingsStore()
      const worldBooksStore = useWorldBooksStore()
      const currentWorldBookFiles = chatSettingsStore.worldBooksFiles || []
      if (currentWorldBookFiles.includes(file)) {
        console.log('[WorldBookDetailView] 刷新世界书 store')
        await worldBooksStore.refreshFromWorldBookFiles(currentWorldBookFiles)
      }
    } catch (err) {
      console.warn('[WorldBookDetailView] 刷新世界书 store 失败:', err)
    }
    
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
    iconBase64,
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
          <!-- 保存状态：左侧提示区 -->
          <div class="save-indicator min-w-[72px] h-7 flex items-center justify-center">
            <span v-if="saving" class="save-spinner" :aria-label="t('detail.preset.saving')"></span>
            <span v-else-if="savedOk" class="save-done"><strong>{{ t('detail.preset.saved') }}</strong></span>
          </div>
          <button
            type="button"
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft disabled:opacity-50"
            :disabled="saving"
            @click="save"
            :title="t('detail.preset.saveToBackend')"
          >{{ t('common.save') }}</button>
          <div class="px-3 py-1 rounded-4 bg-gray-100 border border-gray-300 text-black text-sm">
            {{ t('detail.worldBook.editMode') }}
          </div>
        </div>
      </div>
      <p class="mt-2 text-xs text-black/60">{{ t('detail.worldBook.editHint') }}</p>
    </div>

    <!-- 基本信息（名称/描述/图标） -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="id-card" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.worldBook.basicInfo') }}</h3>
      </div>
      <div class="flex gap-6">
        <!-- 左侧：图标上传区域 -->
        <div class="flex-shrink-0">
          <label class="block text-sm font-medium text-black mb-2">{{ t('createItem.iconLabel') }}</label>
          <div
            class="icon-upload-area"
            :class="{ 'has-icon': hasIcon }"
            @click="triggerIconSelect"
          >
            <input
              ref="iconInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleIconSelect"
            />
            <template v-if="hasIcon">
              <img :src="iconPreviewUrl" alt="Icon Preview" class="icon-preview" />
              <button
                type="button"
                class="icon-remove-btn"
                @click.stop="removeIcon"
                :title="t('createItem.removeIcon')"
              >
                ✕
              </button>
            </template>
            <template v-else>
              <div class="icon-placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
                <span class="text-xs">{{ t('createItem.uploadIcon') }}</span>
              </div>
            </template>
          </div>
          <div class="text-xs text-black/50 mt-1 text-center max-w-[120px]">{{ t('createItem.iconHint') }}</div>
        </div>
        
        <!-- 右侧：名称和描述 -->
        <div class="flex-1 grid grid-cols-1 gap-4">
          <div>
            <label class="block text-sm font-medium text-black mb-2">{{ t('common.name') }}</label>
            <input
              v-model="currentData.name"
              class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-black mb-2">{{ t('common.description') }}</label>
            <textarea
              v-model="currentData.description"
              rows="2"
              class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            ></textarea>
          </div>
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
            'dragging-item': dragging && String(dragging.id) === String(w.id),
            'drag-over-top': dragOverId && String(dragOverId) === String(w.id) && dragOverBefore,
            'drag-over-bottom': dragOverId && String(dragOverId) === String(w.id) && !dragOverBefore
          }"
          :data-wb-id="w.id"
        >
          <div
            class="w-6 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
            @mousedown="startDrag(w.id, $event)"
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

      </div>

      <div v-if="(currentData.world_books || []).length === 0" class="text-center py-8 text-black/50 text-sm">
        {{ t('detail.worldBook.editor.empty') }}
      </div>
    </div>
  </section>
</template>

<style scoped>
@import './shared-detail-styles.css';
</style>