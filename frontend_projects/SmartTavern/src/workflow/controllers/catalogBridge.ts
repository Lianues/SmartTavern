/**
 * 数据目录桥接器 (Catalog Bridge)
 *
 * 监听catalog通道的请求事件，调用DataCatalog服务，
 * 并将结果通过响应事件返回给组件。
 */

import * as CatalogChannel from '@/workflow/channels/catalog'
import DataCatalog from '@/services/dataCatalog'
import { i18n } from '@/locales'

// 类型定义
interface EventBus {
  on(event: string, handler: (payload: any) => void | Promise<void>): void
  emit(event: string, payload?: any): void
}

// Blob URL 管理：跟踪已创建的 URLs 以便释放
const _blobUrlCache: Map<string, Set<string>> = new Map()

function _trackBlobUrl(category: string, url: string): void {
  if (!_blobUrlCache.has(category)) {
    _blobUrlCache.set(category, new Set())
  }
  _blobUrlCache.get(category)!.add(url)
}

function _revokeBlobUrls(category: string): void {
  const urls = _blobUrlCache.get(category)
  if (urls) {
    urls.forEach(url => {
      try { URL.revokeObjectURL(url) } catch (_) {}
    })
    urls.clear()
  }
}

// helper: derive icon.png path from catalog file path
function __deriveIconPath(file: string): string {
  const s = String(file || '').replace(/\\/g, '/')
  const i = s.lastIndexOf('/')
  const dir = i >= 0 ? s.slice(0, i) : s
  return dir + '/icon.png'
}

// helper: enrich card items with data icon blob URL
async function __enrichWithDataIcons<T extends { file: string }>(items: T[], category: string): Promise<Array<T & { avatarUrl?: string }>> {
  const out: Array<T & { avatarUrl?: string }> = Array.isArray(items) ? items.map(it => ({ ...it })) : []
  await Promise.all(out.map(async (it) => {
    const iconPath = __deriveIconPath(it.file)
    try {
      const { blob } = await DataCatalog.getDataAssetBlob(iconPath)
      const typed = it as any
      typed.avatarUrl = URL.createObjectURL(blob)
      _trackBlobUrl(category, typed.avatarUrl)
    } catch (_) {
      // ignore; fallback stays
    }
  }))
  return out
}

// helper: enrich character items with character.png avatar
async function __enrichCharactersWithAvatars<T extends { file: string }>(items: Array<T & { avatarUrl?: string }>, category: string): Promise<Array<T & { avatarUrl?: string; characterAvatarUrl?: string }>> {
  const out = items.map(it => ({ ...it }))
  await Promise.all(out.map(async (it) => {
    const avatarPath = String(it.file || '').replace(/character\.json$/, 'character.png')
    try {
      const { blob } = await DataCatalog.getDataAssetBlob(avatarPath)
      const typed = it as any
      typed.characterAvatarUrl = URL.createObjectURL(blob)
      _trackBlobUrl(category, typed.characterAvatarUrl)
    } catch (_) {
      // ignore; no avatar
    }
  }))
  return out
}

// helper: enrich persona items with persona.png avatar
async function __enrichPersonasWithAvatars<T extends { file: string }>(items: Array<T & { avatarUrl?: string }>, category: string): Promise<Array<T & { avatarUrl?: string; personaAvatarUrl?: string }>> {
  const out = items.map(it => ({ ...it }))
  await Promise.all(out.map(async (it) => {
    const avatarPath = String(it.file || '').replace(/persona\.json$/, 'persona.png')
    try {
      const { blob } = await DataCatalog.getDataAssetBlob(avatarPath)
      const typed = it as any
      typed.personaAvatarUrl = URL.createObjectURL(blob)
      _trackBlobUrl(category, typed.personaAvatarUrl)
    } catch (_) {
      // ignore; no avatar
    }
  }))
  return out
}

/**
 * 初始化数据目录桥接器
 * @param {EventBus} bus - 事件总线实例
 */
export function initCatalogBridge(bus: EventBus): void {
  // ===== 角色列表 =====
  bus.on(CatalogChannel.EVT_CATALOG_CHARACTERS_REQ, async (payload: any) => {
    const requestId = payload?.requestId || Date.now()

    try {
      CatalogChannel.loadingStates.value.characters = true
      CatalogChannel.errorStates.value.characters = null

      const res = await DataCatalog.listCharacters()
      const items = DataCatalog.mapToCards(res?.items || [], 'characters')
      const withIcons = await __enrichWithDataIcons(items, 'characters')
      const enriched = await __enrichCharactersWithAvatars(withIcons, 'characters')

      // 释放旧的 blob URLs（成功获取新数据后再释放）
      _revokeBlobUrls('characters')

      CatalogChannel.characters.value = enriched
      CatalogChannel.loadingStates.value.characters = false

      bus.emit(CatalogChannel.EVT_CATALOG_CHARACTERS_RES, {
        requestId,
        success: true,
        items,
        raw: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      CatalogChannel.errorStates.value.characters = errMsg
      CatalogChannel.loadingStates.value.characters = false

      bus.emit(CatalogChannel.EVT_CATALOG_CHARACTERS_RES, {
        requestId,
        success: false,
        error: errMsg
      })
    }
  })

  // ===== 人设列表 =====
  bus.on(CatalogChannel.EVT_CATALOG_PERSONAS_REQ, async (payload: any) => {
    const requestId = payload?.requestId || Date.now()

    try {
      CatalogChannel.loadingStates.value.personas = true
      CatalogChannel.errorStates.value.personas = null

      const res = await DataCatalog.listPersonas()
      const items = DataCatalog.mapToCards(res?.items || [], 'personas')
      const withIcons = await __enrichWithDataIcons(items, 'personas')
      const enriched = await __enrichPersonasWithAvatars(withIcons, 'personas')

      // 释放旧的 blob URLs（成功获取新数据后再释放）
      _revokeBlobUrls('personas')

      CatalogChannel.personas.value = enriched
      CatalogChannel.loadingStates.value.personas = false

      bus.emit(CatalogChannel.EVT_CATALOG_PERSONAS_RES, {
        requestId,
        success: true,
        items,
        raw: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      CatalogChannel.errorStates.value.personas = errMsg
      CatalogChannel.loadingStates.value.personas = false

      bus.emit(CatalogChannel.EVT_CATALOG_PERSONAS_RES, {
        requestId,
        success: false,
        error: errMsg
      })
    }
  })

  // ===== 预设列表 =====
  bus.on(CatalogChannel.EVT_CATALOG_PRESETS_REQ, async (payload: any) => {
    const requestId = payload?.requestId || Date.now()

    try {
      CatalogChannel.loadingStates.value.presets = true
      CatalogChannel.errorStates.value.presets = null

      const res = await DataCatalog.listPresets()
      const items = DataCatalog.mapToCards(res?.items || [], 'presets')
      const enriched = await __enrichWithDataIcons(items, 'presets')

      // 释放旧的 blob URLs（成功获取新数据后再释放）
      _revokeBlobUrls('presets')

      CatalogChannel.presets.value = enriched
      CatalogChannel.loadingStates.value.presets = false

      bus.emit(CatalogChannel.EVT_CATALOG_PRESETS_RES, {
        requestId,
        success: true,
        items,
        raw: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      CatalogChannel.errorStates.value.presets = errMsg
      CatalogChannel.loadingStates.value.presets = false

      bus.emit(CatalogChannel.EVT_CATALOG_PRESETS_RES, {
        requestId,
        success: false,
        error: errMsg
      })
    }
  })

  // ===== 世界书列表 =====
  bus.on(CatalogChannel.EVT_CATALOG_WORLDBOOKS_REQ, async (payload: any) => {
    const requestId = payload?.requestId || Date.now()

    try {
      CatalogChannel.loadingStates.value.worldbooks = true
      CatalogChannel.errorStates.value.worldbooks = null

      const res = await DataCatalog.listWorldBooks()
      const items = DataCatalog.mapToCards(res?.items || [], 'world_books')
      const enriched = await __enrichWithDataIcons(items, 'worldbooks')

      // 释放旧的 blob URLs（成功获取新数据后再释放）
      _revokeBlobUrls('worldbooks')

      CatalogChannel.worldbooks.value = enriched
      CatalogChannel.loadingStates.value.worldbooks = false

      bus.emit(CatalogChannel.EVT_CATALOG_WORLDBOOKS_RES, {
        requestId,
        success: true,
        items,
        raw: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      CatalogChannel.errorStates.value.worldbooks = errMsg
      CatalogChannel.loadingStates.value.worldbooks = false

      bus.emit(CatalogChannel.EVT_CATALOG_WORLDBOOKS_RES, {
        requestId,
        success: false,
        error: errMsg
      })
    }
  })

  // ===== 正则规则列表 =====
  bus.on(CatalogChannel.EVT_CATALOG_REGEX_REQ, async (payload: any) => {
    const requestId = payload?.requestId || Date.now()

    try {
      CatalogChannel.loadingStates.value.regex = true
      CatalogChannel.errorStates.value.regex = null

      const res = await DataCatalog.listRegexRules()
      const items = DataCatalog.mapToCards(res?.items || [], 'regex_rules')
      const enriched = await __enrichWithDataIcons(items, 'regex')

      // 释放旧的 blob URLs（成功获取新数据后再释放）
      _revokeBlobUrls('regex')

      CatalogChannel.regexRules.value = enriched
      CatalogChannel.loadingStates.value.regex = false

      bus.emit(CatalogChannel.EVT_CATALOG_REGEX_RES, {
        requestId,
        success: true,
        items,
        raw: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      CatalogChannel.errorStates.value.regex = errMsg
      CatalogChannel.loadingStates.value.regex = false

      bus.emit(CatalogChannel.EVT_CATALOG_REGEX_RES, {
        requestId,
        success: false,
        error: errMsg
      })
    }
  })

  // ===== LLM配置列表 =====
  bus.on(CatalogChannel.EVT_CATALOG_LLMCONFIGS_REQ, async (payload: any) => {
    const requestId = payload?.requestId || Date.now()

    try {
      CatalogChannel.loadingStates.value.llmconfigs = true
      CatalogChannel.errorStates.value.llmconfigs = null

      const res = await DataCatalog.listLLMConfigs()
      const items = DataCatalog.mapToCards(res?.items || [], 'llm_configs')
      const enriched = await __enrichWithDataIcons(items, 'llmconfigs')

      // 释放旧的 blob URLs（成功获取新数据后再释放）
      _revokeBlobUrls('llmconfigs')

      CatalogChannel.llmConfigs.value = enriched
      CatalogChannel.loadingStates.value.llmconfigs = false

      bus.emit(CatalogChannel.EVT_CATALOG_LLMCONFIGS_RES, {
        requestId,
        success: true,
        items,
        raw: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      CatalogChannel.errorStates.value.llmconfigs = errMsg
      CatalogChannel.loadingStates.value.llmconfigs = false

      bus.emit(CatalogChannel.EVT_CATALOG_LLMCONFIGS_RES, {
        requestId,
        success: false,
        error: errMsg
      })
    }
  })

  // ===== 角色更新 =====
  bus.on(CatalogChannel.EVT_CATALOG_CHARACTER_UPDATE_REQ, async (payload: any) => {
    const { file, content, name, description, iconBase64, avatarBase64, tag } = payload || {}
    
    try {
      const res = await DataCatalog.updateCharacterFile(file, content, name, description, iconBase64, avatarBase64)
      
      bus.emit(CatalogChannel.EVT_CATALOG_CHARACTER_UPDATE_OK, {
        tag,
        file,
        content,
        result: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      bus.emit(CatalogChannel.EVT_CATALOG_CHARACTER_UPDATE_FAIL, {
        tag,
        file,
        message: errMsg
      })
    }
  })

  // ===== 人设更新 =====
  bus.on(CatalogChannel.EVT_CATALOG_PERSONA_UPDATE_REQ, async (payload: any) => {
    const { file, content, name, description, iconBase64, avatarBase64, tag } = payload || {}
    
    try {
      const res = await DataCatalog.updatePersonaFile(file, content, name, description, iconBase64, avatarBase64)
      
      bus.emit(CatalogChannel.EVT_CATALOG_PERSONA_UPDATE_OK, {
        tag,
        file,
        content,
        result: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      bus.emit(CatalogChannel.EVT_CATALOG_PERSONA_UPDATE_FAIL, {
        tag,
        file,
        message: errMsg
      })
    }
  })

  // ===== 预设更新 =====
  bus.on(CatalogChannel.EVT_CATALOG_PRESET_UPDATE_REQ, async (payload: any) => {
    const { file, content, name, description, iconBase64, tag } = payload || {}
    
    try {
      const res = await DataCatalog.updatePresetFile(file, content, name, description, iconBase64)
      
      bus.emit(CatalogChannel.EVT_CATALOG_PRESET_UPDATE_OK, {
        tag,
        file,
        content,
        result: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      bus.emit(CatalogChannel.EVT_CATALOG_PRESET_UPDATE_FAIL, {
        tag,
        file,
        message: errMsg
      })
    }
  })

  // ===== 世界书更新 =====
  bus.on(CatalogChannel.EVT_CATALOG_WORLDBOOK_UPDATE_REQ, async (payload: any) => {
    const { file, content, name, description, iconBase64, tag } = payload || {}
    
    try {
      const res = await DataCatalog.updateWorldBookFile(file, content, name, description, iconBase64)
      
      bus.emit(CatalogChannel.EVT_CATALOG_WORLDBOOK_UPDATE_OK, {
        tag,
        file,
        content,
        result: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      bus.emit(CatalogChannel.EVT_CATALOG_WORLDBOOK_UPDATE_FAIL, {
        tag,
        file,
        message: errMsg
      })
    }
  })

  // ===== 正则规则更新 =====
  bus.on(CatalogChannel.EVT_CATALOG_REGEX_UPDATE_REQ, async (payload: any) => {
    const { file, content, name, description, iconBase64, tag } = payload || {}
    
    try {
      const res = await DataCatalog.updateRegexRuleFile(file, content, name, description, iconBase64)
      
      bus.emit(CatalogChannel.EVT_CATALOG_REGEX_UPDATE_OK, {
        tag,
        file,
        content,
        result: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      bus.emit(CatalogChannel.EVT_CATALOG_REGEX_UPDATE_FAIL, {
        tag,
        file,
        message: errMsg
      })
    }
  })

  // ===== LLM配置更新 =====
  bus.on(CatalogChannel.EVT_CATALOG_LLMCONFIG_UPDATE_REQ, async (payload: any) => {
    const { file, content, name, description, iconBase64, tag } = payload || {}
    
    try {
      const res = await DataCatalog.updateLLMConfigFile(file, content, name, description, iconBase64)
      
      bus.emit(CatalogChannel.EVT_CATALOG_LLMCONFIG_UPDATE_OK, {
        tag,
        file,
        content,
        result: res
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      bus.emit(CatalogChannel.EVT_CATALOG_LLMCONFIG_UPDATE_FAIL, {
        tag,
        file,
        message: errMsg
      })
    }
  })

  // ===== 统一列表查询 =====
  bus.on(CatalogChannel.EVT_CATALOG_LIST_REQ, async (payload: any) => {
    const { category, tag } = payload || {}
    
    try {
      const categoryMap: Record<string, () => Promise<any>> = {
        'preset': DataCatalog.listPresets,
        'character': DataCatalog.listCharacters,
        'persona': DataCatalog.listPersonas,
        'regex': DataCatalog.listRegexRules,
        'worldbook': DataCatalog.listWorldBooks,
        'llm_config': DataCatalog.listLLMConfigs
      }
      
      const fetcher = categoryMap[category || '']
      if (!fetcher) {
        throw new Error(i18n.t('workflow.controllers.catalog.unknownResourceType', { category }))
      }
      
      const res = await fetcher.call(DataCatalog)
      const items = Array.isArray(res?.items) ? res.items : []
      
      bus.emit(CatalogChannel.EVT_CATALOG_LIST_OK, {
        category,
        items,
        tag
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      bus.emit(CatalogChannel.EVT_CATALOG_LIST_FAIL, {
        category,
        message: errMsg,
        tag
      })
    }
  })
  
  // ===== 详情查询 =====
  bus.on(CatalogChannel.EVT_CATALOG_GET_DETAIL_REQ, async (payload: any) => {
    const { category, file, tag } = payload || {}
    
    try {
      const detailFetchers: Record<string, (f: string) => Promise<any>> = {
        'preset': (f: string) => DataCatalog.getPresetDetail(f, { useCache: false, persist: false }),
        'worldbook': (f: string) => DataCatalog.getWorldBookDetail(f, { useCache: false, persist: false }),
        'character': (f: string) => DataCatalog.getCharacterDetail(f, { useCache: false, persist: false }),
        'persona': (f: string) => DataCatalog.getPersonaDetail(f, { useCache: false, persist: false }),
        'regex': (f: string) => DataCatalog.getRegexRuleDetail(f, { useCache: false, persist: false }),
        'llm_config': (f: string) => DataCatalog.getLLMConfigDetail(f, { useCache: false, persist: false })
      }
      
      const fetcher = detailFetchers[category || '']
      if (!fetcher) {
        throw new Error(i18n.t('workflow.controllers.catalog.unknownResourceType', { category }))
      }
      
      const res = await fetcher(file || '')
      // 后端结构：{ file, name, description, content }
      const data = res && (res.content ?? res)
      
      bus.emit(CatalogChannel.EVT_CATALOG_GET_DETAIL_OK, {
        category,
        file,
        data,
        tag
      })
    } catch (error: any) {
      const errMsg = error?.message || String(error)
      bus.emit(CatalogChannel.EVT_CATALOG_GET_DETAIL_FAIL, {
        category,
        file,
        message: errMsg,
        tag
      })
    }
  })

  console.log('[CatalogBridge] 数据目录桥接器已初始化（含 update、list、detail 操作）')
}