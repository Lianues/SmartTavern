<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import PresetPromptCard from './cards/PresetPromptCard.vue'
import RegexRuleCard from './cards/RegexRuleCard.vue'
import Host from '@/workflow/core/host'
import * as Catalog from '@/workflow/channels/catalog'
import { useI18n } from '@/locales'
import { usePresetStore } from '@/stores/preset'
import { useChatSettingsStore } from '@/stores/chatSettings'

const { t } = useI18n()

const props = defineProps({
  presetData: { type: Object, default: null },
  file: { type: String, default: '' }
})

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
  await nextTick()
  window.lucide?.createIcons?.()
})

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

// 拖拽排序（Relative / In-Chat）
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

function onDragStart(position, id, ev) {
  dragging.value = { position, id }
  try {
    ev.dataTransfer?.setData('text/plain', id)
    ev.dataTransfer.effectAllowed = 'move'
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    ev.dataTransfer?.setDragImage(canvas, 0, 0)
  } catch {}
}

function onDragOver(position, overId, ev) {
  if (dragging.value?.position !== position) return
  ev.preventDefault()
  
  // 启动自动滚动
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

function onDrop(position, overId, ev) {
  if (dragging.value?.position !== position) return
  ev.preventDefault()
  const dId = dragging.value.id
  const list = position === 'relative' ? [...relativePrompts.value] : [...inChatPrompts.value]
  let ids = list.map(i => i.identifier)
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
  // 重新排列
  const allPrompts = currentData.value.prompts || []
  const otherPrompts = allPrompts.filter(p => p.position !== position)
  const reordered = ids.map(id => allPrompts.find(p => p.identifier === id)).filter(Boolean)
  currentData.value.prompts = [...otherPrompts, ...reordered]
  
  dragging.value = null
  dragOverId.value = null
  window.lucide?.createIcons?.()
}

function onDropEnd(position, ev) {
  onDrop(position, null, ev)
}

function onDragEnd() {
  stopAutoScroll()
  dragging.value = null
  dragOverId.value = null
}

// 正则规则拖拽排序
const draggingRegex = ref(null)
const dragOverRegexId = ref(null)
const dragOverRegexBefore = ref(true)

function onRegexDragStart(id, ev) {
  draggingRegex.value = id
  try {
    ev.dataTransfer?.setData('text/plain', id)
    ev.dataTransfer.effectAllowed = 'move'
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    ev.dataTransfer?.setDragImage(canvas, 0, 0)
  } catch {}
}

function onRegexDragOver(overId, ev) {
  if (!draggingRegex.value) return
  ev.preventDefault()
  
  // 启动自动滚动
  startAutoScroll(ev)
  
  try {
    const el = ev.currentTarget
    if (el) {
      const rect = el.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      dragOverRegexBefore.value = ev.clientY < mid
    }
  } catch {}
  dragOverRegexId.value = overId
}

function onRegexDrop(overId, ev) {
  if (!draggingRegex.value) return
  ev.preventDefault()
  const dId = draggingRegex.value
  const list = [...(currentData.value.regex_rules || [])]
  let ids = list.map(i => i.id)
  const fromIdx = ids.indexOf(dId)
  if (fromIdx < 0) return
  ids.splice(fromIdx, 1)
  if (overId && overId !== dId) {
    const toIdx = ids.indexOf(overId)
    let insertIdx = toIdx < 0 ? ids.length : toIdx + (dragOverRegexBefore.value ? 0 : 1)
    if (insertIdx < 0) insertIdx = 0
    if (insertIdx > ids.length) insertIdx = ids.length
    ids.splice(insertIdx, 0, dId)
  } else {
    ids.push(dId)
  }
  currentData.value.regex_rules = ids.map(id => list.find(r => r.id === id)).filter(Boolean)
  draggingRegex.value = null
  dragOverRegexId.value = null
  window.lucide?.createIcons?.()
}

function onRegexDropEnd(ev) {
  onRegexDrop(null, ev)
}

function onRegexDragEnd() {
  stopAutoScroll()
  draggingRegex.value = null
  dragOverRegexId.value = null
}

// 初始化 Lucide 图标
onMounted(() => {
  window.lucide?.createIcons?.()
  // 初次挂载时根据当前数据同步 per-field 开关
  try { syncApiTogglesFromData() } catch {}
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

    <!-- 基本信息（名称/描述） -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="id-card" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.preset.basicInfo') }}</h3>
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
                      'dragging-item': dragging && dragging.id === it.identifier && dragging.position === 'relative',
                      'drag-over-top': dragging && dragOverId === it.identifier && dragging.position === 'relative' && dragOverBefore,
                      'drag-over-bottom': dragging && dragOverId === it.identifier && dragging.position === 'relative' && !dragOverBefore
                    }"
                    @dragover.prevent="onDragOver('relative', it.identifier, $event)"
                    @drop.prevent="onDrop('relative', it.identifier, $event)"
                  >
                    <div
                      class="w-6 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
                      draggable="true"
                      @dragstart="onDragStart('relative', it.identifier, $event)"
                      @dragend="onDragEnd"
                      :title="t('detail.preset.prompts.dragToSort')"
                    >
                      <i data-lucide="grip-vertical" class="icon-grip w-4 h-4 text-black opacity-60 group-hover:opacity-100"></i>
                    </div>
                    <div class="flex-1">
                      <PresetPromptCard 
                        :item="it" 
                        @update="onPromptUpdate"
                        @delete="onPromptDelete"
                      />
                    </div>
                  </div>
                  <div
                    class="h-3 draglist-end"
                    :class="{ 'drag-over-end': dragging && dragOverId === null && dragging.position === 'relative' }"
                    @dragover.prevent="onDragOver('relative', null, $event)"
                    @drop.prevent="onDropEnd('relative', $event)"
                  />
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
                      'dragging-item': dragging && dragging.id === it.identifier && dragging.position === 'in-chat',
                      'drag-over-top': dragging && dragOverId === it.identifier && dragging.position === 'in-chat' && dragOverBefore,
                      'drag-over-bottom': dragging && dragOverId === it.identifier && dragging.position === 'in-chat' && !dragOverBefore
                    }"
                    @dragover.prevent="onDragOver('in-chat', it.identifier, $event)"
                    @drop.prevent="onDrop('in-chat', it.identifier, $event)"
                  >
                    <div
                      class="w-6 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
                      draggable="true"
                      @dragstart="onDragStart('in-chat', it.identifier, $event)"
                      @dragend="onDragEnd"
                      :title="t('detail.preset.prompts.dragToSort')"
                    >
                      <i data-lucide="grip-vertical" class="icon-grip w-4 h-4 text-black opacity-60 group-hover:opacity-100"></i>
                    </div>
                    <div class="flex-1">
                      <PresetPromptCard
                        :item="it"
                        @update="onPromptUpdate"
                        @delete="onPromptDelete"
                      />
                    </div>
                  </div>
                  <div
                    class="h-3 draglist-end"
                    :class="{ 'drag-over-end': dragging && dragOverId === null && dragging.position === 'in-chat' }"
                    @dragover.prevent="onDragOver('in-chat', null, $event)"
                    @drop.prevent="onDropEnd('in-chat', $event)"
                  />
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
            class="flex items-stretch gap-2 group draglist-item"
            :class="{
              'dragging-item': draggingRegex && draggingRegex === r.id,
              'drag-over-top': draggingRegex && dragOverRegexId === r.id && dragOverRegexBefore,
              'drag-over-bottom': draggingRegex && dragOverRegexId === r.id && !dragOverRegexBefore
            }"
            @dragover.prevent="onRegexDragOver(r.id, $event)"
            @drop.prevent="onRegexDrop(r.id, $event)"
          >
            <div
              class="w-6 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
              draggable="true"
              @dragstart="onRegexDragStart(r.id, $event)"
              @dragend="onRegexDragEnd"
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
          <div
            class="h-3 draglist-end"
            :class="{ 'drag-over-end': draggingRegex && dragOverRegexId === null }"
            @dragover.prevent="onRegexDragOver(null, $event)"
            @drop.prevent="onRegexDropEnd($event)"
          />
        </div>

        <div v-if="(currentData.regex_rules || []).length === 0" class="text-xs text-black/50 px-1 py-1">
          {{ t('detail.preset.regex.empty') }}
        </div>
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

/* 保存状态样式 */
.save-indicator { min-width: 72px; }
.save-spinner {
  width: 16px; height: 16px; display: inline-block;
  border: 2px solid rgba(17,17,17,0.2);
  border-top-color: #111; border-radius: 9999px;
  animation: st-spin 0.8s linear infinite;
}
[data-theme="dark"] .save-spinner {
  border: 2px solid rgba(232,236,244,0.25);
  border-top-color: rgb(232,236,244);
}
.save-done { font-size: 12px; color: #111; }
[data-theme="dark"] .save-done { color: rgb(232,236,244); }
@keyframes st-spin { to { transform: rotate(360deg); } }

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

[data-theme="dark"] .text-black\/80 {
  color: rgba(235, 235, 240, 0.8) !important;
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

[data-theme="dark"] input:disabled,
[data-theme="dark"] textarea:disabled,
[data-theme="dark"] select:disabled {
  background-color: rgb(28, 28, 30) !important;
  color: rgba(235, 235, 240, 0.4) !important;
}

[data-theme="dark"] select option {
  background-color: rgb(38, 38, 42) !important;
  color: rgb(235, 235, 240) !important;
}

</style>