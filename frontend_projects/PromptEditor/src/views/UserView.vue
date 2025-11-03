<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { usePersonaStore } from '@/features/persona/store'
import { useFileManagerStore } from '@/features/files/fileManager'

const store = usePersonaStore()
const fm = useFileManagerStore()

const fileTitle = ref<string>('Persona.json')
const renameError = ref<string | null>(null)
watch(
  () => store.fileName,
  (v) => { fileTitle.value = v || 'Persona.json' },
  { immediate: true }
)
function renamePersonaFile() {
  renameError.value = null
  const oldName = store.fileName || 'Persona.json'
  const nn = (fileTitle.value || '').trim()
  if (!nn) { renameError.value = '文件名不能为空'; return }
  if (nn === oldName) return
  ;(store as any).renameFile?.(nn)
  try { fm.renameFile('user', oldName, nn) } catch {}
}

// 本地草稿
const nameDraft = ref<string>('')
const descDraft = ref<string>('')

// 加载本地状态
onMounted(() => {
  store.load()
  nameDraft.value = store.name
  descDraft.value = store.description
  ;(window as any).lucide?.createIcons?.()
})

watch(
  () => store.name,
  (v) => { nameDraft.value = v ?? '' }
)
watch(
  () => store.description,
  (v) => { descDraft.value = v ?? '' }
)

// 保存（失焦即时保存）
function saveName() {
  store.updateName(nameDraft.value)
}
function saveDesc() {
  store.updateDescription(descDraft.value)
}

// 重置为当前存储内容
function resetAll() {
  nameDraft.value = store.name
  descDraft.value = store.description
  nextTick(() => (window as any).lucide?.createIcons?.())
}
</script>

<template>
  <section class="space-y-6">
    <!-- 概览 -->
    <div class="bg-white rounded-4 card-shadow border border-gray-200 p-6 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between mb-2 gap-3">
        <div class="flex items-center gap-2">
          <i data-lucide="id-card" class="w-5 h-5 text-black"></i>
          <h2>用户信息</h2>
        </div>
        <div class="flex items-center gap-2">
          <input
            v-model="fileTitle"
            placeholder="文件名.json"
            class="w-56 px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
            @keyup.enter="renamePersonaFile"
            @blur="renamePersonaFile"
          />
          <button
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-sm hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
            @click="renamePersonaFile"
          >重命名</button>
        </div>
      </div>
      <p class="text-xs text-black/60">结构参考：backend_projects/SmartTavern/data/persona/用户2.json</p>
      <p v-if="renameError" class="text-xs text-red-600 mt-1">* {{ renameError }}</p>
    </div>

    <!-- 基本信息（仅 name / description） -->
    <div class="bg-white rounded-4 border border-gray-200 p-6 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <i data-lucide="user" class="w-4 h-4 text-black"></i>
          <span class="text-sm font-medium text-black">基本信息</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 hover:shadow-elevate hover:-translate-y-0.5 transition-all duration-200 ease-soft text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            @click="resetAll"
          >
            重置
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-black mb-2">名称</label>
          <input
            v-model="nameDraft"
            @blur="saveName"
            type="text"
            placeholder="输入名称"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>

        <div class="md:col-span-2">
          <label class="block text-sm font-medium text-black mb-2">描述</label>
          <textarea
            v-model="descDraft"
            @blur="saveDesc"
            rows="4"
            placeholder="输入描述..."
            class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800"
          ></textarea>
        </div>
      </div>
    </div>

    <!-- 说明 -->
    <div class="bg-white rounded-4 border border-gray-200 p-5 transition-all duration-200 ease-soft hover:shadow-elevate">
      <div class="text-xs text-black/60">
        说明：本面板仅维护单个用户信息 JSON（name / description）。导入与导出通过右上角按钮进行，数据仅在本地保存。
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 轻量样式，视觉保持与其他面板一致 */
</style>