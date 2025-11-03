/**
 * Presets domain types (feature-scoped)
 * Keep models pure and UI-agnostic.
 */

export type Role = 'user' | 'system' | 'assistant'
export type PromptPosition = 'relative' | 'in-chat'

export interface PresetSetting {
  temperature: number
  frequency_penalty: number
  presence_penalty: number
  top_p: number
  top_k: number
  max_context: number
  max_tokens: number
  stream: boolean
}

export interface RegexRule {
  id: string
  name: string
  enabled: boolean
  find_regex: string
  replace_regex: string
  targets: string[]
  placement: 'after_macro' | 'before_macro' | 'postprocess' | string
  views: string[]
  mode?: 'always' | 'conditional' | string
  condition?: string
  min_depth?: number
  max_depth?: number
  description?: string
}

/** World Book domain */
export type WorldBookMode = 'always' | 'conditional' | string
export type WorldBookPosition = 'before_char' | 'after_char' | 'user' | 'assistant' | 'system' | string

export interface WorldBookEntry {
  id: string
  name: string
  enabled: boolean
  content: string
  mode: WorldBookMode
  position: WorldBookPosition
  order?: number
  depth?: number
  condition?: string
  keys?: string[]
}

export interface PromptItemBase {
  identifier: string
  name: string
  enabled: boolean | null
  role: Role
  position: PromptPosition
  /**
   * 若对象缺少 content 字段，表示占位条目；UI 不显示内容区。
   * 注意：与 content: ''（空字符串）不同。
   */
  content?: string
}

export interface PromptItemRelative extends PromptItemBase {
  position: 'relative'
  // 无 depth/order
}

export interface PromptItemInChat extends PromptItemBase {
  position: 'in-chat'
  depth: number
  order: number
}

export type PromptItem = PromptItemRelative | PromptItemInChat

export interface PresetData {
  setting: PresetSetting
  regex_rules: RegexRule[]
  world_books?: WorldBookEntry[]
  prompts: PromptItem[]
}

/**
 * 一次性 Relative 组件清单（id/name/参数固定）
 * 若已存在同 id 条目则不可再次新增
 */
export const SPECIAL_RELATIVE_TEMPLATES: PromptItemRelative[] = [
  {
    identifier: 'charBefore',
    name: 'char Before',
    enabled: null,
    role: 'system',
    position: 'relative',
  },
  {
    identifier: 'personaDescription',
    name: 'Persona Description',
    enabled: false,
    role: 'system',
    position: 'relative',
  },
  {
    identifier: 'charDescription',
    name: 'Char Description',
    enabled: true,
    role: 'system',
    position: 'relative',
  },
  {
    identifier: 'charAfter',
    name: 'char After',
    enabled: true,
    role: 'system',
    position: 'relative',
  },
  {
    identifier: 'chatHistory',
    name: 'Chat History',
    enabled: true,
    role: 'system',
    position: 'relative',
  },
]

/**
 * Browser-managed file entry for presets.
 * Stored in LocalStorage.
 */
export interface PresetFile {
  name: string
  enabled: boolean
  data: PresetData
}

/* ---------------- Type Guards (lightweight shape checks) ---------------- */

export function isPresetSetting(val: any): val is PresetSetting {
  return val && typeof val === 'object'
    && typeof val.temperature === 'number'
    && typeof val.frequency_penalty === 'number'
    && typeof val.presence_penalty === 'number'
    && typeof val.top_p === 'number'
    && typeof val.top_k === 'number'
    && typeof val.max_context === 'number'
    && typeof val.max_tokens === 'number'
    && typeof val.stream === 'boolean'
}

export function isRegexRule(val: any): val is RegexRule {
  return val && typeof val === 'object'
    && typeof val.id === 'string'
    && typeof val.name === 'string'
    && typeof val.enabled === 'boolean'
    && typeof val.find_regex === 'string'
    && typeof val.replace_regex === 'string'
    && Array.isArray(val.targets)
    && typeof val.placement === 'string'
    && Array.isArray(val.views)
}

export function isWorldBookEntry(val: any): val is WorldBookEntry {
  return val && typeof val === 'object'
    && typeof val.id === 'string'
    && typeof val.name === 'string'
    && (val.enabled === true || val.enabled === false)
    && typeof val.content === 'string'
    && typeof val.mode === 'string'
    && typeof val.position === 'string'
    && (val.keys == null || Array.isArray(val.keys))
}

export function isPromptItemBase(val: any): val is PromptItemBase {
  return val && typeof val === 'object'
    && typeof val.identifier === 'string'
    && typeof val.name === 'string'
    && (val.enabled === true || val.enabled === false || val.enabled === null)
    && (val.role === 'user' || val.role === 'system' || val.role === 'assistant')
    && (val.position === 'relative' || val.position === 'in-chat')
}

export function isPromptItemInChat(val: any): val is PromptItemInChat {
  return isPromptItemBase(val)
    && val.position === 'in-chat'
    && typeof (val as any).depth === 'number'
    && typeof (val as any).order === 'number'
}

export function isPromptItemRelative(val: any): val is PromptItemRelative {
  return isPromptItemBase(val) && val.position === 'relative'
}

export function isPromptItem(val: any): val is PromptItem {
  return isPromptItemRelative(val) || isPromptItemInChat(val)
}

export function isPresetData(val: any): val is PresetData {
  return val && typeof val === 'object'
    && isPresetSetting(val.setting)
    && Array.isArray(val.regex_rules) && val.regex_rules.every(isRegexRule)
    && Array.isArray(val.prompts) && val.prompts.every(isPromptItem)
}