// SmartTavern Theme Runtime - Sandbox Host (v1)
// Status: Skeleton only. Script execution is DISABLED by default in ThemeManager.
// Purpose:
// - Reserve a postMessage bridge for future safe, permissioned theme scripts.
// - Host runs in main app; client runs inside a sandboxed iframe (see client.js/index.html).
//
// Security principles:
// - No DOM mutation by default. Bridge must enforce an allowlist of methods.
// - No network by default. Add explicit permission gating if enabled in future.
// - Untrusted code must run in a separate origin-like context: sandboxed iframe with tight CSP.
// - This file is not wired by default. Integration is gated via ThemeManager allowScript=false.

const DEFAULT_TIMEOUT = 4000

// Type definitions
interface SandboxPermissions {
  dom?: boolean
  network?: boolean
}

interface SandboxOptions {
  clientOrigin?: string  // Expected origin of client messages. Use specific origin in production.
  timeoutMs?: number  // Request timeout for RPC-like calls.
  permissions?: SandboxPermissions  // Reserved permission gates
}

interface SandboxMessage {
  id: number
  type: string
  payload?: any
}

interface SandboxResponse {
  id?: number
  type: string
  payload?: any
  error?: string
}

interface PendingRequest {
  resolve: (value: any) => void
  reject: (reason?: any) => void
  timer: ReturnType<typeof setTimeout>
}

interface SandboxHost {
  post(type: string, payload?: any): Promise<any>
  ping(): Promise<any>
  isAllowed(action: string): boolean
  dispose(): void
  iframe: HTMLIFrameElement
  options: Required<SandboxOptions>
}

/**
 * Create a sandbox host bound to an iframe element.
 */
export function createSandboxHost(iframe: HTMLIFrameElement, options: SandboxOptions = {}): SandboxHost {
  if (!iframe || !(iframe instanceof HTMLIFrameElement)) {
    throw new Error('[SandboxHost] iframe element required')
  }
  
  const {
    clientOrigin = '*',
    timeoutMs = DEFAULT_TIMEOUT,
    permissions = { dom: false, network: false },
  } = options

  let seq = 0
  const pending = new Map<number, PendingRequest>()

  function post(type: string, payload: any = {}): Promise<any> {
    const id = ++seq
    const msg: SandboxMessage = { id, type, payload }
    try {
      iframe.contentWindow?.postMessage({ __stSandbox: msg }, '*')
    } catch (e) {
      console.warn('[SandboxHost] postMessage failed:', e)
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`Sandbox request timed out: ${type}`))
      }, timeoutMs)
      pending.set(id, { resolve, reject, timer })
    })
  }

  function onMessage(ev: MessageEvent): void {
    // Optionally verify origin: if (clientOrigin !== '*' && ev.origin !== clientOrigin) return
    const data = ev.data
    if (!data || !data.__stSandbox) return
    const { id, type, payload, error }: SandboxResponse = data.__stSandbox
    if (!id || !pending.has(id)) return
    const entry = pending.get(id)!
    clearTimeout(entry.timer)
    pending.delete(id)
    if (error) entry.reject(new Error(error))
    else entry.resolve({ type, payload })
  }

  window.addEventListener('message', onMessage)

  function dispose(): void {
    window.removeEventListener('message', onMessage)
    for (const [_id, entry] of pending) {
      clearTimeout(entry.timer)
      entry.reject(new Error('Sandbox disposed'))
    }
    pending.clear()
  }

  // Example reserved API: ping
  async function ping(): Promise<any> {
    const res = await post('ping', { t: Date.now() })
    return res.payload
  }

  // Reserved: Evaluate limited actions when explicitly allowed (not enabled by default)
  function isAllowed(action: string): boolean {
    // Minimal gate. Extend based on ThemePack.script.permissions in future.
    if (action === 'dom' && permissions.dom) return true
    if (action === 'network' && permissions.network) return true
    return false
  }

  return {
    post,
    ping,
    isAllowed,
    dispose,
    // Expose raw
    iframe,
    options: { clientOrigin, timeoutMs, permissions },
  }
}

export default { createSandboxHost }