<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import Host from '@/workflow/core/host'
import { getHomeMenuContext } from '@/workflow/slots/homeMenu/context'
import * as Conversation from '@/workflow/channels/conversation'
import { useI18n } from '@/locales'

const { t } = useI18n()

const emit = defineEmits(['new-game', 'open-load', 'open-appearance', 'open-plugins', 'open-options'])

// 翻译按钮标签
// 优先使用 labelKey 动态翻译（支持语言切换），若无则使用静态 label
function translateLabel(btn) {
  if (btn.labelKey) {
    const translated = t(btn.labelKey)
    // 如果翻译结果不是键本身，则使用翻译
    if (translated && translated !== btn.labelKey) {
      return translated
    }
  }
  return btn.label
}

// 由后端接口 list_conversations 决定是否显示"Load Game"（事件驱动）
// - 不再依赖 localStorage；若接口失败则默认为 false
const serverHasSaves = ref(false)
const __eventOffs = [] // 事件监听清理器

async function refreshServerHasSaves() {
  const tag = `check_saves_${Date.now()}`
  
  try {
    // 监听对话列表结果（一次性）
    const offOk = Host.events.on(Conversation.EVT_CONVERSATION_LIST_OK, ({ items, tag: resTag }) => {
      if (resTag !== tag) return
      
      const arr = Array.isArray(items) ? items : []
      serverHasSaves.value = arr.length > 0
      ctxTick.value++
      
      try { offOk?.() } catch (_) {}
      try { offFail?.() } catch (_) {}
    })
    
    const offFail = Host.events.on(Conversation.EVT_CONVERSATION_LIST_FAIL, ({ tag: resTag }) => {
      if (resTag && resTag !== tag) return
      
      console.warn('[HomeMenu] list_conversations failed')
      serverHasSaves.value = false
      ctxTick.value++
      
      try { offOk?.() } catch (_) {}
      try { offFail?.() } catch (_) {}
    })
    
    __eventOffs.push(offOk, offFail)
    
    // 发送列表请求事件
    Host.events.emit(Conversation.EVT_CONVERSATION_LIST_REQ, { tag })
  } catch (e) {
    console.warn('[HomeMenu] refreshServerHasSaves error:', e)
    serverHasSaves.value = false
    ctxTick.value++
  }
}

// 从 WorkflowHost 读取开始页按钮（home-menu 插槽）
const ctxTick = ref(0)
const buttons = computed(() => {
  // 引用 ctxTick 作为依赖，使上下文变化触发重算
  void ctxTick.value
  // 以服务端 hasSaves 为准，覆盖基础上下文
  const base = getHomeMenuContext()
  const ctx = { ...base, hasSaves: !!serverHasSaves.value }
  return Host.listHomeButtons(ctx)
})

// 根据环境变化（窗口尺寸/焦点）刷新上下文；hasSaves 由后端接口决定
let __onResize = null
let __onStorage = null
let __onFocus = null
onMounted(() => {
  __onResize = () => { ctxTick.value++ }
  // storage 事件保留用于其它上下文字段刷新，但不再决定 hasSaves
  __onStorage = (e) => { if (!e || e.key === 'st:saves.count') ctxTick.value++ }
  __onFocus = () => { refreshServerHasSaves() }
  window.addEventListener('resize', __onResize)
  window.addEventListener('storage', __onStorage)
  window.addEventListener('focus', __onFocus)
  // 首次挂载主动拉取服务端会话列表
  refreshServerHasSaves()
  // 初次渲染后刷新图标
  nextTick(() => { try { window?.lucide?.createIcons?.() } catch (_) {} })
})
onUnmounted(() => {
  if (__onResize) window.removeEventListener('resize', __onResize)
  if (__onStorage) window.removeEventListener('storage', __onStorage)
  if (__onFocus) window.removeEventListener('focus', __onFocus)
  try {
    __eventOffs?.forEach(fn => { try { fn?.() } catch (_) {} })
    __eventOffs.length = 0
  } catch (_) {}
})
// 当按钮列表发生变化时，刷新图标
watch(buttons, () => nextTick(() => { try { window?.lucide?.createIcons?.() } catch (_) {} }))

function onClick(btn) {
  try {
    Host.events.emit(btn.actionId, btn.params ?? null)
  } catch (e) {
    console.warn('[HomeMenu] action emit failed:', btn?.actionId, e)
  }

  // 兼容现有父层事件（最小化改造：仍然向上传递旧事件）
  switch (btn.actionId) {
    case 'ui.home.newGame':
      emit('new-game'); break
    case 'ui.home.openLoad':
      emit('open-load'); break
    case 'ui.home.openAppearance':
      emit('open-appearance'); break
    case 'ui.home.openPlugins':
      emit('open-plugins'); break
    case 'ui.home.openOptions':
      emit('open-options'); break
    default:
      // 其他 actionId 由 Host.events.emit 处理
      break
  }

  // 刷新 lucide 图标（动态渲染后）
  nextTick(() => { try { window?.lucide?.createIcons?.() } catch (_) {} })
}
</script>

<template>
  <div class="st-home-menu">
    <nav class="home-menu">
      <button
        v-for="btn in buttons"
        :key="btn.id"
        class="menu-btn"
        type="button"
        :disabled="btn.disabled"
        @click="onClick(btn)"
      >
        <i :data-lucide="btn.icon || 'circle'" class="icon-20" aria-hidden="true"></i>
        <span>{{ translateLabel(btn) }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
/* Home vertical menu (bottom-left) - 使用百分比布局固定在左下角 */
.st-home-menu {
  position: fixed;
  left: 3%;
  bottom: 5%;
  z-index: 2;
}
.home-menu {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-xl);
}
.menu-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--st-gap-xl);
  padding: var(--st-btn-padding-xl);
  border-radius: var(--st-radius-lg);
  /* 使用硬编码 fallback 确保边框始终可见 */
  border: 1px solid var(--menu-border, rgba(255, 255, 255, 0.7));
  background: transparent; /* no white mask on home */
  /* 主页按钮固定使用白色文字，因为背景是深色图片 */
  color: var(--menu-fg, rgba(255, 255, 255, 0.95));
  text-shadow: var(--menu-shadow, 0 1px 3px rgba(0, 0, 0, 0.5));
  font-family: var(--st-font-myth);
  font-weight: 800;
  font-size: var(--st-font-3xl);
  letter-spacing: .8px;
  cursor: pointer;
  transition:
    transform var(--st-transition-fast),
    border-color var(--st-transition-fast),
    color var(--st-transition-fast),
    text-shadow var(--st-transition-fast);
}
.menu-btn:hover {
  transform: translateX(4px);
  border-color: rgba(255, 255, 255, 0.9);
  color: var(--menu-fg, rgba(255, 255, 255, 1));
}
.icon-20 { width: var(--st-icon-2xl); height: var(--st-icon-2xl); stroke: currentColor; }

/* 无历史对话时按钮禁用态：变暗且不可交互 */
.menu-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(20%);
}
.menu-btn:disabled:hover {
  transform: none;
  border-color: var(--menu-border, rgba(255, 255, 255, 0.7));
  color: var(--menu-fg, rgba(255, 255, 255, 0.95));
  text-shadow: var(--menu-shadow, 0 1px 3px rgba(0, 0, 0, 0.5));
}
</style>