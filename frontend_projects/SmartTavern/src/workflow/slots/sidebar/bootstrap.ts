// SmartTavern Workflow - Sidebar Slot Bootstrap
// 职责：注册内置侧边栏导航项（预设/世界书/角色/用户/正则/AI配置/工作流/外观/应用设置）
// 说明：侧边栏项可由插件动态注册，此文件仅注册内置项
// 注意：使用 labelKey/descKey 而非直接翻译，支持语言切换时动态更新

import { useSidebarStore } from '@/stores/workflow/sidebar'
import type { SidebarEntry } from '@/stores/workflow/sidebar'

/**
 * 注册所有内置侧边栏导航项
 * 每个项包含：id、label、labelKey、icon、desc、descKey、order、actionId
 * 使用 labelKey/descKey 存储翻译 key，由渲染组件动态翻译
 */
export function registerSidebarBuiltins(): void {
  const store = useSidebarStore()
  
  // 内置侧边栏项配置（按 order 排序）
  // 使用 labelKey/descKey 替代静态翻译，实现语言切换时动态更新
  const builtins: SidebarEntry[] = [
    {
      id: 'presets',
      label: 'Presets',  // fallback
      labelKey: 'slots.sidebar.presets.label',
      icon: 'sliders-horizontal',
      desc: 'Manage prompt presets',  // fallback
      descKey: 'slots.sidebar.presets.desc',
      order: 10,
      actionId: 'sidebar.panel.presets',
    },
    {
      id: 'worldbooks',
      label: 'World Books',
      labelKey: 'slots.sidebar.worldbooks.label',
      icon: 'book-open',
      desc: 'Define world lore',
      descKey: 'slots.sidebar.worldbooks.desc',
      order: 20,
      actionId: 'sidebar.panel.worldbooks',
    },
    {
      id: 'characters',
      label: 'Characters',
      labelKey: 'slots.sidebar.characters.label',
      icon: 'users',
      desc: 'Manage character cards',
      descKey: 'slots.sidebar.characters.desc',
      order: 30,
      actionId: 'sidebar.panel.characters',
    },
    {
      id: 'personas',
      label: 'Personas',
      labelKey: 'slots.sidebar.personas.label',
      icon: 'user-cog',
      desc: 'Configure user profiles',
      descKey: 'slots.sidebar.personas.desc',
      order: 40,
      actionId: 'sidebar.panel.personas',
    },
    {
      id: 'regexrules',
      label: 'Regex Rules',
      labelKey: 'slots.sidebar.regexrules.label',
      icon: 'scan-text',
      desc: 'Text processing rules',
      descKey: 'slots.sidebar.regexrules.desc',
      order: 50,
      actionId: 'sidebar.panel.regexrules',
    },
    {
      id: 'llmconfigs',
      label: 'LLM Configs',
      labelKey: 'slots.sidebar.llmconfigs.label',
      icon: 'plug',
      desc: 'AI providers & parameters',
      descKey: 'slots.sidebar.llmconfigs.desc',
      order: 60,
      actionId: 'sidebar.panel.llmconfigs',
    },
    {
      id: 'plugins',
      label: 'Plugins',
      labelKey: 'slots.sidebar.plugins.label',
      icon: 'puzzle',
      desc: 'Manage plugins',
      descKey: 'slots.sidebar.plugins.desc',
      order: 70,
      actionId: 'sidebar.panel.plugins',
    },
    {
      id: 'appearance',
      label: 'Appearance',
      labelKey: 'slots.sidebar.appearance.label',
      icon: 'palette',
      desc: 'Theme & visual settings',
      descKey: 'slots.sidebar.appearance.desc',
      order: 80,
      actionId: 'sidebar.panel.appearance',
    },
    {
      id: 'app',
      label: 'App Settings',
      labelKey: 'slots.sidebar.app.label',
      icon: 'settings',
      desc: 'Global app behavior',
      descKey: 'slots.sidebar.app.desc',
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