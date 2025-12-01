<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'

/**
 * 自定义滚动条组件2 - 方角、始终可见、悬浮式
 * - 隐藏原生滚动条
 * - 方角设计
 * - 始终可见（不自动隐藏）
 * - 悬浮于内容之上（不占用布局空间）
 */

const props = defineProps({
  /** 滚动条宽度（px） */
  width: {
    type: Number,
    default: 6
  },
  /** 导轨颜色 */
  trackColor: {
    type: String,
    default: ''
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
  /** 滚动条与边缘的距离（px） */
  offset: {
    type: Number,
    default: 2
  }
})

const scrollContainer = ref(null)
const scrollThumb = ref(null)
const scrollTrack = ref(null)

const thumbHeight = ref(0)
const thumbTop = ref(0)
const showScrollbar = ref(false)

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

  // 计算滑块高度（最小24px）
  const ratio = clientHeight / Math.max(1, scrollHeight)
  thumbHeight.value = Math.max(24, clientHeight * ratio)

  // 计算滑块位置
  const maxScrollTop = Math.max(1, scrollHeight - clientHeight)
  const maxThumbTop = Math.max(1, clientHeight - thumbHeight.value)
  thumbTop.value = (scrollTop / maxScrollTop) * maxThumbTop
}

/* 滚动事件处理 */
function handleScroll() {
  updateScrollbar()
}

// 鼠标按下滑块
function handleThumbMouseDown(e) {
  isDragging = true
  startY = e.clientY
  startScrollTop = scrollContainer.value.scrollTop
  
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
  const style = {
    width: `${props.width}px`,
    right: `${props.offset}px`,
  }
  if (props.trackColor) {
    style.background = props.trackColor
  }
  return style
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
  <div class="custom-scrollbar2-wrapper">
    <!-- 滚动内容容器 -->
    <div 
      ref="scrollContainer" 
      class="scroll-container2"
    >
      <slot />
    </div>
    
    <!-- 自定义滚动条 - 始终可见 -->
    <div
      v-show="showScrollbar"
      ref="scrollTrack"
      class="scroll-track2"
      :style="trackStyle"
      @click="handleTrackClick"
    >
      <div
        ref="scrollThumb"
        class="scroll-thumb2"
        :style="thumbStyle"
        @mousedown="handleThumbMouseDown"
      />
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar2-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.scroll-container2 {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  /* 隐藏原生滚动条 */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.scroll-container2::-webkit-scrollbar {
  display: none; /* Chrome/Safari/Opera */
}

/* 滚动轨道 - 方角、悬浮、始终可见 */
.scroll-track2 {
  position: absolute;
  top: 0;
  height: 100%;
  /* 方角设计 */
  border-radius: 0;
  cursor: pointer;
  /* 轨道背景透明 */
  background: transparent;
  z-index: 10;
  /* 始终可见 */
  opacity: 1;
}

/* 滑块 - 方角设计 */
.scroll-thumb2 {
  position: absolute;
  left: 0;
  width: 100%;
  /* 方角 */
  border-radius: 0;
  cursor: grab;
  transition: background 0.18s ease, top 0.06s linear;
  will-change: top;
  /* 浅色主题：深色滑块 - 使用固定颜色确保可见 */
  background: rgba(60, 60, 60, 0.45);
}

.scroll-thumb2:hover {
  background: rgba(60, 60, 60, 0.6);
}

/* 深色主题 */
[data-theme="dark"] .scroll-thumb2,
:root[data-theme="dark"] .scroll-thumb2 {
  background: rgba(200, 200, 200, 0.4);
}

[data-theme="dark"] .scroll-thumb2:hover,
:root[data-theme="dark"] .scroll-thumb2:hover {
  background: rgba(200, 200, 200, 0.55);
}

.scroll-thumb2:active {
  cursor: grabbing;
  background: rgba(60, 60, 60, 0.7);
}

[data-theme="dark"] .scroll-thumb2:active,
:root[data-theme="dark"] .scroll-thumb2:active {
  background: rgba(200, 200, 200, 0.65);
}

/* 减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  .scroll-track2,
  .scroll-thumb2 {
    transition: none !important;
  }
}
</style>