<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import useAppearanceSandbox from '@/composables/appearance/useAppearanceSandbox'

/**
 * 全屏沙盒外观配置（拆分自 AppearancePanel）
 * 重构：使用 useAppearanceSandbox 统一处理
 * - CSS 变量读写
 * - 本地持久化（st.appearance.sandbox.v1）
 * - 定时广播给主题扩展（ThemeManager.applyAppearanceSnapshot）
 */

// live tuning indicator + overlay suppression
const tuning = ref(false)
const activeTuningSlider = ref(null)

/* 强制隐藏半透明背板/浮标（行内样式最高优先级），结束时恢复 */
let __tuningHiddenEls = []
function __hideOverlaysForTuning() {
  const selectors = ['.st-panel-backdrop', '.sd-backdrop', '.sd-fab']
  __tuningHiddenEls = []
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      __tuningHiddenEls.push({ el, style: el.getAttribute('style') })
      try {
        el.style.setProperty('display', 'none', 'important')
        el.style.setProperty('visibility', 'hidden', 'important')
        el.style.setProperty('pointer-events', 'none', 'important')
      } catch (_) {}
    })
  })
}
function __restoreOverlaysForTuning() {
  __tuningHiddenEls.forEach(({ el, style }) => {
    try {
      if (style != null) el.setAttribute('style', style)
      else el.removeAttribute('style')
    } catch (_) {}
  })
  __tuningHiddenEls = []
}

function onTuningStart(sliderName) {
  tuning.value = true
  activeTuningSlider.value = sliderName
  document.body.classList.add('st-live-tuning')
  document.body.setAttribute('data-active-slider', sliderName)
  __hideOverlaysForTuning()
  window.addEventListener('pointerup', onTuningEndOnce, { once: true })
  window.addEventListener('touchend', onTuningEndOnce, { once: true })
}
function onTuningEndOnce() {
  tuning.value = false
  activeTuningSlider.value = null
  document.body.classList.remove('st-live-tuning')
  document.body.removeAttribute('data-active-slider')
  __restoreOverlaysForTuning()
}

// Composable: state + helpers
const {
  state,
  initFromCSS,
  startAutoSave,
  setRootVar,
  setRootVarUnitless,
  buildSnapshot,
  saveSnapshotLS,
} = useAppearanceSandbox()

// Destructure refs for template parity
const {
  sandboxAspectX, sandboxAspectY,
  sandboxMaxWidth, sandboxMaxWidthLimit,
  sandboxPadding, sandboxRadius,
  sandboxBgOpacityPct, sandboxStageBgOpacityPct,
  // 新增：背景图片遮罩模糊（px）
  sandboxBgBlurPx,
  // 新增：沙盒容器显示模式选择（auto/fixed/inline）
  sandboxDisplayModeSel,
} = state

// 持久化：任意外观变更立即保存到浏览器，避免刷新后丢失
watch(state, () => {
  try {
    const snap = buildSnapshot()
    saveSnapshotLS(snap)
  } catch (_) {}
}, { deep: true })

// Presets (unchanged)
const aspectPresets = [
  { label: '16:9', v: [16, 9] },
  { label: '4:3', v: [4, 3] },
  { label: '21:9', v: [21, 9] },
  { label: '1:1', v: [1, 1] },
]

// Handlers: same signatures, write via helpers
function onSandboxAspectPreset(e) {
  const raw = e.target.value
  if (!raw) return
  const [ax, ay] = raw.split(',').map(Number)
  if (ax > 0 && ay > 0) {
    sandboxAspectX.value = ax
    sandboxAspectY.value = ay
    setRootVarUnitless('--st-sandbox-aspect', `${ax} / ${ay}`)
  }
}
function onSandboxAspectNumInputX(e) {
  const v = Number(e.target.value)
  if (v > 0) {
    sandboxAspectX.value = v
    setRootVarUnitless('--st-sandbox-aspect', `${sandboxAspectX.value} / ${sandboxAspectY.value}`)
  }
}
function onSandboxAspectNumInputY(e) {
  const v = Number(e.target.value)
  if (v > 0) {
    sandboxAspectY.value = v
    setRootVarUnitless('--st-sandbox-aspect', `${sandboxAspectX.value} / ${sandboxAspectY.value}`)
  }
}

// 尺寸与圆角/内边距
function onSandboxMaxWidthNumberInput(e) {
  const v = Number(e.target.value)
  if (v >= 640 && v <= sandboxMaxWidthLimit.value) {
    sandboxMaxWidth.value = v
    setRootVar('--st-sandbox-max-width', sandboxMaxWidth.value)
  }
}
function onSandboxMaxWidthRangeInput(e) {
  sandboxMaxWidth.value = Number(e.target.value)
  setRootVar('--st-sandbox-max-width', sandboxMaxWidth.value)
}
function onSandboxMaxWidthLimitInput(e) {
  const v = Number(e.target.value)
  if (v >= 640 && v <= 3840) {
    sandboxMaxWidthLimit.value = v
    if (sandboxMaxWidth.value > v) {
      sandboxMaxWidth.value = v
      setRootVar('--st-sandbox-max-width', sandboxMaxWidth.value)
    }
  }
}
function onSandboxPaddingNumberInput(e) {
  const v = Number(e.target.value)
  if (v >= 0 && v <= 48) {
    sandboxPadding.value = v
    setRootVar('--st-sandbox-padding', sandboxPadding.value)
  }
}
function onSandboxPaddingRangeInput(e) {
  sandboxPadding.value = Number(e.target.value)
  setRootVar('--st-sandbox-padding', sandboxPadding.value)
}
function onSandboxRadiusNumberInput(e) {
  const v = Number(e.target.value)
  if (v >= 0 && v <= 32) {
    sandboxRadius.value = v
    setRootVar('--st-sandbox-radius', sandboxRadius.value)
  }
}
function onSandboxRadiusRangeInput(e) {
  sandboxRadius.value = Number(e.target.value)
  setRootVar('--st-sandbox-radius', sandboxRadius.value)
}

// 不透明度（%→小数写 CSS）
function onSandboxBgOpacityNumberInput(e) {
  const v = Number(e.target.value)
  if (v >= 0 && v <= 100) {
    sandboxBgOpacityPct.value = v
    setRootVarUnitless('--st-sandbox-bg-opacity', String(v / 100))
  }
}
function onSandboxBgOpacityRangeInput(e) {
  sandboxBgOpacityPct.value = Number(e.target.value)
  setRootVarUnitless('--st-sandbox-bg-opacity', String(sandboxBgOpacityPct.value / 100))
}

/* Blur handlers (px) */
function onSandboxBgBlurNumberInput(e) {
  const v = Number(e.target.value)
  if (v >= 0 && v <= 50) {
    sandboxBgBlurPx.value = v
    setRootVar('--st-sandbox-bg-blur', v)
  }
}
function onSandboxBgBlurRangeInput(e) {
  sandboxBgBlurPx.value = Number(e.target.value)
  setRootVar('--st-sandbox-bg-blur', sandboxBgBlurPx.value)
}
function onSandboxStageBgOpacityNumberInput(e) {
  const v = Number(e.target.value)
  if (v >= 0 && v <= 100) {
    sandboxStageBgOpacityPct.value = v
    setRootVarUnitless('--st-sandbox-stage-bg-opacity', String(v / 100))
  }
}
function onSandboxStageBgOpacityRangeInput(e) {
  sandboxStageBgOpacityPct.value = Number(e.target.value)
  setRootVarUnitless('--st-sandbox-stage-bg-opacity', String(sandboxStageBgOpacityPct.value / 100))
}

// Lifecycle: init + auto-save broadcast
let __dispose = null
onMounted(() => {
  initFromCSS()
  __dispose = startAutoSave({ intervalMs: 1000 })
  // 实时保存并广播：切换显示模式即刻生效
  watch(sandboxDisplayModeSel, (v) => {
    try {
      const snap = buildSnapshot()
      // 确保写入最新选择
      snap.sandboxDisplayModeSel = String(v)
      saveSnapshotLS(snap)
      window.dispatchEvent(new CustomEvent('stAppearanceSandboxUpdate', { detail: snap }))
    } catch (_) {}
  }, { immediate: true })
})
onBeforeUnmount(() => {
  if (typeof __dispose === 'function') __dispose()
})
</script>

<template>
  <div class="st-tab-panel" data-scope="settings-sandbox">
    <h3>全屏沙盒外观</h3>
    <p class="muted">配置沙盒舞台的尺寸与长宽比，便于后续嵌入画面/预览对齐。</p>

    <!-- 显示模式（固定 / 自适应 / 由沙盒内代码决定） -->
    <div class="st-control" data-slider="sandboxDisplayMode">
      <label class="st-control-label">
        <span class="label-text">显示模式</span>
        <div class="value-group">
          <select class="st-number-input" v-model="sandboxDisplayModeSel" style="width: 200px;">
            <option value="auto">自适应高度（默认）</option>
            <option value="fixed">固定容器（使用宽高比）</option>
            <option value="inline">由沙盒内代码决定（缺省则自适应）</option>
          </select>
        </div>
      </label>
      <div class="st-control-hint">
        <span class="muted" style="font-size:12px;">
          使用“由沙盒内代码决定”时，可在 HTML 中加入注释：
          <!-- st:display-mode=auto|fixed -->
          若无声明则回退为自适应高度。
        </span>
      </div>
    </div>

    <!-- 画面宽高比 -->
    <div class="st-control" data-slider="sandboxAspect">
      <label class="st-control-label">
        <span class="label-text">画面宽高比</span>
        <div class="value-group">
          <select class="st-number-input" @change="onSandboxAspectPreset">
            <option disabled selected value="">预设</option>
            <option v-for="p in aspectPresets" :key="p.label" :value="p.v.join(',')">{{ p.label }}</option>
          </select>
          <span class="unit">或 自定义</span>
        </div>
      </label>
      <div style="display:flex; gap:8px; align-items:center;">
        <input type="number" class="st-number-input" :value="sandboxAspectX" min="1" max="100" @input="onSandboxAspectNumInputX" />
        <span>:</span>
        <input type="number" class="st-number-input" :value="sandboxAspectY" min="1" max="100" @input="onSandboxAspectNumInputY" />
      </div>
    </div>

    <!-- 舞台最大宽度 -->
    <div class="st-control" data-slider="sandboxMaxWidth">
      <label class="st-control-label">
        <span class="label-text">舞台最大宽度</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="sandboxMaxWidth" min="640" :max="sandboxMaxWidthLimit" @input="onSandboxMaxWidthNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="640" :max="sandboxMaxWidthLimit" step="10" :value="sandboxMaxWidth" @pointerdown="onTuningStart('sandboxMaxWidth')" @input="onSandboxMaxWidthRangeInput" />
      <div class="st-control-hint">
        <label class="st-control-label">
          <span class="label-text" style="font-size: 11px; opacity: 0.8;">滑条最大值</span>
          <div class="value-group">
            <input type="number" class="st-number-input" :value="sandboxMaxWidthLimit" min="640" max="3840" @input="onSandboxMaxWidthLimitInput" style="width: 60px;" />
            <span class="unit">px</span>
          </div>
        </label>
      </div>
    </div>

    <!-- 内边距 -->
    <div class="st-control" data-slider="sandboxPadding">
      <label class="st-control-label">
        <span class="label-text">舞台内边距</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="sandboxPadding" min="0" max="48" @input="onSandboxPaddingNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="0" max="48" step="1" :value="sandboxPadding" @pointerdown="onTuningStart('sandboxPadding')" @input="onSandboxPaddingRangeInput" />
    </div>

    <!-- 圆角 -->
    <div class="st-control" data-slider="sandboxRadius">
      <label class="st-control-label">
        <span class="label-text">舞台圆角</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="sandboxRadius" min="0" max="32" @input="onSandboxRadiusNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="0" max="32" step="1" :value="sandboxRadius" @pointerdown="onTuningStart('sandboxRadius')" @input="onSandboxRadiusRangeInput" />
    </div>

    <!-- 背景图片遮罩不透明度 -->
    <div class="st-control" data-slider="sandboxBgOpacity">
      <label class="st-control-label">
        <span class="label-text">背景图片遮罩不透明度</span>
        <div class="value-group">
          <input
            type="number"
            class="st-number-input"
            :value="sandboxBgOpacityPct"
            min="0"
            max="100"
            @input="onSandboxBgOpacityNumberInput"
          />
          <span class="unit">%</span>
        </div>
      </label>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        :value="sandboxBgOpacityPct"
        @pointerdown="onTuningStart('sandboxBgOpacity')"
        @input="onSandboxBgOpacityRangeInput"
      />
    </div>

    <!-- 背景图片遮罩模糊 -->
    <div class="st-control" data-slider="sandboxBgBlur">
      <label class="st-control-label">
        <span class="label-text">背景图片遮罩模糊</span>
        <div class="value-group">
          <input
            type="number"
            class="st-number-input"
            :value="sandboxBgBlurPx"
            min="0"
            max="50"
            @input="onSandboxBgBlurNumberInput"
          />
          <span class="unit">px</span>
        </div>
      </label>
      <input
        type="range"
        min="0"
        max="50"
        step="1"
        :value="sandboxBgBlurPx"
        @pointerdown="onTuningStart('sandboxBgBlur')"
        @input="onSandboxBgBlurRangeInput"
      />
      <div class="st-control-hint">
        <span class="muted" style="font-size:12px;">通过遮罩层对背景图应用高斯模糊（建议 0~12px，过大可能影响性能）</span>
      </div>
    </div>

    <!-- 舞台背景不透明度 -->
    <div class="st-control" data-slider="sandboxStageBgOpacity">
      <label class="st-control-label">
        <span class="label-text">舞台背景不透明度</span>
        <div class="value-group">
          <input
            type="number"
            class="st-number-input"
            :value="sandboxStageBgOpacityPct"
            min="0"
            max="100"
            @input="onSandboxStageBgOpacityNumberInput"
          />
          <span class="unit">%</span>
        </div>
      </label>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        :value="sandboxStageBgOpacityPct"
        @pointerdown="onTuningStart('sandboxStageBgOpacity')"
        @input="onSandboxStageBgOpacityRangeInput"
      />
    </div>

    <p class="muted">提示：上述设定实时作用于页面上的"全局沙盒"舞台，并以 CSS 变量方式保存，便于主题或脚本统一接管。</p>
  </div>
</template>

<style>
/* 复制自 AppearancePanel 的 range slider 非 scoped 样式（限定 data-scope），以保持一致外观 */
[data-scope="settings-view"] .st-control input[type="range"],
[data-scope="settings-sandbox"] .st-control input[type="range"] {
  -webkit-appearance: none; appearance: none; background: transparent; width: 100%;
}
[data-scope="settings-view"] .st-control input[type="range"]::-webkit-slider-runnable-track,
[data-scope="settings-sandbox"] .st-control input[type="range"]::-webkit-slider-runnable-track {
  height: 8px !important; border-radius: 9999px !important;
  background: linear-gradient(180deg, rgba(0,0,0,0.68), rgba(0,0,0,0.82)) !important;
  border: 1px solid rgba(0,0,0,0.92) !important;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.15) !important;
}
[data-scope="settings-view"] .st-control input[type="range"]::-moz-range-track,
[data-scope="settings-sandbox"] .st-control input[type="range"]::-moz-range-track {
  height: 8px !important; border-radius: 9999px !important;
  background: linear-gradient(180deg, rgba(0,0,0,0.68), rgba(0,0,0,0.82)) !important;
  border: 1px solid rgba(0,0,0,0.92) !important;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.15) !important;
}
[data-scope="settings-view"] .st-control input[type="range"]::-webkit-slider-thumb,
[data-scope="settings-sandbox"] .st-control input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 9999px;
  background: linear-gradient(180deg, #ffffff, #f8f9fa) !important;
  border: 1px solid rgba(0,0,0,0.12) !important;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.9), 0 2px 4px rgba(0,0,0,0.20), 0 4px 8px rgba(0,0,0,0.10) !important;
  margin-top: -6px; cursor: pointer;
  transition: transform .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
[data-scope="settings-view"] .st-control input[type="range"]::-moz-range-thumb,
[data-scope="settings-sandbox"] .st-control input[type="range"]::-moz-range-thumb {
  width: 18px; height: 18px; border-radius: 9999px;
  background: linear-gradient(180deg, #ffffff, #f8f9fa) !important;
  border: 1px solid rgba(0,0,0,0.12) !important;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.9), 0 2px 4px rgba(0,0,0,0.20), 0 4px 8px rgba(0,0,0,0.10) !important;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]::-webkit-slider-runnable-track,
[data-theme="dark"] [data-scope="settings-sandbox"] .st-control input[type="range"]::-webkit-slider-runnable-track {
  background: linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.85)) !important;
  border: 1px solid rgba(255,255,255,0.95) !important;
  box-shadow: inset 0 1px 2px rgba(255,255,255,0.20), 0 1px 0 rgba(0,0,0,0.15) !important;
}
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]::-moz-range-track,
[data-theme="dark"] [data-scope="settings-sandbox"] .st-control input[type="range"]::-moz-range-track {
  background: linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.85)) !important;
  border: 1px solid rgba(255,255,255,0.95) !important;
  box-shadow: inset 0 1px 2px rgba(255,255,255,0.20), 0 1px 0 rgba(0,0,0,0.15) !important;
}
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]::-webkit-slider-thumb,
[data-theme="dark"] [data-scope="settings-sandbox"] .st-control input[type="range"]::-webkit-slider-thumb {
  background: linear-gradient(180deg, #1a1a1a, #0a0a0a) !important;
  border: 1px solid rgba(255,255,255,0.15) !important;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.85), 0 2px 4px rgba(255,255,255,0.15), 0 4px 8px rgba(0,0,0,0.40) !important;
}
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]::-moz-range-thumb,
[data-theme="dark"] [data-scope="settings-sandbox"] .st-control input[type="range"]::-moz-range-thumb {
  background: linear-gradient(180deg, #1a1a1a, #0a0a0a) !important;
  border: 1px solid rgba(255,255,255,0.15) !important;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.85), 0 2px 4px rgba(255,255,255,0.15), 0 4px 8px rgba(0,0,0,0.40) !important;
}
[data-scope="settings-view"] .st-control input[type="range"]:hover::-webkit-slider-thumb,
[data-scope="settings-sandbox"] .st-control input[type="range"]:hover::-webkit-slider-thumb,
[data-scope="settings-view"] .st-control input[type="range"]:hover::-moz-range-thumb,
[data-scope="settings-sandbox"] .st-control input[type="range"]:hover::-moz-range-thumb {
  transform: scale(1.12);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.95), 0 4px 8px rgba(0,0,0,0.25), 0 6px 12px rgba(0,0,0,0.15), 0 0 0 4px rgba(var(--st-primary),0.15) !important;
}
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]:hover::-webkit-slider-thumb,
[data-theme="dark"] [data-scope="settings-sandbox"] .st-control input[type="range"]:hover::-webkit-slider-thumb,
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]:hover::-moz-range-thumb,
[data-theme="dark"] [data-scope="settings-sandbox"] .st-control input[type="range"]:hover::-moz-range-thumb {
  transform: scale(1.12);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.90), 0 4px 8px rgba(255,255,255,0.20), 0 6px 12px rgba(0,0,0,0.50), 0 0 0 4px rgba(var(--st-accent),0.20) !important;
}
[data-scope="settings-view"] .st-control input[type="range"]:active::-webkit-slider-thumb,
[data-scope="settings-sandbox"] .st-control input[type="range"]:active::-webkit-slider-thumb,
[data-scope="settings-view"] .st-control input[type="range"]:active::-moz-range-thumb,
[data-scope="settings-sandbox"] .st-control input[type="range"]:active::-moz-range-thumb {
  transform: scale(1.05);
}
</style>

<style scoped>
/* 复用 AppearancePanel 的视觉语言（样式类同名，方便一致性） */
.st-tab-panel h3 { margin: 0 0 6px; font-weight: 700; }
.st-tab-panel .muted { color: rgba(var(--st-color-text), 0.75); margin: 0; }

.st-control {
  display: grid; grid-template-columns: 1fr; gap: 8px; margin: 12px 0 16px;
  background: rgba(var(--st-surface-2), 0.5);
  border: 1px solid rgba(var(--st-border), 0.6);
  border-radius: 6px; padding: 10px;
}
.st-control-label {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; color: rgba(var(--st-color-text), 0.9); width: 100%;
}
.label-text { flex: 0 0 auto; }
.value-group { display: flex; align-items: center; gap: 4px; margin-left: auto; }
.st-number-input {
  width: 50px; padding: 2px 4px;
  border: 1px solid rgba(var(--st-border), 0.9); border-radius: 4px;
  background: rgb(var(--st-surface)); color: rgb(var(--st-color-text));
  text-align: right; font-size: 12px;
}
select.st-number-input {
  width: 120px; text-align: center; text-align-last: center; -moz-text-align-last: center;
}
.st-number-input:focus-visible { outline: 2px solid rgba(var(--st-primary), 0.6); outline-offset: 2px; }
.unit { opacity: .7; font-size: 12px; }

.st-control-hint {
  margin-top: 4px; padding: 6px 8px;
  background: rgba(var(--st-surface-2), 0.5);
  border-radius: 4px; border: 1px solid rgba(var(--st-border), 0.4);
}
</style>