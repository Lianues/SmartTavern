<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Host from '@/workflow/core/host'
import * as CatalogChannel from '@/workflow/channels/catalog'
import * as SettingsChannel from '@/workflow/channels/settings'
import DataCatalog from '@/services/dataCatalog'
import ImportConflictModal from '@/components/common/ImportConflictModal.vue'
import ExportModal from '@/components/common/ExportModal.vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  anchorLeft: { type: Number, default: 308 },
  width: { type: Number, default: 560 },
  zIndex: { type: Number, default: 59 },
  top: { type: Number, default: 64 },
  bottom: { type: Number, default: 12 },
  conversationFile: { type: String, default: null },
})

const emit = defineEmits(['close','use','view','delete','import','export'])

const panelStyle = computed(() => ({
  position: 'fixed',
  left: props.anchorLeft + 'px',
  top: props.top + 'px',
  bottom: props.bottom + 'px',
  width: props.width + 'px',
  zIndex: String(props.zIndex),
}))

const usingKeys = ref([])
const settingsLoaded = ref(false)

// 导入相关状态
const fileInputRef = ref(null)
const importing = ref(false)
const importError = ref(null)
const pendingImportFile = ref(null)

// 导入冲突弹窗状态
const showImportConflictModal = ref(false)
const importConflictExistingName = ref('')
const importConflictSuggestedName = ref('')

// 导出弹窗状态
const showExportModal = ref(false)

// 使用通道响应式状态
const regexRules = CatalogChannel.regexRules
const loading = computed(() =>
  CatalogChannel.loadingStates.value.regex ||
  (props.conversationFile ? SettingsChannel.isLoading(props.conversationFile) : false) ||
  importing.value
)
const error = computed(() =>
  importError.value ||
  CatalogChannel.errorStates.value.regex ||
  (props.conversationFile ? SettingsChannel.getError(props.conversationFile) : null)
)

// 监听事件响应
let unsubscribeRegex = null
let unsubscribeSettings = null

function loadData() {
  if (settingsLoaded.value) return
  
  // 请求正则规则列表
  Host.events.emit(CatalogChannel.EVT_CATALOG_REGEX_REQ, {
    requestId: Date.now()
  })
  
  // 请求设置（如果有对话文件）
  if (props.conversationFile) {
    Host.events.emit(SettingsChannel.EVT_SETTINGS_GET_REQ, {
      conversationFile: props.conversationFile,
      requestId: Date.now()
    })
  } else {
    settingsLoaded.value = true
  }
}

function refreshRegexRules() {
  Host.events.emit(CatalogChannel.EVT_CATALOG_REGEX_REQ, { requestId: Date.now() })
}

onMounted(() => {
  // 监听正则规则列表响应
  unsubscribeRegex = Host.events.on(CatalogChannel.EVT_CATALOG_REGEX_RES, (payload) => {
    if (payload?.success) {
      setTimeout(() => {
        try { window?.lucide?.createIcons?.() } catch (_) {}
      }, 50)
    }
  })
  
  // 监听设置响应
  unsubscribeSettings = Host.events.on(SettingsChannel.EVT_SETTINGS_GET_RES, (payload) => {
    if (payload?.success && payload?.conversationFile === props.conversationFile) {
      const settings = payload.settings || {}
      // regex_rules是数组字段（多选）
      if (Array.isArray(settings.regex_rules)) {
        usingKeys.value = settings.regex_rules
      }
      settingsLoaded.value = true
    }
  })
})

onUnmounted(() => {
  if (unsubscribeRegex) unsubscribeRegex()
  if (unsubscribeSettings) unsubscribeSettings()
})

watch(() => props.conversationFile, (v) => {
  if (v && !settingsLoaded.value) {
    loadData()
  }
}, { immediate: true })

function close(){ emit('close') }

// 多选逻辑：切换选中状态
function onUse(k) {
  if (!props.conversationFile) {
    const idx = usingKeys.value.indexOf(k)
    if (idx >= 0) {
      usingKeys.value.splice(idx, 1)
    } else {
      usingKeys.value.push(k)
    }
    emit('use', k)
    return
  }
  
  // 计算新的选中列表
  const newKeys = [...usingKeys.value]
  const idx = newKeys.indexOf(k)
  if (idx >= 0) {
    newKeys.splice(idx, 1)
  } else {
    newKeys.push(k)
  }
  
  // 通过事件请求更新设置
  Host.events.emit(SettingsChannel.EVT_SETTINGS_UPDATE_REQ, {
    conversationFile: props.conversationFile,
    patch: { regex_rules: newKeys },
    requestId: Date.now()
  })
  
  // 监听更新响应（一次性）
  const unsubUpdate = Host.events.on(SettingsChannel.EVT_SETTINGS_UPDATE_RES, (payload) => {
    if (payload?.conversationFile === props.conversationFile) {
      if (payload.success) {
        usingKeys.value = newKeys
        emit('use', k)
      }
      unsubUpdate() // 移除监听器
    }
  })
}

function onView(k){ emit('view', k) }
function onDelete(k){ emit('delete', k) }
const isLucide = (v) => typeof v === 'string' && /^[a-z\-]+$/.test(v)

// 从文件路径提取文件夹名称
function getFolderName(filePath) {
  if (!filePath) return ''
  const parts = filePath.split('/')
  if (parts.length >= 2) {
    return parts[parts.length - 2]
  }
  return ''
}

// 辅助：检查是否选中
const isUsing = (k) => usingKeys.value.includes(k)

// ==================== 导入功能 ====================

function triggerImport() {
  importError.value = null
  if (fileInputRef.value) fileInputRef.value.click()
}

function extractRegexName(filename) {
  return filename.replace(/\.(json|zip|png)$/i, '')
}

async function handleFileSelect(event) {
  const files = event.target.files
  if (!files || files.length === 0) return
  
  const file = files[0]
  const validTypes = ['.json', '.zip', '.png']
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
  if (!validTypes.includes(ext)) {
    importError.value = t('error.invalidFileType', { ext })
    event.target.value = ''
    return
  }
  
  const regexName = extractRegexName(file.name)
  
  try {
    const checkResult = await DataCatalog.checkNameExists('regex', regexName)
    if (checkResult.success && checkResult.exists) {
      openImportConflictModal(file, checkResult.folder_name, checkResult.suggested_name)
      event.target.value = ''
      return
    }
  } catch (err) {
    console.warn('[RegexRulesPanel] Check name exists failed:', err)
  }
  
  await doImport(file, false)
  event.target.value = ''
}

async function doImport(file, overwrite = false, targetName = null) {
  importing.value = true
  importError.value = null
  
  try {
    const result = await DataCatalog.importDataFromFile('regex', file, targetName, overwrite)
    if (result.success) {
      refreshRegexRules()
      emit('import', result)
    } else {
      importError.value = result.message || result.error || t('error.importFailed')
    }
  } catch (err) {
    console.error('[RegexRulesPanel] Import error:', err)
    importError.value = err.message || t('error.importFailed')
  } finally {
    importing.value = false
  }
}

function openImportConflictModal(file, existingName, suggestedName) {
  pendingImportFile.value = file
  importConflictExistingName.value = existingName
  importConflictSuggestedName.value = suggestedName
  showImportConflictModal.value = true
}

function closeImportConflictModal() {
  showImportConflictModal.value = false
  pendingImportFile.value = null
}

async function handleConflictOverwrite() {
  const file = pendingImportFile.value
  closeImportConflictModal()
  if (file) await doImport(file, true)
}

async function handleConflictRename(targetName) {
  const file = pendingImportFile.value
  closeImportConflictModal()
  if (file) await doImport(file, false, targetName)
}

// ==================== 导出功能 ====================

function openExportModal() {
  showExportModal.value = true
}

function closeExportModal() {
  showExportModal.value = false
}

function handleExportComplete(result) {
  emit('export', result)
}
</script>

<template>
  <div
    data-scope="regex-view"
    class="rg-panel glass"
    :style="panelStyle"
  >
      <header class="rg-header">
        <div class="rg-title st-panel-title">
          <span class="rg-icon"><i data-lucide="scan-text"></i></span>
          {{ t('panel.regexRules.title') }}
        </div>
        <div class="rg-header-actions">
          <button class="rg-action-btn st-btn-shrinkable" type="button" :title="t('panel.regexRules.importTitle')" @click="triggerImport" :disabled="importing">
            <i data-lucide="download"></i><span class="st-btn-text">{{ t('common.import') }}</span>
          </button>
          <button class="rg-action-btn st-btn-shrinkable" type="button" :title="t('panel.regexRules.exportTitle')" @click="openExportModal" :disabled="regexRules.length === 0">
            <i data-lucide="upload"></i><span class="st-btn-text">{{ t('common.export') }}</span>
          </button>
          <button class="rg-close" type="button" :title="t('common.close')" @click="close">✕</button>
        </div>
      </header>
      <input ref="fileInputRef" type="file" accept=".json,.zip,.png" style="display: none;" @change="handleFileSelect" />

      <CustomScrollbar class="rg-body">
        <div v-if="loading" class="rg-loading">{{ importing ? t('common.importing') : t('common.loading') }}</div>
        <div v-else-if="error" class="rg-error">
          {{ importError ? importError : t('error.loadFailed', { error }) }}
          <button v-if="importError" class="rg-error-dismiss" @click="importError = null">×</button>
        </div>
        <div v-else class="rg-list">
          <div
            v-for="it in regexRules"
            :key="it.key"
            class="rg-card"
          >
            <div class="rg-main">
              <div class="rg-avatar">
                <img v-if="it.avatarUrl" :src="it.avatarUrl" alt="" class="rg-avatar-img" />
                <i v-else-if="isLucide(it.icon)" :data-lucide="it.icon"></i>
                <i v-else data-lucide="scan-text"></i>
              </div>
              <div class="rg-texts">
                <div class="rg-name">{{ it.name }}</div>
                <div class="rg-folder">
                  <svg class="rg-folder-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <span>{{ getFolderName(it.key) }}</span>
                </div>
                <div class="rg-desc">{{ it.desc }}</div>
              </div>
            </div>
            <div class="rg-actions">
              <button
                class="rg-btn st-btn-shrinkable"
                :class="{ active: isUsing(it.key) }"
                type="button"
                @click="onUse(it.key)"
                :aria-pressed="isUsing(it.key)"
              >{{ isUsing(it.key) ? t('common.using') : t('common.use') }}</button>

              <button class="rg-btn st-btn-shrinkable" type="button" @click="onView(it.key)">{{ t('common.view') }}</button>

              <button class="rg-btn rg-danger st-btn-shrinkable" type="button" @click="onDelete(it.key)">{{ t('common.delete') }}</button>
            </div>
          </div>
        </div>
      </CustomScrollbar>

      <!-- 使用可复用的导入冲突弹窗组件 -->
      <ImportConflictModal
        :show="showImportConflictModal"
        data-type="regex"
        :data-type-name="t('panel.regexRules.typeName')"
        :existing-name="importConflictExistingName"
        :suggested-name="importConflictSuggestedName"
        @close="closeImportConflictModal"
        @overwrite="handleConflictOverwrite"
        @rename="handleConflictRename"
      />

      <!-- 使用可复用的导出弹窗组件 -->
      <ExportModal
        :show="showExportModal"
        data-type="regex"
        :data-type-name="t('panel.regexRules.typeName')"
        :items="regexRules"
        default-icon="scan-text"
        @close="closeExportModal"
        @export="handleExportComplete"
      />
    </div>
</template>

<style scoped>
.rg-panel {
  display: grid;
  grid-template-rows: auto 1fr;
  border-radius: var(--st-radius-lg);
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface));
  backdrop-filter: blur(8px) saturate(130%);
  -webkit-backdrop-filter: blur(8px) saturate(130%);
  box-shadow: var(--st-shadow-md);
  overflow: hidden;
}

/* Header */
.rg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(var(--st-border), 0.85);
}
.rg-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: rgb(var(--st-color-text));
}
.rg-icon i { width: 18px; height: 18px; display: inline-block; }

.rg-header-actions { display: flex; align-items: center; gap: 8px; }
.rg-action-btn { appearance: none; display: inline-flex; align-items: center; gap: 4px; border: 1px solid rgba(var(--st-primary), 0.5); background: rgba(var(--st-primary), 0.08); color: rgb(var(--st-color-text)); border-radius: 4px; padding: 6px 10px; font-size: 12px; cursor: pointer; transition: transform .2s cubic-bezier(.22,.61,.36,1), background .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1); }
.rg-action-btn i { width: 14px; height: 14px; display: inline-block; }
.rg-action-btn:hover:not(:disabled) { background: rgba(var(--st-primary), 0.15); transform: translateY(-1px); box-shadow: var(--st-shadow-sm); }
.rg-action-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.rg-close {
  appearance: none;
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface-2));
  border-radius: 4px;
  padding: 6px 8px;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.22,.61,.36,1), background .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
.rg-close:hover {
  background: rgb(var(--st-surface));
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

/* Body */
.rg-body {
  padding: 12px;
  overflow: hidden;
}
.rg-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

/* Card */
.rg-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: stretch;
  border: 1px solid rgb(var(--st-border));
  border-radius: var(--st-radius-md);
  background: rgb(var(--st-surface));
  padding: 12px;
  min-height: 112px; /* 确保右侧三按钮完整显示，统一高度 */
  transition: background .2s cubic-bezier(.22,.61,.36,1), border-color .2s cubic-bezier(.22,.61,.36,1), transform .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
.rg-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

/* Left main */
.rg-main {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: center;
}
.rg-avatar {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: linear-gradient(135deg, rgba(var(--st-primary),0.12), rgba(var(--st-accent),0.12));
  border: 1px solid rgba(var(--st-border), 0.9);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.25);
}
.rg-avatar i { width: 18px; height: 18px; display: inline-block; }
.rg-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; }
.rg-texts { min-width: 0; }
.rg-name {
  font-weight: 700;
  color: rgb(var(--st-color-text));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rg-folder {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
  padding: 2px 6px;
  font-size: 10px;
  color: rgba(var(--st-color-text), 0.55);
  background: rgba(var(--st-border), 0.15);
  border-radius: 3px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  max-width: fit-content;
}
.rg-folder-icon {
  flex-shrink: 0;
  opacity: 0.7;
}
.rg-desc {
  margin-top: 4px;
  color: rgba(var(--st-color-text), 0.75);
  font-size: 12px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Right actions (vertical) */
.rg-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}
.rg-btn {
  appearance: none;
  border: 1px solid rgb(var(--st-border));
  background: rgb(var(--st-surface));
  color: rgb(var(--st-color-text));
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1), background .2s cubic-bezier(.22,.61,.36,1), border-color .2s cubic-bezier(.22,.61,.36,1);
  min-width: 64px;
  text-align: center;
}
.rg-btn:focus-visible,
.rg-close:focus-visible {
  outline: 2px solid rgba(var(--st-primary), 0.6);
  outline-offset: 2px;
}
.rg-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}
.rg-btn.active {
  border-color: rgba(var(--st-primary), 0.5);
  background: rgba(var(--st-primary), 0.08);
}
.rg-btn.rg-danger {
  border-color: rgba(220, 38, 38, 0.5);
  color: rgb(var(--st-color-text));
  background: rgba(220, 38, 38, 0.06);
}
.rg-btn.rg-danger:hover {
  border-color: rgba(220, 38, 38, 0.7);
  background: rgba(220, 38, 38, 0.1);
}

/* States */
.rg-loading,
.rg-error {
  padding: 12px;
  font-size: 13px;
  color: rgba(var(--st-color-text), 0.8);
}
.rg-error { color: rgb(220, 38, 38); display: flex; align-items: center; gap: 8px; }
.rg-error-dismiss { appearance: none; border: none; background: rgba(220, 38, 38, 0.1); color: rgb(220, 38, 38); border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 14px; line-height: 1; }
.rg-error-dismiss:hover { background: rgba(220, 38, 38, 0.2); }

@media (max-width: 640px) {
  .rg-card { grid-template-columns: 1fr; }
  .rg-actions { flex-direction: row; }
}
</style>