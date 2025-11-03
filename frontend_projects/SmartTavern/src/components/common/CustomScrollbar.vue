<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'

/**
 * 简单的自定义滚动条组件
 * - 隐藏原生滚动条
 * - 提供简洁的自定义滚动条样式
 * - 响应滚动事件同步滑块位置
 */

const props = defineProps({
  /** 滚动条宽度（px，悬浮模式下为静默态宽度） */
  width: {
    type: Number,
    default: 8
  },
  /** 悬浮导轨颜色（保持透明以不占视觉） */
  trackColor: {
    type: String,
    default: 'transparent'
  },
  /** 可选：强制指定滑块颜色（不设置则由 CSS 主题控制） */
  thumbColor: {
    type: String,
    default: ''
  },
  /** 可选：滑块 hover 颜色（不设置则由 CSS 主题控制） */
  thumbHoverColor: {
    type: String,
    default: ''
  },
  /** 悬浮模式（不占用布局，自动显隐） */
  overlay: {
    type: Boolean,
    default: true
  },
  /** 自动隐藏延迟（毫秒） */
  autoHideDelay: {
    type: Number,
    default: 1200
  },
  /** 悬浮/交互时的宽度（px） */
  hoverWidth: {
    type: Number,
    default: 12
  }
})

const scrollContainer = ref(null)
const scrollThumb = ref(null)
const scrollTrack = ref(null)

const thumbHeight = ref(0)
const thumbTop = ref(0)
const showScrollbar = ref(false)

const isHovering = ref(false)
const isVisible = ref(false)
let hideTimeout = null

const currentWidth = computed(() =>
  (isHovering.value || isDragging)
    ? (props.hoverWidth || (props.width + 4))
    : props.width
)

function reveal() {
  if (!props.overlay) return
  isVisible.value = true
  scheduleHide()
}
function scheduleHide() {
  if (!props.overlay) return
  if (hideTimeout) clearTimeout(hideTimeout)
  hideTimeout = setTimeout(() => {
    if (!isHovering.value && !isDragging) isVisible.value = false
  }, props.autoHideDelay)
}

let isDragging = false
let startY = 0
let startScrollTop = 0
let resizeObserver = null

// 计算并更新滚动条状态
function updateScrollbar() {
  if (!scrollContainer.value) return

  const container = scrollContainer.value
  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight
  const scrollTop = container.scrollTop

  // 判断是否需要显示滚动条
  showScrollbar.value = scrollHeight > clientHeight
  
  if (!showScrollbar.value) return

  // 计算滑块高度（最小32px）
  const ratio = clientHeight / Math.max(1, scrollHeight)
  thumbHeight.value = Math.max(32, clientHeight * ratio)

  // 计算滑块位置
  const maxScrollTop = Math.max(1, scrollHeight - clientHeight)
  const maxThumbTop = Math.max(1, clientHeight - thumbHeight.value)
  thumbTop.value = (scrollTop / maxScrollTop) * maxThumbTop
}

/* 滚动事件处理 */
function handleScroll() {
  updateScrollbar()
  reveal()
}

// 悬浮边缘自动显隐（距离右边缘 24px 内显示）
function handleWrapperMouseMove(e) {
  if (!props.overlay) return
  const el = e.currentTarget
  if (!el) return
  const rect = el.getBoundingClientRect()
  const dist = rect.right - e.clientX
  if (dist <= 24) {
    reveal()
  } else {
    scheduleHide()
  }
}

// 全局鼠标移动：保持计时，停止后按延迟隐藏
function handleGlobalMouseMove() {
  if (!props.overlay) return
  if (isVisible.value) scheduleHide()
}


// 鼠标按下滑块
function handleThumbMouseDown(e) {
  isDragging = true
  startY = e.clientY
  startScrollTop = scrollContainer.value.scrollTop
  reveal()
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  
  e.preventDefault()
}

// 鼠标移动
function handleMouseMove(e) {
  if (!isDragging || !scrollContainer.value) return
  
  const container = scrollContainer.value
  const deltaY = e.clientY - startY
  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight
  const maxScrollTop = scrollHeight - clientHeight
  const maxThumbTop = clientHeight - thumbHeight.value
  
  // 计算新的滚动位置
  const scrollDelta = (deltaY / maxThumbTop) * maxScrollTop
  container.scrollTop = startScrollTop + scrollDelta
}

// 鼠标释放
function handleMouseUp() {
  isDragging = false
  scheduleHide()
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

// 点击轨道跳转
function handleTrackClick(e) {
  if (e.target !== scrollTrack.value) return
  
  const container = scrollContainer.value
  const trackRect = scrollTrack.value.getBoundingClientRect()
  const clickY = e.clientY - trackRect.top
  
  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight
  const maxScrollTop = scrollHeight - clientHeight
  
  // 计算目标滚动位置（点击位置居中）
  const targetThumbTop = clickY - thumbHeight.value / 2
  const maxThumbTop = clientHeight - thumbHeight.value
  const ratio = Math.max(0, Math.min(1, targetThumbTop / maxThumbTop))
  
  container.scrollTop = ratio * maxScrollTop
}

const trackStyle = computed(() => {
  return {
    width: `${currentWidth.value}px`,
    background: props.trackColor,
    opacity: props.overlay ? (isVisible.value ? 1 : 0) : 1,
    transform: props.overlay ? (isVisible.value ? 'translateX(0)' : 'translateX(8px)') : 'translateX(0)',
    pointerEvents: props.overlay ? (isVisible.value ? 'auto' : 'none') : 'auto'
  }
})

const thumbStyle = computed(() => {
  const style = {
    height: `${thumbHeight.value}px`,
    top: `${thumbTop.value}px`,
  }
  if (props.thumbColor) style.background = props.thumbColor
  if (props.thumbHoverColor) style['--thumb-hover-color'] = props.thumbHoverColor
  return style
})


// 组件挂载
onMounted(() => {
  nextTick(() => {
    // 延迟更新以确保内容完全渲染
    setTimeout(() => {
      updateScrollbar()
    }, 100)
    
    if (scrollContainer.value) {
      scrollContainer.value.addEventListener('scroll', handleScroll, { passive: true })
    }
    
    // 监听窗口大小变化
    window.addEventListener('resize', updateScrollbar)
    // 全局鼠标移动：保持活跃时显示，停止后按延迟隐藏
    window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true })

    // 使用 ResizeObserver 监听容器尺寸变化
    if (window.ResizeObserver && scrollContainer.value) {
      resizeObserver = new ResizeObserver(() => {
        updateScrollbar()
      })
      resizeObserver.observe(scrollContainer.value)
    }
    
    // 使用 MutationObserver 监听内容变化
    if (scrollContainer.value) {
      const observer = new MutationObserver(() => {
        updateScrollbar()
      })
      observer.observe(scrollContainer.value, {
        childList: true,
        subtree: true,
        characterData: true
      })
    }
  })
})

// 组件卸载
onBeforeUnmount(() => {
  if (scrollContainer.value) {
    scrollContainer.value.removeEventListener('scroll', handleScroll)
  }
  window.removeEventListener('resize', updateScrollbar)
  window.removeEventListener('mousemove', handleGlobalMouseMove)
  if (resizeObserver) {
    try { resizeObserver.disconnect() } catch (_) {}
    resizeObserver = null
  }
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})

// 暴露更新方法（用于外部触发内容变化后更新滚动条）
defineExpose({
  update: updateScrollbar
})
</script>

<template>
  <div class="custom-scrollbar-wrapper" @mouseenter="isHovering = true; reveal()" @mouseleave="isHovering = false; scheduleHide()" @mousemove="handleWrapperMouseMove">
    <!-- 滚动内容容器 -->
    <div 
      ref="scrollContainer" 
      class="scroll-container"
      :class="{ 'has-scrollbar': showScrollbar }"
    >
      <slot />
    </div>
    
    <!-- 自定义滚动条 -->
    <div
      v-show="showScrollbar"
      ref="scrollTrack"
      class="scroll-track"
      :style="trackStyle"
      @click="handleTrackClick"
    >
      <div
        ref="scrollThumb"
        class="scroll-thumb"
        :style="thumbStyle"
        @mousedown="handleThumbMouseDown"
      />
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.scroll-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  /* 隐藏原生滚动条 */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.scroll-container::-webkit-scrollbar {
  display: none; /* Chrome/Safari/Opera */
}

/* 悬浮模式：不占布局空间 */
.scroll-container.has-scrollbar {
  padding-right: 0;
}

.scroll-track {
  position: absolute;
  top: 0;
  right: 2px;
  height: 100%;
  border-radius: 9999px;
  cursor: pointer;
  transition:
    opacity .35s cubic-bezier(.22,.61,.36,1),
    transform .35s cubic-bezier(.22,.61,.36,1),
    width .25s ease;
  z-index: 10;
  opacity: 1;
}

.scroll-thumb {
  position: absolute;
  left: 0;
  width: 100%;
  border-radius: 9999px;
  cursor: grab;
  transition: background 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, top 0.06s linear;
  will-change: top;
  /* 浅色主题：深色滑块 */
  background: rgba(30, 30, 30, 0.4);
  border: 1px solid rgba(30, 30, 30, 0.3);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.15);
}

.scroll-thumb:hover {
  background: rgba(30, 30, 30, 0.55);
  border-color: rgba(30, 30, 30, 0.45);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.12), 0 3px 8px rgba(0,0,0,0.2);
  transform: scaleX(1.05);
}

/* 深色主题：浅色滑块 */
[data-theme="dark"] .scroll-thumb {
  background: rgba(240, 240, 240, 0.35);
  border: 1px solid rgba(240, 240, 240, 0.25);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.08), 0 2px 6px rgba(0,0,0,0.25);
}

[data-theme="dark"] .scroll-thumb:hover {
  background: rgba(240, 240, 240, 0.5);
  border-color: rgba(240, 240, 240, 0.4);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.12), 0 3px 8px rgba(0,0,0,0.3);
}

.scroll-thumb:active {
  cursor: grabbing;
  transform: scaleX(1.1);
}

/* 减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  .scroll-track,
  .scroll-thumb {
    transition: none !important;
  }
}
</style>