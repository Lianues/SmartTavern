import { ref, type Ref } from 'vue'

/**
 * usePanels：右侧各功能面板开关状态的集中管理（互斥切换）
 * - 目标：用统一的 togglePanel/closeAll 替代 App.vue 中重复的内联赋值表达式
 * - 用法：
 *   import { usePanels } from '@/composables/usePanels'
 *   const {
 *     // state
 *     appearanceOpen, appSettingsOpen, presetsOpen, worldbookOpen,
 *     charactersOpen, personaOpen, regexOpen, aiConfigOpen,
 *     // actions
 *     togglePanel, closeAllPanels,
 *   } = usePanels()
 *   // 在模板事件中使用：@openAppearance="togglePanel('appearance')" 等
 */

export type PanelName = 
  | 'appearance'
  | 'appSettings'
  | 'presets'
  | 'worldbooks'
  | 'characters'
  | 'personas'
  | 'regexrules'
  | 'llmconfigs'
  | 'plugins'

export interface UsePanelsAPI {
  // state
  appearanceOpen: Ref<boolean>
  appSettingsOpen: Ref<boolean>
  presetsOpen: Ref<boolean>
  worldbooksOpen: Ref<boolean>
  charactersOpen: Ref<boolean>
  personasOpen: Ref<boolean>
  regexrulesOpen: Ref<boolean>
  llmconfigsOpen: Ref<boolean>
  pluginsOpen: Ref<boolean>
  
  // actions
  togglePanel: (name: PanelName) => void
  closeAllPanels: () => void
}

export function usePanels(): UsePanelsAPI {
  // 所有右侧抽屉型面板的开关状态
  const appearanceOpen   = ref<boolean>(false)
  const appSettingsOpen  = ref<boolean>(false)
  const presetsOpen      = ref<boolean>(false)
  const worldbooksOpen   = ref<boolean>(false)
  const charactersOpen   = ref<boolean>(false)
  const personasOpen     = ref<boolean>(false)
  const regexrulesOpen   = ref<boolean>(false)
  const llmconfigsOpen   = ref<boolean>(false)
  // 新增：插件面板
  const pluginsOpen      = ref<boolean>(false)

  // 内部帮助：关闭全部
  function closeAllPanels(): void {
    appearanceOpen.value  = false
    appSettingsOpen.value = false
    presetsOpen.value     = false
    worldbooksOpen.value  = false
    charactersOpen.value  = false
    personasOpen.value    = false
    regexrulesOpen.value  = false
    llmconfigsOpen.value  = false
    pluginsOpen.value     = false
  }

  // 互斥切换：点哪个就只保留哪个打开（再次触发同一面板则关闭）
  function togglePanel(name: PanelName): void {
    const panelMap: Record<PanelName, Ref<boolean>> = {
      appearance: appearanceOpen,
      appSettings: appSettingsOpen,
      presets: presetsOpen,
      worldbooks: worldbooksOpen,
      characters: charactersOpen,
      personas: personasOpen,
      regexrules: regexrulesOpen,
      llmconfigs: llmconfigsOpen,
      plugins: pluginsOpen,
    }

    const current = panelMap[name]

    if (!current) {
      // 未知面板名：直接关闭所有以保证一致性
      closeAllPanels()
      return
    }

    const willOpen = !current.value
    closeAllPanels()
    current.value = willOpen
  }

  return {
    // state
    appearanceOpen,
    appSettingsOpen,
    presetsOpen,
    worldbooksOpen,
    charactersOpen,
    personasOpen,
    regexrulesOpen,
    llmconfigsOpen,
    pluginsOpen,

    // actions
    togglePanel,
    closeAllPanels,
  }
}

export default usePanels