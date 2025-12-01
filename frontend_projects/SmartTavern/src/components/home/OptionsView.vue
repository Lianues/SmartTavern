<script setup>
import { ref, onMounted, watch, computed } from "vue"
import { useI18n } from '@/locales'

const { t, locale, setLocale, availableLocales } = useI18n()

const props = defineProps({
  theme: { type: String, default: "system" } // system | light | dark
})
const emit = defineEmits(["update:theme", "update:lang"])

const currentTheme = ref(props.theme || "system")

function applyThemeToRoot(t) {
  const root = document.documentElement
  if (t === "dark") {
    root.setAttribute("data-theme", "dark")
  } else if (t === "light") {
    root.setAttribute("data-theme", "light")
  } else {
    // system: 检测系统主题偏好
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)')
      root.setAttribute("data-theme", mql.matches ? "dark" : "light")
    } else {
      // 降级方案
      root.setAttribute("data-theme", "light")
    }
  }
}

function setTheme(t) {
  currentTheme.value = t
  applyThemeToRoot(t)
  emit("update:theme", t)
}

const activeIndex = computed(() => currentTheme.value === 'system' ? 0 : (currentTheme.value === 'light' ? 1 : 2))
const themeLabel = computed(() => {
  if (currentTheme.value === 'system') return t('home.options.themeSystem')
  if (currentTheme.value === 'light') return t('home.options.themeLight')
  return t('home.options.themeDark')
})

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
}

function applyUIScale(scale) {
  if (typeof window !== 'undefined' && document.documentElement) {
    document.documentElement.style.zoom = String(scale)
    document.documentElement.style.setProperty('--st-ui-scale', String(scale))
  }
}

function saveUIScale() {
  const v = parseFloat(uiScale.value)
  if (isNaN(v) || v < 0.5 || v > 2.0) {
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

onMounted(() => {
  // 初始化图标 + 根据 props.theme 同步一次根节点主题
  window.lucide?.createIcons?.()
  applyThemeToRoot(currentTheme.value)
  // 初始化后端地址
  loadBackendBase()
  // 初始化 UI 缩放
  loadUIScale()
})

// 外部主题变化时，同步内部视图
watch(() => props.theme, (v) => {
  if (!v) return
  currentTheme.value = v
  applyThemeToRoot(v)
})

// 语言切换处理
function handleLangChange(newLang) {
  setLocale(newLang)
  emit("update:lang", newLang)
}
</script>

<template>
  <section class="home-modal-section">
    <p class="hm-desc">{{ t('home.options.desc') }}</p>

    <div class="opt-panel">
      <!-- 语言选择 -->
      <div class="opt-row">
        <label class="opt-label">{{ t('home.options.language') }}</label>
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

      <!-- 主题：与侧边栏一致的三按钮切换 -->
      <div class="opt-row">
        <label class="opt-label">{{ t('home.options.theme') }}</label>
        <div class="theme-group" role="group" aria-label="Theme Switch" :style="{ '--active-index': activeIndex }">
          <div class="seg-indicator" aria-hidden="true"></div>

          <button
            type="button"
            class="seg-btn"
            :class="{ active: currentTheme === 'system' }"
            @click="setTheme('system')"
          >
            <i data-lucide="monitor" class="icon-16" aria-hidden="true"></i>
            <span>{{ t('home.options.themeSystem') }}</span>
          </button>

          <button
            type="button"
            class="seg-btn"
            :class="{ active: currentTheme === 'light' }"
            @click="setTheme('light')"
          >
            <i data-lucide="sun" class="icon-16" aria-hidden="true"></i>
            <span>{{ t('home.options.themeLight') }}</span>
          </button>

          <button
            type="button"
            class="seg-btn"
            :class="{ active: currentTheme === 'dark' }"
            @click="setTheme('dark')"
          >
            <i data-lucide="moon" class="icon-16" aria-hidden="true"></i>
            <span>{{ t('home.options.themeDark') }}</span>
          </button>
        </div>

        <div class="theme-current">
          <i data-lucide="badge-check" class="icon-16" aria-hidden="true"></i>
          <span>{{ t('home.options.themeUsing', { theme: themeLabel }) }}</span>
        </div>
      </div>

      <!-- 后端 API 地址（持久化到 localStorage，键：st.backend_base） -->
      <div class="opt-row">
        <label class="opt-label">{{ t('home.options.backendApi') }}</label>
        <div class="backend-input-row">
          <input class="opt-input backend-input" v-model="backendBase" placeholder="http://localhost:8050" />
          <button class="action-btn" type="button" @click="saveBackendBase">
            <i data-lucide="save" class="icon-16" aria-hidden="true"></i>
            <span>{{ t('home.options.save') }}</span>
          </button>
          <button class="action-btn" type="button" @click="resetBackendBase">
            <i data-lucide="refresh-cw" class="icon-16" aria-hidden="true"></i>
            <span>{{ t('home.options.reset') }}</span>
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
            <span>{{ t('home.options.reset') }}</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-modal-section { display: grid; gap: var(--st-spacing-xl); }
.hm-desc { margin: 0 0 var(--st-spacing-md); font-size: var(--st-font-sm); color: rgba(var(--st-color-text), 0.7); }

.opt-panel {
  display: grid; gap: var(--st-spacing-xl);
  border: 1px solid rgb(var(--st-border));
  background: rgb(var(--st-surface));
  border-radius: var(--st-radius-lg);
  padding: var(--st-spacing-xl);
}

/* 行布局：左侧标签 + 右侧内容 */
.opt-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: var(--st-spacing-lg); align-items: center;
}
@media (max-width: 640px) {
  .opt-row { grid-template-columns: 1fr; align-items: start; }
}

.opt-label {
  font-size: var(--st-font-base); color: rgba(var(--st-color-text), .85); font-weight: 600;
}

.opt-input {
  width: 100%; padding: var(--st-spacing-input); border-radius: var(--st-radius-input);
  border: 1px solid rgb(var(--st-border));
  background: rgb(var(--st-surface-2));
  color: rgb(var(--st-color-text));
}

.opt-select {
  cursor: pointer;
  transition: border-color var(--st-transition-normal), box-shadow var(--st-transition-normal);
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
  border-radius: var(--st-theme-switcher-radius); /* 规范要求 border-radius < 4px */
  overflow: hidden;
  box-shadow: var(--st-shadow-sm);
  isolation: isolate;
}

.seg-indicator {
  position: absolute;
  inset: var(--st-spacing-xs);
  width: calc((100% - 4px) / 3);
  height: calc(100% - 4px);
  border-radius: var(--st-radius-xs); /* 内部指示器使用更小圆角 */
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
  padding: var(--st-spacing-md) var(--st-spacing-2xl);
  font-size: var(--st-font-sm);
  cursor: pointer;
  transition: color var(--st-transition-fast), transform var(--st-transition-fast);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--st-spacing-sm);
  z-index: 1;
}
.seg-btn:hover { transform: translateY(-1px); }
.seg-btn.active { color: rgb(var(--st-color-text)); font-weight: 700; }

/* 后端地址输入行 */
.backend-input-row {
  display: flex;
  gap: var(--st-spacing-md);
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
  gap: var(--st-spacing-sm);
  padding: var(--st-spacing-md) var(--st-spacing-xl);
  flex-shrink: 0; /* 按钮不被压缩 */
  white-space: nowrap; /* 防止文字换行 */
  font-size: var(--st-font-sm);
  font-weight: 500;
  color: rgb(var(--st-color-text));
  background: rgb(var(--st-surface-2));
  border: 1px solid rgba(var(--st-border), 0.9);
  border-radius: var(--st-radius-md);
  cursor: pointer;
  transition: background var(--st-transition-fast), border-color var(--st-transition-fast), transform var(--st-transition-fast), box-shadow var(--st-transition-fast);
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
  margin-top: var(--st-spacing-md);
  font-size: var(--st-font-sm);
  color: rgba(var(--st-color-text), .75);
  display: inline-flex;
  align-items: center;
  gap: var(--st-spacing-sm);
}

.icon-16 { width: var(--st-icon-md); height: var(--st-icon-md); stroke: currentColor; }

/* 深色主题微调 */
[data-theme="dark"] .opt-input { background: rgb(var(--st-surface)); }
</style>
