<script setup>
import { computed } from 'vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  modelValue: { type: String, default: 'threaded' }, // 'threaded' | 'sandbox'
  options: {
    type: Array,
    default: null
  },
})
const emit = defineEmits(['update:modelValue'])

const effectiveOptions = computed(() => props.options || [
  { key: 'threaded', label: t('components.modeSwitch.threaded') },
  { key: 'sandbox', label: t('components.modeSwitch.sandbox') },
])

function selectMode(key) {
  if (key !== props.modelValue) emit('update:modelValue', key)
}
</script>

<template>
  <div class="st-mode-switch">
    <button
      v-for="opt in effectiveOptions"
      :key="opt.key"
      type="button"
      class="st-switch-btn"
      :class="{ active: props.modelValue === opt.key }"
      @click="selectMode(opt.key)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
/* 与全局 Design Tokens 兼容，遵循 4/8 间距体系 */
.st-mode-switch {
  display: inline-flex;
  gap: var(--st-gap-sm);
}
.st-switch-btn {
  padding: var(--st-spacing-sm) var(--st-spacing-lg);
  border-radius: var(--st-radius-md);
  border: 1px solid rgb(var(--st-border));
  background: rgb(var(--st-surface));
  color: rgb(var(--st-color-text));
  cursor: pointer;
  font-size: var(--st-font-sm);
  line-height: 1;
  transition:
    background var(--st-transition-fast),
    border-color var(--st-transition-fast),
    transform var(--st-transition-fast);
}
.st-switch-btn:hover {
  transform: translateY(var(--st-topbar-hover-lift, -1px));
}
.st-switch-btn.active {
  background: var(--st-mode-active-bg, rgba(var(--st-primary), 0.14));
  border-color: var(--st-mode-active-border, rgba(var(--st-primary), 0.45));
}
</style>