// SmartTavern Composable: useAppearanceSandbox (v1)
// 目标：抽离"前端沙盒外观"页签中的 CSS 变量读写、快照构建与本地持久化、快照广播。
// 使用方式：
//   import useAppearanceSandbox from '@/composables/appearance/useAppearanceSandbox'
//   const {
//     state, // 所有涉及的 ref
//     initFromCSS, applyState, buildSnapshot,
//     saveSnapshotLS, loadSnapshotLS,
//     startAutoSave, stopAutoSave,
//     setRootVar, setRootVarUnitless, readCssVarFloat
//   } = useAppearanceSandbox()
//
// 说明：
// - 本模块不直接绑定 UI 控件，仅提供状态与方法，便于在组件中复用与测试。
// - 快照广播到 ThemeManager.applyAppearanceSnapshot（若存在）以供美化扩展监听。
// - 安全：不执行任何外部脚本，仅令牌与 CSS 变量层面的更新。

import { ref, type Ref } from 'vue'
import ThemeManager from '@/features/themes/manager'

// LocalStorage key (sandbox tab-scoped)
const STORE_KEY = 'st.appearance.sandbox.v1'

// Interfaces
interface AppearanceSandboxState {
  sandboxAspectX: Ref<number>
  sandboxAspectY: Ref<number>
  sandboxMaxWidth: Ref<number>
  sandboxMaxWidthLimit: Ref<number>
  sandboxPadding: Ref<number>
  sandboxRadius: Ref<number>
  sandboxBgOpacityPct: Ref<number>
  sandboxStageBgOpacityPct: Ref<number>
  sandboxBgBlurPx: Ref<number>
  sandboxDisplayModeSel: Ref<string>
}

interface AppearanceSandboxSnapshot {
  sandboxAspectX: number
  sandboxAspectY: number
  sandboxMaxWidth: number
  sandboxMaxWidthLimit: number
  sandboxPadding: number
  sandboxRadius: number
  sandboxBgOpacityPct: number
  sandboxStageBgOpacityPct: number
  sandboxBgBlurPx: number
  sandboxDisplayModeSel: string
}

// CSS helpers
function readCssVarFloat(name: string, fallback: number): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name)?.trim()
  if (!v) return fallback
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}
function setRootVar(name: string, value: number | string): void {
  // 这些变量都使用 px（例如 --st-sandbox-max-width/--st-sandbox-padding/--st-sandbox-radius）
  document.documentElement.style.setProperty(name, typeof value === 'number' ? `${value}px` : String(value))
}
function setRootVarUnitless(name: string, value: number | string): void {
  document.documentElement.style.setProperty(name, String(value))
}

// LS helpers
function saveSnapshotLS(snapshot: AppearanceSandboxSnapshot): boolean {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(snapshot))
    return true
  } catch (_) {
    return false
  }
}
function loadSnapshotLS(): AppearanceSandboxSnapshot | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AppearanceSandboxSnapshot
  } catch (_) {
    return null
  }
}

// State factory
function createState(): AppearanceSandboxState {
  // 宽高比
  const sandboxAspectX = ref(16)
  const sandboxAspectY = ref(9)
  // 尺寸与圆角/内边距
  const sandboxMaxWidth = ref(1100)       // px
  const sandboxMaxWidthLimit = ref(1920)  // px，可在 UI 中调整滑条上限
  const sandboxPadding = ref(16)          // px
  const sandboxRadius = ref(18)           // px
  // 透明度（%）
  const sandboxBgOpacityPct = ref(12)      // 0~100
  const sandboxStageBgOpacityPct = ref(82) // 0~100
  // 背景遮罩模糊（px）
  const sandboxBgBlurPx = ref(0)

  // 新增：沙盒容器显示模式选择（'auto' | 'fixed' | 'inline'）
  const sandboxDisplayModeSel = ref('auto')
 
  return {
    sandboxAspectX, sandboxAspectY,
    sandboxMaxWidth, sandboxMaxWidthLimit,
    sandboxPadding, sandboxRadius,
    sandboxBgOpacityPct, sandboxStageBgOpacityPct,
    // 新增
    sandboxBgBlurPx,
    sandboxDisplayModeSel,
  }
}

// Build snapshot from state refs
function buildSnapshot(state: AppearanceSandboxState): AppearanceSandboxSnapshot {
  return {
    sandboxAspectX: Number(state.sandboxAspectX.value),
    sandboxAspectY: Number(state.sandboxAspectY.value),
    sandboxMaxWidth: Number(state.sandboxMaxWidth.value),
    sandboxMaxWidthLimit: Number(state.sandboxMaxWidthLimit.value),
    sandboxPadding: Number(state.sandboxPadding.value),
    sandboxRadius: Number(state.sandboxRadius.value),
    sandboxBgOpacityPct: Number(state.sandboxBgOpacityPct.value),
    sandboxStageBgOpacityPct: Number(state.sandboxStageBgOpacityPct.value),
    // 新增：背景遮罩模糊（px）
    sandboxBgBlurPx: Number(state.sandboxBgBlurPx.value),
    // 新增：容器显示模式（持久化）
    sandboxDisplayModeSel: String(state.sandboxDisplayModeSel.value),
  }
}

// Apply state from snapshot into refs + write CSS variables
function applyState(state: AppearanceSandboxState, s: Partial<AppearanceSandboxSnapshot> | null | undefined): void {
  if (!s || typeof s !== 'object') return
  const num = (v: any, f: number): number => (typeof v === 'number' ? v : f)
 
  state.sandboxAspectX.value = num(s.sandboxAspectX, 16)
  state.sandboxAspectY.value = num(s.sandboxAspectY, 9)
  setRootVarUnitless('--st-sandbox-aspect', `${state.sandboxAspectX.value} / ${state.sandboxAspectY.value}`)
 
  state.sandboxMaxWidth.value = num(s.sandboxMaxWidth, 1100)
  setRootVar('--st-sandbox-max-width', state.sandboxMaxWidth.value)
 
  state.sandboxMaxWidthLimit.value = num(s.sandboxMaxWidthLimit, 1920)
 
  state.sandboxPadding.value = num(s.sandboxPadding, 16)
  setRootVar('--st-sandbox-padding', state.sandboxPadding.value)
 
  state.sandboxRadius.value = num(s.sandboxRadius, 18)
  setRootVar('--st-sandbox-radius', state.sandboxRadius.value)
 
  state.sandboxBgOpacityPct.value = num(s.sandboxBgOpacityPct, 12)
  setRootVarUnitless('--st-sandbox-bg-opacity', String(state.sandboxBgOpacityPct.value / 100))
 
  state.sandboxStageBgOpacityPct.value = num(s.sandboxStageBgOpacityPct, 82)
  setRootVarUnitless('--st-sandbox-stage-bg-opacity', String(state.sandboxStageBgOpacityPct.value / 100))
 
  // 新增：背景遮罩模糊
  state.sandboxBgBlurPx.value = num(s.sandboxBgBlurPx, 0)
  setRootVar('--st-sandbox-bg-blur', state.sandboxBgBlurPx.value)

  // 新增：容器显示模式（不涉及 CSS 变量，纯持久化与消费者读取）
  state.sandboxDisplayModeSel.value = typeof s.sandboxDisplayModeSel === 'string'
    ? s.sandboxDisplayModeSel
    : 'auto'
}

// Initialize refs from current CSS variables and write-back to sync UI
function initFromCSS(state: AppearanceSandboxState): void {
  // 优先：从浏览器持久化（localStorage）恢复完整快照，避免刷新后重置
  try {
    const snap = loadSnapshotLS()
    if (snap && typeof snap === 'object') {
      applyState(state, snap) // 写入 refs + 同步 CSS 变量
      return
    }
  } catch (_) {}

  // 回退：从当前 CSS 变量读取默认值（首次进入或无持久化记录）
  const aspRaw = getComputedStyle(document.documentElement).getPropertyValue('--st-sandbox-aspect')?.trim()
  if (aspRaw && aspRaw.includes('/')) {
    const parts = aspRaw.split('/')
    if (parts[0] && parts[1]) {
      const ax = parseFloat(parts[0]); const ay = parseFloat(parts[1])
      if (Number.isFinite(ax) && Number.isFinite(ay) && ax > 0 && ay > 0) {
        state.sandboxAspectX.value = Math.round(ax)
        state.sandboxAspectY.value = Math.round(ay)
      }
    }
  }
  state.sandboxMaxWidth.value = readCssVarFloat('--st-sandbox-max-width', 1100)
  state.sandboxPadding.value = readCssVarFloat('--st-sandbox-padding', 16)
  state.sandboxRadius.value = readCssVarFloat('--st-sandbox-radius', 18)
  state.sandboxBgOpacityPct.value = Math.round(readCssVarFloat('--st-sandbox-bg-opacity', 0.12) * 100)
  state.sandboxStageBgOpacityPct.value = Math.round(readCssVarFloat('--st-sandbox-stage-bg-opacity', 0.82) * 100)
  state.sandboxBgBlurPx.value = readCssVarFloat('--st-sandbox-bg-blur', 0)

  // 写回 CSS 变量，保持 UI 与变量同步
  setRootVarUnitless('--st-sandbox-aspect', `${state.sandboxAspectX.value} / ${state.sandboxAspectY.value}`)
  setRootVar('--st-sandbox-max-width', state.sandboxMaxWidth.value)
  setRootVar('--st-sandbox-padding', state.sandboxPadding.value)
  setRootVar('--st-sandbox-radius', state.sandboxRadius.value)
  setRootVarUnitless('--st-sandbox-bg-opacity', String(state.sandboxBgOpacityPct.value / 100))
  setRootVarUnitless('--st-sandbox-stage-bg-opacity', String(state.sandboxStageBgOpacityPct.value / 100))
  setRootVar('--st-sandbox-bg-blur', state.sandboxBgBlurPx.value)

  // 将当前状态持久化一次，保证后续刷新仍能恢复
  try { saveSnapshotLS(buildSnapshot(state)) } catch (_) {}
}

// Auto save timer + broadcast
function startAutoSave(state: AppearanceSandboxState, { intervalMs = 1000 }: { intervalMs?: number } = {}): () => void {
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
export default function useAppearanceSandbox() {
  const state = createState()
  return {
    state,
    // lifecycle helpers
    initFromCSS: (): void => initFromCSS(state),
    applyState: (snap: Partial<AppearanceSandboxSnapshot> | null | undefined): void => applyState(state, snap),
    buildSnapshot: (): AppearanceSandboxSnapshot => buildSnapshot(state),
    saveSnapshotLS: (snap: AppearanceSandboxSnapshot): boolean => saveSnapshotLS(snap),
    loadSnapshotLS,
    startAutoSave: (opts?: { intervalMs?: number }): (() => void) => startAutoSave(state, opts),
    stopAutoSave,
    // low-level helpers
    setRootVar,
    setRootVarUnitless,
    readCssVarFloat,
  }
}