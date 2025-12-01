// SmartTavern Workflow - Completion Channels (TS)
// 标准事件通道：用于请求 AI 补全（流式/非流式），以及在补全过程中将各阶段事件向外广播，供插件/外部逻辑监听并做自定义后处理。
// 事件通过 Host 事件总线派发与监听：见 [`Host.events`](frontend_projects/SmartTavern/src/workflow/core/host.js:58)
//
// 设计目标：
// - 统一补全请求入口与回调事件，使插件可在不耦合 UI/组件的前提下接入"自定义后处理/埋点/联动UI"。
// - 事件名语义清晰、粒度合适；payload 结构稳定，便于第三方消费。
// - 流/非流两种模式均可通过同一事件协议对外广播状态。

// ============ Type Definitions ============

/** 补全模式 */
export type CompletionMode = 'auto' | 'stream' | 'single'

/** 补全请求 Payload */
export interface CompletionRequestPayload {
  conversationFile: string;
  llmConfigFile?: string;
  mode?: CompletionMode;
  tag?: string;
}

/** 补全 Chunk Payload */
export interface CompletionChunkPayload {
  conversationFile: string;
  content: string;
  tag?: string;
}

/** 补全完成 Payload */
export interface CompletionFinishPayload {
  conversationFile: string;
  finish_reason: string;
  tag?: string;
}

/** 补全 Usage Payload */
export interface CompletionUsagePayload {
  conversationFile: string;
  usage: any;
  tag?: string;
}

/** 补全保存 Payload */
export interface CompletionSavedPayload {
  conversationFile: string;
  node_id: string;
  doc: any;
  usage?: any;
  content?: string;
  tag?: string;
}

/** 补全错误 Payload */
export interface CompletionErrorPayload {
  conversationFile?: string;
  message: string;
  detail?: any;
  tag?: string;
}

/** 补全结束 Payload */
export interface CompletionEndPayload {
  conversationFile?: string;
  tag?: string;
}

/** 补全中止请求 Payload */
export interface CompletionAbortPayload {
  conversationFile?: string;
  tag?: string;
}

/** 补全已中止 Payload */
export interface CompletionAbortedPayload {
  conversationFile?: string;
  tag?: string;
}

// ============ Event Constants ============

// 约定：
// - REQUEST 事件由发起方触发（插件/控制台/内部模块），应用侧桥接到 ChatCompletion 服务。
// - 其余事件由应用侧在补全过程中派发，供第三方监听（插件等）。
//
// 推荐 payload 结构：
// - REQUEST（workflow.completion.request）
//   { conversationFile: string, llmConfigFile?: string, mode?: 'auto'|'stream'|'single', tag?: string }
//   - mode 缺省为 'auto'，与 [chatCompletion.completeAuto()](frontend_projects/SmartTavern/src/services/chatCompletion.ts:84) 对齐
//   - tag 可用于多路请求识别（例如 UI 会话/插件任务 id）
// - CHUNK（workflow.completion.chunk）
//   { conversationFile: string, content: string, tag?: string }
// - FINISH（workflow.completion.finish）
//   { conversationFile: string, finish_reason: string, tag?: string }
// - USAGE（workflow.completion.usage）
//   { conversationFile: string, usage: any, tag?: string }
// - SAVED（workflow.completion.saved）
//   { conversationFile: string, node_id: string, doc: any, usage?: any, content?: string, tag?: string }
// - ERROR（workflow.completion.error）
//   { conversationFile?: string, message: string, detail?: any, tag?: string }
// - END（workflow.completion.end）
//   { conversationFile?: string, tag?: string }
// - ABORT（workflow.completion.abort）
//   { conversationFile?: string, tag?: string }  // 若未提供 conversationFile，则默认中止所有活跃请求
// - ABORTED（workflow.completion.aborted）
//   { conversationFile?: string, tag?: string }
//
// 注意：事件常量仅定义协议本身；实际订阅/派发逻辑需在应用桥接层实现（例如在 [App.vue](frontend_projects/SmartTavern/src/App.vue:1) 中订阅 REQUEST/ABORT 并调用 ChatCompletion）。
//
// 插件侧使用示例：
//   import * as Completion from '/src/workflow/channels/completion'
//   // 发起一次"自动模式"的补全请求：
//   host.events.emit(Completion.EVT_COMPLETION_REQ, {
//     conversationFile: '/data/conversations/222.json',
//     // llmConfigFile: '/data/llm_configs/openai_gpt4.json',
//     mode: 'auto',
//     tag: 'my-plugin-task-1',
//   })
//   // 监听补全保存事件：
//   const off = host.events.on(Completion.EVT_COMPLETION_SAVED, (p) => {
//     if (p.tag === 'my-plugin-task-1') {
//       host.pushToast({ type: 'success', message: '补全已保存' })
//     }
//   })

export const EVT_COMPLETION_REQ = 'workflow.completion.request'
export const EVT_COMPLETION_CHUNK = 'workflow.completion.chunk'
export const EVT_COMPLETION_FINISH = 'workflow.completion.finish'
export const EVT_COMPLETION_USAGE = 'workflow.completion.usage'
export const EVT_COMPLETION_SAVED = 'workflow.completion.saved'
export const EVT_COMPLETION_ERROR = 'workflow.completion.error'
export const EVT_COMPLETION_END = 'workflow.completion.end'
export const EVT_COMPLETION_ABORT = 'workflow.completion.abort'
export const EVT_COMPLETION_ABORTED = 'workflow.completion.aborted'

// 默认导出：常量聚合（便于一次性导入）
const CompletionChannels = {
  EVT_COMPLETION_REQ,
  EVT_COMPLETION_CHUNK,
  EVT_COMPLETION_FINISH,
  EVT_COMPLETION_USAGE,
  EVT_COMPLETION_SAVED,
  EVT_COMPLETION_ERROR,
  EVT_COMPLETION_END,
  EVT_COMPLETION_ABORT,
  EVT_COMPLETION_ABORTED,
}

export default CompletionChannels