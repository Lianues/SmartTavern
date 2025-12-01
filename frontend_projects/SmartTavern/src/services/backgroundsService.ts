/**
 * SmartTavern Frontend — Page Backgrounds Service
 * 
 * 管理页面背景图片的加载与缓存：
 * - 使用 IndexedDB 存储图片和哈希值
 * - 自动验证缓存有效性（通过 MD5 哈希）
 * - 根据屏幕方向自动选择横版/竖版背景
 * - 只在必要时从后端加载图片
 */

import StylesService from './stylesService'

// 类型定义
export type PageName = 'HomePage' | 'ThreadedChat' | 'SandboxChat'
export type Orientation = 'landscape' | 'portrait'

interface CachedBackground {
  page: PageName
  orientation: Orientation
  hash: string
  blob: Blob
  mime: string
  cachedAt: number
}

// IndexedDB 配置
const DB_NAME = 'st_backgrounds'
const DB_VERSION = 1
const STORE_NAME = 'backgrounds'

/**
 * 打开 IndexedDB 数据库
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      
      // 创建对象存储（如果不存在）
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: ['page', 'orientation'] })
        store.createIndex('hash', 'hash', { unique: false })
        store.createIndex('cachedAt', 'cachedAt', { unique: false })
      }
    }
  })
}

/**
 * 从 IndexedDB 获取缓存的背景图片
 */
async function getCachedBackground(page: PageName, orientation: Orientation): Promise<CachedBackground | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get([page, orientation])
      
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.warn('[BackgroundsService] Failed to get cached background:', err)
    return null
  }
}

/**
 * 保存背景图片到 IndexedDB
 */
async function saveCachedBackground(cached: CachedBackground): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put(cached)
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.warn('[BackgroundsService] Failed to save cached background:', err)
  }
}

/**
 * 清除所有缓存的背景图片
 */
async function clearAllCache(): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.clear()
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (err) {
    console.warn('[BackgroundsService] Failed to clear cache:', err)
  }
}

/**
 * 检测当前屏幕方向
 */
function detectOrientation(): Orientation {
  if (typeof window === 'undefined') return 'landscape'
  return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
}

/**
 * 从后端加载背景图片
 */
async function loadBackgroundFromBackend(
  page: PageName,
  orientation: Orientation
): Promise<{ blob: Blob; hash: string; mime: string }> {
  const res = await StylesService.getPageBackgroundBlob(page, orientation)
  return {
    blob: res.blob,
    hash: res.hash,
    mime: res.mime,
  }
}

/**
 * 获取页面背景图片（带缓存验证）
 * 
 * 流程：
 * 1. 检查本地 IndexedDB 缓存
 * 2. 从后端获取最新哈希值
 * 3. 如果哈希匹配，使用缓存；否则重新下载
 * 
 * @param page - 页面名称
 * @param orientation - 方向（可选，默认自动检测）
 */
async function getPageBackground(
  page: PageName,
  orientation?: Orientation
): Promise<{ url: string; hash: string }> {
  const orient = orientation || detectOrientation()
  
  // 1. 检查本地缓存
  const cached = await getCachedBackground(page, orient)
  
  // 2. 获取后端哈希值
  let backendHash: string | null = null
  try {
    const hashRes = await StylesService.getPageBackgroundsHash(orient)
    backendHash = hashRes[orient]?.[page] || null
  } catch (err) {
    console.warn('[BackgroundsService] Failed to get backend hash:', err)
    // 如果无法获取哈希，但有缓存，就使用缓存
    if (cached) {
      return {
        url: URL.createObjectURL(cached.blob),
        hash: cached.hash,
      }
    }
    throw err
  }
  
  // 3. 如果哈希匹配且有缓存，使用缓存
  if (cached && backendHash && cached.hash === backendHash) {
    console.info(`[BackgroundsService] Using cached background for ${page} (${orient})`)
    return {
      url: URL.createObjectURL(cached.blob),
      hash: cached.hash,
    }
  }
  
  // 4. 哈希不匹配或无缓存，从后端加载
  console.info(`[BackgroundsService] Loading background from backend: ${page} (${orient})`)
  const { blob, hash, mime } = await loadBackgroundFromBackend(page, orient)
  
  // 5. 保存到缓存
  await saveCachedBackground({
    page,
    orientation: orient,
    hash,
    blob,
    mime,
    cachedAt: Date.now(),
  })
  
  return {
    url: URL.createObjectURL(blob),
    hash,
  }
}

/**
 * 预加载所有背景图片
 * 
 * @param orientation - 方向（可选，默认自动检测）
 */
async function preloadAllBackgrounds(orientation?: Orientation): Promise<void> {
  const orient = orientation || detectOrientation()
  const pages: PageName[] = ['HomePage', 'ThreadedChat', 'SandboxChat']
  
  // 并发加载所有背景
  await Promise.allSettled(
    pages.map(page => getPageBackground(page, orient))
  )
}

/**
 * 监听窗口大小变化，自动预加载对应方向的背景
 */
function setupOrientationWatcher(): () => void {
  let currentOrientation = detectOrientation()
  let timeoutId: number | null = null
  
  const handler = () => {
    // 防抖：窗口大小变化 500ms 后才检测方向
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    
    timeoutId = window.setTimeout(() => {
      const newOrientation = detectOrientation()
      if (newOrientation !== currentOrientation) {
        console.info(`[BackgroundsService] Orientation changed: ${currentOrientation} -> ${newOrientation}`)
        currentOrientation = newOrientation
        // 预加载新方向的背景
        preloadAllBackgrounds(newOrientation).catch(err => {
          console.warn('[BackgroundsService] Failed to preload backgrounds:', err)
        })
      }
    }, 500)
  }
  
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handler)
  }
  
  // 返回清理函数
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handler)
    }
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
  }
}

// 导出服务
const BackgroundsService = {
  /**
   * 获取页面背景图片（带缓存）
   */
  getPageBackground,
  
  /**
   * 预加载所有背景图片
   */
  preloadAllBackgrounds,
  
  /**
   * 清除所有缓存
   */
  clearAllCache,
  
  /**
   * 设置方向监听器
   */
  setupOrientationWatcher,
  
  /**
   * 检测当前方向
   */
  detectOrientation,
}

export default BackgroundsService