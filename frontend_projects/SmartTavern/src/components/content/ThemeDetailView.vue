<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { useI18n } from '@/locales'
import StylesService from '@/services/stylesService'

const { t } = useI18n()

const props = defineProps({
  themeData: { type: Object, default: null },
  dir: { type: String, default: '' }
})

const emit = defineEmits(['saved'])

// 当前编辑的数据（内存中）
const nameDraft = ref('')
const descDraft = ref('')

// 初始化
if (props.themeData) {
  nameDraft.value = props.themeData.name || ''
  descDraft.value = props.themeData.description || ''
}

// 监听外部数据变化
watch(() => props.themeData, (newData) => {
  if (newData) {
    nameDraft.value = newData.name || ''
    descDraft.value = newData.description || ''
  }
})

// 失焦保存到内存
function saveMeta() {
  // 输入框失焦时自动保存到内存，实际写入需要点击保存按钮
}

// 保存状态
const saving = ref(false)
const savedOk = ref(false)
let __saveTimer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (__saveTimer) clearTimeout(__saveTimer)
})

// 保存到后端
async function save() {
  const dir = props.dir
  if (!dir) {
    try { alert(t('error.missingFilePath')) } catch (_) {}
    return
  }
  
  saving.value = true
  savedOk.value = false
  if (__saveTimer) { clearTimeout(__saveTimer); __saveTimer = null }
  
  try {
    const result = await StylesService.updateThemeFile(dir, {
      name: nameDraft.value,
      description: descDraft.value
    })
    
    if (result.error) {
      console.error('[ThemeDetailView] 保存失败:', result.message)
      try { alert(t('detail.theme.saveFailed') + '：' + result.message) } catch (_) {}
    } else {
      console.log('[ThemeDetailView] 保存成功')
      savedOk.value = true
      if (savedOk.value) {
        __saveTimer = setTimeout(() => { savedOk.value = false }, 1800)
      }
      
      // 通知父组件刷新主题列表
      emit('saved', { dir: props.dir })
    }
  } catch (error: any) {
    console.error('[ThemeDetailView] 保存错误:', error)
    try { alert(t('detail.theme.saveFailed') + '：' + error.message) } catch (_) {}
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="space-y-6">
    <!-- 页面标题 -->
    <div class="bg-white rounded-4 card-shadow border border-gray-200 p-6 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <i data-lucide="palette" class="w-5 h-5 text-black"></i>
          <h2 class="text-lg font-bold text-black">{{ t('detail.theme.pageTitle') }}</h2>
        </div>
        <div class="flex items-center gap-2">
          <!-- 保存状态：左侧提示区 -->
          <div class="save-indicator min-w-[72px] h-7 flex items-center justify-center">
            <span v-if="saving" class="save-spinner" :aria-label="t('detail.preset.saving')"></span>
            <span v-else-if="savedOk" class="save-done"><strong>{{ t('detail.theme.saved') }}</strong></span>
          </div>
          <button
            type="button"
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft disabled:opacity-50"
            :disabled="saving"
            @click="save"
            :title="t('detail.preset.saveToBackend')"
          >{{ t('common.save') }}</button>
          <div class="px-3 py-1 rounded-4 bg-gray-100 border border-gray-300 text-black text-sm">
            {{ t('detail.theme.editMode') }}
          </div>
        </div>
      </div>
      <p class="mt-2 text-xs text-black/60">{{ t('detail.theme.editHint') }}</p>
    </div>

    <!-- 基本设定 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="info" class="w-4 h-4 text-black"></i>
        <h3 class="text-base font-semibold text-black">{{ t('detail.theme.basicInfo') }}</h3>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.theme.themeName') }}</label>
          <input
            v-model="nameDraft"
            @blur="saveMeta"
            :placeholder="t('detail.theme.themeNamePlaceholder')"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-black mb-2">{{ t('detail.theme.themeDesc') }}</label>
          <textarea
            v-model="descDraft"
            @blur="saveMeta"
            rows="4"
            :placeholder="t('detail.theme.themeDescPlaceholder')"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>
      </div>
    </div>

    <!-- 说明 -->
    <div class="bg-blue-50 rounded-4 border border-blue-200 p-4">
      <div class="flex items-start gap-2">
        <i data-lucide="info" class="w-4 h-4 text-blue-600 mt-0.5"></i>
        <div class="flex-1">
          <h4 class="text-sm font-semibold text-blue-900 mb-2">{{ t('detail.theme.notes.title') }}</h4>
          <ul class="text-xs text-blue-800 space-y-1">
            <li>• {{ t('detail.theme.notes.line1') }}</li>
            <li>• {{ t('detail.theme.notes.line2') }}</li>
            <li>• {{ t('detail.theme.notes.line3') }}</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
@import './shared-detail-styles.css';
</style>