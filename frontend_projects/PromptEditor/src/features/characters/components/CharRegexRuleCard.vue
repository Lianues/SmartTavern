<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useCharacterStore } from '@/features/characters/store'
import type { RegexRule } from '@/features/presets/types'

const props = defineProps<{ rule: RegexRule }>()

const store = useCharacterStore()
const editing = ref(false)

const enabledLabel = (v: boolean) => (v ? '已启用' : '未启用')

const draftName = ref(props.rule.name)
const draftEnabled = ref(props.rule.enabled ? 'true' : 'false')
const draftPlacement = ref<string>(props.rule.placement as any)
const draftFind = ref<string>(props.rule.find_regex)
const draftReplace = ref<string>(props.rule.replace_regex)

/* 选项枚举（与后端实现保持一致） */
const TARGET_PREFIXES = ['preset','world_book','history','char','persona'] as const
type TargetPrefix = typeof TARGET_PREFIXES[number]
const VIEWS = ['user_view','assistant_view'] as const
type ViewKey = typeof VIEWS[number]

/* 细粒度来源类型（与后端各模块输出的 source.type 对齐） */
const SOURCE_TYPES = [
  // history.*
  'history.user',
  'history.assistant',
  'history.thinking',
  // preset.*
  'preset.relative',
  'preset.in-chat',
  // world_book.*
  'world_book.before_char',
  'world_book.after_char',
  'world_book.in-chat',
  // description placeholders
  'char.description',
  'persona.description',
] as const
type SourceTypeKey = typeof SOURCE_TYPES[number]

/* 勾选框选择状态 */
const selectedTargets = ref<Record<TargetPrefix, boolean>>({
  preset: (props.rule.targets || []).includes('preset'),
  world_book: (props.rule.targets || []).includes('world_book'),
  history: (props.rule.targets || []).includes('history'),
  char: (props.rule.targets || []).includes('char'),
  persona: (props.rule.targets || []).includes('persona'),
})
const selectedViews = ref<Record<ViewKey, boolean>>({
  user_view: (props.rule.views || []).includes('user_view'),
  assistant_view: (props.rule.views || []).includes('assistant_view'),
})
const selectedSourceTypes = ref<Record<SourceTypeKey, boolean>>({
  'history.user': (props.rule.targets || []).includes('history.user'),
  'history.assistant': (props.rule.targets || []).includes('history.assistant'),
  'history.thinking': (props.rule.targets || []).includes('history.thinking'),
  'preset.relative': (props.rule.targets || []).includes('preset.relative'),
  'preset.in-chat': (props.rule.targets || []).includes('preset.in-chat'),
  'world_book.before_char': (props.rule.targets || []).includes('world_book.before_char'),
  'world_book.after_char': (props.rule.targets || []).includes('world_book.after_char'),
  'world_book.in-chat': (props.rule.targets || []).includes('world_book.in-chat'),
  'char.description': (props.rule.targets || []).includes('char.description'),
  'persona.description': (props.rule.targets || []).includes('persona.description'),
})
const draftMinDepth = ref<string>(props.rule.min_depth != null ? String(props.rule.min_depth) : '')
const draftMaxDepth = ref<string>(props.rule.max_depth != null ? String(props.rule.max_depth) : '')
const draftDescription = ref<string>(props.rule.description ?? '')

function resetDraft() {
  draftName.value = props.rule.name
  draftEnabled.value = props.rule.enabled ? 'true' : 'false'
  draftPlacement.value = props.rule.placement
  draftFind.value = props.rule.find_regex
  draftReplace.value = props.rule.replace_regex
  const arrT = (props.rule.targets || []).map(x => String(x))
  selectedTargets.value = {
    preset: arrT.includes('preset'),
    world_book: arrT.includes('world_book'),
    history: arrT.includes('history'),
    char: arrT.includes('char'),
    persona: arrT.includes('persona'),
  }
  const arrV = (props.rule.views || []).map(x => String(x))
  selectedViews.value = {
    user_view: arrV.includes('user_view'),
    assistant_view: arrV.includes('assistant_view'),
  }
  selectedSourceTypes.value = {
    'history.user': arrT.includes('history.user'),
    'history.assistant': arrT.includes('history.assistant'),
    'history.thinking': arrT.includes('history.thinking'),
    'preset.relative': arrT.includes('preset.relative'),
    'preset.in-chat': arrT.includes('preset.in-chat'),
    'world_book.before_char': arrT.includes('world_book.before_char'),
    'world_book.after_char': arrT.includes('world_book.after_char'),
    'world_book.in-chat': arrT.includes('world_book.in-chat'),
    'char.description': arrT.includes('char.description'),
    'persona.description': arrT.includes('persona.description'),
  }
  draftMinDepth.value = props.rule.min_depth != null ? String(props.rule.min_depth) : ''
  draftMaxDepth.value = props.rule.max_depth != null ? String(props.rule.max_depth) : ''
  draftDescription.value = props.rule.description ?? ''
}

watch(
  () => props.rule,
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
  store.removeRegexRule(props.rule.id)
}

function toNumOrUndef(text: string): number | undefined {
  const t = text.trim()
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

async function onSave() {
  const updated: RegexRule = {
    id: props.rule.id,
    name: draftName.value.trim() || props.rule.id,
    enabled: draftEnabled.value === 'true',
    find_regex: draftFind.value,
    replace_regex: draftReplace.value,
    // 勾选框 → 数组
    targets: [
      ...TARGET_PREFIXES.filter(k => selectedTargets.value[k]),
      ...SOURCE_TYPES.filter(s => selectedSourceTypes.value[s]),
    ],
    placement: (draftPlacement.value === 'before_macro' || draftPlacement.value === 'after_macro') ? draftPlacement.value : 'after_macro',
    views: VIEWS.filter(v => selectedViews.value[v]),
  }
  const minD = toNumOrUndef(draftMinDepth.value)
  const maxD = toNumOrUndef(draftMaxDepth.value)
  if (minD !== undefined) (updated as any).min_depth = minD
  if (maxD !== undefined) (updated as any).max_depth = maxD
  const desc = draftDescription.value.trim()
  if (desc) (updated as any).description = desc

  store.replaceRegexRule(updated)
  editing.value = false
  await nextTick()
  ;(window as any).lucide?.createIcons?.()
}
</script>

<template>
  <div class="border border-gray-200 rounded-4 p-3 bg-white transition-all duration-200 ease-soft hover:shadow-elevate">
    <div class="flex items-start justify-between">
      <div class="text-sm space-y-2">
        <!-- 第一行仅显示名称与 ID，避免过多参数挤在一行 -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-medium">{{ props.rule.name }}</span>
          <span class="text-xs text-black/60 font-mono">id: {{ props.rule.id }}</span>
        </div>

        <!-- 第二行：阶段与深度信息 -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-black/60">阶段</span>
          <span class="text-xs px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent">{{ props.rule.placement || '—' }}</span>
          <span v-if="props.rule.min_depth !== undefined" class="text-xs text-black/60">min: {{ props.rule.min_depth }}</span>
          <span v-if="props.rule.max_depth !== undefined" class="text-xs text-black/60">max: {{ props.rule.max_depth }}</span>
        </div>

        <!-- 第三行：targets -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-black/60">targets</span>
          <span v-for="t in props.rule.targets || []" :key="t" class="text-xs px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent">{{ t }}</span>
        </div>

        <!-- 第四行：views -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-black/60">views</span>
          <span v-for="v in props.rule.views || []" :key="v" class="text-xs px-2 py-0.5 rounded-4 border border-gray-900 text-black bg-transparent">{{ v }}</span>
        </div>

        <!-- 描述 -->
        <p v-if="props.rule.description" class="text-xs text-black/60">{{ props.rule.description }}</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-2 py-0.5 text-xs rounded-4 border border-gray-800 text-black">{{ enabledLabel(props.rule.enabled) }}</span>
        <button
          v-if="!editing"
          class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft text-xs"
          @click="onDelete"
        >
          删除
        </button>
        <button
          v-if="!editing"
          class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft text-xs"
          @click="onEdit"
        >
          编辑
        </button>
        <div v-else class="flex items-center gap-2">
          <button class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs" @click="onSave">保存</button>
          <button class="px-2 py-1 rounded-4 bg-transparent border border-gray-900 text-black text-xs" @click="onCancel">取消</button>
        </div>
      </div>
    </div>

    <!-- View mode regex bodies -->
    <div v-if="!editing" class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="border border-gray-200 rounded-4 p-3">
        <div class="text-xs font-medium text-black mb-2">find_regex</div>
        <div class="text-xs text-black/70 font-mono break-all whitespace-pre-wrap">{{ props.rule.find_regex }}</div>
      </div>
      <div class="border border-gray-200 rounded-4 p-3">
        <div class="text-xs font-medium text-black mb-2">replace_regex</div>
        <div class="text-xs text-black/70 font-mono break-all whitespace-pre-wrap">{{ props.rule.replace_regex }}</div>
      </div>
    </div>

    <!-- Edit form -->
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
          </select>
        </div>

        <div>
          <label class="block text-xs text-black/60 mb-1">阶段（placement）</label>
          <select
            v-model="draftPlacement"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 bg-white focus:outline-none focus:ring-2 focus:ring-gray-800"
          >
            <option value="before_macro">before_macro</option>
            <option value="after_macro">after_macro</option>
          </select>
        </div>

        <div>
          <label class="block text-xs text-black/60 mb-1">Targets</label>
          <div class="space-y-2">
            <!-- 大类前缀 -->
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-xs text-black/60">大类</span>
              <label class="inline-flex items-center gap-2 text-xs" v-for="k in TARGET_PREFIXES" :key="k">
                <input
                  type="checkbox"
                  v-model="selectedTargets[k]"
                  class="w-5 h-5 border border-gray-400 rounded-4 accent-black focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                />
                <span>{{ k }}</span>
              </label>
            </div>
            <!-- 细粒度来源类型 -->
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-xs text-black/60">细项</span>
              <label class="inline-flex items-center gap-2 text-xs" v-for="s in SOURCE_TYPES" :key="s">
                <input
                  type="checkbox"
                  v-model="selectedSourceTypes[s]"
                  class="w-5 h-5 border border-gray-400 rounded-4 accent-black focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                />
                <span>{{ s }}</span>
              </label>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-xs text-black/60 mb-1">Views</label>
          <div class="flex flex-wrap items-center gap-3">
            <label class="inline-flex items-center gap-2 text-xs" v-for="v in VIEWS" :key="v">
              <input
                type="checkbox"
                v-model="selectedViews[v]"
                class="w-5 h-5 border border-gray-400 rounded-4 accent-black focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
              />
              <span>{{ v }}</span>
            </label>
          </div>
        </div>

        <div>
          <label class="block text-xs text-black/60 mb-1">min_depth（可选）</label>
          <input
            type="number"
            v-model="draftMinDepth"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>

        <div>
          <label class="block text-xs text-black/60 mb-1">max_depth（可选）</label>
          <input
            type="number"
            v-model="draftMaxDepth"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>

        <div class="md:col-span-2">
          <label class="block text-xs text-black/60 mb-1">描述（可选）</label>
          <textarea
            v-model="draftDescription"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-black/60 mb-1">find_regex</label>
          <textarea
            v-model="draftFind"
            rows="3"
            class="w-full font-mono px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>
        <div>
          <label class="block text-xs text-black/60 mb-1">replace_regex</label>
          <textarea
            v-model="draftReplace"
            rows="3"
            class="w-full font-mono px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>