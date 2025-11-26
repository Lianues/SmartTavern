# SmartTavern 国际化（i18n）系统

## 概述

SmartTavern 使用自研的轻量级 i18n 系统，支持：
- 内置简体中文语言包
- 插件动态注册新语言
- 插件扩展现有语言
- 响应式语言切换
- 浏览器语言自动检测

## 目录结构

```
src/locales/
├── index.ts      # i18n 核心模块
├── zh-CN.ts      # 简体中文语言包（内置）
└── README.md     # 本文档
```

## 在组件中使用

### 1. 导入 useI18n

```vue
<script setup lang="ts">
import { useI18n } from '@/locales'

const { t, locale, setLocale } = useI18n()
</script>
```

### 2. 使用翻译函数

```vue
<template>
  <!-- 简单翻译 -->
  <h1>{{ t('panel.presets.title') }}</h1>
  
  <!-- 带参数的翻译 -->
  <span>{{ t('error.loadFailed', { error: errorMsg }) }}</span>
  
  <!-- 按钮文字 -->
  <button>{{ t('common.import') }}</button>
</template>
```

### 3. 切换语言

```typescript
// 切换到日语（需要插件支持）
setLocale('ja-JP')

// 获取当前语言
console.log(locale.value) // 'zh-CN'
```

## 创建语言包插件

语言包可以作为插件动态加载。参考 `backend_projects/SmartTavern/plugins/locale-ja-JP/`

### 1. 创建 manifest.json

```json
{
  "name": "locale-ja-JP",
  "description": "日本語言語パック",
  "version": "1.0.0",
  "entries": ["index.js"],
  "backend_entries": []
}
```

### 2. 创建 index.js

```javascript
// 语言包内容
const jaJP = {
  common: {
    import: 'インポート',
    export: 'エクスポート',
    // ...
  },
  panel: {
    presets: {
      title: 'プリセット',
      // ...
    },
    // ...
  },
}

export default async function activate(host) {
  // 等待 i18n 系统就绪
  const i18n = window.STI18n
  
  if (i18n) {
    // 注册新语言
    i18n.registerLocale('ja-JP', jaJP, {
      name: 'Japanese',
      nativeName: '日本語'
    })
  }
  
  // 返回清理函数
  return () => {
    i18n?.unregisterLocale('ja-JP')
  }
}
```

### 3. 启用插件

在 `plugins_switch.json` 的 `enabled` 数组中添加 `"locale-ja-JP"`

## API 参考

### useI18n() Composable

| 属性/方法 | 类型 | 说明 |
|-----------|------|------|
| `t(key, params?)` | `Function` | 翻译函数 |
| `locale` | `Ref<string>` | 当前语言（响应式） |
| `setLocale(code)` | `Function` | 设置语言 |
| `getLocale()` | `Function` | 获取当前语言 |
| `availableLocales` | `Computed` | 已注册语言列表 |
| `hasLocale(code)` | `Function` | 检查语言是否已注册 |

### 全局 window.STI18n

| 方法 | 说明 |
|------|------|
| `registerLocale(code, messages, meta)` | 注册新语言 |
| `mergeMessages(code, messages, source?)` | 扩展现有语言 |
| `unregisterLocale(code)` | 注销语言（仅限插件语言） |
| `init()` | 初始化（自动调用） |

## 语言包键结构

```typescript
{
  common: {
    // 通用按钮、状态文字
    import, export, close, cancel, confirm, save, delete, ...
  },
  panel: {
    presets: { title, importTitle, exportTitle, typeName },
    worldBooks: { ... },
    characters: { ... },
    // ...
  },
  importConflict: {
    // 导入冲突弹窗
    title, message, hint, overwrite, rename, ...
  },
  exportModal: {
    // 导出弹窗
    title, selectItem, format, embedImage, ...
  },
  error: {
    // 错误消息
    loadFailed, importFailed, exportFailed, ...
  },
  toast: {
    // 提示消息
    plugin: { loaded, loadFailed, ... },
    save: { success, failed },
    // ...
  },
  detail: {
    // 详情页面
    preset: { ... },
    character: { ... },
    // ...
  },
}
```

## 最佳实践

1. **优先使用语言键**：不要在组件中硬编码文字
2. **使用嵌套结构**：按功能模块组织键
3. **提供 fallback**：缺失翻译时会回退到中文
4. **使用 CSS 类**：配合 `st-btn-text`、`st-label-text` 等处理溢出

## CSS 样式类

| 类名 | 用途 |
|------|------|
| `.st-btn-text` | 按钮文字（单行省略） |
| `.st-label-text` | 标签文字 |
| `.st-multiline-clamp` | 多行截断（2行） |
| `.st-title-shrink` | 标题文字（可缩小） |
| `.st-panel-title` | 面板标题 |
| `.st-btn-shrinkable` | 可缩小的按钮 |