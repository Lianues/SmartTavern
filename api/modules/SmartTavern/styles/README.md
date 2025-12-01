# SmartTavern 主题/外观 API 模块

## 概述

本模块提供 SmartTavern 主题（外观/样式）文件的后端管理接口，支持前端动态加载和应用第三方主题。

## 目录结构

```
backend_projects/SmartTavern/styles/
├── styles_switch.json              # 主题启用/禁用开关文件
├── demo-ocean.sttheme/             # 主题目录（以 .sttheme 结尾）
│   ├── manifest.json               # 主题清单文件
│   └── demo-ocean.sttheme.json     # 主题内容文件（在 entries 中声明）
└── ...
```

## 文件格式

### styles_switch.json

控制哪些主题被启用：

```json
{
  "enabled": [
    "demo-ocean.sttheme"
  ],
  "disabled": []
}
```

### manifest.json

每个主题目录必须包含的清单文件：

```json
{
  "name": "demo-ocean.sttheme",
  "description": "demo-ocean",
  "entries": [
    "demo-ocean.sttheme.json"
  ]
}
```

- `name`: 主题显示名称
- `description`: 主题描述
- `entries`: 需要加载的主题内容文件列表（按顺序合并）

### *.sttheme.json

主题内容文件，遵循前端 ThemePackV1 格式：

```json
{
  "id": "demo-ocean",
  "name": "Demo Ocean",
  "version": "1.0.0",
  "tokens": {
    "--st-color-bg": "12 18 28",
    "--st-color-text": "232 238 246",
    "--st-surface": "18 24 36",
    "--st-primary": "56 189 248"
  },
  "tokensLight": {},
  "tokensDark": {},
  "css": "/* 附加 CSS */",
  "cssLight": "",
  "cssDark": ""
}
```

- `tokens`: CSS 自定义属性字典（适用于所有模式）
- `tokensLight`: 亮色模式特定的 tokens
- `tokensDark`: 暗色模式特定的 tokens
- `css`: 附加 CSS 文本
- `cssLight`: 亮色模式附加 CSS
- `cssDark`: 暗色模式附加 CSS

## API 接口

### 1. 列出主题清单

**路径**: `smarttavern/styles/list_themes`

**描述**: 扫描 styles 目录，返回所有主题的列表。

**返回示例**:
```json
{
  "folder": "backend_projects/SmartTavern/styles",
  "total": 1,
  "items": [
    {
      "dir": "backend_projects/SmartTavern/styles/demo-ocean.sttheme",
      "name": "Demo Ocean",
      "description": "demo-ocean",
      "entries": ["demo-ocean.sttheme.json"],
      "enabled": true
    }
  ]
}
```

### 2. 获取主题开关文件

**路径**: `smarttavern/styles/get_styles_switch`

**描述**: 读取 styles_switch.json 内容。

**返回示例**:
```json
{
  "file": "backend_projects/SmartTavern/styles/styles_switch.json",
  "enabled": ["demo-ocean.sttheme"],
  "disabled": []
}
```

### 3. 更新主题开关文件

**路径**: `smarttavern/styles/update_styles_switch`

**入参**:
```json
{
  "content": {
    "enabled": ["demo-ocean.sttheme"],
    "disabled": []
  }
}
```

### 4. 获取主题详情

**路径**: `smarttavern/styles/get_theme_detail`

**入参**:
```json
{
  "theme_dir": "backend_projects/SmartTavern/styles/demo-ocean.sttheme"
}
```

**返回示例**:
```json
{
  "dir": "backend_projects/SmartTavern/styles/demo-ocean.sttheme",
  "name": "Demo Ocean",
  "description": "demo-ocean",
  "entries": ["demo-ocean.sttheme.json"],
  "manifest": {
    "name": "demo-ocean.sttheme",
    "description": "demo-ocean",
    "entries": ["demo-ocean.sttheme.json"]
  }
}
```

### 5. 获取主题入口文件内容

**路径**: `smarttavern/styles/get_theme_entries`

**描述**: 读取并合并主题的所有 entry 文件，返回前端可直接使用的 ThemePackV1 格式。

**入参**:
```json
{
  "theme_dir": "backend_projects/SmartTavern/styles/demo-ocean.sttheme"
}
```

**返回示例**:
```json
{
  "dir": "backend_projects/SmartTavern/styles/demo-ocean.sttheme",
  "name": "Demo Ocean",
  "merged_pack": {
    "id": "demo-ocean",
    "name": "Demo Ocean",
    "version": "1.0.0",
    "tokens": {
      "--st-primary": "56 189 248"
    },
    "css": "/* additional CSS */"
  },
  "entries": [
    {
      "file": "demo-ocean.sttheme.json",
      "content": { ... }
    }
  ]
}
```

### 6. 获取主题资产

**路径**: `smarttavern/styles/get_theme_asset`

**描述**: 读取主题目录下的任意文件，返回 Base64 编码内容。

**入参**:
```json
{
  "file": "backend_projects/SmartTavern/styles/demo-ocean.sttheme/demo-ocean.sttheme.json"
}
```

**返回示例**:
```json
{
  "file": "backend_projects/SmartTavern/styles/demo-ocean.sttheme/demo-ocean.sttheme.json",
  "mime": "application/json",
  "size": 1234,
  "content_base64": "eyJpZCI6Imde..."
}
```

### 7. 删除主题

**路径**: `smarttavern/styles/delete_theme`

**描述**: 删除指定主题目录，并自动从 styles_switch.json 中移除注册。

**入参**:
```json
{
  "theme_dir": "backend_projects/SmartTavern/styles/demo-ocean.sttheme"
}
```

**返回示例**:
```json
{
  "success": true,
  "deleted_path": "backend_projects/SmartTavern/styles/demo-ocean.sttheme",
  "message": "已删除主题: demo-ocean.sttheme"
}
```

## 前端集成

前端可以通过以下方式使用这些 API：

1. **获取可用主题列表**：调用 `list_themes` 获取所有主题
2. **加载主题内容**：调用 `get_theme_entries` 获取合并后的 ThemePackV1
3. **应用主题**：将 `merged_pack` 传递给 `ThemeManager.applyThemePack()`

```typescript
// 前端示例代码
async function loadThemeFromBackend(themeDir: string) {
  const response = await api.call('smarttavern/styles/get_theme_entries', {
    theme_dir: themeDir
  });
  
  if (response.merged_pack) {
    await ThemeManager.applyThemePack(response.merged_pack, { persist: true });
  }
}
```

## 安全说明

- 所有文件操作都限制在 `backend_projects/SmartTavern/styles` 目录内
- 路径遍历攻击已被防护（使用 `_is_within` 检查）
- 主题中的 `script` 字段在前端默认不执行（安全优先）

## 版本历史

- v1.0.0: 初始版本，支持基本的主题管理功能