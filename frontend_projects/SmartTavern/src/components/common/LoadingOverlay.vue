<script setup>
const props = defineProps({
  show: { type: Boolean, default: false },
  message: { type: String, default: '加载中...' }
})
</script>

<template>
  <transition name="st-loading-fade">
    <div v-if="show" class="st-loading-overlay">
      <div class="st-loading-content">
        <div class="st-loading-spinner">
          <svg class="spinner-svg" viewBox="0 0 50 50">
            <circle class="spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
          </svg>
        </div>
        <div class="st-loading-message">{{ message }}</div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.st-loading-overlay {
  position: fixed;
  inset: 0;
  background: var(--st-loading-overlay-bg, rgba(0, 0, 0, 0.5));
  backdrop-filter: blur(var(--st-backdrop-blur-md));
  -webkit-backdrop-filter: blur(var(--st-backdrop-blur-md));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.st-loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--st-gap-2xl);
}

.st-loading-spinner {
  width: var(--st-icon-container-lg);
  height: var(--st-icon-container-lg);
}

.spinner-svg {
  width: 100%;
  height: 100%;
  animation: rotate var(--st-loading-rotate-duration, 2s) linear infinite;
}

.spinner-path {
  stroke: rgb(var(--st-primary));
  stroke-linecap: round;
  animation: dash var(--st-loading-dash-duration, 1.5s) ease-in-out infinite;
}

@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}

.st-loading-message {
  font-size: var(--st-font-xl);
  font-weight: 500;
  color: var(--st-loading-text-color, white);
  text-shadow: var(--st-loading-text-shadow, 0 var(--st-spacing-xs) var(--st-spacing-xs) rgba(0, 0, 0, 0.3));
}

.st-loading-fade-enter-active,
.st-loading-fade-leave-active {
  transition: opacity var(--st-loading-fade-duration, 0.3s) ease;
}

.st-loading-fade-enter-from,
.st-loading-fade-leave-to {
  opacity: 0;
}
</style>