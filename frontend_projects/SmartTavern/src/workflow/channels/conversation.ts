/**
 * 对话生命周期事件通道 (Conversation Channel)
 * 
 * 负责处理对话的创建、加载、保存、删除等生命周期事件。
 * 组件通过此通道请求对话操作，桥接器负责调用后端服务并返回结果。
 */

import { ref, type Ref } from 'vue'

// ============ Type Definitions ============

/** 对话文档 */
export interface ConversationDoc {
  [key: string]: any;
}

/** 对话列表项 */
export interface ConversationItem {
  name: string;
  file: string;
  [key: string]: any;
}

/** 加载状态映射 */
export interface ConversationLoadingStates {
  create: boolean;
  load: boolean;
  save: boolean;
  delete: boolean;
  list: boolean;
}

/** 错误状态映射 */
export interface ConversationErrorStates {
  create: string | null;
  load: string | null;
  save: string | null;
  delete: string | null;
  list: string | null;
}

// ============ Event Constants ============

/** 创建新对话 */
export const EVT_CONVERSATION_CREATE_REQ = 'conversation:create:req'
export const EVT_CONVERSATION_CREATE_OK = 'conversation:create:ok'
export const EVT_CONVERSATION_CREATE_FAIL = 'conversation:create:fail'

/** 加载对话详情 */
export const EVT_CONVERSATION_LOAD_REQ = 'conversation:load:req'
export const EVT_CONVERSATION_LOAD_OK = 'conversation:load:ok'
export const EVT_CONVERSATION_LOAD_FAIL = 'conversation:load:fail'

/** 保存对话 */
export const EVT_CONVERSATION_SAVE_REQ = 'conversation:save:req'
export const EVT_CONVERSATION_SAVE_OK = 'conversation:save:ok'
export const EVT_CONVERSATION_SAVE_FAIL = 'conversation:save:fail'

/** 删除对话 */
export const EVT_CONVERSATION_DELETE_REQ = 'conversation:delete:req'
export const EVT_CONVERSATION_DELETE_OK = 'conversation:delete:ok'
export const EVT_CONVERSATION_DELETE_FAIL = 'conversation:delete:fail'

/** 列出对话列表 */
export const EVT_CONVERSATION_LIST_REQ = 'conversation:list:req'
export const EVT_CONVERSATION_LIST_OK = 'conversation:list:ok'
export const EVT_CONVERSATION_LIST_FAIL = 'conversation:list:fail'

/** 获取对话的最新消息（用于列表预览） */
export const EVT_CONVERSATION_LATEST_MSG_REQ = 'conversation:latest_msg:req'
export const EVT_CONVERSATION_LATEST_MSG_OK = 'conversation:latest_msg:ok'
export const EVT_CONVERSATION_LATEST_MSG_FAIL = 'conversation:latest_msg:fail'

// ============ Reactive State ============

/** 当前加载的对话文件 */
export const currentConversationFile: Ref<string | null> = ref(null)

/** 当前对话文档 */
export const currentConversationDoc: Ref<ConversationDoc | null> = ref(null)

/** 对话列表缓存 */
export const conversations: Ref<ConversationItem[]> = ref([])

/** 加载状态 */
export const loadingStates: Ref<ConversationLoadingStates> = ref({
  create: false,
  load: false,
  save: false,
  delete: false,
  list: false
})

/** 错误状态 */
export const errorStates: Ref<ConversationErrorStates> = ref({
  create: null,
  load: null,
  save: null,
  delete: null,
  list: null
})

// ============ Helper Functions ============

/**
 * 重置当前对话状态
 */
export function resetCurrentConversation(): void {
  currentConversationFile.value = null
  currentConversationDoc.value = null
}

/**
 * 清空对话列表缓存
 */
export function clearConversationsList(): void {
  conversations.value = []
}

/**
 * 重置所有状态
 */
export function resetAllConversationState(): void {
  resetCurrentConversation()
  clearConversationsList()
  
  Object.keys(loadingStates.value).forEach(key => {
    loadingStates.value[key as keyof ConversationLoadingStates] = false
  })
  
  Object.keys(errorStates.value).forEach(key => {
    errorStates.value[key as keyof ConversationErrorStates] = null
  })
}