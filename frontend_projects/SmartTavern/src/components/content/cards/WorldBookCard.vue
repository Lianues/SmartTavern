<script setup>
import { ref, watch, nextTick } from 'vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  entry: { type: Object, required: true }
})

const emit = defineEmits(['update', 'delete'])

const editing = ref(false)
const errorMsg = ref(null)
const originalId = ref(props.entry.id)

const form = ref({
  id: props.entry.id,
  name: props.entry.name,
  enabled: props.entry.enabled,
  content: props.entry.content ?? '',
  mode: props.entry.mode ?? 'always',
  position: props.entry.position ?? 'system',
  order: props.entry.order ?? 100,
  depth: props.entry.depth ?? 0,
  condition: props.entry.condition ?? ''
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
      mode: e.mode ?? 'always',
      position: e.position ?? 'system',
      order: e.order ?? 100,
      depth: e.depth ?? 0,
      condition: e.condition ?? ''
    }
    originalId.value = e.id
  },
  { deep: true }
)

function toggleEdit() {
  editing.value = !editing.value
  nextTick(() => window.lucide?.createIcons?.())
}

function onSave() {
  errorMsg.value = null
  const newId = String(form.value.id ?? '').trim()
  if (!newId) {
    errorMsg.value = t('cards.worldBook.errorIdRequired')
    return
  }

  const updated = {
    id: newId,
    name: String(form.value.name || '').trim() || newId,
    enabled: !!form.value.enabled,
    content: String(form.value.content ?? ''),
    mode: form.value.mode,
    position: form.value.position,
    order: Number(form.value.order ?? 100),
    depth: Number(form.value.depth ?? 0),
    condition: String(form.value.condition ?? ''),
    _oldId: originalId.value !== newId ? originalId.value : undefined
  }

  emit('update', updated)
  originalId.value = newId
  editing.value = false
}

function onDelete() {
  emit('delete', props.entry.id)
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
          <span class="text-xs text-black/60">{{ props.entry.enabled ? t('cards.common.enabled') : t('cards.common.disabled') }}</span>
          <span v-if="props.entry.order !== undefined" class="text-xs text-black/50">#{{ props.entry.order }}</span>
          <span v-if="props.entry.depth !== undefined" class="text-xs text-black/50">depth: {{ props.entry.depth }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 text-sm"
          @click="onDelete">{{ t('cards.common.delete') }}</button>
        <button
          v-if="!editing"
          class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 text-sm"
          @click="toggleEdit">{{ t('cards.common.edit') }}</button>
        <template v-else>
          <button
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 text-sm"
            @click="onSave">{{ t('cards.common.save') }}</button>
          <button
            class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 text-sm"
            @click="toggleEdit">{{ t('cards.common.cancel') }}</button>
        </template>
      </div>
    </div>

    <div v-if="!editing" class="mt-3 space-y-2">
      <div class="text-sm text-black/70 leading-6">{{ props.entry.content || t('cards.common.noContent') }}</div>
      <div v-if="props.entry.mode === 'conditional'" class="text-xs text-black/60">
        condition：<span class="font-mono break-all">{{ props.entry.condition || t('cards.worldBook.notSetCondition') }}</span>
      </div>
    </div>

    <div v-else class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-black mb-2">{{ t('cards.worldBook.id') }}</label>
        <input v-model="form.id" :placeholder="t('cards.worldBook.idPlaceholder')" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" />
      </div>
      <div>
        <label class="block text-sm font-medium text-black mb-2">{{ t('cards.worldBook.name') }}</label>
        <input v-model="form.name" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" />
      </div>
      <div class="flex items-center gap-3">
        <label class="inline-flex items-center space-x-2 select-none">
          <input type="checkbox" v-model="form.enabled" class="w-5 h-5 border border-gray-400 rounded-4 accent-black" />
          <span class="text-sm text-black/80">{{ t('cards.worldBook.enabledLabel') }}</span>
        </label>
      </div>

      <div>
        <label class="block text-sm font-medium text-black mb-2">{{ t('cards.worldBook.mode') }}</label>
        <select v-model="form.mode" class="w-full px-3 py-2 border border-gray-300 rounded-4 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-800">
          <option value="always">always</option>
          <option value="conditional">conditional</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-black mb-2">{{ t('cards.worldBook.position') }}</label>
        <select v-model="form.position" class="w-full px-3 py-2 border border-gray-300 rounded-4 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-800">
          <optgroup :label="t('cards.worldBook.positionFraming')">
            <option value="before_char">before_char</option>
            <option value="after_char">after_char</option>
          </optgroup>
          <optgroup :label="t('cards.worldBook.positionInChat')">
            <option value="user">user</option>
            <option value="assistant">assistant</option>
            <option value="system">system</option>
          </optgroup>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-black mb-2">{{ t('cards.worldBook.orderLabel') }}</label>
        <input type="number" v-model.number="form.order" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" />
      </div>
      <div>
        <label class="block text-sm font-medium text-black mb-2">{{ t('cards.worldBook.depthLabel') }}</label>
        <input type="number" v-model.number="form.depth" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800" />
      </div>

      <div v-if="form.mode === 'conditional'" class="md:col-span-2">
        <label class="block text-sm font-medium text-black mb-2">{{ t('cards.worldBook.conditionLabel') }}</label>
        <textarea v-model="form.condition" rows="2" :placeholder="t('cards.worldBook.conditionPlaceholder')" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"></textarea>
      </div>

      <div class="md:col-span-2">
        <label class="block text-sm font-medium text-black mb-2">{{ t('cards.worldBook.content') }}</label>
        <textarea rows="4" v-model="form.content" class="w-full px-3 py-2 border border-gray-300 rounded-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"></textarea>
      </div>
      <p v-if="errorMsg" class="md:col-span-2 text-xs text-red-600">* {{ errorMsg }}</p>
    </div>
  </div>
</template>

<style src="./shared-card-styles.css"></style>