<script setup lang="ts">
import { computed } from 'vue'

type TabKey = 'presets' | 'files' | 'worldbook' | 'characters' | 'regex' | 'user' | 'history'

// v-model 支持
const props = defineProps<{
  modelValue: TabKey
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: TabKey): void
}>()

const current = computed({
  get: () => props.modelValue,
  set: (v: TabKey) => emit('update:modelValue', v)
})

// 导航项定义（将“文件 Files”置于“预设 Presets”之前）
const items: { key: TabKey; icon: string; label: string; sub: string }[] = [
  { key: 'files',      icon: 'folder',    label: '文件',     sub: 'Files' },
  { key: 'presets',    icon: 'list',      label: '预设',     sub: 'Presets' },
  { key: 'worldbook',  icon: 'book-open', label: '世界书',   sub: 'World Book' },
  { key: 'characters', icon: 'user',      label: '角色卡',   sub: 'Characters' },
  { key: 'regex',      icon: 'code',      label: '正则',     sub: 'Regex' },
  { key: 'user',       icon: 'id-card',   label: '用户信息', sub: 'User' },
  { key: 'history',    icon: 'history',   label: '对话历史', sub: 'History' },
]
</script>

<template>
  <nav class="p-2">
    <ul class="space-y-1">
      <li v-for="it in items" :key="it.key">
        <button
          class="relative group w-full flex items-center justify-between px-3 py-2 rounded-4 bg-transparent text-black hover:bg-gray-100 transition-all duration-200 ease-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          :class="current === it.key ? 'bg-gray-100 border-l-2 border-black' : ''"
          @click="current = it.key"
        >
          <div class="flex items-center space-x-2">
            <i :data-lucide="it.icon" class="w-4 h-4 text-black transition-transform duration-200 ease-soft group-hover:translate-x-0.5"></i>
            <span class="text-sm">{{ it.label }}</span>
          </div>
          <span class="text-xs text-black/50">{{ it.sub }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>