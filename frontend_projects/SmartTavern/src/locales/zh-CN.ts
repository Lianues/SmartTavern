/**
 * SmartTavern 简体中文语言包
 * 
 * 结构说明：
 * - common: 通用文字（按钮、状态等）
 * - panel: 面板相关
 * - modal: 弹窗相关
 * - error: 错误消息
 * - sidebar: 侧边栏
 * - detail: 详情页面
 * - home: 主页菜单
 * - toast: 提示消息
 */

const zhCN = {
  // ==================== 通用文字 ====================
  common: {
    // 按钮
    import: '导入',
    export: '导出',
    close: '关闭',
    cancel: '取消',
    confirm: '确认',
    save: '保存',
    delete: '删除',
    use: '使用',
    using: '使用中',
    view: '查看',
    add: '添加',
    edit: '编辑',
    refresh: '刷新',
    reset: '重置',
    apply: '应用',
    enable: '启用',
    disable: '禁用',
    enabled: '已启用',
    disabled: '已禁用',
    create: '新建',
    
    // 状态
    loading: '加载中...',
    importing: '正在导入...',
    exporting: '导出中...',
    saving: '保存中...',
    saved: '已保存！',
    checking: '检查中...',
    processing: '处理中...',
    
    // 表单
    name: '名称',
    description: '描述',
    id: 'ID',
    folder: '文件夹',
    file: '文件',
    type: '类型',
    content: '内容',
    value: '值',
    
    // 时间
    am: '上午',
    pm: '下午',
    
    // 其他
    noDescription: '无描述',
    noData: '暂无数据',
    dragToSort: '拖拽排序',
    unknown: '未知',
    none: '无',
    all: '全部',
    selected: '已选择',
    required: '必填',
    optional: '可选',
    default: '默认',
  },

  // ==================== 面板标题与操作 ====================
  panel: {
    presets: {
      title: '预设 Presets',
      createTitle: '新建预设',
      importTitle: '导入预设 (支持 .json, .zip, .png)',
      exportTitle: '导出预设',
      typeName: '预设',
    },
    worldBooks: {
      title: '世界书 World Books',
      createTitle: '新建世界书',
      importTitle: '导入世界书 (支持 .json, .zip, .png)',
      exportTitle: '导出世界书',
      typeName: '世界书',
    },
    characters: {
      title: '角色卡 Characters',
      createTitle: '新建角色卡',
      importTitle: '导入角色卡 (支持 .json, .zip, .png)',
      exportTitle: '导出角色卡',
      typeName: '角色卡',
    },
    character: {
      type: {
        threaded: '楼层对话',
        sandbox: '前端沙盒',
      },
      importTitle: '导入角色 (支持 .json, .zip, .png)',
      exportTitle: '导出角色',
      typeName: '角色',
    },
    personas: {
      title: '用户信息 Personas',
      createTitle: '新建用户信息',
      importTitle: '导入用户信息 (支持 .json, .zip, .png)',
      exportTitle: '导出用户信息',
      typeName: '用户信息',
    },
    regexRules: {
      title: '正则 Regex Rules',
      createTitle: '新建正则规则',
      importTitle: '导入正则规则 (支持 .json, .zip, .png)',
      exportTitle: '导出正则规则',
      typeName: '正则规则',
    },
    llmConfigs: {
      title: 'AI配置 AI Configs',
      createTitle: '新建AI配置',
      importTitle: '导入AI配置 (支持 .json, .zip, .png)',
      exportTitle: '导出AI配置',
      typeName: 'AI配置',
    },
    plugins: {
      title: '插件 Plugins',
      importTitle: '导入插件 (支持 .json, .zip, .png)',
      exportTitle: '导出插件',
      typeName: '插件',
      hint: '用于管理插件（后端 plugins 目录）：加载 / 卸载。导入新插件后将自动启用。',
      detailTitle: '插件详情',
    },
    
    themes: {
      title: '主题',
      detailTitle: '主题详情',
    },
    appearance: {
      title: '外观设置',
    },
    appSettings: {
      title: '应用设置',
    },
  },

  // ==================== 导入冲突弹窗 ====================
  importConflict: {
    title: '⚠️ 名称冲突',
    message: '已存在名为 {name} 的{type}文件目录（非{type}名冲突）。',
    hint: '请选择处理方式：',
    
    overwrite: {
      title: '覆盖原有{type}',
      desc: '删除旧{type}，使用新导入的内容替换',
    },
    rename: {
      title: '保留两者（重命名）',
      desc: '自定义新{type}的名称：',
      placeholder: '输入新名称',
      button: '确认',
    },
    
    cancelButton: '取消导入',
    
    errors: {
      emptyName: '请输入名称',
      nameExists: '名称 "{name}" 已存在，请使用其他名称',
    },
  },

  // ==================== 导出弹窗 ====================
  exportModal: {
    title: '导出{type}',
    selectItem: '选择{type}',
    
    format: {
      title: '导出格式',
      zip: {
        title: 'ZIP 压缩包',
        desc: '标准压缩格式，便于分享',
      },
      json: {
        title: 'JSON 文件',
        desc: '轻量格式，便于编辑和版本控制',
      },
      png: {
        title: 'PNG 图片',
        desc: '数据嵌入图片中，可直接预览',
      },
    },
    
    embedImage: {
      title: '嵌入图片（可选）',
      hint: '选择一张 PNG 图片作为载体，数据将嵌入其中',
      dropzone: '点击选择或拖动图片到此处',
      note: '仅支持 PNG 格式，如不选择将使用{type}的 icon',
    },
    
    cancelButton: '取消',
    confirmButton: '确认导出',
    exportSuccess: '导出成功！',
    
    errors: {
      noSelection: '请选择要导出的{type}',
      noPath: '无法获取{type}路径',
      pngOnly: '请选择 PNG 格式的图片',
    },
  },

  // ==================== 错误消息 ====================
  error: {
    loadFailed: '加载失败：{error}',
    importFailed: '导入失败',
    exportFailed: '导出失败',
    saveFailed: '保存失败：{error}',
    deleteFailed: '删除失败：{error}',
    networkError: '网络错误',
    unknownError: '未知错误',
    unknownType: '未知类型: {type}',
    getDetailFailed: '获取详情失败',
    invalidFileType: '不支持的文件类型: {ext}，请选择 .json、.zip 或 .png 文件',
    missingFilePath: '缺少文件路径，无法保存',
    operationFailed: '操作失败：{error}',
  },

  // ==================== 删除确认弹窗 ====================
  deleteConfirm: {
    title: '确认删除',
    message: '确定要删除{type}「{name}」吗？',
    warning: '此操作将删除整个文件夹及其中的所有文件，且无法撤销！',
    deleting: '删除中...',
  },

  // ==================== 新建弹窗 ====================
  createItem: {
    title: '新建{type}',
    nameLabel: '名称',
    namePlaceholder: '请输入名称',
    descriptionLabel: '描述',
    descriptionPlaceholder: '请输入描述（可选）',
    folderLabel: '文件夹名称',
    folderPlaceholder: '请输入文件夹名称',
    folderHint: '只能包含字母、数字、下划线、连字符和中文字符',
    iconLabel: '图标',
    uploadIcon: '点击上传',
    removeIcon: '移除图标',
    iconHint: '可选，支持常见图片格式',
    create: '创建',
    creating: '创建中...',
    errors: {
      emptyName: '名称不能为空',
      emptyFolder: '文件夹名称不能为空',
      invalidFolder: '文件夹名称格式不正确，只能包含字母、数字、下划线、连字符和中文字符',
      folderExists: '文件夹「{folder}」已存在',
      createFailed: '创建失败，请重试',
    },
  },

  // ==================== 导入错误弹窗 ====================
  import: {
    error: {
      // 错误标题
      typeMismatch: '文件类型不匹配',
      noTypeInfo: '缺少类型信息',
      noTypeInFilename: '文件名缺少类型标识',
      invalidZip: '无效的压缩包',
      invalidFormat: '不支持的格式',
      importFailed: '导入失败',
      
      // 错误描述
      typeMismatchDesc: '您选择的文件包含的数据类型与当前面板不匹配。',
      noTypeInfoDesc: '此文件缺少类型标记信息，无法验证是否为正确的数据类型。',
      noTypeInFilenameDesc: 'JSON 文件名中未包含类型标识。请确保文件名以类型前缀开头，如 "preset_名称.json"。',
      genericDesc: '导入过程中发生错误，请检查文件格式是否正确。',
      
      // 类型信息
      fileContains: '文件包含',
      panelExpects: '当前面板期望',
      
      // 提示
      typeMismatchHint: '请确保在正确的面板中导入对应类型的文件，或选择其他文件。',
      noTypeInfoHint: '此文件可能是旧版本导出的，或不是从本系统导出的。如需导入，请手动确认数据格式。',
      noTypeInFilenameHint: '本系统导出的 JSON 文件会自动包含类型前缀，请使用正确命名的文件。',
    },
  },

  // ==================== 侧边栏 ====================
  sidebar: {
    title: '设置',
    collapse: '收起',
    expand: '展开侧边栏',
    configPreview: '配置预览',
    configPreviewHint: '在聊天页面右侧展示的配置入口（预览占位）',
    backToHome: '回到主页',
    
    viewMode: {
      threaded: '楼层',
      sandbox: '前端',
    },
    
    theme: {
      dark: '深色',
      light: '浅色',
      system: '系统',
    },
  },

  // ==================== 详情页面 ====================
  detail: {
    preset: {
      title: '预设详情',
      editMode: '编辑模式',
      editHint: '此页面支持完整编辑、新增、删除和拖拽排序功能',
      saveToBackend: '保存到后端',
      saving: '保存中',
      saved: '已保存！',
      saveFailed: '保存失败',
      
      basicInfo: '基本信息',
      
      apiConfig: {
        title: 'API 配置',
        enableTitle: '启用 API 配置',
        enabled: '已启用',
        notEnabled: '未启用',
        enable: '启用',
        temperature: 'Temperature',
        topP: 'Top P',
        topK: 'Top K',
        maxContext: 'Max Context',
        maxTokens: 'Max Tokens',
        stream: '流式输出（stream）',
        frequencyPenalty: 'Frequency Penalty',
        presencePenalty: 'Presence Penalty',
        on: '开启',
      },
      
      prompts: {
        title: '提示词编辑',
        items: '提示词条目',
        relative: 'Relative 条目',
        inChat: 'In-Chat 条目',
        selectSpecial: '选择一次性组件',
        addSpecial: '添加特殊',
        dragToSort: '拖拽排序',
      },
      
      regex: {
        title: '正则编辑',
        empty: '暂无规则，请在右上角输入后点击添加',
      },
      
      errors: {
        idRequired: '请填写 id',
        nameRequired: '请填写名称',
        reservedConflict: 'id 或 名称 与保留组件重复',
        idExists: 'id 已存在',
        nameExists: '名称已存在',
        specialExists: '该一次性组件已存在',
      },
    },
    
    character: {
      title: '角色详情',
      pageTitle: '角色卡编辑',
      editMode: '编辑模式',
      editHint: '此页面支持编辑角色的基本信息、初始消息、内嵌世界书和正则规则',
      
      basicInfo: '基本设定',
      characterName: '角色卡名称',
      characterDesc: '角色卡描述',
      displayName: '角色名称',
      displayNamePlaceholder: '在对话中显示的角色名称（可选）',
      badgeName: '角色徽章',
      badgeNamePlaceholder: '角色徽章标识（可选）',
      avatarLabel: '头像',
      uploadAvatar: '上传头像',
      removeAvatar: '移除头像',
      
      messages: {
        title: '初始消息',
        addNew: '新增消息',
        empty: '暂无初始消息，点击右上角"新增消息"按钮添加',
        messageNum: '消息 #{num}',
        charCount: '字符数',
      },
      
      worldBook: {
        title: '内嵌世界书',
        empty: '暂无世界书条目',
        idPlaceholder: 'id',
        namePlaceholder: '名称',
        defaultName: '角色世界书',
      },
      
      regexRules: {
        title: '正则规则',
        empty: '暂无正则规则',
        idPlaceholder: '规则 id',
        namePlaceholder: '规则名称',
      },
      
      errors: {
        wbIdRequired: '请填写世界书 ID',
        wbNameRequired: '请填写世界书名称',
        wbIdExists: 'ID 已存在',
        ruleIdRequired: '请填写规则 id',
        ruleNameRequired: '请填写规则名称',
        ruleIdExists: '该 id 已存在',
      },
    },
    
    persona: {
      title: '用户信息详情',
      pageTitle: '用户信息编辑',
      editMode: '编辑模式',
      editHint: '此页面用于编辑用户的基本信息，包括名称和描述',
      
      basicInfo: '基本信息',
      personaInfoName: '用户信息名称',
      personaInfoNamePlaceholder: '输入用户信息名称',
      personaInfoDesc: '用户信息描述',
      personaInfoDescPlaceholder: '输入用户信息描述，可以包含用户的偏好、背景、对话风格等...',
      personaName: '用户名称',
      personaNamePlaceholder: '在对话中显示的用户名称（可选）',
      personaBadge: '用户徽章',
      personaBadgePlaceholder: '用户徽章标识（可选）',
      currentValue: '当前',
      notSet: '(未设置)',
      charCount: '字符数',
      avatarLabel: '头像',
      uploadAvatar: '上传头像',
      removeAvatar: '移除头像',
      
      notes: {
        title: '说明',
        line1: '用户信息（Persona）用于定义用户的身份、偏好和对话风格',
        line2: '输入框失焦时会自动保存',
        line3: '点击"重置"按钮可以恢复到当前保存的内容',
      },
      
      preview: {
        title: '当前保存的数据',
      },
    },
    
    worldBook: {
      title: '世界书详情',
      entries: '条目列表',
      addEntry: '添加条目',
      
      pageTitle: '世界书详情',
      editMode: '编辑模式',
      editHint: '此页面支持完整编辑、新增、删除和拖拽排序功能',
      saveFailed: '保存失败',
      
      basicInfo: '基本信息',
      
      toolbar: {
        entryCount: '条目数量',
        idPlaceholder: 'id',
        namePlaceholder: '名称',
      },
      
      editor: {
        title: '世界书编辑',
        empty: '暂无世界书条目，请在右上角输入后点击添加',
      },
      
      errors: {
        idRequired: '请填写 id',
        nameRequired: '请填写 名称',
        idExists: 'id 已存在',
      },
    },
    
    regexRule: {
      title: '正则规则详情',
      findRegex: '查找正则',
      replaceRegex: '替换为',
      targets: '目标',
      placement: '位置',
      views: '视图',
      
      pageTitle: '正则规则编辑',
      editMode: '编辑模式',
      editHint: '此页面用于编辑独立的正则规则集，支持新增、编辑、删除和拖拽排序',
      saveFailed: '保存失败',
      
      basicInfo: '基本信息',
      
      toolbar: {
        ruleCount: '规则数量',
        idPlaceholder: 'id',
        namePlaceholder: '名称',
      },
      
      list: {
        title: '正则规则列表',
        empty: '暂无正则规则，请在右上角输入后点击添加',
      },
      
      notes: {
        title: '使用说明',
        line1: '正则规则用于文本后处理，支持查找和替换操作',
        line2: '每个规则可以设置目标（targets）和视图（views）',
        line3: '支持深度过滤（min_depth / max_depth）',
        line4: '点击"编辑"按钮展开完整的编辑表单',
        line5: '使用左侧握把图标拖拽可以调整规则执行顺序',
      },
      
      errors: {
        idRequired: '请填写 id',
        nameRequired: '请填写 名称',
        idExists: 'id 已存在',
      },
    },
    
    llmConfig: {
      title: 'AI配置详情',
      editMode: '编辑模式',
      editHint: '此页面支持完整编辑AI配置参数',
      saveFailed: '保存失败',
      
      basicInfo: '基本信息',
      baseConfig: '基础配置',
      
      provider: 'Provider',
      baseUrl: 'Base URL',
      apiKey: 'API Key',
      model: '模型(model)',
      modelPlaceholder: '如 gpt-4o-mini',
      selectModel: '选择模型',
      modelListPlaceholder: '选择模型（占位）',
      
      requestParams: {
        title: '请求参数',
        maxTokens: 'max_tokens',
        temperature: 'temperature',
        topP: 'top_p',
        presencePenalty: 'presence_penalty',
        frequencyPenalty: 'frequency_penalty',
        stream: '流式输出',
        on: '开启',
      },
      
      network: {
        title: '网络与日志',
        connectTimeout: '连接超时（秒）',
        requestTimeout: '请求超时（秒）',
        enableLogging: '启用日志',
      },
      
      customParams: {
        title: '自定义参数（JSON）',
        hint: '输入 JSON 格式的自定义参数，将合并到请求中',
      },
      
      gemini: {
        title: 'Gemini 高级配置',
        stopSequences: 'stopSequences (逗号分隔)',
        safetySettings: 'safetySettings (JSON)',
        customParams: 'customParams (JSON)',
      },
      
      anthropic: {
        title: 'Anthropic 高级配置',
        stopSequences: 'stop_sequences (逗号分隔)',
        enableThinking: 'enable_thinking',
        thinkingBudget: 'thinking_budget',
      },
      
      errors: {
        jsonFormatError: 'JSON 格式错误',
        fixJsonErrors: '请修正 JSON 格式错误后再保存',
      },
    },
    
    plugin: {
      title: '插件详情',
      pageTitle: '插件信息编辑',
      editMode: '编辑模式',
      editHint: '此页面用于编辑插件的基本信息，包括名称和描述',
      saveFailed: '保存失败',
      saved: '保存成功',
      
      basicInfo: '基本信息',
      pluginName: '插件名称',
      pluginNamePlaceholder: '输入插件名称',
      pluginDesc: '插件描述',
      pluginDescPlaceholder: '输入插件描述，可以包含插件的功能、用法等...',
      
      notes: {
        title: '说明',
        line1: '插件信息仅包含名称和描述，保存到 manifest.json',
        line2: '输入框失焦时会自动保存到内存',
        line3: '点击"保存"按钮将修改写入到后端文件',
      },
    },
    
    theme: {
      title: '主题详情',
      pageTitle: '主题信息编辑',
      editMode: '编辑模式',
      editHint: '此页面用于编辑主题的基本信息，包括名称和描述',
      saveFailed: '保存失败',
      saved: '保存成功',
      
      basicInfo: '基本信息',
      themeName: '主题名称',
      themeNamePlaceholder: '输入主题名称',
      themeDesc: '主题描述',
      themeDescPlaceholder: '输入主题描述，可以包含主题的风格、特点等...',
      
      notes: {
        title: '说明',
        line1: '主题信息仅包含名称和描述，保存到 manifest.json',
        line2: '输入框失焦时会自动保存到内存',
        line3: '点击"保存"按钮将修改写入到后端文件',
      },
    },
  },

  // ==================== 外观面板 ====================
  appearance: {
    title: '外观 Appearance',
    tabs: {
      threaded: '楼层对话',
      sandbox: '前端沙盒',
      backgrounds: '背景图片',
      theme: '主题',
      others: '其他',
    },
    unknownTab: '未知页签',
    placeholderContent: '占位内容',
    
    // 背景图片管理
    backgrounds: {
      title: '背景图片',
      desc: '为开始页面、楼层对话页面、沙盒页面设置背景图。可覆盖默认图片并即时预览。',
      startPage: '开始页面',
      threadedPage: '楼层对话页面',
      sandboxPage: '沙盒页面',
      selectImage: '选择图片',
      resetDefault: '重置默认',
      landscape: '横版（桌面/平板）',
      portrait: '竖版（手机）',
      noImage: '暂无图片',
      uploading: '上传中...',
    },
    
    // 沙盒外观
    sandbox: {
      title: '前端沙盒外观',
      desc: '配置沙盒舞台的尺寸与长宽比，便于后续嵌入画面/预览对齐。',
      displayMode: '显示模式',
      displayModeAuto: '自适应高度（默认）',
      displayModeFixed: '固定容器（使用宽高比）',
      displayModeInline: '由沙盒内代码决定（缺省则自适应）',
      displayModeHint: '使用"由沙盒内代码决定"时，可在 HTML 中加入注释：<!-- st:display-mode=auto|fixed --> 若无声明则回退为自适应高度。',
      aspectRatio: '画面宽高比',
      preset: '预设',
      orCustom: '或 自定义',
      stageMaxWidth: '舞台最大宽度',
      sliderMax: '滑条最大值',
      stagePadding: '舞台内边距',
      stageRadius: '舞台圆角',
      bgMaskOpacity: '背景图片遮罩不透明度',
      bgMaskBlur: '背景图片遮罩模糊',
      bgMaskBlurHint: '通过遮罩层对背景图应用高斯模糊（建议 0~12px，过大可能影响性能）',
      stageBgOpacity: '舞台背景不透明度',
      tip: '提示：上述设定实时作用于页面上的"全局沙盒"舞台，并以 CSS 变量方式保存，便于主题或脚本统一接管。',
    },
    
    // 主题管理
    theme: {
      title: '主题管理',
      desc: '导入外部主题，或重置为内置风格。',
      typeName: '主题',
      backendThemes: '后端主题',
      importTitle: '导入主题包',
      selectFile: '选择 .json / .sttheme.json',
      importHint: '主题包包含 tokens 与可选 CSS；应用后会持久化于浏览器。',
      quickTry: '快速体验',
      applyDemo: '一键应用 Demo 主题',
      enableExtension: '启用示例扩展：圆角跟随阴影',
      extensionHint: '扩展仅联动样式 Token，不执行外部脚本；可随时停用。',
      currentTheme: '当前主题',
      applied: '已应用',
      notApplied: '未应用',
      name: '名称',
      id: 'ID',
      version: '版本',
      unnamed: '未命名',
      resetDefault: '重置为默认主题',
      // 多主题叠加
      multiThemeInfo: '多主题叠加',
      multiThemeHint: '支持同时启用多个主题。排序靠前的主题优先级更高，会覆盖后面主题的相同样式。拖拽可调整顺序。',
    },
    
    // 其他外观设置
    others: {
      title: '其他外观设置',
      desc: '配置浮标吸附边距，控制侧边栏浮标吸附到屏幕边缘时的距离。',
      fabMargin: '浮标吸附边距',
      fabMarginHint: '控制侧边栏浮标吸附到屏幕边缘时的距离，数值越大，浮标距离边缘越远',
      tuningTip: '提示：拖拽滑条时，页面会自动变透明，仅保留本面板不透明，便于实时查看边距调整效果。',
      timezone: '时区设置',
      timezoneHint: '选择消息时间戳的显示时区',
      dateTimeFormat: '日期时间格式',
      dateTimeFormatHint: '选择消息时间戳的显示格式',
      // 时区城市名称
      tzShanghai: '上海 (UTC+8)',
      tzTokyo: '东京 (UTC+9)',
      tzSeoul: '首尔 (UTC+9)',
      tzHongKong: '香港 (UTC+8)',
      tzSingapore: '新加坡 (UTC+8)',
      tzLondon: '伦敦 (UTC+0/+1)',
      tzParis: '巴黎 (UTC+1/+2)',
      tzNewYork: '纽约 (UTC-5/-4)',
      tzLosAngeles: '洛杉矶 (UTC-8/-7)',
      tzChicago: '芝加哥 (UTC-6/-5)',
      tzUTC: '协调世界时 (UTC+0)',
      formatISO24: 'ISO 24小时 (2025-12-01 14:30)',
      formatISO12: 'ISO 12小时 (2025-12-01 02:30 PM)',
      formatUS24: '美式 24小时 (12/01/2025 14:30)',
      formatUS12: '美式 12小时 (12/01/2025 02:30 PM)',
      formatEU24: '欧式 24小时 (01/12/2025 14:30)',
      formatEU12: '欧式 12小时 (01/12/2025 02:30 PM)',
      formatCN24: '中文 24小时 (2025年12月01日 14:30)',
      formatCN12: '中文 12小时 (2025年12月01日 02:30 下午)',
    },
    
    // 楼层对话外观
    threaded: {
      title: '楼层对话外观',
      contentFontSize: '正文文字大小',
      nameFontSize: '角色名称文字大小',
      badgeFontSize: '角色徽章文字大小',
      floorFontSize: '楼层号文字大小',
      avatarSize: '角色头像大小',
      chatWidth: '对话页面宽度',
      inputHeight: '底部输入框高度',
      inputBottomMargin: '底部输入框底边距',
      lineHeight: '正文行距',
      messageGap: '消息间距',
      cardRadius: '消息卡圆角',
      stripeWidth: '色条宽度',
      bgMaskOpacity: '背景图片遮罩不透明度',
      bgMaskBlur: '背景图片遮罩模糊',
      bgMaskBlurHint: '通过遮罩层对背景图应用高斯模糊（性能与质感权衡建议 0~12px）',
      msgBgOpacity: '楼层消息背景不透明度',
      listBgOpacity: '对话区容器背景不透明度',
      inputBgOpacity: '底部输入框背景不透明度',
      htmlStage: 'HTML 舞台（楼层内 iframe）',
      displayMode: '显示模式',
      displayModeAuto: '自适应高度（默认）',
      displayModeFixed: '固定容器（使用宽高比）',
      displayModeInline: '由沙盒内代码决定（缺省则自适应）',
      displayModeHint: '使用"由沙盒内代码决定"时，可在 HTML 中加入注释：<!-- st:display-mode=auto|fixed --> 若无声明则回退为自适应高度。',
      aspectRatio: '画面宽高比',
      preset: '预设',
      orCustom: '或 自定义',
      stageMaxWidth: '舞台最大宽度',
      stageMaxWidthHint: '以消息内容宽度为上限，设置相对百分比宽度',
      stagePadding: '舞台内边距',
      stageRadius: '舞台圆角',
      messageSidebarWidth: '消息侧边栏宽度',
      messageSidebarWidthHint: '调整消息列表左侧侧边栏的宽度（包括头像、徽章和楼层号）',
      iframeRenderOptimization: 'iframe 渲染优化',
      iframeRenderMode: 'iframe 渲染方式',
      iframeRenderModeAll: '全部渲染',
      iframeRenderModeTrackLatest: '追踪最新消息',
      iframeRenderModeTrackViewport: '追踪视图中的消息',
      iframeRenderModeHint: '选择渲染策略以优化内存使用。"全部渲染"会渲染所有HTML；"追踪最新消息"仅渲染最新N层；"追踪视图"仅渲染视口附近的消息',
      iframeRenderRange: '渲染层数范围',
      layers: '层',
      iframeRenderRangeHint: '设置渲染的楼层数量。数值越小，内存占用越低，但滚动时可能需要重新渲染',
      tuningTip: '拖拽滑条时，页面会自动变透明，仅保留本面板不透明，便于实时查看调整效果。',
    },
  },

  // ==================== 应用设置面板 ====================
  appSettings: {
    title: '应用设置 App Settings',
    optionsTitle: '选项',
    optionsDesc: '与主页 Options 完全一致的设置项：主题切换为"系统/浅色/深色"。',
    
    language: {
      label: '语言',
      zhCN: '简体中文',
      enUS: 'English',
      jaJP: '日本語',
    },
    
    theme: {
      label: '主题',
      current: '正在使用',
    },
    
    backend: {
      label: '后端 API 地址',
      placeholder: 'http://localhost:8050',
    },
    
    uiScale: {
      label: 'UI 缩放',
      placeholder: '1.0',
      hint: '调整全局界面缩放比例（0.5 - 2.0），默认为 1.0',
    },
  },

  // ==================== 提示消息 ====================
  toast: {
    plugin: {
      loaded: '已加载插件：{name}',
      loadFailed: '加载失败：{error}',
      unloaded: '已卸载插件：{name}',
      unloadFailed: '卸载失败：{error}',
      notFound: '未找到已加载的插件实例',
      enabled: '已启用插件：{name}',
      disabled: '已禁用插件：{name}',
      missingSwitch: '缺失插件开关文件（plugins_switch.json）',
      dirMissing: '插件目录缺失：{path}',
      importedAndEnabled: '已导入并启用插件：{name}',
      imported: '已导入插件：{name}',
      importAutoLoadFailed: '插件已导入，但自动加载失败：{error}',
    },
    
    save: {
      success: '保存成功',
      failed: '保存失败：{error}',
    },
    
    import: {
      success: '导入成功',
      failed: '导入失败：{error}',
    },
    
    export: {
      success: '导出成功',
      failed: '导出失败：{error}',
    },
  },

  // ==================== 语言设置 ====================
  language: {
    title: '语言设置',
    current: '当前语言',
    select: '选择语言',
    
    // 语言名称
    zhCN: '简体中文',
    zhTW: '繁體中文',
    enUS: 'English',
    jaJP: '日本語',
    koKR: '한국어',
  },

  // ==================== 特殊组件名称 ====================
  specialComponents: {
    charBefore: 'char Before',
    personaDescription: 'Persona Description',
    charDescription: 'Char Description',
    charAfter: 'char After',
    chatHistory: 'Chat History',
  },

  // ==================== 角色相关 ====================
  role: {
    system: '系统',
    user: '用户',
    assistant: '助手',
  },

  // ==================== 位置相关 ====================
  position: {
    relative: '相对位置',
    inChat: '聊天内',
    before: '之前',
    after: '之后',
  },

  // ==================== 通用组件 ====================
  components: {
    topBar: {
      viewThreaded: '对话楼层',
      viewSandbox: '全局沙盒',
      viewStart: '开始',
    },
    modal: {
      defaultTitle: '详细内容',
      closeEsc: '关闭 (ESC)',
    },
    modeSwitch: {
      threaded: '对话楼层',
      sandbox: '全局沙盒（占位）',
    },
    themeSwitch: {
      system: '系统',
      light: '亮',
      dark: '暗',
      switchTo: '切换主题：{label}',
    },
    optionsPanel: {
      cancel: '取消',
      confirm: '确定',
    },
    toasts: {
      success: '成功',
      warning: '提示',
      error: '错误',
      info: '消息',
      close: '关闭',
    },
  },

  // ==================== 卡片组件 ====================
  cards: {
    // 通用
    common: {
      edit: '编辑',
      save: '保存',
      cancel: '取消',
      delete: '删除',
      enabled: '已启用',
      disabled: '未启用',
      notSet: '未设置',
      empty: '(空)',
      noContent: '（暂无内容）',
    },
    // 预设提示词卡片
    presetPrompt: {
      name: '名称',
      enabledStatus: '启用状态',
      role: '角色（role）',
      depth: '深度（depth）',
      order: '顺序（order）',
      content: '内容（content）',
    },
    // 正则规则卡片
    regexRule: {
      phase: '阶段',
      targets: 'targets',
      views: 'views',
      condition: 'condition',
      findRegex: 'find_regex',
      replaceRegex: 'replace_regex',
      name: '名称',
      enabledStatus: '启用状态',
      placement: '阶段（placement）',
      mode: '模式（mode）',
      targetCategories: 'Targets',
      categoryLabel: '大类',
      detailLabel: '细项',
      viewsLabel: 'Views',
      conditionExpr: 'condition（条件表达式）',
      conditionPlaceholder: "示例：{{ keywords('艾拉','工程师') }} 或 true/false",
      minDepth: 'min_depth（可选）',
      maxDepth: 'max_depth（可选）',
      description: '描述（可选）',
    },
    // 世界书卡片
    worldBook: {
      id: 'ID',
      idPlaceholder: '例如：1 或 my-id',
      name: '名称',
      enabledLabel: '已启用',
      mode: '模式',
      position: '位置（position）',
      positionFraming: 'framing（角色前后）',
      positionInChat: 'in-chat（插入对话）',
      orderLabel: 'order（排序权重）',
      depthLabel: 'depth（注入深度）',
      conditionLabel: 'condition（条件表达式，支持宏）',
      conditionPlaceholder: "示例：{{ keywords('艾拉','工程师') }}",
      content: '内容',
      notSetCondition: '(未设置)',
      errorIdRequired: '请填写 ID',
    },
  },

  // ==================== 应用级别 ====================
  app: {
    // 加载状态
    loading: {
      conversation: '正在加载对话...',
      sandbox: '正在加载sandbox项目...',
    },
    // Toast 消息
    toast: {
      loadSuccess: '已加载对话',
      loadFailed: '读取对话失败',
    },
    // 错误消息
    error: {
      getContentFailed: '获取对话内容失败',
      loadFailed: '加载对话失败',
      createFailed: '创建对话后处理失败',
    },
    // 空状态
    empty: {
      conversation: '（空对话）',
    },
    // 详情弹窗标题
    detail: {
      preset: '预设详情 - {name}',
      worldbook: '世界书详情 - {name}',
      character: '角色卡详情 - {name}',
      persona: '用户信息详情 - {name}',
      regex: '正则规则详情 - {name}',
      aiconfig: 'AI配置详情 - {name}',
    },
    // 模态框默认标题
    modal: {
      newChat: '新建对话',
      loadGame: '读取存档',
      appearance: '外观',
      plugins: '插件',
      options: '选项',
    },
  },
  
  // ==================== 首页组件 ====================
  home: {
    // 主页菜单按钮
    menu: {
      newGame: 'New Game',
      loadGame: 'Load Game',
      gallery: 'Gallery',
      options: 'Options',
    },
    // 插件展示
    plugins: {
      title: '插件',
      description: '浏览已安装的插件，查看插件详情。',
      empty: '暂无插件，请前往侧边栏插件面板管理插件。',
    },
    // 读取存档
    loadGame: {
      title: '读取存档',
      roleUser: '用户',
      roleAssistant: '助手',
      roleSystem: '系统',
      roleUnknown: '未知',
      characterCard: '角色卡',
      floor: '楼层',
      noLatestMessage: '无最新消息',
      getLatestFailed: '获取最新消息失败',
      loadFailed: '加载失败',
      notFound: '未找到对话存档',
      emptyHint: '暂无历史对话，开始新对话后将在此处显示',
      confirm: '确认',
      delete: '删除',
    },
    // 新建对话
    newChat: {
      title: '新建对话',
      loading: '正在加载列表…',
      creating: '正在创建…',
      nameLabel: '新对话名称',
      namePlaceholder: '请输入对话名称',
      nameHelp: '允许字符：中文、字母、数字、空格、-、_；特殊字符（/ \\ : * ? " < > |）将被直接替换为"-"。',
      nameReplaced: '已替换不允许的字符为"-"以确保文件名安全。',
      nameDupFile: '文件名已占用：{name}.json 已存在，请更换名称。',
      nameDupTitle: '内部名称已占用：已有对话的 name 与"{name}"重复，请更换名称。',
      descLabel: '描述（可选）',
      descPlaceholder: '请输入对话描述',
      llmConfigLabel: 'AI配置（可选）',
      llmConfigPlaceholder: '可留空，使用默认AI配置',
      presetLabel: '预设（必选）',
      presetPlaceholder: '请选择预设',
      characterLabel: '角色卡（必选）',
      characterPlaceholder: '请选择角色卡',
      personaLabel: '用户信息（必选）',
      personaPlaceholder: '请选择用户信息',
      regexLabel: '正则（可选）',
      worldbookLabel: '世界书（可选）',
      optional: '（可不选）',
      configPanelTitle: '对话配置',
      configPanelSubtitle: '预设（必选） · 角色卡（必选） · 用户信息（必选） · 正则（可选） · 世界书（可选） · AI配置（可选）',
      typeLabel: '对话类型',
      typeThreaded: '对话楼层',
      typeThreadedSub: 'Threaded Chat',
      typeSandbox: '前端沙盒',
      typeSandboxSub: 'Frontend Sandbox',
      requiredError: '请先填写名称，并选择：预设、角色卡、用户信息（必选）',
      duplicateError: '对话名称重复：请更换一个名称（文件名或内部 name 不可重复）',
      createFailed: '创建对话失败',
      listFailed: '加载列表失败',
      convListFailed: '加载对话列表失败',
      confirm: '确认',
      cancel: '取消',
    },
    // 选项
    options: {
      title: '选项',
      desc: '主页选项与侧边栏保持一致：主题切换为"系统/浅色/深色"。',
      language: '语言',
      theme: '主题',
      themeSystem: '系统',
      themeLight: '浅色',
      themeDark: '深色',
      themeUsing: '正在使用：{theme}',
      backendApi: '后端 API 地址',
      save: '保存',
      reset: '重置',
    },
  },

  // ==================== 服务层 ====================
  services: {
    dataCatalog: {
      unnamed: '未命名',
    },
    routerClient: {
      routerNotInjected: '路由器未注入或不支持 call(action, ...)',
    },
  },

  // ==================== 状态存储 ====================
  stores: {
    character: {
      defaultAvatarLetter: '助',
    },
    persona: {
      defaultAvatarLetter: '用',
    },
  },

  // ==================== 工具函数 ====================
  utils: {
    resourceLoader: {
      done: '完成',
      loadComplete: '加载完成',
      loading: '正在加载: {resource} ({progress}%)',
    },
  },

  // ==================== 工作流插槽 ====================
  slots: {
    homeMenu: {
      newGame: '新游戏',
      loadGame: '读取存档',
      appearance: '外观',
      plugins: '插件',
      options: '设置',
    },
    sidebar: {
      presets: {
        label: '预设',
        desc: '管理提示词预设与切换',
      },
      worldbooks: {
        label: '世界书',
        desc: '设定世界观/术语库',
      },
      characters: {
        label: '角色卡',
        desc: '管理角色信息卡',
      },
      personas: {
        label: '用户信息',
        desc: '配置用户画像与偏好',
      },
      regexrules: {
        label: '正则规则',
        desc: '清洗/后处理规则',
      },
      llmconfigs: {
        label: 'LLM配置',
        desc: '全局AI提供商与参数',
      },
      plugins: {
        label: '插件',
        desc: '管理前端插件',
      },
      appearance: {
        label: '外观',
        desc: '主题与外观设定',
      },
      app: {
        label: '应用设置',
        desc: '全局应用行为与高级选项',
      },
    },
  },

  // ==================== 工作流编排器 ====================
  orchestrator: {
    placeholderCompletionFail: '占位/补全触发失败: {error}',
    retryCompletionFail: '重试补全触发失败: {error}',
    createAssistBranchFail: '创建助手分支失败: {error}',
  },

  // ==================== 工作流控制器 ====================
  workflow: {
    controllers: {
      branch: {
        readTableFailMissingParam: '读取分支表失败：缺少参数',
        readTableFail: '读取分支表失败',
        switchFailIncompleteParam: '切换分支失败：参数不完整',
        switchSuccess: '分支已切换',
        switchFail: '切换分支失败',
        deleteFailIncompleteParam: '删除分支失败：参数不完整',
        deleteSuccess: '分支已删除',
        deleteFail: '删除分支失败',
        retryFailIncompleteParam: '重试失败：参数不完整',
        retryAssistSuccess: '已创建新分支',
        retryAssistFail: '创建新分支失败',
        retryUserSuccess: '已触发智能重试',
        retryUserFail: '智能重试失败',
        truncateFailIncompleteParam: '修剪失败：参数不完整',
        truncateSuccess: '已修剪分支',
        truncateFail: '修剪失败',
      },
      catalog: {
        unknownResourceType: '未知的资源类型: {category}',
      },
      completion: {
        completionFail: '补全失败',
        routerNotInjected: 'Prompt Router 未注入或不支持调用',
        completionCancelled: '补全已取消',
      },
      message: {
        sendFailIncompleteParam: '发送失败：参数不完整',
        sendSuccess: '消息已发送',
        sendFail: '消息发送失败',
        editFailIncompleteParam: '编辑失败：参数不完整',
        editSuccess: '消息已保存',
        editFail: '消息保存失败',
      },
      settings: {
        missingConversationFile: '缺少conversationFile参数',
        missingOrInvalidPatch: '缺少或无效的patch参数',
      },
    },
  },

  // ==================== 聊天组件 ====================
  chat: {
    iframe: {
      notRendered: 'HTML 内容未渲染',
      notRenderedHint: '此消息的 HTML 内容已被优化隐藏以节省内存',
    },
    input: {
      expand: '拓展',
      send: '发送',
      sending: '发送中',
      stop: '停止',
      stopWaiting: '停止等待',
      placeholder: '输入消息... (Enter 发送，Shift+Enter 换行)',
      sendShortcut: '发送 (Enter)',
    },
    
    message: {
      avatarAlt: '{name}的头像',
      floorIndex: '楼层序号',
      moreActions: '更多操作',
      more: '更多',
      copy: '复制',
      copied: '已复制',
      retry: '重试',
      editPlaceholder: '输入消息内容...',
      saveShortcut: '保存 (Ctrl+Enter)',
      cancelShortcut: '取消 (Esc)',
      
      // 状态
      waiting: '等待中...{seconds}s',
      waitingAI: '等待AI响应（{seconds}s）',
      sendSuccess: '发送成功',
      deleting: '删除中...',
      deleteSuccess: '删除成功',
      deleteFailed: '删除失败',
      switchedToBranch: '已切换到相邻分支',
      saving: '保存中...',
      saveSuccess: '保存成功',
      saveFailed: '保存失败',
    },
    
    branch: {
      switching: '切换中...',
      switched: '已切换',
      prevBranch: '切换到前一个分支',
      nextBranch: '切换到下一个分支',
      createNew: '创建新分支（重试）',
    },
    
    errors: {
      aiCallFailed: 'AI调用失败',
      noConversationFile: '无对话文件，跳过分支信息加载',
      cannotDetermineParentId: '无法确定父节点ID',
      missingConversationFile: '缺少对话文件',
      loadBranchFailed: '加载分支信息失败',
      switchBranchFailed: '切换分支失败',
      cannotDelete: '无法删除：缺少 conversationFile',
      cannotSaveEdit: '无法保存编辑：缺少 conversationFile',
      retryFailed: '重试失败',
      sendFailed: '发送失败',
      noConversationDoc: '没有对话文件或文档，无法发送消息',
      missingFileOrDoc: '缺少对话文件或文档',
      avatarLoadFailed: '头像加载失败，使用默认样式',
    },
  },
}

export default zhCN

// 导出类型（用于其他语言包的类型约束）
export type LocaleMessages = typeof zhCN