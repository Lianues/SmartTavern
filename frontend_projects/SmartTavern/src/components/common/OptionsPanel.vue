<script setup>
import { computed } from 'vue'
import { useOptionsStore } from '@/stores/workflow/options'
import { useI18n } from '@/locales'

const { t } = useI18n()
const store = useOptionsStore()
const currentOption = computed(() => store.current)

/** 处理选项选择 */
function handleSelect(value) {
  if (!currentOption.value) return
  
  const type = currentOption.value.type
  
  if (type === 'single') {
    // 单选：直接确认
    store.confirm(value)
  } else if (type === 'multiple') {
    // 多选：切换选中状态
    store.toggleSelection(value)
  } else if (type === 'any') {
    // 不定项：直接确认（允许任意个数）
    store.toggleSelection(value)
  }
}

/** 检查选项是否被选中 */
function isSelected(value) {
  if (!currentOption.value) return false
  return currentOption.value.selected.includes(value)
}

/** 确认多选/不定项选择 */
function handleConfirm() {
  if (!currentOption.value) return
  const selected = currentOption.value.selected
  store.confirm(selected.length > 0 ? selected : null)
}

/** 取消选择 */
function handleCancel() {
  store.cancel()
}
</script>

<template>
  <transition name="st-options-backdrop">
    <div
      v-if="currentOption"
      class="st-options-backdrop"
      @click="handleCancel"
    ></div>
  </transition>
  
  <transition name="st-options-panel">
    <div
      v-if="currentOption"
      class="st-options-panel"
      role="dialog"
      aria-modal="true"
    >
      <div class="st-options-content">
        <!-- 标题 -->
        <div v-if="currentOption.title" class="st-options-title">
          {{ currentOption.title }}
        </div>
        
        <!-- 副标题 -->
        <div v-if="currentOption.subtitle" class="st-options-subtitle">
          {{ currentOption.subtitle }}
        </div>
        
        <!-- 内容 -->
        <div v-if="currentOption.message" class="st-options-message">
          {{ currentOption.message }}
        </div>
        
        <!-- 选项列表 -->
        <div class="st-options-list">
          <button
            v-for="(option, index) in currentOption.options"
            :key="index"
            type="button"
            class="st-option-button"
            :class="{ 'is-selected': isSelected(option.value) }"
            @click="handleSelect(option.value)"
          >
            <span class="st-option-indicator">
              <span
                v-if="currentOption.type === 'single'"
                class="st-radio-dot"
                :class="{ 'is-active': isSelected(option.value) }"
              ></span>
              <span
                v-else
                class="st-checkbox-check"
                :class="{ 'is-active': isSelected(option.value) }"
              >✓</span>
            </span>
            <span class="st-option-label">{{ option.label }}</span>
          </button>
        </div>
        
        <!-- 操作按钮（仅多选和不定项显示） -->
        <div
          v-if="currentOption.type === 'multiple' || currentOption.type === 'any'"
          class="st-options-actions"
        >
          <button
            type="button"
            class="st-action-button st-action-cancel"
            @click="handleCancel"
          >
            {{ t('components.optionsPanel.cancel') }}
          </button>
          <button
            type="button"
            class="st-action-button st-action-confirm"
            @click="handleConfirm"
          >
            {{ t('components.optionsPanel.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* 背景遮罩 */
.st-options-backdrop {
  position: fixed;
  inset: 0;
  background: var(--st-modal-overlay-options-bg);
  backdrop-filter: blur(var(--st-blur-lg));
  -webkit-backdrop-filter: blur(var(--st-blur-lg));
  z-index: 1100;
}

/* 面板容器 */
.st-options-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1101;
  max-width: min(var(--st-modal-lg-width), 92vw);
  width: 100%;
}

/* 内容区 */
.st-options-content {
  background: var(--st-options-bg);
  color: var(--st-options-text);
  border-radius: var(--st-radius-sm);
  padding: var(--st-spacing-4xl);
  box-shadow: 0 var(--st-spacing-md) var(--st-gap-2xl) rgba(0,0,0,.15),
              0 var(--st-spacing-xs) var(--st-spacing-md) rgba(0,0,0,.1);
  border: 1px solid var(--st-options-border);
  backdrop-filter: blur(var(--st-backdrop-blur-md));
  -webkit-backdrop-filter: blur(var(--st-backdrop-blur-md));
  position: relative;
  overflow: hidden;
}

/* 顶部边框（替代渐变，更简洁） */
.st-options-content::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--st-options-text);
  opacity: 0.1;
}

/* 标题 */
.st-options-title {
  font-size: var(--st-font-2xl);
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: var(--st-spacing-md);
  margin-top: 0;
  color: var(--st-options-title);
  letter-spacing: -0.01em;
}

/* 副标题 */
.st-options-subtitle {
  font-size: var(--st-font-md);
  font-weight: 500;
  line-height: 1.5;
  margin-bottom: var(--st-spacing-2xl);
  color: var(--st-options-subtitle);
}

/* 内容文本 */
.st-options-message {
  font-size: var(--st-font-base);
  line-height: 1.6;
  margin-bottom: var(--st-spacing-2xl);
  color: var(--st-options-message);
  word-break: break-word;
}

/* 选项列表 */
.st-options-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--st-spacing-md);
  margin-bottom: var(--st-spacing-2xl);
}

/* 选项按钮 */
.st-option-button {
  appearance: none;
  border: 1px solid var(--st-options-btn-border);
  background: var(--st-options-btn-bg);
  color: var(--st-options-btn-text);
  padding: var(--st-spacing-lg) var(--st-spacing-2xl);
  border-radius: var(--st-radius-sm);
  font-size: var(--st-font-base);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--st-transition-fast);
  display: flex;
  align-items: center;
  gap: var(--st-spacing-md);
  flex: 0 0 auto;
  min-width: var(--st-btn-min-width-sm);
  position: relative;
}

.st-option-button:hover {
  border-color: var(--st-options-btn-hover-border);
  background: var(--st-options-btn-hover-bg);
}

.st-option-button:active {
  transform: scale(0.98);
}

.st-option-button.is-selected {
  border-color: var(--st-options-text);
  background: var(--st-options-text);
  color: var(--st-options-bg);
  font-weight: 600;
}

/* 选项指示器 */
.st-option-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--st-icon-md);
  height: var(--st-icon-md);
  flex-shrink: 0;
}

/* 单选圆点 */
.st-radio-dot {
  display: block;
  width: var(--st-icon-md);
  height: var(--st-icon-md);
  border: 2px solid var(--st-options-indicator-border);
  border-radius: var(--st-radius-circle);
  background: var(--st-options-bg);
  position: relative;
  transition: all var(--st-transition-fast);
}

.st-radio-dot.is-active {
  border-color: var(--st-options-text);
}

.st-radio-dot.is-active::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: var(--st-spacing-md);
  height: var(--st-spacing-md);
  background: var(--st-options-text);
  border-radius: var(--st-radius-circle);
}

/* 多选复选框 */
.st-checkbox-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--st-icon-md);
  height: var(--st-icon-md);
  border: 2px solid var(--st-options-indicator-border);
  border-radius: 2px;
  background: var(--st-options-bg);
  font-size: var(--st-font-xs);
  font-weight: 700;
  color: transparent;
  transition: all var(--st-transition-fast);
}

.st-checkbox-check.is-active {
  border-color: var(--st-options-text);
  color: var(--st-options-text);
}

/* 选项标签 */
.st-option-label {
  flex: 1;
  text-align: left;
}

/* 操作按钮区 */
.st-options-actions {
  display: flex;
  gap: var(--st-spacing-md);
  justify-content: flex-end;
  padding-top: var(--st-spacing-2xl);
  border-top: 1px solid var(--st-options-border);
}

.st-action-button {
  appearance: none;
  border: 1px solid var(--st-options-btn-border);
  background: transparent;
  color: var(--st-options-text);
  padding: var(--st-spacing-md) var(--st-spacing-2xl);
  border-radius: var(--st-radius-sm);
  font-size: var(--st-font-base);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--st-transition-fast);
  min-width: var(--st-btn-min-width);
}

.st-action-button:hover {
  background: var(--st-options-btn-hover-bg);
  border-color: var(--st-options-btn-hover-border);
}

.st-action-cancel {
  color: var(--st-options-action-cancel);
}

.st-action-confirm {
  background: var(--st-options-text);
  color: var(--st-options-bg);
  border-color: var(--st-options-text);
}

.st-action-confirm:hover:not(:disabled) {
  background: var(--st-options-confirm-hover-bg);
}

/* 进入/退出动画 - 背景 */
.st-options-backdrop-enter-from,
.st-options-backdrop-leave-to {
  opacity: 0;
}

.st-options-backdrop-enter-active,
.st-options-backdrop-leave-active {
  transition: opacity var(--st-transition-slow);
}

/* 进入/退出动画 - 面板 */
.st-options-panel-enter-from,
.st-options-panel-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.95);
}

.st-options-panel-enter-active,
.st-options-panel-leave-active {
  transition: opacity var(--st-transition-slow), transform var(--st-transition-slow);
}
</style>