<script setup>
import { ref, watch } from 'vue'
import DataCatalog from '@/services/dataCatalog'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  show: { type: Boolean, default: false },
  dataType: { type: String, required: true }, // 'preset', 'worldbook', 'character', 'persona', 'plugin', etc.
  dataTypeName: { type: String, default: '' }, // 用于显示的名称
  items: { type: Array, default: () => [] }, // 列表项数组 [{ key, name, avatarUrl, desc }]
  defaultIcon: { type: String, default: 'file' }, // 默认 lucide 图标名
  useKeyAsPath: { type: Boolean, default: false }, // 为 true 时直接使用 key 作为导出路径（用于插件等目录型数据）
  hideJsonFormat: { type: Boolean, default: false }, // 为 true 时隐藏 JSON 格式选项（如插件不支持纯 JSON 导出）
})

const emit = defineEmits(['close', 'export'])

const selectedItem = ref(null)
const exportFormat = ref('zip')
const embedImage = ref(null)
const embedImagePreview = ref(null)
const exporting = ref(false)
const exportError = ref(null)
const exportSuccess = ref(false)
const imageInputRef = ref(null)
const isDraggingImage = ref(false)
let successTimer = null

// 当弹窗显示时，初始化状态
watch(() => props.show, (val) => {
  if (val) {
    selectedItem.value = props.items.length > 0 ? props.items[0].key : null
    exportFormat.value = 'zip'
    embedImage.value = null
    embedImagePreview.value = null
    exportError.value = null
    exportSuccess.value = false
    exporting.value = false
    if (successTimer) {
      clearTimeout(successTimer)
      successTimer = null
    }
    // 刷新 lucide 图标
    setTimeout(() => { try { window?.lucide?.createIcons?.() } catch (_) {} }, 50)
  }
})

// 从文件路径提取文件夹名称
function getFolderName(filePath) {
  if (!filePath) return ''
  const parts = filePath.split('/')
  if (parts.length >= 2) {
    return parts[parts.length - 2]
  }
  return ''
}

// 获取文件夹路径
function getFolderPath(fileKey) {
  if (!fileKey) return null
  // 如果设置了 useKeyAsPath，直接返回 key（用于插件等目录型数据）
  if (props.useKeyAsPath) {
    return fileKey
  }
  // 否则去掉文件名部分，返回目录路径
  const parts = fileKey.split('/')
  parts.pop()
  return parts.join('/')
}

// 触发图片选择
function triggerImageSelect() {
  if (imageInputRef.value) {
    imageInputRef.value.click()
  }
}

// 处理图片选择
function handleImageSelect(event) {
  const files = event.target.files
  if (!files || files.length === 0) return
  processImageFile(files[0])
  event.target.value = ''
}

// 处理图片文件
function processImageFile(file) {
  if (!file.type.startsWith('image/png')) {
    exportError.value = t('exportModal.errors.pngOnly')
    return
  }
  
  embedImage.value = file
  
  const reader = new FileReader()
  reader.onload = () => {
    embedImagePreview.value = reader.result
  }
  reader.readAsDataURL(file)
}

// 拖拽处理
function handleDragOver(event) {
  event.preventDefault()
  isDraggingImage.value = true
}

function handleDragLeave(event) {
  event.preventDefault()
  isDraggingImage.value = false
}

function handleDrop(event) {
  event.preventDefault()
  isDraggingImage.value = false
  
  const files = event.dataTransfer.files
  if (files && files.length > 0) {
    processImageFile(files[0])
  }
}

// 清除选择的图片
function clearEmbedImage() {
  embedImage.value = null
  embedImagePreview.value = null
}

// 执行导出
async function doExport() {
  if (!selectedItem.value) {
    exportError.value = t('exportModal.errors.noSelection', { type: props.dataTypeName })
    return
  }
  
  const folderPath = getFolderPath(selectedItem.value)
  if (!folderPath) {
    exportError.value = t('exportModal.errors.noPath', { type: props.dataTypeName })
    return
  }
  
  exporting.value = true
  exportError.value = null
  exportSuccess.value = false
  if (successTimer) {
    clearTimeout(successTimer)
    successTimer = null
  }
  
  try {
    let embedImageBase64 = null
    
    if (exportFormat.value === 'png' && embedImage.value) {
      embedImageBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result
          const base64 = result.includes(',') ? (result.split(',')[1] || '') : result
          resolve(base64)
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(embedImage.value)
      })
    }
    
    await DataCatalog.downloadExportedData(
      folderPath,
      props.dataType,
      exportFormat.value === 'png' ? embedImageBase64 : undefined,
      exportFormat.value
    )
    
    emit('export', { item: selectedItem.value, format: exportFormat.value })
    // 导出成功后不关闭面板，允许用户继续导出其他项
    exportSuccess.value = true
    // 3秒后自动隐藏成功提示
    if (successTimer) clearTimeout(successTimer)
    successTimer = setTimeout(() => {
      exportSuccess.value = false
    }, 3000)
    
  } catch (err) {
    console.error('[ExportModal] Export error:', err)
    exportError.value = err.message || t('error.exportFailed')
  } finally {
    exporting.value = false
  }
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="export-modal-overlay" @click.self="handleClose">
      <div class="export-modal">
        <header class="export-modal-header">
          <h3>{{ t('exportModal.title', { type: dataTypeName }) }}</h3>
          <button class="export-modal-close" @click="handleClose">✕</button>
        </header>
        
        <div class="export-modal-body">
          <!-- 左侧：列表 -->
          <div class="export-item-list">
            <h4>{{ t('exportModal.selectItem', { type: dataTypeName }) }}</h4>
            <CustomScrollbar class="export-item-items-scroll">
              <div
                v-for="it in items"
                :key="it.key"
                class="export-item-item"
                :class="{ selected: selectedItem === it.key }"
                @click="selectedItem = it.key"
              >
                <div class="export-item-check">
                  <svg v-if="selectedItem === it.key" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div class="export-item-avatar">
                  <img v-if="it.avatarUrl" :src="it.avatarUrl" alt="" />
                  <i v-else :data-lucide="defaultIcon" class="export-item-avatar-icon"></i>
                </div>
                <div class="export-item-info">
                  <div class="export-item-name" :title="it.name">{{ it.name }}</div>
                  <div class="export-item-folder" :title="getFolderName(it.key)">
                    <svg class="export-item-folder-icon" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>{{ getFolderName(it.key) }}</span>
                  </div>
                  <div class="export-item-desc" :title="it.desc">{{ it.desc || t('common.noDescription') }}</div>
                </div>
              </div>
            </CustomScrollbar>
          </div>
          
          <!-- 右侧：导出设置 -->
          <div class="export-settings">
            <h4>{{ t('exportModal.format.title') }}</h4>
            <div class="export-format-cards">
              <div
                class="export-format-card"
                :class="{ selected: exportFormat === 'zip' }"
                @click="exportFormat = 'zip'"
              >
                <div class="export-format-card-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    <line x1="12" y1="11" x2="12" y2="17"></line>
                    <line x1="9" y1="14" x2="15" y2="14"></line>
                  </svg>
                </div>
                <div class="export-format-card-text">
                  <div class="export-format-card-title">{{ t('exportModal.format.zip.title') }}</div>
                  <div class="export-format-card-desc">{{ t('exportModal.format.zip.desc') }}</div>
                </div>
                <div class="export-format-card-check">
                  <svg v-if="exportFormat === 'zip'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>
              <div
                v-if="!hideJsonFormat"
                class="export-format-card"
                :class="{ selected: exportFormat === 'json' }"
                @click="exportFormat = 'json'"
              >
                <div class="export-format-card-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <div class="export-format-card-text">
                  <div class="export-format-card-title">{{ t('exportModal.format.json.title') }}</div>
                  <div class="export-format-card-desc">{{ t('exportModal.format.json.desc') }}</div>
                </div>
                <div class="export-format-card-check">
                  <svg v-if="exportFormat === 'json'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>
              <div
                class="export-format-card"
                :class="{ selected: exportFormat === 'png' }"
                @click="exportFormat = 'png'"
              >
                <div class="export-format-card-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                </div>
                <div class="export-format-card-text">
                  <div class="export-format-card-title">{{ t('exportModal.format.png.title') }}</div>
                  <div class="export-format-card-desc">{{ t('exportModal.format.png.desc') }}</div>
                </div>
                <div class="export-format-card-check">
                  <svg v-if="exportFormat === 'png'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>
            </div>
            
            <!-- PNG 模式下的图片上传 -->
            <div v-if="exportFormat === 'png'" class="export-image-upload">
              <h4>{{ t('exportModal.embedImage.title') }}</h4>
              <p class="export-image-hint">{{ t('exportModal.embedImage.hint') }}</p>
              
              <input
                ref="imageInputRef"
                type="file"
                accept="image/png"
                style="display: none;"
                @change="handleImageSelect"
              />
              
              <div
                class="export-image-dropzone"
                :class="{ dragging: isDraggingImage, 'has-image': embedImagePreview }"
                @click="triggerImageSelect"
                @dragover="handleDragOver"
                @dragleave="handleDragLeave"
                @drop="handleDrop"
              >
                <template v-if="embedImagePreview">
                  <img :src="embedImagePreview" alt="预览" class="export-image-preview" />
                  <button class="export-image-clear" @click.stop="clearEmbedImage">✕</button>
                </template>
                <template v-else>
                  <div class="export-image-icon-wrapper">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  </div>
                  <span class="export-image-main-text">{{ t('exportModal.embedImage.dropzone') }}</span>
                  <span class="export-image-note">{{ t('exportModal.embedImage.note', { type: dataTypeName }) }}</span>
                </template>
              </div>
            </div>
            
            <!-- 错误提示 -->
            <div v-if="exportError" class="export-error">
              {{ exportError }}
            </div>
          </div>
        </div>
        
        <footer class="export-modal-footer">
          <transition name="success-fade">
            <div v-if="exportSuccess" class="export-success-message">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>{{ t('exportModal.exportSuccess') }}</span>
            </div>
          </transition>
          <div style="flex: 1;"></div>
          <button class="export-btn-cancel" @click="handleClose">{{ t('exportModal.cancelButton') }}</button>
          <button
            class="export-btn-confirm"
            @click="doExport"
            :disabled="!selectedItem || exporting"
          >
            {{ exporting ? t('common.exporting') : t('exportModal.confirmButton') }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.export-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(var(--st-backdrop-blur-xs));
}

.export-modal {
  background: rgb(var(--st-surface));
  border: 1px solid rgb(var(--st-border) / var(--st-border-alpha-strong));
  border-radius: var(--st-radius-lg);
  box-shadow: var(--st-shadow-lg);
  width: var(--st-modal-xxl-width);
  max-width: var(--st-modal-max-width-alt);
  max-height: var(--st-modal-max-height-alt);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.export-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--st-modal-header-padding);
  border-bottom: 1px solid rgb(var(--st-border) / 0.85);
}
.export-modal-header h3 {
  margin: 0;
  font-size: var(--st-font-xl);
  font-weight: 700;
  color: rgb(var(--st-color-text));
}
.export-modal-close {
  appearance: none;
  border: 1px solid rgb(var(--st-border) / var(--st-border-alpha-strong));
  background: rgb(var(--st-surface-2));
  color: rgb(var(--st-color-text));
  border-radius: var(--st-radius-lg);
  padding: var(--st-spacing-xs) var(--st-spacing-md);
  cursor: pointer;
  font-size: var(--st-font-md);
}
.export-modal-close:hover {
  background: rgb(var(--st-surface));
}

.export-modal-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--st-spacing-3xl);
  padding: var(--st-modal-body-padding);
  overflow: auto;
  flex: 1;
}

/* 左侧列表 */
.export-item-list {
  display: flex;
  flex-direction: column;
  gap: var(--st-gap-lg);
  min-width: 360px;
  max-width: 440px;
}
.export-item-list h4 {
  margin: 0;
  font-size: var(--st-font-md);
  font-weight: 600;
  color: rgb(var(--st-color-text));
}
.export-item-items-scroll {
  height: 480px;
  min-height: 320px;
  max-height: 480px;
}
.export-item-items-scroll :deep(.scroll-container) {
  display: flex;
  flex-direction: column;
  gap: var(--st-gap-sm);
  padding-right: var(--st-spacing-md);
}
.export-item-item {
  display: flex;
  align-items: center;
  gap: var(--st-gap-lg);
  padding: var(--st-spacing-xl) var(--st-spacing-2xl);
  border: 1px solid rgb(var(--st-border) / 0.8);
  border-radius: var(--st-radius-lg);
  cursor: pointer;
  transition: all var(--st-transition-normal);
  flex-shrink: 0;
  background: rgb(var(--st-surface) / 0.5);
}
.export-item-item:hover {
  background: rgb(var(--st-surface-2) / 0.8);
  border-color: rgb(var(--st-border));
}
.export-item-item.selected {
  border-color: rgb(var(--st-color-text));
  background: rgb(var(--st-surface-2) / 0.9);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.export-item-check {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--st-radius-lg);
  background: rgb(var(--st-surface));
  border: 2px solid rgb(var(--st-border) / var(--st-border-alpha-medium));
  flex-shrink: 0;
  transition: all var(--st-transition-normal);
}
.export-item-item:hover .export-item-check {
  border-color: rgb(var(--st-border) / var(--st-border-alpha-strong));
}
.export-item-item.selected .export-item-check {
  background: rgb(60, 60, 70);
  border-color: rgb(60, 60, 70);
  color: white;
}
[data-theme="dark"] .export-item-check {
  background: rgb(45, 45, 50);
  border-color: rgb(80, 80, 90);
}
[data-theme="dark"] .export-item-item:hover .export-item-check {
  border-color: rgb(110, 110, 120);
}
[data-theme="dark"] .export-item-item.selected .export-item-check {
  background: rgb(120, 120, 140);
  border-color: rgb(120, 120, 140);
  color: rgb(20, 20, 22);
}
.export-item-avatar {
  width: var(--st-icon-container-md);
  height: var(--st-icon-container-md);
  border-radius: var(--st-spacing-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgb(var(--st-primary) / 0.12), rgb(var(--st-accent) / 0.12));
  border: 1px solid rgb(var(--st-border) / var(--st-border-alpha-medium));
  flex-shrink: 0;
}
.export-item-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--st-radius-lg);
}
.export-item-avatar i {
  width: var(--st-icon-lg);
  height: var(--st-icon-lg);
}
.export-item-avatar-icon {
  width: var(--st-icon-lg);
  height: var(--st-icon-lg);
}
.export-item-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.export-item-name {
  font-weight: 600;
  font-size: var(--st-font-lg);
  color: rgb(var(--st-color-text));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}
.export-item-folder {
  display: inline-flex;
  align-items: center;
  gap: var(--st-gap-xs);
  margin-top: var(--st-spacing-xs);
  padding: var(--st-spacing-xs) var(--st-spacing-sm);
  font-size: var(--st-font-xs);
  color: rgb(var(--st-color-text) / 0.5);
  background: rgb(var(--st-border) / 0.12);
  border-radius: var(--st-radius-md);
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  max-width: 280px;
  overflow: hidden;
}
.export-item-folder span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.export-item-folder-icon {
  flex-shrink: 0;
  opacity: 0.7;
}
.export-item-desc {
  font-size: var(--st-font-base);
  color: rgb(var(--st-color-text) / 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: var(--st-spacing-xs);
  max-width: 280px;
}

/* 右侧设置 */
.export-settings {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-2xl);
}
.export-settings h4 {
  margin: 0;
  font-size: var(--st-font-md);
  font-weight: 600;
  color: rgb(var(--st-color-text));
}

/* 格式选择卡片 */
.export-format-cards {
  display: flex;
  flex-direction: column;
  gap: var(--st-gap-md);
}
.export-format-card {
  display: flex;
  align-items: center;
  gap: var(--st-gap-lg);
  padding: var(--st-spacing-xl) var(--st-spacing-2xl);
  border: 1px solid rgb(var(--st-border) / var(--st-border-alpha-medium));
  border-radius: var(--st-radius-lg);
  cursor: pointer;
  transition: all var(--st-transition-normal) ease;
  background: rgb(var(--st-surface) / 0.5);
}
.export-format-card:hover {
  border-color: rgb(var(--st-border) / var(--st-border-alpha-strong));
  background: rgb(var(--st-surface-2) / 0.6);
}
.export-format-card.selected {
  border-color: rgb(var(--st-color-text));
  background: rgb(var(--st-surface-2) / 0.8);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.export-format-card-icon {
  width: var(--st-icon-container-md);
  height: var(--st-icon-container-md);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--st-radius-lg);
  background: rgb(var(--st-border) / 0.12);
  color: rgb(var(--st-color-text) / 0.6);
  flex-shrink: 0;
  transition: all var(--st-transition-normal);
}
.export-format-card.selected .export-format-card-icon {
  background: rgb(var(--st-color-text) / 0.1);
  color: rgb(var(--st-color-text));
}
.export-format-card-text {
  flex: 1;
  min-width: 0;
}
.export-format-card-title {
  font-weight: 600;
  font-size: var(--st-font-md);
  color: rgb(var(--st-color-text) / 0.8);
}
.export-format-card.selected .export-format-card-title {
  color: rgb(var(--st-color-text));
}
.export-format-card-desc {
  font-size: var(--st-font-xs);
  color: rgb(var(--st-color-text) / 0.5);
  margin-top: var(--st-spacing-xs);
}
.export-format-card-check {
  width: var(--st-icon-lg);
  height: var(--st-icon-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--st-radius-lg);
  background: rgb(var(--st-surface));
  border: 2px solid rgb(var(--st-border) / 0.5);
  flex-shrink: 0;
  transition: all var(--st-transition-normal);
}
.export-format-card:hover .export-format-card-check {
  border-color: rgb(var(--st-border) / 0.8);
}
.export-format-card.selected .export-format-card-check {
  background: rgb(60, 60, 70);
  border-color: rgb(60, 60, 70);
  color: white;
}
[data-theme="dark"] .export-format-card-check {
  background: rgb(45, 45, 50);
  border-color: rgb(80, 80, 90);
}
[data-theme="dark"] .export-format-card:hover .export-format-card-check {
  border-color: rgb(110, 110, 120);
}
[data-theme="dark"] .export-format-card.selected .export-format-card-check {
  background: rgb(120, 120, 140);
  border-color: rgb(120, 120, 140);
  color: rgb(20, 20, 22);
}

/* 图片上传区 */
.export-image-upload {
  display: flex;
  flex-direction: column;
  gap: var(--st-gap-sm);
  margin-top: var(--st-spacing-md);
}
.export-image-hint {
  margin: 0;
  font-size: var(--st-font-sm);
  color: rgb(var(--st-color-text) / 0.6);
}
.export-image-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--st-gap-lg);
  padding: var(--st-spacing-5xl) var(--st-spacing-4xl);
  border: 2px dashed rgb(var(--st-border) / var(--st-border-alpha-medium));
  border-radius: var(--st-radius-lg);
  cursor: pointer;
  transition: all 0.25s ease;
  min-height: 160px;
  position: relative;
  background-color: rgb(var(--st-surface-2) / 0.3);
}
.export-image-dropzone:hover {
  border-color: rgb(var(--st-color-text) / 0.4);
  background-color: rgb(var(--st-surface-2) / 0.5);
}
.export-image-dropzone.dragging {
  border-color: rgb(var(--st-color-text));
  border-style: solid;
  background-color: rgb(var(--st-surface-2) / 0.7);
  transform: scale(1.01);
}
.export-image-dropzone.has-image {
  padding: var(--st-gap-lg);
  background-color: rgb(var(--st-surface-2) / 0.5);
  border-style: solid;
  border-color: rgb(var(--st-color-text));
}
.export-image-icon-wrapper {
  width: var(--st-icon-container-lg);
  height: var(--st-icon-container-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--st-radius-lg);
  background: rgb(var(--st-border) / 0.1);
  border: 2px dashed rgb(var(--st-border) / 0.4);
  color: rgb(var(--st-color-text) / 0.5);
  transition: all var(--st-transition-normal);
}
.export-image-dropzone:hover .export-image-icon-wrapper {
  background: rgb(var(--st-border) / 0.15);
  border-color: rgb(var(--st-color-text) / 0.3);
  color: rgb(var(--st-color-text) / 0.7);
}
.export-image-main-text {
  font-size: var(--st-font-md);
  font-weight: 600;
  color: rgb(var(--st-color-text) / 0.8);
}
.export-image-note {
  font-size: var(--st-font-sm);
  color: rgb(var(--st-color-text) / 0.5);
  text-align: center;
}
.export-image-preview {
  max-width: 100%;
  max-height: 150px;
  object-fit: contain;
  border-radius: var(--st-radius-lg);
}
.export-image-clear {
  position: absolute;
  top: var(--st-spacing-xs);
  right: var(--st-spacing-xs);
  appearance: none;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border-radius: var(--st-radius-circle);
  width: var(--st-icon-xl);
  height: var(--st-icon-xl);
  cursor: pointer;
  font-size: var(--st-font-md);
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.export-image-clear:hover {
  background: rgba(0, 0, 0, 0.8);
}

.export-error {
  padding: var(--st-spacing-md) var(--st-gap-lg);
  background: rgb(var(--st-color-error) / 0.1);
  border: 1px solid rgb(var(--st-color-error) / 0.3);
  border-radius: var(--st-radius-lg);
  color: rgb(var(--st-color-error));
  font-size: var(--st-font-sm);
}

/* 底部按钮 */
.export-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--st-gap-lg);
  padding: var(--st-modal-footer-padding);
  border-top: 1px solid rgb(var(--st-border) / 0.85);
}
.export-btn-cancel,
.export-btn-confirm {
  appearance: none;
  border-radius: var(--st-radius-lg);
  padding: var(--st-spacing-md) var(--st-spacing-2xl);
  font-size: var(--st-font-base);
  cursor: pointer;
  transition: all var(--st-transition-normal);
}
.export-btn-cancel {
  border: 1px solid rgb(var(--st-border) / var(--st-border-alpha-strong));
  background: rgb(var(--st-surface-2));
  color: rgb(var(--st-color-text));
}
.export-btn-cancel:hover {
  background: rgb(var(--st-surface));
}
.export-btn-confirm {
  border: 1px solid rgb(var(--st-primary) / 0.6);
  background: rgb(var(--st-primary) / 0.15);
  color: rgb(var(--st-color-text));
}
.export-btn-confirm:hover:not(:disabled) {
  background: rgb(var(--st-primary) / 0.25);
}
.export-btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 导出成功提示 */
.export-success-message {
  display: inline-flex;
  align-items: center;
  gap: var(--st-gap-sm);
  padding: var(--st-spacing-md) var(--st-spacing-xl);
  background: rgb(var(--st-color-success) / 0.12);
  border: 1px solid rgb(var(--st-color-success) / 0.3);
  border-radius: var(--st-radius-lg);
  color: rgb(var(--st-color-success));
  font-size: var(--st-font-base);
  font-weight: 600;
}

[data-theme="dark"] .export-success-message {
  background: rgb(var(--st-color-success) / 0.15);
  border-color: rgb(var(--st-color-success) / 0.4);
}

/* 成功提示淡入淡出动画 */
.success-fade-enter-active,
.success-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.success-fade-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.success-fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

@media (max-width: 640px) {
  .export-modal-body {
    grid-template-columns: 1fr;
  }
}
</style>