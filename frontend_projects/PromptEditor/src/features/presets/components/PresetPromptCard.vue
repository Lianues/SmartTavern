<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePresetStore } from '../store'
import type {
  PromptItem,
  PromptItemInChat,
  PromptItemRelative,
  Role,
} from '../types'
import { SPECIAL_RELATIVE_TEMPLATES } from '../types'

const props = defineProps<{
  item: PromptItem
}>()

const store = usePresetStore()

// UI state
const editing = ref(false)

// helpers
type Tri = 'true' | 'false' | 'null'
const toTri = (v: boolean | null): Tri => (v === true ? 'true' : v === false ? 'false' : 'null')
const fromTri = (s: Tri): boolean | null => (s === 'true' ? true : s === 'false' ? false : null)

const isInChat = computed((): boolean => props.item.position === 'in-chat')
const hasContent = computed((): boolean => 'content' in props.item)
const isSpecialRel = computed(
  (): boolean =>
    props.item.position === 'relative' &&
    SPECIAL_RELATIVE_TEMPLATES.some(t => t.identifier === props.item.identifier)
)

const enabledLabel = (v: boolean | null) => (v === true ? '已启用' : v === false ? '未启用' : '未设置')

// draft fields
const draftName = ref(props.item.name)
const draftEnabled = ref<Tri>(toTri(props.item.enabled))
const draftRole = ref<Role>(props.item.role)
const draftDepth = ref<number>(isInChat.value ? (props.item as PromptItemInChat).depth : 0)
const draftOrder = ref<number>(isInChat.value ? (props.item as PromptItemInChat).order : 0)
const draftContent = ref<string>(hasContent.value ? ((props.item as any).content ?? '') : '')

function resetDraft() {
  draftName.value = props.item.name
  draftEnabled.value = toTri(props.item.enabled)
  draftRole.value = props.item.role
  if (isInChat.value) {
    draftDepth.value = (props.item as PromptItemInChat).depth
    draftOrder.value = (props.item as PromptItemInChat).order
  } else {
    draftDepth.value = 0
    draftOrder.value = 0
  }
  draftContent.value = hasContent.value ? ((props.item as any).content ?? '') : ''
}

watch(
  () => props.item,
  () => {
    if (!editing.value) resetDraft()
  },
  { deep: false }
)

function onEdit() {
  resetDraft()
  editing.value = true
}

function onCancel() {
  resetDraft()
  editing.value = false
}

function onDelete() {
  // 从当前活动预设中删除该条目
  store.removePrompt(props.item.identifier)
}

function onSave() {
  // Build new item based on position
  if (isInChat.value) {
    const base: PromptItemInChat = {
      identifier: props.item.identifier,
      name: draftName.value,
      enabled: fromTri(draftEnabled.value),
      role: draftRole.value,
      position: 'in-chat',
      depth: draftDepth.value,
      order: draftOrder.value,
    }
    // In-Chat 必须始终包含 content 字段
    const out = { ...base, content: draftContent.value } as PromptItemInChat
    store.replacePrompt(out)
  } else {
    const base: PromptItemRelative = {
      identifier: props.item.identifier,
      name: draftName.value,
      enabled: fromTri(draftEnabled.value),
      role: draftRole.value,
      position: 'relative',
    }
    // Relative：除一次性组件外，必须包含 content 字段
    const out = isSpecialRel.value ? base : ({ ...base, content: draftContent.value } as PromptItemRelative)
    store.replacePrompt(out)
  }
  editing.value = false
}
</script>

<template>
  <div class="border border-gray-200 rounded-4 p-3 bg-white transition-all duration-200 ease-soft hover:shadow-elevate">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="text-sm flex items-center gap-2">
        <span class="font-medium">{{ props.item.name }}</span>
        <span v-if="isInChat" class="px-2 py-0.5 text-xs rounded-4 border border-gray-800 text-black">depth: {{ (props.item as any).depth }}</span>
        <span v-if="isInChat" class="px-2 py-0.5 text-xs rounded-4 border border-gray-800 text-black">order: {{ (props.item as any).order }}</span>
      </div>

      <div class="flex items-center gap-2">
        <span class="px-2 py-0.5 text-xs rounded-4 border border-gray-800 text-black">{{ props.item.role }}</span>
        <span class="px-2 py-0.5 text-xs rounded-4 border border-gray-800 text-black">{{ enabledLabel(props.item.enabled) }}</span>
        <!-- 非编辑态：删除 + 编辑（删除在左） -->
        <button
          v-if="!editing"
          class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          @click="onDelete"
        >
          删除
        </button>
        <button
          v-if="!editing"
          class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          @click="onEdit"
        >
          编辑
        </button>

        <!-- 编辑态：保存 + 取消 -->
        <div v-else class="flex items-center gap-2">
          <button
            class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft text-xs"
            @click="onSave"
          >
            保存
          </button>
          <button
            class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft text-xs"
            @click="onCancel"
          >
            取消
          </button>
        </div>
      </div>
    </div>

    <!-- Identifier -->
    <div class="text-xs text-black/60 mt-2">
      <span class="font-mono">id:</span>
      <span class="ml-1 font-mono">{{ props.item.identifier }}</span>
    </div>

    <!-- View mode content -->
    <div v-if="!editing">
      <!-- content: 仅当对象存在 content 字段时显示 -->
      <div v-if="hasContent" class="text-xs text-black/70 mt-2 leading-6 break-words">
        {{ (props.item as any).content }}
      </div>
    </div>

    <!-- Edit mode form -->
    <div v-else class="mt-3 space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-black/60 mb-1">名称</label>
          <input
            type="text"
            v-model="draftName"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>

        <div>
          <label class="block text-xs text-black/60 mb-1">启用状态</label>
          <select
            v-model="draftEnabled"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 bg-white focus:outline-none focus:ring-2 focus:ring-gray-800"
          >
            <option value="true">已启用</option>
            <option value="false">未启用</option>
            <option value="null">未设置</option>
          </select>
        </div>

        <div>
          <label class="block text-xs text-black/60 mb-1">角色（role）</label>
          <select
            v-model="draftRole"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 bg-white focus:outline-none focus:ring-2 focus:ring-gray-800"
          >
            <option value="system">system</option>
            <option value="user">user</option>
            <option value="assistant">assistant</option>
          </select>
        </div>

        <div v-if="isInChat">
          <label class="block text-xs text-black/60 mb-1">深度（depth）</label>
          <input
            type="number"
            v-model.number="draftDepth"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>

        <div v-if="isInChat">
          <label class="block text-xs text-black/60 mb-1">顺序（order）</label>
          <input
            type="number"
            v-model.number="draftOrder"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>
      </div>

      <div v-if="hasContent">
        <label class="block text-xs text-black/60 mb-1">内容（content）</label>
        <textarea
          v-model="draftContent"
          rows="4"
          class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 遵循黑白主题，4px 圆角，轻微过渡与阴影 */
</style>