/**
 * SmartTavern Workflow - HomeMenu Context Provider (v1)
 * 用途：为 Host.listHomeButtons(ctx) 提供上下文对象，供 visibleWhen/disabledWhen 等规则判断使用。
 * 注意：这是 UI 侧轻量上下文，插件不可依赖重度业务状态；如需更丰富上下文，请扩展此函数。
 */

import type { HomeMenuContext } from './contract'

export function getHomeMenuContext(): HomeMenuContext {
  // 是否移动端（简单媒体查询）
  const isMobile = typeof window !== 'undefined'
    ? !!(window.matchMedia && window.matchMedia('(max-width: 640px)').matches)
    : false

  // 是否存在存档：由服务端 list_conversations 结果在 HomeMenu 组件侧覆盖；此处默认 false，不读浏览器存储
  const hasSaves = false

  // 语言
  const lang = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'zh-CN'

  return {
    isMobile,
    hasSaves,
    lang,
  }
}

export default getHomeMenuContext