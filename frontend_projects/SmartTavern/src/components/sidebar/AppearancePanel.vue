<script setup>
import { ref, computed, onMounted } from 'vue'
import ThreadedAppearanceTab from '@/components/sidebar/tabs/ThreadedAppearance.vue'
import SandboxAppearanceTab from '@/components/sidebar/tabs/SandboxAppearance.vue'
import BackgroundsManagerTab from '@/components/sidebar/tabs/BackgroundsManager.vue'
import ThemeManagerTab from '@/components/sidebar/tabs/ThemeManager.vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

/**
 * 外观面板（容器）
 * - 仅负责：面板定位/尺寸、页签切换、容器样式与动画
 * - 具体配置 UI 与逻辑已拆分到各 Tab 组件：
 *    - 楼层对话：ThreadedAppearanceTab
 *    - 全屏沙盒：SandboxAppearanceTab
 *    - 背景图片：BackgroundsManagerTab
 *    - 主题管理：ThemeManagerTab
 */

const props = defineProps({
  anchorLeft: { type: Number, default: 308 }, // 左侧锚定像素（默认=12+280+16）
  width: { type: Number, default: 560 },      // 面板宽度
  zIndex: { type: Number, default: 59 },      // 与 Sidebar 同层（> 背景模糊 58）
})
const emit = defineEmits(['close'])

const tabs = computed(() => [
  { key: 'home', label: t('appearance.tabs.home'), icon: 'home' },
  { key: 'threaded', label: t('appearance.tabs.threaded'), icon: 'message-square' },
  { key: 'sandbox', label: t('appearance.tabs.sandbox'), icon: 'monitor' },
  { key: 'backgrounds', label: t('appearance.tabs.backgrounds'), icon: 'image' },
  { key: 'theme', label: t('appearance.tabs.theme'), icon: 'palette' },
])
const active = ref('threaded')

const panelStyle = computed(() => ({
  position: 'fixed',
  left: props.anchorLeft + 'px',
  top: '64px',
  bottom: '12px',
  width: props.width + 'px',
  zIndex: String(props.zIndex),
}))

function close() { emit('close') }

onMounted(() => {
  // 初始化 lucide 图标
  try { window.lucide?.createIcons?.() } catch (_) {}
})
</script>

<template>
  <transition name="st-settings">
    <div
      data-scope="settings-view"
      class="st-settings glass"
      :style="panelStyle"
    >
      <header class="st-settings-header">
        <div class="st-settings-title st-panel-title">
          <span class="st-settings-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                 data-lucide="palette" class="lucide lucide-palette">
              <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"></path>
              <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
              <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
              <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
              <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
            </svg>
          </span>
          {{ t('appearance.title') }}
        </div>
        <button class="st-settings-close" type="button" :title="t('common.close')" @click="close">✕</button>
      </header>

      <nav class="st-settings-tabs" role="tablist" :aria-label="t('appearance.title')">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="st-tab"
          :class="{ active: active === t.key }"
          role="tab"
          :aria-selected="active === t.key"
          :tabindex="active === t.key ? 0 : -1"
          @click="active = t.key"
        >
          <i v-if="t.icon" :data-lucide="t.icon"></i>
          <span class="st-tab-label">{{ t.label }}</span>
        </button>
      </nav>

      <CustomScrollbar2 class="st-settings-body">
        <div v-if="active === 'home'" class="st-tab-panel">
          <h3>{{ t('appearance.tabs.home') }}</h3>
          <p class="muted">{{ t('appearance.placeholder') }}</p>
        </div>

        <ThreadedAppearanceTab v-else-if="active === 'threaded'" />

        <SandboxAppearanceTab v-else-if="active === 'sandbox'" />

        <BackgroundsManagerTab v-else-if="active === 'backgrounds'" />

        <ThemeManagerTab v-else-if="active === 'theme'" />

        <div v-else class="st-tab-panel">
          <h3>{{ t('appearance.unknownTab') }}</h3>
          <p class="muted">{{ t('appearance.placeholderContent') }}</p>
        </div>
      </CustomScrollbar2>
    </div>
  </transition>
</template>

<style>
/* Global range slider styles for AppearancePanel (non-scoped for pseudo-element support) */
/* Scope limited to [data-scope="settings-view"] */

[data-scope="settings-view"] .st-control input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  width: 100%;
}

/* ═══════════════════════════════════════════════════════════════
   PREMIUM SLIDER DESIGN - 高级滑条设计
   设计理念：玻璃拟态 + 精致金属质感 + 柔和光影
   ═══════════════════════════════════════════════════════════════ */

/* LIGHT THEME: 不透明实色轨道 */
[data-scope="settings-view"] .st-control input[type="range"]::-webkit-slider-runnable-track {
  height: 8px !important;
  border-radius: 4px !important;
  /* 浅灰色实色背景 */
  background: linear-gradient(180deg,
    #d8dce5 0%,
    #e2e6ee 50%,
    #d0d5e0 100%
  ) !important;
  border: 1px solid #c0c8d5 !important;
  box-shadow:
    inset 0 1px 3px rgba(0, 0, 0, 0.1),
    inset 0 -1px 1px rgba(255, 255, 255, 0.6),
    0 1px 0 rgba(255, 255, 255, 0.4) !important;
}
[data-scope="settings-view"] .st-control input[type="range"]::-moz-range-track {
  height: 8px !important;
  border-radius: 4px !important;
  background: linear-gradient(180deg,
    #d8dce5 0%,
    #e2e6ee 50%,
    #d0d5e0 100%
  ) !important;
  border: 1px solid #c0c8d5 !important;
  box-shadow:
    inset 0 1px 3px rgba(0, 0, 0, 0.1),
    inset 0 -1px 1px rgba(255, 255, 255, 0.6),
    0 1px 0 rgba(255, 255, 255, 0.4) !important;
}

/* LIGHT THEME: 中灰色金属质感圆形滑块（柔和反色） */
[data-scope="settings-view"] .st-control input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  /* 中灰色金属渐变：柔和但凸显 */
  background: linear-gradient(145deg,
    #7a8090 0%,
    #6a7080 25%,
    #5a6070 50%,
    #4a5565 60%,
    #40485a 100%
  ) !important;
  border: 1px solid rgba(60, 70, 90, 0.5) !important;
  box-shadow:
    /* 外层亮边 */
    0 0 0 1px rgba(255, 255, 255, 0.2),
    /* 主阴影 */
    0 2px 6px rgba(0, 0, 0, 0.2),
    0 4px 12px rgba(0, 0, 0, 0.15),
    /* 内部高光 */
    inset 0 2px 4px rgba(255, 255, 255, 0.25),
    inset 0 -2px 4px rgba(0, 0, 0, 0.2) !important;
  margin-top: -7px;
  cursor: pointer;
  transition:
    transform .25s cubic-bezier(.22,.61,.36,1),
    box-shadow .25s cubic-bezier(.22,.61,.36,1),
    background .25s ease;
}
[data-scope="settings-view"] .st-control input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(145deg,
    #7a8090 0%,
    #6a7080 25%,
    #5a6070 50%,
    #4a5565 60%,
    #40485a 100%
  ) !important;
  border: 1px solid rgba(60, 70, 90, 0.5) !important;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.2),
    0 2px 6px rgba(0, 0, 0, 0.2),
    0 4px 12px rgba(0, 0, 0, 0.15),
    inset 0 2px 4px rgba(255, 255, 255, 0.25),
    inset 0 -2px 4px rgba(0, 0, 0, 0.2) !important;
  cursor: pointer;
  transition:
    transform .25s cubic-bezier(.22,.61,.36,1),
    box-shadow .25s cubic-bezier(.22,.61,.36,1),
    background .25s ease;
}

/* DARK THEME: 不透明实色轨道 */
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]::-webkit-slider-runnable-track {
  /* 深灰色实色背景 */
  background: linear-gradient(180deg,
    #35393f 0%,
    #3d4148 50%,
    #30343a 100%
  ) !important;
  border: 1px solid #484e58 !important;
  box-shadow:
    inset 0 1px 3px rgba(0, 0, 0, 0.25),
    inset 0 -1px 1px rgba(255, 255, 255, 0.05),
    0 1px 0 rgba(0, 0, 0, 0.15) !important;
}
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]::-moz-range-track {
  background: linear-gradient(180deg,
    #35393f 0%,
    #3d4148 50%,
    #30343a 100%
  ) !important;
  border: 1px solid #484e58 !important;
  box-shadow:
    inset 0 1px 3px rgba(0, 0, 0, 0.25),
    inset 0 -1px 1px rgba(255, 255, 255, 0.05),
    0 1px 0 rgba(0, 0, 0, 0.15) !important;
}

/* DARK THEME: 浅灰色金属质感圆形滑块（柔和反色） */
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]::-webkit-slider-thumb {
  /* 浅灰色金属渐变：柔和但凸显 */
  background: linear-gradient(145deg,
    #c8d0dc 0%,
    #b8c2d0 25%,
    #a8b4c4 50%,
    #9aa8ba 75%,
    #8c9cb0 100%
  ) !important;
  border: 1px solid rgba(200, 210, 225, 0.5) !important;
  box-shadow:
    /* 外层光晕 */
    0 0 0 1px rgba(255, 255, 255, 0.15),
    /* 主阴影 */
    0 2px 6px rgba(0, 0, 0, 0.35),
    0 4px 12px rgba(0, 0, 0, 0.25),
    /* 内部高光 */
    inset 0 2px 4px rgba(255, 255, 255, 0.5),
    inset 0 -2px 4px rgba(0, 0, 0, 0.15) !important;
}
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]::-moz-range-thumb {
  background: linear-gradient(145deg,
    #c8d0dc 0%,
    #b8c2d0 25%,
    #a8b4c4 50%,
    #9aa8ba 75%,
    #8c9cb0 100%
  ) !important;
  border: 1px solid rgba(200, 210, 225, 0.5) !important;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.15),
    0 2px 6px rgba(0, 0, 0, 0.35),
    0 4px 12px rgba(0, 0, 0, 0.25),
    inset 0 2px 4px rgba(255, 255, 255, 0.5),
    inset 0 -2px 4px rgba(0, 0, 0, 0.15) !important;
}

/* ═══════════════════════════════════════════════════════════════
   HOVER STATES - 悬停状态
   ═══════════════════════════════════════════════════════════════ */

/* Hover state - 浅色主题：中灰滑块发光效果 */
[data-scope="settings-view"] .st-control input[type="range"]:hover::-webkit-slider-thumb,
[data-scope="settings-view"] .st-control input[type="range"]:hover::-moz-range-thumb {
  transform: scale(1.12) translateY(-1px);
  background: linear-gradient(145deg,
    #8a90a0 0%,
    #7a8090 25%,
    #6a7080 50%,
    #5a6575 75%,
    #4a5565 100%
  ) !important;
  box-shadow:
    /* 外层发光 */
    0 0 0 3px rgba(var(--st-primary), 0.18),
    0 0 12px rgba(var(--st-primary), 0.15),
    /* 主阴影增强 */
    0 4px 10px rgba(0, 0, 0, 0.25),
    0 8px 20px rgba(0, 0, 0, 0.18),
    /* 内部高光增强 */
    inset 0 2px 6px rgba(255, 255, 255, 0.35),
    inset 0 -2px 4px rgba(0, 0, 0, 0.25) !important;
}

/* Hover state - 暗色主题：浅灰滑块发光效果 */
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]:hover::-webkit-slider-thumb,
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]:hover::-moz-range-thumb {
  transform: scale(1.12) translateY(-1px);
  background: linear-gradient(145deg,
    #d8e0ec 0%,
    #c8d2e0 25%,
    #b8c4d4 50%,
    #a8b8ca 75%,
    #9aacbe 100%
  ) !important;
  box-shadow:
    /* 外层发光 */
    0 0 0 3px rgba(var(--st-accent), 0.2),
    0 0 15px rgba(var(--st-accent), 0.18),
    /* 主阴影增强 */
    0 4px 10px rgba(0, 0, 0, 0.38),
    0 8px 20px rgba(0, 0, 0, 0.28),
    /* 内部高光增强 */
    inset 0 2px 6px rgba(255, 255, 255, 0.6),
    inset 0 -2px 4px rgba(0, 0, 0, 0.15) !important;
}

/* ═══════════════════════════════════════════════════════════════
   ACTIVE STATES - 激活/拖拽状态
   ═══════════════════════════════════════════════════════════════ */

/* Active state - 浅色主题：中灰滑块按压效果 */
[data-scope="settings-view"] .st-control input[type="range"]:active::-webkit-slider-thumb,
[data-scope="settings-view"] .st-control input[type="range"]:active::-moz-range-thumb {
  transform: scale(1.05);
  background: linear-gradient(145deg,
    #6a7080 0%,
    #5a6070 25%,
    #4a5565 50%,
    #40485a 75%,
    #363e50 100%
  ) !important;
  box-shadow:
    0 0 0 3px rgba(var(--st-primary), 0.22),
    0 2px 4px rgba(0, 0, 0, 0.25),
    0 4px 8px rgba(0, 0, 0, 0.18),
    inset 0 1px 3px rgba(255, 255, 255, 0.2),
    inset 0 -1px 2px rgba(0, 0, 0, 0.3) !important;
}

/* Active state - 暗色主题：浅灰滑块按压效果 */
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]:active::-webkit-slider-thumb,
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]:active::-moz-range-thumb {
  transform: scale(1.05);
  background: linear-gradient(145deg,
    #b8c2d0 0%,
    #a8b4c4 25%,
    #9aa8ba 50%,
    #8c9cb0 75%,
    #7e90a5 100%
  ) !important;
  box-shadow:
    0 0 0 3px rgba(var(--st-accent), 0.25),
    0 2px 4px rgba(0, 0, 0, 0.32),
    0 4px 8px rgba(0, 0, 0, 0.22),
    inset 0 1px 3px rgba(255, 255, 255, 0.45),
    inset 0 -1px 2px rgba(0, 0, 0, 0.12) !important;
}

/* ═══════════════════════════════════════════════════════════════
   FOCUS STATES - 聚焦状态（键盘导航）
   ═══════════════════════════════════════════════════════════════ */

/* Focus state - 浅色主题：中灰滑块聚焦 */
[data-scope="settings-view"] .st-control input[type="range"]:focus::-webkit-slider-thumb,
[data-scope="settings-view"] .st-control input[type="range"]:focus::-moz-range-thumb {
  box-shadow:
    0 0 0 4px rgba(var(--st-primary), 0.25),
    0 0 15px rgba(var(--st-primary), 0.2),
    0 2px 6px rgba(0, 0, 0, 0.22),
    0 4px 12px rgba(0, 0, 0, 0.18),
    inset 0 2px 4px rgba(255, 255, 255, 0.28),
    inset 0 -2px 4px rgba(0, 0, 0, 0.22) !important;
}

/* Focus state - 暗色主题：浅灰滑块聚焦 */
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]:focus::-webkit-slider-thumb,
[data-theme="dark"] [data-scope="settings-view"] .st-control input[type="range"]:focus::-moz-range-thumb {
  box-shadow:
    0 0 0 4px rgba(var(--st-accent), 0.28),
    0 0 15px rgba(var(--st-accent), 0.22),
    0 2px 6px rgba(0, 0, 0, 0.38),
    0 4px 12px rgba(0, 0, 0, 0.28),
    inset 0 2px 4px rgba(255, 255, 255, 0.55),
    inset 0 -2px 4px rgba(0, 0, 0, 0.15) !important;
}

/* =========================
   Live Tuning (实时预览聚焦态)
   触发：Threaded/Sandbox 外观 Tab 在滑条 pointerdown 时
   行为：
   - 隐藏侧边栏及所有悬浮 UI，仅保留外观面板中的“当前滑条”控件
   - 背板/模态/浮标均不干扰页面预览
   - 通过 body[data-active-slider] 与 .st-control[data-slider] 对应
   ========================= */

/* 隐藏侧边栏/背板/顶部条/模态等悬浮 UI（不影响主内容预览）
   背板需彻底 display:none，否则即使透明仍可能产生叠层或混合效果 */
body.st-live-tuning [data-scope="sidebar"],
body.st-live-tuning .sd-backdrop,
body.st-live-tuning .sd-fab,
body.st-live-tuning .st-panel-backdrop,
body.st-live-tuning [data-scope="topbar"],
body.st-live-tuning .modal-overlay {
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
  display: none !important;
}

/* 外观面板内部：隐藏标题、页签与非控件内容，仅保留控件区
   注意：仅隐藏 Tab 面板的非控件子节点，保留容器结构，避免把控件祖先一并隐藏 */
/* 保留占位但不可见，避免高度塌陷导致滑条上移 */
body.st-live-tuning [data-scope="settings-view"] .st-settings-header,
body.st-live-tuning [data-scope="settings-view"] .st-settings-tabs {
  visibility: hidden !important;
  pointer-events: none !important;
}
/* 只隐藏面板内 .st-tab-panel 的非 .st-control 子节点（不影响控件本身） */
/* 只隐藏视觉但保留空间，确保当前滑条“保持原位置” */
body.st-live-tuning [data-scope="settings-view"] .st-settings-body .st-tab-panel > :not(.st-control) {
  visibility: hidden !important;
  pointer-events: none !important;
}
/* 控件内部的提示说明隐藏（只保留左侧文字/数值/滑条本体） */
body.st-live-tuning [data-scope="settings-view"] .st-control .st-control-hint {
  display: none !important;
}
/* 实时预览时，让面板容器透明化，避免遮挡视觉；仍保留控件互动 */
body.st-live-tuning [data-scope="settings-view"].st-settings {
  background: transparent !important;
  border: 0 !important;
  border-color: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

/* 默认隐藏所有控件，仅展示当前激活的那一个（隐藏但保留原本占位） */
body.st-live-tuning [data-scope="settings-view"] .st-control {
  visibility: hidden !important;
  pointer-events: none !important;
}

/* 展示与 body[data-active-slider] 对应的控件（左侧文字 + 右侧数值 + 滑条） */
/* 激活项：恢复可见性与交互（保留原 display:grid 来自 scoped 样式） */
body[data-active-slider="contentFontSize"]        [data-scope="settings-view"] .st-control[data-slider="contentFontSize"],
body[data-active-slider="nameFontSize"]           [data-scope="settings-view"] .st-control[data-slider="nameFontSize"],
body[data-active-slider="badgeFontSize"]          [data-scope="settings-view"] .st-control[data-slider="badgeFontSize"],
body[data-active-slider="floorFontSize"]          [data-scope="settings-view"] .st-control[data-slider="floorFontSize"],
body[data-active-slider="avatarSize"]             [data-scope="settings-view"] .st-control[data-slider="avatarSize"],
body[data-active-slider="chatWidth"]              [data-scope="settings-view"] .st-control[data-slider="chatWidth"],
body[data-active-slider="inputHeight"]            [data-scope="settings-view"] .st-control[data-slider="inputHeight"],
body[data-active-slider="inputBottomMargin"]      [data-scope="settings-view"] .st-control[data-slider="inputBottomMargin"],
body[data-active-slider="contentLineHeight"]      [data-scope="settings-view"] .st-control[data-slider="contentLineHeight"],
body[data-active-slider="messageGap"]             [data-scope="settings-view"] .st-control[data-slider="messageGap"],
body[data-active-slider="cardRadius"]             [data-scope="settings-view"] .st-control[data-slider="cardRadius"],
body[data-active-slider="stripeWidth"]            [data-scope="settings-view"] .st-control[data-slider="stripeWidth"],
body[data-active-slider="threadedBgOpacity"]      [data-scope="settings-view"] .st-control[data-slider="threadedBgOpacity"],
body[data-active-slider="threadedBgBlur"]         [data-scope="settings-view"] .st-control[data-slider="threadedBgBlur"],
body[data-active-slider="threadedMsgBgOpacity"]   [data-scope="settings-view"] .st-control[data-slider="threadedMsgBgOpacity"],
body[data-active-slider="threadedListBgOpacity"]  [data-scope="settings-view"] .st-control[data-slider="threadedListBgOpacity"],
body[data-active-slider="threadedInputBgOpacity"] [data-scope="settings-view"] .st-control[data-slider="threadedInputBgOpacity"],
body[data-active-slider="threadedStageAspect"]    [data-scope="settings-view"] .st-control[data-slider="threadedStageAspect"],
body[data-active-slider="threadedStageMaxWidthPct"] [data-scope="settings-view"] .st-control[data-slider="threadedStageMaxWidthPct"],
body[data-active-slider="threadedStagePadding"]   [data-scope="settings-view"] .st-control[data-slider="threadedStagePadding"],
body[data-active-slider="threadedStageRadius"]    [data-scope="settings-view"] .st-control[data-slider="threadedStageRadius"],
body[data-active-slider="sandboxAspect"]          [data-scope="settings-view"] .st-control[data-slider="sandboxAspect"],
body[data-active-slider="sandboxMaxWidth"]        [data-scope="settings-view"] .st-control[data-slider="sandboxMaxWidth"],
body[data-active-slider="sandboxPadding"]         [data-scope="settings-view"] .st-control[data-slider="sandboxPadding"],
body[data-active-slider="sandboxRadius"]          [data-scope="settings-view"] .st-control[data-slider="sandboxRadius"],
body[data-active-slider="sandboxBgOpacity"]       [data-scope="settings-view"] .st-control[data-slider="sandboxBgOpacity"],
body[data-active-slider="sandboxBgBlur"]          [data-scope="settings-view"] .st-control[data-slider="sandboxBgBlur"],
body[data-active-slider="sandboxStageBgOpacity"]  [data-scope="settings-view"] .st-control[data-slider="sandboxStageBgOpacity"] {
  display: grid !important;
  visibility: visible !important;
  pointer-events: auto !important;
}

/* 高亮当前控件，便于辨识 */
body.st-live-tuning [data-scope="settings-view"] .st-control[data-slider] {
  background: rgba(var(--st-surface), 0.85) !important;
  border-color: rgba(var(--st-primary), 0.45) !important;
  box-shadow: 0 6px 18px rgba(0,0,0,0.12), 0 0 0 4px rgba(var(--st-primary), 0.06);
}

/* 隐藏外观面板右侧自定义滚动条（轨道与滑块），避免干扰预览 */
body.st-live-tuning [data-scope="settings-view"] .custom-scrollbar-wrapper .scroll-track,
body.st-live-tuning [data-scope="settings-view"] .custom-scrollbar2-wrapper .scroll-track2 {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
</style>

<style scoped>
.st-settings {
  display: grid;
  grid-template-rows: auto auto 1fr;
  border-radius: var(--st-radius-lg);
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface));
  backdrop-filter: blur(8px) saturate(130%);
  -webkit-backdrop-filter: blur(8px) saturate(130%);
  box-shadow: var(--st-shadow-md);
  overflow: hidden;
}

/* Header */
.st-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(var(--st-border), 0.85);
}
.st-settings-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: rgb(var(--st-color-text));
}
.st-settings-icon i,
.st-settings-icon svg { width: 24px; height: 24px; display: inline-block; }
.st-settings-close {
  appearance: none;
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface-2));
  border-radius: 4px;
  padding: 6px 8px;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.22,.61,.36,1), background .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
.st-settings-close:hover {
  background: rgb(var(--st-surface));
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

/* Tabs */
.st-settings-tabs {
  display: flex;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(var(--st-border), 0.85);
  background: rgba(var(--st-surface), 0.65);
  border-top-left-radius: var(--st-radius-lg);
  border-top-right-radius: var(--st-radius-lg);
  box-shadow: inset 0 -1px 0 rgba(0,0,0,0.02);
}
.st-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 9999px;
  border: 1px solid rgb(var(--st-border));
  background: rgb(var(--st-surface));
  color: rgb(var(--st-color-text));
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  transition: background .2s cubic-bezier(.22,.61,.36,1),
              border-color .2s cubic-bezier(.22,.61,.36,1),
              transform .2s cubic-bezier(.22,.61,.36,1),
              box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
.st-tab i { width: 14px; height: 14px; display: inline-block; }
.st-tab-label { font-weight: 600; letter-spacing: 0.2px; }
.st-tab:focus-visible {
  outline: 2px solid rgba(var(--st-primary), 0.6);
  outline-offset: 2px;
}
.st-tab:hover { transform: translateY(-1px); }
.st-tab.active {
  background: rgba(var(--st-primary), 0.14);
  border-color: rgba(var(--st-primary), 0.45);
  box-shadow: 0 1px 0 rgba(0,0,0,0.02);
  transform: translateY(-1px);
}

/* Body */
.st-settings-body {
  padding: 12px;
  overflow: hidden;
}
.st-tab-panel h3 { margin: 0 0 6px; font-weight: 700; }
.st-tab-panel .muted { color: rgba(var(--st-color-text), 0.75); margin: 0; }
</style>