<script setup>
import { computed, onMounted, onUpdated } from 'vue'
const props = defineProps({
  icon: { type: String, default: 'puzzle' },
  title: { type: String, required: true },
  desc: { type: String, default: '' },
  part: { type: String, default: '' },
})
const emit = defineEmits(['click'])

const isLucide = computed(() => /^[a-z\-]+$/.test(props.icon))
onMounted(() => window.lucide?.createIcons?.())
onUpdated(() => window.lucide?.createIcons?.())
</script>

<template>
  <button
    type="button"
    class="st-preview-card"
    :data-part="props.part || undefined"
    :title="props.title"
    @click="emit('click')"
  >
    <div class="st-preview-head">
      <span class="st-icon">
        <i v-if="isLucide" :data-lucide="props.icon"></i>
        <i v-else data-lucide="puzzle"></i>
      </span>
      <div class="st-preview-title">{{ props.title }}</div>
    </div>
    <div v-if="props.desc" class="st-preview-desc">
      {{ props.desc }}
    </div>
  </button>
</template>

<style scoped>
/* 预览卡：与全局 Design Tokens 兼容，遵循 4/8 间距体系 */
.st-preview-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: center;
  text-align: left;
  width: 100%;
  padding: 12px;
  border-radius: var(--st-radius-md);
  border: 1px solid rgb(var(--st-border));
  /* 浅色主题：使用更灰的背景色，与悬浮时的白色形成对比 */
  background: rgba(120, 120, 130, 0.08);
  cursor: pointer;
  transition: transform .12s ease, background .12s ease, box-shadow .12s ease, border-color .12s ease;
}
.st-preview-card:hover {
  transform: translateY(-1px);
  /* 悬浮时使用更白/更亮的背景 */
  background: rgba(255, 255, 255, 0.85);
  border-color: rgba(var(--st-primary), 0.35);
  box-shadow: var(--st-shadow-sm);
}

/* 深色主题覆盖 */
[data-theme="dark"] .st-preview-card,
:root[data-theme="dark"] .st-preview-card {
  background: rgba(40, 42, 50, 0.6);
}
[data-theme="dark"] .st-preview-card:hover,
:root[data-theme="dark"] .st-preview-card:hover {
  background: rgba(55, 58, 68, 0.9);
  border-color: rgba(var(--st-primary), 0.4);
}

.st-preview-head { display: contents; }
.st-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px; height: 32px;
  border-radius: var(--st-radius-md);
  background: rgba(var(--st-primary), 0.14);
}
.st-preview-title {
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--st-color-text));
}
.st-preview-desc {
  grid-column: 1 / -1;
  font-size: 12px;
  color: rgba(var(--st-color-text), 0.7);
  margin-top: 2px;
}
</style>