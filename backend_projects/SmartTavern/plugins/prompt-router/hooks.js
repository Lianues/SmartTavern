// Prompt Router — Hooks Manager (后端插件挂载点统一管理)
// 目标：拆分路由器的策略集成，集中管理更细的侵入点位（Hook），并支持插件注册时提供权重（order）控制先后顺序。
// 用法：路由器主文件在各阶段调用 runHooks(hookName, data, ctx)；插件通过事件注册策略对象（包含各 Hook 的函数）。
//
// 支持的 Hook 列表（可按需扩展）
// - 生命周期/数据装配阶段：
//   * beforeNormalizeAssets(preset, world_books, character, regex_files)
//   * afterNormalizeAssets(preset, world_books, character, regex_files)
//   * beforeRaw(history)
//   * afterInsert(history)
//   * afterRaw(messages)
//   * beforePostprocess(messages, rules, variables)
//   * afterPostprocess(messages, rules, variables)
//   * beforeVariablesSave(finalVars)
//   * afterVariablesSave(finalVars)
//
// 策略对象结构（插件传入）:
// {
//   id?: string,            // 唯一标识（用于去重/注销）
//   order?: number,         // 权重（降序，越大越先执行；默认 0）
//   // 可选 Hook：按需提供，未提供的跳过
//   beforeNormalizeAssets?: (assets, ctx) => assets|{ ... }|null
//   afterNormalizeAssets?:  (assets, ctx) => assets|{ ... }|null
//   beforeRaw?:             (history, ctx) => history|{ history }|null
//   afterInsert?:           (history, ctx) => history|{ history }|null
//   afterRaw?:              (messages, ctx) => messages|{ messages }|null
//   beforePostprocess?:     (payload, ctx) => payload|{ messages, rules, variables }|null
//   afterPostprocess?:      (payload, ctx) => payload|{ messages, rules, variables }|null
//   beforeVariablesSave?:   (vars, ctx) => vars|{ finalVars }|null
//   afterVariablesSave?:    (vars, ctx) => vars|{ finalVars }|null
// }
//
// 返回数据规范：
// - beforeRaw/afterInsert: 返回 Array 或 { history: Array }
// - afterRaw: 返回 Array 或 { messages: Array }
// - before/afterNormalizeAssets: 返回对象 { preset, world_books, character, regex_files }（全部或部分字段）
// - before/afterPostprocess: 返回对象 { messages, rules, variables }（全部或部分字段）
// - before/afterVariablesSave: 返回对象 { finalVars } 或直接对象（将合并）
//
// 注意：runHooks 顺序执行；每个 Hook 中的策略按 order 降序执行；单策略报错不影响其他策略。

const HOOKS = [
  'beforeNormalizeAssets',
  'afterNormalizeAssets',
  'beforeRaw',
  'afterInsert',
  'afterRaw',
  'beforePostprocess',
  'afterPostprocess',
  'beforeVariablesSave',
  'afterVariablesSave',
]

/** @type {Record<string, Array<{ id?:string, order:number, seq:number, fn:Function }>>} */
const registry = Object.fromEntries(HOOKS.map(h => [h, []]))
let __seq = 1

function sanitizeOrder(o) {
  const n = Number(o)
  return Number.isFinite(n) ? n : 0
}

function sortHooks(hookName) {
  const arr = registry[hookName]
  if (!Array.isArray(arr)) return
  arr.sort((a, b) => {
    // 一级：order 降序（越大越先）
    const od = sanitizeOrder(b.order) - sanitizeOrder(a.order)
    if (od !== 0) return od
    // 二级：id 字母序（稳定）
    const ai = String(a.id || '').toLowerCase()
    const bi = String(b.id || '').toLowerCase()
    if (ai !== bi) return ai < bi ? -1 : 1
    // 三级：注册序列（先注册的先执行）
    return (a.seq || 0) - (b.seq || 0)
  })
}

function registerStrategy(strategy) {
  if (!strategy || typeof strategy !== 'object') return
  const sid = String(strategy.id || '').trim()

  for (const hookName of HOOKS) {
    const fn = strategy[hookName]
    if (typeof fn !== 'function') continue

    // 去重：按 id 移除旧策略
    if (sid) {
      const idx = registry[hookName].findIndex(x => String(x.id || '').trim() === sid)
      if (idx >= 0) registry[hookName].splice(idx, 1)
    }

    registry[hookName].push({
      id: sid || undefined,
      order: sanitizeOrder(strategy.order),
      seq: __seq++,
      fn,
    })
    sortHooks(hookName)
  }
}

function unregisterStrategy(id) {
  const sid = String(id || '').trim()
  if (!sid) return
  for (const hookName of HOOKS) {
    const arr = registry[hookName]
    if (!Array.isArray(arr) || arr.length === 0) continue
    for (let i = arr.length - 1; i >= 0; i--) {
      if (String(arr[i]?.id || '').trim() === sid) {
        arr.splice(i, 1)
      }
    }
  }
}

/**
 * 运行指定 Hook（串行，按权重降序）
 * @param {string} hookName
 * @param {any} data
 * @param {object} ctx  上下文：{ conversationFile, view, ... }
 * @returns {any} 新数据
 */
async function runHooks(hookName, data, ctx = {}) {
  const arr = registry[hookName]
  if (!Array.isArray(arr) || arr.length === 0) return data

  let current = cloneDataForHook(hookName, data)
  for (const { fn } of arr) {
    try {
      const out = await Promise.resolve(fn(cloneDataForHook(hookName, current), ctx))
      if (out != null) {
        current = mergeHookOutput(hookName, current, out)
      }
    } catch (e) {
      // 单策略异常忽略，继续执行后续策略
      console.warn(`[hooks.${hookName}] strategy error:`, e)
    }
  }
  return current
}

function cloneDataForHook(hookName, data) {
  switch (hookName) {
    case 'beforeRaw':
    case 'afterInsert':
      return Array.isArray(data) ? data.slice() : []
    case 'afterRaw':
      return Array.isArray(data) ? data.slice() : []
    case 'beforeNormalizeAssets':
    case 'afterNormalizeAssets': {
      const a = data || {}
      return {
        preset: deepClone(a.preset),
        world_books: deepClone(a.world_books),
        character: deepClone(a.character),
        regex_files: deepClone(a.regex_files),
      }
    }
    case 'beforePostprocess':
    case 'afterPostprocess': {
      const p = data || {}
      return {
        messages: Array.isArray(p.messages) ? p.messages.slice() : [],
        rules: deepClone(p.rules),
        variables: deepClone(p.variables),
      }
    }
    case 'beforeVariablesSave':
    case 'afterVariablesSave': {
      const v = data || {}
      const finalVars = v.finalVars || v
      return deepClone(finalVars)
    }
    default:
      return deepClone(data)
  }
}

function mergeHookOutput(hookName, current, out) {
  switch (hookName) {
    case 'beforeRaw':
    case 'afterInsert':
      if (Array.isArray(out)) return out
      if (out && Array.isArray(out.history)) return out.history
      return current
    case 'afterRaw':
      if (Array.isArray(out)) return out
      if (out && Array.isArray(out.messages)) return out.messages
      return current
    case 'beforeNormalizeAssets':
    case 'afterNormalizeAssets': {
      if (out && typeof out === 'object') {
        return {
          preset: out.preset != null ? out.preset : current.preset,
          world_books: out.world_books != null ? out.world_books : current.world_books,
          character: out.character != null ? out.character : current.character,
          regex_files: out.regex_files != null ? out.regex_files : current.regex_files,
        }
      }
      return current
    }
    case 'beforePostprocess':
    case 'afterPostprocess': {
      if (out && typeof out === 'object') {
        return {
          messages: Array.isArray(out.messages) ? out.messages : current.messages,
          rules: out.rules != null ? out.rules : current.rules,
          variables: out.variables != null ? out.variables : current.variables,
        }
      }
      return current
    }
    case 'beforeVariablesSave':
    case 'afterVariablesSave': {
      if (out && typeof out === 'object') {
        return Object.assign({}, current, out.finalVars || out)
      }
      return out != null ? out : current
    }
    default:
      return out != null ? out : current
  }
}

function deepClone(x) {
  try {
    return JSON.parse(JSON.stringify(x))
  } catch (_) {
    return x
  }
}

export const Hooks = {
  names: HOOKS.slice(),
  registerStrategy,
  unregisterStrategy,
  runHooks,
}

export default Hooks