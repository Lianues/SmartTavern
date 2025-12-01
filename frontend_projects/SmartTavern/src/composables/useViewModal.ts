import { ref, nextTick, onBeforeUnmount, type Ref } from 'vue'
import Host from '@/workflow/core/host'
import * as Catalog from '@/workflow/channels/catalog'
import { i18n } from '@/locales'

/**
 * useViewModal：内容查看模态编排（Preset/WorldBook/Character/Persona/Regex）
 * - 状态：open/title/type/data/loading/error/file
 * - 行为：openViewModal(type, title, fileOrData) / closeViewModal()
 * - 特性：支持传入对象直接渲染，或传入文件名自动拉取并缓存
 * - UI：打开/载入完成后刷新 lucide 图标与 Flowbite 组件
 *
 * 用法（父组件/App）：
 *   import { useViewModal } from '@/composables/useViewModal'
 *   const {
 *     viewModalOpen, viewModalTitle, viewModalType, viewModalData,
 *     viewModalLoading, viewModalError, viewModalFile,
 *     openViewModal, closeViewModal, currentPresetData
 *   } = useViewModal()
 */

export type ViewModalType = 'preset' | 'worldbook' | 'character' | 'persona' | 'regex' | 'aiconfig' | 'workflow' | ''

export interface UseViewModalAPI {
  // state
  viewModalOpen: Ref<boolean>
  viewModalTitle: Ref<string>
  viewModalType: Ref<ViewModalType>
  viewModalData: Ref<any>
  viewModalLoading: Ref<boolean>
  viewModalError: Ref<string>
  viewModalFile: Ref<string>
  currentPresetData: Ref<any>

  // actions
  openViewModal: (type: ViewModalType, title: string, fileOrData?: string | object) => Promise<void>
  closeViewModal: () => void
}

export function useViewModal(): UseViewModalAPI {
  // state
  const viewModalOpen    = ref<boolean>(false)
  const viewModalTitle   = ref<string>('')
  const viewModalType    = ref<ViewModalType>('')
  const viewModalData    = ref<any>(null)
  const viewModalLoading = ref<boolean>(false)
  const viewModalError   = ref<string>('')
  const viewModalFile    = ref<string>('')

  // 供外部 AI 配置面板使用的"当前预设内容"
  const currentPresetData = ref<any>(null)
  
  // 事件监听清理器
  const __eventOffs: Array<(() => void)> = []
  
  onBeforeUnmount(() => {
    try {
      __eventOffs?.forEach(fn => { 
        try { 
          fn?.() 
        } catch (_) {
          // Ignore errors
        } 
      })
      __eventOffs.length = 0
    } catch (_) {
      // Ignore errors
    }
  })

  async function openViewModal(type: ViewModalType, title: string, fileOrData?: string | object): Promise<void> {
    viewModalType.value  = type
    viewModalTitle.value = title || ''
    viewModalError.value = ''
    viewModalLoading.value = true
    viewModalData.value  = null
    viewModalFile.value  = typeof fileOrData === 'string' ? fileOrData : ''

    viewModalOpen.value = true

    try {
      if (fileOrData && typeof fileOrData === 'object') {
        // 直接渲染对象
        viewModalData.value = fileOrData
        viewModalLoading.value = false
        refreshUI()
      } else if (typeof fileOrData === 'string') {
        // workflow 类型特殊处理：前端直读文件，不请求后端
        if (type === 'workflow') {
          viewModalData.value = { file: fileOrData }
          viewModalFile.value = fileOrData
          viewModalLoading.value = false
          refreshUI()
          return
        }
        
        // 通过事件请求详情
        const categoryMap: Record<string, string> = {
          'preset': 'preset',
          'worldbook': 'worldbook',
          'character': 'character',
          'persona': 'persona',
          'regex': 'regex',
          'aiconfig': 'llm_config'
        }
        
        const category = categoryMap[type]
        if (!category) {
          throw new Error(i18n.t('error.unknownType', { type }))
        }
        
        const tag = `detail_${type}_${Date.now()}`
        
        // 监听详情查询结果（一次性）
        const offOk = Host.events.on(Catalog.EVT_CATALOG_GET_DETAIL_OK, ({ category: _resCategory, file: resFile, data, tag: resTag }) => {
          if (resTag !== tag) return
          
          try {
            viewModalData.value = data
            viewModalFile.value = resFile || fileOrData
            
            if (type === 'preset' && data) {
              currentPresetData.value = data
            }
          } catch (e: any) {
            viewModalError.value = e?.message || String(e)
          } finally {
            viewModalLoading.value = false
            refreshUI()
            try { offOk?.() } catch (_) {
              // Ignore errors
            }
            try { offFail?.() } catch (_) {
              // Ignore errors
            }
          }
        })
        
        const offFail = Host.events.on(Catalog.EVT_CATALOG_GET_DETAIL_FAIL, ({ category: _resCategory, message, tag: resTag }) => {
          if (resTag && resTag !== tag) return
          
          viewModalError.value = message || i18n.t('error.getDetailFailed')
          viewModalLoading.value = false
          refreshUI()
          try { offOk?.() } catch (_) {
            // Ignore errors
          }
          try { offFail?.() } catch (_) {
            // Ignore errors
          }
        })
        
        __eventOffs.push(offOk, offFail)
        
        // 发送详情查询请求
        Host.events.emit(Catalog.EVT_CATALOG_GET_DETAIL_REQ, {
          category,
          file: fileOrData,
          tag
        })
      } else {
        // 无 fileOrData：保持空占位
        viewModalLoading.value = false
        refreshUI()
      }
    } catch (e: any) {
      viewModalError.value = e?.message || String(e)
      viewModalLoading.value = false
      refreshUI()
    }
  }
  
  function refreshUI(): void {
    // 刷新图标与 Flowbite 交互组件
    nextTick(() => {
      try { 
        (window as any)?.lucide?.createIcons?.() 
      } catch (_) {
        // Ignore errors
      }
      if (typeof (window as any).initFlowbite === 'function') {
        try { 
          (window as any).initFlowbite() 
        } catch (_) {
          // Ignore errors
        }
      }
    })
  }

  function closeViewModal(): void {
    viewModalOpen.value = false
    viewModalType.value = ''
    viewModalTitle.value = ''
    viewModalData.value = null
    viewModalLoading.value = false
    viewModalError.value = ''
    viewModalFile.value = ''
  }

  return {
    // state
    viewModalOpen,
    viewModalTitle,
    viewModalType,
    viewModalData,
    viewModalLoading,
    viewModalError,
    viewModalFile,
    currentPresetData,

    // actions
    openViewModal,
    closeViewModal,
  }
}

export default useViewModal