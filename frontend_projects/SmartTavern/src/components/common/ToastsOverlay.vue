<script setup>
import { computed } from 'vue'
import { useToastsStore } from '@/stores/workflow/toasts'
import { useI18n } from '@/locales'

const { t } = useI18n()
const store = useToastsStore()
const toasts = computed(() => store.list)

/** 手动关闭 */
function closeToast(id) {
  try { store.remove(id) } catch (_) {}
}

/** 友好标题 */
function typeTitle(type) {
  switch (type) {
    case 'success': return t('components.toasts.success')
    case 'warning': return t('components.toasts.warning')
    case 'error': return t('components.toasts.error')
    default: return t('components.toasts.info')
  }
}
</script>

<template>
  <div class="st-toasts" aria-live="polite" aria-atomic="true">
    <transition-group name="st-toast" tag="div" class="st-toasts-list">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="st-toast"
        :data-type="toast.type"
        role="status"
      >
        <div class="st-toast__bar" :data-type="toast.type" aria-hidden="true"></div>
        <div class="st-toast__content">
          <div class="st-toast__title">{{ typeTitle(toast.type) }}</div>
          <div class="st-toast__message">{{ toast.message }}</div>
        </div>
        <button class="st-toast__close" type="button" @click="closeToast(toast.id)" :aria-label="t('components.toasts.close')">×</button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
/* 容器固定在右上角 */
.st-toasts {
  position: fixed;
  top: var(--st-spacing-2xl);
  right: var(--st-spacing-2xl);
  z-index: 1000;
  pointer-events: none; /* 允许下层交互；卡片内再打开 */
}
.st-toasts-list {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-lg);
}

/* 单个 Toast 卡片 */
.st-toast {
  position: relative;
  display: grid;
  grid-template-columns: var(--st-spacing-xs) 1fr auto;
  align-items: start;
  gap: var(--st-gap-xl);
  min-width: var(--st-toast-min-width);
  max-width: min(var(--st-toast-max-width), var(--st-toast-max-width-vw));
  padding: var(--st-gap-xl) var(--st-gap-xl) var(--st-gap-xl) 0;
  border-radius: var(--st-radius-xl);
  background: var(--st-toast-bg);
  color: var(--st-toast-text);
  box-shadow: 0 var(--st-spacing-md) var(--st-btn-md) rgba(0,0,0,.3),
              0 var(--st-spacing-xs) var(--st-gap-lg) rgba(0,0,0,.2),
              0 0 0 1px var(--st-toast-border);
  backdrop-filter: blur(var(--st-backdrop-blur-lg));
  -webkit-backdrop-filter: blur(var(--st-backdrop-blur-lg));
  pointer-events: auto;
  overflow: hidden;
}

/* 左侧色条根据类型着色 */
.st-toast__bar {
  width: var(--st-spacing-xs);
  height: 100%;
  border-radius: var(--st-radius-xl) 0 0 var(--st-radius-xl);
  background: linear-gradient(180deg,
    var(--st-toast-color-light, #94a3b8) 0%,
    var(--st-toast-color, #6b7280) 100%);
  box-shadow: var(--st-spacing-xs) 0 var(--st-spacing-md) rgba(var(--st-toast-color-rgb, 107 114 128), 0.3);
}
.st-toast__bar[data-type="success"] {
  --st-toast-color: var(--st-toast-success-color);
  --st-toast-color-light: var(--st-toast-success-light);
  --st-toast-color-rgb: var(--st-toast-success-rgb);
}
.st-toast__bar[data-type="warning"] {
  --st-toast-color: var(--st-toast-warning-color);
  --st-toast-color-light: var(--st-toast-warning-light);
  --st-toast-color-rgb: var(--st-toast-warning-rgb);
}
.st-toast__bar[data-type="error"] {
  --st-toast-color: var(--st-toast-error-color);
  --st-toast-color-light: var(--st-toast-error-light);
  --st-toast-color-rgb: var(--st-toast-error-rgb);
}
.st-toast__bar[data-type="info"] {
  --st-toast-color: var(--st-toast-info-color);
  --st-toast-color-light: var(--st-toast-info-light);
  --st-toast-color-rgb: var(--st-toast-info-rgb);
}

/* 内容区 */
.st-toast__content {
  display: grid;
  gap: var(--st-spacing-xs);
  padding: var(--st-spacing-xs) 0;
}
.st-toast__title {
  font-weight: 700;
  font-size: var(--st-font-md);
  line-height: 1.3;
  opacity: 1;
  letter-spacing: 0.01em;
}
.st-toast__message {
  font-size: var(--st-font-base);
  line-height: 1.45;
  opacity: 0.88;
  word-break: break-word;
}

/* 关闭按钮 */
.st-toast__close {
  appearance: none;
  border: none;
  background: var(--st-toast-close-bg);
  color: var(--st-toast-close-text);
  font-size: var(--st-gap-2xl);
  line-height: 1;
  padding: var(--st-spacing-sm) var(--st-spacing-md);
  margin: 0;
  border-radius: var(--st-spacing-sm);
  cursor: pointer;
  transition: all var(--st-transition-normal);
  height: fit-content;
}
.st-toast__close:hover {
  background: var(--st-toast-close-hover);
  color: var(--st-toast-close-hover-text);
  transform: scale(1.1);
}
.st-toast__close:active {
  transform: scale(0.95);
}

/* 进出场动画 */
.st-toast-enter-from {
  opacity: 0;
  transform: translateY(calc(-1 * var(--st-spacing-md))) scale(.98);
  filter: blur(var(--st-blur-xs));
}
.st-toast-leave-to {
  opacity: 0;
  transform: translateY(calc(-1 * var(--st-spacing-sm))) scale(.98);
  filter: blur(var(--st-blur-xs));
}
.st-toast-enter-active,
.st-toast-leave-active {
  transition: opacity var(--st-transition-fast), transform var(--st-transition-normal), filter var(--st-transition-normal);
}
</style>