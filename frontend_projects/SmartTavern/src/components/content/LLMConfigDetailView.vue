<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'
import Host from '@/workflow/core/host'
import * as Catalog from '@/workflow/channels/catalog'
import { useI18n } from '@/locales'
import DataCatalog from '@/services/dataCatalog'

const { t } = useI18n()

const props = defineProps({
  llmConfigData: { type: Object, default: null },
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
  
  const iconPath = props.file.replace(/llm_config\.json$/, 'icon.png')
  
  try {
    const { blob, mime } = await DataCatalog.getDataAssetBlob(iconPath)
    if (blob.size > 0 && mime.startsWith('image/')) {
      iconPreviewUrl.value = URL.createObjectURL(blob)
      iconLoadedFromServer.value = true
    }
  } catch (err) {
    console.debug('[LLMConfigDetailView] No existing icon or failed to load:', err)
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

/* 默认配置（非演示数据） */
const DEFAULT_GEMINI_CONFIG = {
  topP: 1.0,
  maxOutputTokens: 2048,
  topK: null,
  candidateCount: null,
  stopSequences: [],
  responseMimeType: '',
  safetySettings: {},
  customParams: {}
}
const DEFAULT_ANTHROPIC_CONFIG = {
  stop_sequences: [],
  enable_thinking: false,
  thinking_budget: 16000
}
const DEFAULT_LLM_CONFIG = {
  name: '',
  description: '',
  provider: 'openai',
  base_url: '',
  api_key: '',
  model: '',
  max_tokens: 2048,
  temperature: 0.7,
  top_p: 1.0,
  presence_penalty: 0,
  frequency_penalty: 0,
  stream: false,
  timeout: 60,
  connect_timeout: 10,
  enable_logging: false,
  custom_params: {},
  gemini_config: DEFAULT_GEMINI_CONFIG,
  anthropic_config: DEFAULT_ANTHROPIC_CONFIG
}

/** 深拷贝 */
function deepClone(x) { return JSON.parse(JSON.stringify(x)) }

/** 规范化后端/外部传入的配置结构 */
function normalizeLLMConfigData(src) {
  if (!src || typeof src !== 'object') return null
  return {
    name: src.name || 'AI配置',
    description: src.description || '',
    provider: src.provider || 'openai',
    base_url: src.base_url || 'https://api.openai.com/v1',
    api_key: src.api_key || '',
    model: src.model || src.model_id || '',
    max_tokens: src.max_tokens ?? 2048,
    temperature: src.temperature ?? 0.7,
    top_p: src.top_p ?? 1.0,
    presence_penalty: src.presence_penalty ?? 0,
    frequency_penalty: src.frequency_penalty ?? 0,
    stream: src.stream ?? false,
    timeout: src.timeout ?? 60,
    connect_timeout: src.connect_timeout ?? 10,
    enable_logging: src.enable_logging ?? false,
    custom_params: src.custom_params || {},
    gemini_config: src.gemini_config || DEFAULT_GEMINI_CONFIG,
    anthropic_config: src.anthropic_config || DEFAULT_ANTHROPIC_CONFIG
  }
}

// 当前编辑的数据（内存中）
const currentData = ref(
  deepClone(
    normalizeLLMConfigData(props.llmConfigData) || DEFAULT_LLM_CONFIG
  )
)

// 外部数据变更时同步
watch(() => props.llmConfigData, async (v) => {
  currentData.value = deepClone(normalizeLLMConfigData(v) || DEFAULT_LLM_CONFIG)
  initJsonStrings()
  await loadExistingIcon()
  await nextTick()
  window.lucide?.createIcons?.()
})

// 可用的 providers
const providers = ['openai', 'anthropic', 'gemini', 'openai_compatible', 'custom']

// 请求参数启用开关
const apiToggleKeys = ['max_tokens', 'temperature', 'top_p', 'presence_penalty', 'frequency_penalty', 'stream']
const apiToggles = reactive(Object.fromEntries(apiToggleKeys.map(k => [k, true])))

const showGemini = computed(() => currentData.value.provider === 'gemini')
const showAnthropic = computed(() => currentData.value.provider === 'anthropic')

// 自定义参数 JSON 字符串（双向绑定）
const customParamsStr = ref('')
const customParamsError = ref('')

// Gemini 配置 JSON 字符串
const geminiStopSequencesStr = ref('')
const geminiSafetySettingsStr = ref('')
const geminiSafetyError = ref('')
const geminiCustomParamsStr = ref('')
const geminiCustomError = ref('')

// Anthropic 配置字符串
const anthropicStopSequencesStr = ref('')

// 初始化 JSON 字符串
function initJsonStrings() {
  try {
    customParamsStr.value = JSON.stringify(currentData.value.custom_params || {}, null, 2)
  } catch {
    customParamsStr.value = '{}'
  }
  
  // Gemini
  geminiStopSequencesStr.value = (currentData.value.gemini_config.stopSequences || []).join(', ')
  try {
    geminiSafetySettingsStr.value = JSON.stringify(currentData.value.gemini_config.safetySettings || {}, null, 2)
  } catch {
    geminiSafetySettingsStr.value = '{}'
  }
  try {
    geminiCustomParamsStr.value = JSON.stringify(currentData.value.gemini_config.customParams || {}, null, 2)
  } catch {
    geminiCustomParamsStr.value = '{}'
  }
  
  // Anthropic
  anthropicStopSequencesStr.value = (currentData.value.anthropic_config.stop_sequences || []).join(', ')
}

// 解析 JSON 字符串并更新数据
function parseJsonStrings() {
  // custom_params
  customParamsError.value = ''
  try {
    currentData.value.custom_params = JSON.parse(customParamsStr.value || '{}')
  } catch (e) {
    customParamsError.value = t('detail.llmConfig.errors.jsonFormatError')
  }
  
  // Gemini stopSequences
  currentData.value.gemini_config.stopSequences = geminiStopSequencesStr.value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  
  // Gemini safetySettings
  geminiSafetyError.value = ''
  try {
    currentData.value.gemini_config.safetySettings = JSON.parse(geminiSafetySettingsStr.value || '{}')
  } catch (e) {
    geminiSafetyError.value = t('detail.llmConfig.errors.jsonFormatError')
  }
  
  // Gemini customParams
  geminiCustomError.value = ''
  try {
    currentData.value.gemini_config.customParams = JSON.parse(geminiCustomParamsStr.value || '{}')
  } catch (e) {
    geminiCustomError.value = t('detail.llmConfig.errors.jsonFormatError')
  }
  
  // Anthropic stop_sequences
  currentData.value.anthropic_config.stop_sequences = anthropicStopSequencesStr.value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

// 模型列表下拉
const showModelDropdown = ref(false)
const modelListPlaceholder = ref([
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro'
])

function selectModel(modelId) {
  currentData.value.model = modelId
  showModelDropdown.value = false
}

function toggleModelDropdown() {
  showModelDropdown.value = !showModelDropdown.value
}

// 保存状态提示
const saving = ref(false)
const savedOk = ref(false)
let __saveTimer = null

// 初始化
onMounted(async () => {
  initJsonStrings()
  window.lucide?.createIcons?.()
  await loadExistingIcon()
})

watch(() => currentData.value, async () => {
  await nextTick()
  window.lucide?.createIcons?.()
}, { deep: true, flush: 'post' })

const __eventOffs = [] // 事件监听清理器

onBeforeUnmount(() => {
  try {
    __eventOffs?.forEach(fn => { try { fn?.() } catch (_) {} })
    __eventOffs.length = 0
  } catch (_) {}
})

/** 保存：将当前编辑内容写回后端文件（事件驱动） */
async function save() {
  const file = props.file
  if (!file) {
    try { alert(t('error.missingFilePath')); } catch (_) {}
    return
  }
  
  // 解析 JSON 字符串
  parseJsonStrings()
  
  // 检查是否有JSON错误
  if (customParamsError.value || geminiSafetyError.value || geminiCustomError.value) {
    try { alert(t('detail.llmConfig.errors.fixJsonErrors')); } catch (_) {}
    return
  }
  
  // 构建保存内容
  const payloadContent = {
    name: currentData.value.name || '',
    description: currentData.value.description || '',
    provider: currentData.value.provider,
    base_url: currentData.value.base_url,
    api_key: currentData.value.api_key,
    model: currentData.value.model,
    max_tokens: currentData.value.max_tokens,
    temperature: currentData.value.temperature,
    top_p: currentData.value.top_p,
    presence_penalty: currentData.value.presence_penalty,
    frequency_penalty: currentData.value.frequency_penalty,
    stream: currentData.value.stream,
    timeout: currentData.value.timeout,
    connect_timeout: currentData.value.connect_timeout,
    enable_logging: currentData.value.enable_logging,
    custom_params: currentData.value.custom_params
  }
  
  // 根据 provider 条件性地添加特定配置
  if (currentData.value.provider === 'gemini') {
    payloadContent.gemini_config = currentData.value.gemini_config
  }
  if (currentData.value.provider === 'anthropic') {
    payloadContent.anthropic_config = currentData.value.anthropic_config
  }
  
  // 处理图标
  let iconBase64 = undefined
  if (iconFile.value) {
    try {
      iconBase64 = await fileToBase64(iconFile.value)
    } catch (err) {
      console.error('[LLMConfigDetailView] Icon conversion failed:', err)
    }
  } else if (iconDeleted.value && iconLoadedFromServer.value) {
    iconBase64 = ''
  }
  
  // 可视提示
  saving.value = true
  savedOk.value = false
  if (__saveTimer) { try { clearTimeout(__saveTimer) } catch {} __saveTimer = null }
  
  const tag = `llmconfig_save_${Date.now()}`
  
  // 监听保存结果（一次性）
  const offOk = Host.events.on(Catalog.EVT_CATALOG_LLMCONFIG_UPDATE_OK, ({ file: resFile, tag: resTag }) => {
    if (resFile !== file || resTag !== tag) return
    console.log('[LLMConfigDetailView] 保存成功（事件）')
    savedOk.value = true
    saving.value = false
    if (savedOk.value) {
      __saveTimer = setTimeout(() => { savedOk.value = false }, 1800)
    }
    
    // 保存成功后，刷新侧边栏列表
    try {
      console.log('[LLMConfigDetailView] 刷新LLM配置列表')
      Host.events.emit(Catalog.EVT_CATALOG_LLMCONFIGS_REQ, {
        requestId: Date.now()
      })
    } catch (err) {
      console.warn('[LLMConfigDetailView] 刷新LLM配置列表失败:', err)
    }
    
    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  
  const offFail = Host.events.on(Catalog.EVT_CATALOG_LLMCONFIG_UPDATE_FAIL, ({ file: resFile, message, tag: resTag }) => {
    if (resFile && resFile !== file) return
    if (resTag && resTag !== tag) return
    console.error('[LLMConfigDetailView] 保存失败（事件）:', message)
    try { alert(t('detail.llmConfig.saveFailed') + '：' + message) } catch (_) {}
    saving.value = false
    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  
  __eventOffs.push(offOk, offFail)
  
  // 发送保存请求事件
  Host.events.emit(Catalog.EVT_CATALOG_LLMCONFIG_UPDATE_REQ, {
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
          <i data-lucide="plug" class="w-5 h-5 text-black"></i>
          <h2 class="text-lg font-bold text-black">{{ currentData.name || t('detail.llmConfig.title') }}</h2>
        </div>
        <div class="flex items-center gap-2">
          <!-- 保存状态：左侧提示区 -->
          <div class="save-indicator min-w-[72px] h-7 flex items-center justify-center">
            <span v-if="saving" class="save-spinner" :aria-label="t('common.saving')"></span>
            <span v-else-if="savedOk" class="save-done"><strong>{{ t('common.saved') }}</strong></span>
          </div>
          <button
            type="button"
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft disabled:opacity-50"
            :disabled="saving"
            @click="save"
            :title="t('detail.preset.saveToBackend')"
          >{{ t('common.save') }}</button>
          <div class="px-3 py-1 rounded-4 bg-gray-100 border border-gray-300 text-black text-sm">
            {{ t('detail.llmConfig.editMode') }}
          </div>
        </div>
      </div>
      <p class="mt-2 text-xs text-black/60">{{ t('detail.llmConfig.editHint') }}</p>
    </div>

    <!-- 基本信息 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="id-card" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.llmConfig.basicInfo') }}</h3>
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

    <!-- 基础配置 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="plug" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.llmConfig.baseConfig') }}</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.llmConfig.provider') }}</label>
          <select v-model="currentData.provider" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800">
            <option v-for="p in providers" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.llmConfig.baseUrl') }}</label>
          <input v-model="currentData.base_url" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" placeholder="https://api.openai.com/v1" />
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.llmConfig.apiKey') }}</label>
          <input v-model="currentData.api_key" type="password" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" placeholder="sk-..." />
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.llmConfig.model') }}</label>
          <div class="relative flex gap-2">
            <input
              v-model="currentData.model"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
              :placeholder="t('detail.llmConfig.modelPlaceholder')"
            />
            <button
              type="button"
              class="px-3 py-2 border border-gray-300 rounded-4 bg-gray-50 hover:bg-gray-100"
              @click="toggleModelDropdown"
              :title="t('detail.llmConfig.selectModel')"
            >
              <i data-lucide="chevron-down" class="w-4 h-4"></i>
            </button>
            <div v-if="showModelDropdown" class="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-300 rounded-4 shadow-lg z-10 max-h-64 overflow-y-auto">
              <div class="p-2 border-b border-gray-200 text-xs text-gray-600">
                {{ t('detail.llmConfig.modelListPlaceholder') }}
              </div>
              <div
                v-for="model in modelListPlaceholder"
                :key="model"
                class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                @click="selectModel(model)"
              >
                {{ model }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 请求参数 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="sliders-horizontal" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.llmConfig.requestParams.title') }}</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-black">{{ t('detail.llmConfig.requestParams.maxTokens') }}</label>
            <label class="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" v-model="apiToggles.max_tokens" class="w-4 h-4" />
              <span>{{ t('common.enable') }}</span>
            </label>
          </div>
          <input v-model.number="currentData.max_tokens" type="number" min="1" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" :disabled="!apiToggles.max_tokens" />
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-black">{{ t('detail.llmConfig.requestParams.temperature') }}</label>
            <label class="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" v-model="apiToggles.temperature" class="w-4 h-4" />
              <span>{{ t('common.enable') }}</span>
            </label>
          </div>
          <input v-model.number="currentData.temperature" type="number" step="0.01" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" :disabled="!apiToggles.temperature" />
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-black">{{ t('detail.llmConfig.requestParams.topP') }}</label>
            <label class="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" v-model="apiToggles.top_p" class="w-4 h-4" />
              <span>{{ t('common.enable') }}</span>
            </label>
          </div>
          <input v-model.number="currentData.top_p" type="number" step="0.01" min="0" max="1" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" :disabled="!apiToggles.top_p" />
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-black">{{ t('detail.llmConfig.requestParams.presencePenalty') }}</label>
            <label class="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" v-model="apiToggles.presence_penalty" class="w-4 h-4" />
              <span>{{ t('common.enable') }}</span>
            </label>
          </div>
          <input v-model.number="currentData.presence_penalty" type="number" step="0.01" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" :disabled="!apiToggles.presence_penalty" />
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-black">{{ t('detail.llmConfig.requestParams.frequencyPenalty') }}</label>
            <label class="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" v-model="apiToggles.frequency_penalty" class="w-4 h-4" />
              <span>{{ t('common.enable') }}</span>
            </label>
          </div>
          <input v-model.number="currentData.frequency_penalty" type="number" step="0.01" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" :disabled="!apiToggles.frequency_penalty" />
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-black">{{ t('detail.llmConfig.requestParams.stream') }}</label>
            <label class="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" v-model="apiToggles.stream" class="w-4 h-4" />
              <span>{{ t('common.enable') }}</span>
            </label>
          </div>
          <label class="inline-flex items-center gap-2">
            <input type="checkbox" v-model="currentData.stream" :disabled="!apiToggles.stream" class="w-5 h-5" />
            <span class="text-sm">{{ t('detail.llmConfig.requestParams.on') }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- 网络与日志 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="network" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.llmConfig.network.title') }}</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.llmConfig.network.connectTimeout') }}</label>
          <input v-model.number="currentData.connect_timeout" type="number" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" />
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.llmConfig.network.requestTimeout') }}</label>
          <input v-model.number="currentData.timeout" type="number" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" />
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.llmConfig.network.enableLogging') }}</label>
          <label class="inline-flex items-center gap-2">
            <input type="checkbox" v-model="currentData.enable_logging" class="w-5 h-5" />
            <span class="text-sm">{{ t('detail.llmConfig.requestParams.on') }}</span>
          </label>
        </div>
      </div>
    </div>

    <!-- 自定义参数 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="code" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.llmConfig.customParams.title') }}</h3>
      </div>
      <div>
        <label class="block text-sm font-medium text-black mb-2">custom_params</label>
        <textarea
          v-model="customParamsStr"
          rows="4"
          class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-800"
          placeholder='{"key": "value"}'
        ></textarea>
        <p class="mt-2 text-xs text-black/60">{{ t('detail.llmConfig.customParams.hint') }}</p>
        <p v-if="customParamsError" class="mt-1 text-xs text-red-600">{{ customParamsError }}</p>
      </div>
    </div>

    <!-- Gemini 高级配置 -->
    <div v-if="showGemini" class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="orbit" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.llmConfig.gemini.title') }}</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-black mb-2">topP</label>
          <input v-model.number="currentData.gemini_config.topP" type="number" step="0.01" min="0" max="1" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" />
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">maxOutputTokens</label>
          <input v-model.number="currentData.gemini_config.maxOutputTokens" type="number" min="1" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" />
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">topK</label>
          <input v-model.number="currentData.gemini_config.topK" type="number" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" />
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">candidateCount</label>
          <input v-model.number="currentData.gemini_config.candidateCount" type="number" min="1" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" />
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.llmConfig.gemini.stopSequences') }}</label>
          <input v-model="geminiStopSequencesStr" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" placeholder="stop1, stop2" />
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">responseMimeType</label>
          <input v-model="currentData.gemini_config.responseMimeType" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" placeholder="text/plain" />
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.llmConfig.gemini.safetySettings') }}</label>
          <textarea v-model="geminiSafetySettingsStr" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-800" placeholder='{"HARASSMENT": "BLOCK_MEDIUM_AND_ABOVE"}'></textarea>
          <p v-if="geminiSafetyError" class="mt-1 text-xs text-red-600">{{ geminiSafetyError }}</p>
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.llmConfig.gemini.customParams') }}</label>
          <textarea v-model="geminiCustomParamsStr" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-800" placeholder='{"responseLogprobs": false}'></textarea>
          <p v-if="geminiCustomError" class="mt-1 text-xs text-red-600">{{ geminiCustomError }}</p>
        </div>
      </div>
    </div>

    <!-- Anthropic 高级配置 -->
    <div v-if="showAnthropic" class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="brain" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.llmConfig.anthropic.title') }}</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.llmConfig.anthropic.stopSequences') }}</label>
          <input v-model="anthropicStopSequencesStr" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" placeholder="stop1, stop2" />
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.llmConfig.anthropic.enableThinking') }}</label>
          <label class="inline-flex items-center gap-2">
            <input type="checkbox" v-model="currentData.anthropic_config.enable_thinking" class="w-5 h-5" />
            <span class="text-sm">{{ t('common.enable') }}</span>
          </label>
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.llmConfig.anthropic.thinkingBudget') }}</label>
          <input v-model.number="currentData.anthropic_config.thinking_budget" type="number" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" :disabled="!currentData.anthropic_config.enable_thinking" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
@import './shared-detail-styles.css';
</style>