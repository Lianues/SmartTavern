<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Host from '@/workflow/core/host'
import * as CatalogChannel from '@/workflow/channels/catalog'
import * as SettingsChannel from '@/workflow/channels/settings'
import DataCatalog from '@/services/dataCatalog'
import ImportConflictModal from '@/components/common/ImportConflictModal.vue'
import ImportErrorModal from '@/components/common/ImportErrorModal.vue'
import ExportModal from '@/components/common/ExportModal.vue'
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal.vue'
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

const usingKey = ref(null)
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

// 导入错误弹窗状态
const showImportErrorModal = ref(false)
const importErrorCode = ref('')
const importErrorMessage = ref('')
const importExpectedType = ref('')
const importActualType = ref('')

// 删除确认弹窗状态
const showDeleteConfirmModal = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)

// 使用通道响应式状态
const llmConfigs = CatalogChannel.llmConfigs
const loading = computed(() =>
  CatalogChannel.loadingStates.value.llmconfigs ||
  (props.conversationFile ? SettingsChannel.isLoading(props.conversationFile) : false) ||
  importing.value
)
const error = computed(() =>
  importError.value ||
  CatalogChannel.errorStates.value.llmconfigs ||
  (props.conversationFile ? SettingsChannel.getError(props.conversationFile) : null)
)

// 监听事件响应
let unsubscribeLLMConfigs = null
let unsubscribeSettings = null

function loadData() {
  if (settingsLoaded.value) return
  
  // 请求LLM配置列表
  Host.events.emit(CatalogChannel.EVT_CATALOG_LLMCONFIGS_REQ, {
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
    // 如果没有对话文件，默认选第一个
    if (!usingKey.value && llmConfigs.value.length) {
      usingKey.value = llmConfigs.value[0].key
    }
  }
}

function refreshLLMConfigs() {
  Host.events.emit(CatalogChannel.EVT_CATALOG_LLMCONFIGS_REQ, { requestId: Date.now() })
}

onMounted(() => {
  // 监听LLM配置列表响应
  unsubscribeLLMConfigs = Host.events.on(CatalogChannel.EVT_CATALOG_LLMCONFIGS_RES, (payload) => {
    if (payload?.success) {
      setTimeout(() => {
        try { window?.lucide?.createIcons?.() } catch (_) {}
      }, 50)
      
      // 如果没有对话文件，自动选第一个
      if (!props.conversationFile && !usingKey.value && llmConfigs.value.length) {
        usingKey.value = llmConfigs.value[0].key
      }
    }
  })
  
  // 监听设置响应
  unsubscribeSettings = Host.events.on(SettingsChannel.EVT_SETTINGS_GET_RES, (payload) => {
    if (payload?.success && payload?.conversationFile === props.conversationFile) {
      const settings = payload.settings || {}
      if (settings.llm_config) {
        usingKey.value = settings.llm_config
      } else if (!usingKey.value && llmConfigs.value.length) {
        usingKey.value = llmConfigs.value[0].key
      }
      settingsLoaded.value = true
    }
  })
})

onUnmounted(() => {
  if (unsubscribeLLMConfigs) unsubscribeLLMConfigs()
  if (unsubscribeSettings) unsubscribeSettings()
})

// 监听面板打开，触发懒加载
watch(() => props.conversationFile, (v) => {
  if (v && !settingsLoaded.value) {
    loadData()
  }
}, { immediate: true })

function close(){ emit('close') }

function onUse(k) {
  if (!props.conversationFile) {
    usingKey.value = k
    emit('use', k)
    return
  }
  
  // 通过事件请求更新设置
  Host.events.emit(SettingsChannel.EVT_SETTINGS_UPDATE_REQ, {
    conversationFile: props.conversationFile,
    patch: { llm_config: k },
    requestId: Date.now()
  })
  
  // 监听更新响应（一次性）
  const unsubUpdate = Host.events.on(SettingsChannel.EVT_SETTINGS_UPDATE_RES, (payload) => {
    if (payload?.conversationFile === props.conversationFile) {
      if (payload.success) {
        usingKey.value = k
        emit('use', k)
      }
      unsubUpdate() // 移除监听器
    }
  })
}

function onView(k){ emit('view', k) }

// ==================== 删除功能 ====================

function onDelete(k) {
  const item = llmConfigs.value.find(p => p.key === k)
  if (!item) return
  
  deleteTarget.value = {
    key: k,
    name: item.name || getFolderName(k),
    folderPath: k.replace(/\/llm_config\.json$/, ''),
  }
  showDeleteConfirmModal.value = true
}

function closeDeleteConfirmModal() {
  showDeleteConfirmModal.value = false
  deleteTarget.value = null
}

async function handleDeleteConfirm() {
  if (!deleteTarget.value) return
  
  deleting.value = true
  try {
    const result = await DataCatalog.deleteDataFolder(deleteTarget.value.folderPath)
    if (result.success) {
      if (usingKey.value === deleteTarget.value.key) {
        usingKey.value = null
      }
      refreshLLMConfigs()
      emit('delete', deleteTarget.value.key)
    } else {
      importError.value = result.message || t('error.deleteFailed', { error: result.error || '' })
    }
  } catch (err) {
    console.error('[LLMConfigsPanel] Delete error:', err)
    importError.value = t('error.deleteFailed', { error: err.message || '' })
  } finally {
    deleting.value = false
    closeDeleteConfirmModal()
  }
}

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

// ==================== 导入功能 ====================

function triggerImport() {
  importError.value = null
  if (fileInputRef.value) fileInputRef.value.click()
}

function extractLLMConfigName(filename) {
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
  
  const llmConfigName = extractLLMConfigName(file.name)
  
  try {
    const checkResult = await DataCatalog.checkNameExists('llmconfig', llmConfigName)
    if (checkResult.success && checkResult.exists) {
      openImportConflictModal(file, checkResult.folder_name, checkResult.suggested_name)
      event.target.value = ''
      return
    }
  } catch (err) {
    console.warn('[LLMConfigsPanel] Check name exists failed:', err)
  }
  
  await doImport(file, false)
  event.target.value = ''
}

async function doImport(file, overwrite = false, targetName = null) {
  importing.value = true
  importError.value = null
  
  try {
    const result = await DataCatalog.importDataFromFile('llmconfig', file, targetName, overwrite)
    if (result.success) {
      refreshLLMConfigs()
      emit('import', result)
    } else {
      // 检查是否是类型不匹配或缺少类型信息的错误
      const errorCode = result.error || ''
      if (errorCode === 'TYPE_MISMATCH' || errorCode === 'NO_TYPE_INFO') {
        openImportErrorModal(errorCode, result.message, result.expected_type, result.actual_type)
      } else {
        importError.value = result.message || result.error || t('error.importFailed')
      }
    }
  } catch (err) {
    console.error('[LLMConfigsPanel] Import error:', err)
    importError.value = err.message || t('error.importFailed')
  } finally {
    importing.value = false
  }
}

// 打开导入错误弹窗
function openImportErrorModal(code, message, expected, actual) {
  importErrorCode.value = code
  importErrorMessage.value = message || ''
  importExpectedType.value = expected || 'llm_config'
  importActualType.value = actual || ''
  showImportErrorModal.value = true
}

// 关闭导入错误弹窗
function closeImportErrorModal() {
  showImportErrorModal.value = false
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
    data-scope="aiconfig-view"
    class="ai-panel glass"
    :style="panelStyle"
  >
      <header class="ai-header">
        <div class="ai-title st-panel-title">
          <span class="ai-icon"><i data-lucide="plug"></i></span>
          {{ t('panel.llmConfigs.title') }}
        </div>
        <div class="ai-header-actions">
          <button class="ai-action-btn st-btn-shrinkable" type="button" :title="t('panel.llmConfigs.importTitle')" @click="triggerImport" :disabled="importing">
            <i data-lucide="download"></i><span class="st-btn-text">{{ t('common.import') }}</span>
          </button>
          <button class="ai-action-btn st-btn-shrinkable" type="button" :title="t('panel.llmConfigs.exportTitle')" @click="openExportModal" :disabled="llmConfigs.length === 0">
            <i data-lucide="upload"></i><span class="st-btn-text">{{ t('common.export') }}</span>
          </button>
          <button class="ai-close" type="button" :title="t('common.close')" @click="close">✕</button>
        </div>
      </header>
      <input ref="fileInputRef" type="file" accept=".json,.zip,.png" style="display: none;" @change="handleFileSelect" />

      <CustomScrollbar class="ai-body">
        <div v-if="loading" class="ai-loading">{{ importing ? t('common.importing') : t('common.loading') }}</div>
        <div v-else-if="error" class="ai-error">
          {{ importError ? importError : t('error.loadFailed', { error }) }}
          <button v-if="importError" class="ai-error-dismiss" @click="importError = null">×</button>
        </div>
        <div v-else class="ai-list">
          <div
            v-for="it in llmConfigs"
            :key="it.key"
            class="ai-card"
          >
            <div class="ai-main">
              <div class="ai-avatar">
                <i v-if="isLucide(it.icon)" :data-lucide="it.icon"></i>
                <i v-else data-lucide="plug"></i>
              </div>
              <div class="ai-texts">
                <div class="ai-name">{{ it.name }}</div>
                <div class="ai-folder">
                  <svg class="ai-folder-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <span>{{ getFolderName(it.key) }}</span>
                </div>
                <div class="ai-desc">{{ it.desc }}</div>
              </div>
            </div>
            <div class="ai-actions">
              <button
                class="ai-btn st-btn-shrinkable"
                :class="{ active: usingKey === it.key }"
                type="button"
                @click="onUse(it.key)"
                :aria-pressed="usingKey === it.key"
              >{{ usingKey === it.key ? t('common.using') : t('common.use') }}</button>

              <button class="ai-btn st-btn-shrinkable" type="button" @click="onView(it.key)">{{ t('common.view') }}</button>

              <button class="ai-btn ai-danger st-btn-shrinkable" type="button" @click="onDelete(it.key)">{{ t('common.delete') }}</button>
            </div>
          </div>
        </div>
      </CustomScrollbar>

      <!-- 使用可复用的导入冲突弹窗组件 -->
      <ImportConflictModal
        :show="showImportConflictModal"
        data-type="llmconfig"
        :data-type-name="t('panel.llmConfigs.typeName')"
        :existing-name="importConflictExistingName"
        :suggested-name="importConflictSuggestedName"
        @close="closeImportConflictModal"
        @overwrite="handleConflictOverwrite"
        @rename="handleConflictRename"
      />

      <!-- 使用可复用的导出弹窗组件 -->
      <ExportModal
        :show="showExportModal"
        data-type="llmconfig"
        :data-type-name="t('panel.llmConfigs.typeName')"
        :items="llmConfigs"
        default-icon="plug"
        @close="closeExportModal"
        @export="handleExportComplete"
      />

      <!-- 导入错误弹窗 -->
      <ImportErrorModal
        :show="showImportErrorModal"
        :error-code="importErrorCode"
        :error-message="importErrorMessage"
        :data-type-name="t('panel.llmConfigs.typeName')"
        :expected-type="importExpectedType"
        :actual-type="importActualType"
        @close="closeImportErrorModal"
      />

      <!-- 删除确认弹窗 -->
      <DeleteConfirmModal
        :show="showDeleteConfirmModal"
        :item-name="deleteTarget?.name || ''"
        :data-type-name="t('panel.llmConfigs.typeName')"
        :loading="deleting"
        @close="closeDeleteConfirmModal"
        @confirm="handleDeleteConfirm"
      />
    </div>
</template>

<style scoped>
.ai-panel {
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
.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(var(--st-border), 0.85);
}
.ai-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: rgb(var(--st-color-text));
}
.ai-icon i { width: 18px; height: 18px; display: inline-block; }

.ai-header-actions { display: flex; align-items: center; gap: 8px; }
.ai-action-btn { appearance: none; display: inline-flex; align-items: center; gap: 4px; border: 1px solid rgba(var(--st-primary), 0.5); background: rgba(var(--st-primary), 0.08); color: rgb(var(--st-color-text)); border-radius: 4px; padding: 6px 10px; font-size: 12px; cursor: pointer; transition: transform .2s cubic-bezier(.22,.61,.36,1), background .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1); }
.ai-action-btn i { width: 14px; height: 14px; display: inline-block; }
.ai-action-btn:hover:not(:disabled) { background: rgba(var(--st-primary), 0.15); transform: translateY(-1px); box-shadow: var(--st-shadow-sm); }
.ai-action-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.ai-close {
  appearance: none;
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface-2));
  border-radius: 4px;
  padding: 6px 8px;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.22,.61,.36,1), background .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
.ai-close:hover {
  background: rgb(var(--st-surface));
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

/* Body */
.ai-body {
  padding: 12px;
  overflow: hidden;
}
.ai-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

/* Card */
.ai-card {
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
.ai-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

/* Left main */
.ai-main {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: center;
}
.ai-avatar {
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
.ai-avatar i { width: 18px; height: 18px; display: inline-block; }
.ai-texts { min-width: 0; }
.ai-name {
  font-weight: 700;
  color: rgb(var(--st-color-text));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ai-folder {
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
.ai-folder-icon {
  flex-shrink: 0;
  opacity: 0.7;
}
.ai-desc {
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
.ai-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}
.ai-btn {
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
.ai-btn:focus-visible,
.ai-close:focus-visible {
  outline: 2px solid rgba(var(--st-primary), 0.6);
  outline-offset: 2px;
}
.ai-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}
.ai-btn.active {
  border-color: rgba(var(--st-primary), 0.5);
  background: rgba(var(--st-primary), 0.08);
}
.ai-btn.ai-danger {
  border-color: rgba(220, 38, 38, 0.5);
  color: rgb(var(--st-color-text));
  background: rgba(220, 38, 38, 0.06);
}
.ai-btn.ai-danger:hover {
  border-color: rgba(220, 38, 38, 0.7);
  background: rgba(220, 38, 38, 0.1);
}

/* States */
.ai-loading,
.ai-error {
  padding: 12px;
  font-size: 13px;
  color: rgba(var(--st-color-text), 0.8);
}
.ai-error { color: rgb(220, 38, 38); display: flex; align-items: center; gap: 8px; }
.ai-error-dismiss { appearance: none; border: none; background: rgba(220, 38, 38, 0.1); color: rgb(220, 38, 38); border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 14px; line-height: 1; }
.ai-error-dismiss:hover { background: rgba(220, 38, 38, 0.2); }

@media (max-width: 640px) {
  .ai-card { grid-template-columns: 1fr; }
  .ai-actions { flex-direction: row; }
}
</style>