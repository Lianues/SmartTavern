<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import AppShell from './layouts/AppShell.vue'
import Sidebar from './components/Sidebar.vue'
import PresetView from './views/PresetView.vue'
import WorldbookView from './views/WorldbookView.vue'
import CharactersView from './views/CharactersView.vue'
import RegexView from './views/RegexView.vue'
import UserView from './views/UserView.vue'
import HistoryView from './views/HistoryView.vue'
import FileManagerView from './views/FileManagerView.vue'
import GlobalPromptPreview from './features/preview/components/GlobalPromptPreview.vue'

import { usePresetStore } from './features/presets/store'
import { useCharacterStore } from '@/features/characters/store'
import { usePersonaStore } from '@/features/persona/store'
import { useHistoryStore } from '@/features/history/store'
import { useFileManagerStore } from '@/features/files/fileManager'
import { usePreviewRuntime } from '@/features/preview/runtime'
import { usePreviewStore } from '@/features/preview/store'

type TabKey = 'presets' | 'files' | 'worldbook' | 'characters' | 'regex' | 'user' | 'history'
const currentTab = ref<TabKey>('presets')

const presetStore = usePresetStore()
const characterStore = useCharacterStore()
const personaStore = usePersonaStore()
const historyStore = useHistoryStore()
const fileManager = useFileManagerStore()
const previewRuntime = usePreviewRuntime()
const previewUI = usePreviewStore()

onMounted(() => {
  presetStore.load()
  characterStore.load()
  personaStore.load()
  historyStore.load()
  fileManager.load()

  // 初次进入页面，完成加载后立即生成一次当前模式的提示词
  nextTick(() => previewRuntime.generateNow())
})

// 监听右侧栏模式切换：每次切换立即调用对应工作流
watch(() => previewUI.mode, (m) => {
  previewRuntime.generateNow(m)
})

// 监听各处 JSON 变更：1 秒冷却内防抖触发工作流
watch(() => presetStore.activeData, () => previewRuntime.schedule(), { deep: true })
watch(() => characterStore.doc, () => previewRuntime.schedule(), { deep: true })
watch(() => personaStore.doc, () => previewRuntime.schedule(), { deep: true })
watch(() => historyStore.activeData, () => previewRuntime.schedule(), { deep: true })

/* 右上角“新建”对话框与逻辑 */
const showNewDialog = ref(false)
const newName = ref<string>('')
const newError = ref<string | null>(null)

function suggestNewNameForTab(tab: TabKey): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`
  switch (tab) {
    case 'presets': return `Preset_${stamp}.json`
    case 'worldbook': return `WorldBook_${stamp}.json`
    case 'regex': return `RegexRules_${stamp}.json`
    case 'characters': return `Character_${stamp}.json`
    case 'user': return `Persona_${stamp}.json`
    case 'history': return `History_${stamp}.json`
    default: return `New_${stamp}.json`
  }
}
function normalizeJsonName(name: string): string {
  const base = String(name || '').trim()
  if (!base) return ''
  return base.toLowerCase().endsWith('.json') ? base : `${base}.json`
}
function openNewDialog() {
  const mainTab = currentTab.value
  const currentType = (fileManager as any)?.getCurrentType || 'presets'
  const targetTab = (mainTab === 'files' ? currentType : mainTab) as TabKey
  newName.value = suggestNewNameForTab(targetTab)
  newError.value = null
  showNewDialog.value = true
}
function cancelNew() {
  showNewDialog.value = false
}
function buildBaseDoc(tab: TabKey): any {
  if (tab === 'presets' || tab === 'worldbook' || tab === 'regex') {
    // 最小 PresetData 承载
    return {
      setting: {
        temperature: 1, frequency_penalty: 0, presence_penalty: 0,
        top_p: 1, top_k: 0, max_context: 4095, max_tokens: 300, stream: true
      },
      regex_rules: [],
      prompts: [],
      world_books: [],
    }
  }
  if (tab === 'characters') {
    return {
      name: '', description: '',
      message: [],
      world_book: { name: '', entries: [] },
      regex_rules: [],
    }
  }
  if (tab === 'user') {
    return { name: '', description: '' }
  }
  if (tab === 'history') {
    return {
      schema: { name: 'chat-branches', version: 2 },
      meta: { id: `c_${Date.now().toString(36)}`, title: '' },
      root: 'n_root',
      nodes: { n_root: { pid: null, role: 'system', content: '' } },
      children: { n_root: [] },
      active_path: ['n_root'],
    }
  }
  return {}
}
async function confirmNew() {
  const mainTab = currentTab.value
  const currentType = (fileManager as any)?.getCurrentType || 'presets'
  const targetTab = (mainTab === 'files' ? currentType : mainTab) as TabKey

  const raw = normalizeJsonName(newName.value)
  if (!raw) {
    newError.value = '请输入文件名'
    return
  }
  newError.value = null

  const doc = buildBaseDoc(targetTab)

  try {
    if (targetTab === 'presets') {
      const entry: any = { name: raw, enabled: true, data: doc }
      presetStore.upsertFile(entry)
      fileManager.upsertFile('presets', raw, doc)
    } else if (targetTab === 'worldbook') {
      const entry: any = { name: raw, enabled: true, data: doc }
      presetStore.upsertFile(entry)
      // world_books 面板直接使用 activeData.world_books
      presetStore.setWorldBooks([])
      ;(presetStore as any).renameActive?.(raw)
      fileManager.upsertFile('worldbook', raw, { name: raw.replace(/\.json$/,''), entries: [] })
    } else if (targetTab === 'regex') {
      const entry: any = { name: raw, enabled: true, data: doc }
      presetStore.upsertFile(entry)
      presetStore.setRegexRules([])
      ;(presetStore as any).renameActive?.(raw)
      fileManager.upsertFile('regex', raw, [])
    } else if (targetTab === 'characters') {
      ;(characterStore as any).setCharacter(doc, raw)
      fileManager.upsertFile('characters', raw, doc)
    } else if (targetTab === 'user') {
      ;(personaStore as any).setPersona(doc, raw)
      fileManager.upsertFile('user', raw, doc)
    } else if (targetTab === 'history') {
      historyStore.setDoc(doc, raw)
      fileManager.upsertFile('history', raw, doc)
    }
  } finally {
    showNewDialog.value = false
    nextTick(() => (window as any).lucide?.createIcons?.())
  }
}

/* 顶部右侧：导入（选择 JSON），导出（下载当前）
   - 预设页：仍按 PresetData 导入/导出
   - 世界书页：仅支持 {entries:[...]} 或 {world_book:{entries:[...]}} 导入/导出 */
function handleImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return

    // 捕获当前页签快照，避免异步过程中切换导致误判
    const mainTab = currentTab.value

    // 如果是在“文件库”页签，则完全依赖文件库内部的类型（不做任何类型推断）
    const currentType = (fileManager as any)?.getCurrentType || 'presets'
    const targetTab = mainTab === 'files' ? currentType : mainTab

    // 读取文本并清理 BOM/不可见字符
    let text = ''
    try {
      text = await file.text()
    } catch {
      alert('导入失败：无法读取文件')
      return
    }
    if (text && text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
    text = text.replace(/\uFEFF/g, '').trim()

    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      alert('导入失败：JSON 解析错误')
      return
    }

    // 工具：扁平化数组/嵌套数组为对象列表
    const flattenObjects = (input: any): any[] => {
      const out: any[] = []
      const walk = (x: any) => {
        if (Array.isArray(x)) {
          for (const it of x) walk(it)
        } else if (x && typeof x === 'object') {
          out.push(x)
        }
      }
      walk(input)
      return out
    }

    // 重要：不进行文件类型检查。严格按 targetTab 分流导入与入库。

    // 角色卡（SmartTavern 角色卡结构）
    if (targetTab === 'characters') {
      try {
        characterStore.setCharacter(json, file.name)
      } catch {}
      try { fileManager.upsertFile('characters', file.name, json) } catch {}
      return
    }

    // 用户信息（Persona）
    if (targetTab === 'user') {
      try { personaStore.setPersona(json, file.name) } catch {}
      try { fileManager.upsertFile('user', file.name, json) } catch {}
      return
    }

    // 正则（数组或 { regex_rules: [] }）
    if (targetTab === 'regex') {
      const rules: any[] = Array.isArray(json)
        ? json
        : (Array.isArray(json?.regex_rules) ? json.regex_rules : [])
      try {
        if (!presetStore.activeData) {
          presetStore.upsertFile({
            name: 'RegexPanel',
            enabled: true,
            data: { setting: {}, prompts: [], regex_rules: [] } as any,
          } as any)
        }
        presetStore.setRegexRules(rules as any)
        try { (presetStore as any).renameActive?.(file.name) } catch {}
      } catch {}
      try { fileManager.upsertFile('regex', file.name, json) } catch {}
      return
    }

    // 对话历史：入库 + 镜像到历史面板
    if (targetTab === 'history') {
      try { historyStore.setDoc(json, file.name) } catch {}
      try { fileManager.upsertFile('history', file.name, json) } catch {}
      return
    }

    // 世界书（仅当在世界书页签下）
    if (targetTab === 'worldbook') {
      let flat: any[] = []
      if (Array.isArray(json?.entries)) {
        flat = flattenObjects(json.entries)
      } else if (Array.isArray(json?.world_book?.entries)) {
        flat = flattenObjects(json.world_book.entries)
      } else if (Array.isArray(json)) {
        flat = flattenObjects(json)
      } else {
        try { fileManager.upsertFile('worldbook', file.name, json) } catch {}
        return
      }
      try { presetStore.setWorldBooks(flat as any) } catch {}
      try { (presetStore as any).renameActive?.(file.name) } catch {}
      try { fileManager.upsertFile('worldbook', file.name, json) } catch {}
      return
    }

    // 预设（仅当在预设页签或文件库当前类型为 presets 时）
    if (targetTab === 'presets') {
      try {
        await presetStore.importFromFile(file)
        try { fileManager.upsertFile('presets', file.name, json) } catch {}
      } catch {
        alert('导入失败：预设数据结构不符合预期')
      }
      return
    }

    // 未识别页签保护（理论不应到达）
    alert('导入失败：当前页签未配置导入行为')
  }
  input.click()
}

function handleExport() {
  if (currentTab.value === 'worldbook') {
    const res = presetStore.exportWorldBooks()
    if (!res) return
    const blob = new Blob([res.json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = res.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } else if (currentTab.value === 'characters') {
    const res = characterStore.exportCharacter()
    if (!res) return
    const blob = new Blob([res.json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = res.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } else if (currentTab.value === 'user') {
    const res = personaStore.exportPersona()
    if (!res) return
    const blob = new Blob([res.json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = res.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } else if (currentTab.value === 'history') {
    const res = historyStore.exportActive()
    if (!res) return
    const blob = new Blob([res.json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = res.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } else {
    const res = presetStore.exportActive()
    if (!res) return
    const blob = new Blob([res.json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = res.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
}

/* 顶部右侧：重置当前页面缓存 JSON
   - 非“文件库”页：仅重置该页对应的本地缓存
   - “文件库”页：清除“当前类型”页签里的所有 JSON，并同步清除对应页面缓存 */
function handleReset() {
  const tab = currentTab.value
  try {
    if (tab === 'files') {
      // 仅清空“文件库”当前类型
      const currentType = (fileManager as any)?.getCurrentType || 'presets'
      fileManager.clearType(currentType)

      // 同步清除对应页面缓存
      switch (currentType) {
        case 'presets': {
          presetStore.clearAll()
          break
        }
        case 'worldbook': {
          if (presetStore.activeData) {
            ;(presetStore.activeData as any).world_books = []
            ;(presetStore as any).persist?.()
          } else {
            presetStore.setWorldBooks([] as any)
          }
          break
        }
        case 'regex': {
          if (presetStore.activeData) {
            ;(presetStore.activeData as any).regex_rules = []
            ;(presetStore as any).persist?.()
          } else {
            presetStore.setRegexRules([] as any)
          }
          break
        }
        case 'characters': {
          characterStore.clearAll?.()
          break
        }
        case 'user': {
          personaStore.clearAll?.()
          break
        }
        case 'history': {
          historyStore.clearAll?.()
          break
        }
      }
    } else if (tab === 'presets') {
      presetStore.clearAll()
    } else if (tab === 'worldbook') {
      if (presetStore.activeData) {
        ;(presetStore.activeData as any).world_books = []
        ;(presetStore as any).persist?.()
      } else {
        // 若无活动文件，确保创建最小承载后置空
        presetStore.setWorldBooks([] as any)
      }
    } else if (tab === 'regex') {
      if (presetStore.activeData) {
        ;(presetStore.activeData as any).regex_rules = []
        ;(presetStore as any).persist?.()
      } else {
        // 若无活动文件，确保创建最小承载后置空
        presetStore.setRegexRules([] as any)
      }
    } else if (tab === 'characters') {
      characterStore.clearAll?.()
    } else if (tab === 'user') {
      personaStore.clearAll?.()
    } else if (tab === 'history') {
      historyStore.clearAll?.()
    }
  } finally {
    // 右侧预览：根据最新数据重新生成
    previewRuntime.schedule()
  }
}
</script>

<template>
  <AppShell @new="openNewDialog" @import-files="handleImport" @export-file="handleExport" @reset="handleReset">
    <!-- 左侧栏插槽：侧边导航 -->
    <template #left>
      <Sidebar v-model="currentTab" />
    </template>

    <!-- 中间主视图区 -->
    <template #main>
      <section v-if="currentTab === 'presets'" class="h-full">
        <PresetView />
      </section>

      <section v-else-if="currentTab === 'files'" class="h-full">
        <FileManagerView />
      </section>

      <section v-else-if="currentTab === 'worldbook'" class="h-full">
        <WorldbookView />
      </section>

      <section v-else-if="currentTab === 'characters'" class="h-full">
        <CharactersView />
      </section>

      <section v-else-if="currentTab === 'regex'" class="h-full">
        <RegexView />
      </section>

      <section v-else-if="currentTab === 'user'" class="h-full">
        <UserView />
      </section>

      <section v-else-if="currentTab === 'history'" class="h-full">
        <HistoryView />
      </section>

      <section v-else class="bg-white rounded-4 card-shadow border border-gray-200 p-8 transition-all duration-200 ease-soft hover:shadow-elevate">
        <div class="text-center">
          <i data-lucide="circle-dashed" class="w-10 h-10 text-black/40 mx-auto mb-4"></i>
          <p class="text-black/60">未知视图：{{ currentTab }}</p>
        </div>
      </section>
    </template>

    <!-- 右侧预览插槽：全局提示词预览组件 -->
    <template #right>
      <GlobalPromptPreview />
    </template>
  </AppShell>

  <!-- 新建文件对话框 -->
  <div v-if="showNewDialog" class="fixed inset-0 z-[999] flex items-center justify-center bg-black/30">
    <div class="bg-white rounded-4 border border-gray-200 w-[90%] max-w-md p-5">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="file-plus-2" class="w-5 h-5 text-black"></i>
        <h3 class="text-base font-semibold text-black">新建文件</h3>
      </div>
      <input
        v-model="newName"
        type="text"
        placeholder="请输入文件名（例如：Preset.json）"
        class="w-full px-3 py-2 border border-gray-300 rounded-4 focus:outline-none focus:ring-2 focus:ring-gray-800"
      />
      <p v-if="newError" class="text-xs text-red-600 mt-2">* {{ newError }}</p>
      <div class="mt-4 flex justify-end gap-2">
        <button
          class="px-3 py-1 rounded-4 bg-transparent border border-gray-900 text-black hover:bg-gray-100 active:bg-gray-200 transition-all duration-200 ease-soft"
          @click="cancelNew"
        >
          取消
        </button>
        <button
          class="px-3 py-1 rounded-4 bg-black text-white hover:opacity-90 transition-all duration-200 ease-soft"
          @click="confirmNew"
        >
          确认
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 局部样式保持最轻，仅少量覆盖；其余交由 Tailwind 工具类 */
</style>

<style>
/* Range 输入美化（全局，黑白风格） */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  width: 100%;
}
input[type="range"]::-webkit-slider-runnable-track {
  height: 4px;
  background-color: #E5E7EB;
  border-radius: 9999px;
}
input[type="range"]::-moz-range-track {
  height: 4px;
  background-color: #E5E7EB;
  border-radius: 9999px;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: #111;
  border: 2px solid #111;
  border-radius: 50%;
  margin-top: -5px; /* 居中对齐轨道 */
  transition: transform 180ms cubic-bezier(0.2,0,0,1), box-shadow 180ms cubic-bezier(0.2,0,0,1);
}
input[type="range"]::-webkit-slider-thumb:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(0,0,0,0.15);
}
input[type="range"]::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: #111;
  border: 2px solid #111;
  border-radius: 50%;
  transition: transform 180ms cubic-bezier(0.2,0,0,1), box-shadow 180ms cubic-bezier(0.2,0,0,1);
}
input[type="range"]::-moz-range-thumb:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 12px rgba(0,0,0,0.15);
}
</style>
