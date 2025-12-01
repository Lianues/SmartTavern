// SmartTavern Composable: useAppearanceThreaded (v1)
// 目标：抽离"楼层对话外观"页签中的 CSS 变量读写、快照构建与本地持久化、快照广播。
// 使用方式：
//   import useAppearanceThreaded from '@/composables/appearance/useAppearanceThreaded'
//   const {
//     state, // 所有涉及的 ref
//     initFromCSS, applyState, buildSnapshot,
//     saveSnapshotLS, loadSnapshotLS,
//     startAutoSave, stopAutoSave,
//     setRootVar, setRootVarUnitless, readCssVar, readCssVarFloat
//   } = useAppearanceThreaded()
//
// 说明：
// - 本模块不直接绑定 UI 控件，仅提供状态与方法，便于在组件中复用与测试。
// - 快照广播到 ThemeManager.applyAppearanceSnapshot（若存在）以供美化扩展监听。
// - 安全：不执行任何外部脚本，仅令牌与 CSS 变量层面的更新。

import { ref, type Ref } from 'vue'
import ThemeManager from '@/features/themes/manager'

// LocalStorage key (threaded tab-scoped)
const STORE_KEY = 'st.appearance.threaded.v1'

// Interfaces
interface AppearanceThreadedState {
  contentFontSize: Ref<number>
  nameFontSize: Ref<number>
  badgeFontSize: Ref<number>
  floorFontSize: Ref<number>
  avatarSize: Ref<number>
  chatWidth: Ref<number>
  inputHeight: Ref<number>
  inputBottomMargin: Ref<number>
  contentLineHeight: Ref<number>
  messageGap: Ref<number>
  cardRadius: Ref<number>
  stripeWidth: Ref<number>
  threadedBgOpacityPct: Ref<number>
  threadedListBgOpacityPct: Ref<number>
  threadedInputBgOpacityPct: Ref<number>
  threadedBgBlurPx: Ref<number>
  thAspectX: Ref<number>
  thAspectY: Ref<number>
  thMaxWidthPct: Ref<number>
  thPadding: Ref<number>
  thRadius: Ref<number>
  threadedDisplayModeSel: Ref<string>
  // 新增：iframe 渲染优化配置
  iframeRenderMode: Ref<string>  // 'all' | 'track_latest' | 'track_viewport'
  iframeRenderRange: Ref<number> // 渲染层数范围（默认10）
}

interface AppearanceThreadedSnapshot {
  contentFontSize: number
  nameFontSize: number
  badgeFontSize: number
  floorFontSize: number
  avatarSize: number
  chatWidth: number
  inputHeight: number
  inputBottomMargin: number
  contentLineHeight: number
  messageGap: number
  cardRadius: number | null
  stripeWidth: number
  threadedBgOpacityPct: number
  threadedListBgOpacityPct: number
  threadedInputBgOpacityPct: number
  threadedBgBlurPx: number
  thAspectX: number
  thAspectY: number
  thMaxWidthPct: number
  thPadding: number
  thRadius: number
  threadedDisplayModeSel: string
  // 新增：iframe 渲染优化配置
  iframeRenderMode: string       // 'all' | 'track_latest' | 'track_viewport'
  iframeRenderRange: number      // 渲染层数范围（默认10）
}

// CSS helpers
function readCssVar(name: string, fallback: number): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name)?.trim()
  if (!v) return fallback
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}
function readCssVarFloat(name: string, fallback: number): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name)?.trim()
  if (!v) return fallback
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}
function setRootVar(name: string, value: number | string): void {
  const suffix = name === '--st-chat-width' ? '%' : 'px'
  document.documentElement.style.setProperty(name, typeof value === 'number' ? value + suffix : String(value))
}
function setRootVarUnitless(name: string, value: number | string): void {
  document.documentElement.style.setProperty(name, String(value))
}

// LS helpers
function saveSnapshotLS(snapshot: AppearanceThreadedSnapshot): boolean {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(snapshot))
    return true
  } catch (_) {
    return false
  }
}
function loadSnapshotLS(): AppearanceThreadedSnapshot | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AppearanceThreadedSnapshot
  } catch (_) {
    return null
  }
}

// State factory
function createState(): AppearanceThreadedState {
  // 字号/尺寸
  const contentFontSize = ref(18)
  const nameFontSize = ref(16)
  const badgeFontSize = ref(11)
  const floorFontSize = ref(16)
  const avatarSize = ref(56)
  const chatWidth = ref(80)
  const inputHeight = ref(100)
  const inputBottomMargin = ref(0)

  // 常用外观
  const contentLineHeight = ref(1.75)
  const messageGap = ref(0)
  const cardRadius = ref(NaN) // NaN 表示未覆盖（沿用默认）
  const stripeWidth = ref(8)

  // 透明度（%）
  const threadedBgOpacityPct = ref(12)
  const threadedListBgOpacityPct = ref(62)
  const threadedInputBgOpacityPct = ref(80)
  // 背景遮罩模糊（px）
  const threadedBgBlurPx = ref(0)

  // 楼层内 HTML 舞台
  const thAspectX = ref(16)
  const thAspectY = ref(9)
  const thMaxWidthPct = ref(100)
  const thPadding = ref(8)
  const thRadius = ref(12)

  // 新增：楼层 HTML 舞台显示模式（'auto' | 'fixed' | 'inline'）
  const threadedDisplayModeSel = ref('auto')
  
  // 新增：iframe 渲染优化配置
  const iframeRenderMode = ref('all')       // 'all' | 'track_latest' | 'track_viewport'
  const iframeRenderRange = ref(10)         // 渲染层数范围（默认10）
 
  return {
    contentFontSize, nameFontSize, badgeFontSize, floorFontSize, avatarSize,
    chatWidth, inputHeight, inputBottomMargin,
    contentLineHeight, messageGap, cardRadius, stripeWidth,
    threadedBgOpacityPct, threadedListBgOpacityPct, threadedInputBgOpacityPct,
    // 新增
    threadedBgBlurPx,
    thAspectX, thAspectY, thMaxWidthPct, thPadding, thRadius,
    threadedDisplayModeSel,
    // iframe 渲染优化
    iframeRenderMode,
    iframeRenderRange,
  }
}

// Build snapshot from state refs
function buildSnapshot(state: AppearanceThreadedState): AppearanceThreadedSnapshot {
  return {
    contentFontSize: Number(state.contentFontSize.value),
    nameFontSize: Number(state.nameFontSize.value),
    badgeFontSize: Number(state.badgeFontSize.value),
    floorFontSize: Number(state.floorFontSize.value),
    avatarSize: Number(state.avatarSize.value),
    chatWidth: Number(state.chatWidth.value),
    inputHeight: Number(state.inputHeight.value),
    inputBottomMargin: Number(state.inputBottomMargin.value),

    contentLineHeight: Number(state.contentLineHeight.value),
    messageGap: Number(state.messageGap.value),
    cardRadius: Number.isFinite(state.cardRadius.value) ? Number(state.cardRadius.value) : null,
    stripeWidth: Number(state.stripeWidth.value),
 
    threadedBgOpacityPct: Number(state.threadedBgOpacityPct.value),
    threadedListBgOpacityPct: Number(state.threadedListBgOpacityPct.value),
    threadedInputBgOpacityPct: Number(state.threadedInputBgOpacityPct.value),
    // 新增：背景遮罩模糊（px）
    threadedBgBlurPx: Number(state.threadedBgBlurPx.value),
 
    thAspectX: Number(state.thAspectX.value),
    thAspectY: Number(state.thAspectY.value),
    thMaxWidthPct: Number(state.thMaxWidthPct.value),
    thPadding: Number(state.thPadding.value),
    thRadius: Number(state.thRadius.value),

    // 新增：楼层 HTML 舞台显示模式（持久化）
    threadedDisplayModeSel: String(state.threadedDisplayModeSel.value),
    
    // iframe 渲染优化配置
    iframeRenderMode: String(state.iframeRenderMode.value),
    iframeRenderRange: Number(state.iframeRenderRange.value),
  }
}

// Apply state from snapshot into refs + write CSS variables
function applyState(state: AppearanceThreadedState, s: Partial<AppearanceThreadedSnapshot> | null | undefined): void {
  if (!s || typeof s !== 'object') return
  const num = (v: any, f: number): number => (typeof v === 'number' ? v : f)

  state.contentFontSize.value = num(s.contentFontSize, 18); setRootVar('--st-content-font-size', state.contentFontSize.value)
  state.nameFontSize.value = num(s.nameFontSize, 16); setRootVar('--st-name-font-size', state.nameFontSize.value)
  state.badgeFontSize.value = num(s.badgeFontSize, 11); setRootVar('--st-badge-font-size', state.badgeFontSize.value)
  state.floorFontSize.value = num(s.floorFontSize, 16); setRootVar('--st-floor-font-size', state.floorFontSize.value)
  state.avatarSize.value = num(s.avatarSize, 56); setRootVar('--st-avatar-size', state.avatarSize.value)
  state.chatWidth.value = num(s.chatWidth, 80); setRootVar('--st-chat-width', state.chatWidth.value)
  state.inputHeight.value = num(s.inputHeight, 100); setRootVar('--st-input-height', state.inputHeight.value)
  state.inputBottomMargin.value = num(s.inputBottomMargin, 0); setRootVar('--st-input-bottom-margin', state.inputBottomMargin.value)

  state.contentLineHeight.value = num(s.contentLineHeight, 1.75); setRootVarUnitless('--st-content-line-height', String(state.contentLineHeight.value))
  state.messageGap.value = num(s.messageGap, 0); setRootVar('--st-message-gap', state.messageGap.value)

  if (s.cardRadius === null) {
    state.cardRadius.value = NaN
    document.documentElement.style.removeProperty('--st-card-radius')
  } else {
    state.cardRadius.value = num(s.cardRadius, NaN)
    if (Number.isFinite(state.cardRadius.value)) setRootVar('--st-card-radius', state.cardRadius.value)
  }
  state.stripeWidth.value = num(s.stripeWidth, 8); setRootVar('--st-stripe-width', state.stripeWidth.value)

  state.threadedBgOpacityPct.value = num(s.threadedBgOpacityPct, 12); setRootVarUnitless('--st-threaded-bg-opacity', String(state.threadedBgOpacityPct.value / 100))
  state.threadedListBgOpacityPct.value = num(s.threadedListBgOpacityPct, 62); setRootVarUnitless('--st-threaded-list-bg-opacity', String(state.threadedListBgOpacityPct.value / 100))
  state.threadedInputBgOpacityPct.value = num(s.threadedInputBgOpacityPct, 80); setRootVarUnitless('--st-threaded-input-bg-opacity', String(state.threadedInputBgOpacityPct.value / 100))
  
  // 楼层消息背景固定为完全透明
  setRootVarUnitless('--st-threaded-msg-bg-opacity', '0')

  // 新增：背景遮罩模糊
  state.threadedBgBlurPx.value = num(s.threadedBgBlurPx, 0); setRootVar('--st-threaded-bg-blur', state.threadedBgBlurPx.value)

  state.thAspectX.value = num(s.thAspectX, 16)
  state.thAspectY.value = num(s.thAspectY, 9)
  setRootVarUnitless('--st-threaded-stage-aspect', `${state.thAspectX.value} / ${state.thAspectY.value}`)
  state.thMaxWidthPct.value = num(s.thMaxWidthPct, 100); setRootVarUnitless('--st-threaded-stage-maxw', state.thMaxWidthPct.value)
  state.thPadding.value = num(s.thPadding, 8); setRootVar('--st-threaded-stage-padding', state.thPadding.value)
  state.thRadius.value = num(s.thRadius, 12); setRootVar('--st-threaded-stage-radius', state.thRadius.value)

  // 新增：楼层 HTML 舞台显示模式（不涉及 CSS 变量，纯持久化与消费者读取）
  state.threadedDisplayModeSel.value = typeof s.threadedDisplayModeSel === 'string'
    ? s.threadedDisplayModeSel
    : 'auto'
  
  // iframe 渲染优化配置
  state.iframeRenderMode.value = typeof s.iframeRenderMode === 'string'
    ? s.iframeRenderMode
    : 'all'
  state.iframeRenderRange.value = num(s.iframeRenderRange, 10)
}

// Initialize refs from current CSS variables and write-back to sync UI
function initFromCSS(state: AppearanceThreadedState): void {
  // 优先：从浏览器持久化（localStorage）恢复完整快照
  try {
    const snap = loadSnapshotLS()
    if (snap && typeof snap === 'object') {
      applyState(state, snap) // 写入 refs + 同步 CSS 变量
      return
    }
  } catch (_) {}

  // 回退路径：读取现有 CSS 变量作为初始值
  state.contentFontSize.value = readCssVar('--st-content-font-size', 18)
  state.nameFontSize.value = readCssVar('--st-name-font-size', 16)
  state.badgeFontSize.value = readCssVar('--st-badge-font-size', 11)
  state.floorFontSize.value = readCssVar('--st-floor-font-size', 16)
  state.avatarSize.value = readCssVar('--st-avatar-size', 56)
  {
    const widthVar = getComputedStyle(document.documentElement).getPropertyValue('--st-chat-width')?.trim()
    state.chatWidth.value = widthVar ? parseInt(widthVar, 10) : 80
  }
  state.inputHeight.value = readCssVar('--st-input-height', 100)
  state.inputBottomMargin.value = readCssVar('--st-input-bottom-margin', 0)

  state.contentLineHeight.value = readCssVarFloat('--st-content-line-height', 1.75)
  state.messageGap.value = readCssVarFloat('--st-message-gap', 0)
  {
    const cr = readCssVarFloat('--st-card-radius', NaN)
    state.cardRadius.value = Number.isFinite(cr) ? cr : NaN
  }
  state.stripeWidth.value = readCssVarFloat('--st-stripe-width', 8)

  state.threadedBgOpacityPct.value = Math.round(readCssVarFloat('--st-threaded-bg-opacity', 0.12) * 100)
  state.threadedListBgOpacityPct.value = Math.round(readCssVarFloat('--st-threaded-list-bg-opacity', 0.62) * 100)
  state.threadedInputBgOpacityPct.value = Math.round(readCssVarFloat('--st-threaded-input-bg-opacity', 0.80) * 100)

  // 背景遮罩模糊（px）
  state.threadedBgBlurPx.value = readCssVar('--st-threaded-bg-blur', 0)

  // 楼层 HTML 舞台
  {
    const asp = getComputedStyle(document.documentElement).getPropertyValue('--st-threaded-stage-aspect')?.trim()
    if (asp && asp.includes('/')) {
      const parts = asp.split('/')
      if (parts[0] && parts[1]) {
        const ax = parseFloat(parts[0]); const ay = parseFloat(parts[1])
        if (Number.isFinite(ax) && Number.isFinite(ay) && ax > 0 && ay > 0) {
          state.thAspectX.value = Math.round(ax)
          state.thAspectY.value = Math.round(ay)
        }
      }
    }
  }
  state.thMaxWidthPct.value = readCssVarFloat('--st-threaded-stage-maxw', 100)
  state.thPadding.value = readCssVarFloat('--st-threaded-stage-padding', 8)
  state.thRadius.value = readCssVarFloat('--st-threaded-stage-radius', 12)

  // 写回 CSS 变量，保持 UI 与变量同步
  setRootVar('--st-content-font-size', state.contentFontSize.value)
  setRootVar('--st-name-font-size', state.nameFontSize.value)
  setRootVar('--st-badge-font-size', state.badgeFontSize.value)
  setRootVar('--st-floor-font-size', state.floorFontSize.value)
  setRootVar('--st-avatar-size', state.avatarSize.value)
  setRootVar('--st-chat-width', state.chatWidth.value)
  setRootVar('--st-input-height', state.inputHeight.value)
  setRootVar('--st-input-bottom-margin', state.inputBottomMargin.value)
  setRootVarUnitless('--st-content-line-height', String(state.contentLineHeight.value))
  setRootVar('--st-message-gap', state.messageGap.value)
  if (Number.isFinite(state.cardRadius.value)) setRootVar('--st-card-radius', state.cardRadius.value)
  setRootVar('--st-stripe-width', state.stripeWidth.value)
  setRootVarUnitless('--st-threaded-bg-opacity', String(state.threadedBgOpacityPct.value / 100))
  setRootVarUnitless('--st-threaded-list-bg-opacity', String(state.threadedListBgOpacityPct.value / 100))
  setRootVarUnitless('--st-threaded-input-bg-opacity', String(state.threadedInputBgOpacityPct.value / 100))
  // 楼层消息背景固定为完全透明
  setRootVarUnitless('--st-threaded-msg-bg-opacity', '0')
  setRootVar('--st-threaded-bg-blur', state.threadedBgBlurPx.value)
  setRootVarUnitless('--st-threaded-stage-aspect', `${state.thAspectX.value} / ${state.thAspectY.value}`)
  setRootVarUnitless('--st-threaded-stage-maxw', state.thMaxWidthPct.value)
  setRootVar('--st-threaded-stage-padding', state.thPadding.value)
  setRootVar('--st-threaded-stage-radius', state.thRadius.value)

  // 持久化一次，确保后续刷新可以完整恢复
  try { saveSnapshotLS(buildSnapshot(state)) } catch (_) {}
}

// Auto save timer
function startAutoSave(state: AppearanceThreadedState, { intervalMs = 1000 }: { intervalMs?: number } = {}): () => void {
  let last = ''
  function tick(): void {
    try {
      const snap = buildSnapshot(state)
      const str = JSON.stringify(snap)
      if (str !== last) {
        saveSnapshotLS(snap)
        last = str
      }
      // Broadcast snapshot for theme extensions (optional)
      try { ThemeManager?.applyAppearanceSnapshot?.(snap) } catch (_) {}
    } catch (_) {}
  }
  const timer = setInterval(tick, intervalMs)
  return () => {
    clearInterval(timer)
  }
}
function stopAutoSave(stopFn: (() => void) | undefined): void {
  try { typeof stopFn === 'function' && stopFn() } catch (_) {}
}

// Composable entry
export default function useAppearanceThreaded() {
  const state = createState()
  return {
    state,
    // lifecycle helpers
    initFromCSS: (): void => initFromCSS(state),
    applyState: (snap: Partial<AppearanceThreadedSnapshot> | null | undefined): void => applyState(state, snap),
    buildSnapshot: (): AppearanceThreadedSnapshot => buildSnapshot(state),
    saveSnapshotLS: (snap: AppearanceThreadedSnapshot): boolean => saveSnapshotLS(snap),
    loadSnapshotLS,
    startAutoSave: (opts?: { intervalMs?: number }): (() => void) => startAutoSave(state, opts),
    stopAutoSave,
    // low-level helpers
    setRootVar,
    setRootVarUnitless,
    readCssVar,
    readCssVarFloat,
  }
}