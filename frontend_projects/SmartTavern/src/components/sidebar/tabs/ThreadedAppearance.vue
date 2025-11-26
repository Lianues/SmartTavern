<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import useAppearanceThreaded from '@/composables/appearance/useAppearanceThreaded'
import { useI18n } from '@/locales'

const { t } = useI18n()

/**
 * 楼层对话外观配置（拆分自 AppearancePanel）
 * 重构：使用 useAppearanceThreaded 统一处理
 * - CSS 变量读写
 * - 本地持久化（st.appearance.threaded.v1）
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
} = useAppearanceThreaded()

// Destructure refs for template parity
const {
  contentFontSize, nameFontSize, badgeFontSize, floorFontSize, avatarSize,
  chatWidth, inputHeight,
  contentLineHeight, messageGap, cardRadius, stripeWidth,
  threadedBgOpacityPct, threadedMsgBgOpacityPct, threadedListBgOpacityPct, threadedInputBgOpacityPct,
  // 新增：背景图片遮罩模糊（px）
  threadedBgBlurPx,
  thAspectX, thAspectY, thMaxWidthPct, thPadding, thRadius,
  // 新增：楼层 HTML 舞台显示模式（auto/fixed/inline）
  threadedDisplayModeSel,
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
function onContentFontSizeInput(e) { contentFontSize.value = Number(e.target.value); setRootVar('--st-content-font-size', contentFontSize.value) }
function onContentFontSizeNumberInput(e) { const v = Number(e.target.value); if (v >= 12 && v <= 32) { contentFontSize.value = v; setRootVar('--st-content-font-size', v) } }

function onNameFontSizeInput(e) { nameFontSize.value = Number(e.target.value); setRootVar('--st-name-font-size', nameFontSize.value) }
function onNameFontSizeNumberInput(e) { const v = Number(e.target.value); if (v >= 10 && v <= 24) { nameFontSize.value = v; setRootVar('--st-name-font-size', v) } }

function onBadgeFontSizeInput(e) { badgeFontSize.value = Number(e.target.value); setRootVar('--st-badge-font-size', badgeFontSize.value) }
function onBadgeFontSizeNumberInput(e) { const v = Number(e.target.value); if (v >= 8 && v <= 16) { badgeFontSize.value = v; setRootVar('--st-badge-font-size', v) } }

function onFloorFontSizeInput(e) { floorFontSize.value = Number(e.target.value); setRootVar('--st-floor-font-size', floorFontSize.value) }
function onFloorFontSizeNumberInput(e) { const v = Number(e.target.value); if (v >= 10 && v <= 24) { floorFontSize.value = v; setRootVar('--st-floor-font-size', v) } }

function onAvatarSizeInput(e) { avatarSize.value = Number(e.target.value); setRootVar('--st-avatar-size', avatarSize.value) }
function onAvatarSizeNumberInput(e) { const v = Number(e.target.value); if (v >= 32 && v <= 80) { avatarSize.value = v; setRootVar('--st-avatar-size', v) } }

function onWidthInput(e) { chatWidth.value = Number(e.target.value); setRootVar('--st-chat-width', chatWidth.value) }
function onWidthNumberInput(e) { const v = Number(e.target.value); if (v >= 30 && v <= 100) { chatWidth.value = v; setRootVar('--st-chat-width', v) } }

function onInputHeightInput(e) { inputHeight.value = Number(e.target.value); setRootVar('--st-input-height', inputHeight.value) }
function onInputHeightNumberInput(e) { const v = Number(e.target.value); if (v >= 60 && v <= 300) { inputHeight.value = v; setRootVar('--st-input-height', v) } }

// Common appearance
function onContentLineHeightNumberInput(e) { const v = Number(e.target.value); if (v >= 1.2 && v <= 2.0) { contentLineHeight.value = v; setRootVarUnitless('--st-content-line-height', String(v)) } }
function onContentLineHeightRangeInput(e) { contentLineHeight.value = Number(e.target.value); setRootVarUnitless('--st-content-line-height', String(contentLineHeight.value)) }

function onMessageGapNumberInput(e) { const v = Number(e.target.value); if (v >= 6 && v <= 24) { messageGap.value = v; setRootVar('--st-message-gap', v) } }
function onMessageGapRangeInput(e) { messageGap.value = Number(e.target.value); setRootVar('--st-message-gap', messageGap.value) }

function onCardRadiusNumberInput(e) { const v = Number(e.target.value); if (v >= 0 && v <= 24) { cardRadius.value = v; setRootVar('--st-card-radius', v) } }
function onCardRadiusRangeInput(e) { cardRadius.value = Number(e.target.value); setRootVar('--st-card-radius', cardRadius.value) }

function onStripeWidthNumberInput(e) { const v = Number(e.target.value); if (v >= 0 && v <= 12) { stripeWidth.value = v; setRootVar('--st-stripe-width', v) } }
function onStripeWidthRangeInput(e) { stripeWidth.value = Number(e.target.value); setRootVar('--st-stripe-width', stripeWidth.value) }

/* Opacity handlers (% → 0~1) */
function onThreadedBgOpacityNumberInput(e) { const v = Number(e.target.value); if (v >= 0 && v <= 100) { threadedBgOpacityPct.value = v; setRootVarUnitless('--st-threaded-bg-opacity', String(v / 100)) } }
function onThreadedBgOpacityRangeInput(e) { threadedBgOpacityPct.value = Number(e.target.value); setRootVarUnitless('--st-threaded-bg-opacity', String(threadedBgOpacityPct.value / 100)) }

/* Blur handlers (px) */
function onThreadedBgBlurNumberInput(e) { const v = Number(e.target.value); if (v >= 0 && v <= 50) { threadedBgBlurPx.value = v; setRootVar('--st-threaded-bg-blur', v) } }
function onThreadedBgBlurRangeInput(e) { threadedBgBlurPx.value = Number(e.target.value); setRootVar('--st-threaded-bg-blur', threadedBgBlurPx.value) }

function onThreadedMsgBgOpacityNumberInput(e) { const v = Number(e.target.value); if (v >= 0 && v <= 100) { threadedMsgBgOpacityPct.value = v; setRootVarUnitless('--st-threaded-msg-bg-opacity', String(v / 100)) } }
function onThreadedMsgBgOpacityRangeInput(e) { threadedMsgBgOpacityPct.value = Number(e.target.value); setRootVarUnitless('--st-threaded-msg-bg-opacity', String(threadedMsgBgOpacityPct.value / 100)) }

function onThreadedListBgOpacityNumberInput(e) { const v = Number(e.target.value); if (v >= 0 && v <= 100) { threadedListBgOpacityPct.value = v; setRootVarUnitless('--st-threaded-list-bg-opacity', String(v / 100)) } }
function onThreadedListBgOpacityRangeInput(e) { threadedListBgOpacityPct.value = Number(e.target.value); setRootVarUnitless('--st-threaded-list-bg-opacity', String(threadedListBgOpacityPct.value / 100)) }

function onThreadedInputBgOpacityNumberInput(e) { const v = Number(e.target.value); if (v >= 0 && v <= 100) { threadedInputBgOpacityPct.value = v; setRootVarUnitless('--st-threaded-input-bg-opacity', String(v / 100)) } }
function onThreadedInputBgOpacityRangeInput(e) { threadedInputBgOpacityPct.value = Number(e.target.value); setRootVarUnitless('--st-threaded-input-bg-opacity', String(threadedInputBgOpacityPct.value / 100)) }

// Threaded HTML stage handlers
function onThreadedAspectPreset(e) {
  const raw = e.target.value
  if (!raw) return
  const [ax, ay] = raw.split(',').map(Number)
  if (ax > 0 && ay > 0) {
    thAspectX.value = ax
    thAspectY.value = ay
    setRootVarUnitless('--st-threaded-stage-aspect', `${ax} / ${ay}`)
  }
}
function onThreadedAspectNumInputX(e) { const v = Number(e.target.value); if (v > 0) { thAspectX.value = v; setRootVarUnitless('--st-threaded-stage-aspect', `${thAspectX.value} / ${thAspectY.value}`) } }
function onThreadedAspectNumInputY(e) { const v = Number(e.target.value); if (v > 0) { thAspectY.value = v; setRootVarUnitless('--st-threaded-stage-aspect', `${thAspectX.value} / ${thAspectY.value}`) } }
function onThreadedMaxWidthNumberInput(e) { const v = Number(e.target.value); if (v >= 30 && v <= 100) { thMaxWidthPct.value = v; setRootVarUnitless('--st-threaded-stage-maxw', thMaxWidthPct.value) } }
function onThreadedMaxWidthRangeInput(e) { thMaxWidthPct.value = Number(e.target.value); setRootVarUnitless('--st-threaded-stage-maxw', thMaxWidthPct.value) }
function onThreadedPaddingNumberInput(e) { const v = Number(e.target.value); if (v >= 0 && v <= 48) { thPadding.value = v; setRootVar('--st-threaded-stage-padding', thPadding.value) } }
function onThreadedPaddingRangeInput(e) { thPadding.value = Number(e.target.value); setRootVar('--st-threaded-stage-padding', thPadding.value) }
function onThreadedRadiusNumberInput(e) { const v = Number(e.target.value); if (v >= 0 && v <= 32) { thRadius.value = v; setRootVar('--st-threaded-stage-radius', thRadius.value) } }
function onThreadedRadiusRangeInput(e) { thRadius.value = Number(e.target.value); setRootVar('--st-threaded-stage-radius', thRadius.value) }

// Lifecycle: init + auto-save broadcast
let __dispose = null
onMounted(() => {
  initFromCSS()
  __dispose = startAutoSave({ intervalMs: 1000 })
  // 实时保存并广播：切换显示模式即刻生效
  watch(threadedDisplayModeSel, (v) => {
    try {
      const snap = buildSnapshot()
      snap.threadedDisplayModeSel = String(v)
      saveSnapshotLS(snap)
      window.dispatchEvent(new CustomEvent('stAppearanceThreadedUpdate', { detail: snap }))
    } catch (_) {}
  }, { immediate: true })
})
onBeforeUnmount(() => {
  if (typeof __dispose === 'function') __dispose()
})
</script>

<template>
  <div class="st-tab-panel" data-scope="settings-threaded">
    <h3>{{ t('appearance.threaded.title') }}</h3>

    <!-- 字号/尺寸 -->
    <div class="st-control" data-slider="contentFontSize">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.contentFontSize') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="contentFontSize" min="12" max="32" @input="onContentFontSizeNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="12" max="32" step="1" :value="contentFontSize" @pointerdown="onTuningStart('contentFontSize')" @input="onContentFontSizeInput" />
    </div>

    <div class="st-control" data-slider="nameFontSize">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.nameFontSize') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="nameFontSize" min="10" max="24" @input="onNameFontSizeNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="10" max="24" step="1" :value="nameFontSize" @pointerdown="onTuningStart('nameFontSize')" @input="onNameFontSizeInput" />
    </div>

    <div class="st-control" data-slider="badgeFontSize">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.badgeFontSize') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="badgeFontSize" min="8" max="16" @input="onBadgeFontSizeNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="8" max="16" step="1" :value="badgeFontSize" @pointerdown="onTuningStart('badgeFontSize')" @input="onBadgeFontSizeInput" />
    </div>

    <div class="st-control" data-slider="floorFontSize">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.floorFontSize') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="floorFontSize" min="10" max="24" @input="onFloorFontSizeNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="10" max="24" step="1" :value="floorFontSize" @pointerdown="onTuningStart('floorFontSize')" @input="onFloorFontSizeInput" />
    </div>

    <div class="st-control" data-slider="avatarSize">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.avatarSize') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="avatarSize" min="32" max="80" @input="onAvatarSizeNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="32" max="80" step="2" :value="avatarSize" @pointerdown="onTuningStart('avatarSize')" @input="onAvatarSizeInput" />
    </div>

    <div class="st-control" data-slider="chatWidth">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.chatWidth') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="chatWidth" min="30" max="100" @input="onWidthNumberInput" />
          <span class="unit">%</span>
        </div>
      </label>
      <input type="range" min="30" max="100" step="1" :value="chatWidth" @pointerdown="onTuningStart('chatWidth')" @input="onWidthInput" />
    </div>

    <div class="st-control" data-slider="inputHeight">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.inputHeight') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="inputHeight" min="60" max="300" @input="onInputHeightNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="60" max="300" step="10" :value="inputHeight" @pointerdown="onTuningStart('inputHeight')" @input="onInputHeightInput" />
    </div>

    <!-- 常用外观 -->
    <div class="st-control" data-slider="contentLineHeight">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.lineHeight') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="contentLineHeight" min="1.2" max="2.0" step="0.05" @input="onContentLineHeightNumberInput" />
          <span class="unit">×</span>
        </div>
      </label>
      <input type="range" min="1.2" max="2.0" step="0.05" :value="contentLineHeight" @pointerdown="onTuningStart('contentLineHeight')" @input="onContentLineHeightRangeInput" />
    </div>

    <div class="st-control" data-slider="messageGap">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.messageGap') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="messageGap" min="6" max="24" step="1" @input="onMessageGapNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="6" max="24" step="1" :value="messageGap" @pointerdown="onTuningStart('messageGap')" @input="onMessageGapRangeInput" />
    </div>

    <div class="st-control" data-slider="cardRadius">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.cardRadius') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="Number.isFinite(cardRadius) ? cardRadius : ''" min="0" max="24" step="1" @input="onCardRadiusNumberInput" :placeholder="t('common.default')" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="0" max="24" step="1" :value="Number.isFinite(cardRadius) ? cardRadius : 12" @pointerdown="onTuningStart('cardRadius')" @input="onCardRadiusRangeInput" />
    </div>

    <div class="st-control" data-slider="stripeWidth">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.stripeWidth') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="stripeWidth" min="0" max="12" step="1" @input="onStripeWidthNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="0" max="12" step="1" :value="stripeWidth" @pointerdown="onTuningStart('stripeWidth')" @input="onStripeWidthRangeInput" />
    </div>

    <!-- 透明度 -->
    <div class="st-control" data-slider="threadedBgOpacity">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.bgMaskOpacity') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="threadedBgOpacityPct" min="0" max="100" @input="onThreadedBgOpacityNumberInput" />
          <span class="unit">%</span>
        </div>
      </label>
      <input type="range" min="0" max="100" step="1" :value="threadedBgOpacityPct" @pointerdown="onTuningStart('threadedBgOpacity')" @input="onThreadedBgOpacityRangeInput" />
    </div>

    <div class="st-control" data-slider="threadedBgBlur">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.bgMaskBlur') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="threadedBgBlurPx" min="0" max="50" @input="onThreadedBgBlurNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="0" max="50" step="1" :value="threadedBgBlurPx" @pointerdown="onTuningStart('threadedBgBlur')" @input="onThreadedBgBlurRangeInput" />
      <div class="st-control-hint">
        <span class="muted" style="font-size:12px;">{{ t('appearance.threaded.bgMaskBlurHint') }}</span>
      </div>
    </div>

    <div class="st-control" data-slider="threadedMsgBgOpacity">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.msgBgOpacity') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="threadedMsgBgOpacityPct" min="0" max="100" @input="onThreadedMsgBgOpacityNumberInput" />
          <span class="unit">%</span>
        </div>
      </label>
      <input type="range" min="0" max="100" step="1" :value="threadedMsgBgOpacityPct" @pointerdown="onTuningStart('threadedMsgBgOpacity')" @input="onThreadedMsgBgOpacityRangeInput" />
    </div>

    <div class="st-control" data-slider="threadedListBgOpacity">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.listBgOpacity') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="threadedListBgOpacityPct" min="0" max="100" @input="onThreadedListBgOpacityNumberInput" />
          <span class="unit">%</span>
        </div>
      </label>
      <input type="range" min="0" max="100" step="1" :value="threadedListBgOpacityPct" @pointerdown="onTuningStart('threadedListBgOpacity')" @input="onThreadedListBgOpacityRangeInput" />
    </div>

    <div class="st-control" data-slider="threadedInputBgOpacity">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.inputBgOpacity') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="threadedInputBgOpacityPct" min="0" max="100" @input="onThreadedInputBgOpacityNumberInput" />
          <span class="unit">%</span>
        </div>
      </label>
      <input type="range" min="0" max="100" step="1" :value="threadedInputBgOpacityPct" @pointerdown="onTuningStart('threadedInputBgOpacity')" @input="onThreadedInputBgOpacityRangeInput" />
    </div>

    <!-- 楼层对话：HTML 舞台（iframe） -->
    <h4 class="muted" style="margin:8px 0 0;">{{ t('appearance.threaded.htmlStage') }}</h4>

    <!-- 显示模式（固定 / 自适应 / 由沙盒内代码决定） -->
    <div class="st-control" data-slider="threadedDisplayMode">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.displayMode') }}</span>
        <div class="value-group">
          <select class="st-number-input" v-model="threadedDisplayModeSel" style="width: 200px;">
            <option value="auto">{{ t('appearance.threaded.displayModeAuto') }}</option>
            <option value="fixed">{{ t('appearance.threaded.displayModeFixed') }}</option>
            <option value="inline">{{ t('appearance.threaded.displayModeInline') }}</option>
          </select>
        </div>
      </label>
      <div class="st-control-hint">
        <span class="muted" style="font-size:12px;">
          {{ t('appearance.threaded.displayModeHint') }}
        </span>
      </div>
    </div>

    <div class="st-control" data-slider="threadedStageAspect">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.aspectRatio') }}</span>
        <div class="value-group">
          <select class="st-number-input" @change="onThreadedAspectPreset">
            <option disabled selected value="">{{ t('appearance.threaded.preset') }}</option>
            <option v-for="p in aspectPresets" :key="p.label" :value="p.v.join(',')">{{ p.label }}</option>
          </select>
          <span class="unit">{{ t('appearance.threaded.orCustom') }}</span>
        </div>
      </label>
      <div style="display:flex; gap:8px; align-items:center;">
        <input type="number" class="st-number-input" :value="thAspectX" min="1" max="100" @input="onThreadedAspectNumInputX" />
        <span>:</span>
        <input type="number" class="st-number-input" :value="thAspectY" min="1" max="100" @input="onThreadedAspectNumInputY" />
      </div>
    </div>

    <div class="st-control" data-slider="threadedStageMaxWidthPct">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.stageMaxWidth') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="thMaxWidthPct" min="30" max="100" @input="onThreadedMaxWidthNumberInput" />
          <span class="unit">%</span>
        </div>
      </label>
      <input type="range" min="30" max="100" step="1" :value="thMaxWidthPct" @pointerdown="onTuningStart('threadedStageMaxWidthPct')" @input="onThreadedMaxWidthRangeInput" />
      <div class="st-control-hint">
        <span class="muted" style="font-size:12px;">{{ t('appearance.threaded.stageMaxWidthHint') }}</span>
      </div>
    </div>

    <div class="st-control" data-slider="threadedStagePadding">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.stagePadding') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="thPadding" min="0" max="48" @input="onThreadedPaddingNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="0" max="48" step="1" :value="thPadding" @pointerdown="onTuningStart('threadedStagePadding')" @input="onThreadedPaddingRangeInput" />
    </div>

    <div class="st-control" data-slider="threadedStageRadius">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.stageRadius') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="thRadius" min="0" max="32" @input="onThreadedRadiusNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="0" max="32" step="1" :value="thRadius" @pointerdown="onTuningStart('threadedStageRadius')" @input="onThreadedRadiusRangeInput" />
    </div>

    <p class="muted">{{ t('appearance.threaded.tuningTip') }}</p>
  </div>
</template>

<style>
/* 复制自 AppearancePanel 的 range slider 非 scoped 样式（限定 data-scope），以保持一致外观 */
[data-scope="settings-view"] .st-control input[type="range"],
[data-scope="settings-threaded"] .st-control input[type="range"] {
  -webkit-appearance: none; appearance: none; background: transparent; width: 100%;
}
[data-scope="settings-view"] .st-control input[type="range"]::-webkit-slider-runnable-track,
[data-scope="settings-threaded"] .st-control input[type="range"]::-webkit-slider-runnable-track {
  height: 8px !important; border-radius: 9999px !important;
  background: linear-gradient(180deg, rgba(0,0,0,0.68), rgba(0,0,0,0.82)) !important;
  border: 1px solid rgba(0,0,0,0.92) !important;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.15) !important;
}
[data-scope="settings-view"] .st-control input[type="range"]::-moz-range-track,
[data-scope="settings-threaded"] .st-control input[type="range"]::-moz-range-track {
  height: 8px !important; border-radius: 9999px !important;
  background: linear-gradient(180deg, rgba(0,0,0,0.68), rgba(0,0,0,0.82)) !important;
  border: 1px solid rgba(0,0,0,0.92) !important;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.15) !important;
}
[data-scope="settings-view"] .st-control input[type="range"]::-webkit-slider-thumb,
[data-scope="settings-threaded"] .st-control input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 9999px;
  background: linear-gradient(180deg, #ffffff, #f8f9fa) !important;
  border: 1px solid rgba(0,0,0,0.12) !important;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.9), 0 2px 4px rgba(0,0,0,0.20), 0 4px 8px rgba(0,0,0,0.10) !important;
  margin-top: -6px; cursor: pointer;
  transition: transform .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
[data-scope="settings-view"] .st-control input[type="range"]::-moz-range-thumb,
[data-scope="settings-threaded"] .st-control input[type="range"]::-moz-range-thumb {
  width: 18px; height: 18px; border-radius: 9999px;
  background: linear-gradient(180deg, #ffffff, #f8f9fa) !important;
  border: 1px solid rgba(0,0,0,0.12) !important;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.9), 0 2px 4px rgba(0,0,0,0.20), 0 4px 8px rgba(0,0,0,0.10) !important;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]::-webkit-slider-runnable-track,
[data-theme="dark"] [data-scope="settings-threaded"] .st-control input[type="range"]::-webkit-slider-runnable-track {
  background: linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.85)) !important;
  border: 1px solid rgba(255,255,255,0.95) !important;
  box-shadow: inset 0 1px 2px rgba(255,255,255,0.20), 0 1px 0 rgba(0,0,0,0.15) !important;
}
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]::-moz-range-track,
[data-theme="dark"] [data-scope="settings-threaded"] .st-control input[type="range"]::-moz-range-track {
  background: linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.85)) !important;
  border: 1px solid rgba(255,255,255,0.95) !important;
  box-shadow: inset 0 1px 2px rgba(255,255,255,0.20), 0 1px 0 rgba(0,0,0,0.15) !important;
}
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]::-webkit-slider-thumb,
[data-theme="dark"] [data-scope="settings-threaded"] .st-control input[type="range"]::-webkit-slider-thumb {
  background: linear-gradient(180deg, #1a1a1a, #0a0a0a) !important;
  border: 1px solid rgba(255,255,255,0.15) !important;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.85), 0 2px 4px rgba(255,255,255,0.15), 0 4px 8px rgba(0,0,0,0.40) !important;
}
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]::-moz-range-thumb,
[data-theme="dark"] [data-scope="settings-threaded"] .st-control input[type="range"]::-moz-range-thumb {
  background: linear-gradient(180deg, #1a1a1a, #0a0a0a) !important;
  border: 1px solid rgba(255,255,255,0.15) !important;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.85), 0 2px 4px rgba(255,255,255,0.15), 0 4px 8px rgba(0,0,0,0.40) !important;
}
[data-scope="settings-view"] .st-control input[type="range"]:hover::-webkit-slider-thumb,
[data-scope="settings-threaded"] .st-control input[type="range"]:hover::-webkit-slider-thumb,
[data-scope="settings-view"] .st-control input[type="range"]:hover::-moz-range-thumb,
[data-scope="settings-threaded"] .st-control input[type="range"]:hover::-moz-range-thumb {
  transform: scale(1.12);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.95), 0 4px 8px rgba(0,0,0,0.25), 0 6px 12px rgba(0,0,0,0.15), 0 0 0 4px rgba(var(--st-primary),0.15) !important;
}
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]:hover::-webkit-slider-thumb,
[data-theme="dark"] [data-scope="settings-threaded"] .st-control input[type="range"]:hover::-webkit-slider-thumb,
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]:hover::-moz-range-thumb,
[data-theme="dark"] [data-scope="settings-threaded"] .st-control input[type="range"]:hover::-moz-range-thumb {
  transform: scale(1.12);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.90), 0 4px 8px rgba(255,255,255,0.20), 0 6px 12px rgba(0,0,0,0.50), 0 0 0 4px rgba(var(--st-accent),0.20) !important;
}
[data-scope="settings-view"] .st-control input[type="range"]:active::-webkit-slider-thumb,
[data-scope="settings-threaded"] .st-control input[type="range"]:active::-webkit-slider-thumb,
[data-scope="settings-view"] .st-control input[type="range"]:active::-moz-range-thumb,
[data-scope="settings-threaded"] .st-control input[type="range"]:active::-moz-range-thumb {
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