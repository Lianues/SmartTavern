// SmartTavern Workflow - Runtime Plugin Loader (JS)
// 目标：统一用 JS 动态加载第三方工作流/插件脚本，支持白名单校验与生命周期回收。
// 协议：插件应默认导出 activate(host) 函数，可返回可选的 dispose() 清理函数。
// 说明：仅向插件传递 Host 的稳定 JS API（事件总线、注册表等），隐藏内部实现细节（Pinia 等）。
//
// 示例插件（public/workflows/demo-home.js）
// export default function activate(host) {
//   const offDemo = host.events.on('ui.home.demo', (p) => {
//     host.pushToast({ type: 'success', message: 'Demo clicked!' })
//   })
//   const disposeBtn = host.registerHomeButton({
//     id: 'home.demo',
//     label: 'Demo Action',
//     icon: 'circle',
//     order: 50,
//     actionId: 'ui.home.demo',
//     params: { foo: 1 },
//   })
//   return () => { disposeBtn(); offDemo() }
// }

import Host from './core/host.js'
import DataCatalog from '@/services/dataCatalog.js'

let __seq = 1

/**
 * 简单路径白名单（默认仅允许同源 + /public/workflows/ 与 /workflows/ 前缀）
 * 可通过 loader.init({ whitelist: [...] }) 覆盖
 * - 'same-origin'：只允许同源
 * - 以 'http' 开头：作为前缀匹配完整 URL
 * - 以 '/' 开头：匹配同源下的 pathname 前缀
 */
let __whitelist = ['same-origin', 'blob:', 'data:', '/public/workflows/', '/workflows/', '/src/workflow/workflows/']

/** 内部插件注册表：id -> { id, url, dispose?:Function, mod?:any } */
const __plugins = new Map()
/** Map: plugin id -> Set of blob URLs to revoke on unload */
const __blobsById = new Map()

/** 校验 URL 是否在白名单内 */
function isAllowed(url) {
  try {
    const u = new URL(url, window.location.href)
    const href = u.href
    const isSameOrigin = u.origin === window.location.origin
    const proto = u.protocol // e.g. 'http:', 'https:', 'blob:', 'data:'

    // 允许应用生成的 blob:/data: 资源，视为同源受信
    if (proto === 'blob:' || proto === 'data:') return true

    return __whitelist.some((w) => {
      if (w === 'same-origin') return isSameOrigin
      if (w === 'blob:') return proto === 'blob:'
      if (w === 'data:') return proto === 'data:'
      if (typeof w === 'string' && w.startsWith('http')) return href.startsWith(w)
      if (typeof w === 'string' && w.startsWith('/')) return isSameOrigin && u.pathname.startsWith(w)
      return false
    })
  } catch (e) {
    console.warn('[loader] invalid url:', url, e)
    return false
  }
}

/**
 * 初始化 Loader（可选）
 * @param {{ whitelist?: string[] }} opts
 */
function init(opts = {}) {
  if (Array.isArray(opts.whitelist) && opts.whitelist.length > 0) {
    __whitelist = opts.whitelist.slice()
  }
  return api
}

/**
 * 动态加载插件
 * @param {string} url 插件 JS 模块地址（可相对 / 绝对）
 * @param {{ id?:string, replace?:boolean }} options
 * @returns {Promise<{ id:string, url:string }>}
 */
async function load(url, options = {}) {
  if (!url || typeof url !== 'string') throw new Error('[loader.load] url required')
  if (!isAllowed(url)) throw new Error(`[loader.load] URL not allowed by whitelist: ${url}`)

  const id = String(options.id || `wf_${__seq++}`)

  if (__plugins.has(id) && options.replace !== true) {
    throw new Error(`[loader.load] plugin id already exists: ${id}`)
  }
  if (__plugins.has(id) && options.replace === true) {
    await unload(id)
  }

  // 规范化为绝对 URL，避免 Vite 将 /public 资产当作源代码导入
  const absUrl = new URL(url, window.location.origin).href

  // 使用原生 ESM 动态加载（@vite-ignore 避免开发期转换/校验）
  const mod = await import(/* @vite-ignore */ absUrl)
  // 兼容三种导出形式：
  // 1) export function activate(host) {}
  // 2) export default function activate(host) {}
  // 3) export default { activate(host) {} }
  let activate = null
  if (typeof mod?.activate === 'function') {
    activate = mod.activate
  } else if (typeof mod?.default === 'function') {
    activate = mod.default
  } else if (mod?.default && typeof mod.default.activate === 'function') {
    activate = mod.default.activate
  }
  if (typeof activate !== 'function') {
    throw new Error('[loader.load] module must export an activate(host) function (default or named)')
  }

  let dispose = null
  try {
    const maybe = await Promise.resolve(activate(Host))
    if (typeof maybe === 'function') dispose = maybe
  } catch (e) {
    console.error('[loader.load] activate failed:', e)
    throw e
  }

  __plugins.set(id, { id, url, dispose, mod })
  return { id, url }
}

/**
 * 卸载插件：调用其 dispose 并从注册表移除
 * @param {string} id
 * @returns {Promise<boolean>} 是否存在并成功卸载
 */
async function unload(id) {
  const rec = __plugins.get(id)
  const blobs = __blobsById.get(id)
  if (!rec && !blobs) return false
  try {
    if (rec) {
      await Promise.resolve(rec.dispose?.())
    }
  } catch (e) {
    console.warn('[loader.unload] dispose error:', e)
  } finally {
    if (rec) __plugins.delete(id)
    if (blobs && blobs.size) {
      try {
        for (const u of blobs) {
          try { URL.revokeObjectURL(u) } catch (_) {}
        }
      } finally {
        __blobsById.delete(id)
      }
    }
  }
  return true
}

/** 卸载所有已加载插件 */
async function unloadAll() {
  const ids = Array.from(__plugins.keys())
  for (const id of ids) {
    await unload(id)
  }
  return true
}

/** 列出已加载插件的简要信息 */
function list() {
  return Array.from(__plugins.values()).map(({ id, url }) => ({ id, url }))
}

/** 判断插件是否已加载 */
function has(id) {
  return __plugins.has(id)
}

/**
 * POSIX helpers for path resolution (work with repo-like paths)
 */
function __toPosix(p) { return String(p || '').replace(/\\\\/g, '/'); }
function __dirname(p) {
  const s = __toPosix(p)
  const i = s.lastIndexOf('/')
  return i >= 0 ? s.slice(0, i) : ''
}
function __resolveRelative(basePath, spec) {
  const baseDir = __dirname(basePath)
  const raw = __toPosix(baseDir ? (baseDir + '/' + spec) : spec)
  const parts = raw.split('/')
  const stack = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (stack.length) stack.pop()
      continue
    }
    stack.push(part)
  }
  return stack.join('/')
}
function __isRelative(spec) {
  return typeof spec === 'string' && (spec.startsWith('./') || spec.startsWith('../'))
}

/**
 * 从后端插件文件加载插件，支持“同包内相对 import”
 * - entryFile: backend_projects/SmartTavern/plugins/.../entry.js
 * - options: { id?:string, replace?:boolean }
 */
async function loadBackendWorkflow(entryFile, options = {}) {
  if (!entryFile || typeof entryFile !== 'string') throw new Error('[loader.loadBackendWorkflow] entryFile required')
  const id = String(options.id || `wf_${__seq++}`)

  if (__plugins.has(id) && options.replace !== true) {
    throw new Error(`[loader.loadBackendWorkflow] plugin id already exists: ${id}`)
  }
  if (__plugins.has(id) && options.replace === true) {
    await unload(id)
  }

  const entryPath = __toPosix(entryFile)
  const pluginRoot = __dirname(entryPath) // 限制相对导入不得越过入口所在目录
  const visited = new Map()   // path -> blobUrl
  const blobSet = new Set()   // 待释放的 blob 列表

  // 简单 import 语句匹配（静态/动态）
  const RE_STATIC = /(?:import|export)\s+(?:[^'"]*?\sfrom\s*)?['"]([^'"]+)['"]/g
  const RE_DYNAMIC = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g

  // 资产/扩展工具
  function __extOf(p) {
    const s = __toPosix(p).toLowerCase()
    const i = s.lastIndexOf('.')
    return i >= 0 ? s.slice(i + 1) : ''
  }
  function __isJsExt(ext) {
    return ext === 'js' || ext === 'mjs' || ext === 'cjs'
  }
  function __escapeRegex(s) {
    return String(s || '').replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')
  }

  // 将后端资产转为两个 Blob：
  // 1) 真实资源 Blob（type=mime） -> object URL (resUrl)
  // 2) JS 模块 Blob，内容为 `export default 'resUrl'` -> module URL (modUrl)
  async function createAssetModule(assetPath) {
    const detail = await DataCatalog.getPluginsAsset(assetPath)
    if (!detail || !detail.content_base64) {
      throw new Error(`[loader.loadBackendWorkflow] unable to fetch asset: ${assetPath}`)
    }
    // base64 -> Uint8Array
    const b64 = detail.content_base64
    let bytes
    if (typeof atob === 'function') {
      const bin = atob(b64); const len = bin.length; const out = new Uint8Array(len)
      for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i)
      bytes = out
    } else {
      // Node-like fallback
      bytes = Uint8Array.from(Buffer.from(b64, 'base64'))
    }
    const mime = String(detail.mime || 'application/octet-stream')
    const resBlob = new Blob([bytes], { type: mime })
    const resUrl = URL.createObjectURL(resBlob)
    blobSet.add(resUrl)

    const modCode = `export default '${resUrl}';\n`
    const modBlob = new Blob([modCode], { type: 'application/javascript' })
    const modUrl = URL.createObjectURL(modBlob)
    blobSet.add(modUrl)
    return modUrl
  }
  
  async function processFile(filePath) {
    const key = __toPosix(filePath)
    if (visited.has(key)) return visited.get(key)

    // 非 JS 扩展名：按“资产模块”处理（支持 .png/.jpg/.svg/.json 等）
    const ext = __extOf(key)
    if (!__isJsExt(ext)) {
      const modUrl = await createAssetModule(key)
      visited.set(key, modUrl)
      return modUrl
    }
  
    // 读取后端 JS 源码（通过插件资产接口）
    const asset = await DataCatalog.getPluginsAsset(key)
    const b64 = asset?.content_base64
    if (!b64) {
      throw new Error(`[loader.loadBackendWorkflow] unable to fetch: ${key}`)
    }
    let bytes
    if (typeof atob === 'function') {
      const bin = atob(b64); const len = bin.length; const out = new Uint8Array(len)
      for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i)
      bytes = out
    } else {
      // Node-like fallback
      bytes = Uint8Array.from(Buffer.from(b64, 'base64'))
    }
    const src = new TextDecoder('utf-8').decode(bytes)
    if (typeof src !== 'string' || !src.length) {
      throw new Error(`[loader.loadBackendWorkflow] unable to fetch: ${key}`)
    }
  
    async function transform(code, currentPath) {
      // 替换静态 import/export
      let out = code
      const staticRepls = []
      for (const m of code.matchAll(RE_STATIC)) {
        const spec = m[1]
        if (__isRelative(spec)) {
          const resolved = __resolveRelative(currentPath, spec)
          // 安全检查：禁止越过插件根目录
          if (pluginRoot && !(resolved === pluginRoot || resolved.startsWith(pluginRoot + '/'))) {
            throw new Error(`[loader.loadBackendWorkflow] relative import escapes plugin root: ${spec} in ${currentPath}`)
          }
          const depUrl = await processFile(resolved)
          staticRepls.push({ from: spec, to: depUrl })
        }
      }
      for (const { from, to } of staticRepls) {
        // 精准替换当前 spec（保持引号形式）
        out = out.replace(new RegExp(`(['"])${__escapeRegex(from)}\\1`, 'g'), `'${to}'`)
      }
  
      // 替换动态 import('...')
      const dynRepls = []
      for (const m of code.matchAll(RE_DYNAMIC)) {
        const spec = m[1]
        if (__isRelative(spec)) {
          const resolved = __resolveRelative(currentPath, spec)
          if (pluginRoot && !(resolved === pluginRoot || resolved.startsWith(pluginRoot + '/'))) {
            throw new Error(`[loader.loadBackendWorkflow] dynamic import escapes plugin root: ${spec} in ${currentPath}`)
          }
          const depUrl = await processFile(resolved)
          dynRepls.push({ from: spec, to: depUrl })
        }
      }
      for (const { from, to } of dynRepls) {
        out = out.replace(new RegExp(`(import\\s*\\(\\s*['"])${__escapeRegex(from)}(['"]\\s*\\))`, 'g'), `$1${to}$2`)
      }
  
      return out
    }
  
    const transformed = await transform(src, key)
    const blob = new Blob([transformed], { type: 'application/javascript' })
    const blobUrl = URL.createObjectURL(blob)
    visited.set(key, blobUrl)
    blobSet.add(blobUrl)
    return blobUrl
  }
  
  const entryBlobUrl = await processFile(entryPath)

  // 走统一 load（会调用 activate(host)）
  const result = await load(entryBlobUrl, { id, replace: true })
  // 记录需要在卸载时释放的 blob
  __blobsById.set(id, blobSet)

  return { id: result.id, url: entryBlobUrl }
}

async function loadPluginByDir(dir, options = {}) {
  if (!dir) throw new Error('[loader.loadPluginByDir] dir required')
  const id = String(options.id || `plg_${__seq++}`)
  if (__plugins.has(id) && options.replace !== true) {
    throw new Error(`[loader.loadPluginByDir] plugin id already exists: ${id}`)
  }
  if (__plugins.has(id) && options.replace === true) {
    await unload(id)
  }
  const pluginRoot = String(dir).replace(/\\/g, '/')
  const manifestPath = `${pluginRoot}/manifest.json`
  const asset = await DataCatalog.getPluginsAsset(manifestPath)
  const b64 = asset?.content_base64
  if (!b64) throw new Error(`[loader.loadPluginByDir] no manifest: ${manifestPath}`)
  // base64 decode to text
  let txt
  if (typeof atob === 'function') {
    const bin = atob(b64); const len = bin.length; const out = new Uint8Array(len)
    for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i)
    txt = new TextDecoder('utf-8').decode(out)
  } else {
    txt = Buffer.from(b64, 'base64').toString('utf-8')
  }
  let json
  try { json = JSON.parse(txt) } catch (e) { throw new Error(`[loader.loadPluginByDir] manifest parse failed: ${e?.message || e}`) }
  const main = typeof json?.main === 'string' ? json.main : null
  const entryFromList = Array.isArray(json?.entries) && json.entries.length ? String(json.entries[0]) : null
  const entry = main || entryFromList || 'index.js'
  const entryPath = `${pluginRoot}/${entry}`
  return loadBackendWorkflow(entryPath, { id, replace: true })
}

const api = {
  init,
  load,
  unload,
  unloadAll,
  list,
  has,
  loadBackendWorkflow,
  loadPluginByDir,
}

export const PluginLoader = api
export default PluginLoader