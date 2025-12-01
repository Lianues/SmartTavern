<script setup>
import HomeMenu from '@/components/home/HomeMenu.vue'

const emit = defineEmits(['new-game', 'open-load', 'open-appearance', 'open-plugins', 'open-options'])
</script>

<template>
  <section data-scope="start-view" class="st-start">
    <HomeMenu
      @new-game="emit('new-game')"
      @open-load="emit('open-load')"
      @open-appearance="emit('open-appearance')"
      @open-plugins="emit('open-plugins')"
      @open-options="emit('open-options')"
    />
  </section>
</template>

<style scoped>
/* 开始视图（Hero） */
.st-start {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: var(--st-spacing-2xl);
  position: relative;
}
.st-start::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: var(--st-bg-start);
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
  opacity: 1;
  z-index: 0; /* 确保背景图位于内容层后面但不被 body 白底影响 */
  pointer-events: none;
}
@media (max-width: 980px) { .st-start { grid-template-columns: 1fr; } }
</style>