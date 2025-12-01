<script setup>
import { ref, onMounted, nextTick, onBeforeUnmount, watch } from 'vue'
import Host from '@/workflow/core/host'
import * as Conversation from '@/workflow/channels/conversation'
import ChatBranches from '@/services/chatBranches'
import DataCatalog from '@/services/dataCatalog'
import { useI18n } from '@/locales'

const { t } = useI18n()

// 通知上层所选文件（由 App 处理 API 调用与页面切换）
const emit = defineEmits(['confirm'])

/**
 * LoadGameView
 * 需求：
 *  1) 通过 data_catalog 列出对话文件（conversations）
 *  2) 并发调用 chat_branches/get_latest_message 获取每个文件的最后一条消息
 *  3) 并发读取每个对话的 settings，解析出角色卡与用户画像，并尝试加载头像与显示名称
 *  4) 汇总后一次性更新面板显示
 */

const loading = ref(false)
const error = ref('')
// items: [{ file, name, description, latest, character, persona, characterName, personaName, characterAvatarUrl, personaAvatarUrl, error? }]
const items = ref([])

function baseName(file) {
  const s = String(file || '')
  const i = s.lastIndexOf('/')
  return i >= 0 ? s.slice(i + 1) : s
}

/** POSIX 工具：统一 / 分隔符 */
function toPosix(p) {
  return String(p || '').replace(/\\/g, '/')
}

/** 取父目录（末尾一定保留 /） */
function dirname(p) {
  const s = toPosix(p)
  return s.replace(/[^/]+$/, '')
}

function characterName(characterPath) {
  const s = String(characterPath || '')
  const parts = s.split('/').filter(Boolean)
  // 目标：仅显示文件所在的目录名（如 心与露 / 用户2）
  // 路径通常形如 .../characters/心与露/character.json 或 .../personas/用户2/persona.json
  // 优先取倒数第二段（目录名），否则退回最后一段/空串
  return parts.length >= 2 ? parts[parts.length - 2] : (parts[0] || '')
}

function conversationSlug(file) {
  const s = String(file || '')
  const parts = s.split('/').filter(Boolean)
  // 目标：仅显示对话目录名（conversations/{slug}/conversation.json -> slug）
  return parts.length >= 2 ? parts[parts.length - 2] : (parts[0] || '')
}

function roleLabel(role) {
  if (role === 'user') return t('home.loadGame.roleUser')
  if (role === 'assistant') return t('home.loadGame.roleAssistant')
  if (role === 'system') return t('home.loadGame.roleSystem')
  return t('home.loadGame.roleUnknown')
}

function truncate(text, max = 160) {
  const t2 = String(text || '')
  if (t2.length <= max) return t2
  return t2.slice(0, max - 1) + '…'
}

/** 安全释放 ObjectURL，避免内存泄漏 */
function safeRevoke(url) {
  if (!url) return
  try {
    URL.revokeObjectURL(url)
  } catch (_) {}
}

/** 释放一组列表项上的头像 URL */
function releaseItemAvatars(list) {
  if (!Array.isArray(list)) return
  for (const it of list) {
    if (!it) continue
    safeRevoke(it.characterAvatarUrl)
    safeRevoke(it.personaAvatarUrl)
  }
}

const __eventOffs = [] // 事件监听清理器

onBeforeUnmount(() => {
  try {
    __eventOffs?.forEach(fn => { try { fn?.() } catch (_) {} })
    __eventOffs.length = 0
  } catch (_) {}
  try {
    releaseItemAvatars(items.value)
  } catch (_) {}
})

async function loadData() {
  loading.value = true
  error.value = ''
  // 清理旧头像 URL
  try {
    releaseItemAvatars(items.value)
  } catch (_) {}
  items.value = []
  
  const tag = `list_${Date.now()}`
  
  try {
    // 监听对话列表加载结果（一次性）
    const offOk = Host.events.on(Conversation.EVT_CONVERSATION_LIST_OK, async ({ items: rawItems, tag: resTag }) => {
      if (resTag !== tag) return
      
      try {
        // 预构造展示数据
        const combined = (rawItems || []).map(it => ({
          file: it.file,
          name: it.name || baseName(it.file),
          description: it.description || '',
          type: '', // 对话类型：'threaded' 或 'sandbox'
          latest: null,
          character: '',
          persona: '',
          characterName: '',
          personaName: '',
          characterAvatarUrl: '',
          personaAvatarUrl: '',
          error: ''
        }))

        // 一次性获取每个文件的最新消息（并发，事件驱动）
        // 若单个失败，不影响整体
        const latestPromises = combined.map((row, idx) => {
          return new Promise((resolve) => {
            const msgTag = `latest_${idx}_${Date.now()}`
            
            // 监听该文件的最新消息响应（一次性）
            const offOkLatest = Host.events.on(Conversation.EVT_CONVERSATION_LATEST_MSG_OK, ({ file: resFile, latest, tag: resTag2 }) => {
              if (resTag2 !== msgTag) return
              
              combined[idx].latest = latest
              try { offOkLatest?.() } catch (_) {}
              try { offFailLatest?.() } catch (_) {}
              resolve()
            })
            
            const offFailLatest = Host.events.on(Conversation.EVT_CONVERSATION_LATEST_MSG_FAIL, ({ file: resFile, message, tag: resTag2 }) => {
              if (resTag2 && resTag2 !== msgTag) return
              
              combined[idx].error = message || t('home.loadGame.getLatestFailed')
              try { offOkLatest?.() } catch (_) {}
              try { offFailLatest?.() } catch (_) {}
              resolve()
            })
            
            __eventOffs.push(offOkLatest, offFailLatest)
            
            // 发送最新消息请求
            Host.events.emit(Conversation.EVT_CONVERSATION_LATEST_MSG_REQ, {
              file: row.file,
              useCache: false,
              tag: msgTag
            })
          })
        })

        // 并发获取每个对话的 settings 与头像信息
        // 名称直接从路径提取目录名，无需读取后端 JSON
        const settingsPromises = combined.map((row, idx) =>
          ChatBranches.settings({ action: 'get', file: row.file })
            .then(async res => {
              const settings = res?.settings || {}
              const charFile = settings.character || ''
              const personaFile = settings.persona || ''
              const chatType = settings.type || '' // 不设置默认值

              combined[idx].character = charFile
              combined[idx].persona = personaFile
              combined[idx].type = chatType

              // 角色卡：名称直接从路径提取目录名
              if (charFile) {
                combined[idx].characterName = characterName(charFile)

                // 头像仍需从后端加载
                try {
                  const dir = dirname(charFile)
                  const { blob } = await DataCatalog.getDataAssetBlob(`${dir}character.png`)
                  combined[idx].characterAvatarUrl = URL.createObjectURL(blob)
                } catch (_) {
                  combined[idx].characterAvatarUrl = ''
                }
              } else {
                combined[idx].characterName = ''
                combined[idx].characterAvatarUrl = ''
              }

              // 用户画像：名称直接从路径提取目录名
              if (personaFile) {
                combined[idx].personaName = characterName(personaFile)

                // 头像仍需从后端加载
                try {
                  const dir = dirname(personaFile)
                  const { blob } = await DataCatalog.getDataAssetBlob(`${dir}persona.png`)
                  combined[idx].personaAvatarUrl = URL.createObjectURL(blob)
                } catch (_) {
                  combined[idx].personaAvatarUrl = ''
                }
              } else {
                combined[idx].personaName = ''
                combined[idx].personaAvatarUrl = ''
              }
            })
            .catch(() => {
              combined[idx].character = ''
              combined[idx].persona = ''
              combined[idx].characterName = ''
              combined[idx].personaName = ''
              combined[idx].characterAvatarUrl = ''
              combined[idx].personaAvatarUrl = ''
              combined[idx].type = '' // 错误时不设置默认值
            })
        )

        await Promise.allSettled([...latestPromises, ...settingsPromises])

        // 一次性更新面板
        items.value = combined

        // 刷新外部组件（图标由 watch 处理）
        nextTick(() => {
          if (typeof window.initFlowbite === 'function') {
            try { window.initFlowbite() } catch (_) {}
          }
        })
      } catch (e) {
        error.value = e?.message || t('home.loadGame.loadFailed')
      } finally {
        loading.value = false
        try { offOk?.() } catch (_) {}
        try { offFail?.() } catch (_) {}
      }
    })
    
    const offFail = Host.events.on(Conversation.EVT_CONVERSATION_LIST_FAIL, ({ message, tag: resTag }) => {
      if (resTag && resTag !== tag) return
      
      error.value = message || t('home.loadGame.loadFailed')
      loading.value = false
      try { offOk?.() } catch (_) {}
      try { offFail?.() } catch (_) {}
    })
    
    __eventOffs.push(offOk, offFail)
    
    // 发送列表请求事件
    Host.events.emit(Conversation.EVT_CONVERSATION_LIST_REQ, { tag })
  } catch (e) {
    error.value = e?.message || t('home.loadGame.loadFailed')
    loading.value = false
  }
}

/** 刷新 Lucide 图标 */
function refreshLucideIcons() {
  nextTick(() => {
    // 延迟一帧确保 DOM 完全渲染
    requestAnimationFrame(() => {
      try {
        window?.lucide?.createIcons?.()
      } catch (_) {}
    })
  })
}

// 监听 items 变化，刷新图标
watch(items, () => {
  refreshLucideIcons()
}, { flush: 'post' })

// 监听 loading 变化，数据加载完成后刷新图标
watch(loading, (newVal, oldVal) => {
  if (oldVal === true && newVal === false) {
    refreshLucideIcons()
  }
})

onMounted(() => {
  loadData()
  // 组件挂载时也尝试刷新图标
  refreshLucideIcons()
})
</script>

<template>
  <section data-scope="load-game-view" class="lgv">

    <!-- 加载时显示旋转动画 -->
    <div v-if="loading" class="lgv-loading-indicator">
      <div class="lgv-spinner"></div>
      <span class="lgv-loading-text">{{ t('common.loading') }}</span>
    </div>

    <div v-else-if="error" class="lgv-error">
      <div class="err-icon">⚠️</div>
      <div class="err-text">{{ error }}</div>
    </div>

    <transition-group v-else name="lgv" tag="div" class="lgv-list">
      <div
        v-for="it in items"
        :key="it.file"
        class="lgv-card lgv-item"
      >
        <div class="lgv-row">
          <div class="lgv-main">
            <div class="lgv-card-title">
              <div class="lgv-title-row">
                <div class="lgv-title-left">
                  <span class="lgv-file">{{ it.name }}</span>
                  <span v-if="it.type" class="lgv-type-badge" :class="'type-' + it.type">
                    {{ it.type === 'sandbox' ? t('home.newChat.typeSandbox') : t('home.newChat.typeThreaded') }}
                  </span>
                </div>
                <small class="lgv-file-path">{{ conversationSlug(it.file) }}</small>
              </div>
              <div class="lgv-participants">
                <div class="lgv-actor">
                  <div class="lgv-actor-avatar" :class="{ 'role-assistant': !it.characterAvatarUrl }">
                    <img
                      v-if="it.characterAvatarUrl"
                      :src="it.characterAvatarUrl"
                      :alt="it.characterName || characterName(it.character)"
                      loading="lazy"
                    >
                    <span v-else class="lgv-actor-initial">
                      {{ (it.characterName || characterName(it.character) || it.name || '?').slice(0, 1) }}
                    </span>
                  </div>
                  <div class="lgv-actor-body">
                    <div class="lgv-actor-role">{{ t('home.loadGame.characterCard') }}</div>
                    <div class="lgv-actor-name">
                      {{ it.characterName || characterName(it.character) || '—' }}
                    </div>
                  </div>
                </div>
                <div class="lgv-actor">
                  <div class="lgv-actor-avatar" :class="{ 'role-user': !it.personaAvatarUrl }">
                    <img
                      v-if="it.personaAvatarUrl"
                      :src="it.personaAvatarUrl"
                      :alt="it.personaName || characterName(it.persona)"
                      loading="lazy"
                    >
                    <span v-else class="lgv-actor-initial">
                      {{ (it.personaName || characterName(it.persona) || 'User').slice(0, 1) }}
                    </span>
                  </div>
                  <div class="lgv-actor-body">
                    <div class="lgv-actor-role">{{ t('home.loadGame.roleUser') }}</div>
                    <div class="lgv-actor-name">
                      {{ it.personaName || characterName(it.persona) || '—' }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="lgv-desc" v-if="it.description">
                {{ it.description }}
              </div>
            </div>

            <div v-if="it.error" class="lgv-latest error">
              <div class="err-badge">{{ t('home.loadGame.getLatestFailed') }}</div>
              <div class="err-detail">{{ it.error }}</div>
            </div>
            <div v-else-if="it.latest" class="lgv-latest">
              <div class="latest-meta">
                <span class="dim">{{ t('home.loadGame.floor') }} #{{ it.latest.depth }}</span>
                <span class="badge">{{ roleLabel(it.latest.role) }}</span>
              </div>
              <div class="latest-content">
                {{ truncate(it.latest.content, 220) }}
              </div>
            </div>
            <div v-else class="lgv-latest muted">{{ t('home.loadGame.noLatestMessage') }}</div>
          </div>
          <div class="lgv-card-actions">
            <button
              class="btn primary"
              :disabled="!!it.error"
              :title="t('home.loadGame.confirm')"
              @click="emit('confirm', it.file)"
            >
              <i data-lucide="play" class="btn-icon"></i>
              {{ t('home.loadGame.confirm') }}
            </button>
            <button
              class="btn secondary"
              :title="t('home.loadGame.delete')"
            >
              <i data-lucide="trash-2" class="btn-icon"></i>
              {{ t('home.loadGame.delete') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="items.length === 0" key="empty" class="lgv-card lgv-item lgv-empty-card">
        <div class="lgv-row">
          <div class="lgv-main">
            <div class="lgv-card-title">
              <div class="lgv-title-row">
                <span class="lgv-file lgv-empty-title">{{ t('home.loadGame.notFound') }}</span>
              </div>
              <div class="lgv-participants">
                <div class="lgv-actor lgv-actor-empty">
                  <div class="lgv-actor-avatar role-assistant">
                    <span class="lgv-actor-initial">?</span>
                  </div>
                  <div class="lgv-actor-body">
                    <div class="lgv-actor-role">{{ t('home.loadGame.characterCard') }}</div>
                    <div class="lgv-actor-name lgv-empty-placeholder">—</div>
                  </div>
                </div>
                <div class="lgv-actor lgv-actor-empty">
                  <div class="lgv-actor-avatar role-user">
                    <span class="lgv-actor-initial">?</span>
                  </div>
                  <div class="lgv-actor-body">
                    <div class="lgv-actor-role">{{ t('home.loadGame.roleUser') }}</div>
                    <div class="lgv-actor-name lgv-empty-placeholder">—</div>
                  </div>
                </div>
              </div>
              <div class="lgv-desc lgv-empty-desc">
                {{ t('home.loadGame.emptyHint') || '暂无历史对话，开始新对话后将在此处显示' }}
              </div>
            </div>
            <div class="lgv-latest muted lgv-empty-latest">{{ t('home.loadGame.noLatestMessage') }}</div>
          </div>
          <div class="lgv-card-actions lgv-empty-actions">
            <button class="btn primary" disabled>
              <i data-lucide="play" class="btn-icon"></i>
              {{ t('home.loadGame.confirm') }}
            </button>
            <button class="btn secondary" disabled>
              <i data-lucide="trash-2" class="btn-icon"></i>
              {{ t('home.loadGame.delete') }}
            </button>
          </div>
        </div>
      </div>
    </transition-group>
  </section>
</template>

<style scoped>
.icon-16 { width: var(--st-icon-md); height: var(--st-icon-md); stroke: currentColor; }

/* 容器 */
.lgv {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-2xl);
}

/* 头部样式已移除（标题在 modal-title，避免重复） */

/* 按钮：纯黑白极简风格（与 NewChatModal 一致） */
.btn {
  appearance: none;
  min-width: var(--st-btn-min-width-md);
  padding: var(--st-spacing-input-md);
  border-radius: var(--st-radius-lg);
  border: 1px solid rgba(0, 0, 0, 0.16);
  background: #ffffff;
  color: #000000;
  cursor: pointer;
  font-weight: 500;
  font-size: var(--st-font-md);
  line-height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--st-spacing-md);
  transition:
    transform 0.12s ease,
    box-shadow 0.16s ease,
    background-color 0.16s ease,
    border-color 0.16s ease;
}

[data-theme="dark"] .btn {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.26);
}

[data-theme="dark"] .btn:hover:not(:disabled) {
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.9);
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

/* 按钮图标 */
.btn-icon {
  width: var(--st-icon-md);
  height: var(--st-icon-md);
  flex-shrink: 0;
}

/* Primary：主操作按钮 */
.btn.primary {
  background: linear-gradient(135deg, #111111, #000000);
  color: #ffffff;
  border-color: #000000;
}

[data-theme="dark"] .btn.primary {
  background: linear-gradient(135deg, #ffffff, #e5e5e5);
  color: #000000;
  border-color: #ffffff;
}

/* Secondary 按钮继承基础 .btn 样式 */

/* 加载指示器（与 NewChatModal 风格一致） */
.lgv-loading-indicator {
  display: grid;
  place-items: center;
  gap: var(--st-spacing-md);
  padding: 40px var(--st-spacing-4xl);
  text-align: center;
  color: #000000;
}

[data-theme="dark"] .lgv-loading-indicator {
  color: #ffffff;
}

.lgv-spinner {
  width: var(--st-icon-3xl);
  height: var(--st-icon-3xl);
  border-radius: var(--st-radius-full);
  border: 4px solid currentColor;
  border-top-color: transparent;
  animation: lgv-spin 0.9s linear infinite;
  opacity: 0.9;
}

.lgv-loading-text {
  font-weight: 700;
  font-size: var(--st-font-xl);
}

@keyframes lgv-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 加载中的骨架卡片额外样式 */
.lgv-skel-loading {
  opacity: 0.6;
}

/* 加载与错误 */
.lgv-loading, .lgv-error {
  display: grid;
  place-items: center;
  gap: 10px;
  padding: 40px 20px;
}
.spinner {
  width: 22px; height: 22px; border-radius: 50%;
  border: 3px solid currentColor; border-top-color: transparent;
  animation: st-spin 0.9s linear infinite;
  opacity: 0.9;
}
.lgv-loading .text { color: rgba(var(--st-color-text), 0.85); }
.lgv-error .err-icon { font-size: 22px; }
.lgv-error .err-text { color: rgb(220, 38, 38); font-weight: 600; }

/* 列表与卡片 */
.lgv-list {
  display: grid;
  grid-template-columns: 1fr; /* 一行一个卡片 */
  gap: var(--st-spacing-2xl);
  max-width: none; /* 占满页面宽度 */
  width: 100%;
  margin: 0;
  padding: var(--st-spacing-2xl) var(--st-spacing-4xl); /* 页面左右内边距 */
  box-sizing: border-box;
}

/* 高级卡片（纯黑白边框风格，与 NewChatModal 一致） */
.lgv-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-xl);
  width: 100%;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: var(--st-radius-lg);
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.94),
    rgba(242, 242, 246, 0.98)
  );
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(var(--st-blur-lg)) saturate(130%);
  -webkit-backdrop-filter: blur(var(--st-blur-lg)) saturate(130%);
  padding: var(--st-spacing-3xl);
  transition:
    transform .22s cubic-bezier(.22,.61,.36,1),
    box-shadow .22s cubic-bezier(.22,.61,.36,1),
    border-color .22s cubic-bezier(.22,.61,.36,1),
    background .22s cubic-bezier(.22,.61,.36,1);
  will-change: transform, box-shadow, background, border-color;
}

[data-theme="dark"] .lgv-card {
  border-color: rgba(255, 255, 255, 0.14);
  background: linear-gradient(
    145deg,
    rgba(20, 20, 24, 0.96),
    rgba(32, 32, 38, 0.98)
  );
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85);
}

.lgv-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.16);
  border-color: rgba(0, 0, 0, 0.2);
}

[data-theme="dark"] .lgv-card:hover {
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.9);
  border-color: rgba(255, 255, 255, 0.22);
}

/* 卡片内部两列布局：左内容、右操作按钮 */
.lgv-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--st-spacing-2xl);
  align-items: stretch;
}
.lgv-main {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-xl);
  align-self: stretch;
}
.lgv-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--st-spacing-xl);
}
.lgv-title-left {
  display: flex;
  align-items: center;
  gap: var(--st-spacing-xl);
  flex-wrap: wrap;
}
.lgv-type-badge {
  display: inline-block;
  font-size: var(--st-font-xs);
  font-weight: 600;
  padding: var(--st-spacing-xs) var(--st-spacing-sm);
  border-radius: var(--st-radius-md);
  line-height: 1.2;
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.lgv-type-badge.type-threaded {
  background: rgba(59, 130, 246, 0.15);
  color: rgb(59, 130, 246);
  border: 1px solid rgba(59, 130, 246, 0.3);
}
[data-theme="dark"] .lgv-type-badge.type-threaded,
:root[data-theme="dark"] .lgv-type-badge.type-threaded {
  background: rgba(96, 165, 250, 0.2);
  color: rgb(147, 197, 253);
  border-color: rgba(96, 165, 250, 0.4);
}
.lgv-type-badge.type-sandbox {
  background: rgba(168, 85, 247, 0.15);
  color: rgb(168, 85, 247);
  border: 1px solid rgba(168, 85, 247, 0.3);
}
[data-theme="dark"] .lgv-type-badge.type-sandbox,
:root[data-theme="dark"] .lgv-type-badge.type-sandbox {
  background: rgba(192, 132, 252, 0.2);
  color: rgb(216, 180, 254);
  border-color: rgba(192, 132, 252, 0.4);
}
.lgv-participants {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--st-spacing-xl);
  margin-top: var(--st-spacing-md);
}
.lgv-actor {
  display: flex;
  align-items: center;
  gap: var(--st-spacing-xl);
  padding: var(--st-spacing-xl);
  border-radius: var(--st-radius-md);
  background: rgba(var(--st-surface-2), 0.8);
  border: 1px solid rgba(var(--st-border), 0.7);
  box-shadow: 0 1px 3px rgba(0,0,0,0.16);
}
.lgv-actor-avatar {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  overflow: hidden;
  background: rgba(var(--st-surface), 0.9);
  border: 1px solid rgba(var(--st-border), 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
}
.lgv-actor-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.lgv-actor-initial {
  font-size: var(--st-font-xl);
  font-weight: 700;
  color: rgb(var(--st-color-text));
}

/* 默认头像渐变背景（与楼层对话页面一致） */
.lgv-actor-avatar.role-user {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.85), rgba(99, 102, 241, 0.85));
  border-color: transparent;
}
.lgv-actor-avatar.role-user .lgv-actor-initial {
  color: #ffffff;
}
.lgv-actor-avatar.role-assistant {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.85), rgba(94, 234, 212, 0.85));
  border-color: transparent;
}
.lgv-actor-avatar.role-assistant .lgv-actor-initial {
  color: #ffffff;
}
.lgv-actor-body {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-xs);
  min-width: 0;
}
.lgv-actor-role {
  font-size: var(--st-font-sm);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(var(--st-color-text), 0.65);
}
.lgv-actor-name {
  font-size: var(--st-font-md);
  font-weight: 600;
  color: rgb(var(--st-color-text));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (max-width: 980px) {
  .lgv-row {
    grid-template-columns: 1fr;
    align-items: start; /* 移动端恢复顶对齐 */
  }
  .lgv-card-actions {
    flex-direction: row; /* 移动端按钮改为水平排列 */
    justify-content: flex-end;
    align-self: auto;
  }
}

/* sheen 效果已移除 */

/* 进场/离场与重排（与 <transition-group name="lgv"> 对应） */
.lgv-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.985);
  filter: blur(10px) saturate(0.94);
}
.lgv-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}
.lgv-enter-active {
  transition:
    opacity .34s cubic-bezier(.22,.61,.36,1),
    transform .42s cubic-bezier(.22,.61,.36,1),
    filter .42s ease;
  will-change: opacity, transform, filter;
}
.lgv-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.985);
  filter: blur(6px);
}
.lgv-leave-active {
  transition:
    opacity .22s ease,
    transform .26s ease,
    filter .26s ease;
}
.lgv-move {
  transition: transform .32s cubic-bezier(.22,.61,.36,1);
  will-change: transform;
}

/* 轻微阶梯延时：末尾靠后的卡片稍晚出现，营造自然瀑布感 */
.lgv-item.lgv-enter-active:nth-last-child(1) { transition-delay: 24ms; }
.lgv-item.lgv-enter-active:nth-last-child(2) { transition-delay: 48ms; }
.lgv-item.lgv-enter-active:nth-last-child(3) { transition-delay: 72ms; }

/* 骨架屏样式（高端微光） */
.lgv-skel .sk-row {
  height: 16px;
  border-radius: 8px;
  background:
    linear-gradient(90deg,
      rgba(var(--st-surface-2), 0.6) 0%,
      rgba(var(--st-surface-2), 0.85) 20%,
      rgba(var(--st-surface-2), 0.6) 40%);
  background-size: 200% 100%;
  animation: lgv-shimmer 1.4s ease-in-out infinite;
  margin: 4px 0;
}
.lgv-skel .sk-row-sm {
  height: 12px;
  border-radius: 6px;
  background:
    linear-gradient(90deg,
      rgba(var(--st-surface-2), 0.6) 0%,
      rgba(var(--st-surface-2), 0.85) 20%,
      rgba(var(--st-surface-2), 0.6) 40%);
  background-size: 200% 100%;
  animation: lgv-shimmer 1.4s ease-in-out infinite;
  margin: 2px 0;
}
.lgv-skel .sk-avatar {
  width: 100%;
  height: 100%;
  border-radius: 9999px;
  background:
    linear-gradient(90deg,
      rgba(var(--st-surface-2), 0.6) 0%,
      rgba(var(--st-surface-2), 0.85) 20%,
      rgba(var(--st-surface-2), 0.6) 40%);
  background-size: 200% 100%;
  animation: lgv-shimmer 1.4s ease-in-out infinite;
}
.lgv-skel .sk-btn {
  height: 48px;
  border-radius: var(--st-radius-md);
  background:
    linear-gradient(90deg,
      rgba(var(--st-surface-2), 0.6) 0%,
      rgba(var(--st-surface-2), 0.85) 20%,
      rgba(var(--st-surface-2), 0.6) 40%);
  background-size: 200% 100%;
  animation: lgv-shimmer 1.4s ease-in-out infinite;
}
.lgv-skel .sk-row.w-16 { width: 64px; }
.lgv-skel .sk-row.w-24 { width: 96px; }
.lgv-skel .sk-row.w-44 { width: 176px; }
.lgv-skel .sk-row.w-56 { width: 224px; }
.lgv-skel .sk-row.w-72 { width: 288px; }
.lgv-skel .sk-row-sm.w-16 { width: 64px; }
.lgv-skel .sk-row-sm.w-24 { width: 96px; }
@media (max-width: 480px) {
  .lgv-skel .sk-row.w-44 { width: 52vw; }
  .lgv-skel .sk-row.w-56 { width: 62vw; }
  .lgv-skel .sk-row.w-72 { width: 78vw; }
}
@keyframes lgv-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 可访问性焦点与按压反馈 */
.btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--st-primary), 0.18);
  border-color: rgba(var(--st-primary), 0.6);
}
.btn:active {
  transform: translateY(0);
}

.lgv-card-actions {
  display: flex;
  flex-direction: column; /* 垂直排列按钮 */
  gap: var(--st-spacing-xl); /* 增大按钮间距 */
  align-items: stretch; /* 按钮等宽 */
  justify-content: center; /* 垂直居中 */
  flex-shrink: 0;
  min-width: var(--st-btn-min-width-md); /* 按钮最小宽度 */
}
.lgv-card-title {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-xs);
  flex: 1;
  min-width: 0;
}
.lgv-file {
  font-weight: 700;
  font-size: var(--st-font-2xl); /* 增大标题字体 */
  color: rgb(var(--st-color-text));
}
.lgv-file-path {
  color: rgba(var(--st-color-text), 0.6);
  /* 使用系统等宽字体，避免外部 CDN 字体加载导致的跳变 */
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: var(--st-font-base); /* 保持稳定字号 */
  font-variant-ligatures: none; /* 进一步避免字形差异造成的视觉跳变 */
}

/* 描述 */
.lgv-desc {
  color: rgba(var(--st-color-text), 0.9);
  font-size: var(--st-font-lg); /* 增大描述字体 */
  line-height: 1.6;
}

/* 最新消息 */
.lgv-latest {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-sm);
  border-top: 1px solid rgba(var(--st-border), 0.35);
  padding-top: var(--st-spacing-md);
}
.lgv-latest .latest-meta {
  display: inline-flex;
  gap: var(--st-spacing-lg);
  align-items: center;
  flex-wrap: wrap;
}
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 var(--st-spacing-md);
  border-radius: var(--st-radius-full);
  font-size: var(--st-font-sm);
  color: rgb(var(--st-color-text));
  background: rgba(var(--st-primary), 0.12);
  border: 1px solid rgba(var(--st-primary), 0.32);
}
.dim { color: rgba(var(--st-color-text), 0.85); font-size: var(--st-font-sm); font-weight: 600; }
.muted { color: rgba(var(--st-color-text), 0.65); font-size: var(--st-font-base); }
.lgv-latest .latest-content {
  color: rgba(var(--st-color-text), 0.95);
  font-size: var(--st-font-lg); /* 增大最新消息字体 */
  line-height: 1.7;
  font-style: italic;
}
.lgv-latest.error {
  border-color: rgba(220, 38, 38, 0.45);
}
.err-badge {
  display: inline-flex; align-items: center; justify-content: center;
  height: 22px; padding: 0 var(--st-spacing-md); border-radius: var(--st-radius-full);
  font-size: var(--st-font-sm); color: rgb(220,38,38);
  background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.45);
}
.err-detail { color: rgb(220,38,38); font-size: var(--st-font-sm); }

/* 空状态卡片样式 */
.lgv-empty-card {
  opacity: 0.7;
}
.lgv-empty-card .lgv-actor-empty {
  opacity: 0.6;
}
.lgv-empty-title {
  color: rgba(var(--st-color-text), 0.7);
}
.lgv-empty-placeholder {
  color: rgba(var(--st-color-text), 0.4);
}
.lgv-empty-desc {
  color: rgba(var(--st-color-text), 0.6);
  font-style: italic;
}
.lgv-empty-latest {
  opacity: 0.5;
}
.lgv-empty-actions .btn {
  opacity: 0.5;
}

@keyframes st-spin { to { transform: rotate(360deg); } }
</style>
