/**
 * 对话生命周期桥接器 (Conversation Bridge)
 * 
 * 监听 conversation 通道的请求事件，调用 ChatBranches 和 DataCatalog 服务，
 * 并将结果通过响应事件返回给组件。
 */

import * as ConversationChannel from '@/workflow/channels/conversation'
import ChatBranches from '@/services/chatBranches'
import DataCatalog from '@/services/dataCatalog'

// 类型定义
interface EventBus {
  on(event: string, handler: (payload: any) => void | Promise<void>): void
  emit(event: string, payload?: any): void
}

/**
 * 初始化对话生命周期桥接器
 * @param {EventBus} bus - 事件总线实例
 */
export function initConversationBridge(bus: EventBus): void {
  // ===== 创建对话 =====
  bus.on(ConversationChannel.EVT_CONVERSATION_CREATE_REQ, async (payload: any) => {
    const { tag, ...createPayload } = payload || {}
    
    try {
      ConversationChannel.loadingStates.value.create = true
      ConversationChannel.errorStates.value.create = null
      
      const res = await ChatBranches.createConversation(createPayload)
      
      ConversationChannel.loadingStates.value.create = false
      
      bus.emit(ConversationChannel.EVT_CONVERSATION_CREATE_OK, {
        tag,
        file: res?.file,
        doc: res?.doc,
        result: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      ConversationChannel.errorStates.value.create = errMsg
      ConversationChannel.loadingStates.value.create = false
      
      bus.emit(ConversationChannel.EVT_CONVERSATION_CREATE_FAIL, {
        tag,
        message: errMsg
      })
    }
  })

  // ===== 加载对话详情 =====
  bus.on(ConversationChannel.EVT_CONVERSATION_LOAD_REQ, async (payload: any) => {
    const { file, tag, useCache } = payload || {}
    
    try {
      ConversationChannel.loadingStates.value.load = true
      ConversationChannel.errorStates.value.load = null
      
      const result = await DataCatalog.getConversationDetail(file, { useCache: useCache ?? false })
      
      // 更新当前对话状态
      ConversationChannel.currentConversationFile.value = file
      ConversationChannel.currentConversationDoc.value = result
      ConversationChannel.loadingStates.value.load = false
      
      bus.emit(ConversationChannel.EVT_CONVERSATION_LOAD_OK, {
        tag,
        file,
        doc: result
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      ConversationChannel.errorStates.value.load = errMsg
      ConversationChannel.loadingStates.value.load = false
      
      bus.emit(ConversationChannel.EVT_CONVERSATION_LOAD_FAIL, {
        tag,
        file,
        message: errMsg
      })
    }
  })

  // ===== 保存对话 =====
  bus.on(ConversationChannel.EVT_CONVERSATION_SAVE_REQ, async (payload: any) => {
    const { file, doc, tag } = payload || {}

    try {
      ConversationChannel.loadingStates.value.save = true
      ConversationChannel.errorStates.value.save = null

      const res = await ChatBranches.saveConversation(file, doc)

      // 更新当前对话文档
      if (ConversationChannel.currentConversationFile.value === file) {
        ConversationChannel.currentConversationDoc.value = doc
      }

      ConversationChannel.loadingStates.value.save = false

      bus.emit(ConversationChannel.EVT_CONVERSATION_SAVE_OK, {
        tag,
        file,
        doc,
        result: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      ConversationChannel.errorStates.value.save = errMsg
      ConversationChannel.loadingStates.value.save = false

      bus.emit(ConversationChannel.EVT_CONVERSATION_SAVE_FAIL, {
        tag,
        file,
        message: errMsg
      })
    }
  })

  // ===== 删除对话 =====
  bus.on(ConversationChannel.EVT_CONVERSATION_DELETE_REQ, async (payload: any) => {
    const { file, tag } = payload || {}

    try {
      ConversationChannel.loadingStates.value.delete = true
      ConversationChannel.errorStates.value.delete = null

      const res = await ChatBranches.deleteConversation(file)

      // 如果删除的是当前对话，清空当前状态
      if (ConversationChannel.currentConversationFile.value === file) {
        ConversationChannel.resetCurrentConversation()
      }

      ConversationChannel.loadingStates.value.delete = false

      bus.emit(ConversationChannel.EVT_CONVERSATION_DELETE_OK, {
        tag,
        file,
        result: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      ConversationChannel.errorStates.value.delete = errMsg
      ConversationChannel.loadingStates.value.delete = false

      bus.emit(ConversationChannel.EVT_CONVERSATION_DELETE_FAIL, {
        tag,
        file,
        message: errMsg
      })
    }
  })

  // ===== 列出对话列表 =====
  bus.on(ConversationChannel.EVT_CONVERSATION_LIST_REQ, async (payload: any) => {
    const { tag } = payload || {}
    
    try {
      ConversationChannel.loadingStates.value.list = true
      ConversationChannel.errorStates.value.list = null
      
      const res = await DataCatalog.listConversations()
      const items = Array.isArray(res?.items) ? res.items : []
      
      ConversationChannel.conversations.value = items as any
      ConversationChannel.loadingStates.value.list = false
      
      bus.emit(ConversationChannel.EVT_CONVERSATION_LIST_OK, {
        tag,
        items,
        raw: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      ConversationChannel.errorStates.value.list = errMsg
      ConversationChannel.loadingStates.value.list = false
      
      bus.emit(ConversationChannel.EVT_CONVERSATION_LIST_FAIL, {
        tag,
        message: errMsg
      })
    }
  })

  // ===== 获取最新消息（用于列表预览） =====
  bus.on(ConversationChannel.EVT_CONVERSATION_LATEST_MSG_REQ, async (payload: any) => {
    const { file, tag, useCache } = payload || {}
    
    try {
      const latest = await ChatBranches.getLatestMessageByFile(file, { useCache: useCache ?? false })
      
      bus.emit(ConversationChannel.EVT_CONVERSATION_LATEST_MSG_OK, {
        tag,
        file,
        latest
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      
      bus.emit(ConversationChannel.EVT_CONVERSATION_LATEST_MSG_FAIL, {
        tag,
        file,
        message: errMsg
      })
    }
  })

  console.log('[ConversationBridge] 对话生命周期桥接器已初始化（含最新消息查询）')
}