<script setup>
import { ref, computed, watch, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { useI18n } from '@/locales'
import Host from '@/workflow/core/host'
import * as Catalog from '@/workflow/channels/catalog'
import { usePersonaStore } from '@/stores/persona'
import { useChatSettingsStore } from '@/stores/chatSettings'

const { t } = useI18n()

const props = defineProps({
  personaData: { type: Object, default: null },
  file: { type: String, default: '' }
})


/** 深拷贝 */
function deepClone(x) { return JSON.parse(JSON.stringify(x)) }
/** 规范化 Persona 结构 */
function normalizePersonaData(src) {
  if (!src || typeof src !== 'object') return null
  return {
    name: src.name || '用户',
    description: src.description || ''
  }
}
// 当前编辑的数据（内存中）
const currentData = ref(
  deepClone(
    normalizePersonaData(props.personaData) || { name: '', description: '' }
  )
)
// 外部数据变更时同步
watch(() => props.personaData, async (v) => {
  currentData.value = deepClone(normalizePersonaData(v) || { name: '', description: '' })
  await nextTick()
  window.lucide?.createIcons?.()
})

// 本地草稿
const nameDraft = ref(currentData.value.name || '')
const descDraft = ref(currentData.value.description || '')

// 保存（失焦即时保存）
function saveName() {
  currentData.value.name = nameDraft.value
}

function saveDesc() {
  currentData.value.description = descDraft.value
}

// 重置为当前存储内容
function resetAll() {
  nameDraft.value = currentData.value.name || ''
  descDraft.value = currentData.value.description || ''
  nextTick(() => window.lucide?.createIcons?.())
}

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
  saveName()
  saveDesc()
  
  const content = {
    name: currentData.value.name || '',
    description: currentData.value.description || ''
  }
  
  saving.value = true
  savedOk.value = false
  if (__saveTimer) { try { clearTimeout(__saveTimer) } catch {} __saveTimer = null }
  
  const tag = `persona_save_${Date.now()}`
  
  // 监听保存结果（一次性）
  const offOk = Host.events.on(Catalog.EVT_CATALOG_PERSONA_UPDATE_OK, async ({ file: resFile, tag: resTag }) => {
    if (resFile !== file || resTag !== tag) return
    console.log('[PersonaDetailView] 保存成功（事件）')
    savedOk.value = true
    saving.value = false
    if (savedOk.value) {
      __saveTimer = setTimeout(() => { savedOk.value = false }, 1800)
    }
    
    // 保存成功后，检查是否是当前使用的人设，如果是则刷新 store
    try {
      const chatSettingsStore = useChatSettingsStore()
      const personaStore = usePersonaStore()
      const currentPersonaFile = chatSettingsStore.personaFile
      if (currentPersonaFile && currentPersonaFile === file) {
        console.log('[PersonaDetailView] 刷新人设 store')
        await personaStore.refreshFromPersonaFile(file)
      }
    } catch (err) {
      console.warn('[PersonaDetailView] 刷新人设 store 失败:', err)
    }
    
    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  
  const offFail = Host.events.on(Catalog.EVT_CATALOG_PERSONA_UPDATE_FAIL, ({ file: resFile, message, tag: resTag }) => {
    if (resFile && resFile !== file) return
    if (resTag && resTag !== tag) return
    console.error('[PersonaDetailView] 保存失败（事件）:', message)
    try { alert(t('detail.persona.saveFailed') + '：' + message) } catch (_) {}
    saving.value = false
    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  
  __eventOffs.push(offOk, offFail)
  
  // 发送保存请求事件
  Host.events.emit(Catalog.EVT_CATALOG_PERSONA_UPDATE_REQ, {
    file,
    content,
    name: content.name,
    description: content.description,
    tag
  })
}

// 初始化 Lucide 图标
onMounted(() => {
  window.lucide?.createIcons?.()
})
</script>

<template>
  <section class="space-y-6">
    <!-- 页面标题 -->
    <div class="bg-white rounded-4 card-shadow border border-gray-200 p-6 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <i data-lucide="id-card" class="w-5 h-5 text-black"></i>
          <h2 class="text-lg font-bold text-black">{{ t('detail.persona.pageTitle') }}</h2>
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
            {{ t('detail.persona.editMode') }}
          </div>
        </div>
      </div>
      <p class="mt-2 text-xs text-black/60">{{ t('detail.persona.editHint') }}</p>
    </div>

    <!-- 基本信息 -->
    <div class="bg-white rounded-4 border border-gray-200 p-6 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <i data-lucide="user" class="w-4 h-4 text-black"></i>
          <span class="text-sm font-medium text-black">{{ t('detail.persona.basicInfo') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft text-sm"
            @click="resetAll"
          >
            {{ t('common.reset') }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.persona.userName') }}</label>
          <input
            v-model="nameDraft"
            @blur="saveName"
            type="text"
            :placeholder="t('detail.persona.userNamePlaceholder')"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          <p class="text-xs text-black/50 mt-1">{{ t('detail.persona.currentValue') }}：{{ currentData.name || t('detail.persona.notSet') }}</p>
        </div>

        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.persona.userDesc') }}</label>
          <textarea
            v-model="descDraft"
            @blur="saveDesc"
            rows="6"
            :placeholder="t('detail.persona.userDescPlaceholder')"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          ></textarea>
          <p class="text-xs text-black/50 mt-1">{{ t('detail.persona.charCount') }}：{{ (descDraft || '').length }}</p>
        </div>
      </div>
    </div>

    <!-- 说明 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="info" class="w-4 h-4 text-black"></i>
        <h3 class="text-sm font-semibold text-black">{{ t('detail.persona.notes.title') }}</h3>
      </div>
      <div class="text-xs text-black/60 leading-relaxed space-y-2">
        <p>• {{ t('detail.persona.notes.line1') }}</p>
        <p>• {{ t('detail.persona.notes.line2') }}</p>
        <p>• {{ t('detail.persona.notes.line3') }}</p>
      </div>
    </div>

    <!-- 数据预览 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="eye" class="w-4 h-4 text-black"></i>
        <h3 class="text-sm font-semibold text-black">{{ t('detail.persona.preview.title') }}</h3>
      </div>
      <div class="bg-gray-50 rounded-4 p-4 border border-gray-200">
        <pre class="text-xs text-black/70 font-mono whitespace-pre-wrap">{{ JSON.stringify(currentData, null, 2) }}</pre>
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

/* 深色主题适配 - 使用中性灰色 */
[data-theme="dark"] .bg-white {
  background-color: rgb(28, 28, 30) !important;
}

[data-theme="dark"] .bg-gray-50 {
  background-color: rgb(32, 32, 35) !important;
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

[data-theme="dark"] .text-black\/70 {
  color: rgba(235, 235, 240, 0.7) !important;
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

[data-theme="dark"] select option {
  background-color: rgb(38, 38, 42) !important;
  color: rgb(235, 235, 240) !important;
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

</style>