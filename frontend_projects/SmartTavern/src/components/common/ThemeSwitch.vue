<script setup>
import { computed } from 'vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  theme: { type: String, default: 'system' } // 'system' | 'light' | 'dark'
})
const emit = defineEmits(['update:theme'])

const options = computed(() => [
  { key: 'system', label: t('components.themeSwitch.system') },
  { key: 'light', label: t('components.themeSwitch.light') },
  { key: 'dark', label: t('components.themeSwitch.dark') },
])

function selectTheme(key) {
  emit('update:theme', key)
}

function getTitle(opt) {
  return t('components.themeSwitch.switchTo', { label: opt.label })
}
</script>

<template>
  <div class="st-theme-switch">
    <button
      v-for="opt in options"
      :key="opt.key"
      type="button"
      class="st-pill"
      :class="{ active: props.theme === opt.key }"
      :title="getTitle(opt)"
      @click="selectTheme(opt.key)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
/* 与全局 Design Tokens 兼容的样式，遵循 4/8 间距体系 */
/* 遵循 UI 规范：60-30-10 法则，使用中性色 */
.st-theme-switch {
  display: inline-flex;
  background: rgba(var(--st-surface), 0.35);
  backdrop-filter: blur(var(--st-blur-md)) saturate(140%);
  -webkit-backdrop-filter: blur(var(--st-blur-md)) saturate(140%);
  padding: var(--st-radius-xs);
  border-radius: var(--st-radius-xs);
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-strong));
  box-shadow: var(--st-shadow-sm);
}
[data-theme="dark"] .st-theme-switch {
  background: rgba(var(--st-surface), 0.28);
}
.st-pill {
  padding: var(--st-spacing-sm) var(--st-spacing-lg);
  border-radius: var(--st-radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: rgb(var(--st-color-text));
  cursor: pointer;
  font-size: var(--st-font-sm);
  line-height: 1;
  transition:
    background var(--st-transition-fast),
    border-color var(--st-transition-fast),
    transform var(--st-transition-fast);
}
.st-pill:hover {
  transform: translateY(var(--st-topbar-hover-lift, -1px));
  background: var(--st-theme-pill-hover-light, rgba(0, 0, 0, 0.04));
}
[data-theme="dark"] .st-pill:hover {
  background: var(--st-theme-pill-hover-dark, rgba(255, 255, 255, 0.06));
}
/* 选中态：使用中性灰色，遵循规范避免蓝紫色 */
.st-pill.active {
  background: var(--st-theme-pill-active-bg-light, rgba(60, 60, 70, 0.12));
  color: rgb(var(--st-color-text));
  border: 1px solid var(--st-theme-pill-active-border-light, rgba(60, 60, 70, 0.35));
}
[data-theme="dark"] .st-pill.active {
  background: var(--st-theme-pill-active-bg-dark, rgba(180, 180, 190, 0.14));
  border: 1px solid var(--st-theme-pill-active-border-dark, rgba(180, 180, 190, 0.4));
}
</style>