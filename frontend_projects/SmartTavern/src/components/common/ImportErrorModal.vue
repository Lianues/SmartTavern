<script setup>
import { computed, watch, onMounted } from 'vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  show: { type: Boolean, default: false },
  errorCode: { type: String, default: '' },
  errorMessage: { type: String, default: '' },
  dataTypeName: { type: String, default: '' },
  expectedType: { type: String, default: '' },
  actualType: { type: String, default: '' },
})

const emit = defineEmits(['close'])

// 错误码到图标的映射
const errorIcon = computed(() => {
  switch (props.errorCode) {
    case 'TYPE_MISMATCH':
      return 'file-x'
    case 'NO_TYPE_INFO':
      return 'file-question'
    case 'INVALID_ZIP':
    case 'INVALID_FORMAT':
      return 'file-warning'
    default:
      return 'alert-circle'
  }
})

// 错误码到标题的映射
const errorTitle = computed(() => {
  switch (props.errorCode) {
    case 'TYPE_MISMATCH':
      return t('import.error.typeMismatch')
    case 'NO_TYPE_INFO':
      return t('import.error.noTypeInfo')
    case 'INVALID_ZIP':
      return t('import.error.invalidZip')
    case 'INVALID_FORMAT':
      return t('import.error.invalidFormat')
    default:
      return t('import.error.importFailed')
  }
})

// 类型名称的翻译（注意：key 必须与后端返回的 actual_type/expected_type 一致）
const typeNameMap = computed(() => ({
  preset: t('panel.presets.typeName'),
  character: t('panel.characters.typeName'),
  worldbook: t('panel.worldBooks.typeName'),
  persona: t('panel.personas.typeName'),
  regex: t('panel.regexRules.typeName'),
  regex_rule: t('panel.regexRules.typeName'),
  llmconfig: t('panel.llmConfigs.typeName'),
  llm_config: t('panel.llmConfigs.typeName'),
  plugin: t('panel.plugins.typeName'),
}))

const actualTypeName = computed(() => {
  if (!props.actualType) {
    // 尝试从 errorMessage 中解析类型（后备方案）
    const match = props.errorMessage?.match(/文件包含 (\w+) 类型|contains (\w+) type/i)
    if (match) {
      const type = match[1] || match[2]
      return typeNameMap.value[type] || type
    }
    return ''
  }
  return typeNameMap.value[props.actualType] || props.actualType
})

const expectedTypeName = computed(() => {
  if (!props.expectedType) {
    // 如果没有传入 expectedType，使用 dataTypeName
    if (props.dataTypeName) return props.dataTypeName
    // 尝试从 errorMessage 中解析（后备方案）
    const match = props.errorMessage?.match(/期望 (\w+) 类型|expects (\w+) type/i)
    if (match) {
      const type = match[1] || match[2]
      return typeNameMap.value[type] || type
    }
    return ''
  }
  return typeNameMap.value[props.expectedType] || props.expectedType
})

function close() {
  emit('close')
}

// 监听显示状态刷新图标
watch(() => props.show, (v) => {
  if (v) {
    setTimeout(() => {
      try { window?.lucide?.createIcons?.() } catch (_) {}
    }, 50)
  }
})

onMounted(() => {
  try { window?.lucide?.createIcons?.() } catch (_) {}
})
</script>

<template>
  <teleport to="body">
    <transition name="modal-fade">
      <div v-if="show" class="iem-overlay" @click.self="close">
        <div class="iem-modal" role="dialog" aria-modal="true">
          <div class="iem-header">
            <div class="iem-icon-wrap" :class="errorCode === 'TYPE_MISMATCH' ? 'iem-icon-warning' : 'iem-icon-error'">
              <i :data-lucide="errorIcon"></i>
            </div>
            <h3 class="iem-title">{{ errorTitle }}</h3>
            <button class="iem-close" type="button" :title="t('common.close')" @click="close">✕</button>
          </div>

          <div class="iem-body">
            <!-- 类型不匹配的详细说明 -->
            <template v-if="errorCode === 'TYPE_MISMATCH'">
              <p class="iem-message">{{ t('import.error.typeMismatchDesc') }}</p>
              <div class="iem-type-info">
                <div class="iem-type-row">
                  <span class="iem-type-label">{{ t('import.error.fileContains') }}:</span>
                  <span class="iem-type-value iem-type-actual">{{ actualTypeName }}</span>
                </div>
                <div class="iem-type-row">
                  <span class="iem-type-label">{{ t('import.error.panelExpects') }}:</span>
                  <span class="iem-type-value iem-type-expected">{{ expectedTypeName }}</span>
                </div>
              </div>
              <p class="iem-hint">{{ t('import.error.typeMismatchHint') }}</p>
            </template>

            <!-- 缺少类型信息的说明 -->
            <template v-else-if="errorCode === 'NO_TYPE_INFO'">
              <p class="iem-message">{{ t('import.error.noTypeInfoDesc') }}</p>
              <p class="iem-hint">{{ t('import.error.noTypeInfoHint') }}</p>
            </template>

            <!-- 其他错误 -->
            <template v-else>
              <p class="iem-message">{{ errorMessage || t('import.error.genericDesc') }}</p>
            </template>
          </div>

          <div class="iem-footer">
            <button class="iem-btn iem-btn-primary" type="button" @click="close">
              {{ t('common.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<style scoped>
.iem-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.iem-modal {
  background: rgb(var(--st-surface));
  border: 1px solid rgba(var(--st-border), 0.9);
  border-radius: var(--st-radius-lg);
  box-shadow: var(--st-shadow-lg);
  max-width: 420px;
  width: 90%;
  overflow: hidden;
}

.iem-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(var(--st-border), 0.5);
}

.iem-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.iem-icon-wrap i {
  width: 24px;
  height: 24px;
}

.iem-icon-error {
  background: rgba(220, 38, 38, 0.12);
  color: rgb(220, 38, 38);
}

.iem-icon-warning {
  background: rgba(234, 179, 8, 0.12);
  color: rgb(202, 138, 4);
}

.iem-title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: rgb(var(--st-color-text));
}

.iem-close {
  appearance: none;
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface-2));
  border-radius: 4px;
  padding: 6px 8px;
  cursor: pointer;
  color: rgb(var(--st-color-text));
  transition: background .2s ease, transform .2s ease;
}

.iem-close:hover {
  background: rgb(var(--st-surface));
  transform: translateY(-1px);
}

.iem-body {
  padding: 20px;
}

.iem-message {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.6;
  color: rgb(var(--st-color-text));
}

.iem-type-info {
  background: rgba(var(--st-border), 0.1);
  border: 1px solid rgba(var(--st-border), 0.5);
  border-radius: var(--st-radius-md);
  padding: 12px 16px;
  margin-bottom: 16px;
}

.iem-type-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.iem-type-label {
  font-size: 13px;
  color: rgba(var(--st-color-text), 0.7);
  min-width: 100px;
}

.iem-type-value {
  font-size: 13px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.iem-type-actual {
  background: rgba(220, 38, 38, 0.12);
  color: rgb(220, 38, 38);
}

.iem-type-expected {
  background: rgba(var(--st-primary), 0.12);
  color: rgb(var(--st-primary));
}

.iem-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(var(--st-color-text), 0.6);
  font-style: italic;
}

.iem-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
}

.iem-btn {
  appearance: none;
  border: 1px solid rgb(var(--st-border));
  background: rgb(var(--st-surface));
  color: rgb(var(--st-color-text));
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: transform .2s ease, box-shadow .2s ease, background .2s ease;
}

.iem-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

.iem-btn-primary {
  border-color: rgba(var(--st-primary), 0.5);
  background: rgba(var(--st-primary), 0.08);
}

.iem-btn-primary:hover {
  background: rgba(var(--st-primary), 0.15);
}

/* 动画 */
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .iem-modal,
.modal-fade-leave-to .iem-modal {
  transform: scale(0.95) translateY(-10px);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity .2s ease;
}

.modal-fade-enter-active .iem-modal,
.modal-fade-leave-active .iem-modal {
  transition: transform .2s ease;
}
</style>