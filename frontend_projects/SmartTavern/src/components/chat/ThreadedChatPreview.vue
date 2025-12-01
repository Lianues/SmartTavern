<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { splitHtmlFromText } from '@/features/chat/normalizer'
import usePalette from '@/composables/usePalette'
import InputRow from '@/components/chat/InputRow.vue'
import MessageItem from '@/components/chat/MessageItem.vue'
/* AI补全改为事件桥接驱动，组件侧不直接依赖服务 */
import Host from '@/workflow/core/host'
import * as Completion from '@/workflow/channels/completion'
import * as Threaded from '@/workflow/channels/threaded'
import * as Message from '@/workflow/channels/message'
import * as Branch from '@/workflow/channels/branch'
import { useMessagesStore } from '@/stores/chatMessages'
import { useCharacterStore } from '@/stores/character'
import { usePersonaStore } from '@/stores/persona'
import { useAppearanceSettingsStore } from '@/stores/appearanceSettings'
import { useI18n } from '@/locales'

const { t } = useI18n()
const appearanceStore = useAppearanceSettingsStore()

/**
 * 楼层对话预览（美化版）
 * 布局：头像占位 + 名称/角色 + 对话内容 + 楼层序号（#）
 * - 不依赖外部数据，仅美化现有 props.messages（id/role/content）
 * - 使用 Design Tokens，响应式与玻璃拟态风格
 * - data-scope/data-part 保持稳定选择器契约（便于主题包覆盖）
 * - 使用自定义滚动条替代原生滚动条
 */
const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  conversationFile: {
    type: String,
    default: null
  },
  conversationDoc: {
    type: Object,
    default: null
  }
})

const msgStore = useMessagesStore()
const characterStore = useCharacterStore()
const personaStore = usePersonaStore()

function roleLabel(role) {
  return t(`role.${role}`) || t('common.unknown')
}
function nameOf(msg) {
  // 名称占位规则：优先角色映射；可拓展为从 msg.meta 中读取昵称
  return roleLabel(msg.role)
}

/* 智能色条：根据头像图片/角色生成渐变色（抽离为 composable） */
const { palettes, ensurePaletteFor, stripeStyle } = usePalette()

// Lucide 图标刷新（局部调用，避免 race）
function refreshIcons() {
  nextTick(() => {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons()
    }
    if (typeof window.initFlowbite === 'function') {
      try { window.initFlowbite() } catch (_) {}
    }
  })
}

/* 单条消息删除由子组件上抛，这里维护列表状态并重新加载分支信息 */
async function deleteMessage(payload) {
  // 支持两种形式：字符串 msgId 或对象 { id, latest, active_path }
  const isObj = payload && typeof payload === 'object'
  const msgId = isObj ? payload.id : payload
  const idx = props.messages.findIndex(m => m.id === msgId)
  if (idx >= 0) {
    props.messages.splice(idx, 1)
    // 清理该节点的状态和流式内容索引
    delete nodeStates.value[msgId]
    delete streamContentIndex.value[msgId]
    // 使用 delete 返回的 latest（若提供）直接更新分支指示；否则不再请求分支表
    if (isObj && payload.latest && payload.latest.node_id) {
      const lid = payload.latest.node_id
      const lj = (payload.latest.j != null) ? payload.latest.j : null
      const ln = (payload.latest.n != null) ? payload.latest.n : null
      const newMap = {}
      if (lj != null && ln != null) newMap[lid] = { j: lj, n: ln }
      branchInfoMap.value = newMap
    }
  }
  refreshIcons()
}

/* 菜单逻辑已下沉至 MessageItem.vue */

/* 组件卸载时清理（历史遗留：全局点击关闭菜单已下沉至 MessageItem）
 * 保守处理：若存在旧的全局处理器则移除，否则忽略（避免 ReferenceError）
 */
onBeforeUnmount(() => {
  try {
    if (typeof handleGlobalClick === 'function') {
      document.removeEventListener('click', handleGlobalClick)
    }
  } catch (_) {}
})

// 分支信息管理
const branchInfoMap = ref({}) // 存储每个节点的分支信息 { node_id: { j, n } }

// 节点状态管理（等待/错误状态按节点ID独立存储）
const nodeStates = ref({}) // { node_id: { waitingAI, waitingSeconds, error } }

// 流式内容索引（后台存储流式接收的完整内容）
const streamContentIndex = ref({}) // { node_id: string } - 存储流式接收的完整内容
// 打字机可见缓冲（逐步从完整内容中推进，可避免切换分支时闪烁/清空）
const streamVisibleIndex = ref({}) // { node_id: string }
let typingRAF = null
let typingLastTs = 0

function _ensureTypingLoop() {
  if (typingRAF) return
  const loop = (ts) => {
    try {
      const dt = typingLastTs ? Math.max(0, (ts - typingLastTs) / 1000) : 0
      typingLastTs = ts
      let anyBacklog = false
      const keys = Object.keys(streamContentIndex.value || {})
      for (const id of keys) {
        const full = String(streamContentIndex.value[id] || '')
        const vis = String(streamVisibleIndex.value[id] || '')
        const backlog = full.length - vis.length
        if (backlog > 0) {
          anyBacklog = true
          // 自适应速率：基于 backlog 增速，避免积压
          // cps ≈ 24 + 10*sqrt(backlog) + 0.25*backlog，封顶 1500 cps
          const cps = Math.min(1500, 24 + 10 * Math.sqrt(backlog) + 0.25 * backlog)
          // 本帧推进字符数（至少 1）
          const step = Math.max(1, Math.floor(cps * dt))
          const nextLen = Math.min(full.length, vis.length + step)
          const slice = full.slice(vis.length, nextLen)
          streamVisibleIndex.value[id] = vis + slice
        }
      }
      if (anyBacklog) {
        typingRAF = requestAnimationFrame(loop)
      } else {
        typingRAF = null
        typingLastTs = 0
      }
    } catch (_) {
      // 出错时停止本轮，避免卡住循环
      typingRAF = null
      typingLastTs = 0
    }
  }
  typingRAF = requestAnimationFrame(loop)
}
// 发送用户消息后，后端 append_message 会立即创建助手占位并返回 latest（用于该占位）
// 暂存该 j/n，等占位事件触发后应用到 tempNodeId
const pendingAssistantJN = ref(null)
const __uiOffs = [] // UI事件监听清单（组件卸载时统一清理）
const __completionOffs = [] // AI补全事件监听清单（组件卸载时统一清理）

/* 角色头像与元数据（assistant 角色使用）- 从 character store 获取 */
const assistantAvatarUrl = computed(() => characterStore.avatarUrl)
const characterDisplayName = computed(() => {
  const meta = characterStore.meta
  if (!meta) return null
  return String(meta?.character_name || meta?.name || '').trim() || null
})
const characterBadge = computed(() => {
  const meta = characterStore.meta
  if (!meta) return null
  return String(meta?.character_badge || '').trim() || null
})

/* 用户头像与元数据（user 角色使用）- 从 persona store 获取 */
const userAvatarUrl = computed(() => personaStore.avatarUrl)
const userDisplayName = computed(() => {
  const meta = personaStore.meta
  if (!meta) return null
  return String(meta?.persona_name || meta?.name || '').trim() || null
})
const userBadge = computed(() => {
  const meta = personaStore.meta
  if (!meta) return null
  return String(meta?.persona_badge || '').trim() || null
})

/**
 * 加载分支信息
 */
async function loadBranchInfo() {
  if (!props.conversationFile) {
    console.warn(t('chat.errors.noConversationFile'))
    return
  }

  const convFile = props.conversationFile

  // 使用事件通道请求分支表，并在一次性监听中更新映射
  await new Promise((resolve) => {
    const offOk = Host.events.on(Branch.EVT_BRANCH_TABLE_OK, ({ conversationFile, result }) => {
      if (conversationFile !== convFile) return

      const newMap = {}
      if (result?.levels && Array.isArray(result.levels)) {
        result.levels.forEach(level => {
          if (level.node_id && level.j !== null && level.n !== null) {
            newMap[level.node_id] = { j: level.j, n: level.n }
          }
        })
      }

      branchInfoMap.value = newMap
      console.log('分支信息加载成功(事件):', newMap)
      refreshIcons()

      try { offOk?.() } catch (_) {}
      try { offFail?.() } catch (_) {}
      resolve(true)
    })
    const offFail = Host.events.on(Branch.EVT_BRANCH_TABLE_FAIL, ({ conversationFile, message }) => {
      if (conversationFile && conversationFile !== convFile) return
      console.error(t('chat.errors.loadBranchFailed') + '(事件):', message)
      try { offOk?.() } catch (_) {}
      try { offFail?.() } catch (_) {}
      resolve(false)
    })

    __uiOffs.push(offOk, offFail)
    Host.events.emit(Branch.EVT_BRANCH_TABLE_REQ, { conversationFile: convFile })
  })
}

/* 输入框逻辑 */
const inputText = ref('')
const messageListRef = ref(null)
const inputRef = ref(null)
const inputRowRef = ref(null)
let removeWheel = null

onMounted(async () => {
  // 加载角色/用户头像与元数据，以及分支信息
  // 角色卡和用户画像通过 store 加载，避免重复调用后端API
  await Promise.all([
    characterStore.refreshFromConversation(props.conversationFile),
    personaStore.refreshFromConversation(props.conversationFile),
    loadBranchInfo()
  ])
  
  // 等待下一帧再初始化iframe跟踪，确保消息已渲染
  await nextTick()
  await nextTick()
  
  // 初始化iframe加载跟踪
  initIframesTracking()
  
  // 首次挂载后强制更新滚动条（确保容器尺寸已稳定）
  messageListRef.value?.update?.()

  // 在 chat-unified 与 main 区域（包括空白处）使用滚轮也能滚动消息列表
  const chatUnified = document.querySelector('[data-scope="chat-unified"]')
  const mainArea = document.querySelector('[data-scope="main"]')
  const wheelHandler = (e) => {
    const container = messageListRef.value?.$el?.querySelector('.scroll-container')
    if (!container) return
    
    // 如果事件来源本就在列表容器内，让原生滚动处理
    if (container.contains(e.target)) return
    
    // 如果事件来源在输入框容器内（包括 textarea 和自定义滚动条），让原生滚动处理
    const inputContainer = document.querySelector('.input-container')
    if (inputContainer && inputContainer.contains(e.target)) return
    
    // 位于聊天统一区域或主区域空白时，拦截并转发滚动到消息容器
    const inChatUnified = chatUnified && chatUnified.contains(e.target)
    const inMainArea = mainArea && mainArea.contains(e.target)
    if (inChatUnified || inMainArea) {
      container.scrollTop += e.deltaY
      e.preventDefault()
    }
  }
  chatUnified?.addEventListener('wheel', wheelHandler, { passive: false })
  mainArea?.addEventListener('wheel', wheelHandler, { passive: false })
  removeWheel = () => {
    chatUnified?.removeEventListener('wheel', wheelHandler)
    mainArea?.removeEventListener('wheel', wheelHandler)
  }
  
  // 视口追踪：监听滚动事件更新视口中心
  const container = messageListRef.value?.$el?.querySelector('.scroll-container')
  if (container) {
    let scrollTimeout = null
    const scrollHandler = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        updateViewportCenter()
      }, 100)
    }
    container.addEventListener('scroll', scrollHandler, { passive: true })
    
    // 初始化视口中心
    nextTick(() => {
      updateViewportCenter()
    })
  }
  
  refreshIcons()
  // 初始化现有消息的智能色条调色板（若有头像则提取主色）
  props.messages.forEach(m => { ensurePaletteFor(m) })
})

onBeforeUnmount(() => {
  removeWheel?.()
  if (sendErrorTimer) { clearTimeout(sendErrorTimer); sendErrorTimer = null }
  if (sendSuccessTimer) { clearTimeout(sendSuccessTimer); sendSuccessTimer = null }
  // 角色头像和用户头像 Blob URL 都由对应的 store 管理，无需手动清理
  // 清理补全事件监听（避免组件卸载后仍然持有回调）
  try {
    __completionOffs?.forEach(fn => { try { fn?.() } catch (_) {} })
    __completionOffs.length = 0
  } catch (_) {}
  // 清理 UI 事件监听
  try {
    __uiOffs?.forEach(fn => { try { fn?.() } catch (_) {} })
    __uiOffs.length = 0
  } catch (_) {}
})

watch(() => props.messages.length, () => {
  // 下一拍更新滚动条
  nextTick(() => {
    messageListRef.value?.update?.()
    refreshIcons()
    // 消息数量变化后，重新初始化iframe跟踪
    initIframesTracking()
  })
})

/**
 * 事件驱动：为指定 tag 附加 Completion 监听（用于 UI 占位与后续更新）
 */
function attachCompletionHandlersForTag(tagNodeId) {
  // 打字机与等待态
  let currentNodeId = tagNodeId  // 关键修复：跟踪当前节点ID（可能从临时ID变为真实ID）
  let typewriterBuffer = ''
  let isTyping = false
  let hasReceivedError = false
  let waitingTimer = setInterval(() => {
    const st = nodeStates.value[currentNodeId]
    if (st) st.waitingSeconds = (st.waitingSeconds || 0) + 1
  }, 1000)

  const offChunk = Host.events.on(Completion.EVT_COMPLETION_CHUNK, async ({ tag, content }) => {
    if (tag !== tagNodeId) return
    if (hasReceivedError) return

    // 第一个 chunk 到达，结束等待动画
    if (nodeStates.value[currentNodeId]?.waitingAI) {
      nodeStates.value[currentNodeId].waitingAI = false
      if (waitingTimer) { clearInterval(waitingTimer); waitingTimer = null }
    }

    // 后台索引（完整内容）- 使用当前节点ID
    if (!streamContentIndex.value[currentNodeId]) streamContentIndex.value[currentNodeId] = ''
    streamContentIndex.value[currentNodeId] += content

    // 初始化可见缓冲并启动自适应打字机循环
    if (streamVisibleIndex.value[currentNodeId] == null) streamVisibleIndex.value[currentNodeId] = ''
    _ensureTypingLoop()

    // 不直接修改前台消息文本，避免切换分支时清空/覆盖其他分支内容；
    // 展示层通过 getRenderContent() 读取 streamContentIndex 实现无痕显示

    // 滚动到底部
    await nextTick()
    const container = messageListRef.value?.$el?.querySelector('.scroll-container')
    if (container) container.scrollTop = container.scrollHeight
  })
  const offSaved = Host.events.on(Completion.EVT_COMPLETION_SAVED, ({ tag, node_id, doc, content, node_updated_at }) => {
    if (tag !== tagNodeId) return
    if (hasReceivedError) return
    const oldNodeId = currentNodeId
    const msg = props.messages.find(m => m.id === oldNodeId)
    if (msg) {
      // 更新为真实ID
      if (node_id && oldNodeId !== node_id) {
        msg.id = node_id
        // 关键修复：更新 currentNodeId，使后续chunk事件能找到消息
        currentNodeId = node_id
        // 迁移节点状态和流式内容索引
        if (nodeStates.value[oldNodeId]) {
          nodeStates.value[node_id] = nodeStates.value[oldNodeId]
          delete nodeStates.value[oldNodeId]
        }
        if (streamContentIndex.value[oldNodeId]) {
          streamContentIndex.value[node_id] = streamContentIndex.value[oldNodeId]
          delete streamContentIndex.value[oldNodeId]
        }
      }
      // 更新节点时间戳
      if (node_updated_at) {
        msg.node_updated_at = node_updated_at
        // 同步更新 rawMessages
        try {
          const rawMsgs = msgStore.rawMessages || []
          const idx = rawMsgs.findIndex(m => m && m.id === (node_id || oldNodeId))
          if (idx >= 0 && rawMsgs[idx]) {
            rawMsgs[idx].node_updated_at = node_updated_at
            if (content) rawMsgs[idx].content = content
          }
        } catch (_) {}
      }
      // 非流式模式直接替换内容
      if (content) {
        msg.content = content
        if (nodeStates.value[node_id || oldNodeId]) nodeStates.value[node_id || oldNodeId].waitingAI = false
      }
    }
    // 迁移可见缓冲
    if (streamVisibleIndex.value[oldNodeId]) {
      streamVisibleIndex.value[node_id] = streamVisibleIndex.value[oldNodeId]
      delete streamVisibleIndex.value[oldNodeId]
    }
    if (doc && props.conversationDoc) Object.assign(props.conversationDoc, doc)

    // 仅使用 append/后端返回的 latest（若存在），不进行前端计算
    if (doc && doc.latest && doc.latest.node_id) {
      const lid = doc.latest.node_id
      const lj = (doc.latest.j != null) ? doc.latest.j : null
      const ln = (doc.latest.n != null) ? doc.latest.n : null
      const map = {}
      if (lj != null && ln != null) map[lid] = { j: lj, n: ln }
      branchInfoMap.value = map
    }
  })
  const offError = Host.events.on(Completion.EVT_COMPLETION_ERROR, ({ tag, message }) => {
    if (tag !== tagNodeId) return
    console.error(t('chat.errors.aiCallFailed') + ':', message)
    hasReceivedError = true
    if (waitingTimer) { clearInterval(waitingTimer); waitingTimer = null }
    typewriterBuffer = ''
    isTyping = false
    if (nodeStates.value[currentNodeId]) {
      nodeStates.value[currentNodeId].waitingAI = false
      nodeStates.value[currentNodeId].error = message || t('chat.errors.aiCallFailed')
    }
    delete streamContentIndex.value[currentNodeId]
    nextTick(() => refreshIcons())
  })
  const offEnd = Host.events.on(Completion.EVT_COMPLETION_END, async ({ tag }) => {
    if (tag !== tagNodeId) return
    if (waitingTimer) { clearInterval(waitingTimer); waitingTimer = null }
    while (isTyping || typewriterBuffer.length > 0) { await new Promise(r => setTimeout(r, 50)) }
    if (nodeStates.value[currentNodeId]) nodeStates.value[currentNodeId].waitingAI = false
    if (hasReceivedError) {
      await nextTick()
      refreshIcons()
    } else {
      delete streamContentIndex.value[currentNodeId]
      // 不再在补全结束时计算 j/n；分支位置已由 append/retry/switch 返回的 latest 更新
      refreshIcons()
    }
    // 清理监听
    ;[offChunk, offSaved, offError, offEnd].forEach(fn => { try { fn?.() } catch (_) {} })
  })

  // 记录统一清理器
  __completionOffs.push(offChunk, offSaved, offError, offEnd)
}

/**
 * UI通道：占位助手消息创建（组件仅响应事件与状态）
 * - 工作流（插件）负责在此事件之后触发 Completion.EVT_COMPLETION_REQ（携带相同 tag）
 */
const offAssistPlaceholder = Host.events.on(Threaded.EVT_THREAD_ASSIST_PLACEHOLDER_CREATE, ({ conversationFile, tempNodeId, node_updated_at }) => {
if (conversationFile !== props.conversationFile) return

// 防御性检查：如果该节点已存在，跳过创建
const rawMsgs = msgStore.rawMessages || []
const existsInMessages = rawMsgs.some(m => m && m.id === tempNodeId)
if (existsInMessages) return

// 仅更新 rawMessages（因为 props.messages 是它的引用，会自动更新）
try {
  rawMsgs.push({
    id: tempNodeId,
    role: 'assistant',
    content: '',
    node_updated_at: node_updated_at || null
  })
  msgStore.updateRawMessages([...rawMsgs])
  
  // 设置节点状态和调色板
  ensurePaletteFor(rawMsgs[rawMsgs.length - 1])
  nodeStates.value[tempNodeId] = { waitingAI: true, waitingSeconds: 0, error: null }
} catch (_) {}
  
  // 附加 Completion 监听以驱动后续更新
  attachCompletionHandlersForTag(tempNodeId)

  // 立即显示分支切换器：优先使用 append 返回的 latest（pendingAssistantJN），否则回退预测
  try {
    if (pendingAssistantJN.value) {
      branchInfoMap.value = { ...(branchInfoMap.value || {}), [tempNodeId]: { ...pendingAssistantJN.value } }
      pendingAssistantJN.value = null
    } else {
      const doc = props.conversationDoc || {}
      const ap = Array.isArray(doc.active_path) ? doc.active_path : []
      const pid = ap.length ? ap[ap.length - 1] : null
      let n = 1
      if (pid && doc.children && Array.isArray(doc.children[pid])) {
        const siblings = doc.children[pid]
        n = siblings.length + 1
      }
      const j = n
      branchInfoMap.value = { ...(branchInfoMap.value || {}), [tempNodeId]: { j, n } }
    }
  } catch (_) {}
})
__uiOffs.push(offAssistPlaceholder)

function sendMessage() {
  const text = inputText.value.trim()
  if (!text) return
  
  // 创建新消息
  const newMessage = {
    id: Date.now(), // 简单的ID生成
    role: 'user',
    content: text
  }
  
  // 若等待中则直接返回（不允许再次发送）
  if (pendingMessageId?.value) return

  // 添加到消息列表
  props.messages.push(newMessage)
  // 为新消息生成色条调色板（若有头像则尝试提取主色）
  ensurePaletteFor(newMessage)
  // 启动 10 秒等待占位
  startPendingFor(newMessage.id)
  
  // 清空输入框
  inputText.value = ''
  
  // 滚动到底部（丝滑且自然）
  nextTick(() => {
    setTimeout(() => {
      if (messageListRef.value?.$el) {
        const container = messageListRef.value.$el.querySelector('.scroll-container')
        if (container) {
          // 优先使用原生平滑滚动
          try {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
          } catch (_) {
            // 回退：rAF 动画
            const start = container.scrollTop
            const end = container.scrollHeight
            const dur = 420
            const t0 = performance.now()
            const ease = t => 1 - Math.pow(1 - t, 3) // easeOutCubic
            const step = (now) => {
              const p = Math.min(1, (now - t0) / dur)
              container.scrollTop = start + (end - start) * ease(p)
              if (p < 1) requestAnimationFrame(step)
            }
            requestAnimationFrame(step)
          }
        }
      }
    }, 60)
  })
}

// 输入行为：Enter 发送，Shift+Enter 换行（遵循 UI 规范）
function onKeydown(e) {
  if (pendingMessageId?.value) {
    // 等待中不允许再次发送（允许输入编辑）
    if (e.key === 'Enter' && !e.shiftKey) e.preventDefault()
    return
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

/* 快捷操作（编辑/再生），更多行为可接入后端 */
function startEdit(msg) {
  inputRowRef.value?.setText?.(msg.content)
}

/**
 * 重新生成消息（重试）
 * - assistant 消息：创建新分支
 * - user 消息：智能判断（有后续助手则重试助手，无则创建新助手并调用 AI）
 */
async function regenerateMessage(msg) {
  console.log('请求重新生成(事件化)：', msg.id, msg.role)

  if (!props.conversationFile || !props.conversationDoc) {
    console.error(t('chat.errors.missingFileOrDoc'))
    return
  }

  try {
    if (msg.role === 'assistant') {
      // 事件化：助手消息重试 -> 创建新分支，由桥接器调用后端
      const tag = `retry_ass_${Date.now()}`
      const oldId = msg.id

      const offOk = Host.events.on(Branch.EVT_BRANCH_RETRY_ASSIST_OK, ({ conversationFile, newNodeId, doc, latest, active_path, node_updated_at, tag: rtag }) => {
        if (conversationFile !== props.conversationFile || rtag !== tag) return

        // 仅更新 rawMessages（因为 props.messages 是它的引用，会自动更新）
        try {
          const rawMsgs = msgStore.rawMessages || []
          const rawIdx = rawMsgs.findIndex(m => m && m.id === oldId)
          if (rawIdx >= 0 && rawMsgs[rawIdx]) {
            rawMsgs[rawIdx].id = newNodeId
            rawMsgs[rawIdx].content = ''
            rawMsgs[rawIdx].node_updated_at = node_updated_at
            msgStore.updateRawMessages([...rawMsgs])
            
            // 设置调色板和节点状态
            ensurePaletteFor(rawMsgs[rawIdx])
            nodeStates.value[newNodeId] = { waitingAI: true, waitingSeconds: 0, error: null }
            
            // 关键修复：附加 Completion 监听器，以便后续 AI 补全内容可以显示
            attachCompletionHandlersForTag(newNodeId)
          }
        } catch (_) {}

        if (doc && props.conversationDoc) Object.assign(props.conversationDoc, doc)
        
        // 用 latest 直接更新分支映射（无网络额外请求）
        if (latest && latest.node_id) {
          const lid = latest.node_id
          const lj = (latest.j != null) ? latest.j : null
          const ln = (latest.n != null) ? latest.n : null
          const map = {}
          if (lj != null && ln != null) map[lid] = { j: lj, n: ln }
          branchInfoMap.value = map
        }
        
        try { offOk?.() } catch (_) {}
        try { offFail?.() } catch (_) {}
      })
      const offFail = Host.events.on(Branch.EVT_BRANCH_RETRY_ASSIST_FAIL, ({ conversationFile, message, tag: rtag }) => {
        if (conversationFile !== props.conversationFile || rtag !== tag) return
        console.error(t('chat.errors.retryFailed') + ':', message)
        try { offOk?.() } catch (_) {}
        try { offFail?.() } catch (_) {}
      })

      __uiOffs.push(offOk, offFail)
      Host.events.emit(Branch.EVT_BRANCH_RETRY_ASSIST_REQ, {
        conversationFile: props.conversationFile,
        retryNodeId: oldId,
        tag,
      })
    } else if (msg.role === 'user') {
      // 事件化：用户智能重试 -> 由桥接器决定创建助手或重试既有助手
      const tag = `retry_user_${Date.now()}`
      
      // 监听 RETRY_USER_OK，如果是 retry_assistant 则继续监听分支创建
      const offOk = Host.events.on(Branch.EVT_BRANCH_RETRY_USER_OK, ({ conversationFile, action, assistantNodeId, doc, tag: rtag }) => {
        if (conversationFile !== props.conversationFile || rtag !== tag) return
        if (doc && props.conversationDoc) Object.assign(props.conversationDoc, doc)
        
        // 如果是 retry_assistant，监听后续的分支创建事件以更新UI
        if (action === 'retry_assistant' && assistantNodeId) {
          const oldAssistantId = assistantNodeId
          
          // 监听工作流触发的助手分支创建事件
          const offAssistOk = Host.events.on(Branch.EVT_BRANCH_RETRY_ASSIST_OK, ({ conversationFile: cf, newNodeId, doc: newDoc, latest: latest2, active_path: ap2, node_updated_at, tag: assTag }) => {
            // 检查是否是我们触发的重试（通过检查时间戳）
            if (cf !== props.conversationFile) return
            if (!assTag || !assTag.startsWith('retry_user_assist_')) return
            
            // 仅更新 rawMessages（因为 props.messages 是它的引用，会自动更新）
            try {
              const rawMsgs = msgStore.rawMessages || []
              const rawIdx = rawMsgs.findIndex(m => m && m.id === oldAssistantId)
              if (rawIdx >= 0 && rawMsgs[rawIdx]) {
                rawMsgs[rawIdx].id = newNodeId
                rawMsgs[rawIdx].content = ''
                rawMsgs[rawIdx].node_updated_at = node_updated_at
                msgStore.updateRawMessages([...rawMsgs])
                
                // 设置调色板和节点状态
                ensurePaletteFor(rawMsgs[rawIdx])
                nodeStates.value[newNodeId] = { waitingAI: true, waitingSeconds: 0, error: null }
                
                // 附加 Completion 监听以驱动后续更新
                attachCompletionHandlersForTag(newNodeId)
              }
            } catch (_) {}
            
            if (newDoc && props.conversationDoc) Object.assign(props.conversationDoc, newDoc)
            
            // 用 latest 直接更新分支映射
            if (latest2 && latest2.node_id) {
              const lid = latest2.node_id
              const lj = (latest2.j != null) ? latest2.j : null
              const ln = (latest2.n != null) ? latest2.n : null
              const map = {}
              if (lj != null && ln != null) map[lid] = { j: lj, n: ln }
              branchInfoMap.value = map
            }
            
            try { offAssistOk?.() } catch (_) {}
          })
          
          __uiOffs.push(offAssistOk)
        }
        
        try { offOk?.() } catch (_) {}
        try { offFail?.() } catch (_) {}
      })
      const offFail = Host.events.on(Branch.EVT_BRANCH_RETRY_USER_FAIL, ({ conversationFile, message, tag: rtag }) => {
        if (conversationFile !== props.conversationFile || rtag !== tag) return
        console.error(t('chat.errors.retryFailed') + ':', message)
        try { offOk?.() } catch (_) {}
        try { offFail?.() } catch (_) {}
      })

      __uiOffs.push(offOk, offFail)
      Host.events.emit(Branch.EVT_BRANCH_RETRY_USER_REQ, {
        conversationFile: props.conversationFile,
        userNodeId: msg.id,
        tag,
      })
    }
  } catch (error) {
    console.error(t('chat.errors.retryFailed') + ':', error)
  }
}


/* 发送状态管理 */
const isSending = ref(false)
const sendErrorMsg = ref('')
const lastSentMessageId = ref(null)
let sendErrorTimer = null
let sendSuccessTimer = null

/**
 * 提交输入（来自 InputRow），创建用户消息并保存到后端
 * 成功后才添加到列表并清空输入框
 * 失败时保留输入框内容让用户重试
 */
async function onSubmit(text) {
  const inputText = (text ?? '').trim()
  if (!inputText) return
  if (isSending.value) return

  if (!props.conversationFile || !props.conversationDoc) {
    console.error(t('chat.errors.noConversationDoc'))
    return
  }

  // 开始发送（禁用输入）
  isSending.value = true
  sendErrorMsg.value = ''
  if (sendErrorTimer) clearTimeout(sendErrorTimer)

  // 获取父节点：始终以 rawMessages 的最后一条为准（始终最新且正确）
  const rawList = Array.isArray(msgStore.rawMessages) ? msgStore.rawMessages : []
  const parentId = (rawList.length > 0 && rawList[rawList.length - 1] && rawList[rawList.length - 1].id)
    ? rawList[rawList.length - 1].id
    : null
  if (!parentId) {
    isSending.value = false
    sendErrorMsg.value = t('chat.errors.cannotDetermineParentId')
    return
  }

  const newNodeId = `n_user${Date.now()}`
  const tag = newNodeId

  // 监听发送结果（一次性）
  const offOk = Host.events.on(Message.EVT_MESSAGE_SEND_OK, async ({ conversationFile, nodeId, role, content, doc, node_updated_at, placeholder_updated_at, tag: rtag }) => {
    if (conversationFile !== props.conversationFile || nodeId !== newNodeId || rtag !== tag) return

    // 仅更新 rawMessages（因为 props.messages 是它的引用，会自动更新）
    try {
      const rawMsgs = msgStore.rawMessages || []
      const newMessage = { id: newNodeId, role: 'user', content: inputText, node_updated_at: node_updated_at || null }
      rawMsgs.push(newMessage)
      msgStore.updateRawMessages([...rawMsgs])
      
      // 设置调色板
      ensurePaletteFor(newMessage)
    } catch (_) {}

    if (doc && props.conversationDoc) {
      // append_message 现返回 active_path/latest（非完整 doc）：安全合并有效字段
      try {
        if (Array.isArray(doc.active_path)) props.conversationDoc.active_path = doc.active_path
        if (doc.nodes && typeof doc.nodes === 'object') Object.assign(props.conversationDoc.nodes || {}, doc.nodes)
        if (doc.children && typeof doc.children === 'object') Object.assign(props.conversationDoc.children || {}, doc.children)
        if (doc.roots && Array.isArray(doc.roots)) props.conversationDoc.roots = doc.roots
      } catch (_) {}
    }

    inputRowRef.value?.clearText?.()
    isSending.value = false

    // 成功反馈
    lastSentMessageId.value = newNodeId
    if (sendSuccessTimer) clearTimeout(sendSuccessTimer)
    sendSuccessTimer = setTimeout(() => {
      lastSentMessageId.value = null
      refreshIcons()
    }, 1500)

    // 滚动到底部
    nextTick(() => {
      setTimeout(() => {
        if (messageListRef.value?.$el) {
          const container = messageListRef.value.$el.querySelector('.scroll-container')
          if (container) {
            try {
              container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
            } catch (_) {
              const start = container.scrollTop
              const end = container.scrollHeight
              const dur = 420
              const t0 = performance.now()
              const ease = t => 1 - Math.pow(1 - t, 3)
              const step = (now) => {
                const p = Math.min(1, (now - t0) / dur)
                container.scrollTop = start + (end - start) * ease(p)
                if (p < 1) requestAnimationFrame(step)
              }
              requestAnimationFrame(step)
            }
          }
        }
      }, 60)
    })

    // 用 latest 直接更新分支指示，避免调用分支表；并暂存给占位节点使用
    // latest.node_id 指向占位助手节点
    if (doc && doc.latest && doc.latest.node_id) {
      const lid = doc.latest.node_id
      const lj = (doc.latest.j != null) ? doc.latest.j : null
      const ln = (doc.latest.n != null) ? doc.latest.n : null
      const newMap = {}
      if (lj != null && ln != null) newMap[lid] = { j: lj, n: ln }
      branchInfoMap.value = newMap
      pendingAssistantJN.value = (lj != null && ln != null) ? { j: lj, n: ln } : null
      
      // 触发占位助手创建事件（UI和rawMessages更新由监听器统一处理）
      const placeholderTimestamp = placeholder_updated_at || null
      if (placeholderTimestamp && lid) {
        Host.events.emit(Threaded.EVT_THREAD_ASSIST_PLACEHOLDER_CREATE, {
          conversationFile: props.conversationFile,
          tempNodeId: lid,
          node_updated_at: placeholderTimestamp
        })
      }
    }

    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  const offFail = Host.events.on(Message.EVT_MESSAGE_SEND_FAIL, ({ conversationFile, message, tag: rtag }) => {
    if (conversationFile && conversationFile !== props.conversationFile) return
    if (rtag && rtag !== tag) return

    isSending.value = false
    sendErrorMsg.value = message || t('chat.errors.sendFailed')

    if (sendErrorTimer) clearTimeout(sendErrorTimer)
    sendErrorTimer = setTimeout(() => {
      sendErrorMsg.value = ''
      refreshIcons()
    }, 2500)

    refreshIcons()

    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })

  __uiOffs.push(offOk, offFail)

  // 事件化发送请求（桥接器调用后端并广播结果）
  Host.events.emit(Message.EVT_MESSAGE_SEND_REQ, {
    conversationFile: props.conversationFile,
    parentId,
    nodeId: newNodeId,
    role: 'user',
    content: inputText,
    tag,
  })
}

function onMessageUpdate(msg) {
  // 消息更新后的回调（可选）
  console.log('Message updated:', msg.id)
  refreshIcons()
}

async function onBranchSwitched(data) {
  // 分支切换后的回调
  console.log('Branch switched:', data)
  
  // 更新本地文档
  if (data.doc && props.conversationDoc) {
    Object.assign(props.conversationDoc, data.doc)
  }
  
  // 如果仅返回了目标节点ID（删除后智能切换场景），同步更新最后一条消息的节点ID
  if (data.nodeId && props.messages && props.messages.length > 0) {
    const last = props.messages[props.messages.length - 1]
    if (last && typeof last === 'object') {
      last.id = data.nodeId
    }
  }
  
  // 无论 switch 还是 delete，切换后都重新处理视图（由路由生成最终显示内容）
  try { await msgStore.processMessagesView?.() } catch (_) {}
  
  // 清理消息对象上可能残留的临时状态属性（向后兼容）
  if (data.msg) {
    delete data.msg.waitingAI
    delete data.msg.waitingSeconds
    delete data.msg.error
    
    // 如果后台索引中有该节点的流式内容，同步到消息显示
    if (streamContentIndex.value[data.msg.id]) {
      data.msg.content = streamContentIndex.value[data.msg.id]
    }
  }
  
  // 使用事件返回的 latest 直接更新最后一条的分支指示，避免再次请求分支表
  if (data.latest && data.latest.node_id) {
    const lid = data.latest.node_id
    const lj = (data.latest.j != null) ? data.latest.j : null
    const ln = (data.latest.n != null) ? data.latest.n : null
    const newMap = {}
    if (lj != null && ln != null) newMap[lid] = { j: lj, n: ln }
    branchInfoMap.value = newMap
  } else {
    // 兜底：若没有提供 latest，则回退一次性读取分支表
    await loadBranchInfo()
  }
  
  refreshIcons()
}

 



/**
 * 判断是否是该角色的最后一条消息
 */
function isLastOfRole(msg, idx) {
  const role = msg.role
  // 从当前消息之后查找，如果没有相同角色的消息，则当前是最后一条
  for (let i = idx + 1; i < props.messages.length; i++) {
    if (props.messages[i].role === role) {
      return false
    }
  }
  return true
}

function getRenderContent(msg) {
  const sid = msg?.id
  // 仅在“该节点仍处于流式/等待中或仍有未清理的流式索引”时，使用原始累加内容
  const isStreaming = !!(sid && (nodeStates.value[sid]?.waitingAI || streamContentIndex.value[sid]))
  if (isStreaming) {
    // 打字机：优先返回可见缓冲，其次返回完整流式缓存
    return (streamVisibleIndex.value[sid] ?? streamContentIndex.value[sid] ?? msg?.content ?? '')
  }
  // 否则（已结束流式或从未流式），优先展示经过 process_messages_view 处理后的视图内容
  return msgStore.getMessageContent(sid)
}
function getDisplayParts(msg) {
  return splitHtmlFromText(getRenderContent(msg))
}

// 视口中心消息索引（用于追踪视口模式）
const viewportCenterIdx = ref(0)

// iframe 加载状态跟踪
const iframesLoading = ref(new Set())
const emit = defineEmits(['all-iframes-loaded'])

/**
 * iframe加载完成回调
 */
function onIframeLoaded(msgId) {
  iframesLoading.value.delete(msgId)
  if (iframesLoading.value.size === 0) {
    // 所有iframe都已加载完成
    nextTick(() => {
      emit('all-iframes-loaded')
    })
  }
}

/**
 * 初始化iframe加载跟踪
 */
function initIframesTracking() {
  iframesLoading.value.clear()
  props.messages.forEach((m, idx) => {
    if (shouldRenderIframe(idx) && getDisplayParts(m).html) {
      iframesLoading.value.add(m.id)
    }
  })
  
  // 如果没有需要加载的iframe，立即通知完成
  if (iframesLoading.value.size === 0) {
    nextTick(() => {
      emit('all-iframes-loaded')
    })
  }
}

/**
 * 更新视口中心消息索引
 */
function updateViewportCenter() {
  if (!messageListRef.value) return
  
  const container = messageListRef.value.$el?.querySelector('.scroll-container')
  if (!container) return
  
  const containerRect = container.getBoundingClientRect()
  const centerY = containerRect.top + containerRect.height / 2
  
  // 找到最接近视口中心的消息
  const messageElements = container.querySelectorAll('[data-message-idx]')
  let closestIdx = 0
  let minDistance = Infinity
  
  messageElements.forEach((el) => {
    const rect = el.getBoundingClientRect()
    const elementCenterY = rect.top + rect.height / 2
    const distance = Math.abs(elementCenterY - centerY)
    
    if (distance < minDistance) {
      minDistance = distance
      const idx = parseInt(el.getAttribute('data-message-idx') || '0', 10)
      closestIdx = idx
    }
  })
  
  viewportCenterIdx.value = closestIdx
}

/**
 * 判断消息是否应该渲染 iframe
 */
function shouldRenderIframe(idx) {
  const mode = appearanceStore.iframeRenderMode
  const range = appearanceStore.iframeRenderRange
  
  if (mode === 'all') {
    return true
  }
  
  const totalMessages = props.messages.length
  
  if (mode === 'track_latest') {
    const latestIdx = totalMessages - 1
    const startIdx = Math.max(0, latestIdx - range + 1)
    return idx >= startIdx
  }
  
  if (mode === 'track_viewport') {
    // 以视口中心消息为基准，前后各渲染部分
    const centerIdx = viewportCenterIdx.value
    const halfRange = Math.floor(range / 2)
    const startIdx = Math.max(0, centerIdx - halfRange)
    const endIdx = Math.min(totalMessages - 1, centerIdx + halfRange)
    
    // 如果一端不足，补充到另一端
    let actualStart = startIdx
    let actualEnd = endIdx
    
    const beforeCount = centerIdx - startIdx
    const afterCount = endIdx - centerIdx
    
    if (beforeCount < halfRange) {
      // 前面不足，补充到后面
      const deficit = halfRange - beforeCount
      actualEnd = Math.min(totalMessages - 1, actualEnd + deficit)
    } else if (afterCount < halfRange) {
      // 后面不足，补充到前面
      const deficit = halfRange - afterCount
      actualStart = Math.max(0, actualStart - deficit)
    }
    
    return idx >= actualStart && idx <= actualEnd
  }
  
  return true
}
</script>

<template>
  <div data-scope="chat-threaded" class="tch-container">
    <CustomScrollbar
      class="tch-list"
      ref="messageListRef"
      :width="8"
    >
      <div data-scope="message-list" class="tch-list-inner">
        <transition-group name="msg" tag="div" class="msg-group" appear>
            <MessageItem
              v-for="(m, idx) in props.messages"
              :key="m.id"
              :msg="m"
              :idx="idx"
              :is-last="idx === props.messages.length - 1"
              :is-last-of-role="isLastOfRole(m, idx)"
              :split-before="getDisplayParts(m).before"
              :split-html="getDisplayParts(m).html"
              :split-after="getDisplayParts(m).after"
              :display-content="getRenderContent(m)"
              :pending-active="false"
              :pending-seconds="0"
              :waiting-a-i="nodeStates[m.id]?.waitingAI || false"
              :waiting-seconds="nodeStates[m.id]?.waitingSeconds || 0"
              :node-error="nodeStates[m.id]?.error || null"
              :send-status="m.id === lastSentMessageId ? 'success' : null"
              :send-message="m.id === lastSentMessageId ? t('chat.message.sendSuccess') : ''"
              :conversation-file="props.conversationFile"
              :branch-info="branchInfoMap[m.id] || null"
              :avatar-url="m.role === 'assistant' ? assistantAvatarUrl : (m.role === 'user' ? userAvatarUrl : null)"
              :display-name="m.role === 'assistant' ? characterDisplayName : (m.role === 'user' ? userDisplayName : null)"
              :badge-text="m.role === 'assistant' ? characterBadge : (m.role === 'user' ? userBadge : null)"
              :should-render-iframe="shouldRenderIframe(idx)"
              @delete="deleteMessage"
              @regenerate="regenerateMessage"
              @edit="startEdit"
              @update="onMessageUpdate"
              @branch-switched="onBranchSwitched"
              @iframe-loaded="onIframeLoaded(m.id)"
            />
        </transition-group>
      </div>
    </CustomScrollbar>

    <!-- 输入区：抽离为组件 InputRow，职责单一，便于复用与测试 -->
    <div class="input-container">
      <!-- 发送错误提示（悬浮在输入框上方，不占用布局） -->
      <transition name="error-tip">
        <div v-if="sendErrorMsg" class="send-error-tip">
          <i data-lucide="alert-circle" class="icon-14" aria-hidden="true"></i>
          <span>{{ sendErrorMsg }}</span>
        </div>
      </transition>
      
      <InputRow
        ref="inputRowRef"
        :sending="isSending"
        :pending-active="false"
        @submit="onSubmit"
      />
    </div>
  </div>
</template>

<style scoped>
/* 容器布局 */
.tch-container {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

/* 滚动列表容器（CustomScrollbar占位） */
.tch-list {
  flex: 1;
  min-height: 0;
  padding: var(--st-spacing-md);
  border: 1px solid rgba(var(--st-border), 0.9);
  border-radius: var(--st-radius-lg);
  background: rgb(var(--st-surface) / var(--st-threaded-list-bg-opacity, 0.62)) !important;
  /* 根据不透明度动态衰减玻璃效果，0 时完全无模糊/饱和 */
  backdrop-filter: blur(calc(var(--st-threaded-list-bg-opacity, 0.62) * 18px)) saturate(calc(1 + var(--st-threaded-list-bg-opacity, 0.62) * 0.6));
  -webkit-backdrop-filter: blur(calc(var(--st-threaded-list-bg-opacity, 0.62) * 18px)) saturate(calc(1 + var(--st-threaded-list-bg-opacity, 0.62) * 0.6));
  box-shadow: var(--st-shadow-sm);
  overflow: visible;
}
/* 让滚动容器包装与容器背景一致（custom-scrollbar-wrapper） */
.tch-list :deep(.custom-scrollbar-wrapper) {
  background: rgb(var(--st-surface) / var(--st-threaded-list-bg-opacity, 0.62)) !important;
  backdrop-filter: blur(calc(var(--st-threaded-list-bg-opacity, 0.62) * 18px)) saturate(calc(1 + var(--st-threaded-list-bg-opacity, 0.62) * 0.6));
  -webkit-backdrop-filter: blur(calc(var(--st-threaded-list-bg-opacity, 0.62) * 18px)) saturate(calc(1 + var(--st-threaded-list-bg-opacity, 0.62) * 0.6));
}

/* 内部容器（供过渡动画使用） */
.tch-list-inner {
  padding-right: var(--st-spacing-xs);
  padding-bottom: 24px;
}

/* transition-group 生成的容器，必须是 flex 以确保消息间隔稳定 */
/* 统一背景容器：所有消息共享一个玻璃拟态背景 */
.msg-group {
  display: flex;
  flex-direction: column;
  gap: var(--st-message-gap, var(--st-msg-gap-default, 0px));
  padding: var(--st-spacing-xl);
  border-radius: var(--st-card-radius, var(--st-radius-lg));
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-strong));
  background: rgb(var(--st-surface) / var(--st-threaded-msg-bg-opacity, 0.82)) !important;
  backdrop-filter: blur(var(--st-blur-sm));
  -webkit-backdrop-filter: blur(var(--st-blur-sm));
  box-shadow: none;
  transition: background var(--st-transition-fast) ease, border-color var(--st-transition-fast) ease;
}

/* 楼层卡（玻璃拟态） */
.floor-card {
  padding: var(--st-spacing-xl);
  border-radius: var(--st-card-radius, var(--st-radius-lg));
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-strong));
  background: rgb(var(--st-surface) / var(--st-threaded-msg-bg-opacity, 0.82)) !important;
  backdrop-filter: blur(var(--st-blur-sm));
  -webkit-backdrop-filter: blur(var(--st-blur-sm));
  box-shadow: none;
  overflow: visible; /* 确保伪元素色条与悬浮阴影不被裁剪 */
  transition: transform var(--st-transition-fast) ease, box-shadow var(--st-transition-fast) ease, background var(--st-transition-fast) ease, border-color var(--st-transition-fast) ease;
  will-change: transform, opacity, filter;
}
.floor-card:hover {
  border-color: rgba(var(--st-primary), 0.35);
  background: rgb(var(--st-surface) / var(--st-threaded-msg-bg-opacity, 0.82)) !important;
  z-index: 2;
}

/* 智能渐变色条（变量驱动，带柔和光晕），assistant/system 左侧，user 右侧 */
.floor-card { position: relative; }

.floor-card::before,
.floor-card::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0;
  width: var(--st-stripe-width, 8px);
  pointer-events: none;
  z-index: 1;
}

/* 主色条（渐变） - 默认左侧 */
.floor-card::before {
  left: 0;
  border-top-left-radius: var(--st-card-radius, var(--st-radius-lg));
  border-bottom-left-radius: var(--st-card-radius, var(--st-radius-lg));
  background: linear-gradient(180deg,
    var(--stripe-start, rgb(var(--st-primary))),
    var(--stripe-end,   rgb(var(--st-accent))));
  box-shadow: 0 0 0 1px rgba(0,0,0,0.02) inset;
}

/* 柔光外晕（与主色一致，增强高级感） */
.floor-card::after {
  left: 0;
  filter: blur(12px);
  opacity: .28;
  background: linear-gradient(180deg,
    var(--stripe-start, rgb(var(--st-primary))),
    transparent 72%);
}

/* 用户在右侧显示色条与光晕 */
.floor-card[data-role="user"]::before {
  left: auto; right: 0;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-top-right-radius: var(--st-card-radius, var(--st-radius-lg));
  border-bottom-right-radius: var(--st-card-radius, var(--st-radius-lg));
}
.floor-card[data-role="user"]::after {
  left: auto; right: 0;
}

/* 悬浮时层级提升，避免被相邻元素/容器遮挡（阴影在 .floor-card:hover） */
.floor-card:hover { z-index: 2; }

/* 楼层布局：左侧头像+徽章，右侧名称+楼层+内容 */
.floor-layout {
  display: flex;
  gap: var(--st-spacing-xl);
}

/* 左侧区域 */
.floor-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--st-spacing-md);
  flex-shrink: 0;
}

/* 右侧区域 */
.floor-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-md);
}

/* 楼层头部：名称和楼层号 */
.floor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--st-spacing-xl);
}
.header-right {
  display: inline-flex;
  align-items: center;
  gap: 0; /* chip 的 margin-right 会提供间隔 */
}
.avatar {
  width: var(--st-avatar-size, 56px);
  height: var(--st-avatar-size, 56px);
  border-radius: var(--st-radius-lg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--st-primary-contrast);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 14px rgba(0,0,0,0.08);
  user-select: none;
}
.avatar-letter {
  font-weight: 700;
  font-size: calc(var(--st-avatar-size, 56px) * 0.36);
  text-transform: uppercase;
}

/* 头像占位渐变（不同角色差异） */
.role-user {
  background: linear-gradient(135deg, var(--st-avatar-user-start, rgba(59,130,246,0.85)), var(--st-avatar-user-end, rgba(99,102,241,0.85)));
}
.role-assistant {
  background: linear-gradient(135deg, var(--st-avatar-assistant-start, rgba(14,165,233,0.85)), var(--st-avatar-assistant-end, rgba(94,234,212,0.85)));
}
.role-system {
  background: linear-gradient(135deg, var(--st-avatar-system-start, rgba(251,191,36,0.85)), var(--st-avatar-system-end, rgba(253,230,138,0.85)));
}

.name {
  font-weight: 700;
  color: rgb(var(--st-color-text));
  font-size: var(--st-name-font-size, 16px);
}

.role-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--st-badge-font-size, 11px);
  color: rgb(var(--st-color-text));
  background: rgba(var(--st-primary),0.12);
  border: 1px solid rgba(var(--st-primary),0.32);
  border-radius: 9999px;
  padding: 4px 8px;
  white-space: nowrap;
  text-align: center;
}

.floor-index-left {
  font-weight: 700;
  color: rgba(var(--st-color-text), 0.6);
  letter-spacing: .3px;
  font-size: var(--st-floor-font-size, 14px);
  text-align: center;
  margin-top: 4px;
}

/* 楼层内容 */
.floor-content {
  color: rgba(var(--st-color-text), 0.95);
  font-size: var(--st-content-font-size, 18px);
  line-height: var(--st-content-line-height, 1.75);
  letter-spacing: .2px;
  word-break: break-word;
  white-space: pre-wrap;
}
.floor-content p { margin: 0; }
.floor-content p + p { margin-top: 8px; }
.floor-content a {
  color: rgb(var(--st-primary));
  text-decoration: none;
  border-bottom: 1px dashed rgba(var(--st-primary), 0.4);
}
.floor-content a:hover { text-decoration: underline; }
.floor-content code {
  font-family: var(--st-font-mono);
  background: rgba(var(--st-color-text), 0.06);
  padding: 0 4px;
  border-radius: var(--st-radius-sm);
}
[data-theme="dark"] .floor-content code {
  background: rgba(var(--st-color-text), 0.14);
}

/* 三点菜单 */
.menu-wrapper {
  position: relative;
}

.menu-btn {
  appearance: none;
  background: transparent;
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-medium));
  color: rgba(var(--st-color-text), 0.6);
  width: var(--st-btn-sm);
  height: var(--st-btn-sm);
  border-radius: var(--st-radius-lg);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
  transition: all var(--st-transition-fast);
}

.menu-btn:hover {
  background: rgba(var(--st-surface-2), 0.8);
  border-color: rgba(var(--st-border), var(--st-border-alpha-strong));
  color: rgba(var(--st-color-text), 0.9);
}

.menu-dropdown {
  position: absolute;
  right: 100%;
  top: 0;
  margin-right: var(--st-spacing-md);
  background: rgb(var(--st-surface));
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-strong));
  border-radius: var(--st-radius-lg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: var(--st-spacing-xs);
  min-width: 120px;
  z-index: 10;
}

.menu-item {
  appearance: none;
  background: transparent;
  border: none;
  width: 100%;
  padding: var(--st-spacing-md) var(--st-spacing-xl);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--st-spacing-md);
  font-size: 13px;
  color: rgb(var(--st-color-text));
  transition: background var(--st-transition-fast);
  text-align: left;
}

.menu-item:hover {
  background: rgba(var(--st-surface-2), 0.8);
}

.menu-item.menu-danger {
  color: rgb(var(--st-color-error));
}

.menu-item.menu-danger:hover {
  background: rgba(var(--st-color-error), 0.08);
}

.menu-icon {
  font-size: 14px;
}
/* icon utilities */
.icon-14 { width: var(--st-icon-sm); height: var(--st-icon-sm); stroke: currentColor; }
.icon-16 { width: var(--st-icon-md); height: var(--st-icon-md); stroke: currentColor; }
/* a11y helper */
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0);
  white-space: nowrap; border: 0;
}

/* 菜单弹出动画 */
.menu-slide-enter-active,
.menu-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.2s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.menu-slide-enter-from,
.menu-slide-leave-to {
  opacity: 0;
  transform: translateX(8px) scale(0.95);
}

/* 分支切换器（放在页脚右侧） */
.branch-switcher {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--st-spacing-md);
}

.branch-btn {
  appearance: none;
  background: rgba(var(--st-primary), 0.08);
  border: 1px solid rgba(var(--st-primary), 0.3);
  color: rgb(var(--st-primary));
  width: var(--st-btn-md);
  height: var(--st-btn-md);
  border-radius: var(--st-radius-lg);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all var(--st-transition-fast);
}

.branch-btn:hover:not(:disabled) {
  background: rgba(var(--st-primary), 0.15);
  border-color: rgba(var(--st-primary), 0.5);
  transform: translateY(-1px);
}

.branch-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.branch-indicator {
  font-size: 13px;
  font-weight: 600;
  color: rgba(var(--st-color-text), 0.75);
  padding: 0 8px;
}

/* 楼层页脚行（左操作 + 右分支） */
.floor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--st-spacing-md);
  margin-top: var(--st-spacing-md);
  padding-top: var(--st-spacing-md);
  border-top: 1px solid rgba(var(--st-border), 0.3);
}

/* 楼层内操作按钮行（悬浮显示，居左） */
.floor-actions {
  position: relative;
  display: flex;
  justify-content: flex-start;
  gap: var(--st-spacing-md);
  opacity: 0;
  transform: translateY(4px);
  transition: opacity var(--st-transition-fast), transform var(--st-transition-normal);
}
.floor-card:hover .floor-actions {
  opacity: 1;
  transform: translateY(0);
}

/* 操作按钮样式（与工具按钮一致的设计语言） */
.act-btn {
  appearance: none;
  background: rgba(var(--st-surface-2), 0.6);
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-strong));
  color: rgba(var(--st-color-text), 0.8);
  border-radius: var(--st-radius-md);
  width: var(--st-btn-sm);
  height: var(--st-btn-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background var(--st-transition-fast), border-color var(--st-transition-fast), transform var(--st-transition-fast), box-shadow var(--st-transition-fast);
}
.act-btn:hover {
  background: rgba(var(--st-surface-2), 0.9);
  border-color: rgba(var(--st-border), 1);
  transform: translateY(-1px);
}
.act-btn:active {
  transform: translateY(0);
}
.act-btn.ghost {
  background: transparent;
  border-color: rgba(var(--st-border), 0.8);
}
.act-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--st-primary), 0.14);
  border-color: rgba(var(--st-primary), 0.6);
}

/* 成功态复制按钮 */
.act-btn.success {
  background: linear-gradient(135deg, rgba(var(--st-accent),1), rgba(var(--st-primary),1));
  color: var(--st-primary-contrast);
  border-color: transparent;
  box-shadow: 0 8px 18px rgba(0,0,0,0.12);
  transform: translateY(-1px);
}
.act-btn.success:hover {
  filter: saturate(1.05) brightness(1.03);
}

/* 复制提示气泡 */
.copy-tip {
  position: absolute;
  left: 0;
  bottom: calc(100% + var(--st-spacing-sm));
  display: inline-flex;
  align-items: center;
  gap: var(--st-spacing-sm);
  padding: var(--st-spacing-xs) var(--st-spacing-lg);
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-strong));
  border-radius: var(--st-radius-full);
  background: rgb(var(--st-surface) / 0.86);
  backdrop-filter: blur(var(--st-blur-md));
  -webkit-backdrop-filter: blur(var(--st-blur-md));
  color: rgba(var(--st-color-text), 0.95);
  box-shadow: var(--st-shadow-sm);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .2px;
  pointer-events: none;
  z-index: 2;
}

/* 复制提示动效 */
.copy-tip-enter-from,
.copy-tip-leave-to { opacity: 0; transform: translateY(4px); }
.copy-tip-enter-active,
.copy-tip-leave-active { transition: opacity var(--st-transition-fast) ease, transform var(--st-transition-normal); }

/* 输入行（玻璃拟态输入容器） */
.tch-input-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(var(--st-border), 0.9);
  border-radius: var(--st-radius-lg);
  background: rgb(var(--st-surface) / var(--st-threaded-input-bg-opacity, 0.80)) !important;
  /* 根据不透明度动态衰减玻璃效果，0 时完全无模糊/饱和 */
  backdrop-filter: blur(calc(var(--st-threaded-input-bg-opacity, 0.80) * 18px)) saturate(calc(1 + var(--st-threaded-input-bg-opacity, 0.80) * 0.6));
  -webkit-backdrop-filter: blur(calc(var(--st-threaded-input-bg-opacity, 0.80) * 18px)) saturate(calc(1 + var(--st-threaded-input-bg-opacity, 0.80) * 0.6));
  box-shadow: var(--st-shadow-sm);
  flex-shrink: 0;
  min-height: clamp(calc(var(--st-content-font-size) * 2.8 + 28px), var(--st-input-height, 100px), 100vh);
  transition: box-shadow .2s cubic-bezier(.22,.61,.36,1), border-color .2s cubic-bezier(.22,.61,.36,1), background .2s cubic-bezier(.22,.61,.36,1), transform .2s cubic-bezier(.22,.61,.36,1);
}
.tch-input-row:focus-within {
  border-color: rgba(var(--st-primary), 0.45);
  box-shadow: 0 8px 30px rgba(0,0,0,0.08), 0 0 0 3px rgba(var(--st-primary), 0.08);
  background: rgb(var(--st-surface) / var(--st-threaded-input-bg-focus-opacity, 0.86)) !important;
}

/* 工具栏按钮 */
.tch-tools-left,
.tch-tools-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tool-btn {
  appearance: none;
  background: rgba(var(--st-surface-2), 0.6);
  border: 1px solid rgba(var(--st-border), 0.9);
  color: rgba(var(--st-color-text), 0.8);
  border-radius: var(--st-radius-md);
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background .18s cubic-bezier(.22,.61,.36,1), border-color .18s cubic-bezier(.22,.61,.36,1), transform .18s cubic-bezier(.22,.61,.36,1), box-shadow .18s cubic-bezier(.22,.61,.36,1);
}
.tool-btn:hover {
  background: rgba(var(--st-surface-2), 0.9);
  border-color: rgba(var(--st-border), 1);
  transform: translateY(-1px);
}
.tool-btn:active {
  transform: translateY(0);
}
.tool-btn.ghost {
  background: transparent;
  border-color: rgba(var(--st-border), 0.8);
}
/* 圆形拓展按钮 */
.tool-btn.round {
  border-radius: 9999px;
  width: 36px;
  height: 36px;
}

.tool-btn:focus-visible,
.menu-btn:focus-visible,
.tch-send:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--st-primary), 0.14);
  border-color: rgba(var(--st-primary), 0.6);
}

/* 多行输入区域 */
.tch-input {
  width: 100%;
  min-height: calc(var(--st-content-font-size) * 2.2 + 12px);
  padding: 10px 2px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: rgb(var(--st-color-text));
  caret-color: rgb(var(--st-color-text));
  font-family: var(--st-font-body);
  font-size: var(--st-content-font-size);
  line-height: 1.6;
  resize: none;
  overflow-y: auto;
  box-sizing: border-box;
}
.tch-input::placeholder {
  color: rgba(var(--st-color-text), 0.45);
  font-size: var(--st-content-font-size);
}
.tch-input:focus {
  outline: none;
}

/* 发送按钮 */
.tch-send {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--st-radius-md);
  background: linear-gradient(135deg, rgba(var(--st-primary),1), rgba(var(--st-accent),1));
  color: var(--st-primary-contrast);
  border: 1px solid transparent;
  cursor: pointer;
  height: 36px;
  box-sizing: border-box;
  transition: filter .18s cubic-bezier(.22,.61,.36,1), transform .18s cubic-bezier(.22,.61,.36,1), box-shadow .18s cubic-bezier(.22,.61,.36,1);
}
.tch-send[aria-label="停止等待"] {
  background: linear-gradient(135deg, rgba(220,38,38,1), rgba(244,63,94,1));
}
.tch-send:hover:enabled {
  filter: saturate(1.08) brightness(1.04);
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(0,0,0,0.10);
}
.tch-send:active:enabled {
  transform: translateY(0);
}
.tch-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(10%);
}

.tch-send-text {
  font-weight: 600;
  letter-spacing: .2px;
}

/* 消息进出场动画由 MessageItem.vue 统一定义，这里不再重复定义 msg-* 相关样式 */

/* 等待占位动画（右上角 chip，位于更多操作按钮左侧） */
.pending-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--st-spacing-sm);
  padding: var(--st-spacing-xs) var(--st-spacing-lg);
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-strong));
  border-radius: var(--st-radius-full);
  background: rgb(var(--st-surface) / 0.78);
  backdrop-filter: blur(var(--st-blur-md));
  -webkit-backdrop-filter: blur(var(--st-blur-md));
  color: rgba(var(--st-color-text), 0.9);
  box-shadow: var(--st-shadow-sm);
  margin-right: var(--st-spacing-md); /* 与更多菜单按钮分隔 */
}
.chip-spinner {
  width: var(--st-chip-spinner-size, 12px);
  height: var(--st-chip-spinner-size, 12px);
  border-radius: 9999px;
  border: var(--st-chip-spinner-border, 2px) solid currentColor;
  border-top-color: transparent;
  animation: st-spin var(--st-chip-spinner-duration, 0.9s) linear infinite;
  opacity: 0.9;
}
.chip-text {
  font-size: 12px;
  font-weight: 600;
  min-width: 20px;
  text-align: center;
}

/* 等待占位动画（右下角） */
.pending-indicator {
  position: absolute;
  right: var(--st-spacing-xl);
  bottom: var(--st-spacing-lg);
  display: inline-flex;
  align-items: center;
  gap: var(--st-spacing-sm);
  padding: var(--st-spacing-sm) var(--st-spacing-md);
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-strong));
  border-radius: var(--st-radius-full);
  background: rgb(var(--st-surface) / 0.78);
  backdrop-filter: blur(var(--st-blur-lg));
  -webkit-backdrop-filter: blur(var(--st-blur-lg));
  box-shadow: var(--st-shadow-sm);
  z-index: 3;
}

.fb-spinner {
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  animation: st-spin var(--st-chip-spinner-duration, 0.9s) linear infinite;
  opacity: 0.9;
}

.pending-text {
  font-size: 12px;
  color: rgba(var(--st-color-text), 0.85);
}

@keyframes st-spin {
  to { transform: rotate(360deg); }
}

/* 减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  .msg-enter-active,
  .msg-leave-active,
  .msg-move {
    transition: none !important;
  }
  .msg-enter-from,
  .msg-enter-to,
  .msg-leave-to {
    filter: none !important;
    transform: none !important;
  }
}
/* 高级消息出现动画（更自然的入场与微超调），使用更高优先级选择器覆盖默认 */
.floor-card.msg-enter-from {
  opacity: 0;
  transform: translateY(var(--st-msg-enter-offset-y, 10px)) scale(var(--st-msg-enter-scale, 0.985));
  filter: blur(var(--st-msg-enter-blur, 10px)) saturate(var(--st-msg-enter-saturate, 0.9));
}
.floor-card.msg-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}
.floor-card.msg-enter-active {
  transition:
    opacity var(--st-msg-enter-opacity-duration, 0.34s) cubic-bezier(.22,.61,.36,1),
    transform var(--st-msg-enter-transform-duration, 0.44s) cubic-bezier(.22,.61,.36,1),
    filter var(--st-msg-enter-transform-duration, 0.44s) ease;
  will-change: opacity, transform, filter;
}

/* 轻微阶梯延时：最新的 1~3 条入场动画更靠后，营造自然"瀑布式"感觉 */
[data-scope="message-list"] .floor-card.msg-enter-active:nth-last-child(1) { transition-delay: var(--st-msg-enter-delay-1, 24ms); }
[data-scope="message-list"] .floor-card.msg-enter-active:nth-last-child(2) { transition-delay: var(--st-msg-enter-delay-2, 48ms); }
[data-scope="message-list"] .floor-card.msg-enter-active:nth-last-child(3) { transition-delay: var(--st-msg-enter-delay-3, 72ms); }

/* 输入容器 */
.input-container {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-md);
  flex-shrink: 0;
  height: auto;
  margin-bottom: var(--st-input-bottom-margin, 0px);
}

/* 发送错误提示（绝对定位在输入框上方） */
.send-error-tip {
  position: absolute;
  bottom: calc(100% + var(--st-spacing-md));
  left: 0;
  right: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--st-spacing-sm);
  padding: var(--st-spacing-lg) 14px;
  border: 1px solid rgba(var(--st-color-error), var(--st-error-tip-border-alpha, 0.5));
  border-radius: var(--st-radius-md);
  background: rgba(var(--st-color-error), var(--st-error-tip-bg-alpha, 0.12));
  backdrop-filter: blur(var(--st-blur-lg));
  -webkit-backdrop-filter: blur(var(--st-blur-lg));
  color: rgb(var(--st-color-error));
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 8px 20px rgba(var(--st-color-error), var(--st-error-tip-shadow-alpha, 0.15)), var(--st-shadow-sm);
  z-index: 10;
  pointer-events: none;
}

/* 错误提示动画（从下往上淡入） */
.error-tip-enter-from,
.error-tip-leave-to {
  opacity: 0;
  transform: translateY(var(--st-spacing-lg));
}
.error-tip-enter-active,
.error-tip-leave-active {
  transition: opacity var(--st-error-tip-enter-duration, 0.25s) ease, transform var(--st-error-tip-transform-duration, 0.28s) cubic-bezier(.22,.61,.36,1);
}

</style>