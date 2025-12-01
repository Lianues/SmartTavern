<script setup>
import { onMounted, ref } from 'vue'
import ThreadedChatPreview from '@/components/chat/ThreadedChatPreview.vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  conversationFile: { type: String, default: null },
  conversationDoc: { type: Object, default: null },
})

const emit = defineEmits(['update:loading', 'update:loadingMessage', 'ready'])

// 跟踪iframe加载状态
const iframesLoaded = ref(false)

function onAllIframesLoaded() {
  iframesLoaded.value = true
  // 所有iframe加载完成后，通知父组件视图已准备好
  emit('ready')
  // 然后关闭加载动画
  emit('update:loading', false)
  emit('update:loadingMessage', '')
}

// ThreadedView数据已在App.vue中准备好，但需要等待iframe加载
onMounted(() => {
  // 不再立即关闭加载动画，等待iframe加载完成
})
</script>

<template>
  <section data-scope="chat-threaded" class="st-threaded">
    <ThreadedChatPreview
      :messages="messages"
      :conversationFile="conversationFile"
      :conversationDoc="conversationDoc"
      @all-iframes-loaded="onAllIframesLoaded"
    />
  </section>
</template>

<style scoped>
/* Threaded chat container */
.st-threaded {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-xl);
  max-width: var(--st-chat-width, 860px);
  margin: 0 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  position: relative;
}
.st-threaded::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: var(--st-bg-threaded);
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
  opacity: 1; /* 背景图始终全可见，遮罩由 ::after 控制 */
  /* 直接对背景图片层应用模糊，避免 backdrop-filter 在某些栈顺序下不生效 */
  filter: blur(var(--st-threaded-bg-blur, 0px));
  will-change: filter;
  z-index: -1;
  pointer-events: none;
}
.st-threaded::after {
  content: '';
  position: fixed;
  inset: 0;
  /* 遮罩色固定为纯墨色/纯白色，由不透明度变量控制强度 */
  background: rgb(var(--st-overlay-ink));
  /* 终点与用户配置一致，动画也会过渡到该变量值，避免闪烁 */
  opacity: var(--st-threaded-bg-opacity, 0.12);
  z-index: -1;
  pointer-events: none;
  /* 为 overlay 动画提供目标变量（线程页）：始终与不透明度变量一致 */
  --st-target-bg-opacity: var(--st-threaded-bg-opacity, 0.12);
}
</style>