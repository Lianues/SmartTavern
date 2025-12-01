<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import useAppearanceThreaded from '@/composables/appearance/useAppearanceThreaded'
import { useI18n } from '@/locales'
import { useAppearanceSettingsStore } from '@/stores/appearanceSettings'
import { storeToRefs } from 'pinia'

const { t } = useI18n()

// 获取 Pinia store 用于消息侧边栏宽度
const appearanceStore = useAppearanceSettingsStore()
const { messageSidebarWidth } = storeToRefs(appearanceStore)

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
  chatWidth, inputHeight, inputBottomMargin,
  contentLineHeight, messageGap, cardRadius, stripeWidth,
  threadedBgOpacityPct, threadedListBgOpacityPct, threadedInputBgOpacityPct,
  // 新增：背景图片遮罩模糊（px）
  threadedBgBlurPx,
  thAspectX, thAspectY, thMaxWidthPct, thPadding, thRadius,
  // 新增：楼层 HTML 舞台显示模式（auto/fixed/inline）
  threadedDisplayModeSel,
} = state

// 从 appearanceSettings store 获取 iframe 渲染配置
const { iframeRenderMode, iframeRenderRange } = storeToRefs(appearanceStore)

// 持久化：任意外观变更立即保存到浏览器，避免刷新后丢失
// 注意：state 是普通对象（包含 ref），需要监听所有 ref 的数组
// iframe 渲染配置由 appearanceSettings store 自动持久化，不需要在这里监听
watch(
  [contentFontSize, nameFontSize, badgeFontSize, floorFontSize, avatarSize, chatWidth, inputHeight, inputBottomMargin, contentLineHeight, messageGap, cardRadius, stripeWidth, threadedBgOpacityPct, threadedListBgOpacityPct, threadedInputBgOpacityPct, threadedBgBlurPx, thAspectX, thAspectY, thMaxWidthPct, thPadding, thRadius, threadedDisplayModeSel, messageSidebarWidth],
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
function onInputHeightNumberInput(e) { const v = Number(e.target.value); if (v >= 80 && v <= 300) { inputHeight.value = v; setRootVar('--st-input-height', v) } }

function onInputBottomMarginInput(e) { inputBottomMargin.value = Number(e.target.value); setRootVar('--st-input-bottom-margin', inputBottomMargin.value) }
function onInputBottomMarginNumberInput(e) { const v = Number(e.target.value); if (v >= 0 && v <= 100) { inputBottomMargin.value = v; setRootVar('--st-input-bottom-margin', v) } }

// Common appearance
function onContentLineHeightNumberInput(e) { const v = Number(e.target.value); if (v >= 1.2 && v <= 2.0) { contentLineHeight.value = v; setRootVarUnitless('--st-content-line-height', String(v)) } }
function onContentLineHeightRangeInput(e) { contentLineHeight.value = Number(e.target.value); setRootVarUnitless('--st-content-line-height', String(contentLineHeight.value)) }

function onMessageGapNumberInput(e) { const v = Number(e.target.value); if (v >= 0 && v <= 24) { messageGap.value = v; setRootVar('--st-message-gap', v) } }
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

// 消息侧边栏宽度处理
function onMessageSidebarWidthInput(e) {
  const v = Number(e.target.value)
  appearanceStore.setMessageSidebarWidth(v)
}
function onMessageSidebarWidthNumberInput(e) {
  const v = Number(e.target.value)
  if (v >= 60 && v <= 150) {
    appearanceStore.setMessageSidebarWidth(v)
  }
}

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

    <div class="st-control" data-slider="messageSidebarWidth">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.messageSidebarWidth') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="messageSidebarWidth" min="60" max="150" @input="onMessageSidebarWidthNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="60" max="150" step="5" :value="messageSidebarWidth" @pointerdown="onTuningStart('messageSidebarWidth')" @input="onMessageSidebarWidthInput" />
      <div class="st-control-hint">
        <span class="muted" style="font-size:12px;">{{ t('appearance.threaded.messageSidebarWidthHint') }}</span>
      </div>
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
          <input type="number" class="st-number-input" :value="inputHeight" min="80" max="300" @input="onInputHeightNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="80" max="300" step="10" :value="inputHeight" @pointerdown="onTuningStart('inputHeight')" @input="onInputHeightInput" />
    </div>

    <div class="st-control" data-slider="inputBottomMargin">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.inputBottomMargin') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="inputBottomMargin" min="0" max="100" @input="onInputBottomMarginNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="0" max="100" step="1" :value="inputBottomMargin" @pointerdown="onTuningStart('inputBottomMargin')" @input="onInputBottomMarginInput" />
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
          <input type="number" class="st-number-input" :value="messageGap" min="0" max="24" step="1" @input="onMessageGapNumberInput" />
          <span class="unit">px</span>
        </div>
      </label>
      <input type="range" min="0" max="24" step="1" :value="messageGap" @pointerdown="onTuningStart('messageGap')" @input="onMessageGapRangeInput" />
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

    <!-- iframe 渲染优化 -->
    <h4 class="muted" style="margin:24px 0 0;">{{ t('appearance.threaded.iframeRenderOptimization') }}</h4>

    <div class="st-control" data-slider="iframeRenderMode">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.iframeRenderMode') }}</span>
        <div class="value-group">
          <select class="st-number-input" v-model="iframeRenderMode" style="width: 240px;">
            <option value="all">{{ t('appearance.threaded.iframeRenderModeAll') }}</option>
            <option value="track_latest">{{ t('appearance.threaded.iframeRenderModeTrackLatest') }}</option>
            <option value="track_viewport">{{ t('appearance.threaded.iframeRenderModeTrackViewport') }}</option>
          </select>
        </div>
      </label>
      <div class="st-control-hint">
        <span class="muted" style="font-size:12px;">
          {{ t('appearance.threaded.iframeRenderModeHint') }}
        </span>
      </div>
    </div>

    <div v-if="iframeRenderMode !== 'all'" class="st-control" data-slider="iframeRenderRange">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.threaded.iframeRenderRange') }}</span>
        <div class="value-group">
          <input type="number" class="st-number-input" :value="iframeRenderRange" min="1" max="50" @input="(e) => { const v = Number(e.target.value); if (v >= 1 && v <= 50) iframeRenderRange = v }" />
          <span class="unit">{{ t('appearance.threaded.layers') }}</span>
        </div>
      </label>
      <div class="st-control-hint">
        <span class="muted" style="font-size:12px;">
          {{ t('appearance.threaded.iframeRenderRangeHint') }}
        </span>
      </div>
    </div>

    <p class="muted">{{ t('appearance.threaded.tuningTip') }}</p>
  </div>
</template>

<style src="./shared-appearance.css" scoped></style>