/**
 * 轻量 API 客户端
 * - 遵循 DEVELOPMENT_NOTES：默认走 http://localhost:8050 + /api
 * - 仅实现 workflow POST 能力：/api/workflow/{path}
 * - 现在支持从项目根的 modularflow_config.py 读取端口（FRONTEND_PORT/BACKEND_PORT/WEBSOCKET_PORT）
 */
const DEFAULT_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE || 'http://localhost:8050'
const DEFAULT_API_PREFIX = '/api'

type APIConfig = {
  baseURL: string
  apiPrefix: string
}

const cfg: APIConfig = {
  baseURL: DEFAULT_BASE_URL,
  apiPrefix: DEFAULT_API_PREFIX,
}

let inited = false
let initPromise: Promise<void> | null = null

type PortTriplet = { backend: number | null; frontend: number | null; websocket: number | null }

/**
 * 尝试读取并解析 /modularflow_config.py 中的端口常量
 * - 该文件位于项目根（Vite dev 和静态部署时可直接以根路径访问）
 * - 仅做轻量解析：BACKEND_PORT/FRONTEND_PORT/WEBSOCKET_PORT = 整数
 */
async function readPortsFromPythonConfig(): Promise<PortTriplet | null> {
  try {
    // 使用 sessionStorage 做一次性缓存，避免每次刷新重复解析
    const cacheKey = '__mf_ports_PE__'
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      try {
        return JSON.parse(cached) as PortTriplet
      } catch {}
    }

    const res = await fetch('/modularflow_config.py', { cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()

    // 解析简单的常量赋值（忽略注释与空白）
    const getNum = (name: string): number | null => {
      const re = new RegExp(String.raw`(^|\n)\s*${name}\s*=\s*([0-9]+)\s*(#.*)?$`, 'm')
      const m = text.match(re)
      if (!m) return null
      const n = Number(m[2])
      return Number.isFinite(n) ? n : null
    }

    const backend = getNum('BACKEND_PORT')
    const frontend = getNum('FRONTEND_PORT')
    const websocket = getNum('WEBSOCKET_PORT')

    const payload: PortTriplet = { backend, frontend, websocket }
    sessionStorage.setItem(cacheKey, JSON.stringify(payload))
    return payload
  } catch {
    return null
  }
}

/**
 * 根据 modularflow_config.py（若可用）配置 API baseURL
 * - 优先使用 BACKEND_PORT，fallback 到默认 8050
 * - host 采用当前 location.hostname，protocol 优先使用 http(s)
 */
function preferPreconfiguredBase(): string | null {
  try {
    const ls = (typeof window !== 'undefined') ? localStorage.getItem('st.backend_base') : null
    const win = (typeof window !== 'undefined') ? (window as any).ST_BACKEND_BASE : null
    const env = (import.meta as any)?.env?.VITE_API_BASE || null
    const b = (ls || win || env) as string | null
    return b ? String(b).replace(/\/+$/, '') : null
  } catch {
    return null
  }
}

function applyPorts(ports: PortTriplet | null): void {
  const pre = preferPreconfiguredBase()
  if (pre) {
    cfg.baseURL = pre
    cfg.apiPrefix = DEFAULT_API_PREFIX
    return
  }
  const port = ports?.backend ?? 8050
  let protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:'
  if (!/^https?:/.test(protocol)) protocol = 'http:'
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost'
  cfg.baseURL = `${protocol}//${host}:${port}`
  cfg.apiPrefix = DEFAULT_API_PREFIX
}

/**
 * 初始化：尝试读取 modularflow_config.py 中端口；失败则使用默认
 */
export async function ensureApiClientReady(): Promise<void> {
  if (inited) return
  if (!initPromise) {
    initPromise = (async () => {
      const ports = await readPortsFromPythonConfig()
      applyPorts(ports)
      inited = true
    })()
  }
  return initPromise
}

export function getApiConfig(): Readonly<APIConfig> {
  return { ...cfg }
}

async function request(path: string, init: RequestInit): Promise<any> {
  await ensureApiClientReady()
  const url =
    cfg.baseURL.replace(/\/+$/, '') +
    cfg.apiPrefix +
    (path.startsWith('/') ? path : '/' + path)

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`)
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    return res.json()
  }
  return res.text()
}

/**
 * POST /api/workflow/{path}
 */
export async function postWorkflow(path: string, body: any): Promise<any> {
  const safePath = path.replace(/^\/+/, '')
  return request('/workflow/' + safePath, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
}