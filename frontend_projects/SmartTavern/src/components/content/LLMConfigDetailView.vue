<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'
import Host from '@/workflow/core/host'
import * as Catalog from '@/workflow/channels/catalog'

const props = defineProps({
  llmConfigData: { type: Object, default: null },
  file: { type: String, default: '' }
})

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
    customParamsError.value = 'JSON 格式错误'
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
    geminiSafetyError.value = 'JSON 格式错误'
  }
  
  // Gemini customParams
  geminiCustomError.value = ''
  try {
    currentData.value.gemini_config.customParams = JSON.parse(geminiCustomParamsStr.value || '{}')
  } catch (e) {
    geminiCustomError.value = 'JSON 格式错误'
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
onMounted(() => {
  initJsonStrings()
  window.lucide?.createIcons?.()
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
    try { alert('缺少文件路径，无法保存'); } catch (_) {}
    return
  }
  
  // 解析 JSON 字符串
  parseJsonStrings()
  
  // 检查是否有JSON错误
  if (customParamsError.value || geminiSafetyError.value || geminiCustomError.value) {
    try { alert('请修正 JSON 格式错误后再保存'); } catch (_) {}
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
    custom_params: currentData.value.custom_params,
    gemini_config: currentData.value.gemini_config,
    anthropic_config: currentData.value.anthropic_config
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
    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  
  const offFail = Host.events.on(Catalog.EVT_CATALOG_LLMCONFIG_UPDATE_FAIL, ({ file: resFile, message, tag: resTag }) => {
    if (resFile && resFile !== file) return
    if (resTag && resTag !== tag) return
    console.error('[LLMConfigDetailView] 保存失败（事件）:', message)
    try { alert('保存失败：' + message) } catch (_) {}
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
          <h2 class="text-lg font-bold text-black">{{ currentData.name || 'AI配置详情' }}</h2>
        </div>
        <div class="flex items-center gap-2">
          <!-- 保存状态：左侧提示区 -->
          <div class="save-indicator min-w-[72px] h-7 flex items-center justify-center">
            <span v-if="saving" class="save-spinner" aria-label="保存中"></span>
            <span v-else-if="savedOk" class="save-done"><strong>已保存！</strong></span>
          </div>
          <button
            type="button"
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft disabled:opacity-50"
            :disabled="saving"
            @click="save"
            title="保存到后端"
          >保存</button>
          <div class="px-3 py-1 rounded-4 bg-gray-100 border border-gray-300 text-black text-sm">
            编辑模式
          </div>
        </div>
      </div>
      <p class="mt-2 text-xs text-black/60">此页面支持完整编辑AI配置参数</p>
    </div>

    <!-- 基本信息 -->
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

    <!-- 基础配置 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="plug" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">基础配置</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-black mb-2">Provider</label>
          <select v-model="currentData.provider" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800">
            <option v-for="p in providers" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">Base URL</label>
          <input v-model="currentData.base_url" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" placeholder="https://api.openai.com/v1" />
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">API Key</label>
          <input v-model="currentData.api_key" type="password" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" placeholder="sk-..." />
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">模型(model)</label>
          <div class="relative flex gap-2">
            <input
              v-model="currentData.model"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
              placeholder="如 gpt-4o-mini"
            />
            <button
              type="button"
              class="px-3 py-2 border border-gray-300 rounded-4 bg-gray-50 hover:bg-gray-100"
              @click="toggleModelDropdown"
              title="选择模型"
            >
              <i data-lucide="chevron-down" class="w-4 h-4"></i>
            </button>
            <div v-if="showModelDropdown" class="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-300 rounded-4 shadow-lg z-10 max-h-64 overflow-y-auto">
              <div class="p-2 border-b border-gray-200 text-xs text-gray-600">
                选择模型（占位）
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
        <h3 class="text-base font-semibold text-black">请求参数</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-black">max_tokens</label>
            <label class="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" v-model="apiToggles.max_tokens" class="w-4 h-4" />
              <span>启用</span>
            </label>
          </div>
          <input v-model.number="currentData.max_tokens" type="number" min="1" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" :disabled="!apiToggles.max_tokens" />
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-black">temperature</label>
            <label class="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" v-model="apiToggles.temperature" class="w-4 h-4" />
              <span>启用</span>
            </label>
          </div>
          <input v-model.number="currentData.temperature" type="number" step="0.01" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" :disabled="!apiToggles.temperature" />
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-black">top_p</label>
            <label class="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" v-model="apiToggles.top_p" class="w-4 h-4" />
              <span>启用</span>
            </label>
          </div>
          <input v-model.number="currentData.top_p" type="number" step="0.01" min="0" max="1" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" :disabled="!apiToggles.top_p" />
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-black">presence_penalty</label>
            <label class="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" v-model="apiToggles.presence_penalty" class="w-4 h-4" />
              <span>启用</span>
            </label>
          </div>
          <input v-model.number="currentData.presence_penalty" type="number" step="0.01" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" :disabled="!apiToggles.presence_penalty" />
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-black">frequency_penalty</label>
            <label class="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" v-model="apiToggles.frequency_penalty" class="w-4 h-4" />
              <span>启用</span>
            </label>
          </div>
          <input v-model.number="currentData.frequency_penalty" type="number" step="0.01" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" :disabled="!apiToggles.frequency_penalty" />
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-black">流式输出</label>
            <label class="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" v-model="apiToggles.stream" class="w-4 h-4" />
              <span>启用</span>
            </label>
          </div>
          <label class="inline-flex items-center gap-2">
            <input type="checkbox" v-model="currentData.stream" :disabled="!apiToggles.stream" class="w-5 h-5" />
            <span class="text-sm">开启</span>
          </label>
        </div>
      </div>
    </div>

    <!-- 网络与日志 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="network" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">网络与日志</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-black mb-2">连接超时（秒）</label>
          <input v-model.number="currentData.connect_timeout" type="number" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" />
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">请求超时（秒）</label>
          <input v-model.number="currentData.timeout" type="number" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" />
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">启用日志</label>
          <label class="inline-flex items-center gap-2">
            <input type="checkbox" v-model="currentData.enable_logging" class="w-5 h-5" />
            <span class="text-sm">开启</span>
          </label>
        </div>
      </div>
    </div>

    <!-- 自定义参数 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="code" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">自定义参数（JSON）</h3>
      </div>
      <div>
        <label class="block text-sm font-medium text-black mb-2">custom_params</label>
        <textarea
          v-model="customParamsStr"
          rows="4"
          class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-800"
          placeholder='{"key": "value"}'
        ></textarea>
        <p class="mt-2 text-xs text-black/60">输入 JSON 格式的自定义参数，将合并到请求中</p>
        <p v-if="customParamsError" class="mt-1 text-xs text-red-600">{{ customParamsError }}</p>
      </div>
    </div>

    <!-- Gemini 高级配置 -->
    <div v-if="showGemini" class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="orbit" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">Gemini 高级配置</h3>
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
          <label class="block text-sm font-medium text-black mb-2">stopSequences (逗号分隔)</label>
          <input v-model="geminiStopSequencesStr" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" placeholder="stop1, stop2" />
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">responseMimeType</label>
          <input v-model="currentData.gemini_config.responseMimeType" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" placeholder="text/plain" />
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">safetySettings (JSON)</label>
          <textarea v-model="geminiSafetySettingsStr" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-800" placeholder='{"HARASSMENT": "BLOCK_MEDIUM_AND_ABOVE"}'></textarea>
          <p v-if="geminiSafetyError" class="mt-1 text-xs text-red-600">{{ geminiSafetyError }}</p>
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">customParams (JSON)</label>
          <textarea v-model="geminiCustomParamsStr" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-800" placeholder='{"responseLogprobs": false}'></textarea>
          <p v-if="geminiCustomError" class="mt-1 text-xs text-red-600">{{ geminiCustomError }}</p>
        </div>
      </div>
    </div>

    <!-- Anthropic 高级配置 -->
    <div v-if="showAnthropic" class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="brain" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">Anthropic 高级配置</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">stop_sequences (逗号分隔)</label>
          <input v-model="anthropicStopSequencesStr" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" placeholder="stop1, stop2" />
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">enable_thinking</label>
          <label class="inline-flex items-center gap-2">
            <input type="checkbox" v-model="currentData.anthropic_config.enable_thinking" class="w-5 h-5" />
            <span class="text-sm">启用</span>
          </label>
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">thinking_budget</label>
          <input v-model.number="currentData.anthropic_config.thinking_budget" type="number" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" :disabled="!currentData.anthropic_config.enable_thinking" />
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

/* 深色主题适配 */
[data-theme="dark"] .bg-white {
  background-color: rgb(23, 27, 36) !important;
}

[data-theme="dark"] .bg-gray-50 {
  background-color: rgb(33, 39, 52) !important;
}

[data-theme="dark"] .bg-gray-100 {
  background-color: rgb(33, 39, 52) !important;
}

[data-theme="dark"] .text-black {
  color: rgb(232, 236, 244) !important;
}

[data-theme="dark"] .text-black\/60 {
  color: rgba(232, 236, 244, 0.6) !important;
}

[data-theme="dark"] .border-gray-200 {
  border-color: rgb(45, 54, 70) !important;
}

[data-theme="dark"] .border-gray-300 {
  border-color: rgb(55, 64, 80) !important;
}

[data-theme="dark"] .border-gray-900 {
  border-color: rgb(200, 205, 215) !important;
}

[data-theme="dark"] .hover\:bg-gray-100:hover {
  background-color: rgb(33, 39, 52) !important;
}
</style>