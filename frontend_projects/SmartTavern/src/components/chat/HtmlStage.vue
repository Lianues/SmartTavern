<template>
  <!-- 当 html 为空时，不渲染舞台，仅透传默认插槽（由父级自行处理回退内容） -->
  <div v-if="html">
    <div v-if="before" class="floor-text">{{ before }}</div>

    <!-- 楼层内 iframe 舞台（宽度百分比受 --st-threaded-stage-maxw 控制，不超过消息宽度） -->
    <div class="floor-html-stage">
      <div class="floor-html-stage-inner" :class="{ 'is-auto': isAuto, 'is-fixed': !isAuto }">
        <!-- 仅当 shouldRender 为 true 时才渲染 iframe，否则显示占位 -->
        <HtmlIframeSandbox
          v-if="shouldRender"
          :html="html"
          :auto-height="isAuto"
          @iframe-loaded="$emit('iframe-loaded')"
        />
        <div v-else class="iframe-placeholder">
          <i data-lucide="eye-off" class="placeholder-icon"></i>
          <div class="placeholder-content">
            <span class="placeholder-title">{{ t('chat.iframe.notRendered') }}</span>
            <span class="placeholder-hint">{{ t('chat.iframe.notRenderedHint') }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="after" class="floor-text">{{ after }}</div>
  </div>
  <slot v-else />
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import HtmlIframeSandbox from '@/components/sandbox/HtmlIframeSandbox.vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  before: { type: String, default: '' },
  html:   { type: String, default: '' },
  after:  { type: String, default: '' },
  /**
   * 显示模式：
   * - 'auto' 自适应高度（默认）
   * - 'fixed' 固定容器（使用 CSS aspect-ratio）
   */
  displayMode: { type: String, default: 'auto', validator: (v) => ['auto','fixed'].includes(v) },
  // 当允许时，可由 HTML 内联指令覆盖
  preferInlineMode: { type: Boolean, default: false },
  // 是否应该渲染 iframe（用于渲染优化）
  shouldRender: { type: Boolean, default: true },
})

defineEmits(['iframe-loaded'])

function parseInlineDisplayMode(s) {
  if (!s) return null
  const re = /<!--\s*st:display-mode\s*=\s*(auto|fixed)\s*-->/gi
  let m, last = null
  while ((m = re.exec(s)) !== null) {
    const v = (m[1] || '').toLowerCase()
    if (v === 'auto' || v === 'fixed') last = v
  }
  return last
}

function readThreadedDisplayPref() {
  try {
    const raw = localStorage.getItem('st.appearance.threaded.v1')
    if (!raw) return null
    const snap = JSON.parse(raw)
    const sel = String(snap?.threadedDisplayModeSel || '').toLowerCase()
    if (sel === 'inline') return { preferInline: true, displayMode: 'auto' }
    if (sel === 'fixed')  return { preferInline: false, displayMode: 'fixed' }
    if (sel === 'auto')   return { preferInline: false, displayMode: 'auto' }
    return null
  } catch { return null }
}

const inlineDisplayMode = computed(() => parseInlineDisplayMode(props.html))

// 运行时优先：外观面板广播的即时选择
const runtimePref = ref(null)
const lsPref = computed(() => runtimePref.value ?? readThreadedDisplayPref())

const effectivePreferInline = computed(() => {
  return (lsPref.value && typeof lsPref.value.preferInline === 'boolean')
    ? lsPref.value.preferInline
    : props.preferInlineMode
})

const baseDisplayMode = computed(() => {
  return (lsPref.value && lsPref.value.displayMode) ? lsPref.value.displayMode : props.displayMode
})

const displayModeEffective = computed(() => {
  if (effectivePreferInline.value && inlineDisplayMode.value) {
    return inlineDisplayMode.value
  }
  return baseDisplayMode.value
})

const isAuto = computed(() => displayModeEffective.value !== 'fixed')

// 监听外观面板事件，实现即时切换
function onAppearanceThreadedUpdate(e) {
  const d = e?.detail
  const sel = String(d?.threadedDisplayModeSel || '').toLowerCase()
  if (sel === 'inline') {
    runtimePref.value = { preferInline: true, displayMode: 'auto' }
  } else if (sel === 'fixed') {
    runtimePref.value = { preferInline: false, displayMode: 'fixed' }
  } else if (sel === 'auto') {
    runtimePref.value = { preferInline: false, displayMode: 'auto' }
  } else {
    runtimePref.value = null
  }
}
onMounted(() => window.addEventListener('stAppearanceThreadedUpdate', onAppearanceThreadedUpdate))
onBeforeUnmount(() => {
  try { window.removeEventListener('stAppearanceThreadedUpdate', onAppearanceThreadedUpdate) } catch (_) {}
})
</script>

<style scoped>
/* 楼层内 HTML 舞台（iframe 渲染） */
.floor-html-stage {
  width: min(100%, calc(var(--st-threaded-stage-maxw, 100) * 1%));
  margin: var(--st-spacing-sm) auto;
}
.floor-html-stage-inner {
  position: relative;
  width: 100%;
  aspect-ratio: var(--st-threaded-stage-aspect, 16 / 9);
  padding: var(--st-threaded-stage-padding, 8px);
  border-radius: var(--st-threaded-stage-radius, 12px);
  border: 1px solid rgba(var(--st-border), 0.6);
  background: rgb(var(--st-surface) / var(--st-threaded-stage-container-bg-opacity, 0.82)) !important;
  box-shadow: var(--st-shadow-sm);
  backdrop-filter: blur(var(--st-blur-xs));
  -webkit-backdrop-filter: blur(var(--st-blur-xs));
  overflow: hidden;
}
/* 让 HtmlIframeSandbox 内部 iframe 铺满舞台（固定模式） */
.floor-html-stage-inner :deep(.st-iframe) {
  width: 100%;
  height: 100%;
  display: block;
  border: 0;
}

/* 自适应高度模式：移除固定宽高比，由 iframe 内内容驱动高度 */
.floor-html-stage-inner.is-auto {
  aspect-ratio: auto;
  height: auto;
}

/* 在自适应模式下，iframe 的高度通过行内样式控制；此处设为 auto 作为兜底覆盖上面的 100% 规则 */
.floor-html-stage-inner.is-auto :deep(.st-iframe) {
  height: auto;
}

/* iframe 占位符样式 */
.iframe-placeholder {
  width: 100%;
  height: 100%;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--st-spacing-md);
  background: rgba(var(--st-surface-2), 0.2);
  border: 1px dashed rgba(var(--st-border), 0.3);
  border-radius: 4px;
  padding: var(--st-spacing-xl);
}

.placeholder-icon {
  width: 32px;
  height: 32px;
  color: rgba(var(--st-color-text), 0.3);
  stroke-width: 1.5;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--st-spacing-xs);
}

.placeholder-title {
  color: rgba(var(--st-color-text), 0.5);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.placeholder-hint {
  color: rgba(var(--st-color-text), 0.35);
  font-size: 12px;
  text-align: center;
  max-width: 300px;
}
</style>