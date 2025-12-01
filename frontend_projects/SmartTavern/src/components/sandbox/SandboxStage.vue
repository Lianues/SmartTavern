<template>
  <!-- 舞台容器：遵循 App.vue 中的 CSS 变量控制尺寸/比例/圆角/内边距 -->
  <div class="st-sandbox-stage" :class="{ 'is-auto': isAuto, 'is-fixed': !isAuto }">
    <HtmlIframeSandbox
      :html="effectiveHtml"
      :base-url="baseUrl"
      :sandbox="sandbox"
      :allow="allow"
      :inject-css="injectCss"
      :csp="csp"
      :auto-height="isAuto"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import HtmlIframeSandbox from './HtmlIframeSandbox.vue'
 
const props = defineProps({
  html: { type: String, default: '' },
  baseUrl: { type: String, default: '' },
  // 最大权限（结合 sandbox + allow），可按需覆写
  sandbox: {
    type: String,
    default:
      'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox allow-presentation allow-storage-access-by-user-activation'
  },
  allow: {
    type: String,
    default:
      // Feature Policy / Permissions Policy，尽可能放宽（宿主仍受浏览器/CSP限制）
      'fullscreen *; clipboard-read *; clipboard-write *; geolocation *; microphone *; camera *; autoplay *; encrypted-media *; payment *; usb *; serial *; midi *; gyroscope *; magnetometer *; xr-spatial-tracking *; display-capture *; gamepad *; idle-detection *'
  },
  injectCss: { type: String, default: '' },
  csp: { type: String, default: '' },
  /**
   * 显示模式：
   * - 'auto' 自适应高度（默认）
   * - 'fixed' 固定容器（使用 CSS aspect-ratio）
   */
  displayMode: { type: String, default: 'auto', validator: (v: string) => ['auto', 'fixed'].includes(v) },
  // 当允许时，可由 HTML 内联指令 <!-- st:display-mode=auto|fixed --> 覆盖
  preferInlineMode: { type: Boolean, default: false }
})
 
function parseInlineDisplayMode(s?: string): 'auto' | 'fixed' | null {
  if (!s) return null
  const re = /<!--\s*st:display-mode\s*=\s*(auto|fixed)\s*-->/gi
  let m: RegExpExecArray | null
  let last: 'auto' | 'fixed' | null = null
  while ((m = re.exec(s)) !== null) {
    const v = (m[1] || '').toLowerCase() as 'auto' | 'fixed'
    if (v === 'auto' || v === 'fixed') last = v
  }
  return last
}

type Pref = { preferInline: boolean; displayMode: 'auto' | 'fixed' } | null
function readSandboxDisplayPref(): Pref {
  try {
    const raw = localStorage.getItem('st.appearance.sandbox.v1')
    if (!raw) return null
    const snap = JSON.parse(raw)
    const sel = String(snap?.sandboxDisplayModeSel || '').toLowerCase()
    if (sel === 'inline') return { preferInline: true, displayMode: 'auto' }
    if (sel === 'fixed')  return { preferInline: false, displayMode: 'fixed' }
    if (sel === 'auto')   return { preferInline: false, displayMode: 'auto' }
    return null
  } catch { return null }
}

const inlineDisplayMode = computed(() => parseInlineDisplayMode(props.html))

// 运行时优先：外观面板广播的即时选择（无需刷新）
const runtimePref = ref<Pref | null>(null)
const lsPref = computed(() => runtimePref.value ?? readSandboxDisplayPref())

const effectivePreferInline = computed(() => {
  return typeof lsPref.value?.preferInline === 'boolean'
    ? lsPref.value!.preferInline
    : props.preferInlineMode
})

const baseDisplayMode = computed<'auto' | 'fixed'>(() => {
  return (lsPref.value?.displayMode ?? props.displayMode) as 'auto' | 'fixed'
})

const displayModeEffective = computed<'auto' | 'fixed'>(() => {
  // 当允许时，沙盒内的内联指令可覆盖；否则使用外观面板/父组件的选择
  if (effectivePreferInline.value && inlineDisplayMode.value) {
    return inlineDisplayMode.value
  }
  return baseDisplayMode.value
})

const isAuto = computed(() => displayModeEffective.value !== 'fixed')

// 监听外观面板事件，实现即时切换
function onAppearanceSandboxUpdate(e: Event) {
  const d = (e as CustomEvent).detail
  const sel = String(d?.sandboxDisplayModeSel || '').toLowerCase()
  if (sel === 'inline') {
    runtimePref.value = { preferInline: true, displayMode: 'auto' }
  } else if (sel === 'fixed') {
    runtimePref.value = { preferInline: false, displayMode: 'fixed' }
  } else if (sel === 'auto') {
    runtimePref.value = { preferInline: false, displayMode: 'auto' }
  } else {
    runtimePref.value = null
  }
}
onMounted(() => window.addEventListener('stAppearanceSandboxUpdate', onAppearanceSandboxUpdate as EventListener))
onBeforeUnmount(() => {
  try { window.removeEventListener('stAppearanceSandboxUpdate', onAppearanceSandboxUpdate as EventListener) } catch (_) {}
})
 
const DEFAULT_HTML = `
<div class="stx">
  <header class="stx-header">
    <h1>SmartTavern Iframe Sandbox</h1>
    <p>本舞台用于渲染自定义 HTML（最大权限沙盒）。</p>
  </header>
 
  <section class="stx-actions">
    <button id="btnFS">请求全屏</button>
    <button id="btnCopy">复制文本到剪贴板</button>
    <button id="btnRead">读取剪贴板</button>
    <button id="btnGeo">获取地理位置</button>
  </section>
 
  <section class="stx-info">
    <div class="card">
      <h3>环境</h3>
      <ul>
        <li>UserAgent: <code id="ua"></code></li>
        <li>时间戳: <code id="ts"></code></li>
        <li>Location: <code id="loc"></code></li>
      </ul>
    </div>
    <div class="card">
      <h3>权限状态</h3>
      <ul id="permList">
        <li>clipboard-read / clipboard-write / geolocation / microphone / camera / midi / fullscreen / autoplay / encrypted-media ...</li>
      </ul>
    </div>
  </section>
</div>
 
<style>
:root{
  --bg: #0b0e14;
  --panel: rgba(255,255,255,0.06);
  --panel-border: rgba(255,255,255,0.12);
  --text: #f2f4f8;
  --muted: #b7beca;
  --accent: #9b87f5;
  --radius: 14px;
}
*{ box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: transparent; color: var(--text); font: 14px/1.6 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial; }
.stx { height: 100%; display: flex; flex-direction: column; gap: 16px; }
.stx-header { background: var(--panel); border: 1px solid var(--panel-border); border-radius: var(--radius); padding: 16px 16px; }
.stx-header h1{ margin: 0 0 6px 0; font-size: 18px; letter-spacing: .2px; }
.stx-header p{ margin: 0; color: var(--muted); }
 
.stx-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
@media (min-width: 720px){ .stx-actions{ grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.stx-actions button{
  appearance: none; cursor: pointer; padding: 10px 12px; border-radius: 10px;
  background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
  border: 1px solid var(--panel-border); color: var(--text);
  transition: transform .2s cubic-bezier(.22,.61,.36,1), background .2s, border-color .2s;
}
.stx-actions button:hover{ transform: translateY(-1px); border-color: rgba(255,255,255,0.22); }
.stx-actions button:active{ transform: translateY(0); }
 
.stx-info { display: grid; grid-template-columns: 1fr; gap: 12px; }
@media (min-width: 960px){ .stx-info{ grid-template-columns: 1fr 1fr; } }
.card{ background: var(--panel); border: 1px solid var(--panel-border); border-radius: var(--radius); padding: 14px; }
.card h3{ margin: 0 0 8px 0; font-size: 15px; }
.card ul{ list-style: none; padding: 0; margin: 0; color: var(--muted); }
code{ color: var(--accent); font-family: ui-monospace, "JetBrains Mono", "Fira Code", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size: 12px; }
</style>
 
<script>
(function(){
  const $ = (sel) => document.querySelector(sel)
  $('#ua').textContent = navigator.userAgent
  $('#ts').textContent = String(Date.now())
  $('#loc').textContent = location.href
 
  $('#btnFS').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch (e) { console.warn('fullscreen error', e) }
  })
  $('#btnCopy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('Hello from SmartTavern Sandbox!')
      alert('已写入剪贴板')
    } catch (e) { alert('写入失败：' + e) }
  })
  $('#btnRead').addEventListener('click', async () => {
    try {
      const t = await navigator.clipboard.readText()
      alert('读取到：' + t)
    } catch (e) { alert('读取失败：' + e) }
  })
  $('#btnGeo').addEventListener('click', () => {
    if (!navigator.geolocation) return alert('该环境不支持 geolocation')
    navigator.geolocation.getCurrentPosition(
      (pos) => alert('经纬度：' + pos.coords.latitude + ', ' + pos.coords.longitude),
      (err) => alert('定位失败：' + err.message),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    )
  })
})();
<\/script>
`
 
const effectiveHtml = computed(() => props.html || DEFAULT_HTML)
</script>

<!--
说明：
- 本组件只负责“舞台尺寸/比例控制 + iframe 沙盒承载”，避免耦合宿主页面逻辑。
- 默认 HTML 包含常用权限验证按钮（全屏、剪贴板、地理位置），与“最大权限”演示。
- 宿主可通过 props.html 动态传入任意 HTML 字符串，或覆盖 sandbox/allow/CSP。
-->

<style scoped>
/* 舞台容器（由 CSS 变量控制），将尺寸逻辑内聚到组件自身，避免父组件 scoped 样式失效 */
.st-sandbox-stage {
  position: relative;
  width: 100%;
  max-width: var(--st-sandbox-max-width);
  /* 使用 aspect-ratio 计算高度，若设置 height:100% 将导致比例失效 */
  aspect-ratio: var(--st-sandbox-aspect);
  padding: var(--st-sandbox-padding);
  border-radius: var(--st-sandbox-radius);
  /* 可见边界与半透明底，保持与 App.vue 中样式一致 */
  /* 同步舞台透明度：边框/背景/玻璃强度随 --st-sandbox-stage-bg-opacity 变化 */
  border: var(--st-border-width-md) solid rgb(var(--st-primary) / calc(var(--st-sandbox-stage-bg-opacity, 0.82) * var(--st-sandbox-stage-border-alpha)));
  background: rgb(var(--st-surface) / var(--st-sandbox-stage-bg-opacity, 0.82)) !important;
  backdrop-filter: blur(calc(var(--st-sandbox-stage-bg-opacity, 0.82) * var(--st-sandbox-stage-blur-multiplier))) saturate(calc(1 + var(--st-sandbox-stage-bg-opacity, 0.82) * var(--st-sandbox-stage-saturate-boost)));
  -webkit-backdrop-filter: blur(calc(var(--st-sandbox-stage-bg-opacity, 0.82) * var(--st-sandbox-stage-blur-multiplier))) saturate(calc(1 + var(--st-sandbox-stage-bg-opacity, 0.82) * var(--st-sandbox-stage-saturate-boost)));
  box-shadow: var(--st-shadow-card);
  margin: 0 auto;
  overflow: hidden;
}
 
/* 内部 iframe 铺满舞台区域（跨子组件样式，使用 :deep 穿透） */
.st-sandbox-stage :deep(.st-iframe) {
  width: 100%;
  height: 100%;
  display: block;
}

/* 自适应高度模式：移除固定宽高比，由 iframe 内内容驱动高度 */
.st-sandbox-stage.is-auto {
  aspect-ratio: auto;
  height: auto;
}

/* 在自适应模式下，iframe 的高度通过行内样式控制；此处设为 auto 作为兜底 */
.st-sandbox-stage.is-auto :deep(.st-iframe) {
  height: auto;
}
</style>