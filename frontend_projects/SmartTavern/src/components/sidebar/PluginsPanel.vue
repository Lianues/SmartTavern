<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import Host from '@/workflow/core/host'
import { PluginLoader } from '@/workflow/loader.js'
import DataCatalog from '@/services/dataCatalog'
import ImportConflictModal from '@/components/common/ImportConflictModal.vue'
import ImportErrorModal from '@/components/common/ImportErrorModal.vue'
import ExportModal from '@/components/common/ExportModal.vue'
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal.vue'
import ContentViewModal from '@/components/common/ContentViewModal.vue'
import PluginDetailView from '@/components/content/PluginDetailView.vue'
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

const emit = defineEmits(['close','use','delete','import','export'])

const panelStyle = computed(() => ({
  position: 'fixed',
  left: props.anchorLeft + 'px',
  top: props.top + 'px',
  bottom: props.bottom + 'px',
  width: props.width + 'px',
  zIndex: String(props.zIndex),
}))

// 插件清单：从后端扫描 plugins
const plugins = ref([])

// 加载状态
const loading = ref(true)

// 正在处理的条目（防止重复点击）
const pending = ref({})

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

// 详情面板状态
const showDetailModal = ref(false)
const detailPlugin = ref(null)
const detailPluginDir = ref('')

/** 规范化插件 ID：使用文件路径派生稳定 ID，便于 load/unload */
function mkId(file) {
  const safe = String(file || '').replace(/[^a-zA-Z0-9:_\-./]/g, '_')
  return `plg:${safe}`
}

/** 判断是否已加载（基于派生的 id） */
function isLoaded(file) {
  try {
    const id = mkId(file)
    return PluginLoader?.has?.(id) === true
  } catch (_) {
    return false
  }
}

async function onUse(dir) {
  const id = mkId(dir)
  if (pending.value[id]) return
  pending.value[id] = true
  try {
    await PluginLoader.loadPluginByDir(String(dir).replace(/\\/g, '/'), { id, replace: true })
    Host.pushToast?.({ type: 'success', message: `已加载插件：${dir}`, timeout: 1800 })
    emit('use', dir)
  } catch (e) {
    console.warn('[PluginsPanel] load plugin failed:', e)
    Host.pushToast?.({ type: 'error', message: `加载失败：${e?.message || e}`, timeout: 2200 })
  } finally {
    delete pending.value[id]
    nextTick(() => { try { window?.lucide?.createIcons?.() } catch (_) {} })
  }
}

async function onUnload(dir) {
  const realId = mkId(dir)
  if (pending.value[realId]) return
  pending.value[realId] = true
  try {
    const ok = await PluginLoader.unload(realId)
    if (ok) {
      Host.pushToast?.({ type: 'info', message: `已卸载插件：${dir}`, timeout: 1600 })
      emit('delete', dir)
    } else {
      Host.pushToast?.({ type: 'warning', message: `未找到已加载的插件实例`, timeout: 1800 })
    }
  } catch (e) {
    console.warn('[PluginsPanel] unload plugin failed:', e)
    Host.pushToast?.({ type: 'error', message: `卸载失败：${e?.message || e}`, timeout: 2200 })
  } finally {
    delete pending.value[realId]
    nextTick(() => { try { window?.lucide?.createIcons?.() } catch (_) {} })
  }
}


function close(){ emit('close') }

// ==================== 删除功能 ====================

function onDeletePlugin(it) {
  const dir = String(it?.dir || it?.key || '')
  if (!dir) return
  
  deleteTarget.value = {
    key: dir,
    name: it.name || getFolderName(dir),
    folderPath: dir,
  }
  showDeleteConfirmModal.value = true
}

function closeDeleteConfirmModal() {
  showDeleteConfirmModal.value = false
  deleteTarget.value = null
}

async function handleDeleteConfirm() {
  if (!deleteTarget.value) return
  
  const dir = deleteTarget.value.key
  const id = mkId(dir)
  
  deleting.value = true
  try {
    // 先卸载插件（如果已加载）
    try {
      await PluginLoader.unload(id)
    } catch (_) {
      // 忽略卸载错误
    }
    
    // 删除插件目录
    const result = await DataCatalog.deleteDataFolder(deleteTarget.value.folderPath)
    if (result.success) {
      // 刷新列表
      await loadPlugins()
      emit('delete', dir)
      Host.pushToast?.({ type: 'success', message: `已删除插件：${deleteTarget.value.name}`, timeout: 1800 })
    } else {
      Host.pushToast?.({ type: 'error', message: result.message || t('error.deleteFailed', { error: result.error || '' }), timeout: 2200 })
    }
  } catch (err) {
    console.error('[PluginsPanel] Delete error:', err)
    Host.pushToast?.({ type: 'error', message: t('error.deleteFailed', { error: err.message || '' }), timeout: 2200 })
  } finally {
    deleting.value = false
    closeDeleteConfirmModal()
  }
}

const isLucide = (v) => typeof v === 'string' && /^[a-z\-]+$/.test(v)

// 从目录路径提取文件夹名称
function getFolderName(dirPath) {
  if (!dirPath) return ''
  const parts = dirPath.split('/')
  // 插件目录的最后一部分就是文件夹名
  return parts[parts.length - 1] || ''
}

// 拉取后端插件清单，并富化 icon（icon.png）
async function loadPlugins() {
  loading.value = true
  try {
    const sw = await DataCatalog.getPluginsSwitch()
    if (!Array.isArray(sw?.enabled)) {
      Host.pushToast?.({ type: 'error', message: '缺失插件开关文件（plugins_switch.json）', timeout: 2800 })
      plugins.value = []
      return
    }
    const enabledArr = sw.enabled.map(x => String(x))
    const enabledSet = new Set(enabledArr)

    const res = await DataCatalog.listPlugins() // backend: smarttavern/data_catalog/list_plugins
    const arr = Array.isArray(res?.items) ? res.items : []
    const errs = Array.isArray(res?.errors) ? res.errors : []
    for (const er of errs) {
      Host.pushToast?.({ type: 'warning', message: `插件目录缺失：${er?.file || ''}`, timeout: 2600 })
    }

    const items = await Promise.all(arr.map(async (it) => {
      const dir = String(it.dir || '')
      const name = it.name || (dir.split('/').pop() || '未命名')
      const desc = it.description || ''
      const plugName = dir.split('/').pop() || dir
      const obj = {
        key: dir,
        icon: 'puzzle',
        name,
        desc,
        dir,
        enabled: (enabledSet === null ? true : enabledSet.has(plugName)),
        avatarUrl: null,
      }
      // 目录 -> icon.png
      const iconPath = dir ? `${dir}/icon.png` : ''
      if (iconPath) {
        try {
          const { blob } = await DataCatalog.getPluginsAssetBlob(iconPath)
          obj.avatarUrl = URL.createObjectURL(blob)
        } catch (_) {
          // ignore; fallback emoji/lucide
        }
      }
      return obj
    }))
    plugins.value = items
  } catch (e) {
    console.warn('[PluginsPanel] loadPlugins failed:', e)
  } finally {
    loading.value = false
    nextTick(() => { try { window?.lucide?.createIcons?.() } catch (_) {} })
  }
}

// Transition 完成后初始化图标
function handleTransitionComplete() {
  try {
    window?.lucide?.createIcons?.()
  } catch (_) {}
}

onMounted(async () => {
  await loadPlugins()
  // 初次渲染后刷新图标
  setTimeout(() => { try { window?.lucide?.createIcons?.() } catch (_) {} }, 50)
})
onUnmounted(() => {})
async function onToggle(it) {
  const dir = String(it?.dir || it?.key || '')
  if (!dir) return
  const id = mkId(dir)
  if (pending.value[id]) return
  pending.value[id] = true

  const name = dir.split('/').pop() || dir
  const allNames = (plugins.value || []).map(x => (String(x.dir || x.key || '').split('/').pop() || x.name || ''))
  try {
    // 严格开关模式：必须存在并返回 enabled 数组
    const sw = await DataCatalog.getPluginsSwitch()
    if (!Array.isArray(sw?.enabled)) {
      Host.pushToast?.({ type: 'error', message: '缺失插件开关文件（plugins_switch.json）', timeout: 2800 })
      return
    }
    const set = new Set(sw.enabled.map(x => String(x)))

    let nextEnabled = []
    if (it.enabled) {
      // 禁用：从 enabled 删除
      set.delete(name)
      nextEnabled = Array.from(set)
      const nextDisabled = allNames.filter(n => nextEnabled.indexOf(n) === -1)
      await DataCatalog.updatePluginsSwitch({ enabled: nextEnabled, disabled: nextDisabled })
      await PluginLoader.unload(id)
      it.enabled = false
      Host.pushToast?.({ type: 'info', message: `已禁用插件：${name}`, timeout: 1600 })
    } else {
      // 启用：添加到 enabled
      set.add(name)
      nextEnabled = Array.from(set)
      const nextDisabled = allNames.filter(n => nextEnabled.indexOf(n) === -1)
      await DataCatalog.updatePluginsSwitch({ enabled: nextEnabled, disabled: nextDisabled })
      await PluginLoader.loadPluginByDir(dir, { id, replace: true })
      it.enabled = true
      Host.pushToast?.({ type: 'success', message: `已启用插件：${name}`, timeout: 1600 })
    }
  } catch (e) {
    console.warn('[PluginsPanel] toggle failed:', e)
    Host.pushToast?.({ type: 'error', message: `操作失败：${e?.message || e}`, timeout: 2200 })
  } finally {
    delete pending.value[id]
    nextTick(() => { try { window?.lucide?.createIcons?.() } catch (_) {} })
  }
}

// ==================== 导入功能 ====================

function triggerImport() {
  importError.value = null
  if (fileInputRef.value) fileInputRef.value.click()
}

function extractPluginName(filename) {
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
    const result = await DataCatalog.importDataFromFile('plugin', file, targetName, overwrite)
    if (result.success) {
      // 刷新插件列表
      await loadPlugins()
      
      // 如果插件已注册，自动加载
      if (result.registered) {
        const pluginDir = `backend_projects/SmartTavern/plugins/${result.folder}`
        const id = mkId(pluginDir)
        try {
          await PluginLoader.loadPluginByDir(pluginDir, { id, replace: true })
          Host.pushToast?.({ type: 'success', message: t('toast.plugin.importedAndEnabled', { name: result.name }), timeout: 2000 })
        } catch (e) {
          console.warn('[PluginsPanel] Auto load plugin failed:', e)
          Host.pushToast?.({ type: 'warning', message: t('toast.plugin.importAutoLoadFailed', { error: e?.message || e }), timeout: 2800 })
        }
      } else {
        Host.pushToast?.({ type: 'success', message: t('toast.plugin.imported', { name: result.name }), timeout: 1800 })
      }
      
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
    console.error('[PluginsPanel] Import error:', err)
    importError.value = err.message || t('error.importFailed')
  } finally {
    importing.value = false
  }
}

// 打开导入错误弹窗
function openImportErrorModal(code, message, expected, actual) {
  importErrorCode.value = code
  importErrorMessage.value = message || ''
  importExpectedType.value = expected || 'plugin'
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

// ==================== 详情面板功能 ====================

async function onViewPlugin(it) {
  const dir = String(it?.dir || it?.key || '')
  if (!dir) return
  
  try {
    const result = await DataCatalog.getPluginDetail(dir)
    if (result.error) {
      Host.pushToast?.({ type: 'error', message: `获取插件详情失败：${result.message || result.error}`, timeout: 2200 })
      return
    }
    
    detailPlugin.value = result.content || {}
    detailPluginDir.value = dir
    showDetailModal.value = true
  } catch (err) {
    console.error('[PluginsPanel] Get plugin detail error:', err)
    Host.pushToast?.({ type: 'error', message: `获取插件详情失败：${err.message || err}`, timeout: 2200 })
  }
}

function closeDetailModal() {
  showDetailModal.value = false
  detailPlugin.value = null
  detailPluginDir.value = ''
}

function handlePluginSaved(payload) {
  console.log('[PluginsPanel] Plugin saved, refreshing list')
  loadPlugins()
}
</script>

<template>
  <div
    data-scope="plugins-view"
    class="wf-panel"
    :style="panelStyle"
  >
    <header class="wf-header">
      <div class="wf-title st-panel-title">
        <span class="wf-icon"><i data-lucide="puzzle"></i></span>
        {{ t('panel.plugins.title') }}
      </div>
      <div class="wf-header-actions">
        <button class="wf-action-btn st-btn-shrinkable" type="button" :title="t('panel.plugins.importTitle')" @click="triggerImport" :disabled="importing">
          <i data-lucide="download"></i><span class="st-btn-text">{{ t('common.import') }}</span>
        </button>
        <button class="wf-action-btn st-btn-shrinkable" type="button" :title="t('panel.plugins.exportTitle')" @click="openExportModal" :disabled="plugins.length === 0">
          <i data-lucide="upload"></i><span class="st-btn-text">{{ t('common.export') }}</span>
        </button>
        <button class="wf-close" type="button" :title="t('common.close')" @click="close">✕</button>
      </div>
    </header>
    <input ref="fileInputRef" type="file" accept=".json,.zip,.png" style="display: none;" @change="handleFileSelect" />

    <CustomScrollbar2 class="wf-body">
      <transition name="wf-content" mode="out-in" @after-enter="handleTransitionComplete">
        <div v-if="loading || importing" key="loading" class="wf-loading">
          {{ importing ? t('common.importing') : t('common.loading') }}
        </div>
        
        <div v-else-if="importError" key="error" class="wf-error">
          {{ importError }}
          <button class="wf-error-dismiss" @click="importError = null">×</button>
        </div>
        
        <div v-else key="content" class="wf-content">
          <div class="wf-hint">{{ t('panel.plugins.hint') }}</div>

          <div class="wf-list">
        <div
          v-for="it in plugins"
          :key="it.key"
          class="wf-card"
        >
          <div class="wf-main">
            <div class="wf-avatar">
              <img v-if="it.avatarUrl" :src="it.avatarUrl" alt="" class="wf-avatar-img" />
              <i v-else-if="isLucide(it.icon)" :data-lucide="it.icon"></i>
              <span v-else>{{ it.icon }}</span>
            </div>
            <div class="wf-texts">
              <div class="wf-name">{{ it.name }}</div>
              <div class="wf-folder">
                <svg class="wf-folder-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>{{ getFolderName(it.dir) }}</span>
              </div>
              <div class="wf-desc">{{ it.desc }}</div>
            </div>
          </div>


          <div class="wf-actions">
            <button
              class="wf-btn st-btn-shrinkable"
              :class="{ active: it.enabled }"
              type="button"
              :disabled="pending[mkId(it.key)]"
              @click="onToggle(it)"
            >
              {{ it.enabled ? t('common.enabled') : t('common.enable') }}
            </button>
            <button
              class="wf-btn st-btn-shrinkable"
              type="button"
              :disabled="pending[mkId(it.key)]"
              @click="onViewPlugin(it)"
            >
              {{ t('common.view') }}
            </button>
            <button
              class="wf-btn wf-danger st-btn-shrinkable"
              type="button"
              :disabled="pending[mkId(it.key)]"
              @click="onDeletePlugin(it)"
            >
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
          </div>
        </div>
      </transition>
    </CustomScrollbar2>

    <!-- 使用可复用的导入冲突弹窗组件 -->
    <ImportConflictModal
      :show="showImportConflictModal"
      data-type="plugin"
      :data-type-name="t('panel.plugins.typeName')"
      :existing-name="importConflictExistingName"
      :suggested-name="importConflictSuggestedName"
      @close="closeImportConflictModal"
      @overwrite="handleConflictOverwrite"
      @rename="handleConflictRename"
    />

    <!-- 使用可复用的导出弹窗组件 -->
    <ExportModal
      :show="showExportModal"
      data-type="plugin"
      :data-type-name="t('panel.plugins.typeName')"
      :items="plugins"
      default-icon="puzzle"
      :use-key-as-path="true"
      :hide-json-format="true"
      @close="closeExportModal"
      @export="handleExportComplete"
    />

    <!-- 导入错误弹窗 -->
    <ImportErrorModal
      :show="showImportErrorModal"
      :error-code="importErrorCode"
      :error-message="importErrorMessage"
      :data-type-name="t('panel.plugins.typeName')"
      :expected-type="importExpectedType"
      :actual-type="importActualType"
      @close="closeImportErrorModal"
    />

    <!-- 删除确认弹窗 -->
    <DeleteConfirmModal
      :show="showDeleteConfirmModal"
      :item-name="deleteTarget?.name || ''"
      :data-type-name="t('panel.plugins.typeName')"
      :loading="deleting"
      @close="closeDeleteConfirmModal"
      @confirm="handleDeleteConfirm"
    />

    <!-- 详情面板 -->
    <ContentViewModal
      :show="showDetailModal"
      :title="t('panel.plugins.detailTitle')"
      @close="closeDetailModal"
    >
      <PluginDetailView
        :plugin-data="detailPlugin"
        :dir="detailPluginDir"
        @saved="handlePluginSaved"
      />
    </ContentViewModal>
  </div>
</template>

<style scoped>
.wf-panel {
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
.wf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--st-spacing-lg) var(--st-spacing-xl);
  border-bottom: 1px solid rgba(var(--st-border), var(--st-panel-header-border-alpha, 0.85));
}
.wf-title {
  display: inline-flex;
  align-items: center;
  gap: var(--st-spacing-md);
  font-weight: 700;
  color: rgb(var(--st-color-text));
}
.wf-icon i { width: var(--st-icon-md); height: var(--st-icon-md); display: inline-block; }

.wf-header-actions { display: flex; align-items: center; gap: var(--st-spacing-md); }
.wf-action-btn { appearance: none; display: inline-flex; align-items: center; gap: var(--st-spacing-xs); border: 1px solid rgba(var(--st-primary), 0.5); background: rgba(var(--st-primary), 0.08); color: rgb(var(--st-color-text)); border-radius: var(--st-radius-lg); padding: var(--st-btn-padding-sm); font-size: var(--st-font-sm); cursor: pointer; transition: transform var(--st-transition-normal), background var(--st-transition-normal), box-shadow var(--st-transition-normal); }
.wf-action-btn i { width: var(--st-icon-sm); height: var(--st-icon-sm); display: inline-block; }
.wf-action-btn:hover:not(:disabled) { background: rgba(var(--st-primary), 0.15); transform: translateY(-1px); box-shadow: var(--st-shadow-sm); }
.wf-action-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.wf-close {
  appearance: none;
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface-2));
  border-radius: var(--st-radius-lg);
  padding: var(--st-spacing-sm) var(--st-spacing-md);
  cursor: pointer;
  transition: transform var(--st-transition-normal), background var(--st-transition-normal), box-shadow var(--st-transition-normal);
}
.wf-close:hover {
  background: rgb(var(--st-surface));
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

/* Body */
.wf-body {
  padding: var(--st-spacing-xl);
  overflow: hidden;
}
.wf-hint {
  font-size: var(--st-font-sm);
  color: rgba(var(--st-color-text), 0.7);
  margin-bottom: var(--st-spacing-md);
}
.wf-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--st-spacing-xl);
}

/* Card */
.wf-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--st-spacing-xl);
  align-items: stretch;
  border: 1px solid rgb(var(--st-border));
  border-radius: var(--st-radius-md);
  background: rgb(var(--st-surface));
  padding: var(--st-spacing-xl);
  min-height: var(--st-preview-height-sm);
  overflow: hidden;
  transition: background var(--st-transition-normal), border-color var(--st-transition-normal), transform var(--st-transition-normal), box-shadow var(--st-transition-normal);
}
.wf-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

/* Left main */
.wf-main {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--st-spacing-md);
  align-items: center;
}
.wf-avatar {
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
.wf-avatar i { width: var(--st-icon-md); height: var(--st-icon-md); display: inline-block; }
.wf-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: var(--st-radius-lg); }
.wf-texts {
  min-width: 0;
  overflow: hidden;
}
.wf-name {
  font-weight: 700;
  color: rgb(var(--st-color-text));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wf-folder {
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
.wf-folder-icon {
  flex-shrink: 0;
  opacity: 0.7;
}
.wf-desc {
  margin-top: var(--st-spacing-xs);
  color: rgba(var(--st-color-text), 0.75);
  font-size: var(--st-font-sm);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}
.wf-url {
  margin-top: var(--st-spacing-xs);
  font-family: var(--st-font-mono, 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);
  font-size: var(--st-font-xs);
  color: rgba(var(--st-color-text), 0.6);
  word-break: break-all;
}

/* Right actions */
.wf-actions {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-md);
  justify-content: center;
}
.wf-btn {
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
.wf-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}
.wf-btn.active {
  border-color: rgba(var(--st-primary), 0.5);
  background: rgba(var(--st-primary), 0.08);
}
.wf-btn.wf-danger {
  border-color: rgba(220, 38, 38, var(--st-panel-danger-border-alpha, 0.5));
  color: rgb(var(--st-color-text));
  background: rgba(220, 38, 38, var(--st-panel-danger-bg-alpha, 0.06));
}
.wf-btn.wf-danger:hover {
  border-color: rgba(220, 38, 38, var(--st-panel-danger-hover-border, 0.7));
  background: rgba(220, 38, 38, var(--st-panel-danger-hover-bg, 0.1));
}

.wf-loading {
  padding: var(--st-spacing-xl);
  font-size: var(--st-font-base);
  color: rgba(var(--st-color-text), 0.8);
  text-align: center;
}

.wf-error {
  padding: var(--st-spacing-md) var(--st-spacing-xl);
  margin-bottom: var(--st-spacing-md);
  font-size: var(--st-font-base);
  background: rgba(220, 38, 38, var(--st-panel-danger-hover-bg, 0.1));
  color: var(--st-panel-danger-color, rgb(220, 38, 38));
  display: flex;
  align-items: center;
  gap: var(--st-spacing-md);
  border-radius: var(--st-radius-lg);
}

.wf-error-dismiss {
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

.wf-error-dismiss:hover { background: rgba(220, 38, 38, 0.2); }

/* 内容过渡动画 */
.wf-content-enter-active,
.wf-content-leave-active {
  transition: opacity var(--st-transition-medium), transform var(--st-transition-medium);
}

.wf-content-enter-from {
  opacity: 0;
  transform: translateY(var(--st-panel-content-offset));
}

.wf-content-leave-to {
  opacity: 0;
  transform: translateY(calc(-1 * var(--st-panel-content-offset)));
}

@media (max-width: 640px) {
  .wf-card { grid-template-columns: 1fr; }
  .wf-actions { flex-direction: row; }
}
</style>