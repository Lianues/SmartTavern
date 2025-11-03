<script setup>
const props = defineProps({
  homePlain: { type: Boolean, default: false }
})
</script>

<template>
  <div data-scope="app-shell" class="st-app-shell" :class="{ 'home-plain': props.homePlain }">
    <!-- 背景层（渐变 + 噪点） -->
    <div class="st-bg">
      <div class="st-gradient" />
      <div class="st-noise" />
    </div>

    <!-- 主体布局：左侧槽位 + 主区 + 覆盖层槽位 -->
    <div class="st-body">
      <slot name="sidebar" />
      <main data-scope="main" class="st-main">
        <slot />
      </main>
      <slot name="overlays" />
    </div>
  </div>
</template>

<!-- 注意：为覆盖插槽内容，以下样式不加 scoped（使之作用于插槽 DOM） -->
<style>
/* 背景层 */
.st-bg {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
}
.st-gradient {
  position: absolute; inset: -10%;
  background:
    radial-gradient(800px 500px at 20% 10%, rgba(129,140,248,0.22), transparent 60%),
    radial-gradient(800px 500px at 80% 10%, rgba(56,189,248,0.18), transparent 60%),
    radial-gradient(800px 500px at 50% 90%, rgba(52,211,153,0.18), transparent 60%);
  filter: blur(40px);
}
.st-noise {
  position: absolute; inset: 0; background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" opacity="0.045"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23n)"/></svg>');
  background-size: cover;
}

/* Home plain mode: remove gradient/noise overlay */
.home-plain .st-bg { display: none; }
/* Home plain: 所有容器完全透明，不带颜色 */
.home-plain .st-body,
.home-plain .st-main,
.home-plain [data-scope="start-view"] {
  background: transparent !important;
}

/* 玻璃拟态与卡片（复用自 App.vue，保留通用类名） */
.glass {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: saturate(140%) blur(10px);
  -webkit-backdrop-filter: saturate(140%) blur(10px);
  border: 1px solid rgb(var(--st-border) /0.7);
  box-shadow: var(--st-shadow-sm);
}
[data-theme="dark"] .glass {
  background: rgba(26, 31, 43, 0.55);
}
.card {
  background: rgb(var(--st-surface));
  border: 1px solid rgb(var(--st-border));
  border-radius: var(--st-radius-lg);
  box-shadow: var(--st-shadow-md);
}

/* 布局 */
.st-app-shell {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
.st-body {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 16px;
  padding: 16px;
  overflow: hidden;
}
.st-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>