/**
 * 数据目录事件通道 (Data Catalog Channel)
 * 
 * 负责处理所有数据目录相关的请求与响应事件。
 * 组件通过此通道请求各类数据列表（角色、人设、预设等），
 * 桥接器负责调用后端服务并返回结果。
 */

import { ref, type Ref } from 'vue'

// ============ Type Definitions ============

/** 数据类型 */
export type DataCategory = 'preset' | 'character' | 'persona' | 'regex' | 'worldbook' | 'llm_config'

/** 数据项 */
export interface DataItem {
  name: string;
  file: string;
  icon?: string;
  [key: string]: any;
}

/** 列表查询请求 Payload */
export interface CatalogListRequestPayload {
  category: DataCategory;
  tag?: string;
}

/** 列表查询成功 Payload */
export interface CatalogListSuccessPayload {
  category: DataCategory;
  items: DataItem[];
  tag?: string;
}

/** 列表查询失败 Payload */
export interface CatalogListFailurePayload {
  category: DataCategory;
  message: string;
  tag?: string;
}

/** 详情查询请求 Payload */
export interface CatalogDetailRequestPayload {
  category: DataCategory;
  file: string;
  tag?: string;
}

/** 详情查询成功 Payload */
export interface CatalogDetailSuccessPayload {
  category: DataCategory;
  file: string;
  data: any;
  tag?: string;
}

/** 详情查询失败 Payload */
export interface CatalogDetailFailurePayload {
  category: DataCategory;
  file: string;
  message: string;
  tag?: string;
}

/** 更新请求 Payload */
export interface CatalogUpdateRequestPayload {
  category: DataCategory;
  file: string;
  data: any;
  tag?: string;
}

/** 更新成功 Payload */
export interface CatalogUpdateSuccessPayload {
  category: DataCategory;
  file: string;
  tag?: string;
}

/** 更新失败 Payload */
export interface CatalogUpdateFailurePayload {
  category: DataCategory;
  file: string;
  message: string;
  tag?: string;
}

/** 加载状态映射 */
export interface LoadingStates {
  characters: boolean;
  personas: boolean;
  presets: boolean;
  worldbooks: boolean;
  regex: boolean;
  llmconfigs: boolean;
}

/** 错误状态映射 */
export interface ErrorStates {
  characters: string | null;
  personas: string | null;
  presets: string | null;
  worldbooks: string | null;
  regex: string | null;
  llmconfigs: string | null;
}

// ============ Event Constants ============

// ===== 事件常量 =====

/** 请求角色列表 */
export const EVT_CATALOG_CHARACTERS_REQ = 'catalog:characters:req'
/** 返回角色列表 */
export const EVT_CATALOG_CHARACTERS_RES = 'catalog:characters:res'

/** 请求人设列表 */
export const EVT_CATALOG_PERSONAS_REQ = 'catalog:personas:req'
/** 返回人设列表 */
export const EVT_CATALOG_PERSONAS_RES = 'catalog:personas:res'

/** 请求预设列表 */
export const EVT_CATALOG_PRESETS_REQ = 'catalog:presets:req'
/** 返回预设列表 */
export const EVT_CATALOG_PRESETS_RES = 'catalog:presets:res'

/** 请求世界书列表 */
export const EVT_CATALOG_WORLDBOOKS_REQ = 'catalog:worldbooks:req'
/** 返回世界书列表 */
export const EVT_CATALOG_WORLDBOOKS_RES = 'catalog:worldbooks:res'

/** 请求正则规则列表 */
export const EVT_CATALOG_REGEX_REQ = 'catalog:regex:req'
/** 返回正则规则列表 */
export const EVT_CATALOG_REGEX_RES = 'catalog:regex:res'

/** 请求LLM配置列表 */
export const EVT_CATALOG_LLMCONFIGS_REQ = 'catalog:llmconfigs:req'
/** 返回LLM配置列表 */
export const EVT_CATALOG_LLMCONFIGS_RES = 'catalog:llmconfigs:res'

// ===== Update 操作事件 =====

/** 更新角色文件 */
export const EVT_CATALOG_CHARACTER_UPDATE_REQ = 'catalog:character:update:req'
export const EVT_CATALOG_CHARACTER_UPDATE_OK = 'catalog:character:update:ok'
export const EVT_CATALOG_CHARACTER_UPDATE_FAIL = 'catalog:character:update:fail'

/** 更新人设文件 */
export const EVT_CATALOG_PERSONA_UPDATE_REQ = 'catalog:persona:update:req'
export const EVT_CATALOG_PERSONA_UPDATE_OK = 'catalog:persona:update:ok'
export const EVT_CATALOG_PERSONA_UPDATE_FAIL = 'catalog:persona:update:fail'

/** 更新预设文件 */
export const EVT_CATALOG_PRESET_UPDATE_REQ = 'catalog:preset:update:req'
export const EVT_CATALOG_PRESET_UPDATE_OK = 'catalog:preset:update:ok'
export const EVT_CATALOG_PRESET_UPDATE_FAIL = 'catalog:preset:update:fail'

/** 更新世界书文件 */
export const EVT_CATALOG_WORLDBOOK_UPDATE_REQ = 'catalog:worldbook:update:req'
export const EVT_CATALOG_WORLDBOOK_UPDATE_OK = 'catalog:worldbook:update:ok'
export const EVT_CATALOG_WORLDBOOK_UPDATE_FAIL = 'catalog:worldbook:update:fail'

/** 更新正则规则文件 */
export const EVT_CATALOG_REGEX_UPDATE_REQ = 'catalog:regex:update:req'
export const EVT_CATALOG_REGEX_UPDATE_OK = 'catalog:regex:update:ok'
export const EVT_CATALOG_REGEX_UPDATE_FAIL = 'catalog:regex:update:fail'

/** 更新LLM配置文件 */
export const EVT_CATALOG_LLMCONFIG_UPDATE_REQ = 'catalog:llmconfig:update:req'
export const EVT_CATALOG_LLMCONFIG_UPDATE_OK = 'catalog:llmconfig:update:ok'
export const EVT_CATALOG_LLMCONFIG_UPDATE_FAIL = 'catalog:llmconfig:update:fail'

// ===== 统一列表查询事件 =====

/**
 * 统一列表查询请求
 * payload: { category: 'preset'|'character'|'persona'|'regex'|'worldbook'|'llm_config', tag?: string }
 */
export const EVT_CATALOG_LIST_REQ = 'catalog:list:req'
/**
 * 统一列表查询成功
 * payload: { category, items: [...], tag?: string }
 */
export const EVT_CATALOG_LIST_OK = 'catalog:list:ok'
/**
 * 统一列表查询失败
 * payload: { category, message: string, tag?: string }
 */
export const EVT_CATALOG_LIST_FAIL = 'catalog:list:fail'

// ===== 详情查询事件 =====

/**
 * 获取资源详情请求
 * payload: { category: 'preset'|'character'|'persona'|'regex'|'worldbook'|'llm_config', file: string, tag?: string }
 */
export const EVT_CATALOG_GET_DETAIL_REQ = 'catalog:detail:get:req'
/**
 * 获取资源详情成功
 * payload: { category, file, data: {...}, tag?: string }
 */
export const EVT_CATALOG_GET_DETAIL_OK = 'catalog:detail:get:ok'
/**
 * 获取资源详情失败
 * payload: { category, file, message: string, tag?: string }
 */
export const EVT_CATALOG_GET_DETAIL_FAIL = 'catalog:detail:get:fail'

// ============ Reactive State ============

/** 角色列表缓存 */
export const characters: Ref<DataItem[]> = ref([])
/** 人设列表缓存 */
export const personas: Ref<DataItem[]> = ref([])
/** 预设列表缓存 */
export const presets: Ref<DataItem[]> = ref([])
/** 世界书列表缓存 */
export const worldbooks: Ref<DataItem[]> = ref([])
/** 正则规则列表缓存 */
export const regexRules: Ref<DataItem[]> = ref([])
/** LLM配置列表缓存 */
export const llmConfigs: Ref<DataItem[]> = ref([])

/** 加载状态映射 */
export const loadingStates: Ref<LoadingStates> = ref({
  characters: false,
  personas: false,
  presets: false,
  worldbooks: false,
  regex: false,
  llmconfigs: false
})

/** 错误状态映射 */
export const errorStates: Ref<ErrorStates> = ref({
  characters: null,
  personas: null,
  presets: null,
  worldbooks: null,
  regex: null,
  llmconfigs: null
})

// ============ Helper Functions ============

/**
 * 重置指定类型的缓存和状态
 * @param type - 数据类型
 */
export function resetCatalogState(type: keyof LoadingStates): void {
  const stateMap: Record<string, Ref<DataItem[]>> = {
    characters,
    personas,
    presets,
    worldbooks,
    regex: regexRules,
    llmconfigs: llmConfigs
  }
  
  if (stateMap[type]) {
    stateMap[type].value = []
  }
  
  if (loadingStates.value[type] !== undefined) {
    loadingStates.value[type] = false
  }
  
  if (errorStates.value[type] !== undefined) {
    errorStates.value[type] = null
  }
}

/**
 * 清空所有缓存和状态
 */
export function clearAllCatalog(): void {
  characters.value = []
  personas.value = []
  presets.value = []
  worldbooks.value = []
  regexRules.value = []
  llmConfigs.value = []
  
  Object.keys(loadingStates.value).forEach(key => {
    loadingStates.value[key as keyof LoadingStates] = false
  })
  
  Object.keys(errorStates.value).forEach(key => {
    errorStates.value[key as keyof ErrorStates] = null
  })
}