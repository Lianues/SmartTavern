// SmartTavern Workflow - HomeMenu Bootstrap (v1)
// 作用：注册开始页(home-menu)的内置按钮（New / Load / Gallery / Options）
// 注意：仅注册数据与动作标识，点击后由上层监听 actionId 后映射到既有行为。
// 使用 labelKey 而非直接翻译，支持语言切换时动态更新

import Host from '../../core/host'
import type { HomeMenuContext } from './contract'

/**
 * 注册开始页内置按钮
 * 使用 labelKey 存储翻译 key，由渲染组件动态翻译
 * @returns {() => void} disposer - 撤销全部内置按钮
 */
export function registerHomeMenuBuiltins(): () => void {
  const registeredIds: string[] = []

  registeredIds.push(Host.registerHomeButton({
    id: 'home.new',
    label: 'New Game',  // fallback
    labelKey: 'slots.homeMenu.newGame',
    icon: 'swords',
    order: 10,
    actionId: 'ui.home.newGame',
  }))

  registeredIds.push(Host.registerHomeButton({
    id: 'home.load',
    label: 'Load Game',  // fallback
    labelKey: 'slots.homeMenu.loadGame',
    icon: 'history',
    order: 20,
    actionId: 'ui.home.openLoad',
    // 默认显示；当无存档时禁用（由 HomeMenu 上下文提供）
    visibleWhen: true,
    disabledWhen: (ctx: HomeMenuContext) => !ctx?.hasSaves,
  }))

  registeredIds.push(Host.registerHomeButton({
    id: 'home.appearance',
    label: 'Appearance',  // fallback
    labelKey: 'slots.homeMenu.appearance',
    icon: 'palette',
    order: 25,
    actionId: 'ui.home.openAppearance',
  }))

  registeredIds.push(Host.registerHomeButton({
    id: 'home.plugins',
    label: 'Plugins',  // fallback
    labelKey: 'slots.homeMenu.plugins',
    icon: 'puzzle',
    order: 30,
    actionId: 'ui.home.openPlugins',
  }))

  registeredIds.push(Host.registerHomeButton({
    id: 'home.options',
    label: 'Options',  // fallback
    labelKey: 'slots.homeMenu.options',
    icon: 'settings',
    order: 40,
    actionId: 'ui.home.openOptions',
  }))

  // 统一 disposer：撤销全部
  return () => {
    for (const id of registeredIds) {
      try { Host.unregisterHomeButton(id) } catch (_) {}
    }
  }
}

/** 撤销（备用 API） */
export function unregisterHomeMenuBuiltins(): void {
  try { Host.unregisterHomeButton('home.new') } catch (_) {}
  try { Host.unregisterHomeButton('home.load') } catch (_) {}
  try { Host.unregisterHomeButton('home.appearance') } catch (_) {}
  try { Host.unregisterHomeButton('home.plugins') } catch (_) {}
  try { Host.unregisterHomeButton('home.options') } catch (_) {}
}

export default registerHomeMenuBuiltins