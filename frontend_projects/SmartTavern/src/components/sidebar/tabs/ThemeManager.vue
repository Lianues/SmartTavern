<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import ThemeManager from '@/features/themes/manager'
import StylesService from '@/services/stylesService'
import ExportModal from '@/components/common/ExportModal.vue'
import ImportConflictModal from '@/components/common/ImportConflictModal.vue'
import DeleteConfirmModal from '@/components/common/DeleteConfirmModal.vue'
import ContentViewModal from '@/components/common/ContentViewModal.vue'
import ThemeDetailView from '@/components/content/ThemeDetailView.vue'
import { useI18n } from '@/locales'
import { useCustomDrag } from '@/composables/useCustomDrag'

const { t } = useI18n()

/** 刷新 Lucide 图标 */
function refreshLucideIcons() {
  nextTick(() => {
    try { window?.lucide?.createIcons?.() } catch (_) {}
  })
}

// 当前主题状态
const themeInfo = ref(null)
let off = null

// 后端主题列表
const backendThemes = ref([])
const loadingThemes = ref(false)
const loadError = ref('')

// 主题图标缓存 (dir -> blob URL) - 使用普通对象代替 Map 以获得更好的响应式支持
const iconCache = ref({})

// 加载状态
const applyingTheme = ref('')
const deletingTheme = ref('')

// 导入导出状态
const importInputRef = ref(null)
const importing = ref(false)
const showExportModal = ref(false)
const showConflictModal = ref(false)
const conflictInfo = ref(null)
const pendingImportData = ref(null)

// 详情面板状态
const showDetailModal = ref(false)
const detailTheme = ref(null)
const detailThemeDir = ref('')

// 删除确认弹窗状态
const showDeleteConfirmModal = ref(false)
const deleteTarget = ref(null)

// 计算属性：过滤启用/禁用的主题
const enabledThemes = computed(() => backendThemes.value.filter(t => t.enabled))
const disabledThemes = computed(() => backendThemes.value.filter(t => !t.enabled))

// 拖拽排序状态
const savingOrder = ref(false)

onMounted(async () => {
  try {
    themeInfo.value = ThemeManager.getCurrentTheme?.() || null
    off = ThemeManager.on?.('change', () => {
      themeInfo.value = ThemeManager.getCurrentTheme?.() || null
    })
  } catch (_) {}
  
  // 加载后端主题列表
  await loadBackendThemes()
  
  // 刷新 lucide 图标
  refreshLucideIcons()
})

onBeforeUnmount(() => {
  try { off?.() } catch (_) {}
  off = null
  
  // 清理图标 blob URLs
  for (const url of Object.values(iconCache.value)) {
    try { URL.revokeObjectURL(url) } catch (_) {}
  }
  iconCache.value = {}
})

/**
 * 从后端加载主题列表
 */
async function loadBackendThemes() {
  loadingThemes.value = true
  loadError.value = ''
  try {
    const res = await StylesService.listThemes()
    backendThemes.value = res.items || []
    
    // 等待 DOM 更新完成后再加载图标，避免响应式更新冲突
    await nextTick()
    
    // 加载所有主题的图标（不等待完成，避免阻塞）
    const iconLoadPromises = []
    for (const theme of backendThemes.value) {
      if (theme.icon && !(theme.dir in iconCache.value)) {
        iconLoadPromises.push(loadThemeIcon(theme))
      }
    }
    
    // 等待所有图标加载完成
    if (iconLoadPromises.length > 0) {
      await Promise.allSettled(iconLoadPromises)
    }
    
    // 刷新 lucide 图标
    refreshLucideIcons()
  } catch (err) {
    loadError.value = err.message || String(err)
    console.warn('[ThemeManagerTab] Load backend themes failed:', err)
  } finally {
    loadingThemes.value = false
  }
}

/**
 * 加载主题图标
 */
async function loadThemeIcon(theme) {
  if (!theme.icon) return
  try {
    const res = await StylesService.getThemeAssetBlob(theme.icon)
    const url = URL.createObjectURL(res.blob)
    // 使用 nextTick 确保在安全的时机更新响应式状态
    await nextTick()
    iconCache.value = { ...iconCache.value, [theme.dir]: url }
  } catch (err) {
    console.warn(`[ThemeManagerTab] Load icon failed for ${theme.name || theme.dir}:`, err)
  }
}

/**
 * 获取主题图标 URL
 */
function getThemeIconUrl(theme) {
  if (!theme) return ''
  return iconCache.value[theme.dir] || ''
}

/**
 * 切换主题的启用/禁用状态（支持多主题叠加）
 */
async function onToggleTheme(theme) {
  if (!theme || !theme.dir) return
  
  applyingTheme.value = theme.dir
  try {
    // 切换启用状态
    const newEnabled = !theme.enabled
    await StylesService.setThemeEnabled(theme.dir, newEnabled)
    
    console.info(`[ThemeManagerTab] Theme ${newEnabled ? 'enabled' : 'disabled'}: ${theme.name || theme.dir}`)
    
    // 刷新主题列表
    await loadBackendThemes()
    
    // 应用所有启用主题的合并包
    await applyAllEnabledThemes()
    
    // 刷新 Lucide 图标（主题切换后需要重新渲染）
    refreshLucideIcons()
  } catch (err) {
    console.warn('[ThemeManagerTab] Toggle theme failed:', err)
    alert(t('error.operationFailed', { error: err.message || String(err) }))
  } finally {
    applyingTheme.value = ''
    // 确保在 finally 中也刷新图标
    refreshLucideIcons()
  }
}

/**
 * 应用所有启用主题的合并包
 */
async function applyAllEnabledThemes() {
  try {
    const res = await StylesService.getAllEnabledThemes()
    
    if (res.enabled_count === 0 || !res.merged_pack) {
      // 没有启用的主题，重置为默认
      await ThemeManager.resetTheme({ persist: true })
      console.info('[ThemeManagerTab] No enabled themes, reset to default')
      // 主题重置后刷新图标
      await nextTick()
      refreshLucideIcons()
      return
    }
    
    // 应用合并后的主题包
    await ThemeManager.applyThemePack(res.merged_pack, { persist: true })
    console.info(`[ThemeManagerTab] Applied ${res.enabled_count} merged themes:`, res.enabled_themes)
    
    // 主题应用后等待 DOM 更新，然后刷新图标
    await nextTick()
    refreshLucideIcons()
  } catch (err) {
    console.warn('[ThemeManagerTab] Apply merged themes failed:', err)
  }
}

/**
 * 删除后端主题 - 显示确认弹窗
 */
function onDeleteBackendTheme(theme) {
  if (!theme || !theme.dir) return
  
  deleteTarget.value = {
    key: theme.dir,
    name: theme.name || theme.dir.split('/').pop() || '',
    folderPath: theme.dir,
  }
  showDeleteConfirmModal.value = true
}

/**
 * 关闭删除确认弹窗
 */
function closeDeleteConfirmModal() {
  showDeleteConfirmModal.value = false
  deleteTarget.value = null
}

/**
 * 确认删除主题
 */
async function handleDeleteConfirm() {
  if (!deleteTarget.value) return
  
  deletingTheme.value = deleteTarget.value.key
  try {
    const res = await StylesService.deleteTheme(deleteTarget.value.folderPath)
    if (!res.success) {
      throw new Error(res.message || res.error || 'Delete failed')
    }
    console.info(`[ThemeManagerTab] Deleted theme: ${deleteTarget.value.name}`)
    // 刷新列表
    await loadBackendThemes()
  } catch (err) {
    console.warn('[ThemeManagerTab] Delete theme failed:', err)
    alert(t('error.deleteFailed', { error: err.message || String(err) }))
  } finally {
    deletingTheme.value = ''
    closeDeleteConfirmModal()
  }
}

/**
 * 从本地文件导入主题（通过 data_import API）
 */
async function onThemeFileSelected(e) {
  const file = e?.target?.files?.[0]
  if (!file) return
  
  importing.value = true
  try {
    const res = await StylesService.importStyleFromFile(file)
    
    if (res.success) {
      console.info(`[ThemeManagerTab] Theme imported: ${res.name || res.folder}`)
      // 刷新列表
      await loadBackendThemes()
      // 如果导入时自动启用了主题，应用所有启用的主题
      await applyAllEnabledThemes()
      // 确保图标正确渲染
      await nextTick()
      refreshLucideIcons()
    } else if (res.error === 'NAME_EXISTS') {
      // 名称冲突，显示冲突弹窗
      conflictInfo.value = {
        name: res.folder_name,
        suggestedName: res.suggested_name,
        typeName: t('appearance.theme.typeName'),
      }
      pendingImportData.value = { file }
      showConflictModal.value = true
    } else {
      // 其他错误
      alert(res.message || res.error || t('error.importFailed'))
    }
  } catch (err) {
    console.warn('[ThemeManagerTab] Theme import failed:', err)
    alert(err.message || t('error.importFailed'))
  } finally {
    importing.value = false
    try { e.target.value = '' } catch (_) {}
  }
}

/**
 * 触发文件选择（导入）
 */
function triggerImport() {
  importInputRef.value?.click()
}

/**
 * 处理导入冲突：覆盖
 */
async function onConflictOverwrite() {
  if (!pendingImportData.value?.file) return
  
  showConflictModal.value = false
  importing.value = true
  
  try {
    const res = await StylesService.importStyleFromFile(
      pendingImportData.value.file,
      undefined,
      true // overwrite
    )
    
    if (res.success) {
      console.info(`[ThemeManagerTab] Theme imported (overwrite): ${res.name || res.folder}`)
      await loadBackendThemes()
      // 如果导入时自动启用了主题，应用所有启用的主题
      await applyAllEnabledThemes()
      // 确保图标正确渲染
      await nextTick()
      refreshLucideIcons()
    } else {
      alert(res.message || res.error || t('error.importFailed'))
    }
  } catch (err) {
    console.warn('[ThemeManagerTab] Theme import (overwrite) failed:', err)
    alert(err.message || t('error.importFailed'))
  } finally {
    importing.value = false
    pendingImportData.value = null
    conflictInfo.value = null
  }
}

/**
 * 处理导入冲突：重命名
 */
async function onConflictRename(newName) {
  if (!pendingImportData.value?.file || !newName) return
  
  showConflictModal.value = false
  importing.value = true
  
  try {
    const res = await StylesService.importStyleFromFile(
      pendingImportData.value.file,
      newName,
      false
    )
    
    if (res.success) {
      console.info(`[ThemeManagerTab] Theme imported (renamed): ${res.name || res.folder}`)
      await loadBackendThemes()
      // 如果导入时自动启用了主题，应用所有启用的主题
      await applyAllEnabledThemes()
      // 确保图标正确渲染
      await nextTick()
      refreshLucideIcons()
    } else if (res.error === 'NAME_EXISTS') {
      // 新名称仍然冲突
      conflictInfo.value = {
        name: res.folder_name,
        suggestedName: res.suggested_name,
        typeName: t('appearance.theme.typeName'),
      }
      showConflictModal.value = true
    } else {
      alert(res.message || res.error || t('error.importFailed'))
    }
  } catch (err) {
    console.warn('[ThemeManagerTab] Theme import (rename) failed:', err)
    alert(err.message || t('error.importFailed'))
  } finally {
    importing.value = false
  }
}

/**
 * 取消导入冲突处理
 */
function onConflictCancel() {
  showConflictModal.value = false
  pendingImportData.value = null
  conflictInfo.value = null
}

/**
 * 打开导出弹窗
 */
function openExportModal() {
  showExportModal.value = true
  refreshLucideIcons()
}

/**
 * 关闭导出弹窗
 */
function closeExportModal() {
  showExportModal.value = false
}

/**
 * 导出成功回调
 */
function onExportSuccess(data) {
  console.info(`[ThemeManagerTab] Theme exported: ${data.item}`)
}

/**
 * 查看主题详情
 */
async function onViewTheme(theme) {
  if (!theme || !theme.dir) return
  
  try {
    // 获取主题详情
    const detail = await StylesService.getThemeDetail(theme.dir)
    if (detail.error) {
      alert(t('error.loadFailed', { error: detail.message || detail.error }))
      return
    }
    
    detailTheme.value = detail
    detailThemeDir.value = theme.dir
    showDetailModal.value = true
    
    // 刷新图标
    await nextTick()
    refreshLucideIcons()
  } catch (err) {
    console.warn('[ThemeManager] Load theme detail failed:', err)
    alert(t('error.loadFailed', { error: err.message || String(err) }))
  }
}

/**
 * 关闭详情面板
 */
function closeDetailModal() {
  showDetailModal.value = false
  detailTheme.value = null
  detailThemeDir.value = ''
}

/**
 * 主题保存成功后刷新列表
 */
function handleThemeSaved(payload) {
  console.log('[ThemeManager] Theme saved, refreshing list')
  loadBackendThemes()
}

/**
 * 计算导出列表项
 */
const exportItems = computed(() => {
  return backendThemes.value.map(theme => ({
    key: theme.dir, // 使用目录路径作为 key（用于导出）
    name: theme.name || theme.dir.split('/').pop(),
    avatarUrl: getThemeIconUrl(theme),
    desc: theme.description || '',
  }))
})

/**
 * 重置主题
 */
async function onThemeReset() {
  try {
    await ThemeManager.resetTheme({ persist: true })
  } catch (err) {
    console.warn('[ThemeManagerTab] Theme reset failed:', err)
  }
}

/**
 * 检查主题是否已启用（支持多主题）
 */
function isThemeEnabled(theme) {
  if (!theme) return false
  return theme.enabled === true
}

/**
 * 获取启用的主题数量
 */
const enabledCount = computed(() => backendThemes.value.filter(t => t.enabled).length)

// ==================== 拖拽排序功能 ====================

/**
 * 从主题目录路径提取文件夹名称
 */
function getThemeFolderName(theme) {
  if (!theme || !theme.dir) return ''
  return theme.dir.split('/').pop() || ''
}

// 主题拖拽 - 使用 composable
const {
  dragging,
  dragOverId,
  dragOverBefore,
  startDrag,
} = useCustomDrag({
  scrollContainerSelector: '.theme-list .scroll-container2',
  itemSelector: '.theme-item',
  dataAttribute: 'data-theme-dir',
  onReorder: async (draggedId, targetId, insertBefore) => {
    const list = [...backendThemes.value]
    const draggedIdStr = String(draggedId)
    const targetIdStr = targetId ? String(targetId) : null
    
    const fromIdx = list.findIndex(t => String(t.dir) === draggedIdStr)
    
    if (fromIdx >= 0 && draggedIdStr !== targetIdStr) {
      // 提取文件夹名称列表用于排序
      let folderNames = list.map(t => getThemeFolderName(t))
      const fromName = getThemeFolderName(list[fromIdx])
      const fromNameIdx = folderNames.indexOf(fromName)
      
      if (fromNameIdx >= 0) {
        // 移除原位置
        folderNames.splice(fromNameIdx, 1)
        
        if (targetIdStr) {
          const targetTheme = list.find(t => String(t.dir) === targetIdStr)
          if (targetTheme) {
            const toName = getThemeFolderName(targetTheme)
            const toIdx = folderNames.indexOf(toName)
            let insertIdx = toIdx < 0 ? folderNames.length : toIdx + (insertBefore ? 0 : 1)
            if (insertIdx < 0) insertIdx = 0
            if (insertIdx > folderNames.length) insertIdx = folderNames.length
            folderNames.splice(insertIdx, 0, fromName)
          }
        } else {
          folderNames.push(fromName)
        }
        
        // 保存新顺序到后端
        savingOrder.value = true
        try {
          await StylesService.updateThemesOrder(folderNames)
          console.info('[ThemeManagerTab] Theme order updated:', folderNames)
          // 刷新主题列表
          await loadBackendThemes()
        } catch (err) {
          console.warn('[ThemeManagerTab] Update theme order failed:', err)
        } finally {
          savingOrder.value = false
          refreshLucideIcons()
        }
      }
    }
  },
  getTitleForItem: (id) => {
    const theme = backendThemes.value.find(t => String(t.dir) === String(id))
    return theme?.name || id
  }
})
</script>

<template>
  <div class="st-tab-panel" data-scope="settings-theme">
    <!-- 标题区域：标题在左，导入导出按钮在右 -->
    <div class="theme-header">
      <h3>{{ t('appearance.theme.title') }}</h3>
      <div class="theme-header-actions">
        <button
          class="st-action-btn"
          type="button"
          @click="triggerImport"
          :disabled="importing"
        >
          <i data-lucide="download" class="action-icon"></i>
          {{ importing ? t('common.importing') : t('common.import') }}
        </button>
        <button
          class="st-action-btn"
          type="button"
          @click="openExportModal"
          :disabled="backendThemes.length === 0"
        >
          <i data-lucide="upload" class="action-icon"></i>
          {{ t('common.export') }}
        </button>
      </div>
    </div>
    
    <!-- 隐藏的文件选择输入 -->
    <input
      ref="importInputRef"
      type="file"
      accept=".zip,.png"
      style="display: none;"
      @change="onThemeFileSelected"
    />
    
    <p class="muted">{{ t('appearance.theme.desc') }}</p>

    <!-- 后端主题列表 -->
    <div class="st-control theme-list-section">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.theme.backendThemes') || '后端主题' }}</span>
      </label>
      
      <!-- 加载错误 -->
      <div v-if="loadError" class="theme-error">
        {{ loadError }}
      </div>
      
      <!-- 主题列表 -->
      <CustomScrollbar2 v-else class="theme-list">
        <div v-if="loadingThemes" class="theme-loading">
          {{ t('common.loading') }}
        </div>
        
        <div v-else-if="backendThemes.length === 0" class="theme-empty">
          {{ t('common.noData') }}
        </div>
        
        <div v-else class="theme-items">
          <div
            v-for="theme in backendThemes"
            :key="theme.dir"
            class="theme-item"
            :class="{
              'theme-item--enabled': isThemeEnabled(theme),
              'theme-item--dragging': dragging && String(dragging.id) === String(theme.dir),
              'theme-item--drag-over-top': dragOverId && String(dragOverId) === String(theme.dir) && dragOverBefore,
              'theme-item--drag-over-bottom': dragOverId && String(dragOverId) === String(theme.dir) && !dragOverBefore
            }"
            :data-theme-dir="theme.dir"
          >
            <!-- 拖拽手柄 -->
            <div
              class="theme-item-grip"
              @mousedown="startDrag(theme.dir, $event)"
              :title="t('common.dragToSort')"
            >
              <i data-lucide="grip-vertical" class="grip-icon"></i>
            </div>
            
            <!-- 启用复选框 -->
            <div class="theme-item-checkbox">
              <input
                type="checkbox"
                :checked="isThemeEnabled(theme)"
                @change="onToggleTheme(theme)"
                :disabled="applyingTheme === theme.dir"
              />
            </div>
            
            <!-- 主题图标 -->
            <div class="theme-item-icon">
              <img
                v-if="getThemeIconUrl(theme)"
                :src="getThemeIconUrl(theme)"
                :alt="theme.name || 'Theme icon'"
                class="theme-icon-img"
              />
              <i v-else data-lucide="palette" class="theme-icon-lucide"></i>
            </div>
            
            <div class="theme-item-info">
              <div class="theme-item-name">
                {{ theme.name || theme.dir.split('/').pop() }}
              </div>
              <div class="theme-item-folder" :title="theme.dir">
                <i data-lucide="folder" class="folder-icon"></i>
                {{ theme.dir.split('/').pop() }}
              </div>
              <div class="theme-item-desc" v-if="theme.description">
                {{ theme.description }}
              </div>
              <div class="theme-item-entries" v-if="theme.entries && theme.entries.length">
                <span class="theme-entry-count">{{ theme.entries.length }} {{ t('common.file') }}</span>
              </div>
            </div>
            <div class="theme-item-actions">
              <button
                class="st-btn st-btn--view"
                type="button"
                @click="onViewTheme(theme)"
              >
                {{ t('common.view') }}
              </button>
              <button
                class="st-btn st-btn--delete"
                type="button"
                @click="onDeleteBackendTheme(theme)"
                :disabled="deletingTheme === theme.dir"
              >
                {{ deletingTheme === theme.dir ? t('common.loading') : t('common.delete') }}
              </button>
            </div>
          </div>
        </div>
      </CustomScrollbar2>
    </div>

    <!-- 多主题说明 -->
    <div class="st-control theme-info-section">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.theme.multiThemeInfo') || '多主题叠加' }}</span>
        <div class="value-group">
          <span class="unit">{{ enabledCount }} {{ t('common.enabled') }}</span>
        </div>
      </label>
      <p class="muted theme-multi-hint">
        {{ t('appearance.theme.multiThemeHint') || '支持同时启用多个主题。排序靠前的主题优先级更高，会覆盖后面主题的相同样式。' }}
      </p>
      <div class="theme-actions" style="margin-top:8px; display:flex; gap:8px;">
        <button class="st-settings-close" type="button" @click="onThemeReset">{{ t('appearance.theme.resetDefault') }}</button>
      </div>
    </div>

    
    <!-- 导出弹窗 -->
    <ExportModal
      :show="showExportModal"
      data-type="style"
      :data-type-name="t('appearance.theme.typeName')"
      :items="exportItems"
      default-icon="palette"
      :use-key-as-path="true"
      :hide-json-format="true"
      @close="closeExportModal"
      @export="onExportSuccess"
    />
    
    <!-- 导入冲突弹窗 -->
    <ImportConflictModal
      :show="showConflictModal"
      data-type="style"
      :data-type-name="t('appearance.theme.typeName')"
      :existing-name="conflictInfo?.name || ''"
      :suggested-name="conflictInfo?.suggestedName || ''"
      @overwrite="onConflictOverwrite"
      @rename="onConflictRename"
      @close="onConflictCancel"
    />
    
    <!-- 删除确认弹窗 -->
    <DeleteConfirmModal
      :show="showDeleteConfirmModal"
      :item-name="deleteTarget?.name || ''"
      :data-type-name="t('appearance.theme.typeName')"
      :loading="!!deletingTheme"
      @close="closeDeleteConfirmModal"
      @confirm="handleDeleteConfirm"
    />
    
    <!-- 详情面板 -->
    <ContentViewModal
      :show="showDetailModal"
      :title="t('panel.themes.detailTitle')"
      @close="closeDetailModal"
    >
      <ThemeDetailView
        :theme-data="detailTheme"
        :dir="detailThemeDir"
        @saved="handleThemeSaved"
      />
    </ContentViewModal>
  </div>
</template>

<style src="./shared-appearance.css" scoped></style>

<style scoped>
/* 标题区域 */
.theme-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--st-spacing-sm, 6px);
}

.theme-header h3 {
  margin: 0;
}

.theme-header-actions {
  display: flex;
  gap: var(--st-spacing-sm, 6px);
}

.st-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--st-radius-md, 6px);
  border: 1px solid rgba(var(--st-border), 0.8);
  background: rgba(var(--st-surface-2), 0.8);
  color: rgb(var(--st-color-text));
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.st-action-btn:hover:not(:disabled) {
  background: rgb(var(--st-surface-2));
  border-color: rgba(var(--st-primary), 0.3);
}

.st-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-icon {
  width: 14px;
  height: 14px;
}

/* 主题列表区域 */
.theme-list-section {
  margin-bottom: var(--st-spacing-lg, 16px);
}

.theme-list {
  margin-top: var(--st-spacing-md, 8px);
  max-height: var(--st-theme-list-max-height, 320px);
  overflow: hidden;
}

.theme-loading,
.theme-empty,
.theme-error {
  padding: var(--st-spacing-lg, 16px);
  text-align: center;
  color: rgba(var(--st-color-text), 0.6);
  font-size: var(--st-font-base, 13px);
}

.theme-error {
  color: rgb(var(--st-color-error));
  background: rgba(var(--st-color-error), 0.08);
  border-radius: var(--st-radius-md, 6px);
}

/* 主题条目 */
.theme-items {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-sm, 6px);
}

.theme-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--st-spacing-md, 10px) var(--st-spacing-lg, 14px);
  background: rgba(var(--st-surface-2), 0.5);
  border: 2px solid rgb(var(--st-border));
  border-radius: var(--st-radius-md, 6px);
  transition: all 0.2s ease;
  gap: var(--st-spacing-md, 10px);
  position: relative;
}

/* 拖拽手柄 */
.theme-item-grip {
  flex-shrink: 0;
  width: var(--st-theme-grip-width, 20px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  opacity: 0.4;
  transition: opacity var(--st-transition-fast, 0.15s ease);
}

.theme-item-grip:active {
  cursor: grabbing;
}

.theme-item:hover .theme-item-grip {
  opacity: 0.7;
}

.grip-icon {
  width: var(--st-icon-md, 16px);
  height: var(--st-icon-md, 16px);
  color: rgba(var(--st-color-text), 0.6);
}

/* 拖拽状态样式 */
.theme-item--dragging {
  opacity: 0.5;
}

.theme-item--drag-over-top {
  border-top: 2px solid rgb(var(--st-primary));
}

.theme-item--drag-over-bottom {
  border-bottom: 2px solid rgb(var(--st-primary));
}

/* 拖拽到末尾的放置区域 */
.theme-drop-end {
  height: var(--st-theme-drop-end-height, 8px);
  border-radius: var(--st-radius-sm, 4px);
  transition: all var(--st-transition-fast, 0.15s ease);
}

.theme-drop-end--active {
  height: var(--st-theme-drop-end-active-height, 24px);
  background: rgba(var(--st-primary), 0.1);
  border: var(--st-border-width-md, 2px) dashed rgba(var(--st-primary), 0.4);
}

/* 主题图标 */
.theme-item-icon {
  flex-shrink: 0;
  width: var(--st-theme-icon-size, 48px);
  height: var(--st-theme-icon-size, 48px);
  border-radius: var(--st-radius-md, 6px);
  overflow: hidden;
  background: rgba(var(--st-surface-2), 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.theme-icon-placeholder {
  font-size: var(--st-font-3xl, 20px);
  opacity: 0.6;
}

.theme-icon-lucide {
  width: var(--st-icon-xl, 24px);
  height: var(--st-icon-xl, 24px);
  color: rgba(var(--st-color-text), 0.5);
}

.theme-item:hover {
  background: rgba(var(--st-surface-2), 0.8);
  border-color: rgba(var(--st-primary), 0.3);
}

.theme-item--enabled {
  border-color: rgba(var(--st-primary), 0.5);
  background: rgba(var(--st-primary), 0.08);
}

/* 未启用的主题样式 - 字体变暗 */
.theme-item:not(.theme-item--enabled) {
  opacity: var(--st-theme-disabled-opacity, 0.6);
}

.theme-item:not(.theme-item--enabled) .theme-item-name {
  color: rgba(var(--st-color-text), 0.6);
}

.theme-item:not(.theme-item--enabled) .theme-item-desc {
  color: rgba(var(--st-color-text), 0.4);
}

.theme-item:not(.theme-item--enabled) .theme-item-folder {
  color: rgba(var(--st-color-text), 0.3);
}

.theme-item:not(.theme-item--enabled) .theme-item-entries {
  color: rgba(var(--st-color-text), 0.35);
}

.theme-item:not(.theme-item--enabled) .theme-icon-lucide {
  color: rgba(var(--st-color-text), 0.35);
}

.theme-item:not(.theme-item--enabled):hover {
  opacity: var(--st-theme-disabled-hover-opacity, 0.8);
}

/* 启用复选框 */
.theme-item-checkbox {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-item-checkbox input[type="checkbox"] {
  width: var(--st-theme-checkbox-size, 18px);
  height: var(--st-theme-checkbox-size, 18px);
  cursor: pointer;
  accent-color: rgb(var(--st-primary));
}

.theme-item-checkbox input[type="checkbox"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 启用状态徽章 */
.theme-enabled-badge {
  font-size: var(--st-font-xs, 11px);
  font-weight: 500;
  color: rgb(var(--st-primary));
  background: rgba(var(--st-primary), 0.12);
  padding: var(--st-spacing-xs, 2px) var(--st-spacing-sm, 6px);
  border-radius: var(--st-radius-sm, 4px);
  margin-left: var(--st-spacing-sm, 6px);
}

/* 多主题提示 */
.theme-multi-hint {
  font-size: var(--st-font-sm, 12px);
  line-height: 1.5;
  margin-top: var(--st-spacing-xs, 4px);
}

.theme-info-section {
  margin-bottom: var(--st-spacing-lg, 16px);
}

/* 主题信息 */
.theme-item-info {
  flex: 1;
  min-width: 0;
}

.theme-item-name {
  font-weight: 600;
  font-size: var(--st-font-md, 14px);
  color: rgb(var(--st-color-text));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.theme-current-badge {
  font-size: var(--st-font-xs, 11px);
  font-weight: 500;
  color: rgb(var(--st-primary));
  background: rgba(var(--st-primary), 0.12);
  padding: var(--st-spacing-xs, 2px) var(--st-spacing-sm, 6px);
  border-radius: var(--st-radius-sm, 4px);
}

.theme-item-desc {
  font-size: var(--st-font-sm, 12px);
  color: rgba(var(--st-color-text), 0.65);
  margin-top: var(--st-spacing-xs, 2px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.theme-item-folder {
  display: flex;
  align-items: center;
  gap: var(--st-spacing-xs, 4px);
  font-size: var(--st-font-xs, 11px);
  color: rgba(var(--st-color-text), 0.45);
  margin-top: var(--st-spacing-xs, 2px);
  font-family: var(--st-font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-icon {
  width: var(--st-theme-folder-icon-size, 12px);
  height: var(--st-theme-folder-icon-size, 12px);
  flex-shrink: 0;
  opacity: 0.7;
}

.theme-item-entries {
  font-size: var(--st-font-xs, 11px);
  color: rgba(var(--st-color-text), 0.5);
  margin-top: var(--st-spacing-xs, 2px);
}

/* 主题操作按钮 */
.theme-item-actions {
  display: flex;
  gap: var(--st-spacing-sm, 6px);
  flex-shrink: 0;
  margin-left: var(--st-spacing-md, 10px);
}

.st-btn {
  padding: var(--st-spacing-sm, 5px) var(--st-spacing-xl, 12px);
  font-size: var(--st-font-sm, 12px);
  font-weight: 500;
  border-radius: var(--st-radius-md, 6px);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--st-transition-fast, 0.15s ease);
  white-space: nowrap;
}

.st-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.st-btn--apply {
  min-width: var(--st-theme-btn-min-width, 52px);
  text-align: center;
  background: rgba(var(--st-primary), 0.12);
  color: rgb(var(--st-primary));
  border-color: rgba(var(--st-primary), 0.25);
}

.st-btn--apply:hover:not(:disabled) {
  background: rgba(var(--st-primary), 0.2);
  border-color: rgba(var(--st-primary), 0.4);
}

.st-btn--apply.st-btn--active {
  background: rgba(var(--st-primary), 0.25);
  border-color: rgba(var(--st-primary), 0.5);
}

.st-btn--apply.st-btn--active:hover:not(:disabled) {
  background: rgba(var(--st-primary), 0.15);
  border-color: rgba(var(--st-primary), 0.35);
}

.st-btn--delete {
  background: rgba(var(--st-color-error), 0.08);
  color: rgb(var(--st-color-error));
  border-color: rgba(var(--st-color-error), 0.2);
}

.st-btn--delete:hover:not(:disabled) {
  background: rgba(var(--st-color-error), 0.15);
  border-color: rgba(var(--st-color-error), 0.35);
}

.st-btn--view {
  background: rgba(var(--st-surface-2), 0.6);
  color: rgb(var(--st-color-text));
  border-color: rgba(var(--st-border), 0.6);
}

.st-btn--view:hover:not(:disabled) {
  background: rgb(var(--st-surface-2));
  border-color: rgba(var(--st-primary), 0.3);
}

/* 刷新按钮 */
.st-refresh-btn {
  padding: var(--st-spacing-xs, 4px) var(--st-spacing-lg, 10px);
  font-size: var(--st-font-sm, 12px);
  background: rgba(var(--st-surface-2), 0.8);
  border: 1px solid rgba(var(--st-border), 0.8);
  border-radius: var(--st-radius-md, 6px);
  color: rgb(var(--st-color-text));
  cursor: pointer;
  transition: all var(--st-transition-fast, 0.15s ease);
}

.st-refresh-btn:hover:not(:disabled) {
  background: rgb(var(--st-surface-2));
  border-color: rgba(var(--st-primary), 0.3);
}

.st-refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

</style>