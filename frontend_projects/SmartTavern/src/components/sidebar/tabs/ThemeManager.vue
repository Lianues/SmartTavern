<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import ThemeManager from '@/features/themes/manager'
import { registerDemoShadowFollowExtension } from '@/features/themes/extensions/demoShadowFollow'

const themeInfo = ref(null)
let off = null
const extEnabled = ref(false)
let extDispose = null

onMounted(() => {
  try {
    themeInfo.value = ThemeManager.getCurrentTheme?.() || null
    off = ThemeManager.on?.('change', () => {
      themeInfo.value = ThemeManager.getCurrentTheme?.() || null
    })
  } catch (_) {}
})

onBeforeUnmount(() => {
  try { off?.() } catch (_) {}
  off = null
  try { typeof extDispose === 'function' && extDispose(); extDispose = null } catch (_) {}
})

async function onThemeFileSelected(e) {
  const file = e?.target?.files?.[0]
  if (!file) return
  try {
    await ThemeManager.importFromFile(file, { persist: true })
  } catch (err) {
    console.warn('[ThemeManagerTab] Theme import failed:', err)
  } finally {
    try { e.target.value = '' } catch (_) {}
  }
}

async function onThemeReset() {
  try {
    await ThemeManager.resetTheme({ persist: true })
  } catch (err) {
    console.warn('[ThemeManagerTab] Theme reset failed:', err)
  }
}

/** 一键应用 Demo 主题（public/themes/demo-ocean.sttheme.json） */
async function onApplyDemoTheme() {
  try {
    const res = await fetch('/themes/demo-ocean.sttheme.json', { cache: 'no-cache' })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const text = await res.text()
    await ThemeManager.importFromText(text, { persist: true })
  } catch (err) {
    console.warn('[ThemeManagerTab] Apply demo theme failed:', err)
  }
}

/** 启用/停用 示例扩展：圆角跟随阴影（站内扩展，不执行外部脚本） */
async function onToggleDemoExtension(e) {
  const next = e?.target?.checked ?? !extEnabled.value
  if (next && !extEnabled.value) {
    try {
      extDispose = await registerDemoShadowFollowExtension()
      extEnabled.value = true
    } catch (err) {
      console.warn('[ThemeManagerTab] Register demo extension failed:', err)
    }
  } else if (!next && extEnabled.value) {
    try { typeof extDispose === 'function' && extDispose() } catch (_) {}
    extDispose = null
    extEnabled.value = false
  }
}
</script>

<template>
  <div class="st-tab-panel" data-scope="settings-theme">
    <h3>主题管理</h3>
    <p class="muted">导入外部主题包（.json/.sttheme.json），或重置为内置风格。</p>

    <div class="st-control" data-slider="themeImport">
      <label class="st-control-label">
        <span class="label-text">导入主题包</span>
        <div class="value-group">
          <span class="unit">JSON</span>
        </div>
      </label>
      <label class="bg-upload">
        <input type="file" accept=".json,application/json" @change="onThemeFileSelected" />
        选择 .json / .sttheme.json
      </label>
      <div class="st-control-hint">
        <span class="muted" style="font-size:12px;">主题包包含 tokens 与可选 CSS；应用后会持久化于浏览器。</span>
      </div>
    </div>

    <div class="st-control" data-slider="themeDemo">
      <label class="st-control-label">
        <span class="label-text">快速体验</span>
        <div class="value-group">
          <span class="unit">Demo</span>
        </div>
      </label>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="st-settings-close" type="button" @click="onApplyDemoTheme">一键应用 Demo 主题</button>
        <label style="display:inline-flex; align-items:center; gap:6px;">
          <input type="checkbox" :checked="extEnabled" @change="onToggleDemoExtension" />
          启用示例扩展：圆角跟随阴影
        </label>
      </div>
      <div class="st-control-hint">
        <span class="muted" style="font-size:12px;">扩展仅联动样式 Token，不执行外部脚本；可随时停用。</span>
      </div>
    </div>

    <div class="st-control" data-slider="themeStatus">
      <label class="st-control-label">
        <span class="label-text">当前主题</span>
        <div class="value-group">
          <span class="unit" v-if="themeInfo">已应用</span>
          <span class="unit" v-else>未应用</span>
        </div>
      </label>
      <div class="theme-info" v-if="themeInfo">
        <div>名称：{{ themeInfo.name || '未命名' }}</div>
        <div>ID：{{ themeInfo.id || '-' }}</div>
        <div>版本：{{ themeInfo.version || '-' }}</div>
      </div>
      <div class="theme-actions" style="margin-top:8px; display:flex; gap:8px;">
        <button class="st-settings-close" type="button" @click="onThemeReset">重置为默认主题</button>
      </div>
    </div>
  </div>
</template>