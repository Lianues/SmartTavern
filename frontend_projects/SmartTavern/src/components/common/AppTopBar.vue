<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import ModeSwitch from '@/components/common/ModeSwitch.vue'
import ThemeSwitch from '@/components/common/ThemeSwitch.vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  view: { type: String, default: 'start' },
  showSidebar: { type: Boolean, default: false },
  theme: { type: String, default: 'system' }
})
const emit = defineEmits(['update:view','update:theme'])

const condensed = ref(false)

function onScroll() {
  const y = window.scrollY || document.documentElement.scrollTop || 0
  condensed.value = y > (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--st-topbar-scroll-threshold')) || 8)
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  window.lucide?.createIcons?.()
  if (typeof window.initFlowbite === 'function') { try { window.initFlowbite() } catch (_) {} }
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

function setView(v){ emit('update:view', v) }
function setTheme(themeValue){ emit('update:theme', themeValue) }

const viewTitle = computed(() => {
  const key = `components.topBar.view${props.view.charAt(0).toUpperCase() + props.view.slice(1)}`
  return t(key) || 'SmartTavern'
})
</script>

<template>
  <header class="st-topbar" :class="{ condensed }" data-scope="topbar">
    <div class="tb-right">
      <div class="actions">
        <ThemeSwitch :theme="theme" @update:theme="setTheme" />
      </div>
    </div>
    <div class="tb-hairline"></div>
  </header>
</template>

<style scoped>
.st-topbar{
 position: sticky; top:0; z-index:10;
 display:grid; grid-template-columns: 1fr;
 align-items:center;
 padding: var(--st-spacing-lg) var(--st-spacing-2xl);
 border-radius: var(--st-radius-lg);
 backdrop-filter: saturate(140%) blur(var(--st-blur-md));
 -webkit-backdrop-filter: saturate(140%) blur(var(--st-blur-md));
 background: transparent;
 border: 0;
 box-shadow: none;
 margin: var(--st-spacing-md) var(--st-spacing-md) 0;
 transition: padding var(--st-transition-normal), box-shadow var(--st-transition-normal), background var(--st-transition-normal), border-color var(--st-transition-normal);
}
.st-topbar.condensed{
  padding: var(--st-spacing-sm) var(--st-spacing-xl);
  box-shadow: none;
}
.tb-left, .tb-center, .tb-right { display:flex; align-items:center; }
.tb-left { justify-content:flex-start; min-width:0; }
.tb-center { justify-content:center; }
.tb-right { justify-content:flex-end; gap: var(--st-gap-sm); }
.brand{
 appearance:none; background:transparent; border:0; color: rgb(var(--st-color-text));
 display:inline-flex; align-items:center; gap: var(--st-spacing-lg); cursor:pointer; padding: var(--st-spacing-sm) var(--st-spacing-md); border-radius: var(--st-radius-md);
 transition: background var(--st-transition-fast), transform var(--st-transition-fast);
}
.brand:hover{ background: rgba(var(--st-surface-2),var(--st-border-alpha-medium)); transform: translateY(var(--st-topbar-hover-lift, -1px)); }
.logo{
 width: var(--st-btn-sm); height: var(--st-btn-sm); border-radius: var(--st-radius-lg);
 display:inline-flex; align-items:center; justify-content:center;
 background: linear-gradient(135deg, rgba(var(--st-primary),1), rgba(var(--st-accent),1));
 color: #fff; font-weight: 800;
}
.brand-name{ font-weight: 700; letter-spacing: .2px; }
.divider{ opacity: .35; }
.view-title{ font-weight: 600; opacity: .85; }
.mode-switch { margin-left: var(--st-spacing-md); }
.actions { display:inline-flex; align-items:center; gap: var(--st-gap-sm); }
.icon-btn{
 appearance:none; background: transparent; border: 1px solid rgba(var(--st-border),var(--st-border-alpha-strong));
 color: rgba(var(--st-color-text),0.7);
 width: var(--st-btn-md); height: var(--st-btn-md); border-radius: var(--st-radius-md);
 display:inline-flex; align-items:center; justify-content:center; cursor:pointer;
 transition: all var(--st-transition-fast);
}
.icon-btn:hover{ background: rgba(var(--st-surface-2),var(--st-border-alpha-strong)); color: rgba(var(--st-color-text),0.95); transform: translateY(var(--st-topbar-hover-lift, -1px)); }
.icon-16 { width: var(--st-icon-md); height: var(--st-icon-md); stroke: currentColor; }
.sr-only{ position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.tb-hairline{ display:none; }
.tb-tooltip {
  position: absolute; z-index: 50; visibility: hidden; opacity: 0;
  padding: var(--st-spacing-sm) var(--st-spacing-md); font-size: var(--st-font-sm);
  color: #fff; background: var(--st-topbar-tooltip-bg, rgba(0,0,0,0.9));
  border-radius: var(--st-radius-md); box-shadow: var(--st-topbar-tooltip-shadow, 0 var(--st-spacing-sm) var(--st-spacing-xl) rgba(0,0,0,0.25));
}

.brand:focus-visible,
.icon-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--st-primary), var(--st-topbar-focus-shadow-alpha, 0.14));
  border-color: rgba(var(--st-primary), var(--st-topbar-focus-border-alpha, 0.6));
}
@media (max-width: 640px) {
  .brand-name, .divider, .view-title { display: none; }
  .st-topbar { grid-template-columns: auto 1fr auto; }
}
</style>