import { ref, nextTick, type Ref } from 'vue'
import { i18n } from '@/locales'

/**
 * useHomeModal：主页功能模态（load / gallery / options）的集中编排
 * - 状态：homeModalOpen / homeModalTitle / homeModalType
 * - 行为：openHomeModal(type) / closeHomeModal()
 * - UI：打开后刷新 lucide 图标与 Flowbite 组件，确保动态节点可用
 *
 * 用法：
 *   import { useHomeModal } from '@/composables/useHomeModal'
 *   const { homeModalOpen, homeModalTitle, homeModalType, openHomeModal, closeHomeModal } = useHomeModal()
 */

export type HomeModalType = 'load' | 'appearance' | 'plugins' | 'options' | ''

export interface HomeModalAPI {
  homeModalOpen: Ref<boolean>
  homeModalTitle: Ref<string>
  homeModalType: Ref<HomeModalType>
  openHomeModal: (type: Exclude<HomeModalType, ''>) => void
  closeHomeModal: () => void
}

export function useHomeModal(): HomeModalAPI {
  const homeModalOpen = ref<boolean>(false)
  const homeModalTitle = ref<string>('')
  const homeModalType = ref<HomeModalType>('')

  function openHomeModal(type: Exclude<HomeModalType, ''>): void {
    homeModalType.value = type
    homeModalTitle.value =
      type === 'load' ? i18n.t('app.modal.loadGame')
      : type === 'appearance' ? i18n.t('app.modal.appearance')
      : type === 'plugins' ? i18n.t('app.modal.plugins')
      : type === 'options' ? i18n.t('app.modal.options')
      : ' '
    homeModalOpen.value = true

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

  function closeHomeModal(): void {
    homeModalOpen.value = false
    homeModalType.value = ''
    homeModalTitle.value = ''
  }

  return {
    homeModalOpen,
    homeModalTitle,
    homeModalType,
    openHomeModal,
    closeHomeModal,
  }
}

export default useHomeModal