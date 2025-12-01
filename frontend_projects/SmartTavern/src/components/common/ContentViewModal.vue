<script setup>
import { ref, watch, computed } from 'vue'
import { useI18n } from '@/locales'
import CustomScrollbar2 from '@/components/common/CustomScrollbar2.vue'

const { t } = useI18n()

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
  icon: { type: String, default: '' }, // lucide icon name
  autoHeight: { type: Boolean, default: false },
})

const effectiveTitle = computed(() => props.title || t('components.modal.defaultTitle'))

const emit = defineEmits(['close', 'update:show'])

function close() {
  emit('close')
  emit('update:show', false)
}

// 监听 ESC 键关闭
function handleKeydown(e) {
  if (e.key === 'Escape' && props.show) {
    close()
  }
}

watch(() => props.show, (v) => {
  if (v) {
    document.addEventListener('keydown', handleKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
  }
}, { immediate: true })
</script>

<template>
  <Teleport to="body">
    <transition name="modal-fade">
      <div v-if="show" class="modal-overlay" @click.self="close">
        <div class="modal-container glass" :class="{ 'is-auto-height': autoHeight }">
          <!-- 顶部栏 -->
          <header class="modal-header">
            <div class="modal-title">
              <i v-if="icon" :data-lucide="icon" class="modal-icon icon-20" aria-hidden="true"></i>
              {{ effectiveTitle }}
            </div>
            <button class="modal-close" type="button" :title="t('components.modal.closeEsc')" @click="close">✕</button>
          </header>

          <!-- 内容区域 -->
          <div class="modal-body">
            <CustomScrollbar2 class="modal-scroll">
              <slot />
            </CustomScrollbar2>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(var(--st-blur-lg)) saturate(140%);
  -webkit-backdrop-filter: blur(var(--st-blur-lg)) saturate(140%);
  padding: var(--st-gap-2xl);
}

.modal-container {
  position: relative;
  width: 100%;
  max-width: var(--st-modal-xl-width);
  height: var(--st-modal-max-height);
  max-height: var(--st-modal-max-height);
  display: flex;
  flex-direction: column;
  border-radius: var(--st-radius-lg);
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-strong));
  background: rgb(255, 255, 255);
  box-shadow: 0 var(--st-gap-2xl) var(--st-icon-container-lg) rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

/* 自适应高度模式：高度由内容决定，但不超过视口 90vh */
.modal-container.is-auto-height {
  height: auto;
  max-height: 90vh;
}

[data-theme="dark"] .modal-container {
  background: var(--st-content-modal-bg-dark, rgb(24, 24, 26));
}

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--st-modal-header-padding);
  border-bottom: 1px solid rgba(var(--st-border), 0.85);
  background: rgba(var(--st-surface-2), 0.5);
}

.modal-title {
  display: inline-flex;
  align-items: center;
  gap: var(--st-spacing-lg);
  font-weight: 700;
  font-size: var(--st-font-2xl);
  color: rgb(var(--st-color-text));
}

.icon-20 {
  width: var(--st-icon-lg);
  height: var(--st-icon-lg);
  stroke: currentColor;
}

.modal-close {
  appearance: none;
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-strong));
  background: rgb(var(--st-surface-2));
  border-radius: var(--st-spacing-lg);
  padding: var(--st-spacing-md) var(--st-gap-lg);
  font-size: var(--st-font-2xl);
  cursor: pointer;
  color: rgb(var(--st-color-text));
  transition: transform var(--st-transition-fast), background var(--st-transition-fast), box-shadow var(--st-transition-fast);
  line-height: 1;
}

.modal-close:hover {
  background: rgb(var(--st-surface));
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

/* Body */
.modal-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.modal-scroll {
  position: absolute;
  inset: 0;
  padding: var(--st-modal-body-padding);
}

/* 自适应高度模式下，改为正常文档流，避免 height:auto 时内容区域高度为 0 */
.modal-container.is-auto-height .modal-body {
  flex: 0 1 auto;
  min-height: 0;
  overflow: visible;
}

.modal-container.is-auto-height .modal-scroll {
  position: static;
}

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity var(--st-transition-slow);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-container,
.modal-fade-leave-active .modal-container {
  transition: transform var(--st-content-modal-transition, 0.3s) cubic-bezier(0.22, 0.61, 0.36, 1), opacity var(--st-transition-slow);
}

.modal-fade-enter-from .modal-container,
.modal-fade-leave-to .modal-container {
  transform: scale(0.95) translateY(var(--st-gap-2xl));
  opacity: 0;
}

@media (max-width: 768px) {
  .modal-overlay {
    padding: 0;
  }
  
  .modal-container {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }
}
</style>