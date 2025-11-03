<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useCharacterStore } from '@/features/characters/store'
import type { WorldBookEntry, WorldBookMode, WorldBookPosition } from '@/features/presets/types'

const props = defineProps<{
  entry: WorldBookEntry
}>()

const store = useCharacterStore()
const editing = ref(false)
const errorMsg = ref<string | null>(null)
const originalId = ref(props.entry.id)

const form = ref({
  id: props.entry.id,
  name: props.entry.name,
  enabled: props.entry.enabled,
  content: props.entry.content ?? '',
  mode: (props.entry.mode ?? 'always') as WorldBookMode,
  position: (props.entry.position ?? 'system') as WorldBookPosition,
  order: props.entry.order ?? 100,
  depth: props.entry.depth ?? 0,
  condition: String((props.entry as any).condition ?? '')
})

watch(
  () => props.entry,
  (e) => {
    if (!e) return
    form.value = {
      id: e.id,
      name: e.name,
      enabled: e.enabled,
      content: e.content ?? '',
      mode: (e.mode ?? 'always') as WorldBookMode,
      position: (e.position ?? 'system') as WorldBookPosition,
      order: e.order ?? 100,
      depth: e.depth ?? 0,
      condition: String((e as any).condition ?? '')
    }
    originalId.value = e.id
  },
  { deep: true }
)

function toggleEdit() {
  editing.value = !editing.value
  nextTick(() => (window as any).lucide?.createIcons?.())
}

async function onSave() {
  errorMsg.value = null
  const newId = String(form.value.id ?? '').trim()
  if (!newId) {
    errorMsg.value = '请填写 ID'
    return
  }
  const list = (store.worldEntries || []) as WorldBookEntry[]
  if (list.some(w => w.id === newId && w.id !== originalId.value)) {
    errorMsg.value = 'ID 已存在'
    return
  }

  const updated: WorldBookEntry = {
    id: newId,
    name: String(form.value.name || '').trim() || newId,
    enabled: !!form.value.enabled,
    content: String(form.value.content ?? ''),
    mode: form.value.mode,
    position: form.value.position,
    order: Number(form.value.order ?? 100),
    depth: Number(form.value.depth ?? 0),
    condition: form.value.mode === 'conditional' ? String(form.value.condition || '') : ''
  }

  // 若 id 被修改，则在原位置上完成“重命名”式替换；否则普通替换
  store.upsertWorldBookWithOldId(updated, originalId.value)
  originalId.value = newId

  editing.value = false
  await nextTick()
  ;(window as any).lucide?.createIcons?.()
}

function onDelete() {
  store.removeWorldBook(props.entry.id)
}
</script>

<template>
  <div
    class="bg-white rounded-4 border border-gray-200 p-4 transition-all duration-200 ease-soft hover:shadow-elevate">
    <div class="flex items-start justify-between">
      <div class="min-w-0">
        <div class="flex items-center flex-wrap gap-2">
          <h3 class="text-lg font-bold text-black truncate">{{ props.entry.name }}</h3>
          <span class="text-xs px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent">
            id: {{ props.entry.id }}
          </span>
          <span class="text-xs px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent">
            {{ props.entry.mode || 'always' }}
          </span>
          <span class="text-xs px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent">
            {{ props.entry.position || 'system' }}
          </span>
          <span class="text-xs text-black/60">{{ props.entry.enabled ? '已启用' : '未启用' }}</span>
          <span v-if="props.entry.order !== undefined" class="text-xs text-black/50">#{{ props.entry.order }}</span>
          <span v-if="props.entry.depth !== undefined" class="text-xs text-black/50">depth: {{ props.entry.depth }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          @click="onDelete">删除</button>
        <button
          v-if="!editing"
          class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          @click="toggleEdit">编辑</button>
        <template v-else>
          <button
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            @click="onSave">保存</button>
          <button
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            @click="toggleEdit">取消</button>
        </template>
      </div>
    </div>

    <div v-if="!editing" class="mt-3 space-y-2">
      <div class="text-sm text-black/70 leading-6">{{ props.entry.content || '（暂无内容）' }}</div>
      <div v-if="props.entry.mode === 'conditional' && (props.entry as any).condition" class="text-xs text-black/60">
        condition：<span class="font-mono">{{ (props.entry as any).condition }}</span>
      </div>
    </div>

    <div v-else class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-black mb-2">ID</label>
        <input v-model="form.id" placeholder="例如：1 或 my-id" class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800" />
      </div>
      <div>
        <label class="block text-sm font-medium text-black mb-2">名称</label>
        <input v-model="form.name" class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800" />
      </div>
      <div class="flex items-center gap-3">
        <label class="inline-flex items-center space-x-2 select-none">
          <input type="checkbox" v-model="form.enabled" class="w-5 h-5 border border-gray-400 rounded-4 accent-black focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2" />
          <span class="text-sm text-black/80">已启用</span>
        </label>
      </div>

      <div>
        <label class="block text-sm font-medium text-black mb-2">模式</label>
        <select v-model="form.mode" class="w-full px-3 py-2 border border-gray-300 rounded-4 bg-white focus:outline-none focus:ring-2 focus:ring-gray-800">
          <option value="always">always</option>
          <option value="conditional">conditional</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-black mb-2">位置（position）</label>
        <select v-model="form.position" class="w-full px-3 py-2 border border-gray-300 rounded-4 bg-white focus:outline-none focus:ring-2 focus:ring-gray-800">
          <optgroup label="framing（角色前后）">
            <option value="before_char">before_char</option>
            <option value="after_char">after_char</option>
          </optgroup>
          <optgroup label="in-chat（插入对话）">
            <option value="user">user</option>
            <option value="assistant">assistant</option>
            <option value="system">system</option>
          </optgroup>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-black mb-2">order（排序权重）</label>
        <input type="number" v-model.number="form.order" class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800" />
      </div>
      <div>
        <label class="block text-sm font-medium text-black mb-2">depth（注入深度）</label>
        <input type="number" v-model.number="form.depth" class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800" />
      </div>

      <div v-if="form.mode === 'conditional'" class="md:col-span-2">
        <label class="block text-sm font-medium text-black mb-2">condition（条件表达式）</label>
        <input v-model="form.condition" placeholder="示例：<<keywords:艾拉;工程师>> 或 true/false" class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800" />
      </div>

      <div class="md:col-span-2">
        <label class="block text-sm font-medium text-black mb-2">内容</label>
        <textarea rows="4" v-model="form.content" class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800"></textarea>
      </div>
      <p v-if="errorMsg" class="md:col-span-2 text-xs text-red-600">* {{ errorMsg }}</p>
    </div>
  </div>
</template>

<style scoped>
/* 采用 Tailwind 实现视觉体系；此处不做全局覆盖 */
</style>