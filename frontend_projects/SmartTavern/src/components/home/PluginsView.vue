<script setup>
import { ref, onMounted, nextTick } from 'vue'
import DataCatalog from '@/services/dataCatalog'
import Host from '@/workflow/core/host'
import { PluginLoader } from '@/workflow/loader.js'
import ContentViewModal from '@/components/common/ContentViewModal.vue'
import PluginDetailView from '@/components/content/PluginDetailView.vue'
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal.vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

// 插件清单
const plugins = ref([])
const loading = ref(true)

// 正在处理的条目
const pending = ref({})

// 删除确认弹窗状态
const showDeleteConfirmModal = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)

// 详情面板状态
const showDetailModal = ref(false)
const detailPlugin = ref(null)
const detailPluginDir = ref('')

// 判断图标是否为 lucide 图标
const isLucide = (v) => typeof v === 'string' && /^[a-z\-]+$/.test(v)

/** 规范化插件 ID */
function mkId(file) {
  const safe = String(file || '').replace(/[^a-zA-Z0-9:_\-./]/g, '_')
  return `plg:${safe}`
}

// 从目录路径提取文件夹名称
function getFolderName(dirPath) {
  if (!dirPath) return ''
  const parts = dirPath.split('/')
  return parts[parts.length - 1] || ''
}

// 加载插件列表
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

    const res = await DataCatalog.listPlugins()
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
      // 加载图标
      const iconPath = dir ? `${dir}/icon.png` : ''
      if (iconPath) {
        try {
          const { blob } = await DataCatalog.getPluginsAssetBlob(iconPath)
          obj.avatarUrl = URL.createObjectURL(blob)
        } catch (_) {
          // ignore
        }
      }
      return obj
    }))
    plugins.value = items
  } catch (e) {
    console.warn('[PluginsView] loadPlugins failed:', e)
  } finally {
    loading.value = false
    nextTick(() => { try { window?.lucide?.createIcons?.() } catch (_) {} })
  }
}

// 启用/禁用插件
async function onToggle(it) {
  const dir = String(it?.dir || it?.key || '')
  if (!dir) return
  const id = mkId(dir)
  if (pending.value[id]) return
  pending.value[id] = true

  const name = dir.split('/').pop() || dir
  const allNames = (plugins.value || []).map(x => (String(x.dir || x.key || '').split('/').pop() || x.name || ''))
  try {
    const sw = await DataCatalog.getPluginsSwitch()
    if (!Array.isArray(sw?.enabled)) {
      Host.pushToast?.({ type: 'error', message: '缺失插件开关文件（plugins_switch.json）', timeout: 2800 })
      return
    }
    const set = new Set(sw.enabled.map(x => String(x)))

    let nextEnabled = []
    if (it.enabled) {
      // 禁用
      set.delete(name)
      nextEnabled = Array.from(set)
      const nextDisabled = allNames.filter(n => nextEnabled.indexOf(n) === -1)
      await DataCatalog.updatePluginsSwitch({ enabled: nextEnabled, disabled: nextDisabled })
      await PluginLoader.unload(id)
      it.enabled = false
      Host.pushToast?.({ type: 'info', message: `已禁用插件：${name}`, timeout: 1600 })
    } else {
      // 启用
      set.add(name)
      nextEnabled = Array.from(set)
      const nextDisabled = allNames.filter(n => nextEnabled.indexOf(n) === -1)
      await DataCatalog.updatePluginsSwitch({ enabled: nextEnabled, disabled: nextDisabled })
      await PluginLoader.loadPluginByDir(dir, { id, replace: true })
      it.enabled = true
      Host.pushToast?.({ type: 'success', message: `已启用插件：${name}`, timeout: 1600 })
    }
  } catch (e) {
    console.warn('[PluginsView] toggle failed:', e)
    Host.pushToast?.({ type: 'error', message: `操作失败：${e?.message || e}`, timeout: 2200 })
  } finally {
    delete pending.value[id]
    nextTick(() => { try { window?.lucide?.createIcons?.() } catch (_) {} })
  }
}

// 查看插件详情
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
    console.error('[PluginsView] Get plugin detail error:', err)
    Host.pushToast?.({ type: 'error', message: `获取插件详情失败：${err.message || err}`, timeout: 2200 })
  }
}

function closeDetailModal() {
  showDetailModal.value = false
  detailPlugin.value = null
  detailPluginDir.value = ''
}

function handlePluginSaved() {
  console.log('[PluginsView] Plugin saved, refreshing list')
  loadPlugins()
}

// 删除插件
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
    // 先卸载插件
    try {
      await PluginLoader.unload(id)
    } catch (_) {}
    
    // 删除插件目录
    const result = await DataCatalog.deleteDataFolder(deleteTarget.value.folderPath)
    if (result.success) {
      await loadPlugins()
      Host.pushToast?.({ type: 'success', message: `已删除插件：${deleteTarget.value.name}`, timeout: 1800 })
    } else {
      Host.pushToast?.({ type: 'error', message: result.message || t('error.deleteFailed', { error: result.error || '' }), timeout: 2200 })
    }
  } catch (err) {
    console.error('[PluginsView] Delete error:', err)
    Host.pushToast?.({ type: 'error', message: t('error.deleteFailed', { error: err.message || '' }), timeout: 2200 })
  } finally {
    deleting.value = false
    closeDeleteConfirmModal()
  }
}

onMounted(async () => {
  await loadPlugins()
  setTimeout(() => { try { window?.lucide?.createIcons?.() } catch (_) {} }, 50)
})
</script>

<template>
  <section class="home-modal-section">
    <p class="hm-desc">{{ t('home.plugins.description') }}</p>

    <div v-if="loading" class="plugins-loading">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="plugins.length === 0" class="plugins-empty">
      {{ t('home.plugins.empty') }}
    </div>

    <div v-else class="plugins-list">
      <div
        v-for="plugin in plugins"
        :key="plugin.key"
        class="plugin-card"
        :class="{ disabled: !plugin.enabled }"
      >
        <div class="plugin-main">
          <div class="plugin-avatar">
            <img v-if="plugin.avatarUrl" :src="plugin.avatarUrl" alt="" class="avatar-img" />
            <i v-else-if="isLucide(plugin.icon)" :data-lucide="plugin.icon"></i>
            <span v-else>{{ plugin.icon }}</span>
          </div>
          <div class="plugin-info">
            <div class="plugin-name">{{ plugin.name }}</div>
            <div class="plugin-folder">
              <svg class="folder-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>{{ getFolderName(plugin.dir) }}</span>
            </div>
            <div class="plugin-desc">{{ plugin.desc }}</div>
          </div>
        </div>
        
        <div class="plugin-actions">
          <button
            class="plugin-btn"
            :class="{ active: plugin.enabled }"
            type="button"
            :disabled="pending[mkId(plugin.key)]"
            @click="onToggle(plugin)"
          >
            {{ plugin.enabled ? t('common.enabled') : t('common.enable') }}
          </button>
          <button
            class="plugin-btn"
            type="button"
            :disabled="pending[mkId(plugin.key)]"
            @click="onViewPlugin(plugin)"
          >
            {{ t('common.view') }}
          </button>
          <button
            class="plugin-btn plugin-danger"
            type="button"
            :disabled="pending[mkId(plugin.key)]"
            @click="onDeletePlugin(plugin)"
          >
            {{ t('common.delete') }}
          </button>
        </div>
      </div>
    </div>
    
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
  </section>
</template>

<style scoped>
.home-modal-section {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-lg);
}

.hm-desc {
  margin: 0;
  font-size: var(--st-font-sm);
  color: rgba(var(--st-color-text), 0.7);
}

.plugins-loading,
.plugins-empty {
  padding: var(--st-spacing-2xl);
  text-align: center;
  color: rgba(var(--st-color-text), 0.6);
  font-size: var(--st-font-base);
}

.plugins-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--st-spacing-xl);
  padding-bottom: var(--st-spacing-md);
}

/* Card */
.plugin-card {
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

.plugin-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

.plugin-card.disabled {
  opacity: 0.6;
  filter: grayscale(var(--st-panel-disabled-grayscale));
}

/* Left main */
.plugin-main {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--st-spacing-md);
  align-items: center;
}

.plugin-avatar {
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

.plugin-avatar i {
  width: var(--st-icon-md);
  height: var(--st-icon-md);
  display: inline-block;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--st-radius-lg);
}

.plugin-info {
  min-width: 0;
  overflow: hidden;
}

.plugin-name {
  font-weight: 700;
  color: rgb(var(--st-color-text));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plugin-folder {
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

.folder-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.plugin-desc {
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

/* Right actions */
.plugin-actions {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-md);
  justify-content: center;
}

.plugin-btn {
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

.plugin-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

.plugin-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.plugin-btn.active {
  border-color: rgba(var(--st-primary), 0.5);
  background: rgba(var(--st-primary), 0.08);
}

.plugin-btn.plugin-danger {
  border-color: rgba(var(--st-color-error), var(--st-panel-danger-border-alpha, 0.5));
  color: rgb(var(--st-color-text));
  background: rgba(var(--st-color-error), var(--st-panel-danger-bg-alpha, 0.06));
}

.plugin-btn.plugin-danger:hover:not(:disabled) {
  border-color: rgba(var(--st-color-error), var(--st-panel-danger-hover-border, 0.7));
  background: rgba(var(--st-color-error), var(--st-panel-danger-hover-bg, 0.1));
}

@media (max-width: 1024px) {
  .plugins-list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .plugin-card {
    grid-template-columns: 1fr;
  }
  
  .plugin-actions {
    flex-direction: row;
  }
}
</style>