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
    radial-gradient(var(--st-bg-gradient-size, 800px 500px) at var(--st-bg-gradient-1-pos, 20% 10%), rgb(var(--st-bg-gradient-1-color, 120 120 130) / var(--st-bg-gradient-1-alpha, 0.18)), transparent var(--st-bg-gradient-stop, 60%)),
    radial-gradient(var(--st-bg-gradient-size, 800px 500px) at var(--st-bg-gradient-2-pos, 80% 10%), rgb(var(--st-bg-gradient-2-color, 100 100 110) / var(--st-bg-gradient-2-alpha, 0.15)), transparent var(--st-bg-gradient-stop, 60%)),
    radial-gradient(var(--st-bg-gradient-size, 800px 500px) at var(--st-bg-gradient-3-pos, 50% 90%), rgb(var(--st-bg-gradient-3-color, 110 110 120) / var(--st-bg-gradient-3-alpha, 0.15)), transparent var(--st-bg-gradient-stop, 60%));
  filter: blur(var(--st-bg-gradient-blur, 40px));
}
.st-noise {
  position: absolute; inset: 0;
  /* 噪点 SVG - opacity 需要内联在 data URL 中，使用 CSS calc 动态生成不现实，保留固定值或通过 JS 动态设置 */
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" opacity="0.045"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23n)"/></svg>');
  background-size: cover;
  /* 使用 CSS opacity 作为额外控制层（可与 SVG opacity 叠加） */
  opacity: var(--st-bg-noise-opacity, 1);
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
  background: rgb(var(--st-glass-bg-light, 255 255 255) / var(--st-glass-bg-light-alpha, 0.6));
  backdrop-filter: saturate(var(--st-glass-saturate, 140%)) blur(var(--st-glass-blur, 10px));
  -webkit-backdrop-filter: saturate(var(--st-glass-saturate, 140%)) blur(var(--st-glass-blur, 10px));
  border: 1px solid rgb(var(--st-border) / var(--st-glass-border-alpha, 0.7));
  box-shadow: var(--st-shadow-sm);
}
[data-theme="dark"] .glass {
  background: rgb(var(--st-glass-bg-dark, 28 28 30) / var(--st-glass-bg-dark-alpha, 0.55));
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
  /* 使用 calc 补偿 zoom 缩放导致的高度不足问题 */
  /* 当 zoom < 1 时，100vh 会被缩小，需要除以 scale 来补偿 */
  height: calc(100vh / var(--st-ui-scale, 1));
  min-height: calc(100vh / var(--st-ui-scale, 1));
  overflow: hidden;
}
.st-body {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 0;
  padding: 0;
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