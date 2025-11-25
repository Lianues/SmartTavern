<script setup>
import { ref, watch } from 'vue'
import DataCatalog from '@/services/dataCatalog'

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
    customNameError.value = '请输入名称'
    return
  }
  
  checkingName.value = true
  customNameError.value = ''
  
  try {
    const checkResult = await DataCatalog.checkNameExists(props.dataType, targetName)
    
    if (checkResult.success && checkResult.exists) {
      customNameError.value = `名称 "${checkResult.folder_name}" 已存在，请使用其他名称`
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
          <h3>⚠️ 名称冲突</h3>
          <button class="import-conflict-close" @click="handleClose">✕</button>
        </header>
        
        <div class="import-conflict-body">
          <p class="import-conflict-message">
            已存在名为 <strong>{{ existingName }}</strong> 的{{ dataTypeName }}文件目录（非{{ dataTypeName }}名冲突）。
          </p>
          <p class="import-conflict-hint">请选择处理方式：</p>
          
          <div class="import-conflict-options">
            <div class="import-conflict-option" @click="handleOverwrite">
              <div class="import-conflict-option-icon overwrite">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </div>
              <div class="import-conflict-option-text">
                <div class="import-conflict-option-title">覆盖原有{{ dataTypeName }}</div>
                <div class="import-conflict-option-desc">删除旧{{ dataTypeName }}，使用新导入的内容替换</div>
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
                <div class="import-conflict-option-title">保留两者（重命名）</div>
                <div class="import-conflict-option-desc">自定义新{{ dataTypeName }}的名称：</div>
                <div class="import-conflict-rename-input-row">
                  <input
                    type="text"
                    class="import-conflict-rename-input"
                    :class="{ error: customNameError }"
                    v-model="customName"
                    placeholder="输入新名称"
                    @click.stop
                    @keydown.enter.prevent="handleRename"
                  />
                  <button
                    class="import-conflict-rename-btn"
                    @click.stop="handleRename"
                    :disabled="checkingName || !customName.trim()"
                  >
                    {{ checkingName ? '检查中...' : '确认' }}
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
          <button class="import-conflict-btn-cancel" @click="handleClose">取消导入</button>
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
  backdrop-filter: blur(6px);
}

.import-conflict-modal {
  background: rgb(var(--st-surface));
  border: 1px solid rgb(var(--st-border) / 0.9);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  width: 480px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.import-conflict-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgb(var(--st-border) / 0.85);
  background: rgba(255, 193, 7, 0.08);
}
.import-conflict-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: rgb(var(--st-color-text));
}
.import-conflict-close {
  appearance: none;
  border: 1px solid rgb(var(--st-border) / 0.9);
  background: rgb(var(--st-surface-2));
  color: rgb(var(--st-color-text));
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 14px;
}
.import-conflict-close:hover {
  background: rgb(var(--st-surface));
}

.import-conflict-body {
  padding: 20px;
}
.import-conflict-message {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: rgb(var(--st-color-text));
}
.import-conflict-message strong {
  color: #f59e0b;
}
.import-conflict-hint {
  margin: 0 0 16px 0;
  font-size: 13px;
  color: rgb(var(--st-color-text) / 0.6);
}

.import-conflict-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.import-conflict-option {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border: 1px solid rgb(var(--st-border) / 0.6);
  border-radius: 8px;
  cursor: pointer;
  transition: all .2s ease;
  background: rgb(var(--st-surface-2) / 0.3);
}
.import-conflict-option:hover {
  border-color: rgb(var(--st-color-text) / 0.4);
  background: rgb(var(--st-surface-2) / 0.6);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.import-conflict-option-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  flex-shrink: 0;
}
.import-conflict-option-icon.overwrite {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}
.import-conflict-option-icon.rename {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}

.import-conflict-option-text {
  flex: 1;
  min-width: 0;
}
.import-conflict-option-title {
  font-weight: 600;
  font-size: 14px;
  color: rgb(var(--st-color-text));
  margin-bottom: 4px;
}
.import-conflict-option-desc {
  font-size: 12px;
  color: rgb(var(--st-color-text) / 0.6);
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
  gap: 8px;
  margin-top: 8px;
}
.import-conflict-rename-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid rgb(var(--st-border) / 0.6);
  border-radius: 4px;
  font-size: 13px;
  background: rgb(var(--st-surface) / 0.8);
  color: rgb(var(--st-color-text));
  outline: none;
  transition: all .2s;
}
.import-conflict-rename-input:focus {
  border-color: rgb(var(--st-color-text));
  background: rgb(var(--st-surface));
}
.import-conflict-rename-input.error {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
}
.import-conflict-rename-input::placeholder {
  color: rgb(var(--st-color-text) / 0.4);
}
.import-conflict-rename-btn {
  appearance: none;
  padding: 8px 16px;
  border: 1px solid rgba(34, 197, 94, 0.5);
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all .2s;
  white-space: nowrap;
}
.import-conflict-rename-btn:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.2);
}
.import-conflict-rename-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.import-conflict-rename-error {
  margin-top: 6px;
  padding: 6px 10px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 4px;
  color: #ef4444;
  font-size: 12px;
}

.import-conflict-footer {
  display: flex;
  justify-content: center;
  padding: 16px 20px;
  border-top: 1px solid rgb(var(--st-border) / 0.85);
}
.import-conflict-btn-cancel {
  appearance: none;
  border: 1px solid rgb(var(--st-border) / 0.6);
  background: rgb(var(--st-surface-2) / 0.5);
  color: rgb(var(--st-color-text) / 0.8);
  border-radius: 4px;
  padding: 10px 24px;
  font-size: 13px;
  cursor: pointer;
  transition: all .2s;
}
.import-conflict-btn-cancel:hover {
  background: rgb(var(--st-surface-2) / 0.8);
}
</style>