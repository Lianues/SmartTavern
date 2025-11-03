// SmartTavern Workflow - Sidebar Slot Bootstrap
// 职责：注册内置侧边栏导航项（预设/世界书/角色/用户/正则/AI配置/工作流/外观/应用设置）
// 说明：侧边栏项可由插件动态注册，此文件仅注册内置项

import { useSidebarStore } from '@/stores/workflow/sidebar'
import type { SidebarEntry } from '@/stores/workflow/sidebar'

/**
 * 注册所有内置侧边栏导航项
 * 每个项包含：id、label、icon、desc、order、actionId
 */
export function registerSidebarBuiltins(): void {
  const store = useSidebarStore()
  
  // 内置侧边栏项配置（按 order 排序）
  const builtins: SidebarEntry[] = [
    {
      id: 'presets',
      label: '预设 Presets',
      icon: 'sliders-horizontal',
      desc: '管理提示词预设与切换',
      order: 10,
      actionId: 'sidebar.panel.presets',
    },
    {
      id: 'worldbooks',
      label: '世界书 World Books',
      icon: 'book-open',
      desc: '设定世界观/术语库',
      order: 20,
      actionId: 'sidebar.panel.worldbooks',
    },
    {
      id: 'characters',
      label: '角色卡 Characters',
      icon: 'users',
      desc: '管理角色信息卡',
      order: 30,
      actionId: 'sidebar.panel.characters',
    },
    {
      id: 'personas',
      label: '用户信息 Personas',
      icon: 'user-cog',
      desc: '配置用户画像与偏好',
      order: 40,
      actionId: 'sidebar.panel.personas',
    },
    {
      id: 'regexrules',
      label: '正则 Regex Rules',
      icon: 'scan-text',
      desc: '清洗/后处理规则',
      order: 50,
      actionId: 'sidebar.panel.regexrules',
    },
    {
      id: 'llmconfigs',
      label: 'LLM配置 LLM Configs',
      icon: 'plug',
      desc: '全局AI提供商与参数',
      order: 60,
      actionId: 'sidebar.panel.llmconfigs',
    },
    {
      id: 'plugins',
      label: '插件 Plugins',
      icon: 'puzzle',
      desc: '管理前端插件',
      order: 70,
      actionId: 'sidebar.panel.plugins',
    },
    {
      id: 'appearance',
      label: '外观 Appearance',
      icon: 'palette',
      desc: '主题与外观设定',
      order: 80,
      actionId: 'sidebar.panel.appearance',
    },
    {
      id: 'app',
      label: '应用设置 App Settings',
      icon: 'settings',
      desc: '全局应用行为与高级选项',
      order: 90,
      actionId: 'sidebar.panel.app',
    },
  ]
  
  // 批量注册
  for (const item of builtins) {
    try {
      store.register(item)
    } catch (e) {
      console.warn(`[sidebar bootstrap] failed to register ${item.id}:`, e)
    }
  }
  
  console.log('[sidebar bootstrap] registered', builtins.length, 'builtin items')
}