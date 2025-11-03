<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import Host from '@/workflow/core/host'
import { getHomeMenuContext } from '@/workflow/slots/homeMenu/context'
import * as Conversation from '@/workflow/channels/conversation'

const emit = defineEmits(['new-game', 'open-load', 'open-gallery', 'open-options'])

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
    case 'ui.home.openGallery':
      emit('open-gallery'); break
    case 'ui.home.openOptions':
      emit('open-options'); break
    default:
      Host.pushToast?.({ type: 'info', message: `Action: ${btn.actionId}` })
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
        <span>{{ btn.label }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
/* Home vertical menu (bottom-left) */
.st-home-menu {
  position: absolute;
  left: 24px;
  bottom: 24px;
  z-index: 2;
}
.home-menu {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.menu-btn {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  border-radius: var(--st-radius-lg);
  border: 1px solid var(--menu-border, rgb(var(--st-border) /0.7));
  background: transparent; /* no white mask on home */
  color: var(--menu-fg, rgb(var(--st-color-text)));
  text-shadow: var(--menu-shadow, none);
  font-family: var(--st-font-myth);
  font-weight: 800;
  font-size: 20px;
  letter-spacing: .8px;
  cursor: pointer;
  transition:
    transform .18s cubic-bezier(.22,.61,.36,1),
    border-color .18s ease,
    color .18s ease,
    text-shadow .18s ease;
}
.menu-btn:hover {
  transform: translateX(4px);
  border-color: rgb(var(--st-primary) /0.6);
  color: var(--menu-fg, rgb(var(--st-color-text)));
}
.icon-20 { width: 26px; height: 26px; stroke: currentColor; }

/* 无历史对话时按钮禁用态：变暗且不可交互 */
.menu-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(20%);
}
.menu-btn:disabled:hover {
  transform: none;
  border-color: var(--menu-border, rgb(var(--st-border) /0.7));
  color: var(--menu-fg, rgb(var(--st-color-text)));
  text-shadow: var(--menu-shadow, none);
}
</style>