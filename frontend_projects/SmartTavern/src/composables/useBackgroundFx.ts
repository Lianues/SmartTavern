/**
 * 背景动画组合式：景深过渡 + 焦点位移（Home / Threaded / Sandbox）
 *
 * 从 App.vue 中抽离以下方法：
 * - playHomeBgFX()
 * - playThreadedBgFX()
 * - playSandboxBgFX()
 *
 * 使用方式（父组件）：
 *   import { useBackgroundFx } from '@/composables/useBackgroundFx'
 *   const { playHomeBgFX, playThreadedBgFX, playSandboxBgFX, stopBgFX } = useBackgroundFx()
 *   // 根据视图切换触发上述方法
 */

export interface BackgroundFxAPI {
  playHomeBgFX: () => void
  playThreadedBgFX: () => void
  playSandboxBgFX: () => void
  stopBgFX: () => void
}

export function useBackgroundFx(): BackgroundFxAPI {
  let __bgFxTimer: ReturnType<typeof setTimeout> | null = null

  function __triggerBgAnim(bodyClass: string): void {
    const docEl = document.documentElement
    const target = document.body

    // 随机焦点位移（细微偏移，营造镜头对焦感）
    const rx = ((Math.random() * 2) - 1) * 14 // -14 ~ 14 px
    const ry = ((Math.random() * 2) - 1) * 10 // -10 ~ 10 px
    docEl.style.setProperty('--fx-shift-x', rx.toFixed(1) + 'px')
    docEl.style.setProperty('--fx-shift-y', ry.toFixed(1) + 'px')

    // 移除所有动画类，重新触发
    target.classList.remove('st-bg-anim', 'st-bg-anim-threaded', 'st-bg-anim-sandbox')
    // 强制重排以重触发动画
    void target.offsetWidth
    target.classList.add(bodyClass)

    if (__bgFxTimer !== null) {
      clearTimeout(__bgFxTimer)
    }
    // 总时长 4s：前 3s 焦点位移 + 模糊减弱，最后 1s 仅清晰过渡
    __bgFxTimer = setTimeout(() => {
      target.classList.remove(bodyClass)
      docEl.style.removeProperty('--fx-shift-x')
      docEl.style.removeProperty('--fx-shift-y')
      __bgFxTimer = null
    }, 4100)
  }

  function playHomeBgFX(): void      { __triggerBgAnim('st-bg-anim') }
  function playThreadedBgFX(): void  { __triggerBgAnim('st-bg-anim-threaded') }
  function playSandboxBgFX(): void   { __triggerBgAnim('st-bg-anim-sandbox') }

  function stopBgFX(): void {
    // 主动停止：移除类名与变量
    const docEl = document.documentElement
    const target = document.body
    if (__bgFxTimer !== null) {
      clearTimeout(__bgFxTimer)
    }
    __bgFxTimer = null
    target.classList.remove('st-bg-anim', 'st-bg-anim-threaded', 'st-bg-anim-sandbox')
    docEl.style.removeProperty('--fx-shift-x')
    docEl.style.removeProperty('--fx-shift-y')
  }

  return {
    playHomeBgFX,
    playThreadedBgFX,
    playSandboxBgFX,
    stopBgFX,
  }
}