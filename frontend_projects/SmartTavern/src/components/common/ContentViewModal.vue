<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '详细内容' },
  icon: { type: String, default: '' }, // lucide icon name
})

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
        <div class="modal-container glass">
          <!-- 顶部栏 -->
          <header class="modal-header">
            <div class="modal-title">
              <i v-if="icon" :data-lucide="icon" class="modal-icon icon-20" aria-hidden="true"></i>
              {{ title }}
            </div>
            <button class="modal-close" type="button" title="关闭 (ESC)" @click="close">✕</button>
          </header>

          <!-- 内容区域 -->
          <div class="modal-body">
            <CustomScrollbar class="modal-scroll">
              <slot />
            </CustomScrollbar>
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
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  padding: 20px;
}

.modal-container {
  position: relative;
  width: 100%;
  max-width: 1400px;
  height: 90vh;
  display: flex;
  flex-direction: column;
  border-radius: var(--st-radius-lg);
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(255, 255, 255);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

[data-theme="dark"] .modal-container {
  background: rgb(14, 17, 22);
}

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(var(--st-border), 0.85);
  background: rgba(var(--st-surface-2), 0.5);
}

.modal-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 18px;
  color: rgb(var(--st-color-text));
}

.icon-20 {
  width: 20px;
  height: 20px;
  stroke: currentColor;
}

.modal-close {
  appearance: none;
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface-2));
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 18px;
  cursor: pointer;
  color: rgb(var(--st-color-text));
  transition: transform .15s ease, background .15s ease, box-shadow .15s ease;
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
  padding: 20px;
}

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-container,
.modal-fade-leave-active .modal-container {
  transition: transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.25s ease;
}

.modal-fade-enter-from .modal-container,
.modal-fade-leave-to .modal-container {
  transform: scale(0.95) translateY(20px);
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