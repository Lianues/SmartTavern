<template>
  <section class="p-4 space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <i data-lucide="folder-open" class="w-5 h-5 text-black"></i>
        <h2 class="text-xl font-semibold text-black">文件库</h2>
        <span class="text-xs text-black/60">File Manager</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="px-3 py-2 border border-black text-black rounded hover:bg-gray-100 active:bg-gray-200 transition"
          @click="clearCurrentType()"
        >
          清空当前类型
        </button>
        <button
          class="px-3 py-2 border border-black text-black rounded hover:bg-gray-100 active:bg-gray-200 transition"
          @click="store.clearAll()"
        >
          清空全部
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div
      class="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-4 p-2"
    >
      <button
        v-for="t in tabs"
        :key="t.key"
        class="px-3 py-1.5 rounded-4 border transition text-sm"
        :class="tab === t.key ? 'bg-black text-white border-black' : 'bg-transparent text-black border-gray-300 hover:bg-gray-100'"
        @click="tab = t.key"
      >
        <div class="flex items-center gap-2">
          <span>{{ t.cn }}</span>
          <span class="text-[10px] text-black/60 uppercase">{{ t.en }}</span>
          <span class="text-[10px] text-black/60">({{ store.list(t.key).length }})</span>
        </div>
      </button>
    </div>

    <!-- List -->
    <div v-if="files.length > 0" class="space-y-3">
      <div
        v-for="f in files"
        :key="f.name"
        class="bg-white border border-gray-200 rounded-4 p-4 transition hover:shadow-elevate"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <i data-lucide="file" class="w-4 h-4 text-black"></i>
            <span class="font-medium text-black">{{ f.name }}</span>
            <span v-if="activeName === f.name" class="text-[10px] border border-black text-black px-2 py-0.5 rounded-4">当前</span>
            <span class="text-[10px] text-black/60">更新: {{ formatTime(f.updatedAt) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <label class="inline-flex items-center gap-2 select-none">
              <input
                type="checkbox"
                class="w-5 h-5 accent-black"
                :checked="!!f.enabled"
                @change="onToggleEnable(f.name)"
              />
              <span class="text-sm text-black">启用</span>
            </label>
            <button
              class="px-3 py-1.5 border border-black text-black rounded hover:bg-gray-100 active:bg-gray-200"
              @click="onSetActive(f.name)"
            >
              设为当前
            </button>
            <button
              class="px-3 py-1.5 border border-black text-black rounded hover:bg-gray-100 active:bg-gray-200"
              @click="onDelete(f.name)"
            >
              删除
            </button>
          </div>
        </div>
        <div class="mt-2 text-xs text-black/70">
          {{ summaryFor(tab, f.data) }}
        </div>
      </div>
    </div>

    <div v-else class="border border-dashed border-gray-300 rounded p-6 text-center text-sm text-black/60 bg-gray-50">
      当前类型下暂无文件。请在相应页面使用右上角“导入”按钮，导入后会自动出现在此处。
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watchEffect } from 'vue'
import { useFileManagerStore } from '@/features/files/fileManager'
import type { TypeKey } from '@/features/files/fileManager'

const store = useFileManagerStore()
const tab = ref<TypeKey>(store.getCurrentType || 'presets')

type TabDef = { key: TypeKey; cn: string; en: string }
const tabs: TabDef[] = [
  { key: 'presets',   cn: '预设',     en: 'Presets' },
  { key: 'worldbook', cn: '世界书',   en: 'World Book' },
  { key: 'characters',cn: '角色卡',   en: 'Characters' },
  { key: 'regex',     cn: '正则',     en: 'Regex' },
  { key: 'user',      cn: '用户信息', en: 'User' },
  { key: 'history',   cn: '对话历史', en: 'History' },
]

onMounted(() => {
  store.load()
  // 同步当前类型到 Store（用于全局导入时在“文件”页签下做归类）
  store.setCurrentType(tab.value)
  ;(window as any).lucide?.createIcons?.()
})
watchEffect(() => {
  store.setCurrentType(tab.value)
  ;(window as any).lucide?.createIcons?.()
})

const files = computed(() => store.list(tab.value))
const activeName = computed(() => store.activeName(tab.value))

function onSetActive(name: string) {
  store.setActive(tab.value, name)
}
function onToggleEnable(name: string) {
  store.toggleEnable(tab.value, name as string)
}
function onDelete(name: string) {
  store.removeFile(tab.value, name)
}
function clearCurrentType() {
  store.clearType(tab.value)
}

function formatTime(ts?: number): string {
  if (!ts) return '--'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function summaryFor(type: TypeKey, data: any): string {
  try {
    switch (type) {
      case 'presets': {
        const prompts = Array.isArray(data?.prompts) ? data.prompts.length : 0
        const rules = Array.isArray(data?.regex_rules) ? data.regex_rules.length : 0
        const worlds = Array.isArray(data?.world_books) ? data.world_books.length : 0
        return `类型: 预设 · prompts: ${prompts} · regex: ${rules} · world: ${worlds}`
      }
      case 'worldbook': {
        let n = 0
        if (Array.isArray(data?.entries)) n = data.entries.length
        else if (Array.isArray(data?.world_book?.entries)) n = data.world_book.entries.length
        else if (Array.isArray(data)) n = data.length
        return `类型: 世界书 · entries: ${n}`
      }
      case 'characters': {
        const messages = Array.isArray(data?.message) ? data.message.length : 0
        const wb = Array.isArray(data?.world_book?.entries) ? data.world_book.entries.length : 0
        const rules = Array.isArray(data?.regex_rules) ? data.regex_rules.length : 0
        return `类型: 角色卡 · messages: ${messages} · world: ${wb} · regex: ${rules}`
      }
      case 'regex': {
        const rules = Array.isArray(data) ? data.length : (Array.isArray(data?.regex_rules) ? data.regex_rules.length : 0)
        return `类型: 正则 · rules: ${rules}`
      }
      case 'user': {
        const name = typeof data?.name === 'string' ? data.name : ''
        const desc = typeof data?.description === 'string' ? data.description : ''
        return `类型: 用户信息 · name: ${name || '未命名'} · 描述: ${desc ? (desc.length > 24 ? desc.slice(0,24)+'…' : desc) : '—'}`
      }
      case 'history': {
        const arr = Array.isArray(data) ? data.length : (data && typeof data === 'object' ? Object.keys(data).length : 0)
        return `类型: 历史 · 项目数: ${arr}`
      }
    }
  } catch {}
  return '类型: 未知'
}
</script>

<style scoped>
/* 黑白主题与 4/8/16 间距系统 */
</style>