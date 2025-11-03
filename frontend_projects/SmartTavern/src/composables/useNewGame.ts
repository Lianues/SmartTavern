import { ref, nextTick, type Ref } from 'vue'

/**
 * useNewGame：管理"新建对话"模态的状态与行为
 * - 提供：newGameOpen / openNewGame / cancelNewGame / onNewChatConfirm
 * - 依赖：setView 回调（用于将视图切换到 threaded/sandbox），refreshIcons（刷新图标与 Flowbite）
 *
 * 用法（在 App.vue 中）：
 *   import { useNewGame } from '@/composables/useNewGame'
 *   const { newGameOpen, openNewGame, cancelNewGame, onNewChatConfirm } =
 *     useNewGame({ setView: (v) => (view.value = v), refreshIcons })
 */

export type ViewType = 'start' | 'threaded' | 'sandbox'

export interface NewGamePayload {
  name?: string
  type?: ViewType
  preset?: string
  character?: string
  persona?: string
  regex?: string
  worldbook?: string
  file?: string
  [key: string]: any
}

export interface UseNewGameOptions {
  setView?: (view: ViewType) => void
  refreshIcons?: () => void
}

export interface UseNewGameAPI {
  newGameOpen: Ref<boolean>
  openNewGame: () => void
  cancelNewGame: () => void
  onNewChatConfirm: (payload?: NewGamePayload) => void
}

export function useNewGame({ setView, refreshIcons }: UseNewGameOptions = {}): UseNewGameAPI {
  const newGameOpen = ref<boolean>(false)

  function openNewGame(): void {
    newGameOpen.value = true
    // 打开后刷新图标与交互组件
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

  function cancelNewGame(): void {
    newGameOpen.value = false
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

  function onNewChatConfirm(payload?: NewGamePayload): void {
    // TODO：与后端通信创建会话（携带所选项）
    // payload: { name, type, preset, character, persona, regex?, worldbook? }
    const t = payload?.type
    if (t === 'threaded' || t === 'sandbox') {
      try {
        typeof setView === 'function' && setView(t)
      } catch (_) {
        // Ignore errors
      }
    }
    newGameOpen.value = false
    // 关闭后刷新图标
    if (typeof refreshIcons === 'function') {
      refreshIcons()
    } else {
      nextTick(() => { 
        try { 
          (window as any)?.lucide?.createIcons?.() 
        } catch (_) {
          // Ignore errors
        } 
      })
    }
  }

  return {
    newGameOpen,
    openNewGame,
    cancelNewGame,
    onNewChatConfirm,
  }
}

export default useNewGame