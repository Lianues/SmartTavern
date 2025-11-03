// SmartTavern - 对话变量管理 (Pinia Store TypeScript)
// 目标：提供便捷的变量访问API，支持路径解析

import { ref } from 'vue'
import { defineStore } from 'pinia'
import ChatBranches from '@/services/chatBranches'
import { useMessagesStore } from '@/stores/chatMessages'
import Host from '@/workflow/core/host'

// ========== 类型定义 ==========

/**
 * 变量对象类型
 */
export type Variables = Record<string, any>

/**
 * ChatBranches.variables API 响应接口
 */
interface VariablesResponse {
  variables: Variables
  [key: string]: any
}

// ========== 路径解析工具 ==========

/**
 * 解析变量路径，支持三种格式：
 * 1. 点表示法: "user.name" 
 * 2. 方括号表示法: "user['name']" 或 "['user']['name']"
 * 3. 数组索引: "items[0].id"
 * 
 * @param obj - 要查询的对象
 * @param path - 路径字符串
 * @returns 路径对应的值，不存在则返回 undefined
 */
function getValueByPath(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined
  if (!path || typeof path !== 'string') return undefined

  // 将路径转换为数组键
  // 支持: a.b.c, a['b'].c, a[0].b, ['a']['b']
  const keys: (string | number)[] = []
  let current = ''
  let inBracket = false
  let inQuote = false
  let quoteChar = ''

  for (let i = 0; i < path.length; i++) {
    const char = path[i]

    if (inQuote) {
      if (char === quoteChar && path[i - 1] !== '\\') {
        inQuote = false
        quoteChar = ''
      } else {
        current += char
      }
    } else if (char === '"' || char === "'") {
      inQuote = true
      quoteChar = char
    } else if (char === '[') {
      if (current) {
        keys.push(current)
        current = ''
      }
      inBracket = true
    } else if (char === ']') {
      if (current) {
        // 尝试转换为数字（数组索引）
        const num = parseInt(current, 10)
        keys.push(isNaN(num) ? current : num)
        current = ''
      }
      inBracket = false
    } else if (char === '.' && !inBracket) {
      if (current) {
        keys.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }

  if (current) {
    keys.push(current)
  }

  // 按键逐层访问
  let value: any = obj
  for (const key of keys) {
    if (value === null || value === undefined) return undefined
    if (typeof value !== 'object') return undefined
    value = value[key]
  }

  return value
}

/**
 * 设置值到指定路径
 * @param obj - 要修改的对象
 * @param path - 路径字符串
 * @param value - 要设置的值
 */
function setValueByPath(obj: any, path: string, value: any): void {
  if (!obj || typeof obj !== 'object') return
  if (!path || typeof path !== 'string') return

  const keys: (string | number)[] = []
  let current = ''
  let inBracket = false
  let inQuote = false
  let quoteChar = ''

  // 解析路径为键数组
  for (let i = 0; i < path.length; i++) {
    const char = path[i]

    if (inQuote) {
      if (char === quoteChar && path[i - 1] !== '\\') {
        inQuote = false
        quoteChar = ''
      } else {
        current += char
      }
    } else if (char === '"' || char === "'") {
      inQuote = true
      quoteChar = char
    } else if (char === '[') {
      if (current) {
        keys.push(current)
        current = ''
      }
      inBracket = true
    } else if (char === ']') {
      if (current) {
        const num = parseInt(current, 10)
        keys.push(isNaN(num) ? current : num)
        current = ''
      }
      inBracket = false
    } else if (char === '.' && !inBracket) {
      if (current) {
        keys.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }

  if (current) {
    keys.push(current)
  }

  // 逐层访问/创建对象
  let target: any = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (key === undefined) continue
    if (!(key in target) || typeof target[key] !== 'object' || target[key] === null) {
      // 根据下一个键的类型决定创建对象还是数组
      const nextKey = keys[i + 1]
      target[key] = typeof nextKey === 'number' ? [] : {}
    }
    target = target[key]
  }

  // 设置最终值
  const finalKey = keys[keys.length - 1]
  if (finalKey !== undefined) {
    target[finalKey] = value
  }
}

/**
 * 删除指定路径的值
 * @param obj - 要修改的对象
 * @param path - 路径字符串
 * @returns 是否成功删除
 */
function deleteValueByPath(obj: any, path: string): boolean {
  if (!obj || typeof obj !== 'object') return false
  if (!path || typeof path !== 'string') return false

  const keys: (string | number)[] = []
  let current = ''
  let inBracket = false
  let inQuote = false
  let quoteChar = ''

  // 解析路径为键数组（与 getValueByPath 相同的逻辑）
  for (let i = 0; i < path.length; i++) {
    const char = path[i]

    if (inQuote) {
      if (char === quoteChar && path[i - 1] !== '\\') {
        inQuote = false
        quoteChar = ''
      } else {
        current += char
      }
    } else if (char === '"' || char === "'") {
      inQuote = true
      quoteChar = char
    } else if (char === '[') {
      if (current) {
        keys.push(current)
        current = ''
      }
      inBracket = true
    } else if (char === ']') {
      if (current) {
        const num = parseInt(current, 10)
        keys.push(isNaN(num) ? current : num)
        current = ''
      }
      inBracket = false
    } else if (char === '.' && !inBracket) {
      if (current) {
        keys.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }

  if (current) {
    keys.push(current)
  }

  if (keys.length === 0) return false

  // 找到父对象
  let target: any = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (key === undefined) return false
    if (!(key in target) || typeof target[key] !== 'object' || target[key] === null) {
      return false // 路径不存在
    }
    target = target[key]
  }

  // 删除最终键
  const finalKey = keys[keys.length - 1]
  if (finalKey === undefined || !(finalKey in target)) {
    return false // 键不存在
  }

  if (Array.isArray(target)) {
    target.splice(finalKey as number, 1)
  } else {
    delete target[finalKey]
  }
  
  return true
}

// ========== Pinia Store 定义 ==========

export const useChatVariablesStore = defineStore('chatVariables', () => {
  // 缓存的变量数据（仅缓存当前对话的变量）
  const meta = ref<Variables | null>(null)
  const loading = ref<boolean>(false)
  const error = ref<string>('')

  /**
   * 从后端获取变量数据（带缓存）
   * @param file - 对话文件路径，不传则使用当前对话（从 messagesStore 获取）
   * @returns 变量对象
   */
  async function fetchVariables(file: string | null = null): Promise<Variables> {
    // 获取当前对话文件（从 messagesStore）
    const messagesStore = useMessagesStore()
    const currentFile = messagesStore.conversationFile
    
    const targetFile = file || currentFile
    if (!targetFile) {
      throw new Error('No conversation file specified')
    }

    // 如果查询当前对话且有缓存，直接返回
    if (!file && targetFile === currentFile && meta.value !== null) {
      return meta.value
    }

    loading.value = true
    error.value = ''
    try {
      const result = await (ChatBranches as any).variables({
        action: 'get',
        file: targetFile
      }) as VariablesResponse
      
      const vars = result?.variables || {}
      
      // 如果查询的是当前对话，更新缓存
      if (!file || file === messagesStore.conversationFile) {
        meta.value = vars
      }
      
      return vars
    } catch (e) {
      error.value = (e as Error)?.message || String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 设置单个变量
   * @param key - 变量路径
   * @param value - 变量值
   */
  async function setVariable(key: string, value: any): Promise<void> {
    const messagesStore = useMessagesStore()
    const currentFile = messagesStore.conversationFile
    
    if (!currentFile) {
      throw new Error('No conversation file specified')
    }

    loading.value = true
    error.value = ''
    
    try {
      // 获取当前所有变量
      const currentVars = await fetchVariables()
      
      // 创建副本并设置新值
      const updatedVars = JSON.parse(JSON.stringify(currentVars || {}))
      setValueByPath(updatedVars, key, value)
      
      // 使用 merge 保存（保留其他变量）
      const result = await (ChatBranches as any).variables({
        action: 'merge',
        file: currentFile,
        data: updatedVars
      }) as VariablesResponse
      
      // 更新缓存
      meta.value = result?.variables || updatedVars
    } catch (e) {
      error.value = (e as Error)?.message || String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 批量设置变量
   * @param data - 变量字典，键为路径，值为对应的变量值
   */
  async function setVariables(data: Record<string, any>): Promise<void> {
    const messagesStore = useMessagesStore()
    const currentFile = messagesStore.conversationFile
    
    if (!currentFile) {
      throw new Error('No conversation file specified')
    }

    if (!data || typeof data !== 'object') {
      throw new Error('data must be an object')
    }

    loading.value = true
    error.value = ''
    
    try {
      // 获取当前所有变量
      const currentVars = await fetchVariables()
      
      // 创建副本并批量设置
      const updatedVars = JSON.parse(JSON.stringify(currentVars || {}))
      for (const [key, value] of Object.entries(data)) {
        setValueByPath(updatedVars, key, value)
      }
      
      // 使用 merge 保存
      const result = await (ChatBranches as any).variables({
        action: 'merge',
        file: currentFile,
        data: updatedVars
      }) as VariablesResponse
      
      // 更新缓存
      meta.value = result?.variables || updatedVars
    } catch (e) {
      error.value = (e as Error)?.message || String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 删除单个变量
   * @param key - 变量路径
   */
  async function deleteVariable(key: string): Promise<void> {
    const messagesStore = useMessagesStore()
    const currentFile = messagesStore.conversationFile
    
    if (!currentFile) {
      throw new Error('No conversation file specified')
    }

    loading.value = true
    error.value = ''
    
    try {
      // 获取当前所有变量
      const currentVars = await fetchVariables()
      
      // 创建副本并删除
      const updatedVars = JSON.parse(JSON.stringify(currentVars || {}))
      const deleted = deleteValueByPath(updatedVars, key)
      
      if (!deleted) {
        console.warn(`[deleteVariable] Key not found: ${key}`)
      }
      
      // 使用 set 全量保存（因为是删除操作）
      const result = await (ChatBranches as any).variables({
        action: 'set',
        file: currentFile,
        data: updatedVars
      }) as VariablesResponse
      
      // 更新缓存
      meta.value = result?.variables || updatedVars
    } catch (e) {
      error.value = (e as Error)?.message || String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 批量删除变量
   * @param keys - 变量路径数组
   */
  async function deleteVariables(keys: string[]): Promise<void> {
    const messagesStore = useMessagesStore()
    const currentFile = messagesStore.conversationFile
    
    if (!currentFile) {
      throw new Error('No conversation file specified')
    }

    if (!Array.isArray(keys)) {
      throw new Error('keys must be an array')
    }

    loading.value = true
    error.value = ''
    
    try {
      // 获取当前所有变量
      const currentVars = await fetchVariables()
      
      // 创建副本并批量删除
      const updatedVars = JSON.parse(JSON.stringify(currentVars || {}))
      for (const key of keys) {
        const deleted = deleteValueByPath(updatedVars, key)
        if (!deleted) {
          console.warn(`[deleteVariables] Key not found: ${key}`)
        }
      }
      
      // 使用 set 全量保存
      const result = await (ChatBranches as any).variables({
        action: 'set',
        file: currentFile,
        data: updatedVars
      }) as VariablesResponse
      
      // 更新缓存
      meta.value = result?.variables || updatedVars
    } catch (e) {
      error.value = (e as Error)?.message || String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新缓存的variables（内部方法，由事件监听器调用）
   * @param vars - 新的变量对象
   */
  function _updateCache(vars: Variables): void {
    if (vars && typeof vars === 'object') {
      meta.value = vars
    }
  }

  /**
   * 清空缓存
   */
  function clearCache(): void {
    meta.value = null
  }

  // 监听消息视图更新事件，自动同步 variables
  try {
    Host.events.on('workflow.message.view.updated', ({ conversationFile, variables }: { conversationFile: string, variables?: Variables }) => {
      const messagesStore = useMessagesStore()
      // 只有当更新的对话文件是当前对话时才更新缓存
      if (conversationFile === messagesStore.conversationFile && variables) {
        _updateCache(variables)
      }
    })
  } catch {}

  return {
    meta,
    loading,
    error,
    fetchVariables,
    setVariable,
    setVariables,
    deleteVariable,
    deleteVariables,
    clearCache,
  }
})

export default useChatVariablesStore

// ========== 全局函数 ==========

/**
 * 获取当前对话的单个变量值
 * @param key - 变量路径（如 'user.name' 或 'items[0].id'）
 * @returns 变量值，不存在则返回 undefined
 */
export async function getVariable(key: string): Promise<any> {
  try {
    const store = useChatVariablesStore()
    const vars = await store.fetchVariables()
    return getValueByPath(vars, key)
  } catch (e) {
    console.error('[getVariable] Error:', e)
    return undefined
  }
}

/**
 * 获取当前对话的多个变量值
 * @param keys - 变量路径列表
 * @returns 变量字典，键为路径，值为对应的变量值
 */
export async function getVariables(...keys: string[]): Promise<Record<string, any>> {
  try {
    const store = useChatVariablesStore()
    const vars = await store.fetchVariables()
    
    const result: Record<string, any> = {}
    for (const key of keys) {
      result[key] = getValueByPath(vars, key)
    }
    return result
  } catch (e) {
    console.error('[getVariables] Error:', e)
    return {}
  }
}

/**
 * 设置当前对话的单个变量值
 * @param key - 变量路径
 * @param value - 变量值
 */
export async function setVariable(key: string, value: any): Promise<void> {
  try {
    const store = useChatVariablesStore()
    await store.setVariable(key, value)
  } catch (e) {
    console.error('[setVariable] Error:', e)
    throw e
  }
}

/**
 * 批量设置当前对话的变量值
 * @param data - 变量字典，键为路径，值为对应的变量值
 */
export async function setVariables(data: Record<string, any>): Promise<void> {
  try {
    const store = useChatVariablesStore()
    await store.setVariables(data)
  } catch (e) {
    console.error('[setVariables] Error:', e)
    throw e
  }
}

/**
 * 删除当前对话的单个变量
 * @param key - 变量路径
 */
export async function deleteVariable(key: string): Promise<void> {
  try {
    const store = useChatVariablesStore()
    await store.deleteVariable(key)
  } catch (e) {
    console.error('[deleteVariable] Error:', e)
    throw e
  }
}

/**
 * 批量删除当前对话的变量
 * @param keys - 变量路径数组
 */
export async function deleteVariables(keys: string[]): Promise<void> {
  try {
    const store = useChatVariablesStore()
    await store.deleteVariables(keys)
  } catch (e) {
    console.error('[deleteVariables] Error:', e)
    throw e
  }
}

/**
 * 获取变量的所有键（用于前端显示）
 * @param key - 可选的父键路径
 * @returns 键名数组
 */
export async function getVariableJSON(key?: string): Promise<any> {
  try {
    const store = useChatVariablesStore()
    const vars = await store.fetchVariables()
    if (!key) return vars
    return getValueByPath(vars, key)
  } catch (e) {
    console.error('[getVariableJSON] Error:', e)
    return undefined
  }
}

/**
 * 注册全局函数到 window 对象
 */
export interface RegisterGlobalFunctionsOptions {
  exposeToWindow?: boolean
}

export function registerGlobalFunctions({ exposeToWindow = true }: RegisterGlobalFunctionsOptions = {}): void {
  if (typeof window === 'undefined') return
  if (exposeToWindow) {
    try {
      Object.defineProperty(window, 'getVariable', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: async function (key: string): Promise<any> {
          return await getVariable(key)
        },
      })
      Object.defineProperty(window, 'getVariables', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: async function (...keys: string[]): Promise<Record<string, any>> {
          return await getVariables(...keys)
        },
      })
      Object.defineProperty(window, 'getVariableJSON', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: async function (key?: string): Promise<any> {
          return await getVariableJSON(key)
        },
      })
      Object.defineProperty(window, 'setVariable', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: async function (key: string, value: any): Promise<void> {
          return await setVariable(key, value)
        },
      })
      Object.defineProperty(window, 'setVariables', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: async function (data: Record<string, any>): Promise<void> {
          return await setVariables(data)
        },
      })
      Object.defineProperty(window, 'deleteVariable', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: async function (key: string): Promise<void> {
          return await deleteVariable(key)
        },
      })
      Object.defineProperty(window, 'deleteVariables', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: async function (keys: string[]): Promise<void> {
          return await deleteVariables(keys)
        },
      })
    } catch {
      // 回退直接赋值
      (window as any).getVariable = async (key: string) => await getVariable(key);
      (window as any).getVariables = async (...keys: string[]) => await getVariables(...keys);
      (window as any).getVariableJSON = async (key?: string) => await getVariableJSON(key);
      (window as any).setVariable = async (key: string, value: any) => await setVariable(key, value);
      (window as any).setVariables = async (data: Record<string, any>) => await setVariables(data);
      (window as any).deleteVariable = async (key: string) => await deleteVariable(key);
      (window as any).deleteVariables = async (keys: string[]) => await deleteVariables(keys)
    }
  }
}

// ========== 全局类型声明 ==========

declare global {
  interface Window {
    getVariable(key: string): Promise<any>
    getVariables(...keys: string[]): Promise<Record<string, any>>
    getVariableJSON(key?: string): Promise<any>
    setVariable(key: string, value: any): Promise<void>
    setVariables(data: Record<string, any>): Promise<void>
    deleteVariable(key: string): Promise<void>
    deleteVariables(keys: string[]): Promise<void>
  }
}