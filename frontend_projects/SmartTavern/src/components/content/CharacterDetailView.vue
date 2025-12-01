<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import WorldBookCard from './cards/WorldBookCard.vue'
import RegexRuleCard from './cards/RegexRuleCard.vue'
import { useI18n } from '@/locales'
import Host from '@/workflow/core/host'
import * as Catalog from '@/workflow/channels/catalog'
import { useCharacterStore } from '@/stores/character'
import { useChatSettingsStore } from '@/stores/chatSettings'
import { useCustomDrag } from '@/composables/useCustomDrag'
import DataCatalog from '@/services/dataCatalog'

const { t } = useI18n()

const props = defineProps({
  characterData: { type: Object, default: null },
  file: { type: String, default: '' }
})

// 图标上传相关
const iconFile = ref(null)
const iconPreviewUrl = ref('')
const iconInputRef = ref(null)
// 追踪图标是否被用户主动删除
const iconDeleted = ref(false)
// 追踪是否已经从后端加载了图标
const iconLoadedFromServer = ref(false)

// 图标预览URL计算属性
const hasIcon = computed(() => !!iconPreviewUrl.value)

// 头像上传相关
const avatarFile = ref(null)
const avatarPreviewUrl = ref('')
const avatarInputRef = ref(null)
// 追踪头像是否被用户主动删除
const avatarDeleted = ref(false)
// 追踪是否已经从后端加载了头像
const avatarLoadedFromServer = ref(false)

// 头像预览URL计算属性
const hasAvatar = computed(() => !!avatarPreviewUrl.value)

// 处理图标选择
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

// 触发图标选择
function triggerIconSelect() {
  iconInputRef.value?.click()
}

// 移除图标
function removeIcon() {
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

// 处理头像选择
function handleAvatarSelect(e) {
  const file = e.target.files?.[0]
  if (!file) return
  
  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    return
  }
  
  avatarFile.value = file
  
  // 创建预览URL
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value)
  }
  avatarPreviewUrl.value = URL.createObjectURL(file)
  avatarDeleted.value = false
}

// 触发头像选择
function triggerAvatarSelect() {
  avatarInputRef.value?.click()
}

// 移除头像
function removeAvatar() {
  avatarFile.value = null
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value)
  }
  avatarPreviewUrl.value = ''
  if (avatarInputRef.value) {
    avatarInputRef.value.value = ''
  }
  // 标记用户主动删除了头像
  avatarDeleted.value = true
}

function resetAvatarPreview() {
  avatarFile.value = null
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value)
  }
  avatarPreviewUrl.value = ''
  if (avatarInputRef.value) {
    avatarInputRef.value.value = ''
  }
  // 重置删除标记和加载标记
  avatarDeleted.value = false
  avatarLoadedFromServer.value = false
}

// 根据文件路径加载已有图标
async function loadExistingIcon() {
  // 重置当前图标
  resetIconPreview()
  
  if (!props.file) return
  
  // 构建图标路径：将文件路径的 character.json 替换为 icon.png
  const iconPath = props.file.replace(/character\.json$/, 'icon.png')
  
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
    console.debug('[CharacterDetailView] No existing icon or failed to load:', err)
    iconLoadedFromServer.value = false
  }
}

// 根据文件路径加载已有头像
async function loadExistingAvatar() {
  // 重置当前头像
  resetAvatarPreview()
  
  if (!props.file) return
  
  // 构建头像路径：将文件路径的 character.json 替换为 character.png
  const avatarPath = props.file.replace(/character\.json$/, 'character.png')
  
  try {
    // 使用 DataCatalog.getDataAssetBlob 获取头像
    const { blob, mime } = await DataCatalog.getDataAssetBlob(avatarPath)
    if (blob.size > 0 && mime.startsWith('image/')) {
      avatarPreviewUrl.value = URL.createObjectURL(blob)
      // 标记头像是从服务器加载的
      avatarLoadedFromServer.value = true
    }
  } catch (err) {
    // 头像不存在或加载失败，忽略错误
    console.debug('[CharacterDetailView] No existing avatar or failed to load:', err)
    avatarLoadedFromServer.value = false
  }
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


/** 深拷贝 */
function deepClone(x) { return JSON.parse(JSON.stringify(x)) }
/** 规范化后端/外部传入的角色卡结构到本组件内部期望结构 */
function normalizeCharacterData(src) {
  if (!src || typeof src !== 'object') return null
  const name = src.name || '角色'
  const description = src.description || ''
  const type = src.type || 'threaded' // 默认为 threaded
  const character_name = src.character_name || ''
  const character_badge = src.character_badge || ''
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
  return { name, description, type, character_name, character_badge, message, world_book, regex_rules }
}
// 当前编辑的数据（内存中）
const currentData = ref(
  deepClone(
    normalizeCharacterData(props.characterData) || {
      name: '',
      description: '',
      type: 'threaded',
      character_name: '',
      character_badge: '',
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
      type: 'threaded',
      character_name: '',
      character_badge: '',
      message: [],
      world_book: { name: '', entries: [] },
      regex_rules: []
    }
  )
  await nextTick()
  window.lucide?.createIcons?.()
})

// 监听文件路径变化，加载图标和头像
watch(() => props.file, (newFile) => {
  if (newFile) {
    loadExistingIcon()
    loadExistingAvatar()
  } else {
    resetIconPreview()
    resetAvatarPreview()
  }
}, { immediate: true })

// 基本信息编辑
const nameDraft = ref(currentData.value.name || '')
const descDraft = ref(currentData.value.description || '')
const typeDraft = ref(currentData.value.type || 'threaded')
const characterNameDraft = ref(currentData.value.character_name || '')
const characterBadgeDraft = ref(currentData.value.character_badge || '')

function saveMeta() {
  currentData.value.name = nameDraft.value
  currentData.value.description = descDraft.value
  currentData.value.type = typeDraft.value
  currentData.value.character_name = characterNameDraft.value
  currentData.value.character_badge = characterBadgeDraft.value
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
    wbError.value = t('detail.character.errors.wbIdRequired')
    return
  }
  if (!name) {
    wbError.value = t('detail.character.errors.wbNameRequired')
    return
  }
  if (!currentData.value.world_book) {
    currentData.value.world_book = { name: t('detail.character.worldBook.defaultName'), entries: [] }
  }
  const list = currentData.value.world_book.entries || []
  if (list.some(e => e.id === id)) {
    wbError.value = t('detail.character.errors.wbIdExists')
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

// 世界书拖拽 - 使用 composable
const {
  dragging: draggingWb,
  dragOverId: dragOverWbId,
  dragOverBefore: dragOverWbBefore,
  startDrag: startWbDrag,
} = useCustomDrag({
  scrollContainerSelector: '.modal-scroll .scroll-container2',
  itemSelector: '.draglist-item',
  dataAttribute: 'data-wb-id',
  onReorder: (draggedId, targetId, insertBefore) => {
    const list = [...(currentData.value.world_book?.entries || [])]
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
      
      currentData.value.world_book.entries = ids.map(id => list.find(w => String(w.id) === id)).filter(Boolean)
      window.lucide?.createIcons?.()
    }
  },
  getTitleForItem: (id) => {
    const entry = currentData.value.world_book?.entries?.find(w => w.id === id)
    return entry?.name || id
  }
})

// 内嵌正则规则
const newRuleId = ref('')
const newRuleName = ref('')
const ruleError = ref(null)

function addRegexRule() {
  ruleError.value = null
  const id = newRuleId.value.trim()
  const name = newRuleName.value.trim()
  if (!id) {
    ruleError.value = t('detail.character.errors.ruleIdRequired')
    return
  }
  if (!name) {
    ruleError.value = t('detail.character.errors.ruleNameRequired')
    return
  }
  const rules = currentData.value.regex_rules || []
  if (rules.some(r => r.id === id)) {
    ruleError.value = t('detail.character.errors.ruleIdExists')
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

// 正则规则拖拽 - 使用 composable
const {
  dragging: draggingRx,
  dragOverId: dragOverRxId,
  dragOverBefore: dragOverRxBefore,
  startDrag: startRxDrag,
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
    const rule = currentData.value.regex_rules?.find(r => r.id === id)
    return rule?.name || id
  }
})

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

// 保存状态
const saving = ref(false)
const savedOk = ref(false)
let __saveTimer = null
const __eventOffs = []

onBeforeUnmount(() => {
  try {
    __eventOffs?.forEach(fn => { try { fn?.() } catch (_) {} })
    __eventOffs.length = 0
    if (__saveTimer) clearTimeout(__saveTimer)
  } catch (_) {}
})

// 保存到后端
async function save() {
  const file = props.file
  if (!file) {
    try { alert(t('error.missingFilePath')); } catch (_) {}
    return
  }
  
  // 先保存当前草稿
  saveMeta()
  
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
      console.error('[CharacterDetailView] Icon conversion failed:', err)
    }
  } else if (iconDeleted.value && iconLoadedFromServer.value) {
    // 用户删除了原有图标（图标曾经从服务器加载，现在被删除）
    iconBase64 = ''
  }
  // 否则 iconBase64 保持 undefined，表示不修改图标
  
  // 处理头像：
  // - 用户选择了新头像 -> 转换为 base64
  // - 用户删除了头像 -> 传空字符串 ''（告诉后端删除）
  // - 没有修改头像 -> 不传（undefined）
  let avatarBase64 = undefined
  if (avatarFile.value) {
    // 用户选择了新头像
    try {
      avatarBase64 = await fileToBase64(avatarFile.value)
    } catch (err) {
      console.error('[CharacterDetailView] Avatar conversion failed:', err)
    }
  } else if (avatarDeleted.value && avatarLoadedFromServer.value) {
    // 用户删除了原有头像（头像曾经从服务器加载，现在被删除）
    avatarBase64 = ''
  }
  // 否则 avatarBase64 保持 undefined，表示不修改头像
  
  // 构建保存内容
  const content = {
    name: currentData.value.name || '',
    description: currentData.value.description || '',
    type: currentData.value.type || 'threaded',
    character_name: currentData.value.character_name || '',
    character_badge: currentData.value.character_badge || '',
    message: Array.isArray(currentData.value.message) ? currentData.value.message : [],
    world_book: currentData.value.world_book || { name: '', entries: [] },
    regex_rules: Array.isArray(currentData.value.regex_rules) ? currentData.value.regex_rules : []
  }
  
  saving.value = true
  savedOk.value = false
  if (__saveTimer) { try { clearTimeout(__saveTimer) } catch {} __saveTimer = null }
  
  const tag = `character_save_${Date.now()}`
  
  // 监听保存结果（一次性）
  const offOk = Host.events.on(Catalog.EVT_CATALOG_CHARACTER_UPDATE_OK, async ({ file: resFile, tag: resTag }) => {
    if (resFile !== file || resTag !== tag) return
    console.log('[CharacterDetailView] 保存成功（事件）')
    savedOk.value = true
    saving.value = false
    if (savedOk.value) {
      __saveTimer = setTimeout(() => { savedOk.value = false }, 1800)
    }
    
    // 保存成功后，刷新侧边栏列表
    try {
      console.log('[CharacterDetailView] 刷新角色卡列表')
      Host.events.emit(Catalog.EVT_CATALOG_CHARACTERS_REQ, {
        requestId: Date.now()
      })
    } catch (err) {
      console.warn('[CharacterDetailView] 刷新角色卡列表失败:', err)
    }
    
    // 保存成功后，检查是否是当前使用的角色卡，如果是则刷新 store
    try {
      const chatSettingsStore = useChatSettingsStore()
      const characterStore = useCharacterStore()
      const currentCharacterFile = chatSettingsStore.characterFile
      if (currentCharacterFile && currentCharacterFile === file) {
        console.log('[CharacterDetailView] 刷新角色卡 store')
        await characterStore.refreshFromCharacterFile(file)
      }
    } catch (err) {
      console.warn('[CharacterDetailView] 刷新角色卡 store 失败:', err)
    }
    
    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  
  const offFail = Host.events.on(Catalog.EVT_CATALOG_CHARACTER_UPDATE_FAIL, ({ file: resFile, message, tag: resTag }) => {
    if (resFile && resFile !== file) return
    if (resTag && resTag !== tag) return
    console.error('[CharacterDetailView] 保存失败（事件）:', message)
    try { alert(t('detail.character.saveFailed') + '：' + message) } catch (_) {}
    saving.value = false
    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  
  __eventOffs.push(offOk, offFail)
  
  // 发送保存请求事件
  Host.events.emit(Catalog.EVT_CATALOG_CHARACTER_UPDATE_REQ, {
    file,
    content,
    name: content.name,
    description: content.description,
    iconBase64,
    avatarBase64,
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
          <i data-lucide="user" class="w-5 h-5 text-black"></i>
          <h2 class="text-lg font-bold text-black">{{ t('detail.character.pageTitle') }}</h2>
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
            {{ t('detail.character.editMode') }}
          </div>
        </div>
      </div>
      <p class="mt-2 text-xs text-black/60">{{ t('detail.character.editHint') }}</p>
    </div>

    <!-- 基本设定 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="id-card" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.character.basicInfo') }}</h3>
      </div>

      <div class="flex gap-6 mb-4">
        <!-- 左侧：图标和头像上传区域 -->
        <div class="flex flex-col gap-4 flex-shrink-0">
          <!-- 图标 -->
          <div>
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
                style="display: none;"
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
                  <span>{{ t('createItem.uploadIcon') }}</span>
                </div>
              </template>
            </div>
          </div>
          
          <!-- 头像 -->
          <div>
            <label class="block text-sm font-medium text-black mb-2">{{ t('detail.character.avatarLabel') }}</label>
            <div
              class="icon-upload-area"
              :class="{ 'has-icon': hasAvatar }"
              @click="triggerAvatarSelect"
            >
              <input
                ref="avatarInputRef"
                type="file"
                accept="image/*"
                style="display: none;"
                @change="handleAvatarSelect"
              />
              <template v-if="hasAvatar">
                <img :src="avatarPreviewUrl" alt="Avatar Preview" class="icon-preview" />
                <button
                  type="button"
                  class="icon-remove-btn"
                  @click.stop="removeAvatar"
                  :title="t('detail.character.removeAvatar')"
                >
                  ✕
                </button>
              </template>
              <template v-else>
                <div class="icon-placeholder">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="8" r="5"/>
                    <path d="M20 21a8 8 0 1 0-16 0"/>
                  </svg>
                  <span>{{ t('detail.character.uploadAvatar') }}</span>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- 右侧：表单字段 -->
        <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-black mb-2">{{ t('detail.character.characterName') }}</label>
            <input
              v-model="nameDraft"
              @blur="saveMeta"
              class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
          </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('common.type') }}</label>
          <select
            v-model="typeDraft"
            @change="saveMeta"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          >
            <option value="threaded">{{ t('panel.character.type.threaded') }}</option>
            <option value="sandbox">{{ t('panel.character.type.sandbox') }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.character.displayName') }}</label>
          <input
            v-model="characterNameDraft"
            @blur="saveMeta"
            :placeholder="t('detail.character.displayNamePlaceholder')"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.character.badgeName') }}</label>
          <input
            v-model="characterBadgeDraft"
            @blur="saveMeta"
            :placeholder="t('detail.character.badgeNamePlaceholder')"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.character.characterDesc') }}</label>
          <textarea
            v-model="descDraft"
            @blur="saveMeta"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- 初始消息 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <i data-lucide="message-square" class="w-4 h-4 text-black"></i>
          <h3 class="text-base font-semibold text-black">{{ t('detail.character.messages.title') }} ({{ messageEdits.length }})</h3>
        </div>
        <button
          class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
          @click="addMessage"
        >
          {{ t('detail.character.messages.addNew') }}
        </button>
      </div>

      <div v-if="messageEdits.length === 0" class="text-center py-8 text-black/50 text-sm">
        {{ t('detail.character.messages.empty') }}
      </div>

      <div class="space-y-3">
        <div
          v-for="(m, i) in messageEdits"
          :key="i"
          class="border border-gray-200 rounded-4 p-3 bg-white transition-all duration-200 ease-soft hover:shadow-elevate"
        >
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="text-xs text-black/60">{{ t('detail.character.messages.messageNum', { num: i + 1 }) }} · {{ t('detail.character.messages.charCount') }}：{{ (m || '').length }}</div>
            <div class="flex items-center gap-2">
              <template v-if="editingMsgIndex === i">
                <button
                  class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100"
                  @click="onSaveMsg(i)"
                >{{ t('common.save') }}</button>
                <button
                  class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100"
                  @click="onCancelMsg(i)"
                >{{ t('common.cancel') }}</button>
              </template>
              <template v-else>
                <button
                  class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100"
                  @click="onEditMsg(i)"
                >{{ t('common.edit') }}</button>
                <button
                  class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100"
                  @click="removeMessage(i)"
                >{{ t('common.delete') }}</button>
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
          <h3 class="text-base font-semibold text-black">{{ t('detail.character.worldBook.title') }}</h3>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="newWbId"
            :placeholder="t('detail.character.worldBook.idPlaceholder')"
            class="w-32 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          <input
            v-model="newWbName"
            :placeholder="t('detail.character.worldBook.namePlaceholder')"
            class="w-40 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          <button
            class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
            @click="addWorldEntry"
          >
            {{ t('common.add') }}
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
            'dragging-item': draggingWb && String(draggingWb.id) === String(w.id),
            'drag-over-top': dragOverWbId && String(dragOverWbId) === String(w.id) && dragOverWbBefore,
            'drag-over-bottom': dragOverWbId && String(dragOverWbId) === String(w.id) && !dragOverWbBefore
          }"
          :data-wb-id="w.id"
        >
          <div
            class="w-6 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
            @mousedown="startWbDrag(w.id, $event)"
            :title="t('detail.preset.prompts.dragToSort')"
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
      </div>

      <div v-if="(currentData.world_book?.entries || []).length === 0" class="text-center py-8 text-black/50 text-sm">
        {{ t('detail.character.worldBook.empty') }}
      </div>
    </div>

    <!-- 内嵌正则规则 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <i data-lucide="code" class="w-4 h-4 text-black"></i>
          <h3 class="text-base font-semibold text-black">{{ t('detail.character.regexRules.title') }}</h3>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="newRuleId"
            :placeholder="t('detail.character.regexRules.idPlaceholder')"
            class="w-32 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          <input
            v-model="newRuleName"
            :placeholder="t('detail.character.regexRules.namePlaceholder')"
            class="w-40 px-3 py-2 border border-gray-300 rounded-4 text-xs focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          <button
            class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
            @click="addRegexRule"
          >
            {{ t('common.add') }}
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
            'dragging-item': draggingRx && String(draggingRx.id) === String(r.id),
            'drag-over-top': dragOverRxId && String(dragOverRxId) === String(r.id) && dragOverRxBefore,
            'drag-over-bottom': dragOverRxId && String(dragOverRxId) === String(r.id) && !dragOverRxBefore
          }"
          :data-rule-id="r.id"
        >
          <div
            class="w-6 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
            @mousedown="startRxDrag(r.id, $event)"
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
        {{ t('detail.character.regexRules.empty') }}
      </div>
    </div>
  </section>
</template>

<style scoped>
@import './shared-detail-styles.css';
</style>