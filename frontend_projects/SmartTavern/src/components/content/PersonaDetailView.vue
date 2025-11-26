<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'

const props = defineProps({
  personaData: { type: Object, default: null }
})


/** 深拷贝 */
function deepClone(x) { return JSON.parse(JSON.stringify(x)) }
/** 规范化 Persona 结构 */
function normalizePersonaData(src) {
  if (!src || typeof src !== 'object') return null
  return {
    name: src.name || '用户',
    description: src.description || ''
  }
}
// 当前编辑的数据（内存中）
const currentData = ref(
  deepClone(
    normalizePersonaData(props.personaData) || { name: '', description: '' }
  )
)
// 外部数据变更时同步
watch(() => props.personaData, async (v) => {
  currentData.value = deepClone(normalizePersonaData(v) || { name: '', description: '' })
  await nextTick()
  window.lucide?.createIcons?.()
})

// 本地草稿
const nameDraft = ref(currentData.value.name || '')
const descDraft = ref(currentData.value.description || '')

// 保存（失焦即时保存）
function saveName() {
  currentData.value.name = nameDraft.value
}

function saveDesc() {
  currentData.value.description = descDraft.value
}

// 重置为当前存储内容
function resetAll() {
  nameDraft.value = currentData.value.name || ''
  descDraft.value = currentData.value.description || ''
  nextTick(() => window.lucide?.createIcons?.())
}

// 初始化 Lucide 图标
onMounted(() => {
  window.lucide?.createIcons?.()
})
</script>

<template>
  <section class="space-y-6">
    <!-- 页面标题 -->
    <div class="bg-white rounded-4 card-shadow border border-gray-200 p-6 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <i data-lucide="id-card" class="w-5 h-5 text-black"></i>
          <h2 class="text-lg font-bold text-black">用户信息编辑</h2>
        </div>
        <div class="px-3 py-1 rounded-4 bg-gray-100 border border-gray-300 text-black text-sm">
          编辑模式
        </div>
      </div>
      <p class="mt-2 text-xs text-black/60">此页面用于编辑用户的基本信息，包括名称和描述</p>
    </div>

    <!-- 基本信息 -->
    <div class="bg-white rounded-4 border border-gray-200 p-6 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <i data-lucide="user" class="w-4 h-4 text-black"></i>
          <span class="text-sm font-medium text-black">基本信息</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft text-sm"
            @click="resetAll"
          >
            重置
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-black mb-2">用户名称</label>
          <input
            v-model="nameDraft"
            @blur="saveName"
            type="text"
            placeholder="输入用户名称"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
          <p class="text-xs text-black/50 mt-1">当前：{{ currentData.name || '(未设置)' }}</p>
        </div>

        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">用户描述</label>
          <textarea
            v-model="descDraft"
            @blur="saveDesc"
            rows="6"
            placeholder="输入用户描述，可以包含用户的偏好、背景、对话风格等..."
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          ></textarea>
          <p class="text-xs text-black/50 mt-1">字符数：{{ (descDraft || '').length }}</p>
        </div>
      </div>
    </div>

    <!-- 说明 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="info" class="w-4 h-4 text-black"></i>
        <h3 class="text-sm font-semibold text-black">说明</h3>
      </div>
      <div class="text-xs text-black/60 leading-relaxed space-y-2">
        <p>• 用户信息（Persona）用于定义用户的身份、偏好和对话风格</p>
        <p>• 输入框失焦时会自动保存</p>
        <p>• 点击"重置"按钮可以恢复到当前保存的内容</p>
      </div>
    </div>

    <!-- 数据预览 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="eye" class="w-4 h-4 text-black"></i>
        <h3 class="text-sm font-semibold text-black">当前保存的数据</h3>
      </div>
      <div class="bg-gray-50 rounded-4 p-4 border border-gray-200">
        <pre class="text-xs text-black/70 font-mono whitespace-pre-wrap">{{ JSON.stringify(currentData, null, 2) }}</pre>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rounded-4 {
  border-radius: 10px;
}

.card-shadow {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.hover\:shadow-elevate:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.ease-soft {
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* 深色主题适配 - 使用中性灰色 */
[data-theme="dark"] .bg-white {
  background-color: rgb(28, 28, 30) !important;
}

[data-theme="dark"] .bg-gray-50 {
  background-color: rgb(32, 32, 35) !important;
}

[data-theme="dark"] .bg-gray-100 {
  background-color: rgb(38, 38, 42) !important;
}

[data-theme="dark"] .text-black {
  color: rgb(235, 235, 240) !important;
}

[data-theme="dark"] .text-black\/50 {
  color: rgba(235, 235, 240, 0.5) !important;
}

[data-theme="dark"] .text-black\/60 {
  color: rgba(235, 235, 240, 0.6) !important;
}

[data-theme="dark"] .text-black\/70 {
  color: rgba(235, 235, 240, 0.7) !important;
}

[data-theme="dark"] .border-gray-200 {
  border-color: rgb(50, 50, 55) !important;
}

[data-theme="dark"] .border-gray-300 {
  border-color: rgb(60, 60, 65) !important;
}

[data-theme="dark"] .border-gray-800 {
  border-color: rgb(200, 200, 205) !important;
}

[data-theme="dark"] .border-gray-900 {
  border-color: rgb(200, 200, 205) !important;
}

[data-theme="dark"] .hover\:bg-gray-100:hover {
  background-color: rgb(38, 38, 42) !important;
}

/* 暗色主题 - 输入框适配 */
[data-theme="dark"] input,
[data-theme="dark"] textarea,
[data-theme="dark"] select {
  background-color: rgb(38, 38, 42) !important;
  color: rgb(235, 235, 240) !important;
  border-color: rgb(60, 60, 65) !important;
}

[data-theme="dark"] input::placeholder,
[data-theme="dark"] textarea::placeholder {
  color: rgba(235, 235, 240, 0.5) !important;
}

[data-theme="dark"] input:focus,
[data-theme="dark"] textarea:focus,
[data-theme="dark"] select:focus {
  border-color: rgb(100, 100, 110) !important;
  box-shadow: 0 0 0 2px rgba(140, 140, 160, 0.2) !important;
}

[data-theme="dark"] select option {
  background-color: rgb(38, 38, 42) !important;
  color: rgb(235, 235, 240) !important;
}

</style>