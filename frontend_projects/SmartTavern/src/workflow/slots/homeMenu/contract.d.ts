// SmartTavern Workflow - HomeMenu Slot Contract (v1, minimal)
// 说明：仅作用于“开始页（home-menu）按钮”的数据契约与上下文类型定义。
// 使用场景：为 JS 项目中的注册表/渲染器提供类型提示（IDE 友好），不增加运行时代码体积。

/** 运行时上下文（用于 visibleWhen/disabledWhen 之类的条件计算） */
export interface HomeMenuContext {
  // 预留字段：后续可扩展（如：当前主题、是否有存档、用户权限等）
  [key: string]: unknown;
}

/** HomeMenu 按钮点击时的标准动作标识与参数 */
export type HomeMenuActionId =
  | 'ui.home.newGame'
  | 'ui.home.openLoad'
  | 'ui.home.openGallery'
  | 'ui.home.openOptions'
  | (string & {}); // 允许插件自定义 actionId

/** HomeMenu 按钮条目的最小数据契约 */
export interface HomeMenuButton {
  /** 唯一标识 */
  id: string;
  /** 按钮文案 */
  label: string;
  /** lucide 图标名（如：'swords' | 'history' | 'image' | 'settings'） */
  icon?: string;
  /** 排序（数字越小越靠前） */
  order?: number;
  /** 点击后派发的动作标识 */
  actionId: HomeMenuActionId;
  /** 可选参数，随 emit(actionId, params) 一起派发 */
  params?: unknown;
  /** 提示文本（可选，UI 层决定是否展示） */
  tooltip?: string;

  /** 是否可见：布尔值或根据上下文计算 */
  visibleWhen?: boolean | ((ctx: HomeMenuContext) => boolean);
  /** 是否禁用：布尔值或根据上下文计算 */
  disabledWhen?: boolean | ((ctx: HomeMenuContext) => boolean);
}

/** HomeMenu 注册表对外能力（Host 或 Slot State 代理） */
export interface HomeMenuRegistry {
  /** 注册一个按钮（同 id 则更新），返回撤销函数 */
  register(entry: HomeMenuButton): () => void;
  /** 取消注册 */
  unregister(id: string): void;
  /**
   * 获取已排序/过滤（可见性计算后）的按钮快照
   * - ctx：上下文（用于 visible/disabled 计算）
   */
  list(ctx?: HomeMenuContext): Array<HomeMenuButton & { visible?: boolean; disabled?: boolean }>;
}