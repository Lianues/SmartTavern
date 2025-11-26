<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import ThemeManager from '@/features/themes/manager'
import { registerDemoShadowFollowExtension } from '@/features/themes/extensions/demoShadowFollow'
import { useI18n } from '@/locales'

const { t } = useI18n()

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
    <h3>{{ t('appearance.theme.title') }}</h3>
    <p class="muted">{{ t('appearance.theme.desc') }}</p>

    <div class="st-control" data-slider="themeImport">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.theme.importTitle') }}</span>
        <div class="value-group">
          <span class="unit">JSON</span>
        </div>
      </label>
      <label class="bg-upload">
        <input type="file" accept=".json,application/json" @change="onThemeFileSelected" />
        {{ t('appearance.theme.selectFile') }}
      </label>
      <div class="st-control-hint">
        <span class="muted" style="font-size:12px;">{{ t('appearance.theme.importHint') }}</span>
      </div>
    </div>

    <div class="st-control" data-slider="themeDemo">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.theme.quickTry') }}</span>
        <div class="value-group">
          <span class="unit">Demo</span>
        </div>
      </label>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="st-settings-close" type="button" @click="onApplyDemoTheme">{{ t('appearance.theme.applyDemo') }}</button>
        <label style="display:inline-flex; align-items:center; gap:6px;">
          <input type="checkbox" :checked="extEnabled" @change="onToggleDemoExtension" />
          {{ t('appearance.theme.enableExtension') }}
        </label>
      </div>
      <div class="st-control-hint">
        <span class="muted" style="font-size:12px;">{{ t('appearance.theme.extensionHint') }}</span>
      </div>
    </div>

    <div class="st-control" data-slider="themeStatus">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.theme.currentTheme') }}</span>
        <div class="value-group">
          <span class="unit" v-if="themeInfo">{{ t('appearance.theme.applied') }}</span>
          <span class="unit" v-else>{{ t('appearance.theme.notApplied') }}</span>
        </div>
      </label>
      <div class="theme-info" v-if="themeInfo">
        <div>{{ t('appearance.theme.name') }}：{{ themeInfo.name || t('appearance.theme.unnamed') }}</div>
        <div>{{ t('appearance.theme.id') }}：{{ themeInfo.id || '-' }}</div>
        <div>{{ t('appearance.theme.version') }}：{{ themeInfo.version || '-' }}</div>
      </div>
      <div class="theme-actions" style="margin-top:8px; display:flex; gap:8px;">
        <button class="st-settings-close" type="button" @click="onThemeReset">{{ t('appearance.theme.resetDefault') }}</button>
      </div>
    </div>
  </div>
</template>