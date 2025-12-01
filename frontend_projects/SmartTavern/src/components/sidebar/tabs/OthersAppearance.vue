<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import useAppearanceOthers from '@/composables/appearance/useAppearanceOthers'
import { useI18n } from '@/locales'
import { useAppearanceSettingsStore } from '@/stores/appearanceSettings'
import { storeToRefs } from 'pinia'

const { t } = useI18n()

// 获取 Pinia store 用于更新全局设置
const appearanceStore = useAppearanceSettingsStore()

/**
 * 其他外观配置（拆分自 AppearancePanel）
 * 功能：浮标吸附边距控制
 * - 控制SidebarDrawer中浮标吸附到屏幕边缘的距离
 * - CSS 变量读写
 * - 本地持久化（st.appearance.others.v2）
 * - 实时预览：拖拽滑条时可查看边距效果
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
  buildSnapshot,
  saveSnapshotLS,
} = useAppearanceOthers()

// Destructure refs for template parity
const { fabMargin } = state

// 从 Pinia store 获取全局共享的 refs
const { timezone, dateTimeFormat } = storeToRefs(appearanceStore)

// 常用时区列表（使用 i18n key）
const timezoneOptions = [
  { value: 'Asia/Shanghai', labelKey: 'appearance.others.tzShanghai' },
  { value: 'Asia/Tokyo', labelKey: 'appearance.others.tzTokyo' },
  { value: 'Asia/Seoul', labelKey: 'appearance.others.tzSeoul' },
  { value: 'Asia/Hong_Kong', labelKey: 'appearance.others.tzHongKong' },
  { value: 'Asia/Singapore', labelKey: 'appearance.others.tzSingapore' },
  { value: 'Europe/London', labelKey: 'appearance.others.tzLondon' },
  { value: 'Europe/Paris', labelKey: 'appearance.others.tzParis' },
  { value: 'America/New_York', labelKey: 'appearance.others.tzNewYork' },
  { value: 'America/Los_Angeles', labelKey: 'appearance.others.tzLosAngeles' },
  { value: 'America/Chicago', labelKey: 'appearance.others.tzChicago' },
  { value: 'UTC', labelKey: 'appearance.others.tzUTC' },
]

// 日期时间格式选项（使用i18n key作为label）
const dateTimeFormatOptions = ref([
  { value: 'YYYY-MM-DD HH:mm', labelKey: 'appearance.others.formatISO24' },
  { value: 'YYYY-MM-DD hh:mm A', labelKey: 'appearance.others.formatISO12' },
  { value: 'MM/DD/YYYY HH:mm', labelKey: 'appearance.others.formatUS24' },
  { value: 'MM/DD/YYYY hh:mm A', labelKey: 'appearance.others.formatUS12' },
  { value: 'DD/MM/YYYY HH:mm', labelKey: 'appearance.others.formatEU24' },
  { value: 'DD/MM/YYYY hh:mm A', labelKey: 'appearance.others.formatEU12' },
  { value: 'YYYY年MM月DD日 HH:mm', labelKey: 'appearance.others.formatCN24' },
  { value: 'YYYY年MM月DD日 hh:mm A', labelKey: 'appearance.others.formatCN12' },
])

// 持久化：任意外观变更立即保存到浏览器，避免刷新后丢失
// 注意：state 是普通对象（包含 ref），不是 reactive 对象，需要监听具体的 ref
watch([fabMargin, timezone, dateTimeFormat], () => {
  try {
    const snap = buildSnapshot()
    saveSnapshotLS(snap)
  } catch (_) {}
})

// Handlers
function onFabMarginInput(e) {
  fabMargin.value = Number(e.target.value)
  setRootVar('--st-fab-margin', fabMargin.value)
}
function onFabMarginNumberInput(e) {
  const v = Number(e.target.value)
  if (v >= 0 && v <= 100) {
    fabMargin.value = v
    setRootVar('--st-fab-margin', v)
  }
}

function onTimezoneChange(e) {
  appearanceStore.setTimezone(e.target.value)
}

function onDateTimeFormatChange(e) {
  appearanceStore.setDateTimeFormat(e.target.value)
}

// Lifecycle: init + auto-save broadcast
let __dispose = null
onMounted(() => {
  initFromCSS()
  __dispose = startAutoSave({ intervalMs: 1000 })
})
onBeforeUnmount(() => {
  if (typeof __dispose === 'function') __dispose()
})
</script>

<template>
  <div class="st-tab-panel" data-scope="settings-others">
    <h3>{{ t('appearance.others.title') }}</h3>
    <p class="muted">{{ t('appearance.others.desc') }}</p>

    <!-- 浮标吸附边距 -->
    <div class="st-control" data-slider="fabMargin">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.others.fabMargin') }}</span>
        <div class="value-group">
          <input
            type="number"
            class="st-number-input"
            :value="fabMargin"
            min="0"
            max="100"
            @input="onFabMarginNumberInput"
          />
          <span class="unit">px</span>
        </div>
      </label>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        :value="fabMargin"
        @pointerdown="onTuningStart('fabMargin')"
        @input="onFabMarginInput"
      />
      <div class="st-control-hint">
        <span class="muted st-hint-text">{{ t('appearance.others.fabMarginHint') }}</span>
      </div>
    </div>

    <p class="muted">{{ t('appearance.others.tuningTip') }}</p>

    <!-- 时区设置 -->
    <div class="st-control">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.others.timezone') }}</span>
      </label>
      <select
        class="st-select-input"
        :value="timezone"
        @change="onTimezoneChange"
      >
        <option
          v-for="tz in timezoneOptions"
          :key="tz.value"
          :value="tz.value"
        >
          {{ t(tz.labelKey) }}
        </option>
      </select>
      <div class="st-control-hint">
        <span class="muted st-hint-text">{{ t('appearance.others.timezoneHint') }}</span>
      </div>
    </div>

    <!-- 日期时间显示格式 -->
    <div class="st-control">
      <label class="st-control-label">
        <span class="label-text">{{ t('appearance.others.dateTimeFormat') }}</span>
      </label>
      <select
        class="st-select-input"
        :value="dateTimeFormat"
        @change="onDateTimeFormatChange"
      >
        <option
          v-for="fmt in dateTimeFormatOptions"
          :key="fmt.value"
          :value="fmt.value"
        >
          {{ t(fmt.labelKey) }}
        </option>
      </select>
      <div class="st-control-hint">
        <span class="muted st-hint-text">{{ t('appearance.others.dateTimeFormatHint') }}</span>
      </div>
    </div>
  </div>
</template>

<style src="./shared-appearance.css" scoped></style>