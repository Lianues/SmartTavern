<script setup>
import { ref, watch, computed } from 'vue'
import DataCatalog from '@/services/dataCatalog'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  show: { type: Boolean, default: false },
  dataType: { type: String, required: true }, // 'preset', 'worldbook', 'character', 'persona', 'regex_rule', 'llm_config'
  dataTypeName: { type: String, default: '' }, // 用于显示的名称
})

const emit = defineEmits(['close', 'created'])

const name = ref('')
const description = ref('')
const folderName = ref('')
const nameError = ref('')
const folderError = ref('')
const creating = ref(false)

// 图标上传相关
const iconFile = ref(null)
const iconPreviewUrl = ref('')
const iconInputRef = ref(null)

// 计算图标预览URL
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

// 当弹窗显示时重置表单
watch(() => props.show, (val) => {
  if (val) {
    name.value = ''
    description.value = ''
    folderName.value = ''
    nameError.value = ''
    folderError.value = ''
    creating.value = false
    removeIcon()
  }
})

// 验证并创建
async function handleCreate() {
  nameError.value = ''
  folderError.value = ''
  
  const trimmedName = name.value.trim()
  const trimmedFolder = folderName.value.trim()
  
  if (!trimmedName) {
    nameError.value = t('createItem.errors.emptyName')
    return
  }
  
  if (!trimmedFolder) {
    folderError.value = t('createItem.errors.emptyFolder')
    return
  }
  
  // 验证文件夹名称格式（不允许特殊字符）
  if (!/^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/.test(trimmedFolder)) {
    folderError.value = t('createItem.errors.invalidFolder')
    return
  }
  
  creating.value = true
  
  try {
    // 如果有图标，转换为Base64
    let iconBase64 = null
    if (iconFile.value) {
      iconBase64 = await fileToBase64(iconFile.value)
    }
    
    const result = await DataCatalog.createDataFolder(
      props.dataType,
      trimmedName,
      description.value.trim(),
      trimmedFolder,
      iconBase64
    )
    
    if (result.success) {
      emit('created', result)
      emit('close')
    } else {
      if (result.error === 'FOLDER_EXISTS') {
        folderError.value = t('createItem.errors.folderExists', { folder: trimmedFolder })
      } else {
        nameError.value = result.message || t('createItem.errors.createFailed')
      }
    }
  } catch (err) {
    console.error('[CreateItemModal] Create error:', err)
    nameError.value = err.message || t('createItem.errors.createFailed')
  } finally {
    creating.value = false
  }
}

function handleClose() {
  if (creating.value) return
  emit('close')
}

// 键盘事件
function handleKeydown(e) {
  if (!props.show) return
  if (e.key === 'Escape') {
    handleClose()
  } else if (e.key === 'Enter' && !creating.value) {
    handleCreate()
  }
}

watch(() => props.show, (v) => {
  if (v) {
    window.addEventListener('keydown', handleKeydown)
  } else {
    window.removeEventListener('keydown', handleKeydown)
  }
}, { immediate: true })
</script>

<template>
  <Teleport to="body">
    <transition name="modal-fade">
      <div v-if="show" class="cim-overlay" @click.self="handleClose">
        <div class="cim-modal">
          <header class="cim-header">
            <div class="cim-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14"></path>
                <path d="M5 12h14"></path>
              </svg>
            </div>
            <h3 class="cim-title">{{ t('createItem.title', { type: dataTypeName }) }}</h3>
            <button class="cim-close" @click="handleClose" :disabled="creating">✕</button>
          </header>

          <div class="cim-body">
            <div class="cim-content-wrapper">
              <!-- 左侧：图标上传区域 -->
              <div class="cim-icon-section">
                <label class="cim-label">{{ t('createItem.iconLabel') }}</label>
                <div
                  class="cim-icon-upload"
                  :class="{ 'has-icon': hasIcon }"
                  @click="triggerIconSelect"
                >
                  <input
                    ref="iconInputRef"
                    type="file"
                    accept="image/*"
                    class="cim-icon-input"
                    @change="handleIconSelect"
                  />
                  <template v-if="hasIcon">
                    <img :src="iconPreviewUrl" alt="Icon Preview" class="cim-icon-preview" />
                    <button
                      type="button"
                      class="cim-icon-remove"
                      @click.stop="removeIcon"
                      :title="t('createItem.removeIcon')"
                    >
                      ✕
                    </button>
                  </template>
                  <template v-else>
                    <div class="cim-icon-placeholder">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                        <circle cx="9" cy="9" r="2"/>
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                      </svg>
                      <span>{{ t('createItem.uploadIcon') }}</span>
                    </div>
                  </template>
                </div>
                <div class="cim-icon-hint">{{ t('createItem.iconHint') }}</div>
              </div>

              <!-- 右侧：表单区域 -->
              <div class="cim-form">
                <div class="cim-field">
                  <label class="cim-label">
                    {{ t('createItem.nameLabel') }}
                    <span class="cim-required">*</span>
                  </label>
                  <input
                    v-model="name"
                    type="text"
                    class="cim-input"
                    :class="{ error: nameError }"
                    :placeholder="t('createItem.namePlaceholder')"
                    :disabled="creating"
                    @keydown.enter.prevent="handleCreate"
                  />
                  <div v-if="nameError" class="cim-error">{{ nameError }}</div>
                </div>

                <div class="cim-field">
                  <label class="cim-label">{{ t('createItem.descriptionLabel') }}</label>
                  <textarea
                    v-model="description"
                    class="cim-textarea"
                    :placeholder="t('createItem.descriptionPlaceholder')"
                    :disabled="creating"
                    rows="3"
                  ></textarea>
                </div>

                <div class="cim-field">
                  <label class="cim-label">
                    {{ t('createItem.folderLabel') }}
                    <span class="cim-required">*</span>
                  </label>
                  <input
                    v-model="folderName"
                    type="text"
                    class="cim-input"
                    :class="{ error: folderError }"
                    :placeholder="t('createItem.folderPlaceholder')"
                    :disabled="creating"
                    @keydown.enter.prevent="handleCreate"
                  />
                  <div v-if="folderError" class="cim-error">{{ folderError }}</div>
                  <div class="cim-hint">{{ t('createItem.folderHint') }}</div>
                </div>
              </div>
            </div>
          </div>

          <footer class="cim-footer">
            <button
              class="cim-btn cim-btn-cancel"
              type="button"
              :disabled="creating"
              @click="handleClose"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              class="cim-btn cim-btn-create"
              type="button"
              :disabled="creating || !name.trim() || !folderName.trim()"
              @click="handleCreate"
            >
              <span v-if="creating" class="cim-spinner"></span>
              {{ creating ? t('createItem.creating') : t('createItem.create') }}
            </button>
          </footer>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.cim-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--st-modal-overlay-dark-bg, rgba(0, 0, 0, 0.6));
  backdrop-filter: blur(var(--st-blur-xs, 4px));
  -webkit-backdrop-filter: blur(var(--st-blur-xs, 4px));
}

.cim-modal {
  width: var(--st-modal-md-width, 640px);
  max-width: var(--st-modal-max-width, 90vw);
  background: rgb(var(--st-surface));
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-strong, 0.9));
  border-radius: var(--st-radius-xl, 12px);
  box-shadow: var(--st-shadow-lg);
  overflow: hidden;
}

.cim-header {
  display: flex;
  align-items: center;
  gap: var(--st-gap-lg, 16px);
  padding: var(--st-modal-header-padding, 24px);
  border-bottom: 1px solid rgba(var(--st-border), 0.85);
}

.cim-icon {
  width: var(--st-icon-container-sm, 40px);
  height: var(--st-icon-container-sm, 40px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--st-radius-circle, 50%);
  background: rgba(var(--st-primary), 0.12);
  color: rgb(var(--st-primary));
}

.cim-title {
  flex: 1;
  margin: 0;
  font-size: var(--st-font-2xl, 20px);
  font-weight: 600;
  color: rgb(var(--st-color-text));
}

.cim-close {
  appearance: none;
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-strong, 0.9));
  background: rgb(var(--st-surface-2));
  color: rgb(var(--st-color-text));
  border-radius: var(--st-radius-sm, 6px);
  padding: var(--st-spacing-xs, 4px) var(--st-spacing-md, 12px);
  cursor: pointer;
  font-size: var(--st-font-md, 16px);
  transition: background var(--st-transition-normal);
}

.cim-close:hover:not(:disabled) {
  background: rgb(var(--st-surface));
}

.cim-close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cim-body {
  padding: var(--st-modal-body-padding, 24px);
}

.cim-content-wrapper {
  display: flex;
  gap: var(--st-gap-2xl, 24px);
}

.cim-icon-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-sm, 8px);
}

.cim-icon-upload {
  width: var(--st-icon-upload-size);
  height: var(--st-icon-upload-size);
  border: var(--st-icon-upload-border-width) dashed currentColor;
  border-radius: var(--st-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all var(--st-transition-normal);
  background: rgb(var(--st-surface));
  color: rgba(var(--st-color-text), 0.3);
}

.cim-icon-upload:hover {
  border-color: rgb(var(--st-primary));
  color: rgb(var(--st-primary));
  background: rgba(var(--st-primary), 0.05);
}

.cim-icon-upload.has-icon {
  border-style: solid;
  border-color: rgba(var(--st-color-text), 0.3);
  color: inherit;
}

.cim-icon-upload.has-icon:hover {
  border-color: rgb(var(--st-primary));
}

.cim-icon-input {
  display: none;
}

.cim-icon-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cim-icon-remove {
  position: absolute;
  top: var(--st-icon-remove-btn-offset);
  right: var(--st-icon-remove-btn-offset);
  width: var(--st-icon-remove-btn-size);
  height: var(--st-icon-remove-btn-size);
  border-radius: var(--st-radius-circle);
  border: 1px solid rgba(var(--st-border), 0.5);
  background: var(--st-icon-remove-btn-bg);
  color: #ffffff;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--st-transition-normal);
}

.cim-icon-upload:hover .cim-icon-remove {
  opacity: 1;
}

.cim-icon-remove:hover {
  background: var(--st-icon-remove-btn-hover-bg);
}

.cim-icon-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--st-spacing-sm);
  color: rgba(var(--st-color-text), 0.4);
  text-align: center;
}

.cim-icon-placeholder svg {
  opacity: 0.6;
}

.cim-icon-placeholder span {
  font-size: var(--st-font-xs);
}

.cim-icon-hint {
  font-size: var(--st-font-xs);
  color: rgba(var(--st-color-text), 0.5);
  text-align: center;
  max-width: var(--st-icon-upload-size);
}

.cim-form {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--st-gap-xl, 20px);
}

.cim-field {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-sm, 8px);
}

.cim-label {
  font-size: var(--st-font-base, 14px);
  font-weight: 500;
  color: rgb(var(--st-color-text));
}

.cim-required {
  color: rgb(var(--st-color-error, 220, 38, 38));
}

.cim-input,
.cim-textarea {
  width: 100%;
  padding: var(--st-spacing-md, 12px) var(--st-gap-lg, 16px);
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-medium, 0.6));
  border-radius: var(--st-radius-sm, 6px);
  font-size: var(--st-font-base, 14px);
  background: rgb(var(--st-surface));
  color: rgb(var(--st-color-text));
  outline: none;
  transition: all var(--st-transition-normal);
  font-family: inherit;
}

.cim-input:focus,
.cim-textarea:focus {
  border-color: rgb(var(--st-primary));
  background: rgb(var(--st-surface));
}

.cim-input.error,
.cim-textarea.error {
  border-color: rgb(var(--st-color-error, 220, 38, 38));
  background: rgba(var(--st-color-error, 220, 38, 38), 0.05);
}

.cim-input:disabled,
.cim-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cim-input::placeholder,
.cim-textarea::placeholder {
  color: rgba(var(--st-color-text), 0.4);
}

.cim-textarea {
  resize: vertical;
  min-height: 80px;
}

.cim-error {
  font-size: var(--st-font-sm, 12px);
  color: rgb(var(--st-color-error, 220, 38, 38));
  padding: var(--st-spacing-xs, 4px) var(--st-spacing-sm, 8px);
  background: rgba(var(--st-color-error, 220, 38, 38), 0.08);
  border-radius: var(--st-radius-sm, 6px);
  border: 1px solid rgba(var(--st-color-error, 220, 38, 38), 0.2);
}

.cim-hint {
  font-size: var(--st-font-xs, 11px);
  color: rgba(var(--st-color-text), 0.6);
}

.cim-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--st-gap-lg, 16px);
  padding: var(--st-modal-footer-padding, 24px);
  border-top: 1px solid rgba(var(--st-border), 0.85);
}

.cim-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--st-spacing-sm, 8px);
  min-width: var(--st-btn-min-width, 100px);
  padding: var(--st-btn-padding-md, 10px 20px);
  font-size: var(--st-font-md, 16px);
  font-weight: 500;
  border-radius: var(--st-radius-md, 8px);
  cursor: pointer;
  transition: all var(--st-transition-normal);
}

.cim-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cim-btn-cancel {
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-strong, 0.9));
  background: rgb(var(--st-surface));
  color: rgb(var(--st-color-text));
}

.cim-btn-cancel:hover:not(:disabled) {
  background: rgb(var(--st-surface-2));
}

.cim-btn-create {
  border: 1px solid rgba(var(--st-primary), 0.5);
  background: rgb(var(--st-primary));
  color: #ffffff;
}

.cim-btn-create:hover:not(:disabled) {
  filter: brightness(0.9);
  box-shadow: 0 2px 8px rgba(var(--st-primary), 0.4);
}

.cim-btn-create:active:not(:disabled) {
  filter: brightness(0.85);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
  transform: scale(0.98);
}

.cim-spinner {
  display: inline-block;
  width: var(--st-icon-sm, 16px);
  height: var(--st-icon-sm, 16px);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: var(--st-radius-circle, 50%);
  animation: cim-spin 0.6s linear infinite;
}

@keyframes cim-spin {
  to { transform: rotate(360deg); }
}

/* 模态框动画 */
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-from .cim-modal,
.modal-fade-leave-to .cim-modal {
  transform: scale(0.95);
}
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity var(--st-transition-normal);
}
.modal-fade-enter-active .cim-modal,
.modal-fade-leave-active .cim-modal {
  transition: transform var(--st-transition-normal);
}
</style>