<script setup>
import { ref, computed, watch, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { useI18n } from '@/locales'
import Host from '@/workflow/core/host'
import * as Catalog from '@/workflow/channels/catalog'
import { usePersonaStore } from '@/stores/persona'
import { useChatSettingsStore } from '@/stores/chatSettings'
import DataCatalog from '@/services/dataCatalog'

const { t } = useI18n()

const props = defineProps({
  personaData: { type: Object, default: null },
  file: { type: String, default: '' }
})

// 图标上传相关
const iconFile = ref(null)
const iconPreviewUrl = ref('')
const iconInputRef = ref(null)
const iconDeleted = ref(false)
const iconLoadedFromServer = ref(false)

const hasIcon = computed(() => !!iconPreviewUrl.value)

// 头像上传相关
const avatarFile = ref(null)
const avatarPreviewUrl = ref('')
const avatarInputRef = ref(null)
const avatarDeleted = ref(false)
const avatarLoadedFromServer = ref(false)

const hasAvatar = computed(() => !!avatarPreviewUrl.value)

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
  
  const iconPath = props.file.replace(/persona\.json$/, 'icon.png')
  
  try {
    const { blob, mime } = await DataCatalog.getDataAssetBlob(iconPath)
    if (blob.size > 0 && mime.startsWith('image/')) {
      iconPreviewUrl.value = URL.createObjectURL(blob)
      iconLoadedFromServer.value = true
    }
  } catch (err) {
    console.debug('[PersonaDetailView] No existing icon or failed to load:', err)
    iconLoadedFromServer.value = false
  }
}

// 头像处理函数
function handleAvatarSelect(e) {
  const file = e.target.files?.[0]
  if (!file) return
  
  if (!file.type.startsWith('image/')) {
    return
  }
  
  avatarFile.value = file
  
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value)
  }
  avatarPreviewUrl.value = URL.createObjectURL(file)
  avatarDeleted.value = false
}

function triggerAvatarSelect() {
  avatarInputRef.value?.click()
}

async function removeAvatar() {
  avatarFile.value = null
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value)
  }
  avatarPreviewUrl.value = ''
  if (avatarInputRef.value) {
    avatarInputRef.value.value = ''
  }
  avatarDeleted.value = true
  await nextTick()
  window.lucide?.createIcons?.()
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
  avatarDeleted.value = false
  avatarLoadedFromServer.value = false
}

async function loadExistingAvatar() {
  resetAvatarPreview()
  
  if (!props.file) return
  
  const avatarPath = props.file.replace(/persona\.json$/, 'persona.png')
  
  try {
    const { blob, mime } = await DataCatalog.getDataAssetBlob(avatarPath)
    if (blob.size > 0 && mime.startsWith('image/')) {
      avatarPreviewUrl.value = URL.createObjectURL(blob)
      avatarLoadedFromServer.value = true
    }
  } catch (err) {
    console.debug('[PersonaDetailView] No existing avatar or failed to load:', err)
    avatarLoadedFromServer.value = false
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


/** 深拷贝 */
function deepClone(x) { return JSON.parse(JSON.stringify(x)) }
/** 规范化 Persona 结构 */
function normalizePersonaData(src) {
  if (!src || typeof src !== 'object') return null
  return {
    name: src.name || '用户',
    description: src.description || '',
    persona_name: src.persona_name || '',
    persona_badge: src.persona_badge || ''
  }
}
// 当前编辑的数据（内存中）
const currentData = ref(
  deepClone(
    normalizePersonaData(props.personaData) || { name: '', description: '', persona_name: '', persona_badge: '' }
  )
)
// 外部数据变更时同步
watch(() => props.personaData, async (v) => {
  currentData.value = deepClone(normalizePersonaData(v) || { name: '', description: '', persona_name: '', persona_badge: '' })
  await loadExistingIcon()
  await nextTick()
  window.lucide?.createIcons?.()
})

// 本地草稿
const nameDraft = ref(currentData.value.name || '')
const descDraft = ref(currentData.value.description || '')
const personaNameDraft = ref(currentData.value.persona_name || '')
const personaBadgeDraft = ref(currentData.value.persona_badge || '')

// 保存（失焦即时保存）
function saveName() {
  currentData.value.name = nameDraft.value
}

function saveDesc() {
  currentData.value.description = descDraft.value
}

function savePersonaName() {
  currentData.value.persona_name = personaNameDraft.value
}

function savePersonaBadge() {
  currentData.value.persona_badge = personaBadgeDraft.value
}

// 重置为当前存储内容
function resetAll() {
  nameDraft.value = currentData.value.name || ''
  descDraft.value = currentData.value.description || ''
  personaNameDraft.value = currentData.value.persona_name || ''
  personaBadgeDraft.value = currentData.value.persona_badge || ''
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
  savePersonaName()
  savePersonaBadge()
  
  const content = {
    name: currentData.value.name || '',
    description: currentData.value.description || '',
    persona_name: currentData.value.persona_name || '',
    persona_badge: currentData.value.persona_badge || ''
  }
  
  // 处理图标
  let iconBase64 = undefined
  if (iconFile.value) {
    try {
      iconBase64 = await fileToBase64(iconFile.value)
    } catch (err) {
      console.error('[PersonaDetailView] Icon conversion failed:', err)
    }
  } else if (iconDeleted.value && iconLoadedFromServer.value) {
    iconBase64 = ''
  }
  
  // 处理头像
  let avatarBase64 = undefined
  if (avatarFile.value) {
    try {
      avatarBase64 = await fileToBase64(avatarFile.value)
    } catch (err) {
      console.error('[PersonaDetailView] Avatar conversion failed:', err)
    }
  } else if (avatarDeleted.value && avatarLoadedFromServer.value) {
    avatarBase64 = ''
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
    
    // 保存成功后，刷新侧边栏列表
    try {
      console.log('[PersonaDetailView] 刷新人设列表')
      Host.events.emit(Catalog.EVT_CATALOG_PERSONAS_REQ, {
        requestId: Date.now()
      })
    } catch (err) {
      console.warn('[PersonaDetailView] 刷新人设列表失败:', err)
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
    iconBase64,
    avatarBase64,
    tag
  })
}

// 初始化 Lucide 图标
onMounted(async () => {
  window.lucide?.createIcons?.()
  await loadExistingIcon()
  await loadExistingAvatar()
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
          
          <!-- 头像 -->
          <div>
            <label class="block text-sm font-medium text-black mb-2">{{ t('detail.persona.avatarLabel') }}</label>
            <div
              class="icon-upload-area"
              :class="{ 'has-icon': hasAvatar }"
              @click="triggerAvatarSelect"
            >
              <input
                ref="avatarInputRef"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleAvatarSelect"
              />
              <template v-if="hasAvatar">
                <img :src="avatarPreviewUrl" alt="Avatar Preview" class="icon-preview" />
                <button
                  type="button"
                  class="icon-remove-btn"
                  @click.stop="removeAvatar"
                  :title="t('detail.persona.removeAvatar')"
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
                  <span class="text-xs">{{ t('detail.persona.uploadAvatar') }}</span>
                </div>
              </template>
            </div>
            <div class="text-xs text-black/50 mt-1 text-center max-w-[120px]">{{ t('createItem.iconHint') }}</div>
          </div>
        </div>

        <!-- 右侧：表单字段 -->
        <div class="flex-1 grid grid-cols-1 gap-4">
          <div>
            <label class="block text-sm font-medium text-black mb-2">{{ t('detail.persona.personaInfoName') }}</label>
            <input
              v-model="nameDraft"
              @blur="saveName"
              type="text"
              :placeholder="t('detail.persona.personaInfoNamePlaceholder')"
              class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
            <p class="text-xs text-black/50 mt-1">{{ t('detail.persona.currentValue') }}：{{ currentData.name || t('detail.persona.notSet') }}</p>
          </div>

        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.persona.personaName') }}</label>
          <input
            v-model="personaNameDraft"
            @blur="savePersonaName"
            type="text"
            :placeholder="t('detail.persona.personaNamePlaceholder')"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          <p class="text-xs text-black/50 mt-1">{{ t('detail.persona.currentValue') }}：{{ currentData.persona_name || t('detail.persona.notSet') }}</p>
        </div>

          <div>
            <label class="block text-sm font-medium text-black mb-2">{{ t('detail.persona.personaBadge') }}</label>
            <input
              v-model="personaBadgeDraft"
              @blur="savePersonaBadge"
              type="text"
              :placeholder="t('detail.persona.personaBadgePlaceholder')"
              class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
            <p class="text-xs text-black/50 mt-1">{{ t('detail.persona.currentValue') }}：{{ currentData.persona_badge || t('detail.persona.notSet') }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-black mb-2">{{ t('detail.persona.personaInfoDesc') }}</label>
            <textarea
              v-model="descDraft"
              @blur="saveDesc"
              rows="6"
              :placeholder="t('detail.persona.personaInfoDescPlaceholder')"
              class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            ></textarea>
            <p class="text-xs text-black/50 mt-1">{{ t('detail.persona.charCount') }}：{{ (descDraft || '').length }}</p>
          </div>
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
@import './shared-detail-styles.css';
</style>