<script setup>
import { computed, onMounted, onUpdated } from 'vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  icon: { type: String, default: 'puzzle' },
  title: { type: String, required: true },
  desc: { type: String, default: '' },
  part: { type: String, default: '' },
  type: { type: String, default: '' }, // 角色卡类型：threaded 或 sandbox
})
const emit = defineEmits(['click'])

const isLucide = computed(() => /^[a-z\-]+$/.test(props.icon))

// 根据类型返回显示文本
const typeLabel = computed(() => {
  if (!props.type) return ''
  if (props.type === 'sandbox') return t('panel.character.type.sandbox')
  if (props.type === 'threaded') return t('panel.character.type.threaded')
  return ''
})

// 根据类型返回样式类
const typeClass = computed(() => {
  if (props.type === 'sandbox') return 'type-sandbox'
  if (props.type === 'threaded') return 'type-threaded'
  return ''
})

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
      <div class="st-preview-title-wrapper">
        <div class="st-preview-title">{{ props.title }}</div>
        <span v-if="typeLabel" :class="['st-preview-type-badge', typeClass]">
          {{ typeLabel }}
        </span>
      </div>
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
  gap: var(--st-spacing-md);
  align-items: center;
  text-align: left;
  width: 100%;
  padding: var(--st-spacing-xl);
  border-radius: var(--st-radius-md);
  border: 1px solid rgb(var(--st-border));
  /* 浅色主题：使用更灰的背景色，与悬浮时的白色形成对比 */
  background: var(--st-preview-card-bg-light, rgba(120, 120, 130, 0.08));
  cursor: pointer;
  transition: transform var(--st-transition-fast) ease, background var(--st-transition-fast) ease, box-shadow var(--st-transition-fast) ease, border-color var(--st-transition-fast) ease;
}
.st-preview-card:hover {
  transform: translateY(-1px);
  /* 悬浮时使用更白/更亮的背景 */
  background: var(--st-preview-card-hover-light, rgba(255, 255, 255, 0.85));
  border-color: rgba(var(--st-primary), 0.35);
  box-shadow: var(--st-shadow-sm);
}

/* 深色主题覆盖 */
[data-theme="dark"] .st-preview-card,
:root[data-theme="dark"] .st-preview-card {
  background: var(--st-preview-card-bg-dark, rgba(40, 42, 50, 0.6));
}
[data-theme="dark"] .st-preview-card:hover,
:root[data-theme="dark"] .st-preview-card:hover {
  background: var(--st-preview-card-hover-dark, rgba(55, 58, 68, 0.9));
  border-color: rgba(var(--st-primary), 0.4);
}

.st-preview-head {
  display: contents;
}
.st-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--st-avatar-sm);
  height: var(--st-avatar-sm);
  border-radius: var(--st-radius-md);
  background: rgba(var(--st-primary), 0.14);
}
.st-preview-title-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-xs);
}
.st-preview-title {
  font-size: var(--st-font-md);
  font-weight: 600;
  color: rgb(var(--st-color-text));
}
.st-preview-type-badge {
  display: inline-block;
  font-size: var(--st-font-xs);
  font-weight: 500;
  padding: var(--st-spacing-xs) var(--st-spacing-sm);
  border-radius: var(--st-radius-lg);
  width: fit-content;
  line-height: 1.2;
}
.type-threaded {
  background: var(--st-preview-badge-threaded-bg, rgba(59, 130, 246, 0.15));
  color: var(--st-preview-badge-threaded-color, rgb(59, 130, 246));
}
.type-sandbox {
  background: var(--st-preview-badge-sandbox-bg, rgba(168, 85, 247, 0.15));
  color: var(--st-preview-badge-sandbox-color, rgb(168, 85, 247));
}
[data-theme="dark"] .type-threaded,
:root[data-theme="dark"] .type-threaded {
  background: var(--st-preview-badge-threaded-bg-dark, rgba(96, 165, 250, 0.2));
  color: var(--st-preview-badge-threaded-color-dark, rgb(147, 197, 253));
}
[data-theme="dark"] .type-sandbox,
:root[data-theme="dark"] .type-sandbox {
  background: var(--st-preview-badge-sandbox-bg-dark, rgba(192, 132, 252, 0.2));
  color: var(--st-preview-badge-sandbox-color-dark, rgb(216, 180, 254));
}
.st-preview-desc {
  grid-column: 1 / -1;
  font-size: var(--st-font-sm);
  color: rgba(var(--st-color-text), 0.7);
  margin-top: var(--st-spacing-xs);
}
</style>