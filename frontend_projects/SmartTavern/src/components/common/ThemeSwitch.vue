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
  backdrop-filter: blur(10px) saturate(140%);
  -webkit-backdrop-filter: blur(10px) saturate(140%);
  padding: 3px;
  border-radius: 3px; /* 规范要求 border-radius < 4px */
  border: 1px solid rgba(var(--st-border), 0.9);
  box-shadow: var(--st-shadow-sm);
}
[data-theme="dark"] .st-theme-switch {
  background: rgba(var(--st-surface), 0.28);
}
.st-pill {
  padding: 6px 10px;
  border-radius: 2px; /* 内部按钮使用更小的圆角 */
  border: 1px solid transparent;
  background: transparent;
  color: rgb(var(--st-color-text));
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  transition:
    background .18s cubic-bezier(.22,.61,.36,1),
    border-color .18s cubic-bezier(.22,.61,.36,1),
    transform .18s cubic-bezier(.22,.61,.36,1);
}
.st-pill:hover {
  transform: translateY(-1px);
  background: rgba(0, 0, 0, 0.04);
}
[data-theme="dark"] .st-pill:hover {
  background: rgba(255, 255, 255, 0.06);
}
/* 选中态：使用中性灰色，遵循规范避免蓝紫色 */
.st-pill.active {
  background: rgba(60, 60, 70, 0.12);
  color: rgb(var(--st-color-text));
  border: 1px solid rgba(60, 60, 70, 0.35);
}
[data-theme="dark"] .st-pill.active {
  background: rgba(180, 180, 190, 0.14);
  border: 1px solid rgba(180, 180, 190, 0.4);
}
</style>