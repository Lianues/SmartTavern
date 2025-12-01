<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  show: { type: Boolean, default: false },
  itemName: { type: String, default: '' },
  dataTypeName: { type: String, default: '' },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'confirm'])

const visible = ref(props.show)

watch(() => props.show, (v) => {
  visible.value = v
})

function close() {
  if (props.loading) return
  emit('close')
}

function confirm() {
  if (props.loading) return
  emit('confirm')
}

// 键盘事件处理
function handleKeydown(e) {
  if (!visible.value) return
  if (e.key === 'Escape') {
    close()
  } else if (e.key === 'Enter' && !props.loading) {
    confirm()
  }
}

// 监听键盘事件
watch(visible, (v) => {
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
      <div v-if="visible" class="dcm-overlay" @click.self="close">
        <div class="dcm-modal">
          <header class="dcm-header">
            <div class="dcm-icon dcm-icon-warning">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </div>
            <h3 class="dcm-title">{{ t('deleteConfirm.title') }}</h3>
          </header>

          <div class="dcm-body">
            <p class="dcm-message">
              {{ t('deleteConfirm.message', { type: dataTypeName, name: itemName }) }}
            </p>
            <p class="dcm-warning">
              {{ t('deleteConfirm.warning') }}
            </p>
          </div>

          <footer class="dcm-footer">
            <button
              class="dcm-btn dcm-btn-cancel"
              type="button"
              :disabled="loading"
              @click="close"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              class="dcm-btn dcm-btn-danger"
              type="button"
              :disabled="loading"
              @click="confirm"
            >
              <span v-if="loading" class="dcm-spinner"></span>
              {{ loading ? t('deleteConfirm.deleting') : t('common.delete') }}
            </button>
          </footer>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.dcm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--st-modal-overlay-dark-bg);
  backdrop-filter: blur(var(--st-blur-xs));
  -webkit-backdrop-filter: blur(var(--st-blur-xs));
}

.dcm-modal {
  width: var(--st-modal-sm-width);
  max-width: var(--st-modal-max-width);
  background: rgb(var(--st-surface));
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-strong));
  border-radius: var(--st-radius-lg);
  box-shadow: var(--st-shadow-lg);
  overflow: hidden;
}

.dcm-header {
  display: flex;
  align-items: center;
  gap: var(--st-gap-lg);
  padding: var(--st-modal-header-padding);
  border-bottom: 1px solid rgba(var(--st-border), 0.85);
}

.dcm-icon {
  width: var(--st-icon-container-sm);
  height: var(--st-icon-container-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--st-radius-circle);
}

.dcm-icon-warning {
  background: var(--st-delete-icon-bg, rgba(220, 38, 38, 0.1));
  color: var(--st-delete-icon-color, rgb(220, 38, 38));
}

.dcm-title {
  margin: 0;
  font-size: var(--st-font-2xl);
  font-weight: 600;
  color: rgb(var(--st-color-text));
}

.dcm-body {
  padding: var(--st-modal-body-padding);
}

.dcm-message {
  margin: 0 0 var(--st-gap-lg) 0;
  font-size: var(--st-font-md);
  color: rgb(var(--st-color-text));
  line-height: 1.5;
}

.dcm-warning {
  margin: 0;
  padding: var(--st-gap-lg);
  font-size: var(--st-font-base);
  color: rgb(var(--st-color-error));
  background: rgba(var(--st-color-error), 0.08);
  border-radius: var(--st-radius-md);
  border: 1px solid rgba(var(--st-color-error), 0.2);
}

.dcm-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--st-gap-lg);
  padding: var(--st-modal-footer-padding);
  border-top: 1px solid rgba(var(--st-border), 0.85);
}

.dcm-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--st-spacing-sm);
  min-width: var(--st-btn-min-width);
  padding: var(--st-btn-padding-md);
  font-size: var(--st-font-md);
  font-weight: 500;
  border-radius: var(--st-radius-md);
  cursor: pointer;
  transition: all var(--st-transition-normal);
}

.dcm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dcm-btn-cancel {
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-strong));
  background: rgb(var(--st-surface));
  color: rgb(var(--st-color-text));
}

.dcm-btn-cancel:hover:not(:disabled) {
  background: rgb(var(--st-surface-2));
}

.dcm-btn-danger {
  border: 1px solid rgb(185, 28, 28);
  background: rgb(220, 38, 38);
  color: #ffffff;
}

.dcm-btn-danger:hover:not(:disabled) {
  background: rgb(185, 28, 28);
  border-color: rgb(153, 27, 27);
  box-shadow: 0 2px 8px rgba(220, 38, 38, 0.4);
}

.dcm-spinner {
  display: inline-block;
  width: var(--st-icon-sm);
  height: var(--st-icon-sm);
  border: 2px solid var(--st-delete-spinner-border);
  border-top-color: var(--st-delete-spinner-top);
  border-radius: var(--st-radius-circle);
  animation: dcm-spin var(--st-delete-spinner-duration) linear infinite;
  margin-right: var(--st-spacing-xs);
  flex-shrink: 0;
}

@keyframes dcm-spin {
  to { transform: rotate(360deg); }
}

/* 模态框动画 */
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-from .dcm-modal,
.modal-fade-leave-to .dcm-modal {
  transform: scale(0.95);
}
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity var(--st-transition-normal);
}
.modal-fade-enter-active .dcm-modal,
.modal-fade-leave-active .dcm-modal {
  transition: transform var(--st-transition-normal);
}
</style>