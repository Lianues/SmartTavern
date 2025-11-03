<script setup>
import { computed } from 'vue'
import { useToastsStore } from '@/stores/workflow/toasts'

const store = useToastsStore()
const toasts = computed(() => store.list)

/** 手动关闭 */
function closeToast(id) {
  try { store.remove(id) } catch (_) {}
}

/** 友好标题 */
function typeTitle(type) {
  switch (type) {
    case 'success': return '成功'
    case 'warning': return '提示'
    case 'error': return '错误'
    default: return '消息'
  }
}
</script>

<template>
  <div class="st-toasts" aria-live="polite" aria-atomic="true">
    <transition-group name="st-toast" tag="div" class="st-toasts-list">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="st-toast"
        :data-type="t.type"
        role="status"
      >
        <div class="st-toast__bar" :data-type="t.type" aria-hidden="true"></div>
        <div class="st-toast__content">
          <div class="st-toast__title">{{ typeTitle(t.type) }}</div>
          <div class="st-toast__message">{{ t.message }}</div>
        </div>
        <button class="st-toast__close" type="button" @click="closeToast(t.id)" aria-label="关闭">×</button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
/* 容器固定在右上角 */
.st-toasts {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 1000;
  pointer-events: none; /* 允许下层交互；卡片内再打开 */
}
.st-toasts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 单个 Toast 卡片 */
.st-toast {
  position: relative;
  display: grid;
  grid-template-columns: 4px 1fr auto;
  align-items: start;
  gap: 14px;
  min-width: 300px;
  max-width: min(440px, 85vw);
  padding: 14px 14px 14px 0;
  border-radius: 12px;
  background: rgba(30, 30, 35, 0.92);
  color: rgba(255, 255, 255, 0.95);
  box-shadow: 0 8px 32px rgba(0,0,0,.3),
              0 4px 12px rgba(0,0,0,.2),
              0 0 0 1px rgba(255,255,255,.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  pointer-events: auto;
  overflow: hidden;
}

/* 左侧色条根据类型着色 */
.st-toast__bar {
  width: 4px;
  height: 100%;
  border-radius: 12px 0 0 12px;
  background: linear-gradient(180deg,
    var(--st-toast-color-light, #94a3b8) 0%,
    var(--st-toast-color, #6b7280) 100%);
  box-shadow: 2px 0 8px rgba(var(--st-toast-color-rgb, 107 114 128), 0.3);
}
.st-toast__bar[data-type="success"] {
  --st-toast-color: #10b981;
  --st-toast-color-light: #34d399;
  --st-toast-color-rgb: 16 185 129;
}
.st-toast__bar[data-type="warning"] {
  --st-toast-color: #f59e0b;
  --st-toast-color-light: #fbbf24;
  --st-toast-color-rgb: 245 158 11;
}
.st-toast__bar[data-type="error"] {
  --st-toast-color: #ef4444;
  --st-toast-color-light: #f87171;
  --st-toast-color-rgb: 239 68 68;
}
.st-toast__bar[data-type="info"] {
  --st-toast-color: #3b82f6;
  --st-toast-color-light: #60a5fa;
  --st-toast-color-rgb: 59 130 246;
}

/* 内容区 */
.st-toast__content {
  display: grid;
  gap: 4px;
  padding: 2px 0;
}
.st-toast__title {
  font-weight: 700;
  font-size: 14px;
  line-height: 1.3;
  opacity: 1;
  letter-spacing: 0.01em;
}
.st-toast__message {
  font-size: 13px;
  line-height: 1.45;
  opacity: 0.88;
  word-break: break-word;
}

/* 关闭按钮 */
.st-toast__close {
  appearance: none;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  font-size: 20px;
  line-height: 1;
  padding: 6px 8px;
  margin: 0;
  border-radius: 6px;
  cursor: pointer;
  transition: all .2s ease;
  height: fit-content;
}
.st-toast__close:hover {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 1);
  transform: scale(1.1);
}
.st-toast__close:active {
  transform: scale(0.95);
}

/* 进出场动画 */
.st-toast-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(.98);
  filter: blur(4px);
}
.st-toast-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(.98);
  filter: blur(4px);
}
.st-toast-enter-active,
.st-toast-leave-active {
  transition: opacity .18s ease, transform .2s cubic-bezier(.22,.61,.36,1), filter .2s ease;
}
</style>