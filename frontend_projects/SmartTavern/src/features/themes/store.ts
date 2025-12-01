// SmartTavern Theme Runtime - Minimal Store (v1)
// Purpose:
// - Provide a lightweight runtime to apply external beautification themes at runtime
// - Allow importing a theme pack (JSON) with tokens and optional CSS
// - Persist selected theme pack in localStorage (browser-only, non-secure)
// - Reserve hooks for future sandboxed script execution (disabled by default)
// - Emit events so UI can react (e.g., re-apply AppearancePanel overrides)
//
// Notes:
// - Token policy: keys should be valid CSS custom properties (e.g. "--st-primary").
// - CSS injection: one <style id="st-theme-css"> node in <head>, replaced on each apply.
// - Persistence key: "st.themePack.v1"
// - Security: Scripts in theme packs are NOT executed by default.
// - Precedence: Theme tokens/stylesheet can be overridden by user AppearancePanel changes later.
//
// Usage:
//   import ThemeStore from '@/features/themes/store'
//   await ThemeStore.init()                 // load persisted theme (if any)
//   await ThemeStore.applyThemePack(pack)   // apply new theme pack (persisted by default)
//   ThemeStore.resetTheme()                 // clear theme, remove CSS, wipe persistence
//
// Events:
//   'change'           -> any state change (apply/reset/update)
//   'theme-applied'    -> after theme pack is applied
//   'theme-reset'      -> after theme pack is reset

import type { ThemePackV1, ThemeTokens, ThemeApplyOptions } from './pack'

const STORAGE_KEY = 'st.themePack.v1'
const STYLE_TAG_ID = 'st-theme-css'
const META_TAG_ID = 'st-theme-meta'
const VERSION = 'v1'

// Type definitions
export type ColorMode = 'system' | 'light' | 'dark'

export interface ThemeStoreState {
  version: string
  pack: ThemePackV1 | null
  styleId: string
  metaId: string
  currentMode: ColorMode
}

interface PersistedThemePack {
  version: string
  pack: ThemePackV1
}

type EventCallback = (payload?: any) => void

interface EventEmitter {
  on(event: string, cb: EventCallback): () => void
  off(event: string, cb: EventCallback): void
  emit(event: string, payload?: any): void
}

// Internal event emitter (simple)
function createEmitter(): EventEmitter {
  const all: Record<string, Set<EventCallback>> = Object.create(null)
  return {
    on(event: string, cb: EventCallback): () => void {
      if (!all[event]) all[event] = new Set()
      all[event].add(cb)
      return () => { all[event]?.delete(cb) }
    },
    off(event: string, cb: EventCallback): void {
      all[event]?.delete(cb)
    },
    emit(event: string, payload?: any): void {
      if (!all[event]) return
      for (const cb of all[event]) {
        try { cb(payload) } catch (e) { console.error('[ThemeStore] listener error:', e) }
      }
    },
  }
}

// DOM helpers
function ensureStyleTag(id: string = STYLE_TAG_ID): HTMLStyleElement {
  let el = document.getElementById(id) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = id
    el.type = 'text/css'
    document.head.appendChild(el)
  }
  return el
}

function removeElementById(id: string): void {
  const el = document.getElementById(id)
  if (el && el.parentNode) el.parentNode.removeChild(el)
}

function setMeta(name: string, content: string): void {
  let el = document.getElementById(META_TAG_ID)
  if (!el) {
    el = document.createElement('meta')
    el.id = META_TAG_ID
    el.setAttribute('data-scope', 'st-theme')
    document.head.appendChild(el)
  }
  el.setAttribute('name', name)
  el.setAttribute('content', content)
}

// Core store
const ThemeStore = (() => {
  const emitter = createEmitter()
  // In-memory state
  let state: ThemeStoreState = {
    version: VERSION,
    // current theme pack (null = none)
    pack: null,            // { id, name, version, tokens, css, tokensLight?, tokensDark?, cssLight?, cssDark?, script? }
    // bookkeeping for DOM cleanup
    styleId: STYLE_TAG_ID,
    metaId: META_TAG_ID,
    // color mode preference: 'system' | 'light' | 'dark'
    currentMode: 'system',
  }
  // media query listener for system mode
  let __mql: MediaQueryList | null = null

  function getVersion(): string { return state.version }

  function getState(): ThemeStoreState {
    return { ...state, pack: state.pack ? { ...state.pack } : null }
  }

  function getCurrentTheme(): ThemePackV1 | null {
    return state.pack ? { ...state.pack } : null
  }

  // Persistence
  function saveToStorage(): void {
    try {
      const payload: PersistedThemePack | null = state.pack ? {
        version: state.version,
        pack: {
          id: state.pack.id ?? null,
          name: state.pack.name ?? null,
          version: state.pack.version ?? null,
          tokens: state.pack.tokens ?? undefined,
          css: state.pack.css ?? undefined,
          // Persist per-mode overrides if present
          tokensLight: state.pack.tokensLight ?? undefined,
          tokensDark: state.pack.tokensDark ?? undefined,
          cssLight: state.pack.cssLight ?? undefined,
          cssDark: state.pack.cssDark ?? undefined,
          // DO NOT persist script by default for safety
        }
      } : null
      if (!payload) {
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      }
    } catch (e) {
      console.warn('[ThemeStore] Failed to save theme to localStorage:', e)
    }
  }

  function loadFromStorage(): ThemePackV1 | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const obj = JSON.parse(raw) as PersistedThemePack
      if (!obj || typeof obj !== 'object' || !obj.pack) return null
      return obj.pack
    } catch (e) {
      console.warn('[ThemeStore] Failed to load theme from localStorage:', e)
      return null
    }
  }

  // Token application
  function applyTokens(tokens: ThemeTokens | undefined): void {
    if (!tokens || typeof tokens !== 'object') return
    const root = document.documentElement
    for (const [key, value] of Object.entries(tokens)) {
      // Expect full custom property name, e.g. "--st-primary"
      if (!key.startsWith('--')) continue
      try {
        root.style.setProperty(key, String(value))
      } catch (e) {
        console.warn('[ThemeStore] Failed to set token', key, e)
      }
    }
  }

  // Token removal - clear tokens from documentElement
  function clearTokens(tokens: ThemeTokens | undefined): void {
    if (!tokens || typeof tokens !== 'object') return
    const root = document.documentElement
    for (const key of Object.keys(tokens)) {
      if (!key.startsWith('--')) continue
      try {
        root.style.removeProperty(key)
      } catch (e) {
        console.warn('[ThemeStore] Failed to remove token', key, e)
      }
    }
  }

  // CSS injection
  function injectCSS(cssText: string): void {
    if (!cssText) return
    const style = ensureStyleTag(state.styleId)
    style.textContent = String(cssText)
  }

  function clearCSS(): void {
    removeElementById(state.styleId)
  }

  // Resolve system mode via prefers-color-scheme
  function resolveSystemMode(): ColorMode {
    try {
      const mql = window.matchMedia?.('(prefers-color-scheme: dark)')
      return mql?.matches ? 'dark' : 'light'
    } catch (_) {
      return 'light'
    }
  }

  function clearMql(): void {
    if (__mql) {
      try { __mql.removeEventListener('change', onSystemSchemeChange) } catch (_) {}
      __mql = null
    }
  }

  function onSystemSchemeChange(): void {
    // Re-apply tokens/CSS according to new system scheme
    reapplyForCurrentMode()
  }

  function ensureMql(): void {
    try {
      __mql = window.matchMedia?.('(prefers-color-scheme: dark)') || null
      if (__mql) {
        __mql.addEventListener('change', onSystemSchemeChange)
      }
    } catch (_) {
      __mql = null
    }
  }

  // Apply base + mode-specific tokens and CSS
  function reapplyForCurrentMode(): void {
    const pack = state.pack || {}
    const modePref = state.currentMode || 'system'
    const effMode: ColorMode = modePref === 'system' ? resolveSystemMode() : modePref

    // 1) Apply base tokens
    if (pack.tokens) applyTokens(pack.tokens)

    // 2) Apply mode-specific tokens (if provided by pack)
    const modeTokens = effMode === 'dark' ? (pack.tokensDark || null) : (pack.tokensLight || null)
    if (modeTokens) applyTokens(modeTokens)

    // 3) Inject CSS: base + mode-specific CSS appended
    const cssCombined =
      (pack.css ? String(pack.css) + '\n' : '') +
      (effMode === 'dark'
        ? (pack.cssDark ? String(pack.cssDark) : '')
        : (pack.cssLight ? String(pack.cssLight) : ''))
    if (cssCombined.trim()) injectCSS(cssCombined)
    else clearCSS()

    // manage system watcher
    clearMql()
    if (state.currentMode === 'system') ensureMql()
  }

  // Public: set color mode preference
  function setColorMode(mode: ColorMode = 'system'): void {
    const next: ColorMode = (mode === 'dark' || mode === 'light') ? mode : 'system'
    if (state.currentMode === next) {
      // still ensure system listener if needed
      if (next === 'system' && !__mql) ensureMql()
      return
    }
    state.currentMode = next
    reapplyForCurrentMode()
    emitter.emit('change', getState())
  }

  // Public API

  async function init(): Promise<ThemeStoreState> {
    // Load persisted theme and apply it
    const saved = loadFromStorage()
    if (saved) {
      await applyThemePack(saved, { persist: false }) // already persisted
    }
    emitter.emit('change', getState())
    return getState()
  }

  // Pack format is permissive: accepts missing fields
  // options:
  //  - persist: boolean = true
  //  - allowScript: boolean = false (reserved; not executed by default)
  async function applyThemePack(pack: ThemePackV1, options: ThemeApplyOptions = {}): Promise<ThemePackV1 | null> {
    const { persist = true, allowScript = false } = options
    const nextPack: ThemePackV1 = { ...pack }

    // Store first so reapplyForCurrentMode can read pack and decide light/dark overrides
    state.pack = nextPack

    // Apply tokens/CSS according to current color mode (base + mode-specific overrides)
    reapplyForCurrentMode()

    // Reserved: script execution (disabled)
    if (nextPack.script && allowScript) {
      console.warn('[ThemeStore] Script execution is disabled by default. Ignored for safety.')
    }

    // Update meta (debug info)
    setMeta('st-theme-id', String(nextPack.id ?? ''))
    setMeta('st-theme-name', String(nextPack.name ?? ''))
    setMeta('st-theme-version', String(nextPack.version ?? ''))

    if (persist) saveToStorage()

    emitter.emit('theme-applied', getCurrentTheme())
    emitter.emit('change', getState())
    return getCurrentTheme()
  }

  async function resetTheme(options: { persist?: boolean } = {}): Promise<void> {
    const { persist = true } = options

    // Clear tokens that were applied by the theme pack
    if (state.pack) {
      clearTokens(state.pack.tokens)
      clearTokens(state.pack.tokensLight)
      clearTokens(state.pack.tokensDark)
    }
    
    clearCSS()
    clearMql()

    state.pack = null
    if (persist) saveToStorage()

    // Clear meta
    removeElementById(state.metaId)

    emitter.emit('theme-reset')
    emitter.emit('change', getState())
  }

  // Utility to update a single token dynamically (and remember into current pack if present)
  function setToken(name: string, value: string | number, options: { persist?: boolean } = {}): void {
    if (!name || !name.startsWith?.('--')) return
    applyTokens({ [name]: value })
    if (state.pack) {
      state.pack.tokens = state.pack.tokens || {}
      state.pack.tokens[name] = value
      if (options.persist !== false) saveToStorage()
      emitter.emit('change', getState())
    }
  }

  // Subscribe helper
  function on(event: string, cb: EventCallback): () => void { return emitter.on(event, cb) }
  function off(event: string, cb: EventCallback): void { return emitter.off(event, cb) }

  // Back-compat alias
  function subscribe(cb: EventCallback): () => void { return on('change', cb) }

  return {
    // lifecycle
    init,
    // apply/reset
    applyThemePack,
    resetTheme,
    // state
    getState,
    getCurrentTheme,
    getVersion,
    // tokens
    setToken,
    // color mode
    setColorMode,
    // events
    on, off, subscribe,
    // low-level helpers (exported for advanced usage)
    applyTokens,
    injectCSS,
    clearCSS,
    // constants
    STORAGE_KEY,
    STYLE_TAG_ID,
    META_TAG_ID,
    VERSION,
  }
})()

export default ThemeStore