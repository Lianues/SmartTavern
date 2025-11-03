<template>
  <!-- 当 html 为空时，不渲染舞台，仅透传默认插槽（由父级自行处理回退内容） -->
  <div v-if="html">
    <div v-if="before" class="floor-text">{{ before }}</div>

    <!-- 楼层内 iframe 舞台（宽度百分比受 --st-threaded-stage-maxw 控制，不超过消息宽度） -->
    <div class="floor-html-stage">
      <div class="floor-html-stage-inner" :class="{ 'is-auto': isAuto, 'is-fixed': !isAuto }">
        <HtmlIframeSandbox :html="html" :auto-height="isAuto" />
      </div>
    </div>

    <div v-if="after" class="floor-text">{{ after }}</div>
  </div>
  <slot v-else />
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import HtmlIframeSandbox from '@/components/sandbox/HtmlIframeSandbox.vue'

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
  // 当允许时，可由 HTML 内联指令 <!-- st:display-mode=auto|fixed --> 覆盖
  preferInlineMode: { type: Boolean, default: false },
})

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
  margin: 6px auto;
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
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
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
</style>