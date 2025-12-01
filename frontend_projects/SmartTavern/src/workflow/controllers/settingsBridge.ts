/**
 * 设置管理桥接器 (Settings Bridge)
 * 
 * 监听settings通道的请求事件，调用ChatBranches服务，
 * 并将结果通过响应事件返回给组件。
 */

import * as SettingsChannel from '@/workflow/channels/settings'
import ChatBranches from '@/services/chatBranches'
import { i18n } from '@/locales'
import { useChatSettingsStore } from '@/stores/chatSettings'
import { useMessagesStore } from '@/stores/chatMessages'

// 类型定义
interface EventBus {
  on(event: string, handler: (payload: any) => void | Promise<void>): void
  emit(event: string, payload?: any): void
}

/**
 * 初始化设置管理桥接器
 * @param {EventBus} bus - 事件总线实例
 */
export function initSettingsBridge(bus: EventBus): void {
  // ===== 获取设置 =====
  bus.on(SettingsChannel.EVT_SETTINGS_GET_REQ, async (payload: any) => {
    const { conversationFile, requestId = Date.now() } = payload || {}
    
    if (!conversationFile) {
      bus.emit(SettingsChannel.EVT_SETTINGS_GET_RES, {
        requestId,
        success: false,
        error: i18n.t('workflow.controllers.settings.missingConversationFile')
      })
      return
    }
    
    try {
      SettingsChannel.setLoading(conversationFile, true)
      SettingsChannel.setError(conversationFile, null)
      
      const res = await ChatBranches.settings({
        action: 'get',
        file: conversationFile
      })
      
      const settings = res?.settings || {}
      SettingsChannel.updateSettingsCache(conversationFile, settings)
      SettingsChannel.setLoading(conversationFile, false)
      
      bus.emit(SettingsChannel.EVT_SETTINGS_GET_RES, {
        requestId,
        conversationFile,
        success: true,
        settings,
        raw: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      SettingsChannel.setError(conversationFile, errMsg)
      SettingsChannel.setLoading(conversationFile, false)
      
      bus.emit(SettingsChannel.EVT_SETTINGS_GET_RES, {
        requestId,
        conversationFile,
        success: false,
        error: errMsg
      })
    }
  })

  // ===== 更新设置 =====
  bus.on(SettingsChannel.EVT_SETTINGS_UPDATE_REQ, async (payload: any) => {
    const { conversationFile, patch, requestId = Date.now() } = payload || {}
    
    if (!conversationFile) {
      bus.emit(SettingsChannel.EVT_SETTINGS_UPDATE_RES, {
        requestId,
        success: false,
        error: i18n.t('workflow.controllers.settings.missingConversationFile')
      })
      return
    }
    
    if (!patch || typeof patch !== 'object') {
      bus.emit(SettingsChannel.EVT_SETTINGS_UPDATE_RES, {
        requestId,
        conversationFile,
        success: false,
        error: i18n.t('workflow.controllers.settings.missingOrInvalidPatch')
      })
      return
    }
    
    try {
      SettingsChannel.setLoading(conversationFile, true)
      SettingsChannel.setError(conversationFile, null)
      
      const res = await ChatBranches.settings({
        action: 'update',
        file: conversationFile,
        patch
      })
      
      // 更新本地缓存
      SettingsChannel.updateSettingsCache(conversationFile, patch)
      SettingsChannel.setLoading(conversationFile, false)
      
      // 同步刷新 chatSettings store（如果是当前对话）
      try {
        const messagesStore = useMessagesStore()
        if (messagesStore.conversationFile === conversationFile) {
          const chatSettingsStore = useChatSettingsStore()
          await chatSettingsStore.refresh()
          console.log('[SettingsBridge] 已刷新 chatSettings store')
        }
      } catch (err) {
        console.warn('[SettingsBridge] 刷新 chatSettings store 失败:', err)
      }
      
      bus.emit(SettingsChannel.EVT_SETTINGS_UPDATE_RES, {
        requestId,
        conversationFile,
        success: true,
        patch,
        raw: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      SettingsChannel.setError(conversationFile, errMsg)
      SettingsChannel.setLoading(conversationFile, false)
      
      bus.emit(SettingsChannel.EVT_SETTINGS_UPDATE_RES, {
        requestId,
        conversationFile,
        success: false,
        error: errMsg
      })
    }
  })

  console.log('[SettingsBridge] 设置管理桥接器已初始化')
}