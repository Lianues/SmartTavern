<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import PresetPromptCard from './cards/PresetPromptCard.vue'
import RegexRuleCard from './cards/RegexRuleCard.vue'
import Host from '@/workflow/core/host'
import * as Catalog from '@/workflow/channels/catalog'
import { useI18n } from '@/locales'
import { usePresetStore } from '@/stores/preset'
import { useChatSettingsStore } from '@/stores/chatSettings'
import { useCustomDrag } from '@/composables/useCustomDrag'
import DataCatalog from '@/services/dataCatalog'

const { t } = useI18n()

const props = defineProps({
  presetData: { type: Object, default: null },
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

// 特殊 Relative 模板（一次性组件）
const SPECIAL_RELATIVE_TEMPLATES = [
  {
    identifier: 'charBefore',
    name: 'char Before',
    enabled: null,
    role: 'system',
    position: 'relative',
  },
  {
    identifier: 'personaDescription',
    name: 'Persona Description',
    enabled: false,
    role: 'system',
    position: 'relative',
  },
  {
    identifier: 'charDescription',
    name: 'Char Description',
    enabled: true,
    role: 'system',
    position: 'relative',
  },
  {
    identifier: 'charAfter',
    name: 'char After',
    enabled: true,
    role: 'system',
    position: 'relative',
  },
  {
    identifier: 'chatHistory',
    name: 'Chat History',
    enabled: true,
    role: 'system',
    position: 'relative',
  },
]

 // 默认 API 配置（无演示数据，仅占位，保障表单正常渲染）
 const DEFAULT_API_CONFIG = {
   enabled: true,
   temperature: 1.0,
   top_p: 1.0,
   top_k: 0,
   max_context: 4095,
   max_tokens: 300,
   stream: true,
   frequency_penalty: 0,
   presence_penalty: 0
 }

/** 深拷贝 */
function deepClone(x) { return JSON.parse(JSON.stringify(x)) }
/** 规范化后端/外部传入的预设结构到本组件内部期望结构 */
function normalizePresetData(src) {
  if (!src || typeof src !== 'object') return null
  const name = src.name || '预设'
  const description = src.description || ''
  const api_config = typeof src.api_config === 'object' ? src.api_config : {
    enabled: true, temperature: 1.0, top_p: 1.0, top_k: 0, max_context: 4095,
    max_tokens: 300, stream: true, frequency_penalty: 0, presence_penalty: 0
  }
  const prompts = Array.isArray(src.prompts)
    ? src.prompts
    : Array.isArray(src.templates)
      ? src.templates
      : []
  const regex_rules = Array.isArray(src.regex_rules)
    ? src.regex_rules
    : (src.find_regex || src.replace_regex || src.id) ? [src] : []
  return { name, description, api_config, prompts, regex_rules }
}
// 当前编辑的数据（内存中）
const currentData = ref(
  deepClone(
    normalizePresetData(props.presetData) || {
      name: '',
      description: '',
      api_config: DEFAULT_API_CONFIG,
      prompts: [],
      regex_rules: []
    }
  )
)

// 图标预览URL计算属性
const hasIcon = computed(() => !!iconPreviewUrl.value)
// 外部数据变更时同步
watch(() => props.presetData, async (v) => {
  currentData.value = deepClone(
    normalizePresetData(v) || {
      name: '',
      description: '',
      api_config: DEFAULT_API_CONFIG,
      prompts: [],
      regex_rules: []
    }
  )
  // 同步 per-field 开关
  syncApiTogglesFromData()
  // 加载已有图标
  await loadExistingIcon()
  await nextTick()
  window.lucide?.createIcons?.()
})

// 根据文件路径加载已有图标
async function loadExistingIcon() {
  // 重置当前图标
  resetIconPreview()
  
  if (!props.file) return
  
  // 构建图标路径：将文件路径的 preset.json 替换为 icon.png
  const iconPath = props.file.replace(/preset\.json$/, 'icon.png')
  
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
    console.debug('[PresetDetailView] No existing icon or failed to load:', err)
    iconLoadedFromServer.value = false
  }
}

// API 配置
const apiOpen = ref(true)
const promptsOpen = ref(true)
const regexOpen = ref(true)
const relativeOpen = ref(true)
const inChatOpen = ref(true)

// API 配置：每项启用开关（默认全关；由 enabled_fields 初始化）
const API_KEYS = ['temperature','top_p','top_k','max_context','max_tokens','stream','frequency_penalty','presence_penalty']
const apiToggles = ref(Object.fromEntries(API_KEYS.map(k => [k, false])))
function syncApiTogglesFromData() {
  try {
    const ef = Array.isArray(currentData.value?.api_config?.enabled_fields)
      ? currentData.value.api_config.enabled_fields
      : []
    for (const k of API_KEYS) apiToggles.value[k] = ef.includes(k)
  } catch {
    for (const k of API_KEYS) apiToggles.value[k] = false
  }
}
function computeEnabledFields() {
  return API_KEYS.filter(k => apiToggles.value[k])
}

// 保存状态提示
const saving = ref(false)
const savedOk = ref(false)
let __saveTimer = null

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

// 计算属性
const relativePrompts = computed(() => 
  (currentData.value.prompts || []).filter(p => p.position === 'relative')
)
const inChatPrompts = computed(() => 
  (currentData.value.prompts || []).filter(p => p.position === 'in-chat')
)

// 新增 Relative：特殊组件选择
const specialSelect = ref('')
const newRelId = ref('')
const newRelName = ref('')
const relError = ref(null)

const availableSpecials = computed(() =>
  SPECIAL_RELATIVE_TEMPLATES.filter(t => 
    !(currentData.value.prompts || []).some(p => p.identifier === t.identifier)
  )
)

const reservedIdSet = new Set(SPECIAL_RELATIVE_TEMPLATES.map(t => t.identifier))
const reservedNameSet = new Set(SPECIAL_RELATIVE_TEMPLATES.map(t => t.name))

async function addSelectedSpecial() {
  relError.value = null
  const sel = specialSelect.value
  if (!sel) return
  const tpl = SPECIAL_RELATIVE_TEMPLATES.find(tp => tp.identifier === sel)
  if (!tpl) return
  if ((currentData.value.prompts || []).some(p => p.identifier === tpl.identifier)) {
    relError.value = t('detail.preset.errors.specialExists')
    return
  }
  const item = { ...tpl }
  currentData.value.prompts.push(item)
  specialSelect.value = ''
  await nextTick()
  window.lucide?.createIcons?.()
}

async function addCustomRelative() {
  relError.value = null
  const id = newRelId.value.trim()
  const name = newRelName.value.trim()
  if (!id) {
    relError.value = t('detail.preset.errors.idRequired')
    return
  }
  if (!name) {
    relError.value = t('detail.preset.errors.nameRequired')
    return
  }
  if (reservedIdSet.has(id) || reservedNameSet.has(name)) {
    relError.value = t('detail.preset.errors.reservedConflict')
    return
  }
  if ((currentData.value.prompts || []).some(p => p.identifier === id)) {
    relError.value = t('detail.preset.errors.idExists')
    return
  }
  if ((currentData.value.prompts || []).some(p => p.name === name)) {
    relError.value = t('detail.preset.errors.nameExists')
    return
  }
  const item = {
    identifier: id,
    name,
    enabled: null,
    role: 'system',
    position: 'relative',
    content: ''
  }
  currentData.value.prompts.push(item)
  newRelId.value = ''
  newRelName.value = ''
  await nextTick()
  window.lucide?.createIcons?.()
}

// In-Chat 新增
const newChatId = ref('')
const newChatName = ref('')
const chatError = ref(null)

async function addCustomInChat() {
  chatError.value = null
  const id = newChatId.value.trim()
  const name = newChatName.value.trim()
  if (!id) {
    chatError.value = t('detail.preset.errors.idRequired')
    return
  }
  if (!name) {
    chatError.value = t('detail.preset.errors.nameRequired')
    return
  }
  if ((currentData.value.prompts || []).some(p => p.identifier === id)) {
    chatError.value = t('detail.preset.errors.idExists')
    return
  }
  if ((currentData.value.prompts || []).filter(p => p.position === 'in-chat').some(p => p.name === name)) {
    chatError.value = t('detail.preset.errors.nameExists')
    return
  }
  const item = {
    identifier: id,
    name,
    enabled: true,
    role: 'system',
    position: 'in-chat',
    depth: 0,
    order: 0,
    content: ''
  }
  currentData.value.prompts.push(item)
  newChatId.value = ''
  newChatName.value = ''
  await nextTick()
  window.lucide?.createIcons?.()
}

// 正则规则新增
const newRegexId = ref('')
const newRegexName = ref('')
const regexError = ref(null)

async function addCustomRegex() {
  regexError.value = null
  const id = newRegexId.value.trim()
  const name = newRegexName.value.trim()
  if (!id) {
    regexError.value = t('detail.preset.errors.idRequired')
    return
  }
  if (!name) {
    regexError.value = t('detail.preset.errors.nameRequired')
    return
  }
  const rules = currentData.value.regex_rules || []
  if (rules.some(r => r.id === id)) {
    regexError.value = t('detail.preset.errors.idExists')
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
  newRegexId.value = ''
  newRegexName.value = ''
  await nextTick()
  window.lucide?.createIcons?.()
}

// 提示词更新和删除
function onPromptUpdate(updated) {
  const idx = currentData.value.prompts.findIndex(p => p.identifier === updated.identifier)
  if (idx >= 0) {
    currentData.value.prompts[idx] = updated
  }
}

function onPromptDelete(id) {
  currentData.value.prompts = currentData.value.prompts.filter(p => p.identifier !== id)
}

// 正则规则更新和删除
function onRegexUpdate(updated) {
  const idx = currentData.value.regex_rules.findIndex(r => r.id === updated.id)
  if (idx >= 0) {
    currentData.value.regex_rules[idx] = updated
  }
}

function onRegexDelete(id) {
  currentData.value.regex_rules = currentData.value.regex_rules.filter(r => r.id !== id)
}

// 提示词拖拽 - 使用 composable
const {
  dragging: draggingPrompt,
  dragOverId: dragOverPromptId,
  dragOverBefore: dragOverPromptBefore,
  startDrag: startPromptDrag,
} = useCustomDrag({
  scrollContainerSelector: '.modal-scroll .scroll-container2',
  itemSelector: '.draglist-item',
  dataAttribute: 'data-identifier',
  onReorder: (draggedId, targetId, insertBefore) => {
    // 获取位置信息
    const draggedItem = currentData.value.prompts.find(p => p.identifier === draggedId)
    if (!draggedItem) return
    
    const position = draggedItem.position
    const list = position === 'relative' ? [...relativePrompts.value] : [...inChatPrompts.value]
    let ids = list.map(i => i.identifier)
    const fromIdx = ids.indexOf(draggedId)
    
    if (fromIdx >= 0 && targetId !== draggedId) {
      ids.splice(fromIdx, 1)
      if (targetId) {
        const toIdx = ids.indexOf(targetId)
        let insertIdx = toIdx < 0 ? ids.length : toIdx + (insertBefore ? 0 : 1)
        if (insertIdx < 0) insertIdx = 0
        if (insertIdx > ids.length) insertIdx = ids.length
        ids.splice(insertIdx, 0, draggedId)
      } else {
        ids.push(draggedId)
      }
      
      // 重新排列
      const allPrompts = currentData.value.prompts || []
      const otherPrompts = allPrompts.filter(p => p.position !== position)
      const reordered = ids.map(id => allPrompts.find(p => p.identifier === id)).filter(Boolean)
      currentData.value.prompts = [...otherPrompts, ...reordered]
      window.lucide?.createIcons?.()
    }
  },
  getTitleForItem: (id) => {
    const item = currentData.value.prompts.find(p => p.identifier === id)
    return item?.name || id
  }
})

// 正则规则拖拽 - 使用 composable
const {
  dragging: draggingRegex,
  dragOverId: dragOverRegexId,
  dragOverBefore: dragOverRegexBefore,
  startDrag: startRegexDrag,
} = useCustomDrag({
  scrollContainerSelector: '.modal-scroll .scroll-container2',
  itemSelector: '.draglist-item-regex',
  dataAttribute: 'data-regex-id',
  onReorder: (draggedId, targetId, insertBefore) => {
    const list = [...(currentData.value.regex_rules || [])]
    let ids = list.map(i => i.id)
    const fromIdx = ids.indexOf(draggedId)
    
    if (fromIdx >= 0 && targetId !== draggedId) {
      ids.splice(fromIdx, 1)
      if (targetId) {
        const toIdx = ids.indexOf(targetId)
        let insertIdx = toIdx < 0 ? ids.length : toIdx + (insertBefore ? 0 : 1)
        if (insertIdx < 0) insertIdx = 0
        if (insertIdx > ids.length) insertIdx = ids.length
        ids.splice(insertIdx, 0, draggedId)
      } else {
        ids.push(draggedId)
      }
      
      currentData.value.regex_rules = ids.map(id => list.find(r => r.id === id)).filter(Boolean)
      window.lucide?.createIcons?.()
    }
  },
  getTitleForItem: (id) => {
    const rule = currentData.value.regex_rules.find(r => r.id === id)
    return rule?.name || id
  }
})

// 初始化 Lucide 图标
onMounted(async () => {
  window.lucide?.createIcons?.()
  // 初次挂载时根据当前数据同步 per-field 开关
  try { syncApiTogglesFromData() } catch {}
  // 加载已有图标
  await loadExistingIcon()
})

watch([() => currentData.value.prompts, () => currentData.value.regex_rules], async () => {
  await nextTick()
  window.lucide?.createIcons?.()
}, { flush: 'post' })

const __eventOffs = [] // 事件监听清理器

onBeforeUnmount(() => {
  try {
    __eventOffs?.forEach(fn => { try { fn?.() } catch (_) {} })
    __eventOffs.length = 0
  } catch (_) {}
})

/** 保存：将当前编辑内容写回后端文件（事件驱动）
  * - 在 api_config 中写入 enabled_fields（由各项开关生成）
  * - 保存期间显示旋转动画；成功后短暂显示"已保存！"
  */
async function save() {
  const file = props.file
  if (!file) {
    try { alert(t('error.missingFilePath')); } catch (_) {}
    return
  }
  // 生成 api_config（含 enabled_fields）
  const apiConf = { ...(currentData.value.api_config || {}) }
  apiConf.enabled_fields = computeEnabledFields()
  const payloadContent = {
    name: currentData.value.name || '',
    description: currentData.value.description || '',
    api_config: apiConf,
    prompts: Array.isArray(currentData.value.prompts) ? currentData.value.prompts : [],
    regex_rules: Array.isArray(currentData.value.regex_rules) ? currentData.value.regex_rules : [],
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
      console.error('[PresetDetailView] Icon conversion failed:', err)
    }
  } else if (iconDeleted.value && iconLoadedFromServer.value) {
    // 用户删除了原有图标（图标曾经从服务器加载，现在被删除）
    iconBase64 = ''
  }
  // 否则 iconBase64 保持 undefined，表示不修改图标
  
  // 可视提示
  saving.value = true
  savedOk.value = false
  if (__saveTimer) { try { clearTimeout(__saveTimer) } catch {} __saveTimer = null }
  
  const tag = `preset_save_${Date.now()}`
  
  // 监听保存结果（一次性）
  const offOk = Host.events.on(Catalog.EVT_CATALOG_PRESET_UPDATE_OK, async ({ file: resFile, tag: resTag }) => {
    if (resFile !== file || resTag !== tag) return
    console.log('[PresetDetailView] 保存成功（事件）')
    savedOk.value = true
    saving.value = false
    if (savedOk.value) {
      __saveTimer = setTimeout(() => { savedOk.value = false }, 1800)
    }
    
    // 保存成功后，刷新侧边栏列表
    try {
      console.log('[PresetDetailView] 刷新预设列表')
      Host.events.emit(Catalog.EVT_CATALOG_PRESETS_REQ, {
        requestId: Date.now()
      })
    } catch (err) {
      console.warn('[PresetDetailView] 刷新预设列表失败:', err)
    }
    
    // 保存成功后，检查是否是当前使用的预设，如果是则刷新 store
    try {
      const chatSettingsStore = useChatSettingsStore()
      const presetStore = usePresetStore()
      const currentPresetFile = chatSettingsStore.presetFile
      if (currentPresetFile && currentPresetFile === file) {
        console.log('[PresetDetailView] 刷新预设 store')
        await presetStore.refreshFromPresetFile(file)
      }
    } catch (err) {
      console.warn('[PresetDetailView] 刷新预设 store 失败:', err)
    }
    
    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  
  const offFail = Host.events.on(Catalog.EVT_CATALOG_PRESET_UPDATE_FAIL, ({ file: resFile, message, tag: resTag }) => {
    if (resFile && resFile !== file) return
    if (resTag && resTag !== tag) return
    console.error('[PresetDetailView] 保存失败（事件）:', message)
    try { alert(t('detail.preset.saveFailed') + '：' + message) } catch (_) {}
    saving.value = false
    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  
  __eventOffs.push(offOk, offFail)
  
  // 发送保存请求事件
  Host.events.emit(Catalog.EVT_CATALOG_PRESET_UPDATE_REQ, {
    file,
    content: payloadContent,
    name: payloadContent.name,
    description: payloadContent.description,
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
          <i data-lucide="settings-2" class="w-5 h-5 text-black"></i>
          <h2 class="text-lg font-bold text-black">{{ currentData.name || t('detail.preset.title') }}</h2>
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
            {{ t('detail.preset.editMode') }}
          </div>
        </div>
      </div>
      <p class="mt-2 text-xs text-black/60">{{ t('detail.preset.editHint') }}</p>
    </div>

    <!-- 基本信息（名称/描述/图标） -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="id-card" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.preset.basicInfo') }}</h3>
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

    <!-- API 配置 -->
    <div class="bg-white rounded-4 border border-gray-200 transition-all duration-200 ease-soft hover:shadow-elevate">
      <button
        type="button"
        class="w-full flex items-center justify-between px-5 py-3 rounded-4"
        @click="apiOpen = !apiOpen"
      >
        <div class="flex items-center gap-2">
          <i data-lucide="server-cog" class="w-4 h-4 text-black"></i>
          <span class="text-sm font-medium text-black">{{ t('detail.preset.apiConfig.title') }}</span>
        </div>
        <i
          data-lucide="chevron-down"
          class="w-4 h-4 text-black transition-transform duration-200 ease-soft"
          :class="apiOpen ? 'rotate-180' : ''"
        />
      </button>

      <div v-show="apiOpen" class="border-t border-gray-200 p-5">
        <!-- 全局启用开关 -->
        <div class="mb-4 flex items-center justify-between">
          <div class="text-sm font-medium text-black">{{ t('detail.preset.apiConfig.enableTitle') }}</div>
          <label class="inline-flex items-center gap-2 select-none">
            <input
              type="checkbox"
              v-model="currentData.api_config.enabled"
              class="w-5 h-5 border border-gray-400 rounded-4 accent-black"
            />
            <span class="text-sm text-black/80">{{ currentData.api_config.enabled ? t('detail.preset.apiConfig.enabled') : t('detail.preset.apiConfig.notEnabled') }}</span>
          </label>
        </div>

        <!-- 参数编辑 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-black">{{ t('detail.preset.apiConfig.temperature') }}</label>
              <label class="inline-flex items-center gap-2 select-none">
                <input type="checkbox" v-model="apiToggles.temperature" class="w-4 h-4 border border-gray-400 rounded-4 accent-black" />
                <span class="text-xs text-black/60">{{ t('detail.preset.apiConfig.enable') }}</span>
              </label>
            </div>
            <input
              type="number"
              min="0"
              max="2"
              step="0.01"
              v-model.number="currentData.api_config.temperature"
              :disabled="!currentData.api_config.enabled || !apiToggles.temperature"
              class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-black">{{ t('detail.preset.apiConfig.topP') }}</label>
              <label class="inline-flex items-center gap-2 select-none">
                <input type="checkbox" v-model="apiToggles.top_p" class="w-4 h-4 border border-gray-400 rounded-4 accent-black" />
                <span class="text-xs text-black/60">{{ t('detail.preset.apiConfig.enable') }}</span>
              </label>
            </div>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              v-model.number="currentData.api_config.top_p"
              :disabled="!currentData.api_config.enabled || !apiToggles.top_p"
              class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-black">{{ t('detail.preset.apiConfig.topK') }}</label>
              <label class="inline-flex items-center gap-2 select-none">
                <input type="checkbox" v-model="apiToggles.top_k" class="w-4 h-4 border border-gray-400 rounded-4 accent-black" />
                <span class="text-xs text-black/60">{{ t('detail.preset.apiConfig.enable') }}</span>
              </label>
            </div>
            <input
              type="number"
              min="0"
              v-model.number="currentData.api_config.top_k"
              :disabled="!currentData.api_config.enabled || !apiToggles.top_k"
              class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-black">{{ t('detail.preset.apiConfig.maxContext') }}</label>
              <label class="inline-flex items-center gap-2 select-none">
                <input type="checkbox" v-model="apiToggles.max_context" class="w-4 h-4 border border-gray-400 rounded-4 accent-black" />
                <span class="text-xs text-black/60">{{ t('detail.preset.apiConfig.enable') }}</span>
              </label>
            </div>
            <input
              type="number"
              min="1"
              v-model.number="currentData.api_config.max_context"
              :disabled="!currentData.api_config.enabled || !apiToggles.max_context"
              class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-black">{{ t('detail.preset.apiConfig.maxTokens') }}</label>
              <label class="inline-flex items-center gap-2 select-none">
                <input type="checkbox" v-model="apiToggles.max_tokens" class="w-4 h-4 border border-gray-400 rounded-4 accent-black" />
                <span class="text-xs text-black/60">{{ t('detail.preset.apiConfig.enable') }}</span>
              </label>
            </div>
            <input
              type="number"
              min="1"
              v-model.number="currentData.api_config.max_tokens"
              :disabled="!currentData.api_config.enabled || !apiToggles.max_tokens"
              class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-black">{{ t('detail.preset.apiConfig.stream') }}</label>
              <label class="inline-flex items-center gap-2 select-none">
                <input type="checkbox" v-model="apiToggles.stream" class="w-4 h-4 border border-gray-400 rounded-4 accent-black" />
                <span class="text-xs text-black/60">{{ t('detail.preset.apiConfig.enable') }}</span>
              </label>
            </div>
            <label class="inline-flex items-center space-x-2">
              <input
                type="checkbox"
                v-model="currentData.api_config.stream"
                :disabled="!currentData.api_config.enabled || !apiToggles.stream"
                class="w-5 h-5 border border-gray-400 rounded-4 accent-black"
              />
              <span class="text-sm text-black/80">{{ t('detail.preset.apiConfig.on') }}</span>
            </label>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-black">{{ t('detail.preset.apiConfig.frequencyPenalty') }}</label>
              <label class="inline-flex items-center gap-2 select-none">
                <input type="checkbox" v-model="apiToggles.frequency_penalty" class="w-4 h-4 border border-gray-400 rounded-4 accent-black" />
                <span class="text-xs text-black/60">{{ t('detail.preset.apiConfig.enable') }}</span>
              </label>
            </div>
            <input
              type="number"
              min="0"
              v-model.number="currentData.api_config.frequency_penalty"
              :disabled="!currentData.api_config.enabled || !apiToggles.frequency_penalty"
              class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-black">{{ t('detail.preset.apiConfig.presencePenalty') }}</label>
              <label class="inline-flex items-center gap-2 select-none">
                <input type="checkbox" v-model="apiToggles.presence_penalty" class="w-4 h-4 border border-gray-400 rounded-4 accent-black" />
                <span class="text-xs text-black/60">{{ t('detail.preset.apiConfig.enable') }}</span>
              </label>
            </div>
            <input
              type="number"
              min="0"
              v-model.number="currentData.api_config.presence_penalty"
              :disabled="!currentData.api_config.enabled || !apiToggles.presence_penalty"
              class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 提示词编辑 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <button
        type="button"
        class="w-full flex items-center justify-between mb-4 rounded-4"
        @click="promptsOpen = !promptsOpen"
      >
        <div class="flex items-center gap-2">
          <i data-lucide="edit-3" class="w-4 h-4 text-black"></i>
          <span class="text-sm font-medium text-black">{{ t('detail.preset.prompts.title') }}</span>
        </div>
        <i
          data-lucide="chevron-down"
          class="w-4 h-4 text-black transition-transform duration-200 ease-soft"
          :class="promptsOpen ? 'rotate-180' : ''"
        />
      </button>

      <div v-show="promptsOpen" class="grid grid-cols-1 gap-6">
        <div class="space-y-4">
          <div class="border border-gray-200 rounded-4 p-4 transition-all duration-200 ease-soft hover:shadow-elevate">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center space-x-2">
                <i data-lucide="list" class="w-4 h-4 text-black"></i>
                <span class="text-sm font-medium text-black">{{ t('detail.preset.prompts.items') }}</span>
              </div>
            </div>
            <div class="space-y-6">
              <!-- Relative 条目 -->
              <div>
                <button
                  type="button"
                  class="w-full flex items-center justify-between mb-2 rounded-4"
                  @click="relativeOpen = !relativeOpen"
                >
                  <div class="flex items-center gap-2">
                    <i data-lucide="layers" class="w-4 h-4 text-black"></i>
                    <span class="text-sm font-medium text-black">{{ t('detail.preset.prompts.relative') }}</span>
                  </div>
                  <i
                    data-lucide="chevron-down"
                    class="w-4 h-4 text-black transition-transform duration-200 ease-soft"
                    :class="relativeOpen ? 'rotate-180' : ''"
                  />
                </button>

                <!-- 新增 Relative -->
                <div v-show="relativeOpen" class="space-y-2 mb-2">
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    <!-- 一次性组件选择 -->
                    <div class="flex items-center gap-2">
                      <select
                        v-model="specialSelect"
                        class="min-w-[220px] px-3 py-2 border border-gray-300 rounded-4 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                      >
                        <option value="" disabled>{{ t('detail.preset.prompts.selectSpecial') }}</option>
                        <option
                          v-for="sp in availableSpecials"
                          :key="sp.identifier"
                          :value="sp.identifier"
                        >
                          {{ sp.name }} (id: {{ sp.identifier }})
                        </option>
                      </select>
                      <button
                        class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft text-xs disabled:opacity-50"
                        :disabled="!specialSelect"
                        @click="addSelectedSpecial"
                      >
                        {{ t('detail.preset.prompts.addSpecial') }}
                      </button>
                    </div>

                    <!-- 自定义 Relative -->
                    <div class="flex items-center gap-2 justify-end">
                      <input
                        v-model="newRelId"
                        placeholder="id"
                        class="w-32 px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                      />
                      <input
                        v-model="newRelName"
                        :placeholder="t('common.name')"
                        class="w-40 px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                      />
                      <button
                        class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft text-xs"
                        @click="addCustomRelative"
                      >
                        {{ t('common.add') }}
                      </button>
                    </div>
                  </div>
                  <p v-if="relError" class="text-xs text-red-600">* {{ relError }}</p>
                </div>

                <!-- Relative 列表（可拖拽） -->
                <div v-show="relativeOpen" class="space-y-2">
                  <div
                    v-for="it in relativePrompts"
                    :key="it.identifier"
                    class="flex items-stretch gap-2 group draglist-item"
                    :class="{
                      'dragging-item': draggingPrompt?.id === it.identifier,
                      'drag-over-top': dragOverPromptId === it.identifier && dragOverPromptBefore,
                      'drag-over-bottom': dragOverPromptId === it.identifier && !dragOverPromptBefore
                    }"
                  >
                    <div
                      class="w-6 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
                      @mousedown="startPromptDrag(it.identifier, $event)"
                      :title="t('detail.preset.prompts.dragToSort')"
                    >
                      <i data-lucide="grip-vertical" class="icon-grip w-4 h-4 text-black opacity-60 group-hover:opacity-100"></i>
                    </div>
                    <div class="flex-1" :data-identifier="it.identifier">
                      <PresetPromptCard
                        :item="it"
                        @update="onPromptUpdate"
                        @delete="onPromptDelete"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- In-Chat 条目 -->
              <div>
                <button
                  type="button"
                  class="w-full flex items-center justify-between mb-2 rounded-4"
                  @click="inChatOpen = !inChatOpen"
                >
                  <div class="flex items-center gap-2">
                    <i data-lucide="message-square" class="w-4 h-4 text-black"></i>
                    <span class="text-sm font-medium text-black">{{ t('detail.preset.prompts.inChat') }}</span>
                  </div>
                  <i
                    data-lucide="chevron-down"
                    class="w-4 h-4 text-black transition-transform duration-200 ease-soft"
                    :class="inChatOpen ? 'rotate-180' : ''"
                  />
                </button>
                
                <div v-show="inChatOpen" class="mb-2 flex justify-end">
                  <div class="flex items-center gap-2">
                    <input
                      v-model="newChatId"
                      placeholder="id"
                      class="w-32 px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                    <input
                      v-model="newChatName"
                      :placeholder="t('common.name')"
                      class="w-40 px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                    />
                    <button
                      class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft text-xs"
                      @click="addCustomInChat"
                    >
                      {{ t('common.add') }}
                    </button>
                  </div>
                </div>
                <p v-show="inChatOpen && chatError" class="text-xs text-red-600 mb-2">* {{ chatError }}</p>
                
                <div v-show="inChatOpen" class="space-y-2">
                  <div
                    v-for="it in inChatPrompts"
                    :key="it.identifier"
                    class="flex items-stretch gap-2 group draglist-item"
                    :class="{
                      'dragging-item': draggingPrompt?.id === it.identifier,
                      'drag-over-top': dragOverPromptId === it.identifier && dragOverPromptBefore,
                      'drag-over-bottom': dragOverPromptId === it.identifier && !dragOverPromptBefore
                    }"
                  >
                    <div
                      class="w-6 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
                      @mousedown="startPromptDrag(it.identifier, $event)"
                      :title="t('detail.preset.prompts.dragToSort')"
                    >
                      <i data-lucide="grip-vertical" class="icon-grip w-4 h-4 text-black opacity-60 group-hover:opacity-100"></i>
                    </div>
                    <div class="flex-1" :data-identifier="it.identifier">
                      <PresetPromptCard
                        :item="it"
                        @update="onPromptUpdate"
                        @delete="onPromptDelete"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 正则编辑 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <button
        type="button"
        class="w-full flex items-center justify-between mb-3 rounded-4"
        @click="regexOpen = !regexOpen"
      >
        <div class="flex items-center gap-2">
          <i data-lucide="code" class="w-4 h-4 text-black"></i>
          <span class="text-sm font-medium text-black">{{ t('detail.preset.regex.title') }}</span>
        </div>
        <i
          data-lucide="chevron-down"
          class="w-4 h-4 text-black transition-transform duration-200 ease-soft"
          :class="regexOpen ? 'rotate-180' : ''"
        />
      </button>

      <div v-show="regexOpen" class="space-y-2">
        <!-- 新增 Regex -->
        <div class="mb-2 flex justify-end">
          <div class="flex items-center gap-2">
            <input
              v-model="newRegexId"
              placeholder="id"
              class="w-32 px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
            <input
              v-model="newRegexName"
              :placeholder="t('common.name')"
              class="w-40 px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
            <button
              class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft text-xs"
              @click="addCustomRegex"
            >
              {{ t('common.add') }}
            </button>
          </div>
        </div>
        <p v-if="regexError" class="text-xs text-red-600 mb-2">* {{ regexError }}</p>

        <!-- 规则列表（可拖拽排序） -->
        <div class="space-y-2">
          <div
            v-for="r in (currentData.regex_rules || [])"
            :key="r.id"
            class="flex items-stretch gap-2 group draglist-item-regex"
            :class="{
              'dragging-item': draggingRegex?.id === r.id,
              'drag-over-top': dragOverRegexId === r.id && dragOverRegexBefore,
              'drag-over-bottom': dragOverRegexId === r.id && !dragOverRegexBefore
            }"
          >
            <div
              class="w-6 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
              @mousedown="startRegexDrag(r.id, $event)"
              :title="t('detail.preset.prompts.dragToSort')"
            >
              <i data-lucide="grip-vertical" class="icon-grip w-4 h-4 text-black opacity-60 group-hover:opacity-100"></i>
            </div>
            <div class="flex-1" :data-regex-id="r.id">
              <RegexRuleCard
                :rule="r"
                @update="onRegexUpdate"
                @delete="onRegexDelete"
              />
            </div>
          </div>
        </div>

        <div v-if="(currentData.regex_rules || []).length === 0" class="text-xs text-black/50 px-1 py-1">
          {{ t('detail.preset.regex.empty') }}
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
@import './shared-detail-styles.css';
</style>