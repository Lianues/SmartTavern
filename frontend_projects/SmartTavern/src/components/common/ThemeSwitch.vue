<script setup>
const props = defineProps({
  theme: { type: String, default: 'system' } // 'system' | 'light' | 'dark'
})
const emit = defineEmits(['update:theme'])

const options = [
  { key: 'system', label: '系统' },
  { key: 'light', label: '亮' },
  { key: 'dark', label: '暗' },
]

function selectTheme(key) {
  emit('update:theme', key)
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
      :title="`切换主题：${opt.label}`"
      @click="selectTheme(opt.key)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
/* 与全局 Design Tokens 兼容的样式，遵循 4/8 间距体系 */
.st-theme-switch {
  display: inline-flex;
  background: rgba(var(--st-surface), 0.35);
  backdrop-filter: blur(10px) saturate(140%);
  -webkit-backdrop-filter: blur(10px) saturate(140%);
  padding: 4px;
  border-radius: var(--st-radius-lg);
  border: 1px solid rgba(var(--st-border),0.9);
  box-shadow: var(--st-shadow-sm);
}
[data-theme="dark"] .st-theme-switch {
  background: rgba(var(--st-surface), 0.28);
}
.st-pill {
  padding: 6px 10px;
  border-radius: var(--st-radius-md);
  border: none;
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
}
.st-pill.active {
  background: rgba(var(--st-primary), 0.14);
  color: rgb(var(--st-color-text));
  border: 1px solid rgba(var(--st-primary), 0.45);
}
</style>