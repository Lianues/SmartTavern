<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import RegexRuleCard from './cards/RegexRuleCard.vue'
import Host from '@/workflow/core/host'
import * as Catalog from '@/workflow/channels/catalog'
import { useI18n } from '@/locales'
import { useRegexRulesStore } from '@/stores/regexRules'
import { useChatSettingsStore } from '@/stores/chatSettings'
import { useCustomDrag } from '@/composables/useCustomDrag'
import DataCatalog from '@/services/dataCatalog'

const { t } = useI18n()

const props = defineProps({
  regexData: { type: Object, default: null },
  file: { type: String, default: '' }
})

// 图标上传相关
const iconFile = ref(null)
const iconPreviewUrl = ref('')
const iconInputRef = ref(null)
const iconDeleted = ref(false)
const iconLoadedFromServer = ref(false)

const hasIcon = computed(() => !!iconPreviewUrl.value)

// 图标处理函数
function handleIconSelect(e) {
  const file = e.target.files?.[0]
  if (!file) return
  
  if (!file.type.startsWith('image/')) {
    return
  }
  
  iconFile.value = file
  
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
  iconDeleted.value = true
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
  iconDeleted.value = false
  iconLoadedFromServer.value = false
}

async function loadExistingIcon() {
  resetIconPreview()
  
  if (!props.file) return
  
  const iconPath = props.file.replace(/regex_rule\.json$/, 'icon.png')
  
  try {
    const { blob, mime } = await DataCatalog.getDataAssetBlob(iconPath)
    if (blob.size > 0 && mime.startsWith('image/')) {
      iconPreviewUrl.value = URL.createObjectURL(blob)
      iconLoadedFromServer.value = true
    }
  } catch (err) {
    console.debug('[RegexRuleDetailView] No existing icon or failed to load:', err)
    iconLoadedFromServer.value = false
  }
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}


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
  await loadExistingIcon()
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
    error.value = t('detail.regexRule.errors.idRequired')
    return
  }
  if (!name) {
    error.value = t('detail.regexRule.errors.nameRequired')
    return
  }
  const rules = currentData.value.regex_rules || []
  if (rules.some(r => r.id === id)) {
    error.value = t('detail.regexRule.errors.idExists')
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

// 正则规则拖拽 - 使用 composable
const {
  dragging,
  dragOverId,
  dragOverBefore,
  startDrag,
} = useCustomDrag({
  scrollContainerSelector: '.modal-scroll .scroll-container2',
  itemSelector: '.draglist-item',
  dataAttribute: 'data-rule-id',
  onReorder: (draggedId, targetId, insertBefore) => {
    const list = [...(currentData.value.regex_rules || [])]
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
      
      currentData.value.regex_rules = ids.map(id => list.find(r => String(r.id) === id)).filter(Boolean)
      window.lucide?.createIcons?.()
    }
  },
  getTitleForItem: (id) => {
    const rule = currentData.value.regex_rules?.find(r => String(r.id) === String(id))
    return rule?.name || id
  }
})

// 初始化 Lucide 图标
onMounted(async () => {
  window.lucide?.createIcons?.()
  await loadExistingIcon()
})

watch(() => currentData.value.regex_rules, async () => {
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
  const content = {
    name: currentData.value.name || '',
    description: currentData.value.description || '',
    regex_rules: Array.isArray(currentData.value.regex_rules) ? currentData.value.regex_rules : []
  }
  
  // 处理图标
  let iconBase64 = undefined
  if (iconFile.value) {
    try {
      iconBase64 = await fileToBase64(iconFile.value)
    } catch (err) {
      console.error('[RegexRuleDetailView] Icon conversion failed:', err)
    }
  } else if (iconDeleted.value && iconLoadedFromServer.value) {
    iconBase64 = ''
  }
  
  saving.value = true
  savedOk.value = false
  if (__saveTimer) { try { clearTimeout(__saveTimer) } catch {} __saveTimer = null }
  const tag = `regex_save_${Date.now()}`
  
  // 监听保存结果（一次性）
  const offOk = Host.events.on(Catalog.EVT_CATALOG_REGEX_UPDATE_OK, async ({ file: resFile, tag: resTag }) => {
    if (resFile !== file || resTag !== tag) return
    console.log('[RegexRuleDetailView] 保存成功（事件）')
    savedOk.value = true
    saving.value = false
    if (savedOk.value) {
      __saveTimer = setTimeout(() => { savedOk.value = false }, 1800)
    }
    
    // 保存成功后，刷新侧边栏列表
    try {
      console.log('[RegexRuleDetailView] 刷新正则规则列表')
      Host.events.emit(Catalog.EVT_CATALOG_REGEX_REQ, {
        requestId: Date.now()
      })
    } catch (err) {
      console.warn('[RegexRuleDetailView] 刷新正则规则列表失败:', err)
    }
    
    // 保存成功后，检查是否是当前使用的正则规则之一，如果是则刷新 store
    try {
      const chatSettingsStore = useChatSettingsStore()
      const regexRulesStore = useRegexRulesStore()
      const currentRegexRulesFiles = chatSettingsStore.regexRulesFiles || []
      if (currentRegexRulesFiles.includes(file)) {
        console.log('[RegexRuleDetailView] 刷新正则规则 store')
        await regexRulesStore.refreshFromRegexRuleFiles(currentRegexRulesFiles)
      }
    } catch (err) {
      console.warn('[RegexRuleDetailView] 刷新正则规则 store 失败:', err)
    }
    
    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  
  const offFail = Host.events.on(Catalog.EVT_CATALOG_REGEX_UPDATE_FAIL, ({ file: resFile, message, tag: resTag }) => {
    if (resFile && resFile !== file) return
    if (resTag && resTag !== tag) return
    console.error('[RegexRuleDetailView] 保存失败（事件）:', message)
    try { alert(t('detail.regexRule.saveFailed') + '：' + message) } catch (_) {}
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
          <i data-lucide="code" class="w-5 h-5 text-black"></i>
          <h2 class="text-lg font-bold text-black">{{ t('detail.regexRule.pageTitle') }}</h2>
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
            {{ t('detail.regexRule.editMode') }}
          </div>
        </div>
      </div>
      <p class="mt-2 text-xs text-black/60">{{ t('detail.regexRule.editHint') }}</p>
    </div>

    <!-- 基本信息（名称/描述/图标） -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="id-card" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.regexRule.basicInfo') }}</h3>
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
          {{ t('detail.regexRule.toolbar.ruleCount') }}：{{ (currentData.regex_rules || []).length }}
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="newId"
            :placeholder="t('detail.regexRule.toolbar.idPlaceholder')"
            class="w-32 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          <input
            v-model="newName"
            :placeholder="t('detail.regexRule.toolbar.namePlaceholder')"
            class="w-40 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          <button
            class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
            @click="addRule"
          >
            {{ t('common.add') }}
          </button>
        </div>
      </div>
      <p v-if="error" class="text-xs text-red-600 mt-2">* {{ error }}</p>
    </div>

    <!-- 正则规则列表 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="sliders" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.regexRule.list.title') }}</h3>
      </div>

      <!-- 列表（可拖拽排序） -->
      <div class="space-y-2">
        <div
          v-for="r in (currentData.regex_rules || [])"
          :key="r.id"
          class="flex items-stretch gap-2 group draglist-item"
          :class="{
            'dragging-item': dragging && String(dragging.id) === String(r.id),
            'drag-over-top': dragOverId && String(dragOverId) === String(r.id) && dragOverBefore,
            'drag-over-bottom': dragOverId && String(dragOverId) === String(r.id) && !dragOverBefore
          }"
          :data-rule-id="r.id"
        >
          <div
            class="w-6 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
            @mousedown="startDrag(r.id, $event)"
            :title="t('detail.preset.prompts.dragToSort')"
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

      </div>

      <div v-if="(currentData.regex_rules || []).length === 0" class="text-center py-8 text-black/50 text-sm">
        {{ t('detail.regexRule.list.empty') }}
      </div>
    </div>

    <!-- 说明 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="info" class="w-4 h-4 text-black"></i>
        <h3 class="text-sm font-semibold text-black">{{ t('detail.regexRule.notes.title') }}</h3>
      </div>
      <div class="text-xs text-black/60 leading-relaxed space-y-2">
        <p>• {{ t('detail.regexRule.notes.line1') }}</p>
        <p>• {{ t('detail.regexRule.notes.line2') }}</p>
        <p>• {{ t('detail.regexRule.notes.line3') }}</p>
        <p>• {{ t('detail.regexRule.notes.line4') }}</p>
        <p>• {{ t('detail.regexRule.notes.line5') }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
@import './shared-detail-styles.css';
</style>