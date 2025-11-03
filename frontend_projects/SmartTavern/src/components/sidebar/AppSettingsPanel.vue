<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const props = defineProps({
  anchorLeft: { type: Number, default: 308 },
  width: { type: Number, default: 560 },
  zIndex: { type: Number, default: 59 },
  top: { type: Number, default: 64 },
  bottom: { type: Number, default: 12 },
  title: { type: String, default: '应用设置 App Settings' },
  theme: { type: String, default: 'system' } // 同步主页 Options 主题状态
})

const emit = defineEmits(['close', 'update:theme'])

const panelStyle = computed(() => ({
  position: 'fixed',
  left: props.anchorLeft + 'px',
  top: props.top + 'px',
  bottom: props.bottom + 'px',
  width: props.width + 'px',
  zIndex: String(props.zIndex),
}))

function close(){ emit('close') }

// OptionsView 同步：主题切换逻辑
const lang = ref('zh-CN')
const currentTheme = ref(props.theme || 'system')

function applyThemeToRoot(t) {
  const root = document.documentElement
  if (t === 'dark') {
    root.setAttribute('data-theme', 'dark')
  } else if (t === 'light') {
    root.setAttribute('data-theme', 'light')
  } else {
    root.removeAttribute('data-theme')
  }
}

function setTheme(t) {
  currentTheme.value = t
  applyThemeToRoot(t)
  emit('update:theme', t)
}

const activeIndex = computed(() => currentTheme.value === 'system' ? 0 : (currentTheme.value === 'light' ? 1 : 2))
const themeLabel = computed(() => currentTheme.value === 'system' ? '系统' : (currentTheme.value === 'light' ? '浅色' : '深色'))

// ============== 后端 API 地址（持久化 + 全局可用） ==============
const defaultBackend = (import.meta?.env?.VITE_API_BASE) || 'http://localhost:8050'
const backendBase = ref('')

function loadBackendBase() {
  let v = defaultBackend
  if (typeof window !== 'undefined') {
    try {
      const ls = localStorage.getItem('st.backend_base')
      if (ls && typeof ls === 'string') v = ls
      else if (window.ST_BACKEND_BASE) v = String(window.ST_BACKEND_BASE)
    } catch (_) {}
    window.ST_BACKEND_BASE = v
  }
  backendBase.value = v
}

function saveBackendBase() {
  const v = String(backendBase.value || '').trim() || defaultBackend
  if (typeof window !== 'undefined') {
    try { localStorage.setItem('st.backend_base', v) } catch (_) {}
    window.ST_BACKEND_BASE = v
  }
  backendBase.value = v
}

function resetBackendBase() {
  backendBase.value = defaultBackend
  saveBackendBase()
}

// 外部主题变化时，同步内部视图
watch(() => props.theme, (v) => {
  if (!v) return
  currentTheme.value = v
  applyThemeToRoot(v)
})

onMounted(() => {
  window.lucide?.createIcons?.()
  // 打开面板时，根据当前主题同步到根节点
  applyThemeToRoot(currentTheme.value)
  // 同步后端地址
  loadBackendBase()
})
</script>

<template>
  <div
    data-scope="appsettings-view"
    class="as-panel glass"
    :style="panelStyle"
  >
      <header class="as-header">
        <div class="as-title">
          <span class="as-icon"><i data-lucide="settings"></i></span>
          {{ props.title }}
        </div>
        <button class="as-close" type="button" title="关闭" @click="close">✕</button>
      </header>

      <CustomScrollbar class="as-body">
        <section class="home-modal-section">
          <div class="hm-title">
            <i data-lucide="settings" class="icon-20" aria-hidden="true"></i>
            <h2>选项</h2>
          </div>
          <p class="hm-desc">与主页 Options 完全一致的设置项：主题切换为“系统/浅色/深色”。</p>

          <div class="opt-panel">
            <!-- 语言（占位，保持禁用态） -->
            <div class="opt-row">
              <label class="opt-label">语言</label>
              <select class="opt-input" v-model="lang" disabled>
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English</option>
                <option value="ja-JP">日本語</option>
              </select>
            </div>

            <!-- 主题：三段按钮切换（与 OptionsView 同步实现） -->
            <div class="opt-row">
              <label class="opt-label">主题</label>
              <div class="theme-group" role="group" aria-label="Theme Switch" :style="{ '--active-index': activeIndex }">
                <div class="seg-indicator" aria-hidden="true"></div>

                <button
                  type="button"
                  class="seg-btn"
                  :class="{ active: currentTheme === 'system' }"
                  @click="setTheme('system')"
                >
                  <i data-lucide="monitor" class="icon-16" aria-hidden="true"></i>
                  <span>系统</span>
                </button>

                <button
                  type="button"
                  class="seg-btn"
                  :class="{ active: currentTheme === 'light' }"
                  @click="setTheme('light')"
                >
                  <i data-lucide="sun" class="icon-16" aria-hidden="true"></i>
                  <span>浅色</span>
                </button>

                <button
                  type="button"
                  class="seg-btn"
                  :class="{ active: currentTheme === 'dark' }"
                  @click="setTheme('dark')"
                >
                  <i data-lucide="moon" class="icon-16" aria-hidden="true"></i>
                  <span>深色</span>
                </button>
              </div>

              <div class="theme-current">
                <i data-lucide="badge-check" class="icon-16" aria-hidden="true"></i>
                <span>正在使用：{{ themeLabel }}</span>
              </div>
            </div>
            <!-- 后端 API 地址（持久化到 localStorage，键：st.backend_base） -->
            <div class="opt-row">
              <label class="opt-label">后端 API 地址</label>
              <div style="display:flex; gap:8px; align-items:center;">
                <input class="opt-input" v-model="backendBase" placeholder="http://localhost:8050" />
                <button class="seg-btn" type="button" @click="saveBackendBase">
                  <i data-lucide="save" class="icon-16" aria-hidden="true"></i><span>保存</span>
                </button>
                <button class="seg-btn" type="button" @click="resetBackendBase">
                  <i data-lucide="refresh-cw" class="icon-16" aria-hidden="true"></i><span>重置</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </CustomScrollbar>
    </div>
</template>

<style scoped>
.as-panel {
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
.as-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(var(--st-border), 0.85);
}
.as-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: rgb(var(--st-color-text));
}
.as-icon i { width: 18px; height: 18px; display: inline-block; }
.as-close {
  appearance: none;
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface-2));
  border-radius: 4px;
  padding: 6px 8px;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.22,.61,.36,1), background .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
.as-close:hover {
  background: rgb(var(--st-surface));
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

/* Body */
.as-body {
  padding: 12px;
  overflow: hidden;
}
.as-content h3 { margin: 0 0 6px; font-weight: 700; color: rgb(var(--st-color-text)); }
.as-content .muted { color: rgba(var(--st-color-text), 0.75); margin: 0 0 16px; font-size: 13px; }

/* Placeholder grid */
.as-placeholder-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.as-placeholder-card {
  border: 1px solid rgb(var(--st-border));
  border-radius: var(--st-radius-md);
  background: rgb(var(--st-surface));
  padding: 16px;
  text-align: center;
  transition: background .12s ease, border-color .12s ease, transform .12s ease, box-shadow .12s ease;
}

.as-placeholder-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--st-shadow-sm);
}

.as-placeholder-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.as-placeholder-title {
  font-weight: 700;
  color: rgb(var(--st-color-text));
  margin-bottom: 4px;
}

.as-placeholder-desc {
  font-size: 12px;
  color: rgba(var(--st-color-text), 0.7);
  line-height: 1.4;
}

@media (max-width: 640px) {
  .as-placeholder-grid { grid-template-columns: 1fr; }
}
/* ========== OptionsView 同步样式（按钮/动画/布局完整迁移） ========== */
.home-modal-section { display: grid; gap: 12px; }
.hm-title { display: flex; align-items: center; gap: 10px; }
.hm-title .icon-20 { width: 20px; height: 20px; stroke: currentColor; color: rgb(var(--st-color-text)); }
.hm-title h2 { margin: 0; font-size: 18px; font-weight: 700; color: rgb(var(--st-color-text)); }
.hm-desc { margin: 0 0 8px; font-size: 12px; color: rgba(var(--st-color-text), 0.7); }

.opt-panel {
  display: grid; gap: 12px;
  border: 1px solid rgb(var(--st-border));
  background: rgb(var(--st-surface));
  border-radius: var(--st-radius-lg);
  padding: 12px;
}

/* 行布局：左侧标签 + 右侧内容 */
.opt-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 10px; align-items: center;
}
@media (max-width: 640px) {
  .opt-row { grid-template-columns: 1fr; align-items: start; }
}

.opt-label {
  font-size: 13px; color: rgba(var(--st-color-text), .85); font-weight: 600;
}

.opt-input {
  width: 100%; padding: 8px 10px; border-radius: 8px;
  border: 1px solid rgb(var(--st-border));
  background: rgb(var(--st-surface-2));
  color: rgb(var(--st-color-text));
  opacity: .7;
}

/* 主题三段按钮（胶囊分段），含滑动指示器与动效 */
.theme-group {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: 1px solid rgba(var(--st-border), .9);
  background: rgba(var(--st-surface), .85);
  border-radius: 999px;
  overflow: hidden;
  box-shadow: var(--st-shadow-sm);
  isolation: isolate;
}

.seg-indicator {
  position: absolute;
  inset: 2px;
  width: calc((100% - 4px) / 3);
  height: calc(100% - 4px);
  border-radius: 999px;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 6px 18px rgba(96,165,250,.35);
  transform: translateX(calc(var(--active-index, 0) * 100%));
  transition: transform .28s cubic-bezier(.22,.61,.36,1), background .28s ease, box-shadow .28s ease;
  z-index: 0;
  pointer-events: none;
}

.seg-btn {
  appearance: none;
  border: 0;
  background: transparent;
  color: rgb(var(--st-color-text));
  padding: 8px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: color .18s ease, transform .18s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  z-index: 1;
}
.seg-btn:hover { transform: translateY(-1px); }
.seg-btn.active { color: rgb(var(--st-color-text)); font-weight: 700; }

.theme-current {
  margin-top: 8px;
  font-size: 12px;
  color: rgba(var(--st-color-text), .75);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.icon-16 { width: 16px; height: 16px; stroke: currentColor; }

/* 深色主题微调 */
[data-theme="dark"] .opt-input { background: rgb(var(--st-surface)); }
</style>