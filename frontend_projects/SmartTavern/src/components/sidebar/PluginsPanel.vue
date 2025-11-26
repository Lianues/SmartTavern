<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import Host from '@/workflow/core/host'
import { PluginLoader } from '@/workflow/loader.js'
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
    nextTick(() => { try { window?.lucide?.createIcons?.() } catch (_) {} })
  }
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
  
  const pluginName = extractPluginName(file.name)
  
  try {
    const checkResult = await DataCatalog.checkNameExists('plugin', pluginName)
    if (checkResult.success && checkResult.exists) {
      openImportConflictModal(file, checkResult.folder_name, checkResult.suggested_name)
      event.target.value = ''
      return
    }
  } catch (err) {
    console.warn('[PluginsPanel] Check name exists failed:', err)
  }
  
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
          Host.pushToast?.({ type: 'success', message: `已导入并启用插件：${result.name}`, timeout: 2000 })
        } catch (e) {
          console.warn('[PluginsPanel] Auto load plugin failed:', e)
          Host.pushToast?.({ type: 'warning', message: `插件已导入，但自动加载失败：${e?.message || e}`, timeout: 2800 })
        }
      } else {
        Host.pushToast?.({ type: 'success', message: `已导入插件：${result.name}`, timeout: 1800 })
      }
      
      emit('import', result)
    } else {
      importError.value = result.message || result.error || t('error.importFailed')
    }
  } catch (err) {
    console.error('[PluginsPanel] Import error:', err)
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
    data-scope="plugins-view"
    class="wf-panel glass"
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

    <CustomScrollbar class="wf-body">
      <div v-if="importing" class="wf-loading">{{ t('common.importing') }}</div>
      <div v-else-if="importError" class="wf-error">
        {{ importError }}
        <button class="wf-error-dismiss" @click="importError = null">×</button>
      </div>
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
          </div>
        </div>
      </div>
    </CustomScrollbar>

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
      @close="closeExportModal"
      @export="handleExportComplete"
    />
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
  padding: 10px 12px;
  border-bottom: 1px solid rgba(var(--st-border), 0.85);
}
.wf-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: rgb(var(--st-color-text));
}
.wf-icon i { width: 18px; height: 18px; display: inline-block; }

.wf-header-actions { display: flex; align-items: center; gap: 8px; }
.wf-action-btn { appearance: none; display: inline-flex; align-items: center; gap: 4px; border: 1px solid rgba(var(--st-primary), 0.5); background: rgba(var(--st-primary), 0.08); color: rgb(var(--st-color-text)); border-radius: 4px; padding: 6px 10px; font-size: 12px; cursor: pointer; transition: transform .2s cubic-bezier(.22,.61,.36,1), background .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1); }
.wf-action-btn i { width: 14px; height: 14px; display: inline-block; }
.wf-action-btn:hover:not(:disabled) { background: rgba(var(--st-primary), 0.15); transform: translateY(-1px); box-shadow: var(--st-shadow-sm); }
.wf-action-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.wf-close {
  appearance: none;
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface-2));
  border-radius: 4px;
  padding: 6px 8px;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.22,.61,.36,1), background .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
.wf-close:hover {
  background: rgb(var(--st-surface));
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

/* Body */
.wf-body {
  padding: 12px;
  overflow: hidden;
}
.wf-hint {
  font-size: 12px;
  color: rgba(var(--st-color-text), 0.7);
  margin-bottom: 8px;
}
.wf-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

/* Card */
.wf-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: stretch;
  border: 1px solid rgb(var(--st-border));
  border-radius: var(--st-radius-md);
  background: rgb(var(--st-surface));
  padding: 12px;
  min-height: 112px; /* 增加高度以容纳文件夹标签 */
  overflow: hidden;
  transition: background .2s cubic-bezier(.22,.61,.36,1), border-color .2s cubic-bezier(.22,.61,.36,1), transform .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
.wf-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

/* Left main */
.wf-main {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: center;
}
.wf-avatar {
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
.wf-avatar i { width: 18px; height: 18px; display: inline-block; }
.wf-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; }
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
.wf-folder-icon {
  flex-shrink: 0;
  opacity: 0.7;
}
.wf-desc {
  margin-top: 4px;
  color: rgba(var(--st-color-text), 0.75);
  font-size: 12px;
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
  margin-top: 4px;
  font-family: var(--st-font-mono, 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);
  font-size: 11px;
  color: rgba(var(--st-color-text), 0.6);
  word-break: break-all;
}

/* Right actions */
.wf-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}
.wf-btn {
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
.wf-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}
.wf-btn.active {
  border-color: rgba(var(--st-primary), 0.5);
  background: rgba(var(--st-primary), 0.08);
}
.wf-btn.wf-danger {
  border-color: rgba(220, 38, 38, 0.5);
  color: rgb(var(--st-color-text));
  background: rgba(220, 38, 38, 0.06);
}
.wf-btn.wf-danger:hover {
  border-color: rgba(220, 38, 38, 0.7);
  background: rgba(220, 38, 38, 0.1);
}

.wf-loading,
.wf-error {
  padding: 8px 12px;
  margin-bottom: 8px;
  font-size: 13px;
  color: rgba(var(--st-color-text), 0.8);
  border-radius: 4px;
}
.wf-loading { background: rgba(var(--st-primary), 0.08); }
.wf-error {
  background: rgba(220, 38, 38, 0.1);
  color: rgb(220, 38, 38);
  display: flex;
  align-items: center;
  gap: 8px;
}
.wf-error-dismiss { appearance: none; border: none; background: rgba(220, 38, 38, 0.1); color: rgb(220, 38, 38); border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 14px; line-height: 1; }
.wf-error-dismiss:hover { background: rgba(220, 38, 38, 0.2); }

@media (max-width: 640px) {
  .wf-card { grid-template-columns: 1fr; }
  .wf-actions { flex-direction: row; }
}
</style>