/**
 * SmartTavern Appearance Settings Store
 * 用于管理全局外观设置（时区、日期时间格式等）
 * 支持响应式更新和 LocalStorage 持久化
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// 日期时间格式选项类型
export type DateTimeFormatOption = 
  | 'YYYY-MM-DD HH:mm'           // ISO 24h (中国常用)
  | 'YYYY-MM-DD hh:mm A'         // ISO 12h
  | 'MM/DD/YYYY HH:mm'           // US 24h
  | 'MM/DD/YYYY hh:mm A'         // US 12h (美国常用)
  | 'DD/MM/YYYY HH:mm'           // EU 24h
  | 'DD/MM/YYYY hh:mm A'         // EU 12h
  | 'YYYY年MM月DD日 HH:mm'       // CN 24h
  | 'YYYY年MM月DD日 hh:mm A'     // CN 12h

const STORE_KEY = 'st.appearance.settings'

interface AppearanceSettings {
  timezone: string
  dateTimeFormat: DateTimeFormatOption
  messageSidebarWidth: number
  iframeRenderMode: string
  iframeRenderRange: number
}

export const useAppearanceSettingsStore = defineStore('appearanceSettings', () => {
  // 时区设置（默认使用浏览器时区）
  const timezone = ref<string>(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  
  // 日期时间显示格式（默认 ISO 24小时制）
  const dateTimeFormat = ref<DateTimeFormatOption>('YYYY-MM-DD HH:mm')
  
  // 消息侧边栏宽度（单位：px，默认 80px）
  const messageSidebarWidth = ref<number>(80)
  
  // iframe 渲染优化配置
  const iframeRenderMode = ref<string>('all')  // 'all' | 'track_latest' | 'track_viewport'
  const iframeRenderRange = ref<number>(10)    // 渲染层数范围
  
  /**
   * 从 LocalStorage 加载设置
   */
  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORE_KEY)
      if (saved) {
        const settings: AppearanceSettings = JSON.parse(saved)
        if (settings.timezone) timezone.value = settings.timezone
        if (settings.dateTimeFormat) dateTimeFormat.value = settings.dateTimeFormat
        if (settings.messageSidebarWidth) messageSidebarWidth.value = settings.messageSidebarWidth
        if (settings.iframeRenderMode) iframeRenderMode.value = settings.iframeRenderMode
        if (settings.iframeRenderRange) iframeRenderRange.value = settings.iframeRenderRange
      }
    } catch (e) {
      console.warn('Failed to load appearance settings from localStorage:', e)
    }
  }
  
  /**
   * 保存设置到 LocalStorage
   */
  function saveToStorage() {
    try {
      const settings: AppearanceSettings = {
        timezone: timezone.value,
        dateTimeFormat: dateTimeFormat.value,
        messageSidebarWidth: messageSidebarWidth.value,
        iframeRenderMode: iframeRenderMode.value,
        iframeRenderRange: iframeRenderRange.value,
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(settings))
    } catch (e) {
      console.warn('Failed to save appearance settings to localStorage:', e)
    }
  }
  
  /**
   * 更新时区设置
   */
  function setTimezone(tz: string) {
    timezone.value = tz
  }
  
  /**
   * 更新日期时间格式
   */
  function setDateTimeFormat(format: DateTimeFormatOption) {
    dateTimeFormat.value = format
  }
  
  /**
   * 更新消息侧边栏宽度
   */
  function setMessageSidebarWidth(width: number) {
    messageSidebarWidth.value = width
  }
  
  /**
   * 更新 iframe 渲染模式
   */
  function setIframeRenderMode(mode: string) {
    iframeRenderMode.value = mode
  }
  
  /**
   * 更新 iframe 渲染范围
   */
  function setIframeRenderRange(range: number) {
    iframeRenderRange.value = range
  }
  
  // 监听设置变化，自动保存
  watch([timezone, dateTimeFormat, messageSidebarWidth, iframeRenderMode, iframeRenderRange], () => {
    saveToStorage()
  })
  
  // 初始化时加载设置
  loadFromStorage()
  
  return {
    // State
    timezone,
    dateTimeFormat,
    messageSidebarWidth,
    iframeRenderMode,
    iframeRenderRange,
    
    // Actions
    setTimezone,
    setDateTimeFormat,
    setMessageSidebarWidth,
    setIframeRenderMode,
    setIframeRenderRange,
    loadFromStorage,
    saveToStorage,
  }
})