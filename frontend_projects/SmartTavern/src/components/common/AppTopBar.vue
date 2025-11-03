<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import ModeSwitch from '@/components/common/ModeSwitch.vue'
import ThemeSwitch from '@/components/common/ThemeSwitch.vue'

const props = defineProps({
  view: { type: String, default: 'start' },
  showSidebar: { type: Boolean, default: false },
  theme: { type: String, default: 'system' }
})
const emit = defineEmits(['update:view','update:theme'])

const condensed = ref(false)

function onScroll() {
  const y = window.scrollY || document.documentElement.scrollTop || 0
  condensed.value = y > 8
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
  window.lucide?.createIcons?.()
  if (typeof window.initFlowbite === 'function') { try { window.initFlowbite() } catch (_) {} }
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

function setView(v){ emit('update:view', v) }
function setTheme(t){ emit('update:theme', t) }

const viewMap = { threaded:'对话楼层', sandbox:'全局沙盒', start:'开始' }
function viewTitle(){ return viewMap[props.view] || 'SmartTavern' }
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
 padding: 10px 16px;
 border-radius: var(--st-radius-lg);
 backdrop-filter: saturate(140%) blur(10px);
 -webkit-backdrop-filter: saturate(140%) blur(10px);
 background: transparent;
 border: 0;
 box-shadow: none;
 margin: 8px 8px 0;
 transition: padding .22s cubic-bezier(.22,.61,.36,1), box-shadow .22s cubic-bezier(.22,.61,.36,1), background .22s ease, border-color .22s ease;
}
.st-topbar.condensed{
  padding: 6px 14px;
  box-shadow: none;
}
.tb-left, .tb-center, .tb-right { display:flex; align-items:center; }
.tb-left { justify-content:flex-start; min-width:0; }
.tb-center { justify-content:center; }
.tb-right { justify-content:flex-end; gap:8px; }
.brand{
 appearance:none; background:transparent; border:0; color: rgb(var(--st-color-text));
 display:inline-flex; align-items:center; gap:10px; cursor:pointer; padding:6px 8px; border-radius: var(--st-radius-md);
 transition: background .18s cubic-bezier(.22,.61,.36,1), transform .18s cubic-bezier(.22,.61,.36,1);
}
.brand:hover{ background: rgba(var(--st-surface-2),0.6); transform: translateY(-1px); }
.logo{
 width: 28px; height: 28px; border-radius: var(--st-radius-lg);
 display:inline-flex; align-items:center; justify-content:center;
 background: linear-gradient(135deg, rgba(var(--st-primary),1), rgba(var(--st-accent),1));
 color: #fff; font-weight: 800;
}
.brand-name{ font-weight: 700; letter-spacing: .2px; }
.divider{ opacity: .35; }
.view-title{ font-weight: 600; opacity: .85; }
.mode-switch { margin-left: 8px; }
.actions { display:inline-flex; align-items:center; gap: 8px; }
.icon-btn{
 appearance:none; background: transparent; border: 1px solid rgba(var(--st-border),0.9);
 color: rgba(var(--st-color-text),0.7);
 width: 32px; height: 32px; border-radius: var(--st-radius-md);
 display:inline-flex; align-items:center; justify-content:center; cursor:pointer;
 transition: all .18s cubic-bezier(.22,.61,.36,1);
}
.icon-btn:hover{ background: rgba(var(--st-surface-2),0.9); color: rgba(var(--st-color-text),0.95); transform: translateY(-1px); }
.icon-16 { width: 16px; height: 16px; stroke: currentColor; }
.sr-only{ position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.tb-hairline{ display:none; }
.tb-tooltip {
  position: absolute; z-index: 50; visibility: hidden; opacity: 0;
  padding: 6px 8px; font-size: 12px;
  color: #fff; background: rgba(0,0,0,0.9);
  border-radius: 8px; box-shadow: 0 6px 14px rgba(0,0,0,0.25);
}

.brand:focus-visible,
.icon-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--st-primary), 0.14);
  border-color: rgba(var(--st-primary), 0.6);
}
@media (max-width: 640px) {
  .brand-name, .divider, .view-title { display: none; }
  .st-topbar { grid-template-columns: auto 1fr auto; }
}
</style>