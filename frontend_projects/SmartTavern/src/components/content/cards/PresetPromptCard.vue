<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  item: { type: Object, required: true }
})

const emit = defineEmits(['update', 'delete'])

// UI state
const editing = ref(false)

// helpers
const toTri = (v) => (v === true ? 'true' : v === false ? 'false' : 'null')
const fromTri = (s) => (s === 'true' ? true : s === 'false' ? false : null)

const isInChat = computed(() => props.item.position === 'in-chat')
const hasContent = computed(() => 'content' in props.item)

const enabledLabel = (v) => (v === true ? t('cards.common.enabled') : v === false ? t('cards.common.disabled') : t('cards.common.notSet'))

// draft fields
const draftName = ref(props.item.name)
const draftEnabled = ref(toTri(props.item.enabled))
const draftRole = ref(props.item.role)
const draftDepth = ref(isInChat.value ? props.item.depth : 0)
const draftOrder = ref(isInChat.value ? props.item.order : 0)
const draftContent = ref(hasContent.value ? (props.item.content ?? '') : '')

function resetDraft() {
  draftName.value = props.item.name
  draftEnabled.value = toTri(props.item.enabled)
  draftRole.value = props.item.role
  if (isInChat.value) {
    draftDepth.value = props.item.depth
    draftOrder.value = props.item.order
  } else {
    draftDepth.value = 0
    draftOrder.value = 0
  }
  draftContent.value = hasContent.value ? (props.item.content ?? '') : ''
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
  emit('delete', props.item.identifier)
}

function onSave() {
  // Build new item based on position
  const updated = {
    identifier: props.item.identifier,
    name: draftName.value,
    enabled: fromTri(draftEnabled.value),
    role: draftRole.value,
    position: props.item.position,
  }

  if (isInChat.value) {
    updated.depth = draftDepth.value
    updated.order = draftOrder.value
    updated.content = draftContent.value
  } else {
    // Relative: 除一次性组件外，必须包含 content 字段
    const isSpecial = !hasContent.value
    if (!isSpecial) {
      updated.content = draftContent.value
    }
  }

  emit('update', updated)
  editing.value = false
}
</script>

<template>
  <div class="border border-gray-200 rounded-4 p-3 bg-white transition-all duration-200 ease-soft hover:shadow-elevate">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="text-sm flex items-center gap-2">
        <span class="font-medium text-black">{{ props.item.name }}</span>
        <span v-if="isInChat" class="px-2 py-0.5 text-xs rounded-4 border border-gray-800 text-black">depth: {{ props.item.depth }}</span>
        <span v-if="isInChat" class="px-2 py-0.5 text-xs rounded-4 border border-gray-800 text-black">order: {{ props.item.order }}</span>
      </div>

      <div class="flex items-center gap-2">
        <span class="px-2 py-0.5 text-xs rounded-4 border border-gray-800 text-black">{{ props.item.role }}</span>
        <span class="px-2 py-0.5 text-xs rounded-4 border border-gray-800 text-black">{{ enabledLabel(props.item.enabled) }}</span>
        <!-- 非编辑态：删除 + 编辑 -->
        <button
          v-if="!editing"
          class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft text-xs"
          @click="onDelete"
        >
          {{ t('cards.common.delete') }}
        </button>
        <button
          v-if="!editing"
          class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft text-xs"
          @click="onEdit"
        >
          {{ t('cards.common.edit') }}
        </button>

        <!-- 编辑态：保存 + 取消 -->
        <div v-else class="flex items-center gap-2">
          <button
            class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft text-xs"
            @click="onSave"
          >
            {{ t('cards.common.save') }}
          </button>
          <button
            class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft text-xs"
            @click="onCancel"
          >
            {{ t('cards.common.cancel') }}
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
      <div v-if="hasContent" class="text-xs text-black/70 mt-2 leading-6 break-words">
        {{ props.item.content }}
      </div>
    </div>

    <!-- Edit mode form -->
    <div v-else class="mt-3 space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-black/60 mb-1">{{ t('cards.presetPrompt.name') }}</label>
          <input
            type="text"
            v-model="draftName"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>

        <div>
          <label class="block text-xs text-black/60 mb-1">{{ t('cards.presetPrompt.enabledStatus') }}</label>
          <select
            v-model="draftEnabled"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          >
            <option value="true">{{ t('cards.common.enabled') }}</option>
            <option value="false">{{ t('cards.common.disabled') }}</option>
            <option value="null">{{ t('cards.common.notSet') }}</option>
          </select>
        </div>

        <div>
          <label class="block text-xs text-black/60 mb-1">{{ t('cards.presetPrompt.role') }}</label>
          <select
            v-model="draftRole"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          >
            <option value="system">system</option>
            <option value="user">user</option>
            <option value="assistant">assistant</option>
          </select>
        </div>

        <div v-if="isInChat">
          <label class="block text-xs text-black/60 mb-1">{{ t('cards.presetPrompt.depth') }}</label>
          <input
            type="number"
            v-model.number="draftDepth"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>

        <div v-if="isInChat">
          <label class="block text-xs text-black/60 mb-1">{{ t('cards.presetPrompt.order') }}</label>
          <input
            type="number"
            v-model.number="draftOrder"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>
      </div>

      <div v-if="hasContent">
        <label class="block text-xs text-black/60 mb-1">{{ t('cards.presetPrompt.content') }}</label>
        <textarea
          v-model="draftContent"
          rows="4"
          class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
        />
      </div>
    </div>
  </div>
</template>

<style src="./shared-card-styles.css"></style>