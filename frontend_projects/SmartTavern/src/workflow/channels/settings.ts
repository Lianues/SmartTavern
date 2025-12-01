/**
 * 设置管理事件通道 (Settings Channel)
 * 
 * 负责处理对话设置的读取和更新操作。
 * 组件通过此通道请求获取或更新对话设置（角色、人设、预设等），
 * 桥接器负责调用ChatBranches服务并返回结果。
 */

import { ref, type Ref } from 'vue'

// ============ Type Definitions ============

/** 设置对象 */
export interface Settings {
  preset?: string;
  character?: string;
  persona?: string;
  regex_rules?: string[];
  world_books?: string[];
  llm_config?: string;
  [key: string]: any;
}

/** 设置缓存映射 */
export type SettingsCache = Record<string, Settings>

/** 加载状态映射 */
export type LoadingStates = Record<string, boolean>

/** 错误状态映射 */
export type ErrorStates = Record<string, string | null>

// ============ Event Constants ============

/** 请求获取设置 */
export const EVT_SETTINGS_GET_REQ = 'settings:get:req'
/** 返回设置数据 */
export const EVT_SETTINGS_GET_RES = 'settings:get:res'

/** 请求更新设置 */
export const EVT_SETTINGS_UPDATE_REQ = 'settings:update:req'
/** 返回更新结果 */
export const EVT_SETTINGS_UPDATE_RES = 'settings:update:res'

// ============ Reactive State ============

/**
 * 设置缓存：{ [conversationFile]: { settings对象 } }
 */
export const settingsCache: Ref<SettingsCache> = ref({})

/**
 * 加载状态：{ [conversationFile]: boolean }
 */
export const loadingStates: Ref<LoadingStates> = ref({})

/**
 * 错误状态：{ [conversationFile]: string|null }
 */
export const errorStates: Ref<ErrorStates> = ref({})

// ============ Helper Functions ============

/**
 * 获取指定对话的设置
 * @param conversationFile - 对话文件路径
 * @returns 设置对象或 null
 */
export function getSettings(conversationFile: string): Settings | null {
  if (!conversationFile) return null
  return settingsCache.value[conversationFile] || null
}

/**
 * 获取指定对话的某个设置字段
 * @param conversationFile - 对话文件路径
 * @param field - 字段名
 * @returns 字段值
 */
export function getSettingField(conversationFile: string, field: string): any {
  const settings = getSettings(conversationFile)
  return settings?.[field]
}

/**
 * 更新设置缓存
 * @param conversationFile - 对话文件路径
 * @param settings - 设置对象
 */
export function updateSettingsCache(conversationFile: string, settings: Settings): void {
  if (!conversationFile) return
  
  if (!settingsCache.value[conversationFile]) {
    settingsCache.value[conversationFile] = {}
  }
  
  Object.assign(settingsCache.value[conversationFile], settings)
}

/**
 * 清除指定对话的设置缓存
 * @param conversationFile - 对话文件路径
 */
export function clearSettingsCache(conversationFile: string): void {
  if (!conversationFile) return
  
  delete settingsCache.value[conversationFile]
  delete loadingStates.value[conversationFile]
  delete errorStates.value[conversationFile]
}

/**
 * 清空所有设置缓存
 */
export function clearAllSettings(): void {
  settingsCache.value = {}
  loadingStates.value = {}
  errorStates.value = {}
}

/**
 * 获取加载状态
 * @param conversationFile - 对话文件路径
 * @returns 加载状态
 */
export function isLoading(conversationFile: string): boolean {
  return loadingStates.value[conversationFile] || false
}

/**
 * 设置加载状态
 * @param conversationFile - 对话文件路径
 * @param loading - 加载状态
 */
export function setLoading(conversationFile: string, loading: boolean): void {
  if (!conversationFile) return
  loadingStates.value[conversationFile] = loading
}

/**
 * 获取错误状态
 * @param conversationFile - 对话文件路径
 * @returns 错误信息或 null
 */
export function getError(conversationFile: string): string | null {
  return errorStates.value[conversationFile] || null
}

/**
 * 设置错误状态
 * @param conversationFile - 对话文件路径
 * @param error - 错误信息
 */
export function setError(conversationFile: string, error: string | null): void {
  if (!conversationFile) return
  errorStates.value[conversationFile] = error
}