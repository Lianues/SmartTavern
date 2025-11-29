<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from '@/locales'

const { t, locale, setLocale, availableLocales } = useI18n()

const props = defineProps({
  anchorLeft: { type: Number, default: 308 },
  width: { type: Number, default: 560 },
  zIndex: { type: Number, default: 59 },
  top: { type: Number, default: 64 },
  bottom: { type: Number, default: 12 },
  theme: { type: String, default: 'system' } // 同步主页 Options 主题状态
})

const emit = defineEmits(['close', 'update:theme', 'update:lang'])

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
const themeLabel = computed(() => currentTheme.value === 'system' ? t('sidebar.theme.system') : (currentTheme.value === 'light' ? t('sidebar.theme.light') : t('sidebar.theme.dark')))

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

// ============== UI 缩放（持久化 + 全局应用） ==============
const defaultUIScale = 1.0
const uiScale = ref('1.0')

function loadUIScale() {
  let v = defaultUIScale
  if (typeof window !== 'undefined') {
    try {
      const ls = localStorage.getItem('st.ui_scale')
      if (ls && typeof ls === 'string') {
        const parsed = parseFloat(ls)
        if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0) {
          v = parsed
        }
      }
    } catch (_) {}
  }
  uiScale.value = String(v)
  applyUIScale(v)
}

function applyUIScale(scale) {
  if (typeof window !== 'undefined' && document.documentElement) {
    // 使用 zoom 属性实现全局缩放（更好地处理布局和滚动条）
    document.documentElement.style.zoom = String(scale)
    // 同时设置 CSS 变量，用于高度补偿计算
    document.documentElement.style.setProperty('--st-ui-scale', String(scale))
  }
}

function saveUIScale() {
  const v = parseFloat(uiScale.value)
  if (isNaN(v) || v < 0.5 || v > 2.0) {
    // 如果输入无效，恢复为当前保存的值
    loadUIScale()
    return
  }
  if (typeof window !== 'undefined') {
    try { localStorage.setItem('st.ui_scale', String(v)) } catch (_) {}
  }
  applyUIScale(v)
}

function resetUIScale() {
  uiScale.value = String(defaultUIScale)
  saveUIScale()
}

// 外部主题变化时，同步内部视图
watch(() => props.theme, (v) => {
  if (!v) return
  currentTheme.value = v
  applyThemeToRoot(v)
})

// 语言切换处理
function handleLangChange(newLang) {
  setLocale(newLang)
  emit('update:lang', newLang)
}

onMounted(() => {
  window.lucide?.createIcons?.()
  // 打开面板时，根据当前主题同步到根节点
  applyThemeToRoot(currentTheme.value)
  // 同步后端地址
  loadBackendBase()
  // 同步 UI 缩放
  loadUIScale()
})
</script>

<template>
  <div
    data-scope="appsettings-view"
    class="as-panel glass"
    :style="panelStyle"
  >
      <header class="as-header">
        <div class="as-title st-panel-title">
          <span class="as-icon"><i data-lucide="settings"></i></span>
          {{ t('appSettings.title') }}
        </div>
        <button class="as-close" type="button" :title="t('common.close')" @click="close">✕</button>
      </header>

      <CustomScrollbar2 class="as-body">
        <section class="home-modal-section">
          <div class="hm-title">
            <i data-lucide="settings" class="icon-20" aria-hidden="true"></i>
            <h2>{{ t('appSettings.optionsTitle') }}</h2>
          </div>
          <p class="hm-desc">{{ t('appSettings.optionsDesc') }}</p>

          <div class="opt-panel">
            <!-- 语言选择 -->
            <div class="opt-row">
              <label class="opt-label">{{ t('appSettings.language.label') }}</label>
              <select
                class="opt-input opt-select"
                :value="locale"
                @change="handleLangChange($event.target.value)"
              >
                <option
                  v-for="loc in availableLocales"
                  :key="loc.code"
                  :value="loc.code"
                >
                  {{ loc.meta.nativeName }}
                </option>
              </select>
            </div>

            <!-- 主题：三段按钮切换（与 OptionsView 同步实现） -->
            <div class="opt-row">
              <label class="opt-label">{{ t('appSettings.theme.label') }}</label>
              <div class="theme-group" role="group" aria-label="Theme Switch" :style="{ '--active-index': activeIndex }">
                <div class="seg-indicator" aria-hidden="true"></div>

                <button
                  type="button"
                  class="seg-btn"
                  :class="{ active: currentTheme === 'system' }"
                  @click="setTheme('system')"
                >
                  <i data-lucide="monitor" class="icon-16" aria-hidden="true"></i>
                  <span>{{ t('sidebar.theme.system') }}</span>
                </button>

                <button
                  type="button"
                  class="seg-btn"
                  :class="{ active: currentTheme === 'light' }"
                  @click="setTheme('light')"
                >
                  <i data-lucide="sun" class="icon-16" aria-hidden="true"></i>
                  <span>{{ t('sidebar.theme.light') }}</span>
                </button>

                <button
                  type="button"
                  class="seg-btn"
                  :class="{ active: currentTheme === 'dark' }"
                  @click="setTheme('dark')"
                >
                  <i data-lucide="moon" class="icon-16" aria-hidden="true"></i>
                  <span>{{ t('sidebar.theme.dark') }}</span>
                </button>
              </div>

              <div class="theme-current">
                <i data-lucide="badge-check" class="icon-16" aria-hidden="true"></i>
                <span>{{ t('appSettings.theme.current') }}：{{ themeLabel }}</span>
              </div>
            </div>
            <!-- 后端 API 地址（持久化到 localStorage，键：st.backend_base） -->
            <div class="opt-row">
              <label class="opt-label">{{ t('appSettings.backend.label') }}</label>
              <div class="backend-input-row">
                <input class="opt-input backend-input" v-model="backendBase" :placeholder="t('appSettings.backend.placeholder')" />
                <button class="action-btn" type="button" @click="saveBackendBase">
                  <i data-lucide="save" class="icon-16" aria-hidden="true"></i>
                  <span>{{ t('common.save') }}</span>
                </button>
                <button class="action-btn" type="button" @click="resetBackendBase">
                  <i data-lucide="refresh-cw" class="icon-16" aria-hidden="true"></i>
                  <span>{{ t('common.reset') }}</span>
                </button>
              </div>
            </div>

            <!-- UI 缩放（持久化到 localStorage，键：st.ui_scale） -->
            <div class="opt-row">
              <label class="opt-label">{{ t('appSettings.uiScale.label') }}</label>
              <div class="backend-input-row">
                <input
                  class="opt-input backend-input"
                  v-model="uiScale"
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="2.0"
                  :placeholder="t('appSettings.uiScale.placeholder')"
                  :title="t('appSettings.uiScale.hint')"
                />
                <button class="action-btn" type="button" @click="saveUIScale">
                  <i data-lucide="check" class="icon-16" aria-hidden="true"></i>
                  <span>{{ t('common.apply') }}</span>
                </button>
                <button class="action-btn" type="button" @click="resetUIScale">
                  <i data-lucide="refresh-cw" class="icon-16" aria-hidden="true"></i>
                  <span>{{ t('common.reset') }}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </CustomScrollbar2>
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
}

.opt-select {
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.opt-select:hover {
  border-color: rgba(96, 165, 250, 0.6);
}

.opt-select:focus {
  outline: none;
  border-color: rgb(96, 165, 250);
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.2);
}

/* 主题三段按钮（遵循 UI 规范：中性色 + 小圆角） */
.theme-group {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: 1px solid rgba(var(--st-border), .9);
  background: rgba(var(--st-surface), .85);
  border-radius: 3px; /* 规范要求 border-radius < 4px */
  overflow: hidden;
  box-shadow: var(--st-shadow-sm);
  isolation: isolate;
}

.seg-indicator {
  position: absolute;
  inset: 2px;
  width: calc((100% - 4px) / 3);
  height: calc(100% - 4px);
  border-radius: 2px; /* 内部指示器使用更小圆角 */
  /* 使用中性灰色，遵循 60-30-10 法则 */
  background: rgba(60, 60, 70, 0.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.2), 0 2px 6px rgba(0,0,0,.08);
  transform: translateX(calc(var(--active-index, 0) * 100%));
  transition: transform .28s cubic-bezier(.22,.61,.36,1), background .28s ease, box-shadow .28s ease;
  z-index: 0;
  pointer-events: none;
}
/* 暗色主题指示器 */
[data-theme="dark"] .seg-indicator {
  background: rgba(180, 180, 190, 0.16);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 2px 6px rgba(0,0,0,.15);
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

/* 后端地址输入行 */
.backend-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: nowrap; /* 不换行，强制在一行 */
}
.backend-input {
  flex: 1 1 auto; /* 可伸缩 */
  min-width: 120px; /* 降低最小宽度，允许被压缩 */
}

/* 独立操作按钮（保存/重置） */
.action-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  flex-shrink: 0; /* 按钮不被压缩 */
  white-space: nowrap; /* 防止文字换行 */
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--st-color-text));
  background: rgb(var(--st-surface-2));
  border: 1px solid rgba(var(--st-border), 0.9);
  border-radius: 3px;
  cursor: pointer;
  transition: background .18s ease, border-color .18s ease, transform .18s ease, box-shadow .18s ease;
}
.action-btn:hover {
  background: rgb(var(--st-surface));
  border-color: rgba(var(--st-border), 1);
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}
.action-btn:active {
  transform: translateY(0);
  box-shadow: none;
}
[data-theme="dark"] .action-btn {
  background: rgba(var(--st-surface-2), 0.8);
}
[data-theme="dark"] .action-btn:hover {
  background: rgb(var(--st-surface));
}

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