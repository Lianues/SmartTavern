<script setup>
import { ref, computed, watch, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { useI18n } from '@/locales'
import Host from '@/workflow/core/host'
import DataCatalog from '@/services/dataCatalog'

const { t } = useI18n()

const props = defineProps({
  pluginData: { type: Object, default: null },
  dir: { type: String, default: '' }
})

const emit = defineEmits(['saved'])

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

// 根据目录路径加载已有图标
async function loadExistingIcon() {
  // 重置当前图标
  resetIconPreview()
  
  if (!props.dir) return
  
  // 构建图标路径：dir/icon.png
  const iconPath = `${props.dir}/icon.png`
  
  try {
    // 使用 DataCatalog.getPluginsAssetBlob 获取图标
    const { blob, mime } = await DataCatalog.getPluginsAssetBlob(iconPath)
    if (blob.size > 0 && mime.startsWith('image/')) {
      iconPreviewUrl.value = URL.createObjectURL(blob)
      // 标记图标是从服务器加载的
      iconLoadedFromServer.value = true
    }
  } catch (err) {
    // 图标不存在或加载失败，忽略错误
    console.debug('[PluginDetailView] No existing icon or failed to load:', err)
    iconLoadedFromServer.value = false
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
/** 规范化 Plugin 结构 */
function normalizePluginData(src) {
  if (!src || typeof src !== 'object') return null
  return {
    name: src.name || '',
    description: src.description || ''
  }
}

// 当前编辑的数据（内存中）
const currentData = ref(
  deepClone(
    normalizePluginData(props.pluginData) || { name: '', description: '' }
  )
)

// 外部数据变更时同步
watch(() => props.pluginData, async (v) => {
  currentData.value = deepClone(normalizePluginData(v) || { name: '', description: '' })
  await nextTick()
  window.lucide?.createIcons?.()
})

// 监听目录路径变化，加载图标
watch(() => props.dir, (newDir) => {
  if (newDir) {
    loadExistingIcon()
  } else {
    resetIconPreview()
  }
}, { immediate: true })

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

onBeforeUnmount(() => {
  try {
    if (__saveTimer) clearTimeout(__saveTimer)
  } catch (_) {}
})

// 保存到后端
async function save() {
  const dir = props.dir
  if (!dir) {
    try { alert(t('error.missingFilePath')); } catch (_) {}
    return
  }
  
  // 先保存当前草稿
  saveName()
  saveDesc()
  
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
      console.error('[PluginDetailView] Icon conversion failed:', err)
    }
  } else if (iconDeleted.value && iconLoadedFromServer.value) {
    // 用户删除了原有图标（图标曾经从服务器加载，现在被删除）
    iconBase64 = ''
  }
  // 否则 iconBase64 保持 undefined，表示不修改图标
  
  saving.value = true
  savedOk.value = false
  if (__saveTimer) { try { clearTimeout(__saveTimer) } catch {} __saveTimer = null }
  
  try {
    const result = await DataCatalog.updatePluginFile(
      dir,
      currentData.value.name || '',
      currentData.value.description || '',
      iconBase64
    )
    
    if (result.error) {
      console.error('[PluginDetailView] 保存失败:', result.message)
      try { alert(t('detail.plugin.saveFailed') + '：' + result.message) } catch (_) {}
    } else {
      console.log('[PluginDetailView] 保存成功')
      savedOk.value = true
      if (savedOk.value) {
        __saveTimer = setTimeout(() => { savedOk.value = false }, 1800)
      }
      Host.pushToast?.({ type: 'success', message: t('detail.plugin.saved'), timeout: 1600 })
      
      // 通知父组件刷新插件列表
      emit('saved', { dir: props.dir })
    }
  } catch (err) {
    console.error('[PluginDetailView] 保存错误:', err)
    try { alert(t('detail.plugin.saveFailed') + '：' + (err.message || err)) } catch (_) {}
  } finally {
    saving.value = false
  }
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
          <i data-lucide="puzzle" class="w-5 h-5 text-black"></i>
          <h2 class="text-lg font-bold text-black">{{ t('detail.plugin.pageTitle') }}</h2>
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
            {{ t('detail.plugin.editMode') }}
          </div>
        </div>
      </div>
      <p class="mt-2 text-xs text-black/60">{{ t('detail.plugin.editHint') }}</p>
    </div>

    <!-- 基本信息 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="info" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.plugin.basicInfo') }}</h3>
      </div>

      <div class="flex gap-6 mb-4">
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

        <!-- 右侧：表单字段 -->
        <div class="flex-1 grid grid-cols-1 gap-4">
          <div>
            <label class="block text-sm font-medium text-black mb-2">{{ t('detail.plugin.pluginName') }}</label>
            <input
              v-model="nameDraft"
              @blur="saveName"
              type="text"
              :placeholder="t('detail.plugin.pluginNamePlaceholder')"
              class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            />
            <p class="text-xs text-black/50 mt-1">{{ t('detail.persona.currentValue') }}：{{ currentData.name || t('detail.persona.notSet') }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-black mb-2">{{ t('detail.plugin.pluginDesc') }}</label>
            <textarea
              v-model="descDraft"
              @blur="saveDesc"
              rows="4"
              :placeholder="t('detail.plugin.pluginDescPlaceholder')"
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
        <h3 class="text-sm font-semibold text-black">{{ t('detail.plugin.notes.title') }}</h3>
      </div>
      <div class="text-xs text-black/60 leading-relaxed space-y-2">
        <p>• {{ t('detail.plugin.notes.line1') }}</p>
        <p>• {{ t('detail.plugin.notes.line2') }}</p>
        <p>• {{ t('detail.plugin.notes.line3') }}</p>
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