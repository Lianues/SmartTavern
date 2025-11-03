// SmartTavern Theme Extension (Demo): Shadow follow card radius (v1)
// 说明：
// - 这是一个"站内扩展示例"，不执行外部/不受信脚本，仅在应用自身上下文注册回调
// - 通过 ThemeManager.registerExtension 注册，并在 Appearance 外观快照广播时联动调整 Token
// - 默认不自动注册，需要你在页面/入口中显式调用 registerDemoShadowFollowExtension()，以便随时启用/禁用
//
// 用法（任一组件/入口处调用）：
//   import { registerDemoShadowFollowExtension } from '@/features/themes/extensions/demoShadowFollow'
//   let dispose = null
//   onMounted(async () => { dispose = await registerDemoShadowFollowExtension() })
//   onBeforeUnmount(() => { dispose?.() })
//
// 依赖：
// - ThemeManager（扩展注册/广播）
// - ThemeStore（令牌写入与持久化）
//
// 行为：
// - 根据外观面板快照中 cardRadius（卡片圆角）与 threadedMsgBgOpacityPct（卡片背景不透明度）的组合，
//   动态设置 --st-shadow-md 这枚 Token（中等阴影强度），示例化展示"外观快照 → 主题 Token"的联动。
// - 仅用于演示，实际项目可换成你自己的逻辑（例如根据 chatWidth/line-height 等派生其它视觉 Token）。
//
// 安全：
// - 扩展仅操作样式 Token，不读取业务数据，不改业务逻辑。
// - 不执行外部脚本，不发起网络请求，默认安全。

import ThemeManager from '@/features/themes/manager'

// Type for appearance snapshot (minimal interface)
interface AppearanceSnapshot {
  cardRadius?: number | null
  threadedMsgBgOpacityPct?: number | null
  [key: string]: any
}

/**
 * 基于 Appearance 快照推导出一个阴影强度 Token 值（纯示例）。
 * @param cardRadiusPx  卡片圆角 px（可能为 null 表示"默认"）
 * @param msgOpacityPct 楼层消息背景不透明度（百分比 0~100）
 * @returns CSS 阴影文本
 */
function deriveShadowMedium(cardRadiusPx: number | null | undefined, msgOpacityPct: number | null | undefined): string {
  const r = (typeof cardRadiusPx === 'number' && Number.isFinite(cardRadiusPx)) ? cardRadiusPx : 12
  const o = (typeof msgOpacityPct === 'number' && Number.isFinite(msgOpacityPct)) ? msgOpacityPct : 80

  // 基于圆角与不透明度推一个主观的视觉强度
  // 圆角越大 → 阴影距离/半径略大；不透明度越大 → 阴影透明度略低（更轻）
  const baseBlur = r >= 16 ? 40 : (r >= 12 ? 32 : 24)
  const spread = Math.max(0, Math.round((r - 10) / 2))
  // 将 0~100 的不透明度换算到 0.12~0.28 的阴影透明度区间（示例数字）
  const alpha = 0.28 - (Math.min(100, Math.max(0, o)) / 100) * 0.16

  return `0 12px ${baseBlur}px rgba(0,0,0,${alpha.toFixed(2)})${spread ? `, 0 0 0 ${spread}px rgba(0,0,0,0.02)` : ''}`
}

/**
 * 注册"圆角跟随阴影"示例扩展。
 * - 返回一个 dispose 函数，用于在组件卸载或不再需要时取消注册。
 */
export async function registerDemoShadowFollowExtension(): Promise<() => void> {
  const dispose = ThemeManager.registerExtension({
    id: 'st.ext.demo.shadow-follow',
    enabled: true,
    scopes: ['chat-threaded', 'settings-view'],
    /**
     * Appearance 快照广播回调（由外观组合式周期触发）
     */
    applyAppearance(snapshot: AppearanceSnapshot): void {
      try {
        const cssShadow = deriveShadowMedium(snapshot.cardRadius, snapshot.threadedMsgBgOpacityPct)
        // 使用 ThemeStore.setToken 做"主题级"覆盖（可持久化到当前主题包）
        ThemeManager?.store?.setToken?.('--st-shadow-md', cssShadow, { persist: true })
      } catch (e) {
        // 保守降级：避免打断其它扩展
        console.warn('[st.ext.demo.shadow-follow] failed to set token:', e)
      }
    },
  })
  return dispose
}

export default registerDemoShadowFollowExtension