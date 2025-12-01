<script setup lang="ts">
import { onMounted, nextTick } from 'vue'

/* 顶部右侧：新建/导入/导出/保存/重置 事件 */
const emit = defineEmits<{
  (e: 'new'): void
  (e: 'import-files'): void
  (e: 'export-file'): void
  (e: 'save'): void
  (e: 'reset'): void
}>()

// 组件挂载后渲染 Lucide 图标（避免图标未初始化）
onMounted(() => {
  nextTick(() => (window as any).lucide?.createIcons?.())
})
</script>

<template>
  <!-- 顶部标题栏（固定） -->
  <header class="fixed top-0 left-0 right-0 h-16 bg-gradient-to-b from-white to-gray-50 border-b border-gray-200 z-40">
    <div class="px-4 h-full">
      <div class="flex items-center justify-between h-full">
        <!-- 标题区 -->
        <div class="flex items-center space-x-3">
          <i data-lucide="edit-3" class="w-8 h-8 text-black"></i>
          <div>
            <h1 class="tracking-tight">提示词编辑器</h1>
            <p class="text-black/60 text-sm mt-1">PromptEditor · Vue + Vite + TS</p>
          </div>
        </div>

        <!-- 顶部右侧操作（透明背景，浅灰交互） -->
        <div class="hidden md:flex items-center space-x-2">
          <button
            class="px-4 py-2 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 hover:text-black transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-elevate focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            @click="emit('new')"
          >
            新建
          </button>
          <button
            class="px-4 py-2 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 hover:text-black transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-elevate focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            @click="emit('import-files')"
          >
            导入
          </button>
          <button
            class="px-4 py-2 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 hover:text-black transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-elevate focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            @click="emit('export-file')"
          >
            导出
          </button>
          <button
            class="px-4 py-2 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 hover:text-black transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-elevate focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            @click="emit('save')"
          >
            保存
          </button>
          <button
            class="px-4 py-2 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 hover:text-black transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-elevate focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            @click="emit('reset')"
          >
            重置
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- 三栏网格（填充顶部栏以下区域） -->
  <div class="fixed top-16 left-0 right-0 bottom-0">
    <div class="grid grid-cols-[240px_minmax(0,1fr)_384px] h-full w-full">
      <!-- 左侧插槽 -->
      <aside class="block w-60 flex-shrink-0 h-full overflow-y-auto bg-white border-r border-gray-200 scrollbar-stable">
        <slot name="left" />
      </aside>

      <!-- 中间插槽 -->
      <main class="flex-1 min-w-0 h-full overflow-y-auto px-6 py-4 scrollbar-stable">
        <slot name="main" />
      </main>

      <!-- 右侧插槽 -->
      <aside class="block w-96 flex-shrink-0 h-full overflow-y-auto bg-white border-l border-gray-200 scrollbar-stable">
        <slot name="right" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* 仅保持局部范围内最小覆盖，样式统一交给 Tailwind 类 */
/* 为滚动容器预留滚动条槽位，避免出现/消失引发布局左右偏移 */
.scrollbar-stable {
  scrollbar-gutter: stable both-edges;
}
</style>