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
  gap: 8px;
}
.st-switch-btn {
  padding: 6px 10px;
  border-radius: var(--st-radius-md);
  border: 1px solid rgb(var(--st-border));
  background: rgb(var(--st-surface));
  color: rgb(var(--st-color-text));
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  transition:
    background .18s cubic-bezier(.22,.61,.36,1),
    border-color .18s cubic-bezier(.22,.61,.36,1),
    transform .18s cubic-bezier(.22,.61,.36,1);
}
.st-switch-btn:hover {
  transform: translateY(-1px);
}
.st-switch-btn.active {
  background: rgba(var(--st-primary), 0.14);
  border-color: rgba(var(--st-primary),0.45);
}
</style>