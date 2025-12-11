import { ref, nextTick, type Ref } from 'vue'
import ChatBranches from '@/services/chatBranches'

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
  onConversationCreated?: (file: string) => void
}

export interface UseNewGameAPI {
  newGameOpen: Ref<boolean>
  openNewGame: () => void
  cancelNewGame: () => void
  onNewChatConfirm: (payload?: NewGamePayload) => Promise<void>
  isCreating: Ref<boolean>
  createError: Ref<string | null>
}

export function useNewGame({ setView, refreshIcons, onConversationCreated }: UseNewGameOptions = {}): UseNewGameAPI {
  const newGameOpen = ref<boolean>(false)
  const isCreating = ref<boolean>(false)
  const createError = ref<string | null>(null)

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

  async function onNewChatConfirm(payload?: NewGamePayload): Promise<void> {
    if (!payload?.character || !payload?.preset || !payload?.persona) {
      createError.value = 'Missing required fields: character, preset, persona'
      return
    }

    isCreating.value = true
    createError.value = null

    try {
      const res = await ChatBranches.createConversation({
        name: payload.name || `Chat_${Date.now()}`,
        type: (payload.type as 'threaded' | 'sandbox') || 'threaded',
        character: payload.character,
        preset: payload.preset,
        persona: payload.persona,
        regex: payload.regex || null,
        worldbook: payload.worldbook || null,
        llm_config: payload.llm_config || null,
      })

      if (res?.file) {
        onConversationCreated?.(res.file)
      }

      const t = payload?.type
      if (t === 'threaded' || t === 'sandbox') {
        setView?.(t)
      }

      newGameOpen.value = false
    } catch (err: any) {
      createError.value = err?.message || String(err)
      console.error('[useNewGame] createConversation failed:', err)
    } finally {
      isCreating.value = false
      refreshIcons?.() || nextTick(() => {
        try { (window as any)?.lucide?.createIcons?.() } catch (_) {}
      })
    }
  }

  return {
    newGameOpen,
    openNewGame,
    cancelNewGame,
    onNewChatConfirm,
    isCreating,
    createError,
  }
}

export default useNewGame