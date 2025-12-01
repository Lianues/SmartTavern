import { defineStore } from 'pinia'
import { usePresetStore } from '@/features/presets/store'
import { useCharacterStore } from '@/features/characters/store'
import { usePersonaStore } from '@/features/persona/store'
/* removed unused: useFileManagerStore */
import { useHistoryStore, type OpenAIMessage } from '@/features/history/store'
import type { PresetData, WorldBookEntry, RegexRule } from '@/features/presets/types'

function clone<T>(x: T): T {
  return x == null ? x as any : JSON.parse(JSON.stringify(x))
}

/**
 * 前端工作流聚合上下文（供后续预览提示词工作流使用）
 * - 不直接请求后端，仅从各 Pinia Store 读取“当前页面所用 JSON”
 * - 遵循 docs/开发文档_架构与项目结构.md 的解耦：作为 features/workflow 模块提供聚合能力
 */
export interface EditorContext {
  presets: {
    name: string | null
    data: PresetData | null
  }
  worldbook: {
    name: string | null
    entries: WorldBookEntry[]
  }
  regex: RegexRule[]
  characters: any | null
  user: any | null
  history: {
    name: string | null
    messages: OpenAIMessage[]
  }
  meta: {
    builtAt: number
  }
}

export const useEditorContextStore = defineStore('editorContext', {
  // 使用 getters 派发至各业务 Store，保持解耦与可测性
  getters: {
    presets(): { name: string | null; data: PresetData | null } {
      const preset = usePresetStore()
      const name = preset.activeFile?.name ?? null
      const data = preset.activeData ? clone(preset.activeData) : null
      return { name, data }
    },

    worldbook(): { name: string | null; entries: WorldBookEntry[] } {
      const preset = usePresetStore()
      // 约定：世界书由 presetStore.activeData.world_books 提供
      const entries = clone(preset.worldBooks ?? [])
      // 取活动预设文件名作为关联名（若为空，则使用 'WorldBook' 作为占位）
      const name =
        (preset.activeFile?.name?.replace(/\.json$/, '') ?? 'WorldBook')
      return { name, entries }
    },

    regex(): RegexRule[] {
      const preset = usePresetStore()
      return clone(preset.regexRules ?? [])
    },

    characters(): any | null {
      const chars = useCharacterStore()
      return chars?.doc ? clone(chars.doc) : null
    },

    user(): any | null {
      const persona = usePersonaStore()
      return persona?.doc ? clone(persona.doc) : null
    },

    history(): { name: string | null; messages: OpenAIMessage[] } {
      const hst = useHistoryStore()
      const name = hst.activeName
      const messages = Array.isArray(hst.messages) ? hst.messages : []
      return { name: name ?? null, messages }
    },
  },

  actions: {
    /**
     * 生成一次“当前编辑上下文”的快照（深拷贝），供工作流即取即用
     */
    snapshot(): EditorContext {
      return {
        presets: this.presets,
        worldbook: this.worldbook,
        regex: this.regex,
        characters: this.characters,
        user: this.user,
        history: this.history,
        meta: { builtAt: Date.now() },
      }
    },
  },
})

/**
 * 便捷函数：直接获取一次性快照（无需在组件中持久化 Store 实例）
 */
export function getEditorContextSnapshot(): EditorContext {
  const s = useEditorContextStore()
  return s.snapshot()
}