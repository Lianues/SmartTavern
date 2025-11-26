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
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 1100;
}

/* 面板容器 */
.st-options-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1101;
  max-width: min(600px, 92vw);
  width: 100%;
}

/* 内容区 */
.st-options-content {
  background: rgba(30, 30, 35, 0.92);
  color: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 20px 60px rgba(0,0,0,.4),
              0 8px 24px rgba(0,0,0,.25),
              0 0 0 1px rgba(255,255,255,.1);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  position: relative;
  overflow: hidden;
}

/* 装饰性背景渐变 */
.st-options-content::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg,
    #3b82f6 0%,
    #8b5cf6 50%,
    #ec4899 100%);
  opacity: 0.9;
  box-shadow: 0 2px 12px rgba(59, 130, 246, 0.3);
}

/* 标题 */
.st-options-title {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 6px;
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.98);
  letter-spacing: -0.01em;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* 副标题 */
.st-options-subtitle {
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  margin-bottom: 16px;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.01em;
}

/* 内容文本 */
.st-options-message {
  font-size: 15px;
  line-height: 1.6;
  margin-bottom: 24px;
  color: rgba(255, 255, 255, 0.85);
  word-break: break-word;
}

/* 选项列表 */
.st-options-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
}

/* 选项按钮 */
.st-option-button {
  appearance: none;
  border: 2px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  padding: 13px 18px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all .2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
  min-width: 110px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.st-option-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg,
    rgba(59, 130, 246, 0.3) 0%,
    rgba(139, 92, 246, 0.3) 100%);
  opacity: 0;
  transition: opacity .2s ease;
}

.st-option-button:hover {
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
  color: rgba(255, 255, 255, 1);
}

.st-option-button:hover::before {
  opacity: 1;
}

.st-option-button:active {
  transform: translateY(0);
}

.st-option-button.is-selected {
  border-color: #60a5fa;
  background: linear-gradient(135deg,
    rgba(59, 130, 246, 0.4) 0%,
    rgba(139, 92, 246, 0.4) 100%);
  color: rgba(255, 255, 255, 1);
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4),
              0 0 0 1px rgba(59, 130, 246, 0.3);
  font-weight: 700;
}

.st-option-button.is-selected::before {
  opacity: 0;
}

/* 选项指示器 */
.st-option-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* 单选圆点 */
.st-radio-dot {
  display: block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(var(--st-border, 0 0 0), 0.3);
  border-radius: 50%;
  position: relative;
  transition: all .15s ease;
}

.st-radio-dot.is-active {
  border-color: #3b82f6;
}

.st-radio-dot.is-active::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  background: #3b82f6;
  border-radius: 50%;
}

/* 多选复选框 */
.st-checkbox-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(var(--st-border, 0 0 0), 0.3);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  color: transparent;
  transition: all .15s ease;
}

.st-checkbox-check.is-active {
  border-color: #3b82f6;
  background: #3b82f6;
  color: white;
}

/* 选项标签 */
.st-option-label {
  flex: 1;
  text-align: left;
}

/* 操作按钮区 */
.st-options-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid rgba(var(--st-border, 0 0 0), 0.08);
}

.st-action-button {
  appearance: none;
  border: none;
  background: transparent;
  color: rgb(var(--st-color-text, 20 20 20));
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all .15s ease;
  min-width: 80px;
}

.st-action-button:hover {
  background: rgba(var(--st-border, 0 0 0), 0.06);
}

.st-action-cancel {
  color: rgba(var(--st-color-text, 20 20 20), 0.6);
}

.st-action-confirm {
  background: #3b82f6;
  color: white;
}

.st-action-confirm:hover {
  background: #2563eb;
}

/* 进入/退出动画 - 背景 */
.st-options-backdrop-enter-from,
.st-options-backdrop-leave-to {
  opacity: 0;
}

.st-options-backdrop-enter-active,
.st-options-backdrop-leave-active {
  transition: opacity .25s ease;
}

/* 进入/退出动画 - 面板 */
.st-options-panel-enter-from,
.st-options-panel-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.95);
}

.st-options-panel-enter-active,
.st-options-panel-leave-active {
  transition: opacity .25s ease, transform .25s cubic-bezier(.22,.61,.36,1);
}
</style>