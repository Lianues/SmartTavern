<script setup>
import { ref, watch } from 'vue'
import DataCatalog from '@/services/dataCatalog'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  show: { type: Boolean, default: false },
  dataType: { type: String, required: true }, // 'preset', 'worldbook', 'character', 'persona', etc.
  dataTypeName: { type: String, default: '' }, // 用于显示的名称，如 "预设"、"世界书" 等
  existingName: { type: String, default: '' },
  suggestedName: { type: String, default: '' },
})

const emit = defineEmits(['close', 'overwrite', 'rename'])

const customName = ref('')
const customNameError = ref('')
const checkingName = ref(false)

// 当弹窗显示时，初始化自定义名称
watch(() => props.show, (val) => {
  if (val) {
    customName.value = props.suggestedName || ''
    customNameError.value = ''
    checkingName.value = false
  }
})

// 处理覆盖
function handleOverwrite() {
  emit('overwrite')
}

// 处理重命名
async function handleRename() {
  const targetName = customName.value.trim()
  
  if (!targetName) {
    customNameError.value = t('importConflict.errors.emptyName')
    return
  }
  
  checkingName.value = true
  customNameError.value = ''
  
  try {
    const checkResult = await DataCatalog.checkNameExists(props.dataType, targetName)
    
    if (checkResult.success && checkResult.exists) {
      customNameError.value = t('importConflict.errors.nameExists', { name: checkResult.folder_name })
      checkingName.value = false
      return
    }
  } catch (err) {
    console.warn('[ImportConflictModal] Check custom name failed:', err)
  }
  
  checkingName.value = false
  emit('rename', targetName)
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="import-conflict-overlay" @click.self="handleClose">
      <div class="import-conflict-modal">
        <header class="import-conflict-header">
          <h3>{{ t('importConflict.title') }}</h3>
          <button class="import-conflict-close" @click="handleClose">✕</button>
        </header>
        
        <div class="import-conflict-body">
          <p class="import-conflict-message">
            {{ t('importConflict.message', { name: existingName, type: dataTypeName }) }}
          </p>
          <p class="import-conflict-hint">{{ t('importConflict.hint') }}</p>
          
          <div class="import-conflict-options">
            <div class="import-conflict-option" @click="handleOverwrite">
              <div class="import-conflict-option-icon overwrite">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </div>
              <div class="import-conflict-option-text">
                <div class="import-conflict-option-title">{{ t('importConflict.overwrite.title', { type: dataTypeName }) }}</div>
                <div class="import-conflict-option-desc">{{ t('importConflict.overwrite.desc', { type: dataTypeName }) }}</div>
              </div>
            </div>
            
            <div class="import-conflict-option rename-option">
              <div class="import-conflict-option-icon rename">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="12" y1="18" x2="12" y2="12"></line>
                  <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
              </div>
              <div class="import-conflict-option-text">
                <div class="import-conflict-option-title">{{ t('importConflict.rename.title') }}</div>
                <div class="import-conflict-option-desc">{{ t('importConflict.rename.desc', { type: dataTypeName }) }}</div>
                <div class="import-conflict-rename-input-row">
                  <input
                    type="text"
                    class="import-conflict-rename-input"
                    :class="{ error: customNameError }"
                    v-model="customName"
                    :placeholder="t('importConflict.rename.placeholder')"
                    @click.stop
                    @keydown.enter.prevent="handleRename"
                  />
                  <button
                    class="import-conflict-rename-btn"
                    @click.stop="handleRename"
                    :disabled="checkingName || !customName.trim()"
                  >
                    {{ checkingName ? t('common.checking') : t('importConflict.rename.button') }}
                  </button>
                </div>
                <div v-if="customNameError" class="import-conflict-rename-error">
                  {{ customNameError }}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <footer class="import-conflict-footer">
          <button class="import-conflict-btn-cancel" @click="handleClose">{{ t('importConflict.cancelButton') }}</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.import-conflict-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  backdrop-filter: blur(var(--st-spacing-sm));
}

.import-conflict-modal {
  background: rgb(var(--st-surface));
  border: 1px solid rgb(var(--st-border) / var(--st-border-alpha-strong));
  border-radius: var(--st-radius-xl);
  box-shadow: 0 var(--st-gap-2xl) var(--st-icon-container-sm) rgba(0, 0, 0, 0.3);
  width: var(--st-modal-md-width);
  max-width: var(--st-modal-max-width);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.import-conflict-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--st-modal-header-padding);
  border-bottom: 1px solid rgb(var(--st-border) / 0.85);
  background: var(--st-conflict-warning-bg, rgba(255, 193, 7, 0.08));
}
.import-conflict-header h3 {
  margin: 0;
  font-size: var(--st-font-xl);
  font-weight: 700;
  color: rgb(var(--st-color-text));
}
.import-conflict-close {
  appearance: none;
  border: 1px solid rgb(var(--st-border) / var(--st-border-alpha-strong));
  background: rgb(var(--st-surface-2));
  color: rgb(var(--st-color-text));
  border-radius: var(--st-radius-sm);
  padding: var(--st-spacing-xs) var(--st-spacing-md);
  cursor: pointer;
  font-size: var(--st-font-md);
}
.import-conflict-close:hover {
  background: rgb(var(--st-surface));
}

.import-conflict-body {
  padding: var(--st-modal-body-padding);
}
.import-conflict-message {
  margin: 0 0 var(--st-spacing-md) 0;
  font-size: var(--st-font-md);
  color: rgb(var(--st-color-text));
}
.import-conflict-message strong {
  color: var(--st-conflict-warning-color, #f59e0b);
}
.import-conflict-hint {
  margin: 0 0 var(--st-spacing-2xl) 0;
  font-size: var(--st-font-base);
  color: rgb(var(--st-color-text) / 0.6);
}

.import-conflict-options {
  display: flex;
  flex-direction: column;
  gap: var(--st-gap-lg);
}

.import-conflict-option {
  display: flex;
  align-items: center;
  gap: var(--st-gap-xl);
  padding: var(--st-spacing-2xl);
  border: 1px solid rgb(var(--st-border) / var(--st-border-alpha-medium));
  border-radius: var(--st-spacing-md);
  cursor: pointer;
  transition: all var(--st-transition-normal);
  background: rgb(var(--st-surface-2) / 0.3);
}
.import-conflict-option:hover {
  border-color: rgb(var(--st-color-text) / 0.4);
  background: rgb(var(--st-surface-2) / var(--st-border-alpha-medium));
  transform: translateY(-1px);
  box-shadow: 0 var(--st-spacing-xs) var(--st-spacing-md) rgba(0, 0, 0, 0.08);
}

.import-conflict-option-icon {
  width: var(--st-icon-container-md);
  height: var(--st-icon-container-md);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--st-spacing-md);
  flex-shrink: 0;
}
.import-conflict-option-icon.overwrite {
  background: var(--st-conflict-error-bg, rgba(239, 68, 68, 0.12));
  color: var(--st-conflict-error-color, #ef4444);
}
.import-conflict-option-icon.rename {
  background: rgba(var(--st-color-success), 0.12);
  color: rgb(var(--st-color-success));
}

.import-conflict-option-text {
  flex: 1;
  min-width: 0;
}
.import-conflict-option-title {
  font-weight: 600;
  font-size: var(--st-font-md);
  color: rgb(var(--st-color-text));
  margin-bottom: var(--st-spacing-xs);
}
.import-conflict-option-desc {
  font-size: var(--st-font-sm);
  color: rgb(var(--st-color-text) / var(--st-border-alpha-medium));
}

/* 重命名选项不响应整体点击 */
.import-conflict-option.rename-option {
  cursor: default;
}
.import-conflict-option.rename-option:hover {
  transform: none;
  box-shadow: none;
  border-color: rgb(var(--st-border) / 0.6);
  background: rgb(var(--st-surface-2) / 0.3);
}

.import-conflict-rename-input-row {
  display: flex;
  gap: var(--st-gap-sm);
  margin-top: var(--st-spacing-md);
}
.import-conflict-rename-input {
  flex: 1;
  padding: var(--st-spacing-md) var(--st-gap-lg);
  border: 1px solid rgb(var(--st-border) / var(--st-border-alpha-medium));
  border-radius: var(--st-radius-sm);
  font-size: var(--st-font-base);
  background: rgb(var(--st-surface) / 0.8);
  color: rgb(var(--st-color-text));
  outline: none;
  transition: all var(--st-transition-normal);
}
.import-conflict-rename-input:focus {
  border-color: rgb(var(--st-color-text));
  background: rgb(var(--st-surface));
}
.import-conflict-rename-input.error {
  border-color: var(--st-conflict-error-color, #ef4444);
  background: var(--st-conflict-error-bg-light, rgba(239, 68, 68, 0.05));
}
.import-conflict-rename-input::placeholder {
  color: rgb(var(--st-color-text) / 0.4);
}
.import-conflict-rename-btn {
  appearance: none;
  padding: var(--st-spacing-md) var(--st-spacing-2xl);
  border: 1px solid rgba(var(--st-color-success), 0.5);
  background: rgba(var(--st-color-success), 0.12);
  color: rgb(var(--st-color-success));
  border-radius: var(--st-radius-sm);
  font-size: var(--st-font-base);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--st-transition-normal);
  white-space: nowrap;
}
.import-conflict-rename-btn:hover:not(:disabled) {
  background: rgba(var(--st-color-success), 0.2);
}
.import-conflict-rename-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.import-conflict-rename-error {
  margin-top: var(--st-spacing-sm);
  padding: var(--st-spacing-sm) var(--st-spacing-lg);
  background: var(--st-msg-error-bg-alpha, rgba(239, 68, 68, 0.08));
  border: 1px solid var(--st-conflict-error-border, rgba(239, 68, 68, 0.3));
  border-radius: var(--st-radius-sm);
  color: var(--st-conflict-error-color, #ef4444);
  font-size: var(--st-font-sm);
}

.import-conflict-footer {
  display: flex;
  justify-content: center;
  padding: var(--st-modal-footer-padding);
  border-top: 1px solid rgb(var(--st-border) / 0.85);
}
.import-conflict-btn-cancel {
  appearance: none;
  border: 1px solid rgb(var(--st-border) / var(--st-border-alpha-medium));
  background: rgb(var(--st-surface-2) / 0.5);
  color: rgb(var(--st-color-text) / 0.8);
  border-radius: var(--st-radius-sm);
  padding: var(--st-spacing-lg) var(--st-spacing-4xl);
  font-size: var(--st-font-base);
  cursor: pointer;
  transition: all var(--st-transition-normal);
}
.import-conflict-btn-cancel:hover {
  background: rgb(var(--st-surface-2) / 0.8);
}
</style>