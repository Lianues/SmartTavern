<script setup>
import { computed, onMounted, onUpdated } from 'vue'
import PreviewCard from './PreviewCard.vue'

const emit = defineEmits(['update:view','update:theme'])

const props = defineProps({
  view: { type: String, default: 'start' },   // 'start' | 'threaded' | 'sandbox'
  theme: { type: String, default: 'system' }  // 'system' | 'light' | 'dark'
})

// 从 Host 获取侧边栏项（动态）
const items = computed(() => {
  if (typeof window === 'undefined' || !window.STHost) return []
  try {
    // 获取侧边栏项（带上下文）
    const ctx = {
      view: props.view,
      theme: props.theme,
    }
    const list = window.STHost.listSidebarItems(ctx)
    // 转换为组件需要的格式
    return list.map(item => ({
      key: item.id,
      icon: item.icon,
      title: item.label,
      desc: item.desc || '',
      disabled: item.disabled || false,
      actionId: item.actionId,
      params: item.params || {},
    }))
  } catch (e) {
    console.warn('[SidebarNav] failed to get items:', e)
    return []
  }
})

function onClick(item) {
  if (item.disabled) return
  
  // 触发侧边栏项的事件
  if (typeof window !== 'undefined' && window.STHost && window.STHost.events) {
    try {
      window.STHost.events.emit(item.actionId, item.params || {})
    } catch (e) {
      console.warn('[SidebarNav] emit error:', e)
    }
  }
}

function gotoHome() { emit('update:view', 'start') }
function toggleMode() { emit('update:view', props.view === 'threaded' ? 'sandbox' : 'threaded') }
function toggleTheme() {
  const order = ['system','light','dark']
  const i = Math.max(0, order.indexOf(props.theme))
  emit('update:theme', order[(i+1)%order.length])
}

onMounted(() => window.lucide?.createIcons?.())
onUpdated(() => window.lucide?.createIcons?.())
</script>

<template>
  <div data-scope="sidebar-nav" class="st-sidebar-nav">
    <!-- 顶部控制栏：仅在非主页视图时显示 -->
    <div v-if="props.view !== 'start'" class="st-side-controls">
      <button class="ctrl-btn" type="button" @click="gotoHome">
        <i data-lucide="home" class="icon-16" aria-hidden="true"></i>
      </button>
      <button class="ctrl-btn" type="button" @click="toggleMode">
        <i :data-lucide="props.view === 'threaded' ? 'app-window' : 'message-square'" class="icon-16" aria-hidden="true"></i>
        <span class="ctrl-label">{{ props.view === 'threaded' ? '楼层' : '前端' }}</span>
      </button>
      <button class="ctrl-btn" type="button" @click="toggleTheme" :aria-label="`Theme: ${props.theme}`">
        <i :data-lucide="props.theme === 'dark' ? 'moon' : (props.theme === 'light' ? 'sun' : 'circle-dot')" class="icon-16" aria-hidden="true"></i>
        <span class="ctrl-label">{{ props.theme === 'dark' ? '深色' : (props.theme === 'light' ? '浅色' : '系统') }}</span>
      </button>
    </div>

    <div class="st-sidebar-title">配置预览</div>

    <div class="st-preview-grid">
      <PreviewCard
        v-for="it in items"
        :key="it.key"
        :part="`preview-${it.key}`"
        :icon="it.icon"
        :title="it.title"
        :desc="it.desc"
        :class="{ 'is-disabled': it.disabled }"
        @click="onClick(it)"
      />
    </div>

    <div class="st-sidebar-hint">
      在聊天页面右侧展示的配置入口（预览占位）
    </div>
  </div>
</template>

<style scoped>
/* 侧边栏（使用全局 Design Tokens 变量） */
.st-sidebar-nav { display: flex; flex-direction: column; gap: 12px; }
.st-sidebar-title { font-weight: 700; color: rgb(var(--st-color-text)); }
.st-sidebar-hint { font-size: 12px; color: rgba(var(--st-color-text), 0.6); }

/* 顶部控制栏 */
.st-side-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0 4px 2px;
}
.ctrl-btn {
  appearance: none;
  background: rgba(var(--st-surface), 0.35);
  backdrop-filter: blur(10px) saturate(140%);
  -webkit-backdrop-filter: blur(10px) saturate(140%);
  border: 1px solid rgba(var(--st-border), 0.9);
  color: rgba(var(--st-color-text), 0.9);
  min-height: 30px;
  padding: 6px 10px;
  border-radius: var(--st-radius-md);
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: transform .18s cubic-bezier(.22,.61,.36,1), box-shadow .18s ease, border-color .18s ease;
}
.ctrl-btn:hover { transform: translateY(-1px); box-shadow: var(--st-shadow-sm); border-color: rgba(var(--st-primary), .5); }
.ctrl-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .2px;
  color: inherit;
  user-select: none;
}

.icon-16 { width: 16px; height: 16px; stroke: currentColor; }

/* 网格 */
.st-preview-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }

/* 禁用状态 */
.is-disabled { opacity: 0.5; cursor: not-allowed; }

/* 预览卡样式已迁移到 PreviewCard.vue，Sidebar 仅保留容器与布局样式 */
</style>