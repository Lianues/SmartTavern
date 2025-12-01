<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from '@/locales'
import BackgroundsManagerTab from '@/components/sidebar/tabs/BackgroundsManager.vue'
import ThemeManagerTab from '@/components/sidebar/tabs/ThemeManager.vue'

const { t } = useI18n()

/**
 * 主页外观视图组件
 * - 包含两个页签：背景图片和主题
 * - 参考侧边栏的外观面板设计
 */

const active = ref('backgrounds')

const tabs = computed(() => [
  { key: 'backgrounds', label: t('appearance.tabs.backgrounds'), icon: 'image' },
  { key: 'theme', label: t('appearance.tabs.theme'), icon: 'palette' },
])

/** 刷新 Lucide 图标 */
function refreshLucideIcons() {
  nextTick(() => {
    try { (window as any)?.lucide?.createIcons?.() } catch (_) {}
  })
}

onMounted(() => {
  refreshLucideIcons()
})
</script>

<template>
  <div class="appearance-view" data-scope="home-appearance">
    <!-- 页签导航 -->
    <nav class="appearance-tabs" role="tablist" :aria-label="t('appearance.title')">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="appearance-tab"
        :class="{ active: active === tab.key }"
        role="tab"
        :aria-selected="active === tab.key"
        :tabindex="active === tab.key ? 0 : -1"
        @click="active = tab.key"
      >
        <i v-if="tab.icon" :data-lucide="tab.icon"></i>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </nav>

    <!-- 页签内容 -->
    <CustomScrollbar2 class="appearance-body">
      <BackgroundsManagerTab v-if="active === 'backgrounds'" />
      <ThemeManagerTab v-else-if="active === 'theme'" />
      <div v-else class="tab-panel-placeholder">
        <h3>{{ t('appearance.unknownTab') }}</h3>
        <p class="muted">{{ t('appearance.placeholderContent') }}</p>
      </div>
    </CustomScrollbar2>
  </div>
</template>

<style scoped>
.appearance-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* 页签导航 */
.appearance-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--st-spacing-sm) var(--st-spacing-md);
  padding: var(--st-spacing-md) var(--st-spacing-lg);
  border-bottom: 1px solid rgba(var(--st-border), 0.85);
  background: rgba(var(--st-surface), 0.65);
  flex-shrink: 0;
}

.appearance-tab {
  display: inline-flex;
  align-items: center;
  gap: var(--st-spacing-sm);
  padding: var(--st-spacing-sm) var(--st-spacing-lg);
  border-radius: var(--st-radius-full);
  border: 1px solid rgb(var(--st-border));
  background: rgb(var(--st-surface));
  color: rgb(var(--st-color-text));
  cursor: pointer;
  font-size: var(--st-font-sm);
  line-height: 1;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background var(--st-transition-normal),
              border-color var(--st-transition-normal),
              transform var(--st-transition-normal),
              box-shadow var(--st-transition-normal);
}

.appearance-tab i {
  width: var(--st-icon-sm);
  height: var(--st-icon-sm);
  display: inline-block;
}

.tab-label {
  font-weight: 600;
  letter-spacing: 0.2px;
}

.appearance-tab:focus-visible {
  outline: 2px solid rgba(var(--st-primary), 0.6);
  outline-offset: var(--st-outline-offset);
}

.appearance-tab:hover {
  transform: translateY(-1px);
}

.appearance-tab.active {
  background: rgba(var(--st-primary), 0.14);
  border-color: rgba(var(--st-primary), 0.45);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);
  transform: translateY(-1px);
}

/* 页签内容区域 */
.appearance-body {
  flex: 1;
  overflow: hidden;
  padding: var(--st-spacing-xl);
}

.tab-panel-placeholder {
  padding: var(--st-spacing-xl);
}

.tab-panel-placeholder h3 {
  margin: 0 0 var(--st-spacing-sm);
  font-weight: 700;
}

.tab-panel-placeholder .muted {
  color: rgba(var(--st-color-text), 0.75);
  margin: 0;
}
</style>