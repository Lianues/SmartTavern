
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

/**
 * SidebarDrawer
 * - 抽屉式侧边栏（展开/收起）
 * - 收起后显示可拖拽的小浮标，松开后自动吸附最近边缘（不占用布局，悬浮于页面之上）
 * - 展开时固定在左侧（overlay，不占布局）
 *
 * 解耦说明：
 * - 内容通过默认 slot 注入（例如 SidebarNav），Drawer 仅负责状态与交互
 * - 位置状态持久化（localStorage），不依赖外部 store
 */
const props = defineProps({
  modelValue: { type: Boolean, default: true }, // open/close
  width: { type: Number, default: 280 },        // 抽屉宽度
  iconSize: { type: Number, default: 44 },      // 浮标尺寸
  storageKey: { type: String, default: 'st.sidebar.drawer' },
  draggable: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(props.modelValue)
watch(() => props.modelValue, (v) => (open.value = v))
watch(open, (v) => emit('update:modelValue', v))
// 重新渲染 Lucide 图标（FAB 在 open=false 时新插入）
watch(open, () => {
  nextTick(() => {
    if (window?.lucide?.createIcons) window.lucide.createIcons()
  })
})

// 浮标位置（以页面可视区域为边界）
const margin = 12
const iconPos = ref({
  x: 0,              // 左上角坐标（使用 left/top 模式）
  y: 200,
  dock: 'right',     // 'left' | 'right' | 'top' | 'bottom'
})

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function loadPos() {
  try {
    const raw = localStorage.getItem(props.storageKey)
    if (raw) {
      const data = JSON.parse(raw)
      iconPos.value = {
        x: typeof data.x === 'number' ? data.x : 0,
        y: typeof data.y === 'number' ? data.y : 200,
        dock: data.dock || 'right',
      }
    } else {
      // 默认靠左中部（首次进入时收起在左侧）
      iconPos.value = {
        x: margin,
        y: Math.round(window.innerHeight * 0.5) - Math.round(props.iconSize * 0.5),
        dock: 'left',
      }
    }
  } catch (_) {
    iconPos.value = {
      x: margin,
      y: Math.round(window.innerHeight * 0.5) - Math.round(props.iconSize * 0.5),
      dock: 'left',
    }
  }
  clampIntoViewport()
}

function savePos() {
  localStorage.setItem(props.storageKey, JSON.stringify(iconPos.value))
}

function clampIntoViewport() {
  const maxX = window.innerWidth - props.iconSize - margin
  const maxY = window.innerHeight - props.iconSize - margin
  iconPos.value.x = clamp(iconPos.value.x, margin, maxX)
  iconPos.value.y = clamp(iconPos.value.y, margin, maxY)
}

function nearestDock() {
  // 计算到四边距离，选择最近边缘
  const dLeft = iconPos.value.x - margin
  const dRight = window.innerWidth - (iconPos.value.x + props.iconSize) - margin
  const dTop = iconPos.value.y - margin
  const dBottom = window.innerHeight - (iconPos.value.y + props.iconSize) - margin

  const distances = [
    { k: 'left', v: dLeft },
    { k: 'right', v: dRight },
    { k: 'top', v: dTop },
    { k: 'bottom', v: dBottom },
  ]

  distances.sort((a, b) => a.v - b.v)
  const nearest = distances[0].k
  iconPos.value.dock = nearest

  // 吸附
  if (nearest === 'left') iconPos.value.x = margin
  if (nearest === 'right') iconPos.value.x = window.innerWidth - props.iconSize - margin
  if (nearest === 'top') iconPos.value.y = margin
  if (nearest === 'bottom') iconPos.value.y = window.innerHeight - props.iconSize - margin
}

let dragging = false
let pointerStart = { x: 0, y: 0 }
let iconStart = { x: 0, y: 0 }
let moved = false

function onPointerDown(e) {
  if (!props.draggable) {
    // 不可拖拽则点击展开
    open.value = true
    return
  }
  dragging = true
  moved = false
  pointerStart = { x: e.clientX, y: e.clientY }
  iconStart = { x: iconPos.value.x, y: iconPos.value.y }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp, { once: true })
}

function onPointerMove(e) {
  if (!dragging) return
  const dx = e.clientX - pointerStart.x
  const dy = e.clientY - pointerStart.y
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true
  iconPos.value.x = clamp(iconStart.x + dx, margin, window.innerWidth - props.iconSize - margin)
  iconPos.value.y = clamp(iconStart.y + dy, margin, window.innerHeight - props.iconSize - margin)
}

function onPointerUp() {
  window.removeEventListener('pointermove', onPointerMove)
  dragging = false
  if (moved) {
    nearestDock()
    savePos()
  } else {
    // 认为是点击 → 展开
    open.value = true
  }
}

function onResize() {
  clampIntoViewport()
  nearestDock()
  savePos()
}

onMounted(() => {
  loadPos()
  window.addEventListener('resize', onResize)
  window.lucide?.createIcons?.()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})

// 样式计算
const iconStyle = computed(() => {
  const base = {
    position: 'fixed',
    width: props.iconSize + 'px',
    height: props.iconSize + 'px',
    zIndex: 60,
    left: iconPos.value.x + 'px',
    top: iconPos.value.y + 'px',
  }
  return base
})

const fabClass = computed(() => ['sd-fab', `dock-${iconPos.value.dock}`])

const drawerStyle = computed(() => {
  // 抽屉固定靠左 overlay
  return {
    position: 'fixed',
    zIndex: 59,
    left: margin + 'px',
    top: '64px',
    bottom: margin + 'px',
    width: props.width + 'px',
  }
})
</script>

<template>
  <!-- 展开状态：左侧 overlay 抽屉（不占用布局） -->
  <transition name="sd-backdrop">
    <div v-if="open" class="sd-backdrop" @click="open=false"></div>
  </transition>
  <transition name="sd-drawer">
    <div
      v-if="open"
      :style="drawerStyle"
      class="sd-drawer glass"
      data-scope="sidebar"
    >
      <div class="sd-header">
        <div class="sd-title">{{ t('sidebar.title') }}</div>
        <button class="sd-close" type="button" @click="open = false" :title="t('sidebar.collapse')">
          <i data-lucide="chevron-left"></i>
        </button>
      </div>
      <CustomScrollbar2 class="sd-body">
        <slot />
      </CustomScrollbar2>
    </div>
  </transition>

  <!-- 收起状态：可拖拽浮标（不占用布局，悬浮于页面之上） -->
  <button
    v-if="!open"
    :class="fabClass"
    :style="iconStyle"
    type="button"
    :title="t('sidebar.expand')"
    @pointerdown.prevent="onPointerDown"
  >
    <span class="sd-fab-icon">
      <!-- inline lucide: menu -->
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
           viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
           class="lucide lucide-menu">
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    </span>
  </button>
</template>

<style scoped>
/* Drawer */
.sd-drawer {
  display: grid;
  grid-template-rows: auto 1fr;
  border-radius: var(--st-radius-lg);
  border: 1px solid rgba(var(--st-border), 0.9);
  box-shadow: var(--st-shadow-md);
  background: rgb(var(--st-surface));
  overflow: hidden;
}

.sd-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(var(--st-border), 0.9);
}
.sd-title {
  font-weight: 700;
  color: rgb(var(--st-color-text));
}
.sd-close {
  appearance: none;
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface-2));
  border-radius: 4px;
  padding: 6px 8px;
  cursor: pointer;
  transition: transform .15s ease, background .15s ease, box-shadow .15s ease;
}
.sd-close:hover {
  background: rgb(var(--st-surface));
  transform: translateX(-2px) rotate(-2deg);
  box-shadow: var(--st-shadow-sm);
}

/* 内容容器 */
.sd-body {
  padding: 10px;
  overflow: hidden;
}

/* Backdrop 背板（点击关闭）
   使用主题墨色变量：浅色=白半透明，深色=黑半透明 */
.sd-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.18);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  z-index: 58; /* 低于抽屉(59)，高于内容 */
}

/* ═══════════════════════════════════════════════════════════════
   Floating Action Button - 优雅极简主义设计
   遵循UI美化规范：黑白中性色 + 微妙阴影 + 精致圆角
   ═══════════════════════════════════════════════════════════════ */
.sd-fab {
  /* 精致边框 - 炭黑色 */
  border: 1px solid rgba(0, 0, 0, 0.18);
  /* 极简背景：纯净白到浅灰渐变 */
  background: linear-gradient(180deg,
    #ffffff 0%,
    #fafafa 50%,
    #f5f5f5 100%
  );
  color: #1a1a1a;
  /* 精致圆角 < 4px */
  border-radius: 4px;
  /* 微妙的多层阴影 */
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.08),
    0 4px 12px rgba(0, 0, 0, 0.06),
    0 8px 24px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  cursor: grab;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  /* 细腻的微交互过渡 */
  transition:
    transform .2s cubic-bezier(.22,.61,.36,1),
    box-shadow .2s cubic-bezier(.22,.61,.36,1),
    background .2s ease,
    border-color .2s ease;
  animation: sd-float 4s ease-in-out infinite alternate 0.8s;
}

/* 悬停状态 - 微妙的提升效果 */
.sd-fab:hover {
  transform: translateY(-2px);
  border-color: rgba(0, 0, 0, 0.25);
  background: linear-gradient(180deg,
    #ffffff 0%,
    #fefefe 50%,
    #fafafa 100%
  );
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.1),
    0 8px 20px rgba(0, 0, 0, 0.08),
    0 16px 40px rgba(0, 0, 0, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 1);
}

/* ═══════════════════════════════════════════════════════════════
   暗色主题 - 深色极简设计
   ═══════════════════════════════════════════════════════════════ */
:root[data-theme="dark"] .sd-fab,
[data-theme="dark"] .sd-fab {
  border-color: rgba(255, 255, 255, 0.15);
  background: linear-gradient(180deg,
    #3a3a3a 0%,
    #2d2d2d 50%,
    #262626 100%
  );
  color: #f5f5f5;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.25),
    0 4px 12px rgba(0, 0, 0, 0.2),
    0 8px 24px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
:root[data-theme="dark"] .sd-fab:hover,
[data-theme="dark"] .sd-fab:hover {
  border-color: rgba(255, 255, 255, 0.22);
  background: linear-gradient(180deg,
    #454545 0%,
    #3a3a3a 50%,
    #333333 100%
  );
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.3),
    0 8px 20px rgba(0, 0, 0, 0.25),
    0 16px 40px rgba(0, 0, 0, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}
.sd-fab:active {
  transform: translateY(0);
  cursor: grabbing;
}
.sd-fab .sd-fab-icon {
  font-size: 18px;
}

/* dock 定制（可按需要扩展外观差异） */
.sd-fab.dock-left { border-top-left-radius: 4px; border-bottom-left-radius: 4px; }
.sd-fab.dock-right { border-top-right-radius: 4px; border-bottom-right-radius: 4px; }
.sd-fab.dock-top { border-top-left-radius: 4px; border-top-right-radius: 4px; }
.sd-fab.dock-bottom { border-bottom-left-radius: 4px; border-bottom-right-radius: 4px; }

/* Backdrop 动画 */
.sd-backdrop-enter-from, .sd-backdrop-leave-to { opacity: 0; }
.sd-backdrop-enter-active, .sd-backdrop-leave-active { transition: opacity .18s ease; }

/* Drawer 进出场动画 */
.sd-drawer-enter-from { opacity: 0; transform: translateX(-14px) scale(0.98); filter: blur(4px); }
.sd-drawer-leave-to { opacity: 0; transform: translateX(-16px) scale(0.98); filter: blur(4px); }
.sd-drawer-enter-active,
.sd-drawer-leave-active { transition: opacity .18s ease, transform .22s cubic-bezier(.22,.61,.36,1), filter .22s ease; }

/* 浮动动画（轻微呼吸） */
@keyframes sd-float {
  0% { transform: translateY(0); }
  100% { transform: translateY(-3px); }
}
</style>