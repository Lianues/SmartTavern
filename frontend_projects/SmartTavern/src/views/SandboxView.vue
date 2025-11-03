<script setup>
import SandboxStage from '@/components/sandbox/SandboxStage.vue'
</script>

<template>
  <section data-scope="chat-sandbox" class="st-sandbox">
    <SandboxStage />
  </section>
</template>

<style scoped>
/* Sandbox container */
.st-sandbox {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  position: relative;
}
.st-sandbox::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: var(--st-bg-sandbox);
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
  opacity: 1; /* 背景图始终全可见，遮罩由 ::after 控制 */
  /* 直接对背景图片层应用模糊（更稳定的实现） */
  filter: blur(var(--st-sandbox-bg-blur, 0px));
  will-change: filter;
  z-index: -1;
  pointer-events: none;
}
.st-sandbox::after {
  content: '';
  position: fixed;
  inset: 0;
  /* 主题自适应遮罩（不透明度独立为元素 opacity，避免动画终值跳跃） */
  background: rgb(var(--st-overlay-ink));
  opacity: var(--st-sandbox-bg-opacity, 0.12);
  /* 对背景图片应用可调模糊（通过遮罩层的 backdrop-filter 实现） */
  backdrop-filter: blur(var(--st-sandbox-bg-blur, 0px));
  -webkit-backdrop-filter: blur(var(--st-sandbox-bg-blur, 0px));
  z-index: -1;
  pointer-events: none;
  /* 为 overlay 动画提供目标变量（沙盒页） */
  --st-target-bg-opacity: var(--st-sandbox-bg-opacity, 0.12);
}
</style>