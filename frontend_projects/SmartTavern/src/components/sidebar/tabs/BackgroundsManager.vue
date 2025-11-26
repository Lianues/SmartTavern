<script setup>
import { useI18n } from '@/locales'

const { t } = useI18n()

/**
 * 背景图片管理（开始页/楼层对话/沙盒）
 * - 使用 CSS 变量：--st-bg-start / --st-bg-threaded / --st-bg-sandbox
 * - 本地持久化至 localStorage（键：st.bg.start / st.bg.threaded / st.bg.sandbox）
 * - 独立为子组件，减少 AppearancePanel 体积与耦合
 */
const BG_KEYS = {
  start: '--st-bg-start',
  threaded: '--st-bg-threaded',
  sandbox: '--st-bg-sandbox',
}
const LS_KEYS = {
  start: 'st.bg.start',
  threaded: 'st.bg.threaded',
  sandbox: 'st.bg.sandbox',
}

function applyBg(type, url) {
  if (!BG_KEYS[type]) return
  const css = `url("${url}")`
  document.documentElement.style.setProperty(BG_KEYS[type], css)
  try { localStorage.setItem(LS_KEYS[type], url) } catch (_) {}
}

function resetBg(type) {
  if (!BG_KEYS[type]) return
  document.documentElement.style.removeProperty(BG_KEYS[type])
  try { localStorage.removeItem(LS_KEYS[type]) } catch (_) {}
}

function onFileChange(type, e) {
  const file = e?.target?.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = reader.result
    if (typeof dataUrl === 'string') {
      applyBg(type, dataUrl)
    }
  }
  reader.readAsDataURL(file)
}
</script>

<template>
  <div class="st-tab-panel" data-scope="settings-backgrounds">
    <h3>{{ t('appearance.backgrounds.title') }}</h3>
    <p class="muted">{{ t('appearance.backgrounds.desc') }}</p>

    <div class="bg-grid">
      <div class="bg-card">
        <div class="bg-title">{{ t('appearance.backgrounds.startPage') }}</div>
        <div class="bg-preview bg-start" />
        <div class="bg-actions">
          <label class="bg-upload">
            <input type="file" accept="image/*" @change="onFileChange('start', $event)" />
            {{ t('appearance.backgrounds.selectImage') }}
          </label>
          <button class="st-settings-close" type="button" @click="resetBg('start')">{{ t('appearance.backgrounds.resetDefault') }}</button>
        </div>
      </div>

      <div class="bg-card">
        <div class="bg-title">{{ t('appearance.backgrounds.threadedPage') }}</div>
        <div class="bg-preview bg-threaded" />
        <div class="bg-actions">
          <label class="bg-upload">
            <input type="file" accept="image/*" @change="onFileChange('threaded', $event)" />
            {{ t('appearance.backgrounds.selectImage') }}
          </label>
          <button class="st-settings-close" type="button" @click="resetBg('threaded')">{{ t('appearance.backgrounds.resetDefault') }}</button>
        </div>
      </div>

      <div class="bg-card">
        <div class="bg-title">{{ t('appearance.backgrounds.sandboxPage') }}</div>
        <div class="bg-preview bg-sandbox" />
        <div class="bg-actions">
          <label class="bg-upload">
            <input type="file" accept="image/*" @change="onFileChange('sandbox', $event)" />
            {{ t('appearance.backgrounds.selectImage') }}
          </label>
          <button class="st-settings-close" type="button" @click="resetBg('sandbox')">{{ t('appearance.backgrounds.resetDefault') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 复用 AppearancePanel 的视觉语言（样式类同名，方便一致性） */
.st-tab-panel h3 { margin: 0 0 6px; font-weight: 700; }
.st-tab-panel .muted { color: rgba(var(--st-color-text), 0.75); margin: 0; }

.bg-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
.bg-card { border: 1px solid rgb(var(--st-border)); border-radius: var(--st-radius-md); background: rgb(var(--st-surface)); padding: 10px; }
.bg-title { font-weight: 600; margin-bottom: 8px; color: rgb(var(--st-color-text)); }
.bg-preview {
  width: 100%; height: 120px; border-radius: var(--st-radius-md);
  border: 1px solid rgba(var(--st-border), 0.8);
  background-size: cover; background-position: center center; background-repeat: no-repeat;
  box-shadow: var(--st-shadow-sm);
}
.bg-preview.bg-start { background-image: var(--st-bg-start); }
.bg-preview.bg-threaded { background-image: var(--st-bg-threaded); }
.bg-preview.bg-sandbox { background-image: var(--st-bg-sandbox); }

.bg-actions { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.bg-upload {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface-2));
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
  transition: background .2s cubic-bezier(.22,.61,.36,1),
              border-color .2s cubic-bezier(.22,.61,.36,1),
              transform .2s cubic-bezier(.22,.61,.36,1),
              box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
.bg-upload:hover { background: rgb(var(--st-surface)); transform: translateY(-1px); box-shadow: var(--st-shadow-sm); }
.bg-upload:focus-within { outline: 2px solid rgba(var(--st-primary), 0.6); outline-offset: 2px; }
.bg-upload input[type="file"] { display: none; }
</style>