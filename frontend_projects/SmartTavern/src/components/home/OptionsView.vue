<script setup>
import { ref, onMounted, watch, computed } from "vue"

const props = defineProps({
  theme: { type: String, default: "system" } // system | light | dark
})
const emit = defineEmits(["update:theme"])

const lang = ref("zh-CN")
const currentTheme = ref(props.theme || "system")

function applyThemeToRoot(t) {
  const root = document.documentElement
  if (t === "dark") {
    root.setAttribute("data-theme", "dark")
  } else if (t === "light") {
    root.setAttribute("data-theme", "light")
  } else {
    root.removeAttribute("data-theme")
  }
}

function setTheme(t) {
  currentTheme.value = t
  applyThemeToRoot(t)
  emit("update:theme", t)
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

onMounted(() => {
  // 初始化图标 + 根据 props.theme 同步一次根节点主题
  window.lucide?.createIcons?.()
  applyThemeToRoot(currentTheme.value)
  // 初始化后端地址
  loadBackendBase()
})

// 外部主题变化时，同步内部视图
watch(() => props.theme, (v) => {
  if (!v) return
  currentTheme.value = v
  applyThemeToRoot(v)
})
</script>

<template>
  <section class="home-modal-section">
    <p class="hm-desc">主页选项与侧边栏保持一致：主题切换为"系统/浅色/深色"。</p>

    <div class="opt-panel">
      <!-- 语言（占位，保留但不改动逻辑） -->
      <div class="opt-row">
        <label class="opt-label">语言</label>
        <select class="opt-input" v-model="lang" disabled>
          <option value="zh-CN">简体中文</option>
          <option value="en-US">English</option>
          <option value="ja-JP">日本語</option>
        </select>
      </div>

      <!-- 主题：与侧边栏一致的三按钮切换 -->
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

      <!-- 音量已按要求移除 -->
    </div>
  </section>
</template>

<style scoped>
.home-modal-section { display: grid; gap: 12px; }
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

/* 主题三段按钮（与侧边风格一致的胶囊分段） */
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
