<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Host from '@/workflow/core/host'
import * as CatalogChannel from '@/workflow/channels/catalog'
import * as SettingsChannel from '@/workflow/channels/settings'

const props = defineProps({
  anchorLeft: { type: Number, default: 308 },
  width: { type: Number, default: 560 },
  zIndex: { type: Number, default: 59 },
  top: { type: Number, default: 64 },
  bottom: { type: Number, default: 12 },
  title: { type: String, default: '预设 Presets' },
  conversationFile: { type: String, default: null }, // 当前对话文件路径
})

const emit = defineEmits(['close','use','view','delete'])

const panelStyle = computed(() => ({
  position: 'fixed',
  left: props.anchorLeft + 'px',
  top: props.top + 'px',
  bottom: props.bottom + 'px',
  width: props.width + 'px',
  zIndex: String(props.zIndex),
}))

const usingKey = ref(null)
const settingsLoaded = ref(false)

// 使用通道响应式状态
const presets = CatalogChannel.presets
const loading = computed(() =>
  CatalogChannel.loadingStates.value.presets ||
  (props.conversationFile ? SettingsChannel.isLoading(props.conversationFile) : false)
)
const error = computed(() =>
  CatalogChannel.errorStates.value.presets ||
  (props.conversationFile ? SettingsChannel.getError(props.conversationFile) : null)
)

// 监听事件响应
let unsubscribePresets = null
let unsubscribeSettings = null

function loadData() {
  if (settingsLoaded.value) return
  
  // 请求预设列表
  Host.events.emit(CatalogChannel.EVT_CATALOG_PRESETS_REQ, {
    requestId: Date.now()
  })
  
  // 请求设置（如果有对话文件）
  if (props.conversationFile) {
    Host.events.emit(SettingsChannel.EVT_SETTINGS_GET_REQ, {
      conversationFile: props.conversationFile,
      requestId: Date.now()
    })
  } else {
    settingsLoaded.value = true
    // 如果没有对话文件，默认选第一个
    if (!usingKey.value && presets.value.length) {
      usingKey.value = presets.value[0].key
    }
  }
}

onMounted(() => {
  // 监听预设列表响应
  unsubscribePresets = Host.events.on(CatalogChannel.EVT_CATALOG_PRESETS_RES, (payload) => {
    if (payload?.success) {
      setTimeout(() => {
        try { window?.lucide?.createIcons?.() } catch (_) {}
      }, 50)
      
      // 如果没有对话文件，自动选第一个
      if (!props.conversationFile && !usingKey.value && presets.value.length) {
        usingKey.value = presets.value[0].key
      }
    }
  })
  
  // 监听设置响应
  unsubscribeSettings = Host.events.on(SettingsChannel.EVT_SETTINGS_GET_RES, (payload) => {
    if (payload?.success && payload?.conversationFile === props.conversationFile) {
      const settings = payload.settings || {}
      if (settings.preset) {
        usingKey.value = settings.preset
      } else if (!usingKey.value && presets.value.length) {
        usingKey.value = presets.value[0].key
      }
      settingsLoaded.value = true
    }
  })
})

onUnmounted(() => {
  if (unsubscribePresets) unsubscribePresets()
  if (unsubscribeSettings) unsubscribeSettings()
})

// 监听面板打开，触发懒加载
watch(() => props.conversationFile, (v) => {
  if (v && !settingsLoaded.value) {
    loadData()
  }
}, { immediate: true })

function close(){ emit('close') }

function onUse(k) {
  if (!props.conversationFile) {
    usingKey.value = k
    emit('use', k)
    return
  }
  
  // 通过事件请求更新设置
  Host.events.emit(SettingsChannel.EVT_SETTINGS_UPDATE_REQ, {
    conversationFile: props.conversationFile,
    patch: { preset: k },
    requestId: Date.now()
  })
  
  // 监听更新响应（一次性）
  const unsubUpdate = Host.events.on(SettingsChannel.EVT_SETTINGS_UPDATE_RES, (payload) => {
    if (payload?.conversationFile === props.conversationFile) {
      if (payload.success) {
        usingKey.value = k
        emit('use', k)
      }
      unsubUpdate() // 移除监听器
    }
  })
}

function onView(k){ emit('view', k) }
function onDelete(k){ emit('delete', k) }

const isLucide = (v) => typeof v === 'string' && /^[a-z\-]+$/.test(v)
</script>

<template>
  <div
    data-scope="presets-view"
    class="pr-panel glass"
    :style="panelStyle"
  >
      <header class="pr-header">
        <div class="pr-title">
          <span class="pr-icon"><i data-lucide="sliders-horizontal"></i></span>
          {{ props.title }}
        </div>
        <button class="pr-close" type="button" title="关闭" @click="close">✕</button>
      </header>

      <CustomScrollbar class="pr-body">
        <div v-if="loading" class="pr-loading">加载中...</div>
        <div v-else-if="error" class="pr-error">加载失败：{{ error }}</div>
        <div v-else class="pr-list">
          <div
            v-for="it in presets"
            :key="it.key"
            class="pr-card"
          >
            <div class="pr-main">
              <div class="pr-avatar">
                <img v-if="it.avatarUrl" :src="it.avatarUrl" alt="" class="pr-avatar-img" />
                <i v-else-if="isLucide(it.icon)" :data-lucide="it.icon"></i>
                <i v-else data-lucide="sliders-horizontal"></i>
              </div>
              <div class="pr-texts">
                <div class="pr-name">{{ it.name }}</div>
                <div class="pr-desc">{{ it.desc }}</div>
              </div>
            </div>
            <div class="pr-actions">
              <button
                class="pr-btn"
                :class="{ active: usingKey === it.key }"
                type="button"
                @click="onUse(it.key)"
                :aria-pressed="usingKey === it.key"
              >{{ usingKey === it.key ? '使用中' : '使用' }}</button>

              <button class="pr-btn" type="button" @click="onView(it.key)">查看</button>

              <button class="pr-btn pr-danger" type="button" @click="onDelete(it.key)">删除</button>
            </div>
          </div>
        </div>
      </CustomScrollbar>
    </div>
</template>

<style scoped>
.pr-panel {
  display: grid;
  grid-template-rows: auto 1fr;
  border-radius: var(--st-radius-lg);
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface));
  backdrop-filter: blur(8px) saturate(130%);
  -webkit-backdrop-filter: blur(8px) saturate(130%);
  box-shadow: var(--st-shadow-md);
  overflow: hidden;
}

/* Header */
.pr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(var(--st-border), 0.85);
}
.pr-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: rgb(var(--st-color-text));
}
.pr-icon i { width: 18px; height: 18px; display: inline-block; }
.pr-close {
  appearance: none;
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface-2));
  border-radius: 4px;
  padding: 6px 8px;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.22,.61,.36,1), background .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
.pr-close:hover {
  background: rgb(var(--st-surface));
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

/* Body */
.pr-body {
  padding: 12px;
  overflow: hidden;
}
.pr-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

/* Card */
.pr-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: stretch;
  border: 1px solid rgb(var(--st-border));
  border-radius: var(--st-radius-md);
  background: rgb(var(--st-surface));
  padding: 12px;
  min-height: 112px; /* 确保右侧三按钮完整显示，统一高度 */
  transition: background .2s cubic-bezier(.22,.61,.36,1), border-color .2s cubic-bezier(.22,.61,.36,1), transform .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
.pr-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

/* Left main */
.pr-main {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: center;
}
.pr-avatar {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: linear-gradient(135deg, rgba(var(--st-primary),0.12), rgba(var(--st-accent),0.12));
  border: 1px solid rgba(var(--st-border), 0.9);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.25);
}
.pr-avatar i { width: 18px; height: 18px; display: inline-block; }
.pr-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; }
.pr-texts { min-width: 0; }
.pr-name {
  font-weight: 700;
  color: rgb(var(--st-color-text));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pr-desc {
  margin-top: 4px;
  color: rgba(var(--st-color-text), 0.75);
  font-size: 12px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2; /* 标准属性，用于兼容性 */
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Right actions (vertical) */
.pr-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}
.pr-btn {
  appearance: none;
  border: 1px solid rgb(var(--st-border));
  background: rgb(var(--st-surface));
  color: rgb(var(--st-color-text));
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1), background .2s cubic-bezier(.22,.61,.36,1), border-color .2s cubic-bezier(.22,.61,.36,1);
  min-width: 64px;
  text-align: center;
}
.pr-btn:focus-visible,
.pr-close:focus-visible {
  outline: 2px solid rgba(var(--st-primary), 0.6);
  outline-offset: 2px;
}
.pr-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}
.pr-btn.active {
  border-color: rgba(var(--st-primary), 0.5);
  background: rgba(var(--st-primary), 0.08);
}
.pr-btn.pr-danger {
  border-color: rgba(220, 38, 38, 0.5);
  color: rgb(var(--st-color-text));
  background: rgba(220, 38, 38, 0.06);
}
.pr-btn.pr-danger:hover {
  border-color: rgba(220, 38, 38, 0.7);
  background: rgba(220, 38, 38, 0.1);
}

/* States */
.pr-loading,
.pr-error {
  padding: 12px;
  font-size: 13px;
  color: rgba(var(--st-color-text), 0.8);
}
.pr-error { color: rgb(220, 38, 38); }

@media (max-width: 640px) {
  .pr-card { grid-template-columns: 1fr; }
  .pr-actions { flex-direction: row; }
}
</style>