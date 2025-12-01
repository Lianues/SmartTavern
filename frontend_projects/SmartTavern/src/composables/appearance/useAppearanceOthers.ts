// SmartTavern Composable: useAppearanceOthers
// 目标：管理"其他"外观设置，主要用于控制浮标吸附边距
// 使用方式：
//   import useAppearanceOthers from '@/composables/appearance/useAppearanceOthers'
//   const {
//     state, // 所有涉及的 ref
//     initFromCSS, applyState, buildSnapshot,
//     saveSnapshotLS, loadSnapshotLS,
//     startAutoSave, stopAutoSave,
//     setRootVar, readCssVar
//   } = useAppearanceOthers()

import { ref, type Ref } from 'vue'
import ThemeManager from '@/features/themes/manager'
import { useAppearanceSettingsStore, type DateTimeFormatOption } from '@/stores/appearanceSettings'
import { storeToRefs } from 'pinia'

// LocalStorage key (others tab-scoped)
const STORE_KEY = 'st.appearance.others'

// Re-export type for backward compatibility
export type { DateTimeFormatOption }

// Interfaces
interface AppearanceOthersState {
  fabMargin: Ref<number>  // 浮标吸附边距（本地状态）
  timezone: Ref<string>   // 时区设置（来自 Pinia store，全局共享）
  dateTimeFormat: Ref<DateTimeFormatOption>  // 日期时间显示格式（来自 Pinia store，全局共享）
}

interface AppearanceOthersSnapshot {
  fabMargin: number
  timezone: string
  dateTimeFormat: DateTimeFormatOption
}

// CSS helpers
function readCssVar(name: string, fallback: number): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name)?.trim()
  if (!v) return fallback
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

function setRootVar(name: string, value: number | string): void {
  document.documentElement.style.setProperty(name, typeof value === 'number' ? value + 'px' : String(value))
}

// LS helpers
function saveSnapshotLS(snapshot: AppearanceOthersSnapshot): boolean {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(snapshot))
    return true
  } catch (_) {
    return false
  }
}

function loadSnapshotLS(): AppearanceOthersSnapshot | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AppearanceOthersSnapshot
  } catch (_) {
    return null
  }
}

// State factory
function createState(): AppearanceOthersState {
  // 获取 Pinia store
  const appearanceStore = useAppearanceSettingsStore()
  const { timezone, dateTimeFormat } = storeToRefs(appearanceStore)
  
  // 浮标吸附边距（仅本地状态，不需要全局共享）
  const fabMargin = ref(12)

  return {
    fabMargin,
    timezone,        // 来自 Pinia store，响应式共享
    dateTimeFormat,  // 来自 Pinia store，响应式共享
  }
}

// Build snapshot from state refs
function buildSnapshot(state: AppearanceOthersState): AppearanceOthersSnapshot {
  return {
    fabMargin: Number(state.fabMargin.value),
    timezone: String(state.timezone.value),
    dateTimeFormat: state.dateTimeFormat.value,
  }
}

// Apply state from snapshot into refs + write CSS variables
function applyState(state: AppearanceOthersState, s: Partial<AppearanceOthersSnapshot> | null | undefined): void {
  if (!s || typeof s !== 'object') return
  const num = (v: any, f: number): number => (typeof v === 'number' ? v : f)

  state.fabMargin.value = num(s.fabMargin, 12)
  setRootVar('--st-fab-margin', state.fabMargin.value)
  
  // 时区和日期时间格式通过 Pinia store 更新（自动同步到所有组件）
  const appearanceStore = useAppearanceSettingsStore()
  if (typeof s.timezone === 'string' && s.timezone) {
    appearanceStore.setTimezone(s.timezone)
  }
  if (typeof s.dateTimeFormat === 'string' && s.dateTimeFormat) {
    appearanceStore.setDateTimeFormat(s.dateTimeFormat as DateTimeFormatOption)
  }
}

// Initialize refs from current CSS variables and write-back to sync UI
function initFromCSS(state: AppearanceOthersState): void {
  // 优先：从浏览器持久化（localStorage）恢复完整快照
  try {
    const snap = loadSnapshotLS()
    if (snap && typeof snap === 'object') {
      applyState(state, snap) // 写入 refs + 同步 CSS 变量
      return
    }
  } catch (_) {}

  // 回退路径：读取现有 CSS 变量作为初始值
  state.fabMargin.value = readCssVar('--st-fab-margin', 12)

  // 写回 CSS 变量，保持 UI 与变量同步
  setRootVar('--st-fab-margin', state.fabMargin.value)
  
  // 时区和时间格式使用默认值（已在 createState 中设置）

  // 持久化一次，确保后续刷新可以完整恢复
  try { saveSnapshotLS(buildSnapshot(state)) } catch (_) {}
}

// Auto save timer
function startAutoSave(state: AppearanceOthersState, { intervalMs = 1000 }: { intervalMs?: number } = {}): () => void {
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
export default function useAppearanceOthers() {
  const state = createState()
  return {
    state,
    // lifecycle helpers
    initFromCSS: (): void => initFromCSS(state),
    applyState: (snap: Partial<AppearanceOthersSnapshot> | null | undefined): void => applyState(state, snap),
    buildSnapshot: (): AppearanceOthersSnapshot => buildSnapshot(state),
    saveSnapshotLS: (snap: AppearanceOthersSnapshot): boolean => saveSnapshotLS(snap),
    loadSnapshotLS,
    startAutoSave: (opts?: { intervalMs?: number }): (() => void) => startAutoSave(state, opts),
    stopAutoSave,
    // low-level helpers
    setRootVar,
    readCssVar,
  }
}