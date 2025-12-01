<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import useAppearanceSandbox from '@/composables/appearance/useAppearanceSandbox'
import { useI18n } from '@/locales'

const { t } = useI18n()

/**
 * 前端沙盒外观配置（拆分自 AppearancePanel）
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
// 注意：state 是普通对象（包含 ref），需要监听所有 ref 的数组
watch(
  [sandboxAspectX, sandboxAspectY, sandboxMaxWidth, sandboxMaxWidthLimit, sandboxPadding, sandboxRadius, sandboxBgOpacityPct, sandboxStageBgOpacityPct, sandboxBgBlurPx, sandboxDisplayModeSel],
  () => {
    try {
      const snap = buildSnapshot()
      saveSnapshotLS(snap)
    } catch (_) {}
  }
)

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
    <h3>{{ t('appearance.sandbox.title') }}</h3>
    <p class="muted">{{ t('appearance.sandbox.desc') }}</p>

    <!-- 显示模式（固定 / 自适应 / 由沙盒内代码决定） -->
    <div class="st-control" data-slider="sandboxDisplayMode">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.sandbox.displayMode') }}</span>
        <div class="value-group">
          <select class="st-number-input" v-model="sandboxDisplayModeSel" style="width: 200px;">
            <option value="auto">{{ t('appearance.sandbox.displayModeAuto') }}</option>
            <option value="fixed">{{ t('appearance.sandbox.displayModeFixed') }}</option>
            <option value="inline">{{ t('appearance.sandbox.displayModeInline') }}</option>
          </select>
        </div>
      </label>
      <div class="st-control-hint">
        <span class="muted" style="font-size:12px;">
          {{ t('appearance.sandbox.displayModeHint') }}
        </span>
      </div>
    </div>

    <!-- 画面宽高比 -->
    <div class="st-control" data-slider="sandboxAspect">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.sandbox.aspectRatio') }}</span>
        <div class="value-group">
          <select class="st-number-input" @change="onSandboxAspectPreset">
            <option disabled selected value="">{{ t('appearance.sandbox.preset') }}</option>
            <option v-for="p in aspectPresets" :key="p.label" :value="p.v.join(',')">{{ p.label }}</option>
          </select>
          <span class="unit">{{ t('appearance.sandbox.orCustom') }}</span>
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
        <span class="label-text">{{ t('appearance.sandbox.stageMaxWidth') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="sandboxMaxWidth" min="640" :max="sandboxMaxWidthLimit" @input="onSandboxMaxWidthNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="640" :max="sandboxMaxWidthLimit" step="10" :value="sandboxMaxWidth" @pointerdown="onTuningStart('sandboxMaxWidth')" @input="onSandboxMaxWidthRangeInput" />
      <div class="st-control-hint">
        <label class="st-control-label">
          <span class="label-text" style="font-size: 11px; opacity: 0.8;">{{ t('appearance.sandbox.sliderMax') }}</span>
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
        <span class="label-text">{{ t('appearance.sandbox.stagePadding') }}</span>
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
        <span class="label-text">{{ t('appearance.sandbox.stageRadius') }}</span>
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
        <span class="label-text">{{ t('appearance.sandbox.bgMaskOpacity') }}</span>
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
        <span class="label-text">{{ t('appearance.sandbox.bgMaskBlur') }}</span>
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
        <span class="muted" style="font-size:12px;">{{ t('appearance.sandbox.bgMaskBlurHint') }}</span>
      </div>
    </div>

    <!-- 舞台背景不透明度 -->
    <div class="st-control" data-slider="sandboxStageBgOpacity">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.sandbox.stageBgOpacity') }}</span>
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

    <p class="muted">{{ t('appearance.sandbox.tip') }}</p>
  </div>
</template>

<style src="./shared-appearance.css" scoped></style>