<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import SidebarNav from '@/components/sidebar/SidebarNav.vue'
import { watch } from 'vue'
import SidebarDrawer from '@/components/sidebar/SidebarDrawer.vue'
import AppearancePanel from '@/components/sidebar/AppearancePanel.vue'
import AppSettingsPanel from '@/components/sidebar/AppSettingsPanel.vue'
import PresetsPanel from '@/components/sidebar/PresetsPanel.vue'
import WorldBooksPanel from '@/components/sidebar/WorldBooksPanel.vue'
import CharactersPanel from '@/components/sidebar/CharactersPanel.vue'
import PersonasPanel from '@/components/sidebar/PersonasPanel.vue'
import RegexRulesPanel from '@/components/sidebar/RegexRulesPanel.vue'
import LLMConfigsPanel from '@/components/sidebar/LLMConfigsPanel.vue'
import PluginsPanel from '@/components/sidebar/PluginsPanel.vue'
import ContentViewModal from '@/components/common/ContentViewModal.vue'
import PresetDetailView from '@/components/content/PresetDetailView.vue'
import WorldBookDetailView from '@/components/content/WorldBookDetailView.vue'
import CharacterDetailView from '@/components/content/CharacterDetailView.vue'
import PersonaDetailView from '@/components/content/PersonaDetailView.vue'
import RegexRuleDetailView from '@/components/content/RegexRuleDetailView.vue'
import LLMConfigDetailView from '@/components/content/LLMConfigDetailView.vue'
import NewChatModal from '@/components/home/NewChatModal.vue'
import LoadGameModal from '@/components/home/LoadGameModal.vue'
import AppearanceModal from '@/components/home/AppearanceModal.vue'
import PluginsModal from '@/components/home/PluginsModal.vue'
import OptionsModal from '@/components/home/OptionsModal.vue'
import AppShell from '@/layouts/AppShell.vue'
import { useHomeMenuInk } from '@/composables/useHomeMenuInk'
import { useBackgroundFx } from '@/composables/useBackgroundFx'
import { useSidebar } from '@/composables/useSidebar'
import { usePanels } from '@/composables/usePanels'
import { useHomeModal } from '@/composables/useHomeModal'
import { useThemeMode } from '@/composables/useThemeMode'
import { useUiAssets } from '@/composables/useUiAssets'
import { useViewModal } from '@/composables/useViewModal'
import StartView from '@/views/StartView.vue'
import ThreadedView from '@/views/ThreadedView.vue'
import SandboxView from '@/views/SandboxView.vue'
import { useNewGame } from '@/composables/useNewGame'
import ToastsOverlay from '@/components/common/ToastsOverlay.vue'
import OptionsPanel from '@/components/common/OptionsPanel.vue'
import LoadingOverlay from '@/components/common/LoadingOverlay.vue'
import Host from '@/workflow/core/host'
import * as Chat from '@/workflow/channels/chat'
import * as Conversation from '@/workflow/channels/conversation'
import { useI18n } from '@/locales'
import useAppearanceThreaded from '@/composables/appearance/useAppearanceThreaded'
import useAppearanceSandbox from '@/composables/appearance/useAppearanceSandbox'
import StylesService from '@/services/stylesService'
import ThemeManager from '@/features/themes/manager'

const { t } = useI18n()

// 外观设置 composables - 在应用启动时初始化
const appearanceThreaded = useAppearanceThreaded()
const appearanceSandbox = useAppearanceSandbox()
import { useMessagesStore } from '@/stores/chatMessages'
import { useChatSettingsStore, registerGlobalFunctions as registerChatSettingsFunctions } from '@/stores/chatSettings'
import { useCharacterStore, registerGlobalFunctions as registerCharacterFunctions } from '@/stores/character'
import { usePersonaStore, registerGlobalFunctions as registerPersonaFunctions } from '@/stores/persona'
import { useChatVariablesStore, registerGlobalFunctions as registerVariablesFunctions } from '@/stores/chatVariables'
import { useLlmConfigStore, registerGlobalFunctions as registerLlmConfigFunctions } from '@/stores/llmConfig'
import { usePresetStore, registerGlobalFunctions as registerPresetFunctions } from '@/stores/preset'
import { useWorldBooksStore, registerGlobalFunctions as registerWorldBooksFunctions } from '@/stores/worldBooks'
import { useRegexRulesStore, registerGlobalFunctions as registerRegexRulesFunctions } from '@/stores/regexRules'
import { registerGlobalFunctions as registerToastFunctions } from '@/stores/workflow/toasts'
import { registerGlobalFunctions as registerOptionsFunctions } from '@/stores/workflow/options'
import { chatCompletion, chatCompletionWithCurrentConfig } from '@/services/chatCompletionService'
import {
  assemblePrompt,
  assemblePromptWithCurrentConfig,
  postprocessPrompt,
  postprocessPromptWithCurrentConfig
} from '@/services/promptService'
import {
  routePromptWithHooks,
  completeWithHooks
} from '@/services/routerService'

/**
 * 单一路径（/）下的多视图切换
 * - start：开始页（不显示侧边栏）
 * - threaded：对话楼层预览（显示侧边栏）
 * - sandbox：全局沙盒占位（显示侧边栏）
 * 解耦策略：
 * - 将侧边栏的显示与否与视图状态解耦，仅关心布尔：showSidebar
 * - 侧边栏每个项拆分在 SidebarNav 子组件中，避免臃肿
 * - 模式切换抽象为 ModeSwitch 组件（后续可独立成文件）
 */
const view = ref('start')
const showSidebar = computed(() => view.value !== 'start')
const { drawerOpen } = useSidebar()
const { appearanceOpen, appSettingsOpen, presetsOpen, worldbooksOpen, charactersOpen, personasOpen, regexrulesOpen, llmconfigsOpen, pluginsOpen, togglePanel, closeAllPanels } = usePanels()

// 加载状态：用于显示加载动画
const isLoading = ref(false)
const loadingMessage = ref('')

// 右侧列表面板是否有任一打开（用于显示半透明遮罩：浅色=白、深色=黑）
const anyPanelOpen = computed(() =>
  showSidebar.value && (
    appearanceOpen.value ||
    appSettingsOpen.value ||
    presetsOpen.value ||
    worldbooksOpen.value ||
    charactersOpen.value ||
    personasOpen.value ||
    regexrulesOpen.value ||
    llmconfigsOpen.value ||
    pluginsOpen.value
  )
)

const { updateHomeMenuInk } = useHomeMenuInk(() => view.value === 'start')
const { playHomeBgFX, playThreadedBgFX, playSandboxBgFX } = useBackgroundFx()

 const {
   viewModalOpen,
   viewModalTitle,
   viewModalType,
   viewModalData,
   viewModalLoading,
   viewModalError,
   viewModalFile,
   currentPresetData,
   openViewModal,
   closeViewModal,
 } = useViewModal()

 // 主页功能模态（Load / Gallery / Options）
 const { homeModalOpen, homeModalTitle, homeModalType, openHomeModal, closeHomeModal } = useHomeModal()

 // 主题模式：system/dark/light（跟随系统 + 持久化 + 同步 ThemeManager）
 const { theme, initTheme, onThemeUpdate: __onThemeUpdateMode, applyTheme } = useThemeMode()
 // UI 资产（图标/Flowbite）加载与刷新
 const { ensureUIAssets, refreshIcons } = useUiAssets()

 /* New Game 模态：新建对话（组合式 useNewGame 管理表单状态与行为） */
 const { newGameOpen, openNewGame, cancelNewGame, onNewChatConfirm: onNewChatConfirmRaw } = useNewGame({
   setView: (v) => { if (v === 'threaded' || v === 'sandbox' || v === 'start') { view.value = v } },
   refreshIcons,
 })

// 当侧边栏抽屉关闭时，同步关闭右侧“应用设置”面板，保持同层同生命周期
watch(drawerOpen, (v) => {
  if (!v) {
    closeAllPanels()
  }
})

/* 监听视图切换，start/threaded/sandbox 统一景深+焦点动画 */
watch(view, (v) => {
  document.body.dataset.home = (v === 'start' ? 'plain' : '')
  if (v === 'start') {
    nextTick(() => { updateHomeMenuInk(); playHomeBgFX() })
  } else if (v === 'threaded') {
    nextTick(() => { playThreadedBgFX() })
  } else if (v === 'sandbox') {
    nextTick(() => { playSandboxBgFX() })
  }
  if (v !== 'start') {
    // 离开主页时关闭主页相关模态
    homeModalOpen.value = false
    homeModalType.value = ''
    homeModalTitle.value = ''
  }
})

/* HomeMenu 智能前景色逻辑已抽离至 useHomeMenuInk 组合式 */

/* 背景动画逻辑已抽离至 useBackgroundFx 组合式 */



 // 消息双状态管理：通过 Pinia Store 管理原始/视图消息
 const messagesStore = useMessagesStore()
 const chatSettingsStore = useChatSettingsStore()
 const characterStore = useCharacterStore()
 const personaStore = usePersonaStore()
 const variablesStore = useChatVariablesStore()
 const llmConfigStore = useLlmConfigStore()
 const presetStore = usePresetStore()
 const worldBooksStore = useWorldBooksStore()
 const regexRulesStore = useRegexRulesStore()
 
 // 楼层对话消息（legacy占位，不再直接使用，改为通过 messagesStore.rawMessages）
 const currentThreadMessages = ref([])
 
 // 当前打开的对话文件路径（用于侧边栏settings联动）
 const currentConversationFile = ref(null)
 
 // 当前对话的完整文档（用于消息操作）
 const currentConversationDoc = ref(null)
 
 // 待切换的目标视图（等待iframe加载完成后再真正切换）
 const pendingView = ref(null)
 
 // 工作流 Chat 渠道事件的 off 收集器（组件卸载时统一清理）
 const __chatOffs = []


onMounted(async () => {
  initTheme()
  
  // 初始化全局 UI 缩放
  try {
    const savedScale = localStorage.getItem('st.ui_scale')
    if (savedScale) {
      const scale = parseFloat(savedScale)
      if (!isNaN(scale) && scale >= 0.5 && scale <= 2.0) {
        document.documentElement.style.zoom = String(scale)
        document.documentElement.style.setProperty('--st-ui-scale', String(scale))
      }
    }
  } catch (_) {}
  
  // 在应用启动时立即加载外观设置（从 localStorage 恢复）
  try { appearanceThreaded.initFromCSS() } catch (_) {}
  try { appearanceSandbox.initFromCSS() } catch (_) {}
  
  // 验证主题列表并自动同步
  try { await verifyAndSyncThemes() } catch (e) {
    console.warn('[App] Failed to verify themes:', e)
  }
  
  try { registerChatSettingsFunctions({ exposeToWindow: true }) } catch (_) {}
  try { registerCharacterFunctions({ exposeToWindow: true }) } catch (_) {}
  try { registerPersonaFunctions({ exposeToWindow: true }) } catch (_) {}
  try { registerVariablesFunctions({ exposeToWindow: true }) } catch (_) {}
  try { registerLlmConfigFunctions({ exposeToWindow: true }) } catch (_) {}
  try { registerPresetFunctions({ exposeToWindow: true }) } catch (_) {}
  try { registerWorldBooksFunctions({ exposeToWindow: true }) } catch (_) {}
  try { registerRegexRulesFunctions({ exposeToWindow: true }) } catch (_) {}
  try { registerToastFunctions({ exposeToWindow: true }) } catch (_) {}
  try { registerOptionsFunctions({ exposeToWindow: true }) } catch (_) {}
  
  // 注册聊天补全全局函数
  try {
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'chatCompletion', {
        value: chatCompletion,
        writable: false,
        configurable: true
      })
      Object.defineProperty(window, 'chatCompletionWithCurrentConfig', {
        value: chatCompletionWithCurrentConfig,
        writable: false,
        configurable: true
      })
    }
  } catch (_) {}
  
  // 注册提示词装配和后处理全局函数
  try {
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'assemblePrompt', {
        value: assemblePrompt,
        writable: false,
        configurable: true
      })
      Object.defineProperty(window, 'assemblePromptWithCurrentConfig', {
        value: assemblePromptWithCurrentConfig,
        writable: false,
        configurable: true
      })
      Object.defineProperty(window, 'postprocessPrompt', {
        value: postprocessPrompt,
        writable: false,
        configurable: true
      })
      Object.defineProperty(window, 'postprocessPromptWithCurrentConfig', {
        value: postprocessPromptWithCurrentConfig,
        writable: false,
        configurable: true
      })
    }
  } catch (_) {}
  
  // 注册带 Router Hook 的提示词处理和 AI 调用全局函数
  try {
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'routePromptWithHooks', {
        value: routePromptWithHooks,
        writable: false,
        configurable: true
      })
      Object.defineProperty(window, 'completeWithHooks', {
        value: completeWithHooks,
        writable: false,
        configurable: true
      })
    }
  } catch (_) {}

  ensureUIAssets().finally(() => {
    try {
      if (view.value === 'start') {
        updateHomeMenuInk()
        playHomeBgFX()
      } else if (view.value === 'threaded') {
        playThreadedBgFX()
      } else if (view.value === 'sandbox') {
        playSandboxBgFX()
      }
    } catch (_) {}
  })
  // 主页（start-view）时让 body 完全透明，避免白色半透明底
  document.body.dataset.home = (view.value === 'start' ? 'plain' : '')

  // 订阅侧边栏面板事件（动态注册机制）
  __chatOffs.push(Host.events.on('sidebar.panel.presets', () => togglePanel('presets')))
  __chatOffs.push(Host.events.on('sidebar.panel.worldbooks', () => togglePanel('worldbooks')))
  __chatOffs.push(Host.events.on('sidebar.panel.characters', () => togglePanel('characters')))
  __chatOffs.push(Host.events.on('sidebar.panel.personas', () => togglePanel('personas')))
  __chatOffs.push(Host.events.on('sidebar.panel.regexrules', () => togglePanel('regexrules')))
  __chatOffs.push(Host.events.on('sidebar.panel.llmconfigs', () => togglePanel('llmconfigs')))
  __chatOffs.push(Host.events.on('sidebar.panel.plugins', () => togglePanel('plugins')))
  __chatOffs.push(Host.events.on('sidebar.panel.appearance', () => togglePanel('appearance')))
  __chatOffs.push(Host.events.on('sidebar.panel.app', () => togglePanel('appSettings')))

  // 订阅 Chat 工作流标准事件（channels/chat.js）
  __chatOffs.push(Host.events.on(Chat.EVT_OPEN_NEW_CHAT, () => {
    try { openNewGame() } catch (_) {}
  }))
  __chatOffs.push(Host.events.on(Chat.EVT_OPEN_LOAD, () => {
    try { openHomeModal('load') } catch (_) {}
  }))
  __chatOffs.push(Host.events.on(Chat.EVT_CHAT_LOAD_REQ, async (payload) => {
    try {
      if (payload && payload.file) {
        await onLoadGameConfirm(payload.file)
        try { Host.events.emit(Chat.EVT_CHAT_LOAD_OK, { file: payload.file }) } catch (_) {}
        try { Host.pushToast?.({ type: 'success', message: t('app.toast.loadSuccess'), timeout: 2000 }) } catch (_) {}
      } else {
        openHomeModal('load')
      }
    } catch (e) {
      try { Host.events.emit(Chat.EVT_CHAT_LOAD_FAIL, { error: String(e), detail: e }) } catch (_) {}
      try { Host.pushToast?.({ type: 'error', message: t('app.toast.loadFailed'), timeout: 2500 }) } catch (_) {}
    }
  }))
  __chatOffs.push(Host.events.on(Chat.EVT_CHAT_CREATE_REQ, async (payload) => {
    // 现阶段：统一打开“新建对话”模态，由用户确认；后续可扩展直接创建并发出 *_OK/*_FAIL
    try {
      openNewGame()
    } catch (e) {
      try { Host.events.emit(Chat.EVT_CHAT_CREATE_FAIL, { error: String(e), detail: e }) } catch (_) {}
    }
  }))
})
 
// 卸载清理工作流事件订阅
onUnmounted(() => {
  try {
    __chatOffs.forEach(fn => { try { fn?.() } catch (_) {} })
  } finally {
    __chatOffs.length = 0
  }
})

function onThemeUpdate(t) {
  __onThemeUpdateMode(t)
  refreshIcons()
}

// 仅允许返回主页，不允许在 threaded/sandbox 之间切换
function onSidebarViewUpdate(v) {
  if (v === 'start') {
    view.value = 'start'
    refreshIcons()
  }
  // 忽略其他视图切换请求
}

/**
 * 处理 LoadGame 的确认（事件驱动）：
 * - 发送 EVT_CONVERSATION_LOAD_REQ 事件请求加载对话
 * - 监听加载结果事件并更新状态
 * - 根据 active_path 提取并显示消息
 */
async function onLoadGameConfirm(file) {
  try {
    isLoading.value = true
    loadingMessage.value = t('app.loading.conversation')
    
    const tag = `load_${Date.now()}`
    
    // 监听加载结果（一次性）
    const offOk = Host.events.on(Conversation.EVT_CONVERSATION_LOAD_OK, ({ file: resFile, doc, tag: resTag }) => {
      if (resFile !== file || resTag !== tag) return
      
      try {
        if (!doc) {
            throw new Error(t('app.error.getContentFailed'))
          }
        
        // 后端API返回的数据结构：{ file, name, description, content: { nodes, children, active_path, ... } }
        // 需要从 content 字段中提取对话数据
        const conversationContent = doc.content || doc
        const nodes = conversationContent.nodes || {}
        const activePath = Array.isArray(conversationContent.active_path) ? conversationContent.active_path : []
        
        // 根据 active_path 提取消息
        const mapped = activePath.map((nodeId, idx) => {
          const node = nodes[nodeId] || {}
          const msg = {
            id: nodeId, // 使用节点ID作为消息ID
            role: node.role || 'system',
            content: node.content || ''
          }
          // 添加节点更新时间
          if (node.node_updated_at) {
            msg.node_updated_at = node.node_updated_at
          }
          return msg
        })
        
        // 更新状态（改为通过 Pinia Store 管理并自动处理 user_view）
        messagesStore.loadConversation(
          file,
          mapped.length ? mapped : [{ id: 'empty', role: 'system', content: t('app.empty.conversation') }]
        )
        currentConversationFile.value = file
        currentConversationDoc.value = conversationContent // 保存对话内容部分（而非完整响应）
        
        // 异步加载配置和数据
        ;(async () => {
          // 初次加载后立即按照原始消息计算 user_view 显示（响应式链条起点）
          // processMessagesView 会自动广播 variables 到 chatVariables store
          try { await messagesStore.processMessagesView?.() } catch (_) {}
          // 加载 chatSettings，其他 stores 通过 watch 自动监听并响应
          try { await chatSettingsStore.loadSettings() } catch (_) {}
          
          // 从 chatSettings 中读取对话类型，设置为待切换的目标视图
          // 但暂不切换，等待 iframe 加载完成后再切换
          const convType = chatSettingsStore.type || 'threaded'
          pendingView.value = convType === 'sandbox' ? 'sandbox' : 'threaded'
          
          nextTick(() => {
            refreshIcons()
          })
        })()
        
        closeHomeModal()
        drawerOpen.value = false // 加载对话后收起侧边栏
      } catch (e) {
        console.error(t('app.error.loadFailed') + ':', e)
        isLoading.value = false
        loadingMessage.value = ''
        closeHomeModal()
      } finally {
        try { offOk?.() } catch (_) {}
        try { offFail?.() } catch (_) {}
      }
    })
    
    const offFail = Host.events.on(Conversation.EVT_CONVERSATION_LOAD_FAIL, ({ file: resFile, message, tag: resTag }) => {
      if (resFile && resFile !== file) return
      if (resTag && resTag !== tag) return
      
      console.error(t('app.error.loadFailed') + ':', message)
      isLoading.value = false
      loadingMessage.value = ''
      closeHomeModal()
      try { offOk?.() } catch (_) {}
      try { offFail?.() } catch (_) {}
    })
    
    __chatOffs.push(offOk, offFail)
    
    // 发送加载请求事件
    Host.events.emit(Conversation.EVT_CONVERSATION_LOAD_REQ, {
      file,
      useCache: false,
      tag
    })
  } catch (e) {
    console.error(t('app.error.loadFailed') + ':', e)
    isLoading.value = false
    loadingMessage.value = ''
    closeHomeModal()
  }
}

/**
 * 处理 NewGame 的确认：
 * - 若后端已返回 file，则加载该对话并根据 type 切换到对应视图
 * - threaded 类型切换到 threaded 视图
 * - sandbox 类型切换到 sandbox 视图
 * - 否则退回 useNewGame 的默认行为（只切视图）
 */
async function onNewChatConfirm(payload) {
  try {
    if (payload?.file) {
      await onLoadGameConfirm(payload.file)
    } else {
      onNewChatConfirmRaw(payload)
    }
  } catch (e) {
    console.error(t('app.error.createFailed') + ':', e)
    // 兜底：仍然按原逻辑切换视图
    onNewChatConfirmRaw(payload)
  }
}

// 计算详情弹窗标题
function getDetailTitle(type, key) {
  const titleMap = {
    preset: 'app.detail.preset',
    worldbook: 'app.detail.worldbook',
    character: 'app.detail.character',
    persona: 'app.detail.persona',
    regex: 'app.detail.regex',
    aiconfig: 'app.detail.aiconfig',
  }
  const titleKey = titleMap[type]
  return titleKey ? t(titleKey, { name: key }) : key
}

/**
 * ThreadedView准备完成（iframe已加载）
 */
function onThreadedViewReady() {
  if (pendingView.value === 'threaded') {
    view.value = 'threaded'
    pendingView.value = null
    nextTick(() => {
      refreshIcons()
    })
  }
}

/**
 * SandboxView准备完成
 */
function onSandboxViewReady() {
  if (pendingView.value === 'sandbox') {
    view.value = 'sandbox'
    pendingView.value = null
    nextTick(() => {
      refreshIcons()
    })
  }
}

/**
 * 验证主题列表并自动同步
 *
 * 流程：
 * 1. 从 localStorage 读取上次缓存的 enabled 列表
 * 2. 从后端获取最新的 enabled 列表
 * 3. 直接比较两个数组是否相同
 * 4. 如果不同，重新加载并应用所有启用的主题
 */
async function verifyAndSyncThemes() {
  const CACHE_KEY = 'st.themes.enabled_cache'
  
  try {
    // 1. 获取后端最新的 enabled 列表
    const switchData = await StylesService.getStylesSwitch()
    const backendEnabled = Array.isArray(switchData.enabled) ? switchData.enabled : []
    
    // 2. 读取本地缓存的 enabled 列表
    let cachedEnabled = []
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        cachedEnabled = JSON.parse(cached)
        if (!Array.isArray(cachedEnabled)) cachedEnabled = []
      }
    } catch (_) {}
    
    // 3. 比较两个列表（顺序也要一致）
    const isSame =
      cachedEnabled.length === backendEnabled.length &&
      cachedEnabled.every((name, idx) => name === backendEnabled[idx])
    
    if (!isSame) {
      console.info('[App] Theme list changed, reloading themes...')
      console.info('[App] Cached:', cachedEnabled)
      console.info('[App] Backend:', backendEnabled)
      
      // 4. 列表不同，重新加载所有启用的主题
      const result = await StylesService.getAllEnabledThemes()
      if (result.merged_pack) {
        await ThemeManager.applyThemePack(result.merged_pack, { persist: false, allowScript: false })
        console.info('[App] Applied themes:', result.enabled_themes)
      } else {
        // 没有启用的主题，重置
        await ThemeManager.resetTheme({ persist: false })
        console.info('[App] No enabled themes, reset')
      }
      
      // 5. 更新缓存
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(backendEnabled))
      } catch (_) {}
    } else {
      console.info('[App] Theme list unchanged, skip sync')
    }
  } catch (e) {
    console.error('[App] Theme verification failed:', e)
    // 验证失败不影响应用启动
  }
}

</script>

<template>
  <AppShell :homePlain="view === 'start'">
    <template #sidebar>
      <SidebarDrawer v-if="showSidebar" v-model="drawerOpen">
        <SidebarNav
          :view="view"
          :theme="theme"
          @update:view="onSidebarViewUpdate"
          @update:theme="onThemeUpdate"
        />
      </SidebarDrawer>
    </template>

    <template #overlays>
      <transition name="st-panel-backdrop">
        <div v-if="anyPanelOpen" class="st-panel-backdrop" @click="closeAllPanels()"></div>
      </transition>
      
      <transition name="st-subpage">
        <AppearancePanel
          v-if="showSidebar && appearanceOpen"
          :current-view="view"
          @close="appearanceOpen = false"
        />
      </transition>

      
      <transition name="st-subpage">
        <AppSettingsPanel
          v-if="showSidebar && appSettingsOpen"
          :theme="theme"
          @update:theme="onThemeUpdate"
          @close="appSettingsOpen = false"
        />
      </transition>

      
      <transition name="st-subpage">
        <PresetsPanel
          v-if="showSidebar && presetsOpen"
          :conversationFile="currentConversationFile"
          @close="presetsOpen = false"
          @view="(key) => openViewModal('preset', getDetailTitle('preset', key), key)"
        />
      </transition>

      
      <transition name="st-subpage">
        <WorldBooksPanel
          v-if="showSidebar && worldbooksOpen"
          :conversationFile="currentConversationFile"
          @close="worldbooksOpen = false"
          @view="(key) => openViewModal('worldbook', getDetailTitle('worldbook', key), key)"
        />
      </transition>

      
      <transition name="st-subpage">
        <CharactersPanel
          v-if="showSidebar && charactersOpen"
          :conversationFile="currentConversationFile"
          @close="charactersOpen = false"
          @view="(key) => openViewModal('character', getDetailTitle('character', key), key)"
        />
      </transition>

      
      <transition name="st-subpage">
        <PersonasPanel
          v-if="showSidebar && personasOpen"
          :conversationFile="currentConversationFile"
          @close="personasOpen = false"
          @view="(key) => openViewModal('persona', getDetailTitle('persona', key), key)"
        />
      </transition>

      
      <transition name="st-subpage">
        <RegexRulesPanel
          v-if="showSidebar && regexrulesOpen"
          :conversationFile="currentConversationFile"
          @close="regexrulesOpen = false"
          @view="(key) => openViewModal('regex', getDetailTitle('regex', key), key)"
        />
      </transition>

      
      <transition name="st-subpage">
        <LLMConfigsPanel
          v-if="showSidebar && llmconfigsOpen"
          :conversationFile="currentConversationFile"
          @close="llmconfigsOpen = false"
          @view="(key) => openViewModal('aiconfig', getDetailTitle('aiconfig', key), key)"
        />
      </transition>

      <transition name="st-subpage">
        <PluginsPanel
          v-if="showSidebar && pluginsOpen"
          :conversationFile="currentConversationFile"
          @close="pluginsOpen = false"
        />
      </transition>

      <ToastsOverlay />
      <OptionsPanel />
      <LoadingOverlay :show="isLoading" :message="loadingMessage" />
    </template>

    
    
    <StartView
      v-if="view === 'start'"
      @new-game="openNewGame"
      @open-load="openHomeModal('load')"
      @open-appearance="openHomeModal('appearance')"
      @open-plugins="openHomeModal('plugins')"
      @open-options="openHomeModal('options')"
    />

    
    <ThreadedView
      v-if="view === 'threaded' || pendingView === 'threaded'"
      v-show="view === 'threaded'"
      :messages="messagesStore.rawMessages"
      :conversationFile="currentConversationFile"
      :conversationDoc="currentConversationDoc"
      @update:loading="isLoading = $event"
      @update:loadingMessage="loadingMessage = $event"
      @ready="onThreadedViewReady"
    />

    
    <SandboxView
      v-else-if="view === 'sandbox' || pendingView === 'sandbox'"
      v-show="view === 'sandbox'"
      @update:loading="isLoading = $event"
      @update:loadingMessage="loadingMessage = $event"
      @ready="onSandboxViewReady"
    />

    
    <ContentViewModal
      v-model:show="viewModalOpen"
      :title="viewModalTitle"
      @close="closeViewModal"
    >
      <div v-if="viewModalLoading" class="modal-loading">{{ t('common.loading') }}</div>
      <div v-else-if="viewModalError" class="modal-error">{{ t('error.loadFailed', { error: viewModalError }) }}</div>
      <PresetDetailView
        v-else-if="viewModalType === 'preset'"
        :presetData="viewModalData"
        :file="viewModalFile"
      />
      <WorldBookDetailView
        v-else-if="viewModalType === 'worldbook'"
        :worldbookData="viewModalData"
        :file="viewModalFile"
      />
      <CharacterDetailView
        v-else-if="viewModalType === 'character'"
        :characterData="viewModalData"
        :file="viewModalFile"
      />
      <PersonaDetailView
        v-else-if="viewModalType === 'persona'"
        :personaData="viewModalData"
        :file="viewModalFile"
      />
      <RegexRuleDetailView
        v-else-if="viewModalType === 'regex'"
        :regexData="viewModalData"
        :file="viewModalFile"
      />
      <LLMConfigDetailView
        v-else-if="viewModalType === 'aiconfig'"
        :llmConfigData="viewModalData"
        :file="viewModalFile"
      />
      <div v-else class="modal-placeholder">
        <div class="placeholder-icon">📋</div>
        <div class="placeholder-text">{{ t('components.modal.defaultTitle') }}</div>
        <div class="placeholder-desc">{{ t('common.type') }}：{{ viewModalType }}</div>
      </div>
    </ContentViewModal>

    
    <NewChatModal
      v-model:show="newGameOpen"
      :title="t('app.modal.newChat')"
      icon="swords"
      @confirm="onNewChatConfirm"
      @close="cancelNewGame"
    />

    
    <LoadGameModal
      :show="homeModalOpen && homeModalType === 'load'"
      :title="homeModalTitle || t('app.modal.loadGame')"
      icon="history"
      @confirm="onLoadGameConfirm"
      @update:show="(v) => { if (!v) closeHomeModal() }"
      @close="closeHomeModal"
    />
    <AppearanceModal
      :show="homeModalOpen && homeModalType === 'appearance'"
      :title="homeModalTitle || t('app.modal.appearance')"
      icon="palette"
      @update:show="(v) => { if (!v) closeHomeModal() }"
      @close="closeHomeModal"
    />
    <PluginsModal
      :show="homeModalOpen && homeModalType === 'plugins'"
      :title="homeModalTitle || t('app.modal.plugins')"
      icon="puzzle"
      @update:show="(v) => { if (!v) closeHomeModal() }"
      @close="closeHomeModal"
    />
    <OptionsModal
      :show="homeModalOpen && homeModalType === 'options'"
      :title="homeModalTitle || t('app.modal.options')"
      icon="settings"
      :theme="theme"
      @update:theme="onThemeUpdate"
      @update:show="(v) => { if (!v) closeHomeModal() }"
      @close="closeHomeModal"
    />
  </AppShell>
</template>


<style>
/*
  字体 CDN 加载改为仅由 ResourceLoader 预加载，避免运行中二次 @import 导致字体切换（大小/字形跳变）
  - 统一管理：见 [javascript.export(ResourceLoader)](frontend_projects/SmartTavern/src/utils/resourceLoader.js:37)
  - 如需恢复，建议在独立页面或开发模式下按需开启
  （此处移除 @import 以消除点击/切换视图后出现的字体重排）
*/

/* Tokens moved to src/styles/tokens.css
   - Loaded via main.js import: import './styles/tokens.css'
   - Runtime overrides by ThemeStore and AppearancePanel remain effective */

/* 页面背景 */
body[data-app="smarttavern"] {
  margin: 0;
  font-family: var(--st-font-body);
  color: rgb(var(--st-color-text));
  background-color: rgb(var(--st-color-bg));
  background-image: var(--st-surface-bg-image);
  background-size: var(--st-surface-bg-size);
  background-position: var(--st-surface-bg-position);
  background-repeat: var(--st-surface-bg-repeat);
}
/* start-view 完全透明：去除 body 白色底色 */
body[data-app="smarttavern"][data-home="plain"] {
  background-color: transparent !important;
}

* { box-sizing: border-box; }


/* Home 背景景深 + 焦点位移动画（进入/返回主页时触发） */
@keyframes stDepthIntro {
  /* 两段式：0-75% 焦点位移+模糊减弱；75-100% 仅清晰过渡 */
  0% {
    transform: scale(var(--st-bg-intro-scale-start, 1.08)) translate3d(var(--fx-shift-x), var(--fx-shift-y), 0);
    filter: blur(var(--st-bg-intro-blur-start, 20px)) saturate(var(--st-bg-intro-saturate-start, 118%)) brightness(var(--st-bg-intro-brightness-start, 0.96));
    opacity: var(--st-bg-intro-opacity-start, 0);
  }
  75% {
    transform: scale(var(--st-bg-intro-scale-mid, 1)) translate3d(0, 0, 0);
    filter: blur(var(--st-bg-intro-blur-mid, 2px)) saturate(var(--st-bg-intro-saturate-mid, 103%)) brightness(var(--st-bg-intro-brightness-mid, 1));
    opacity: var(--st-bg-intro-opacity-mid, 1);
  }
  100% {
    transform: scale(var(--st-bg-intro-scale-end, 1)) translate3d(0, 0, 0);
    filter: blur(var(--st-bg-intro-blur-end, 0px)) saturate(var(--st-bg-intro-saturate-end, 100%)) brightness(var(--st-bg-intro-brightness-end, 1));
    opacity: var(--st-bg-intro-opacity-end, 1);
  }
}


/* 使用 body.st-bg-anim 切换动画态，避免常驻性能消耗 */
body.st-bg-anim [data-scope="start-view"]::before {
  will-change: transform, filter, opacity;
  /* 放慢到 4s，总时长匹配 JS 清理 4.1s */
  animation: stDepthIntro var(--st-bg-anim-duration, 4s) var(--st-bg-anim-easing, cubic-bezier(.22,.61,.36,1)) forwards;
}
/* Threaded/Sandbox 背景：两段式"0-75% 位移+模糊、75-100% 仅清晰"动画（背景只做景深，不改不透明度） */
/* 改为依据用户配置的"目标模糊度"作为动画终点，避免动画结束后跳变导致闪烁 */
@keyframes stDepthIntroBgVarThreaded {
  0% {
    transform: scale(var(--st-bg-intro-scale-start, 1.08)) translate3d(var(--fx-shift-x), var(--fx-shift-y), 0);
    filter: blur(var(--st-bg-intro-blur-start, 20px)) saturate(var(--st-bg-intro-saturate-start, 118%)) brightness(var(--st-bg-intro-brightness-start, 0.96));
  }
  75% {
    transform: scale(var(--st-bg-intro-scale-mid, 1)) translate3d(0,0,0);
    /* 中段仍保持较小模糊，趋近自然对焦 */
    filter: blur(var(--st-bg-intro-blur-mid, 2px)) saturate(var(--st-bg-intro-saturate-mid, 103%)) brightness(var(--st-bg-intro-brightness-mid, 1));
  }
  100% {
    transform: scale(var(--st-bg-intro-scale-end, 1)) translate3d(0,0,0);
    /* 终点严格对齐用户设置的模糊度变量 */
    filter: blur(var(--st-threaded-bg-blur, 0px)) saturate(var(--st-bg-intro-saturate-end, 100%)) brightness(var(--st-bg-intro-brightness-end, 1));
  }
}
@keyframes stDepthIntroBgVarSandbox {
  0% {
    transform: scale(var(--st-bg-intro-scale-start, 1.08)) translate3d(var(--fx-shift-x), var(--fx-shift-y), 0);
    filter: blur(var(--st-bg-intro-blur-start, 20px)) saturate(var(--st-bg-intro-saturate-start, 118%)) brightness(var(--st-bg-intro-brightness-start, 0.96));
  }
  75% {
    transform: scale(var(--st-bg-intro-scale-mid, 1)) translate3d(0,0,0);
    filter: blur(var(--st-bg-intro-blur-mid, 2px)) saturate(var(--st-bg-intro-saturate-mid, 103%)) brightness(var(--st-bg-intro-brightness-mid, 1));
  }
  100% {
    transform: scale(var(--st-bg-intro-scale-end, 1)) translate3d(0,0,0);
    filter: blur(var(--st-sandbox-bg-blur, 0px)) saturate(var(--st-bg-intro-saturate-end, 100%)) brightness(var(--st-bg-intro-brightness-end, 1));
  }
}

/* 叠加遮罩按变量过渡到目标不透明度，避免加载完成时跳变 */
@keyframes stDepthOverlayToVar {
  0%   { opacity: var(--st-overlay-opacity-start, 1); }
  100% { opacity: var(--st-target-bg-opacity, 0.12); }
}

/* 楼层对话页（threaded）：背景做景深，遮罩按变量淡入到目标不透明度 */
body.st-bg-anim-threaded .st-threaded::before,
body.st-bg-anim-threaded [data-scope="chat-threaded"]::before {
  will-change: transform, filter;
  /* 终点对齐 --st-threaded-bg-blur，避免结束后跳变 */
  animation: stDepthIntroBgVarThreaded var(--st-bg-anim-duration, 4s) var(--st-bg-anim-easing, cubic-bezier(.22,.61,.36,1)) forwards;
}
body.st-bg-anim-threaded .st-threaded::after,
body.st-bg-anim-threaded [data-scope="chat-threaded"]::after {
  will-change: opacity;
  animation: stDepthOverlayToVar var(--st-bg-anim-duration, 4s) var(--st-bg-anim-easing, cubic-bezier(.22,.61,.36,1)) forwards;
}

/* 前端沙盒页（sandbox）：背景做景深，遮罩按变量淡入到目标不透明度 */
body.st-bg-anim-sandbox .st-sandbox::before,
body.st-bg-anim-sandbox [data-scope="chat-sandbox"]::before {
  will-change: transform, filter;
  /* 终点对齐 --st-sandbox-bg-blur，避免结束后跳变 */
  animation: stDepthIntroBgVarSandbox var(--st-bg-anim-duration, 4s) var(--st-bg-anim-easing, cubic-bezier(.22,.61,.36,1)) forwards;
}
body.st-bg-anim-sandbox .st-sandbox::after,
body.st-bg-anim-sandbox [data-scope="chat-sandbox"]::after {
  will-change: opacity;
  animation: stDepthOverlayToVar var(--st-bg-anim-duration, 4s) var(--st-bg-anim-easing, cubic-bezier(.22,.61,.36,1)) forwards;
}


</style>


<style scoped>




/* 子页面展开/收起动画（AppearancePanel 组件在 App 层的过渡） */
.st-subpage-enter-from {
  opacity: 0;
  transform: translateX(var(--st-panel-translate-enter, -10px)) scale(var(--st-panel-scale, 0.98));
  filter: blur(var(--st-panel-blur-transition, 4px));
}
.st-subpage-leave-to   {
  opacity: 0;
  transform: translateX(var(--st-panel-translate-leave, -12px)) scale(var(--st-panel-scale, 0.98));
  filter: blur(var(--st-panel-blur-transition, 4px));
}
.st-subpage-enter-active,
.st-subpage-leave-active {
  transition:
    opacity var(--st-panel-transition-opacity, 0.2s) ease,
    transform var(--st-panel-transition-transform, 0.24s) cubic-bezier(.22,.61,.36,1),
    filter var(--st-panel-transition-transform, 0.24s) ease;
}

/* 右侧列表面板背板：浅色=白半透明，深色=黑半透明（由 --st-overlay-ink 控制） */
.st-panel-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(var(--st-overlay-ink), var(--st-panel-backdrop-opacity, 0.18));
  backdrop-filter: blur(var(--st-panel-backdrop-blur, 12px));
  -webkit-backdrop-filter: blur(var(--st-panel-backdrop-blur, 12px));
  z-index: var(--st-panel-backdrop-z, 58); /* 低于各面板(59)，高于内容 */
}
/* 背板淡入淡出动画 */
.st-panel-backdrop-enter-from,
.st-panel-backdrop-leave-to { opacity: 0; }
.st-panel-backdrop-enter-active,
.st-panel-backdrop-leave-active {
  transition: opacity var(--st-panel-backdrop-transition, 0.18s) ease;
}

/* 模态框占位符样式 */
.modal-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--st-modal-placeholder-gap, 12px);
  padding: var(--st-modal-placeholder-padding, 60px 20px);
  text-align: center;
}

.placeholder-icon {
  font-size: var(--st-modal-placeholder-icon-size, 64px);
  opacity: var(--st-modal-placeholder-icon-opacity, 0.6);
}

.placeholder-text {
  font-size: var(--st-modal-placeholder-text-size, 20px);
  font-weight: var(--st-modal-placeholder-text-weight, 600);
  color: rgb(var(--st-color-text));
}

.placeholder-desc {
  font-size: var(--st-modal-placeholder-desc-size, 14px);
  color: rgba(var(--st-color-text), var(--st-modal-placeholder-desc-opacity, 0.65));
}

</style>
