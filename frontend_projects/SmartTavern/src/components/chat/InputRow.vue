<template>
  <!-- 输入区（多行文本，玻璃拟态容器 + 工具栏 + Lucide 图标） -->
  <div class="tch-input-row glass">
    <div class="tch-tools-left">
      <button class="tool-btn round" :title="t('chat.input.expand')" :aria-label="t('chat.input.expand')" data-tooltip-target="tt-expand">
        <i data-lucide="plus" class="icon-16" aria-hidden="true"></i>
      </button>
      <div id="tt-expand" role="tooltip" class="absolute z-10 invisible inline-block px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md shadow-sm opacity-0 tooltip">
        {{ t('chat.input.expand') }}
        <div class="tooltip-arrow" data-popper-arrow></div>
      </div>
    </div>

    <textarea
      ref="inputRef"
      v-model="text"
      class="tch-input"
      :placeholder="effectivePlaceholder"
      :disabled="sending"
      @keydown="onKeydown"
    ></textarea>

    <div class="tch-tools-right">
      <button
        class="tch-send"
        :disabled="sending || (pendingActive ? false : !text.trim())"
        @click="pendingActive ? onCancel() : onSubmit()"
        :title="pendingActive ? t('chat.input.stopWaiting') : sendButtonTitle"
        :aria-label="pendingActive ? t('chat.input.stopWaiting') : t('chat.input.send')"
        data-tooltip-target="tt-send"
      >
        <i :data-lucide="sending ? 'loader-circle' : (pendingActive ? 'square' : 'send')" class="icon-16" :class="{'icon-spin': sending}" aria-hidden="true"></i>
        <span class="tch-send-text">{{ sending ? t('chat.input.sending') : (pendingActive ? effectiveStopLabel : effectiveSendLabel) }}</span>
      </button>
      <div id="tt-send" role="tooltip" class="absolute z-10 invisible inline-block px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md shadow-sm opacity-0 tooltip">
        {{ t('chat.input.send') }}
        <div class="tooltip-arrow" data-popper-arrow></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  pendingActive: { type: Boolean, default: false },
  sending: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  sendLabel: { type: String, default: '' },
  stopLabel: { type: String, default: '' }
})

const emit = defineEmits(['submit', 'cancel'])

const inputRef = ref(null)
const text = ref('')

// i18n computed
const effectivePlaceholder = computed(() => props.placeholder || t('chat.input.placeholder'))
const effectiveSendLabel = computed(() => props.sendLabel || t('chat.input.send'))
const effectiveStopLabel = computed(() => props.stopLabel || t('chat.input.stop'))

const sendButtonTitle = computed(() => props.pendingActive ? t('chat.input.stopWaiting') : t('chat.input.sendShortcut'))

function onKeydown(e) {
  if (props.pendingActive) {
    if (e.key === 'Enter' && !e.shiftKey) e.preventDefault()
    return
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onSubmit()
  }
}

function onSubmit() {
  const t = text.value.trim()
  if (!t) return
  emit('submit', t)
  // 注意：不再自动清空，由父组件在发送成功后调用 clearText()
}

function clearText() {
  text.value = ''
  nextTick(() => inputRef.value?.focus?.())
}

function onCancel() {
  emit('cancel')
}

function setText(value) {
  text.value = value ?? ''
  nextTick(() => inputRef.value?.focus?.())
}

defineExpose({ setText, clearText })
</script>

<style scoped>
/* 工具：icon 尺寸（与父级保持一致） */
.icon-16 { width: var(--st-icon-md); height: var(--st-icon-md); stroke: currentColor; }

/* 输入行（玻璃拟态输入容器） */
.tch-input-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: stretch;
  gap: var(--st-spacing-lg);
  padding: var(--st-spacing-lg) var(--st-spacing-xl);
  border: 1px solid rgba(var(--st-border), 0.9);
  border-radius: var(--st-radius-lg);
  background: rgb(var(--st-surface) / var(--st-threaded-input-bg-opacity, 0.80)) !important;
  backdrop-filter: blur(calc(var(--st-threaded-input-bg-opacity, 0.80) * 18px)) saturate(calc(1 + var(--st-threaded-input-bg-opacity, 0.80) * 0.6));
  -webkit-backdrop-filter: blur(calc(var(--st-threaded-input-bg-opacity, 0.80) * 18px)) saturate(calc(1 + var(--st-threaded-input-bg-opacity, 0.80) * 0.6));
  box-shadow: var(--st-shadow-sm);
  flex-shrink: 0;
  height: 100%;
  min-height: var(--st-input-min-height, 100px);
  transition: box-shadow var(--st-transition-normal), border-color var(--st-transition-normal), background var(--st-transition-normal), transform var(--st-transition-normal);
}
.tch-input-row:focus-within {
  border-color: rgba(var(--st-primary), 0.45);
  box-shadow: 0 8px 30px rgba(0,0,0,0.08), 0 0 0 3px rgba(var(--st-primary), 0.08);
  background: rgb(var(--st-surface) / var(--st-threaded-input-bg-focus-opacity, 0.86)) !important;
}

/* 工具栏按钮 */
.tch-tools-left,
.tch-tools-right {
  display: inline-flex;
  align-items: center;
  gap: var(--st-spacing-md);
}

.tool-btn {
  appearance: none;
  background: rgba(var(--st-surface-2), 0.6);
  border: 1px solid rgba(var(--st-border), var(--st-border-alpha-strong));
  color: rgba(var(--st-color-text), 0.8);
  border-radius: var(--st-radius-md);
  width: var(--st-btn-md);
  height: var(--st-btn-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background var(--st-transition-fast), border-color var(--st-transition-fast), transform var(--st-transition-fast), box-shadow var(--st-transition-fast);
}
.tool-btn:hover {
  background: rgba(var(--st-surface-2), 0.9);
  border-color: rgba(var(--st-border), 1);
  transform: translateY(-1px);
}
.tool-btn:active {
  transform: translateY(0);
}
.tool-btn.ghost {
  background: transparent;
  border-color: rgba(var(--st-border), 0.8);
}
/* 圆形拓展按钮 */
.tool-btn.round {
  border-radius: var(--st-radius-full);
  width: var(--st-btn-lg);
  height: var(--st-btn-lg);
}

/* 多行输入区域 */
.tch-input {
  width: 100%;
  height: 100%;
  min-height: 100%;
  padding: var(--st-spacing-lg) var(--st-spacing-md);
  border: none;
  border-radius: 0;
  background: transparent;
  color: rgb(var(--st-color-text));
  caret-color: rgb(var(--st-color-text));
  font-family: var(--st-font-body);
  font-size: var(--st-content-font-size);
  line-height: 1.6;
  resize: none;
  overflow-y: auto;
  box-sizing: border-box;
}

/* 自定义滚动条样式（仅在支持的浏览器） */
.tch-input::-webkit-scrollbar {
  width: var(--st-scrollbar-width);
}
.tch-input::-webkit-scrollbar-track {
  background: rgba(var(--st-border), 0.1);
  border-radius: var(--st-radius-sm);
}
.tch-input::-webkit-scrollbar-thumb {
  background: rgba(var(--st-color-text), var(--st-scrollbar-thumb-alpha));
  border-radius: var(--st-radius-sm);
  transition: background var(--st-transition-normal) ease;
}
.tch-input::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--st-color-text), var(--st-scrollbar-thumb-hover-alpha));
}
.tch-input::placeholder {
  color: rgba(var(--st-color-text), 0.45);
  font-size: var(--st-content-font-size);
}
.tch-input:focus {
  outline: none;
}
.tch-input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 发送按钮 */
.tch-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--st-spacing-md);
  padding: var(--st-spacing-lg) var(--st-spacing-xl);
  min-width: var(--st-send-btn-min-width, 90px);
  border-radius: var(--st-radius-md);
  background: linear-gradient(135deg, rgba(var(--st-primary),1), rgba(var(--st-accent),1));
  color: var(--st-primary-contrast);
  border: 1px solid transparent;
  cursor: pointer;
  height: var(--st-btn-lg);
  box-sizing: border-box;
  transition: filter var(--st-transition-fast), transform var(--st-transition-fast), box-shadow var(--st-transition-fast);
}
.tch-send[aria-label="停止等待"] {
  background: var(--st-gradient-error);
}
.tch-send:hover:enabled {
  filter: saturate(1.08) brightness(1.04);
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(0,0,0,0.10);
}
.tch-send:active:enabled {
  transform: translateY(0);
}
.tch-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(10%);
}

.tch-send-text {
  font-weight: 600;
  letter-spacing: var(--st-send-text-letter-spacing, 0.2px);
  min-width: var(--st-send-btn-min-width-em, 3em);
  text-align: center;
}

/* 发送按钮旋转动画 */
.icon-spin {
  animation: icon-spin var(--st-chip-spinner-duration, 0.9s) linear infinite;
}
@keyframes icon-spin {
  to { transform: rotate(360deg); }
}

/* 焦点可见态统一 */
.tool-btn:focus-visible,
.tch-send:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--st-primary), 0.14);
  border-color: rgba(var(--st-primary), 0.6);
}
</style>