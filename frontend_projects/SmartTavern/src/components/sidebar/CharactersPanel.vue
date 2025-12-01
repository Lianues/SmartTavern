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
import CreateItemModal from '@/components/common/CreateItemModal.vue'
import { useI18n } from '@/locales'
import { useChatSettingsStore } from '@/stores/chatSettings'

const { t } = useI18n()
const chatSettingsStore = useChatSettingsStore()

const props = defineProps({
  anchorLeft: { type: Number, default: 308 },
  width: { type: Number, default: 560 },
  zIndex: { type: Number, default: 59 },
  top: { type: Number, default: 64 },
  bottom: { type: Number, default: 12 },
  conversationFile: { type: String, default: null },
})

const emit = defineEmits(['close','use','view','delete','import','export','create'])

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

// 新建弹窗状态
const showCreateModal = ref(false)

// 使用通道响应式状态
const characters = CatalogChannel.characters
const loading = computed(() =>
  CatalogChannel.loadingStates.value.characters ||
  (props.conversationFile ? SettingsChannel.isLoading(props.conversationFile) : false) ||
  importing.value
)
const error = computed(() =>
  importError.value ||
  CatalogChannel.errorStates.value.characters ||
  (props.conversationFile ? SettingsChannel.getError(props.conversationFile) : null)
)

let unsubscribeCharacters = null
let unsubscribeSettings = null

function loadData() {
  if (settingsLoaded.value) return
  
  Host.events.emit(CatalogChannel.EVT_CATALOG_CHARACTERS_REQ, {
    requestId: Date.now()
  })
  
  if (props.conversationFile) {
    Host.events.emit(SettingsChannel.EVT_SETTINGS_GET_REQ, {
      conversationFile: props.conversationFile,
      requestId: Date.now()
    })
  } else {
    settingsLoaded.value = true
    if (!usingKey.value && characters.value.length) {
      usingKey.value = characters.value[0].key
    }
  }
}

function refreshCharacters() {
  Host.events.emit(CatalogChannel.EVT_CATALOG_CHARACTERS_REQ, {
    requestId: Date.now()
  })
}

// Transition 完成后初始化图标
function handleTransitionComplete() {
  try {
    window?.lucide?.createIcons?.()
  } catch (_) {}
}

onMounted(() => {
  unsubscribeCharacters = Host.events.on(CatalogChannel.EVT_CATALOG_CHARACTERS_RES, (payload) => {
    if (payload?.success) {
      if (!props.conversationFile && !usingKey.value && characters.value.length) {
        usingKey.value = characters.value[0].key
      }
    }
  })
  
  unsubscribeSettings = Host.events.on(SettingsChannel.EVT_SETTINGS_GET_RES, (payload) => {
    if (payload?.success && payload?.conversationFile === props.conversationFile) {
      const settings = payload.settings || {}
      if (settings.character) {
        usingKey.value = settings.character
      } else if (!usingKey.value && characters.value.length) {
        usingKey.value = characters.value[0].key
      }
      settingsLoaded.value = true
    }
  })
})

onUnmounted(() => {
  if (unsubscribeCharacters) unsubscribeCharacters()
  if (unsubscribeSettings) unsubscribeSettings()
})

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
  
  Host.events.emit(SettingsChannel.EVT_SETTINGS_UPDATE_REQ, {
    conversationFile: props.conversationFile,
    patch: { character: k },
    requestId: Date.now()
  })
  
  const unsubUpdate = Host.events.on(SettingsChannel.EVT_SETTINGS_UPDATE_RES, (payload) => {
    if (payload?.conversationFile === props.conversationFile) {
      if (payload.success) {
        usingKey.value = k
        emit('use', k)
      }
      unsubUpdate()
    }
  })
}

function onView(k){ emit('view', k) }

// ==================== 删除功能 ====================

function onDelete(k) {
  const item = characters.value.find(p => p.key === k)
  if (!item) return
  
  deleteTarget.value = {
    key: k,
    name: item.name || getFolderName(k),
    folderPath: k.replace(/\/character\.json$/, ''),
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
      refreshCharacters()
      emit('delete', deleteTarget.value.key)
    } else {
      importError.value = result.message || t('error.deleteFailed', { error: result.error || '' })
    }
  } catch (err) {
    console.error('[CharactersPanel] Delete error:', err)
    importError.value = t('error.deleteFailed', { error: err.message || '' })
  } finally {
    deleting.value = false
    closeDeleteConfirmModal()
  }
}

const isLucide = (v) => typeof v === 'string' && /^[a-z\-]+$/.test(v)

// 判断角色卡类型是否与当前对话类型匹配
function isCharacterTypeMatch(characterType) {
  // 获取当前对话类型，默认为 threaded
  const currentType = chatSettingsStore.type || 'threaded'
  // 角色卡没有type字段时，默认为 threaded
  const charType = characterType || 'threaded'
  // 匹配规则：只有类型相同时才显示使用按钮
  return charType === currentType
}

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
  if (fileInputRef.value) {
    fileInputRef.value.click()
  }
}

function extractCharacterName(filename) {
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
  
  // 直接调用导入，后端会处理名称冲突检测
  await doImport(file, false)
  event.target.value = ''
}

async function doImport(file, overwrite = false, targetName = null) {
  importing.value = true
  importError.value = null
  
  try {
    const result = await DataCatalog.importDataFromFile('character', file, targetName, overwrite)
    if (result.success) {
      refreshCharacters()
      emit('import', result)
    } else {
      // 检查是否是需要显示专用弹窗的错误
      const errorCode = result.error || ''
      if (errorCode === 'NAME_EXISTS') {
        // 名称冲突，显示冲突弹窗
        openImportConflictModal(file, result.folder_name, result.suggested_name)
      } else if (errorCode === 'TYPE_MISMATCH' || errorCode === 'NO_TYPE_INFO' || errorCode === 'NO_TYPE_IN_FILENAME') {
        openImportErrorModal(errorCode, result.message, result.expected_type, result.actual_type)
      } else {
        importError.value = result.message || result.error || t('error.importFailed')
      }
    }
  } catch (err) {
    console.error('[CharactersPanel] Import error:', err)
    importError.value = err.message || t('error.importFailed')
  } finally {
    importing.value = false
  }
}

// 打开导入错误弹窗
function openImportErrorModal(code, message, expected, actual) {
  importErrorCode.value = code
  importErrorMessage.value = message || ''
  importExpectedType.value = expected || 'character'
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
  if (file) {
    await doImport(file, true)
  }
}

async function handleConflictRename(targetName) {
  const file = pendingImportFile.value
  closeImportConflictModal()
  if (file) {
    await doImport(file, false, targetName)
  }
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

// ==================== 新建功能 ====================

function openCreateModal() {
  showCreateModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
}

function handleCreated(result) {
  refreshCharacters()
  emit('create', result)
}
</script>

<template>
  <div
    data-scope="characters-view"
    class="ch-panel"
    :style="panelStyle"
  >
      <header class="ch-header">
        <div class="ch-title st-panel-title">
          <span class="ch-icon"><i data-lucide="users"></i></span>
          {{ t('panel.characters.title') }}
        </div>
        <div class="ch-header-actions">
          <button class="ch-action-btn st-btn-shrinkable" type="button" :title="t('panel.characters.createTitle')" @click="openCreateModal">
            <i data-lucide="plus"></i>
            <span class="st-btn-text">{{ t('common.create') }}</span>
          </button>
          <button class="ch-action-btn st-btn-shrinkable" type="button" :title="t('panel.characters.importTitle')" @click="triggerImport" :disabled="importing">
            <i data-lucide="download"></i>
            <span class="st-btn-text">{{ t('common.import') }}</span>
          </button>
          <button class="ch-action-btn st-btn-shrinkable" type="button" :title="t('panel.characters.exportTitle')" @click="openExportModal" :disabled="characters.length === 0">
            <i data-lucide="upload"></i>
            <span class="st-btn-text">{{ t('common.export') }}</span>
          </button>
          <button class="ch-close" type="button" :title="t('common.close')" @click="close">✕</button>
        </div>
      </header>

      <input ref="fileInputRef" type="file" accept=".json,.zip,.png" style="display: none;" @change="handleFileSelect" />

      <CustomScrollbar2 class="ch-body">
        <!-- 面板内容区域 - 始终存在，通过 transition 控制显示 -->
        <transition name="ch-content" mode="out-in" @after-enter="handleTransitionComplete">
          <!-- 加载状态 -->
          <div v-if="loading" key="loading" class="ch-loading">
            {{ importing ? t('common.importing') : t('common.loading') }}
          </div>
          
          <!-- 错误状态 -->
          <div v-else-if="error" key="error" class="ch-error">
            {{ importError ? importError : t('error.loadFailed', { error }) }}
            <button v-if="importError" class="ch-error-dismiss" @click="importError = null">×</button>
          </div>
          
          <!-- 内容列表 -->
          <div v-else key="content" class="ch-list">
            <div
              v-for="it in characters"
              :key="it.key"
              class="ch-card"
            >
            <div class="ch-main">
              <div class="ch-avatar-container">
                <div class="ch-icon">
                  <img v-if="it.avatarUrl" :src="it.avatarUrl" alt="" class="ch-icon-img" />
                  <i v-else-if="isLucide(it.icon)" :data-lucide="it.icon"></i>
                  <i v-else data-lucide="users"></i>
                </div>
                <div v-if="it.characterAvatarUrl" class="ch-avatar-badge">
                  <img :src="it.characterAvatarUrl" alt="" class="ch-avatar-badge-img" />
                </div>
              </div>
              <div class="ch-texts">
                <div class="ch-name-row">
                  <div class="ch-name">{{ it.name }}</div>
                  <span v-if="it.type" :class="['ch-type-badge', it.type === 'sandbox' ? 'type-sandbox' : 'type-threaded']">
                    {{ it.type === 'sandbox' ? t('panel.character.type.sandbox') : t('panel.character.type.threaded') }}
                  </span>
                </div>
                <div class="ch-folder">
                  <svg class="ch-folder-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <span>{{ getFolderName(it.key) }}</span>
                </div>
                <div class="ch-desc">{{ it.desc }}</div>
              </div>
            </div>
            <div class="ch-actions">
              <button
                v-if="isCharacterTypeMatch(it.type)"
                class="ch-btn st-btn-shrinkable"
                :class="{ active: usingKey === it.key }"
                type="button"
                @click="onUse(it.key)"
                :aria-pressed="usingKey === it.key"
              >{{ usingKey === it.key ? t('common.using') : t('common.use') }}</button>

              <button class="ch-btn st-btn-shrinkable" type="button" @click="onView(it.key)">{{ t('common.view') }}</button>

              <button class="ch-btn ch-danger st-btn-shrinkable" type="button" @click="onDelete(it.key)">{{ t('common.delete') }}</button>
            </div>
            </div>
          </div>
        </transition>
      </CustomScrollbar2>

      <!-- 使用可复用的导入冲突弹窗组件 -->
      <ImportConflictModal
        :show="showImportConflictModal"
        data-type="character"
        :data-type-name="t('panel.characters.typeName')"
        :existing-name="importConflictExistingName"
        :suggested-name="importConflictSuggestedName"
        @close="closeImportConflictModal"
        @overwrite="handleConflictOverwrite"
        @rename="handleConflictRename"
      />

      <!-- 使用可复用的导出弹窗组件 -->
      <ExportModal
        :show="showExportModal"
        data-type="character"
        :data-type-name="t('panel.characters.typeName')"
        :items="characters"
        default-icon="users"
        @close="closeExportModal"
        @export="handleExportComplete"
      />

      <!-- 导入错误弹窗 -->
      <ImportErrorModal
        :show="showImportErrorModal"
        :error-code="importErrorCode"
        :error-message="importErrorMessage"
        :data-type-name="t('panel.characters.typeName')"
        :expected-type="importExpectedType"
        :actual-type="importActualType"
        @close="closeImportErrorModal"
      />

      <!-- 删除确认弹窗 -->
      <DeleteConfirmModal
        :show="showDeleteConfirmModal"
        :item-name="deleteTarget?.name || ''"
        :data-type-name="t('panel.characters.typeName')"
        :loading="deleting"
        @close="closeDeleteConfirmModal"
        @confirm="handleDeleteConfirm"
      />

      <!-- 新建弹窗 -->
      <CreateItemModal
        :show="showCreateModal"
        data-type="character"
        :data-type-name="t('panel.characters.typeName')"
        @close="closeCreateModal"
        @created="handleCreated"
      />
    </div>
</template>

<style scoped>
.ch-panel {
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

.ch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--st-spacing-lg) var(--st-spacing-xl);
  border-bottom: 1px solid rgba(var(--st-border), var(--st-panel-header-border-alpha, 0.85));
}
.ch-title {
  display: inline-flex;
  align-items: center;
  gap: var(--st-spacing-md);
  font-weight: 700;
  color: rgb(var(--st-color-text));
}
.ch-icon i { width: var(--st-icon-md); height: var(--st-icon-md); display: inline-block; }

.ch-header-actions {
  display: flex;
  align-items: center;
  gap: var(--st-spacing-md);
}

.ch-action-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: var(--st-spacing-xs);
  border: 1px solid rgba(var(--st-primary), 0.5);
  background: rgba(var(--st-primary), 0.08);
  color: rgb(var(--st-color-text));
  border-radius: var(--st-radius-lg);
  padding: var(--st-btn-padding-sm);
  font-size: var(--st-font-sm);
  cursor: pointer;
  transition: transform var(--st-transition-normal), background var(--st-transition-normal), box-shadow var(--st-transition-normal);
}
.ch-action-btn i { width: var(--st-icon-sm); height: var(--st-icon-sm); display: inline-block; }
.ch-action-btn:hover:not(:disabled) {
  background: rgba(var(--st-primary), 0.15);
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}
.ch-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ch-close {
  appearance: none;
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface-2));
  border-radius: var(--st-radius-lg);
  padding: var(--st-spacing-sm) var(--st-spacing-md);
  cursor: pointer;
  transition: transform var(--st-transition-normal), background var(--st-transition-normal), box-shadow var(--st-transition-normal);
}
.ch-close:hover {
  background: rgb(var(--st-surface));
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

.ch-body {
  padding: var(--st-spacing-xl);
  overflow: hidden;
}
.ch-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--st-spacing-xl);
}

.ch-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--st-spacing-xl);
  align-items: stretch;
  border: 1px solid rgb(var(--st-border));
  border-radius: var(--st-radius-md);
  background: rgb(var(--st-surface));
  padding: var(--st-spacing-xl);
  min-height: var(--st-preview-height-sm);
  transition: background var(--st-transition-normal), border-color var(--st-transition-normal), transform var(--st-transition-normal), box-shadow var(--st-transition-normal);
}
.ch-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}
.ch-main {
  display: grid;
  grid-template-columns: calc(var(--st-avatar-md) + var(--st-spacing-xs) + var(--st-avatar-sm) + var(--st-spacing-xs)) 1fr;
  gap: var(--st-spacing-md);
  align-items: center;
}

.ch-avatar-container {
  position: relative;
  width: calc(var(--st-avatar-md) + var(--st-spacing-xs) + var(--st-avatar-sm) + var(--st-spacing-xs));
  height: var(--st-avatar-md);
}
.ch-icon {
  width: var(--st-avatar-md);
  height: var(--st-avatar-md);
  border-radius: var(--st-radius-lg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--st-font-xl);
  background: linear-gradient(135deg, var(--st-panel-avatar-gradient-start, rgba(var(--st-primary),0.12)), var(--st-panel-avatar-gradient-end, rgba(var(--st-accent),0.12)));
  border: 1px solid rgba(var(--st-border), 0.9);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.25);
}
.ch-icon-img { width: 100%; height: 100%; object-fit: cover; border-radius: var(--st-radius-lg); }
.ch-avatar-badge {
  position: absolute;
  left: calc(var(--st-avatar-md) + var(--st-spacing-xs));
  bottom: 0;
  width: var(--st-avatar-sm);
  height: var(--st-avatar-sm);
  border-radius: var(--st-radius-md);
  overflow: hidden;
  border: var(--st-border-width-md) solid rgb(var(--st-surface));
  box-shadow: var(--st-shadow-sm);
  background: rgb(var(--st-surface));
}
.ch-avatar-badge-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ch-texts { min-width: 0; }
.ch-name-row {
  display: flex;
  align-items: center;
  gap: var(--st-spacing-sm);
}
.ch-name {
  font-weight: 700;
  color: rgb(var(--st-color-text));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 0 1 auto;
  min-width: 0;
}
.ch-type-badge {
  display: inline-block;
  font-size: var(--st-font-xs);
  font-weight: 600;
  padding: var(--st-spacing-xs) var(--st-spacing-sm);
  border-radius: var(--st-radius-md);
  line-height: 1.2;
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-left: auto;
}
.type-threaded {
  background: var(--st-preview-badge-threaded-bg, rgba(59, 130, 246, 0.15));
  color: var(--st-preview-badge-threaded-color, rgb(59, 130, 246));
  border: 1px solid rgba(59, 130, 246, 0.3);
}
.type-sandbox {
  background: var(--st-preview-badge-sandbox-bg, rgba(168, 85, 247, 0.15));
  color: var(--st-preview-badge-sandbox-color, rgb(168, 85, 247));
  border: 1px solid rgba(168, 85, 247, 0.3);
}
[data-theme="dark"] .type-threaded,
:root[data-theme="dark"] .type-threaded {
  background: var(--st-preview-badge-threaded-bg-dark, rgba(96, 165, 250, 0.2));
  color: var(--st-preview-badge-threaded-color-dark, rgb(147, 197, 253));
  border-color: rgba(96, 165, 250, 0.4);
}
[data-theme="dark"] .type-sandbox,
:root[data-theme="dark"] .type-sandbox {
  background: var(--st-preview-badge-sandbox-bg-dark, rgba(192, 132, 252, 0.2));
  color: var(--st-preview-badge-sandbox-color-dark, rgb(216, 180, 254));
  border-color: rgba(192, 132, 252, 0.4);
}
.ch-folder {
  display: inline-flex;
  align-items: center;
  gap: var(--st-spacing-xs);
  margin-top: var(--st-spacing-xs);
  padding: var(--st-spacing-xs) var(--st-spacing-sm);
  font-size: var(--st-font-xs);
  color: rgba(var(--st-color-text), var(--st-panel-folder-color-alpha, 0.55));
  background: rgba(var(--st-border), var(--st-panel-folder-bg-alpha, 0.15));
  border-radius: var(--st-radius-md);
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  max-width: fit-content;
}
.ch-folder-icon {
  flex-shrink: 0;
  opacity: 0.7;
}
.ch-desc {
  margin-top: var(--st-spacing-xs);
  color: rgba(var(--st-color-text), 0.75);
  font-size: var(--st-font-sm);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ch-actions {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-md);
  justify-content: center;
}
.ch-btn {
  appearance: none;
  border: 1px solid rgb(var(--st-border));
  background: rgb(var(--st-surface));
  color: rgb(var(--st-color-text));
  padding: var(--st-spacing-md) var(--st-spacing-lg);
  border-radius: var(--st-radius-lg);
  font-size: var(--st-font-sm);
  cursor: pointer;
  transition: transform var(--st-transition-normal), box-shadow var(--st-transition-normal), background var(--st-transition-normal), border-color var(--st-transition-normal);
  min-width: var(--st-btn-min-width);
  text-align: center;
}
.ch-btn:focus-visible,
.ch-close:focus-visible {
  outline: 2px solid rgba(var(--st-primary), 0.6);
  outline-offset: var(--st-outline-offset);
}
.ch-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}
.ch-btn.active {
  border-color: rgba(var(--st-primary), 0.5);
  background: rgba(var(--st-primary), 0.08);
}
.ch-btn.ch-danger {
  border-color: rgba(220, 38, 38, var(--st-panel-danger-border-alpha, 0.5));
  color: rgb(var(--st-color-text));
  background: rgba(220, 38, 38, var(--st-panel-danger-bg-alpha, 0.06));
}
.ch-btn.ch-danger:hover {
  border-color: rgba(220, 38, 38, var(--st-panel-danger-hover-border, 0.7));
  background: rgba(220, 38, 38, var(--st-panel-danger-hover-bg, 0.1));
}

.ch-loading {
  padding: var(--st-spacing-xl);
  font-size: var(--st-font-base);
  color: rgba(var(--st-color-text), 0.8);
  text-align: center;
}

.ch-error {
  padding: var(--st-spacing-xl);
  font-size: var(--st-font-base);
  color: var(--st-panel-danger-color, rgb(220, 38, 38));
  display: flex;
  align-items: center;
  gap: var(--st-spacing-md);
}
.ch-error-dismiss {
  appearance: none;
  border: none;
  background: rgba(220, 38, 38, var(--st-panel-danger-hover-bg, 0.1));
  color: var(--st-panel-danger-color, rgb(220, 38, 38));
  border-radius: var(--st-radius-lg);
  padding: var(--st-spacing-xs) var(--st-spacing-sm);
  cursor: pointer;
  font-size: var(--st-font-md);
  line-height: 1;
}
.ch-error-dismiss:hover { background: rgba(220, 38, 38, 0.2); }

/* 内容过渡动画 */
.ch-content-enter-active,
.ch-content-leave-active {
  transition: opacity var(--st-transition-medium), transform var(--st-transition-medium);
}

.ch-content-enter-from {
  opacity: 0;
  transform: translateY(var(--st-panel-content-offset));
}

.ch-content-leave-to {
  opacity: 0;
  transform: translateY(calc(-1 * var(--st-panel-content-offset)));
}

@media (max-width: 640px) {
  .ch-card { grid-template-columns: 1fr; }
  .ch-actions { flex-direction: row; }
}
</style>