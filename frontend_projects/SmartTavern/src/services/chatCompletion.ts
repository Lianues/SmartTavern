/**
 * SmartTavern Frontend API Client — Chat Completion Workflow (Router'ed)
 * 改造：不再直接调用后端固定工作流接口，统一经 RouterClient 发送动作到路由器插件，由路由器编排。
 */
import RouterClient from '@/services/routerClient'

// 类型定义
interface CompletionParams {
  conversationFile: string
  llmConfigFile?: string | null
}

interface CompletionCallbacks {
  onChunk?: (content: string) => void
  onComplete?: (result: any) => void
  onError?: (error: Error) => void
  [key: string]: any
}

const ChatCompletion = {
  /**
   * 智能AI补全（自动流式/非流式由路由器决定）
   */
  async completeAuto(
    { conversationFile, llmConfigFile = null }: CompletionParams,
    callbacks: CompletionCallbacks = {}
  ): Promise<any> {
    return RouterClient.completeAuto({ conversationFile, llmConfigFile }, callbacks)
  },

  /**
   * 非流式AI补全（统一走路由器）
   */
  async complete(
    { conversationFile, llmConfigFile }: CompletionParams,
    callbacks: CompletionCallbacks = {}
  ): Promise<any> {
    return RouterClient.completeSingle({ conversationFile, llmConfigFile }, callbacks)
  },

  /**
   * 流式AI补全（统一走路由器）
   */
  completeStream(
    { conversationFile, llmConfigFile }: CompletionParams,
    callbacks: CompletionCallbacks = {}
  ): Promise<any> {
    return RouterClient.completeStream({ conversationFile, llmConfigFile }, callbacks)
  }
}

export default ChatCompletion