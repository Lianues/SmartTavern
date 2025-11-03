<template>
  <article
    :data-scope="'message-item'"
    :data-role="msg.role"
    class="floor-card glass"
    :style="stripeStyle(msg)"
  >
    <div class="floor-layout">
      <!-- 左侧：头像、徽章、楼层号 -->
      <div class="floor-left">
        <!-- 如果有头像 URL 则显示图片，否则显示文字占位符 -->
        <div
          class="avatar"
          :class="avatarUrl ? 'avatar-img' : `role-${msg.role}`"
        >
          <img
            v-if="avatarUrl"
            :src="avatarUrl"
            :alt="`${nameOf(msg)}的头像`"
            class="avatar-image"
            @error="onAvatarError"
          />
          <span v-else class="avatar-letter">{{ nameOf(msg).charAt(0) }}</span>
        </div>
        <div class="role-badge" v-if="badgeText">{{ badgeText }}</div>
        <div class="floor-index-left" :title="'楼层序号'">#{{ idx + 1 }}</div>
      </div>

      <!-- 右侧：消息内容 -->
      <div class="floor-right">
        <header class="floor-header">
          <div class="name">{{ displayName || nameOf(msg) }}</div>
          <!-- 右侧区：状态chip + 更多操作按钮 -->
          <div class="header-right">
            <!-- 发送状态指示（优先级最高） -->
            <div v-if="sendStatus" class="status-chip" :class="`status-${sendStatus}`" aria-live="polite">
              <i v-if="sendStatus === 'sending'" data-lucide="loader-circle" class="icon-14 chip-spinner-icon" aria-hidden="true"></i>
              <i v-else-if="sendStatus === 'success'" data-lucide="check" class="icon-14" aria-hidden="true"></i>
              <i v-else-if="sendStatus === 'error'" data-lucide="x" class="icon-14" aria-hidden="true"></i>
              <span class="chip-text">{{ sendMessage }}</span>
            </div>
            <!-- 删除状态指示（优先级第二） -->
            <div v-else-if="deleteStatus" class="status-chip" :class="`status-${deleteStatus}`" aria-live="polite">
              <i v-if="deleteStatus === 'deleting'" data-lucide="loader-circle" class="icon-14 chip-spinner-icon" aria-hidden="true"></i>
              <i v-else-if="deleteStatus === 'success'" data-lucide="check" class="icon-14" aria-hidden="true"></i>
              <i v-else-if="deleteStatus === 'error'" data-lucide="x" class="icon-14" aria-hidden="true"></i>
              <span class="chip-text">{{ deleteMessage }}</span>
            </div>
            <!-- 保存状态指示 -->
            <div v-else-if="saveStatus" class="status-chip" :class="`status-${saveStatus}`" aria-live="polite">
              <i v-if="saveStatus === 'saving'" data-lucide="loader-circle" class="icon-14 chip-spinner-icon" aria-hidden="true"></i>
              <i v-else-if="saveStatus === 'success'" data-lucide="check" class="icon-14" aria-hidden="true"></i>
              <i v-else-if="saveStatus === 'error'" data-lucide="x" class="icon-14" aria-hidden="true"></i>
              <span class="chip-text">{{ saveMessage }}</span>
            </div>
            <!-- 等待占位动画（兼容旧逻辑） -->
            <div v-else-if="pendingActive" class="pending-chip" aria-live="polite">
              <span class="chip-spinner" aria-hidden="true"></span>
              <span class="chip-text">等待中...{{ pendingSeconds }}s</span>
            </div>
            <!-- 三点菜单按钮 -->
            <div class="menu-wrapper">
              <button
                class="menu-btn"
                @click.stop="toggleMenu()"
                :aria-expanded="menuOpen"
                aria-label="更多操作"
                title="更多操作"
              >
                <i data-lucide="more-vertical" class="icon-16" aria-hidden="true"></i>
                <span class="sr-only">更多</span>
              </button>
              <!-- 选项菜单（向左弹出） -->
              <transition name="menu-slide">
                <div v-if="menuOpen" class="menu-dropdown">
                  <button class="menu-item" @click="copyMessage()">
                    <i data-lucide="copy" class="icon-14" aria-hidden="true"></i>
                    复制
                  </button>
                  <button
                    v-if="isLast"
                    class="menu-item menu-danger"
                    @click="emitDelete()"
                  >
                    <i data-lucide="trash-2" class="icon-14" aria-hidden="true"></i>
                    删除
                  </button>
                </div>
              </transition>
            </div>
          </div>
        </header>

        <!-- 编辑模式：显示 textarea -->
        <section v-if="isEditing" data-part="content" class="floor-content editing">
          <textarea
            v-model="editingContent"
            class="edit-textarea"
            :disabled="saveStatus === 'saving'"
            placeholder="输入消息内容..."
            @keydown.ctrl.enter="saveEdit"
            @keydown.meta.enter="saveEdit"
            @keydown.esc="cancelEdit"
          ></textarea>
        </section>

        <!-- 正常模式：显示消息内容 -->
        <section v-else data-part="content" class="floor-content">
          <!-- 等待AI响应动画 -->
          <div v-if="waitingAI" class="waiting-box">
            <div class="waiting-spinner" aria-hidden="true"></div>
            <span class="waiting-text">等待AI响应（{{ waitingSeconds }}s）</span>
          </div>
          
          <!-- 错误框（如果节点有错误）-->
          <div v-else-if="nodeError" class="error-box">
            <div class="error-header">
              <i data-lucide="alert-circle" class="icon-16" aria-hidden="true"></i>
              <span class="error-title">AI调用失败</span>
            </div>
            <div class="error-message">{{ nodeError }}</div>
          </div>
          
          <!-- 正常内容（仅在无错误时显示）-->
          <template v-else>
            <HtmlStage
              v-if="splitHtml"
              :before="splitBefore"
              :html="splitHtml"
              :after="splitAfter"
            />
            <template v-else>
              {{ displayContent || msgStore.getMessageContent(msg.id) }}
            </template>
          </template>
        </section>

        <!-- 楼层页脚：左侧操作按钮 -->
        <div class="floor-footer">
          <!-- 编辑模式：显示保存和取消按钮 -->
          <div v-if="isEditing" class="floor-actions editing-actions">
            <button
              class="act-btn save-btn"
              @click="saveEdit"
              :disabled="saveStatus === 'saving'"
              title="保存 (Ctrl+Enter)"
              aria-label="保存"
            >
              <i data-lucide="check" class="icon-16" aria-hidden="true"></i>
            </button>
            <button
              class="act-btn cancel-btn"
              @click="cancelEdit"
              :disabled="saveStatus === 'saving'"
              title="取消 (Esc)"
              aria-label="取消"
            >
              <i data-lucide="x" class="icon-16" aria-hidden="true"></i>
            </button>
          </div>

          <!-- 正常模式：显示操作按钮 -->
          <div v-else class="floor-actions">
            <!-- 错误的 assistant 消息且是最后一条时显示重试按钮 -->
            <template v-if="nodeError && msg.role === 'assistant' && isLastOfRole">
              <button class="act-btn" @click="emitRegenerate" title="重试" aria-label="重试">
                <i data-lucide="refresh-cw" class="icon-16" aria-hidden="true"></i>
              </button>
            </template>
            
            <!-- assistant 消息（该角色最后一条）显示完整按钮（包括重试） -->
            <template v-else-if="msg.role === 'assistant' && isLastOfRole">
              <transition name="copy-tip">
                <div v-if="copied" class="copy-tip">已复制</div>
              </transition>

              <button
                class="act-btn"
                :class="{ success: copied }"
                @click="copyMessage"
                :title="copied ? '已复制' : '复制'"
                :aria-label="copied ? '已复制' : '复制'"
              >
                <i :data-lucide="copied ? 'check' : 'copy'" class="icon-16" aria-hidden="true"></i>
              </button>
              <button class="act-btn" @click="emitRegenerate" title="重试" aria-label="重试">
                <i data-lucide="refresh-cw" class="icon-16" aria-hidden="true"></i>
              </button>
              <button class="act-btn" @click="emitEdit" title="编辑" aria-label="编辑">
                <i data-lucide="pencil" class="icon-16" aria-hidden="true"></i>
              </button>
            </template>
            
            <!-- user 消息（该角色最后一条）显示复制、重试和编辑按钮 -->
            <template v-else-if="msg.role === 'user' && isLastOfRole">
              <transition name="copy-tip">
                <div v-if="copied" class="copy-tip">已复制</div>
              </transition>

              <button
                class="act-btn"
                :class="{ success: copied }"
                @click="copyMessage"
                :title="copied ? '已复制' : '复制'"
                :aria-label="copied ? '已复制' : '复制'"
              >
                <i :data-lucide="copied ? 'check' : 'copy'" class="icon-16" aria-hidden="true"></i>
              </button>
              <button class="act-btn" @click="emitRegenerate" title="重试" aria-label="重试">
                <i data-lucide="refresh-cw" class="icon-16" aria-hidden="true"></i>
              </button>
              <button class="act-btn" @click="emitEdit" title="编辑" aria-label="编辑">
                <i data-lucide="pencil" class="icon-16" aria-hidden="true"></i>
              </button>
            </template>
            
            <!-- 其他消息（非最后一条）只显示复制和编辑按钮 -->
            <template v-else>
              <transition name="copy-tip">
                <div v-if="copied" class="copy-tip">已复制</div>
              </transition>

              <button
                class="act-btn"
                :class="{ success: copied }"
                @click="copyMessage"
                :title="copied ? '已复制' : '复制'"
                :aria-label="copied ? '已复制' : '复制'"
              >
                <i :data-lucide="copied ? 'check' : 'copy'" class="icon-16" aria-hidden="true"></i>
              </button>
              <button class="act-btn" @click="emitEdit" title="编辑" aria-label="编辑">
                <i data-lucide="pencil" class="icon-16" aria-hidden="true"></i>
              </button>
            </template>
          </div>

          <!-- 右侧：分支切换器（仅最后一条消息显示） -->
          <div style="flex:1"></div>
          <div v-if="isLast && branchInfo && branchInfo.j && branchInfo.n" class="branch-switcher">
            <!-- 切换状态提示 -->
            <div v-if="switchStatus" class="status-chip" :class="`status-${switchStatus}`" aria-live="polite">
              <i v-if="switchStatus === 'switching'" data-lucide="loader-circle" class="icon-14 chip-spinner-icon" aria-hidden="true"></i>
              <i v-else-if="switchStatus === 'success'" data-lucide="check" class="icon-14" aria-hidden="true"></i>
              <span class="chip-text">{{ switchMessage }}</span>
            </div>
            
            <button
              class="branch-btn"
              @click="switchBranch('left')"
              :disabled="branchInfo.j <= 1 || switchStatus === 'switching'"
              title="切换到前一个分支"
              aria-label="前一个分支"
            >
              <i data-lucide="chevron-left" class="icon-14" aria-hidden="true"></i>
            </button>
            <div class="branch-indicator">
              {{ branchInfo.j }}/{{ branchInfo.n }}
            </div>
            <button
              class="branch-btn"
              @click="switchBranch('right')"
              :disabled="switchStatus === 'switching'"
              :title="branchInfo.j >= branchInfo.n ? '创建新分支（重试）' : '切换到下一个分支'"
              :aria-label="branchInfo.j >= branchInfo.n ? '创建新分支' : '下一个分支'"
            >
              <i data-lucide="chevron-right" class="icon-14" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import usePalette from '@/composables/usePalette'
import HtmlStage from '@/components/chat/HtmlStage.vue'
import Host from '@/workflow/core/host'
import * as Branch from '@/workflow/channels/branch'
import * as Message from '@/workflow/channels/message'
import { useMessagesStore } from '@/stores/chatMessages'

const props = defineProps({
  msg: { type: Object, required: true },
  idx: { type: Number, required: true },
  isLast: { type: Boolean, default: false },
  isLastOfRole: { type: Boolean, default: false },  // 是否是该角色的最后一条消息
  // HTML 拆分（由父组件计算传入，避免重复解析）
  splitBefore: { type: String, default: '' },
  splitHtml: { type: String, default: '' },
  splitAfter: { type: String, default: '' },
  // 直接显示内容（父组件可在流式期间传入原始累加内容）
  displayContent: { type: String, default: '' },
  // 等待态
  pendingActive: { type: Boolean, default: false },
  pendingSeconds: { type: Number, default: 0 },
  // AI等待状态（从独立状态管理器传入）
  waitingAI: { type: Boolean, default: false },
  waitingSeconds: { type: Number, default: 0 },
  // 节点错误状态（从独立状态管理器传入）
  nodeError: { type: String, default: null },
  // 发送状态（从父组件传入）
  sendStatus: { type: String, default: null },
  sendMessage: { type: String, default: '' },
  // 对话文件路径（用于编辑保存）
  conversationFile: { type: String, default: null },
  // 分支信息 { j, n }
  branchInfo: { type: Object, default: null },
  // 头像 URL（如果有则显示图片，否则显示文字占位符）
  avatarUrl: { type: String, default: null },
  // 显示名称（优先用于 assistant）
  displayName: { type: String, default: null },
  // 徽章文本（缺省不显示）
  badgeText: { type: String, default: null },
})

const msgStore = useMessagesStore()
const emit = defineEmits(['delete', 'regenerate', 'edit', 'update', 'branch-switched'])

const roleMap = { user: '用户', assistant: '助手', system: '系统' }
function roleLabel(role) { return roleMap[role] ?? '未知' }
function nameOf(msg) { return roleLabel(msg.role) }

const { ensurePaletteFor, stripeStyle } = usePalette()

// 根据头像 URL 动态提取调色板并驱动彩条渐变
async function updatePaletteFromAvatar() {
  try {
    // 将传入的 avatarUrl 同步到 msg 上，供 usePalette 使用
    props.msg.avatarUrl = props.avatarUrl || null
    await ensurePaletteFor(props.msg)
  } catch (_) {}
}
// 监听头像 URL 变化，实时更新彩条渐变；初始立即执行
watch(() => props.avatarUrl, () => { updatePaletteFromAvatar() }, { immediate: true })

// 菜单/复制/编辑态
const menuOpen = ref(false)
const copied = ref(false)
const isEditing = ref(false)
const editingContent = ref('')
const saveStatus = ref(null) // null | 'saving' | 'success' | 'error'
const saveMessage = ref('')
const deleteStatus = ref(null) // null | 'deleting' | 'success' | 'error'
const deleteMessage = ref('')
const switchStatus = ref(null) // null | 'switching' | 'success'
const switchMessage = ref('')

// 事件监听清理器集合
const __uiOffs = []

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

// 头像加载失败回退处理
function onAvatarError(e) {
  console.warn('头像加载失败，使用默认样式')
  // 移除图片元素，让文字占位符显示
  if (e.target) {
    e.target.style.display = 'none'
  }
  // 回退到角色渐变并更新彩条
  try {
    props.msg.avatarUrl = null
    // 异步更新调色板（无需等待）
    Promise.resolve(ensurePaletteFor(props.msg))
  } catch (_) {}
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
  refreshIcons()
}

function onGlobalClick(e) {
  const menuWrapper = e.target.closest('.menu-wrapper')
  if (!menuWrapper) {
    menuOpen.value = false
  }
}

onMounted(() => {
  ensurePaletteFor(props.msg)
  document.addEventListener('click', onGlobalClick)
  refreshIcons()
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onGlobalClick)
  // 清理所有事件监听器
  try {
    __uiOffs.forEach(fn => { try { fn?.() } catch (_) {} })
    __uiOffs.length = 0
  } catch (_) {}
})

function copyMessage() {
  try {
    const textToCopy = msgStore.getMessageContent(props.msg.id) || props.msg.content || ''
    navigator.clipboard.writeText(textToCopy).then(() => {
      copied.value = true
      refreshIcons()
      setTimeout(() => {
        copied.value = false
        refreshIcons()
      }, 1600)
    })
  } catch (_) {}
  menuOpen.value = false
}

async function switchBranch(direction) {
  if (switchStatus.value === 'switching') return

  if (!props.branchInfo || !props.conversationFile) {
    console.error('无法切换分支：缺少分支信息或对话文件')
    return
  }

  // 计算目标 j 值
  const currentJ = props.branchInfo.j
  const totalN = props.branchInfo.n
  let targetJ = currentJ

  if (direction === 'left') targetJ = currentJ - 1
  else if (direction === 'right') targetJ = currentJ + 1

  if (targetJ < 1) {
    console.warn(`目标分支 ${targetJ} 小于 1`)
    return
  }

  if (targetJ > totalN) {
    console.log(`已到最后分支，触发重试创建新分支`)
    emitRegenerate()
    return
  }

  switchStatus.value = 'switching'
  switchMessage.value = '切换中...'
  refreshIcons()

  const tag = `switch_${Date.now()}`
  const offOk = Host.events.on(Branch.EVT_BRANCH_SWITCH_OK, async ({ conversationFile, node, active_path, latest, tag: rtag }) => {
    if (conversationFile !== props.conversationFile || rtag !== tag) return

    if (node) {
      props.msg.id = node.node_id
      // 不再依赖 node.role，角色在兄弟分支切换中保持不变

      emit('branch-switched', {
        msg: props.msg,
        branchInfo: { j: node.j, n: node.n },
        latest,
        active_path,
      })

      await nextTick()

      switchStatus.value = 'success'
      switchMessage.value = '已切换'
      refreshIcons()

      setTimeout(() => {
        switchStatus.value = null
        switchMessage.value = ''
        refreshIcons()
      }, 1000)
    }

    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  const offFail = Host.events.on(Branch.EVT_BRANCH_SWITCH_FAIL, ({ conversationFile, message, tag: rtag }) => {
    if (conversationFile && conversationFile !== props.conversationFile) return
    if (rtag && rtag !== tag) return
    console.error('切换分支失败:', message)
    switchStatus.value = null
    switchMessage.value = ''
    refreshIcons()
    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })

  __uiOffs.push(offOk, offFail)
  Host.events.emit(Branch.EVT_BRANCH_SWITCH_REQ, { conversationFile: props.conversationFile, targetJ, tag })
}

async function emitDelete() {
  if (deleteStatus.value === 'deleting') return

  menuOpen.value = false

  if (!props.conversationFile) {
    console.error('无法删除：缺少 conversationFile')
    deleteStatus.value = 'error'
    deleteMessage.value = '缺少对话文件'
    setTimeout(() => {
      deleteStatus.value = null
      deleteMessage.value = ''
    }, 2000)
    return
  }

  deleteStatus.value = 'deleting'
  deleteMessage.value = '删除中...'
  refreshIcons()

  const tag = `delete_${Date.now()}`
  const beforeDepth = props.idx + 1

  const offOk = Host.events.on(Branch.EVT_BRANCH_DELETE_OK, ({ conversationFile, active_path, latest, switchedToNodeId, tag: rtag }) => {
    if (conversationFile !== props.conversationFile || rtag !== tag) return

    const newActivePath = Array.isArray(active_path) ? active_path : []
    const afterDepth = newActivePath.length

    if (afterDepth < beforeDepth) {
      deleteStatus.value = 'success'
      deleteMessage.value = '删除成功'
      refreshIcons()

      setTimeout(() => {
        emit('delete', { id: props.msg.id, active_path: newActivePath, latest })
        deleteStatus.value = null
        deleteMessage.value = ''
      }, 500)
    } else {
      // 新逻辑：不直接依赖完整文档，交由外层根据 active_path 刷新视图
      emit('branch-switched', { nodeId: switchedToNodeId, latest, active_path: newActivePath })
      deleteStatus.value = 'success'
      deleteMessage.value = '已切换到相邻分支'
      refreshIcons()

      setTimeout(() => {
        deleteStatus.value = null
        deleteMessage.value = ''
        refreshIcons()
      }, 1500)
    }

    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  const offFail = Host.events.on(Branch.EVT_BRANCH_DELETE_FAIL, ({ conversationFile, message, tag: rtag }) => {
    if (conversationFile && conversationFile !== props.conversationFile) return
    if (rtag && rtag !== tag) return
    console.error('删除失败:', message)
    deleteStatus.value = 'error'
    deleteMessage.value = '删除失败'
    setTimeout(() => {
      deleteStatus.value = null
      deleteMessage.value = ''
      refreshIcons()
    }, 2500)
    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })

  __uiOffs.push(offOk, offFail)
  Host.events.emit(Branch.EVT_BRANCH_DELETE_REQ, { conversationFile: props.conversationFile, nodeId: props.msg.id, tag })
}
function emitRegenerate() { emit('regenerate', props.msg) }
function emitEdit() {
  // 进入编辑模式（使用 Store 标记并读取原始内容）
  isEditing.value = true
  try { msgStore.startEdit(props.msg.id) } catch (_) {}
  editingContent.value = msgStore.getMessageContent(props.msg.id)
  refreshIcons()
}

function cancelEdit() {
  isEditing.value = false
  editingContent.value = ''
  try { msgStore.cancelEdit(props.msg.id) } catch (_) {}
  refreshIcons()
}

async function saveEdit() {
  if (saveStatus.value === 'saving') return

  const newContent = editingContent.value.trim()
  if (!newContent) {
    cancelEdit()
    return
  }

  if (!props.conversationFile) {
    console.error('无法保存编辑：缺少 conversationFile')
    saveStatus.value = 'error'
    saveMessage.value = '缺少对话文件'
    setTimeout(() => {
      saveStatus.value = null
      saveMessage.value = ''
    }, 2000)
    return
  }

  saveStatus.value = 'saving'
  saveMessage.value = '保存中...'

  const tag = `edit_${Date.now()}`
  const offOk = Host.events.on(Message.EVT_MESSAGE_EDIT_OK, ({ conversationFile, nodeId, content, doc, tag: rtag }) => {
    if (conversationFile !== props.conversationFile || nodeId !== props.msg.id || rtag !== tag) return

    props.msg.content = content
    emit('update', props.msg)
    
    isEditing.value = false
    editingContent.value = ''
    try { msgStore.finishEdit(props.msg.id) } catch (_) {}
    // 触发响应式更新：更新 rawMessages 引用，watch(newRaw) 将自动调用 user_view 处理
    try { msgStore.updateRawMessages?.([...msgStore.rawMessages]) } catch (_) {}

    saveStatus.value = 'success'
    saveMessage.value = '保存成功'
    refreshIcons()

    setTimeout(() => {
      saveStatus.value = null
      saveMessage.value = ''
      refreshIcons()
    }, 1500)

    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })
  const offFail = Host.events.on(Message.EVT_MESSAGE_EDIT_FAIL, ({ conversationFile, nodeId, message, tag: rtag }) => {
    if (conversationFile && conversationFile !== props.conversationFile) return
    if (nodeId && nodeId !== props.msg.id) return
    if (rtag && rtag !== tag) return

    console.error('保存编辑失败:', message)
    saveStatus.value = 'error'
    saveMessage.value = '保存失败'
    setTimeout(() => {
      saveStatus.value = null
      saveMessage.value = ''
    }, 2500)

    try { offOk?.() } catch (_) {}
    try { offFail?.() } catch (_) {}
  })

  __uiOffs.push(offOk, offFail)
  Host.events.emit(Message.EVT_MESSAGE_EDIT_REQ, {
    conversationFile: props.conversationFile,
    nodeId: props.msg.id,
    content: newContent,
    tag,
  })
}
</script>

<style scoped>
/* 卡片与布局（与 ThreadedChatPreview 保持一致的外观语言，自身内聚） */
.floor-card {
  padding: 12px;
  border-radius: var(--st-card-radius, var(--st-radius-lg));
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface) / var(--st-threaded-msg-bg-opacity, 0.82)) !important;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: none;
  overflow: visible;
  transition: transform .18s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease;
  will-change: transform, opacity, filter;
}
.floor-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 40px rgba(0,0,0,0.10);
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
/* 柔光外晕 */
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
.floor-card[data-role="user"]::after { left: auto; right: 0; }

/* 楼层布局 */
.floor-layout { display: flex; gap: 12px; }

/* 左侧区域 */
.floor-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
/* 右侧区域 */
.floor-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 头部与头像/徽章 */
.floor-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.header-right { display: inline-flex; align-items: center; gap: 0; }
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
  position: relative;
  overflow: hidden;
}
.avatar-letter { font-weight: 700; font-size: calc(var(--st-avatar-size, 56px) * 0.36); text-transform: uppercase; }
.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--st-radius-lg);
}
.avatar-img {
  background: transparent;
  padding: 0;
}
.role-user { background: linear-gradient(135deg, rgba(59,130,246,0.85), rgba(99,102,241,0.85)); }
.role-assistant { background: linear-gradient(135deg, rgba(14,165,233,0.85), rgba(94,234,212,0.85)); }
.role-system { background: linear-gradient(135deg, rgba(251,191,36,0.85), rgba(253,230,138,0.85)); }
.name { font-weight: 700; color: rgb(var(--st-color-text)); font-size: var(--st-name-font-size, 16px); }
.role-badge {
  display: inline-flex; align-items: center; justify-content: center;
  font-size: var(--st-badge-font-size, 11px);
  color: rgb(var(--st-color-text));
  background: rgba(var(--st-primary),0.12);
  border: 1px solid rgba(var(--st-primary),0.32);
  border-radius: 9999px; padding: 4px 8px; white-space: nowrap; text-align: center;
}
.floor-index-left {
  font-weight: 700; color: rgba(var(--st-color-text), 0.6);
  letter-spacing: .3px; font-size: var(--st-floor-font-size, 14px);
  text-align: center; margin-top: 4px;
}

/* 内容 */
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
  padding: 0 4px; border-radius: var(--st-radius-sm);
}
[data-theme="dark"] .floor-content code { background: rgba(var(--st-color-text), 0.14); }

/* 等待AI响应动画 */
.waiting-box {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: 1px solid rgba(var(--st-primary), 0.3);
  border-radius: var(--st-radius-md);
  background: rgba(var(--st-primary), 0.05);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.waiting-spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2.5px solid rgba(var(--st-primary), 0.2);
  border-top-color: rgb(var(--st-primary));
  animation: waiting-spin 0.8s linear infinite;
}

.waiting-text {
  color: rgb(var(--st-primary));
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

@keyframes waiting-spin {
  to { transform: rotate(360deg); }
}

[data-theme="dark"] .waiting-box {
  border-color: rgba(var(--st-primary), 0.4);
  background: rgba(var(--st-primary), 0.08);
}

/* 错误框样式 */
.error-box {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid rgba(220, 38, 38, 0.5);
  border-radius: var(--st-radius-md);
  background: rgba(220, 38, 38, 0.08);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.error-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: rgb(220, 38, 38);
  font-weight: 600;
  font-size: 14px;
}

.error-title {
  flex: 1;
}

.error-message {
  color: rgb(220, 38, 38);
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}

[data-theme="dark"] .error-box {
  border-color: rgba(248, 113, 113, 0.5);
  background: rgba(248, 113, 113, 0.10);
}

[data-theme="dark"] .error-header,
[data-theme="dark"] .error-message {
  color: rgb(248, 113, 113);
}

/* 编辑模式样式 */
.edit-textarea {
  width: 100%;
  min-height: 120px;
  padding: 12px;
  border: 1px solid rgba(var(--st-border), 0.9);
  border-radius: var(--st-radius-md);
  background: rgb(var(--st-surface) / 0.9);
  color: rgb(var(--st-color-text));
  font-family: var(--st-font-body);
  font-size: var(--st-content-font-size, 18px);
  line-height: var(--st-content-line-height, 1.75);
  resize: vertical;
  transition: border-color .2s ease, box-shadow .2s ease;
}
.edit-textarea:focus {
  outline: none;
  border-color: rgba(var(--st-primary), 0.6);
  box-shadow: 0 0 0 3px rgba(var(--st-primary), 0.08);
}
.edit-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 编辑模式的操作按钮样式 */
.editing-actions {
  opacity: 1 !important;
  transform: translateY(0) !important;
}

.save-btn {
  background: linear-gradient(135deg, rgba(var(--st-accent),1), rgba(var(--st-primary),1)) !important;
  color: var(--st-primary-contrast) !important;
  border-color: transparent !important;
}
.save-btn:hover:not(:disabled) {
  filter: saturate(1.08) brightness(1.04);
  transform: translateY(-1px);
}
.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cancel-btn {
  background: rgba(220, 38, 38, 0.1) !important;
  color: rgb(220, 38, 38) !important;
  border-color: rgba(220, 38, 38, 0.4) !important;
}
.cancel-btn:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.18) !important;
  border-color: rgba(220, 38, 38, 0.6) !important;
  transform: translateY(-1px);
}
.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 菜单 */
.menu-wrapper { position: relative; }
.menu-btn {
  appearance: none; background: transparent;
  border: 1px solid rgba(var(--st-border), 0.6);
  color: rgba(var(--st-color-text), 0.6);
  width: 28px; height: 28px; border-radius: var(--st-radius-lg);
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
  font-size: 18px; line-height: 1; transition: all .18s cubic-bezier(.22,.61,.36,1);
}
.menu-btn:hover { background: rgba(var(--st-surface-2), 0.8); border-color: rgba(var(--st-border), 0.9); color: rgba(var(--st-color-text), 0.9); }
.menu-dropdown {
  position: absolute; right: 100%; top: 0; margin-right: 8px;
  background: rgb(var(--st-surface)); border: 1px solid rgba(var(--st-border), 0.9);
  border-radius: var(--st-radius-lg); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 4px; min-width: 120px; z-index: 10;
}
.menu-item {
  appearance: none; background: transparent; border: none; width: 100%;
  padding: 8px 12px; border-radius: 6px; cursor: pointer;
  display: flex; align-items: center; gap: 8px; font-size: 13px;
  color: rgb(var(--st-color-text)); transition: background .18s cubic-bezier(.22,.61,.36,1);
  text-align: left;
}
.menu-item:hover { background: rgba(var(--st-surface-2), 0.8); }
.menu-item.menu-danger { color: rgb(220, 38, 38); }
.menu-item.menu-danger:hover { background: rgba(220, 38, 38, 0.08); }

/* icon utilities & a11y */
.icon-14 { width: 14px; height: 14px; stroke: currentColor; }
.icon-16 { width: 16px; height: 16px; stroke: currentColor; }
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
/* 菜单弹出动画 */
.menu-slide-enter-active, .menu-slide-leave-active { transition: opacity 0.15s ease, transform 0.2s cubic-bezier(0.22, 0.61, 0.36, 1); }
.menu-slide-enter-from, .menu-slide-leave-to { opacity: 0; transform: translateX(8px) scale(0.95); }

/* 页脚与操作按钮 */
.floor-footer {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(var(--st-border), 0.3);
}
.floor-actions {
  position: relative; display: flex; justify-content: flex-start; gap: 8px;
  opacity: 0; transform: translateY(4px);
  transition: opacity .18s cubic-bezier(.22,.61,.36,1), transform .2s cubic-bezier(.22,.61,.36,1);
}
.floor-card:hover .floor-actions { opacity: 1; transform: translateY(0); }

.act-btn {
  appearance: none; background: rgba(var(--st-surface-2), 0.6);
  border: 1px solid rgba(var(--st-border), 0.9); color: rgba(var(--st-color-text), 0.8);
  border-radius: var(--st-radius-md); width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  transition: background .18s cubic-bezier(.22,.61,.36,1), border-color .18s cubic-bezier(.22,.61,.36,1), transform .18s cubic-bezier(.22,.61,.36,1), box-shadow .18s cubic-bezier(.22,.61,.36,1);
}
.act-btn:hover { background: rgba(var(--st-surface-2), 0.9); border-color: rgba(var(--st-border), 1); transform: translateY(-1px); }
.act-btn:active { transform: translateY(0); }
.act-btn.ghost { background: transparent; border-color: rgba(var(--st-border), 0.8); }
.act-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(var(--st-primary), 0.14); border-color: rgba(var(--st-primary), 0.6); }

/* 成功态复制按钮 */
.act-btn.success {
  background: linear-gradient(135deg, rgba(var(--st-accent),1), rgba(var(--st-primary),1));
  color: var(--st-primary-contrast); border-color: transparent;
  box-shadow: 0 8px 18px rgba(0,0,0,0.12); transform: translateY(-1px);
}
.act-btn.success:hover { filter: saturate(1.05) brightness(1.03); }

/* 复制提示气泡 */
.copy-tip {
  position: absolute; left: 0; bottom: calc(100% + 6px);
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
  border: 1px solid rgba(var(--st-border), 0.9); border-radius: 9999px;
  background: rgb(var(--st-surface) / 0.86); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  color: rgba(var(--st-color-text), 0.95); box-shadow: var(--st-shadow-sm);
  font-size: 12px; font-weight: 600; letter-spacing: .2px; pointer-events: none; z-index: 2;
}
/* 复制提示动效 */
.copy-tip-enter-from, .copy-tip-leave-to { opacity: 0; transform: translateY(4px); }
.copy-tip-enter-active, .copy-tip-leave-active { transition: opacity .18s ease, transform .2s cubic-bezier(.22,.61,.36,1); }

/* 等待 chip */
.pending-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
  border: 1px solid rgba(var(--st-border), 0.9); border-radius: 9999px;
  background: rgb(var(--st-surface) / 0.78); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  color: rgba(var(--st-color-text), 0.9); box-shadow: var(--st-shadow-sm); margin-right: 8px;
}
.chip-spinner {
  width: 12px; height: 12px; border-radius: 9999px; border: 2px solid currentColor;
  border-top-color: transparent; animation: st-spin 0.9s linear infinite; opacity: 0.9;
}
.chip-text { font-size: 12px; font-weight: 600; min-width: 20px; text-align: center; }

/* 状态 chip（保存/发送状态反馈） */
.status-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
  border: 1px solid rgba(var(--st-border), 0.9); border-radius: 9999px;
  background: rgb(var(--st-surface) / 0.78); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  color: rgba(var(--st-color-text), 0.9); box-shadow: var(--st-shadow-sm); margin-right: 8px;
  transition: all .2s ease;
}
.status-chip.status-saving,
.status-chip.status-deleting {
  border-color: rgba(var(--st-primary), 0.4);
  background: rgba(var(--st-primary), 0.08);
  color: rgb(var(--st-primary));
}
.status-chip.status-success {
  border-color: rgba(34, 197, 94, 0.4);
  background: rgba(34, 197, 94, 0.08);
  color: rgb(34, 197, 94);
}
.status-chip.status-error {
  border-color: rgba(220, 38, 38, 0.4);
  background: rgba(220, 38, 38, 0.08);
  color: rgb(220, 38, 38);
}
.chip-spinner-icon {
  animation: st-spin 0.9s linear infinite;
}

@keyframes st-spin { to { transform: rotate(360deg); } }
/* 与父 <transition-group name="msg"> 对齐的过渡样式，使动画在根节点生效 */
.msg-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.985);
  filter: blur(8px) saturate(0.9);
}
.msg-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}
.msg-enter-active {
  transition:
    opacity .28s cubic-bezier(.22,.61,.36,1),
    transform .36s cubic-bezier(.22,.61,.36,1),
    filter .36s ease;
}
.msg-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.985);
  filter: blur(4px);
}
.msg-leave-active {
  transition:
    opacity .18s ease,
    transform .22s ease,
    filter .22s ease;
}
/* 列表重排移动过渡（transition-group v-move） */
.msg-move {
  transition: transform .32s cubic-bezier(.22,.61,.36,1);
  will-change: transform;
}

/* 高级消息出现动画（更自然的入场与微超调） */
.floor-card.msg-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.985);
  filter: blur(10px) saturate(0.9);
}
.floor-card.msg-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}
.floor-card.msg-enter-active {
  transition:
    opacity .34s cubic-bezier(.22,.61,.36,1),
    transform .44s cubic-bezier(.22,.61,.36,1),
    filter .44s ease;
  will-change: opacity, transform, filter;
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

/* 轻微阶梯延时：通过全局选择器定位列表容器内的子项 */
:global([data-scope="message-list"]) .floor-card.msg-enter-active:nth-last-child(1) { transition-delay: 24ms; }
:global([data-scope="message-list"]) .floor-card.msg-enter-active:nth-last-child(2) { transition-delay: 48ms; }
:global([data-scope="message-list"]) .floor-card.msg-enter-active:nth-last-child(3) { transition-delay: 72ms; }

/* 分支切换器容器 */
.branch-switcher {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* 分支切换按钮 */
.branch-btn {
  appearance: none;
  background: rgba(var(--st-primary), 0.08);
  border: 1px solid rgba(var(--st-primary), 0.3);
  color: rgb(var(--st-primary));
  width: 28px;
  height: 28px;
  border-radius: var(--st-radius-md);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all .18s cubic-bezier(.22,.61,.36,1);
}
.branch-btn:hover:not(:disabled) {
  background: rgba(var(--st-primary), 0.15);
  border-color: rgba(var(--st-primary), 0.5);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--st-primary), 0.15);
}
.branch-btn:active:not(:disabled) {
  transform: translateY(0);
}
.branch-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  background: rgba(var(--st-border), 0.05);
  border-color: rgba(var(--st-border), 0.2);
  color: rgba(var(--st-color-text), 0.3);
}

/* 分支指示器（显示在切换按钮中间） */
.branch-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border: 1px solid rgba(var(--st-primary), 0.35);
  border-radius: 9999px;
  background: rgba(var(--st-primary), 0.08);
  color: rgb(var(--st-primary));
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.3px;
  white-space: nowrap;
  min-width: 48px;
  text-align: center;
}
</style>