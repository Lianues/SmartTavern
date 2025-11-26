/**
 * SmartTavern English Language Pack
 * 
 * Structure:
 * - common: Common text (buttons, status, etc.)
 * - panel: Panel related
 * - modal: Modal dialogs
 * - error: Error messages
 * - sidebar: Sidebar
 * - detail: Detail pages
 * - home: Home menu
 * - toast: Toast messages
 */

const enUS = {
  // ==================== Common Text ====================
  common: {
    // Buttons
    import: 'Import',
    export: 'Export',
    close: 'Close',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    delete: 'Delete',
    use: 'Use',
    using: 'In Use',
    view: 'View',
    add: 'Add',
    edit: 'Edit',
    refresh: 'Refresh',
    reset: 'Reset',
    apply: 'Apply',
    enable: 'Enable',
    disable: 'Disable',
    enabled: 'Enabled',
    disabled: 'Disabled',
    
    // Status
    loading: 'Loading...',
    importing: 'Importing...',
    exporting: 'Exporting...',
    saving: 'Saving...',
    saved: 'Saved!',
    checking: 'Checking...',
    processing: 'Processing...',
    
    // Form
    name: 'Name',
    description: 'Description',
    id: 'ID',
    folder: 'Folder',
    file: 'File',
    type: 'Type',
    content: 'Content',
    value: 'Value',
    
    // Other
    noDescription: 'No description',
    noData: 'No data',
    unknown: 'Unknown',
    none: 'None',
    all: 'All',
    selected: 'Selected',
    required: 'Required',
    optional: 'Optional',
  },

  // ==================== Panel Titles & Actions ====================
  panel: {
    presets: {
      title: 'Presets',
      importTitle: 'Import Preset (.json, .zip, .png)',
      exportTitle: 'Export Preset',
      typeName: 'preset',
    },
    worldBooks: {
      title: 'World Books',
      importTitle: 'Import World Book (.json, .zip, .png)',
      exportTitle: 'Export World Book',
      typeName: 'world book',
    },
    characters: {
      title: 'Characters',
      importTitle: 'Import Character (.json, .zip, .png)',
      exportTitle: 'Export Character',
      typeName: 'character',
    },
    personas: {
      title: 'Personas',
      importTitle: 'Import Persona (.json, .zip, .png)',
      exportTitle: 'Export Persona',
      typeName: 'persona',
    },
    regexRules: {
      title: 'Regex Rules',
      importTitle: 'Import Regex Rule (.json, .zip, .png)',
      exportTitle: 'Export Regex Rule',
      typeName: 'regex rule',
    },
    llmConfigs: {
      title: 'AI Configs',
      importTitle: 'Import AI Config (.json, .zip, .png)',
      exportTitle: 'Export AI Config',
      typeName: 'AI config',
    },
    plugins: {
      title: 'Plugins',
      importTitle: 'Import Plugin (.json, .zip, .png)',
      exportTitle: 'Export Plugin',
      typeName: 'plugin',
      hint: 'Manage plugins (backend plugins directory): Load / Unload. Imported plugins will be automatically enabled.',
    },
    appearance: {
      title: 'Appearance',
    },
    appSettings: {
      title: 'App Settings',
    },
  },

  // ==================== Import Conflict Dialog ====================
  importConflict: {
    title: '⚠️ Name Conflict',
    message: 'A {type} folder named "{name}" already exists.',
    hint: 'Please choose how to handle this:',
    
    overwrite: {
      title: 'Overwrite existing {type}',
      desc: 'Delete the old {type} and replace with the imported content',
    },
    rename: {
      title: 'Keep both (rename)',
      desc: 'Enter a new name for the {type}:',
      placeholder: 'Enter new name',
      button: 'Confirm',
    },
    
    cancelButton: 'Cancel Import',
    
    errors: {
      emptyName: 'Please enter a name',
      nameExists: 'Name "{name}" already exists, please use a different name',
    },
  },

  // ==================== Export Dialog ====================
  exportModal: {
    title: 'Export {type}',
    selectItem: 'Select {type}',
    
    format: {
      title: 'Export Format',
      zip: {
        title: 'ZIP Archive',
        desc: 'Standard compressed format, easy to share',
      },
      png: {
        title: 'PNG Image',
        desc: 'Data embedded in image, can preview directly',
      },
    },
    
    embedImage: {
      title: 'Embed Image (Optional)',
      hint: 'Select a PNG image as carrier, data will be embedded in it',
      dropzone: 'Click to select or drag image here',
      note: 'PNG format only. If not selected, will use {type} icon',
    },
    
    cancelButton: 'Cancel',
    confirmButton: 'Confirm Export',
    
    errors: {
      noSelection: 'Please select a {type} to export',
      noPath: 'Cannot get {type} path',
      pngOnly: 'Please select a PNG format image',
    },
  },

  // ==================== Error Messages ====================
  error: {
    loadFailed: 'Load failed: {error}',
    importFailed: 'Import failed',
    exportFailed: 'Export failed',
    saveFailed: 'Save failed: {error}',
    deleteFailed: 'Delete failed: {error}',
    networkError: 'Network error',
    unknownError: 'Unknown error',
    unknownType: 'Unknown type: {type}',
    getDetailFailed: 'Failed to get details',
    invalidFileType: 'Unsupported file type: {ext}. Please select .json, .zip, or .png file',
    missingFilePath: 'Missing file path, cannot save',
    operationFailed: 'Operation failed: {error}',
  },

  // ==================== Sidebar ====================
  sidebar: {
    title: 'Settings',
    collapse: 'Collapse',
    expand: 'Expand Sidebar',
    configPreview: 'Config Preview',
    configPreviewHint: 'Configuration entry displayed on the right side of chat page (preview placeholder)',
    
    viewMode: {
      threaded: 'Threaded',
      sandbox: 'Frontend',
    },
    
    theme: {
      dark: 'Dark',
      light: 'Light',
      system: 'System',
    },
  },

  // ==================== Detail Pages ====================
  detail: {
    preset: {
      title: 'Preset Details',
      editMode: 'Edit Mode',
      editHint: 'This page supports full editing, adding, deleting, and drag-to-sort',
      saveToBackend: 'Save to Backend',
      saving: 'Saving',
      saved: 'Saved!',
      saveFailed: 'Save failed',
      
      basicInfo: 'Basic Info',
      
      apiConfig: {
        title: 'API Config',
        enableTitle: 'Enable API Config',
        enabled: 'Enabled',
        notEnabled: 'Not enabled',
        enable: 'Enable',
        temperature: 'Temperature',
        topP: 'Top P',
        topK: 'Top K',
        maxContext: 'Max Context',
        maxTokens: 'Max Tokens',
        stream: 'Streaming (stream)',
        frequencyPenalty: 'Frequency Penalty',
        presencePenalty: 'Presence Penalty',
        on: 'On',
      },
      
      prompts: {
        title: 'Prompt Editor',
        items: 'Prompt Items',
        relative: 'Relative Items',
        inChat: 'In-Chat Items',
        selectSpecial: 'Select Special Component',
        addSpecial: 'Add Special',
        dragToSort: 'Drag to Sort',
      },
      
      regex: {
        title: 'Regex Editor',
        empty: 'No rules yet. Enter in the top right corner and click Add',
      },
      
      errors: {
        idRequired: 'Please fill in ID',
        nameRequired: 'Please fill in name',
        reservedConflict: 'ID or name conflicts with reserved components',
        idExists: 'ID already exists',
        nameExists: 'Name already exists',
        specialExists: 'This special component already exists',
      },
    },
    
    character: {
      title: 'Character Details',
      pageTitle: 'Character Card Editor',
      editMode: 'Edit Mode',
      editHint: 'This page supports editing basic info, initial messages, embedded world books, and regex rules',
      
      basicInfo: 'Basic Settings',
      characterName: 'Character Name',
      characterDesc: 'Character Description',
      
      messages: {
        title: 'Initial Messages',
        addNew: 'Add Message',
        empty: 'No initial messages. Click "Add Message" button to add',
        messageNum: 'Message #{num}',
        charCount: 'Characters',
      },
      
      worldBook: {
        title: 'Embedded World Book',
        empty: 'No world book entries',
        idPlaceholder: 'ID',
        namePlaceholder: 'Name',
        defaultName: 'Character World Book',
      },
      
      regexRules: {
        title: 'Regex Rules',
        empty: 'No regex rules',
        idPlaceholder: 'Rule ID',
        namePlaceholder: 'Rule Name',
      },
      
      errors: {
        wbIdRequired: 'Please fill in world book ID',
        wbNameRequired: 'Please fill in world book name',
        wbIdExists: 'ID already exists',
        ruleIdRequired: 'Please fill in rule ID',
        ruleNameRequired: 'Please fill in rule name',
        ruleIdExists: 'ID already exists',
      },
    },
    
    persona: {
      title: 'Persona Details',
      pageTitle: 'Persona Editor',
      editMode: 'Edit Mode',
      editHint: 'This page is for editing user information including name and description',
      
      basicInfo: 'Basic Info',
      userName: 'User Name',
      userNamePlaceholder: 'Enter user name',
      userDesc: 'User Description',
      userDescPlaceholder: 'Enter user description, can include preferences, background, conversation style, etc.',
      currentValue: 'Current',
      notSet: '(Not set)',
      charCount: 'Characters',
      
      notes: {
        title: 'Notes',
        line1: 'Persona is used to define user identity, preferences, and conversation style',
        line2: 'Auto-saves when input loses focus',
        line3: 'Click "Reset" button to restore to currently saved content',
      },
      
      preview: {
        title: 'Currently Saved Data',
      },
    },
    
    worldBook: {
      title: 'World Book Details',
      entries: 'Entry List',
      addEntry: 'Add Entry',
      
      pageTitle: 'World Book Details',
      editMode: 'Edit Mode',
      editHint: 'This page supports full editing, adding, deleting, and drag-to-sort',
      saveFailed: 'Save failed',
      
      basicInfo: 'Basic Info',
      
      toolbar: {
        entryCount: 'Entry Count',
        idPlaceholder: 'ID',
        namePlaceholder: 'Name',
      },
      
      editor: {
        title: 'World Book Editor',
        empty: 'No world book entries. Enter in the top right corner and click Add',
      },
      
      errors: {
        idRequired: 'Please fill in ID',
        nameRequired: 'Please fill in name',
        idExists: 'ID already exists',
      },
    },
    
    regexRule: {
      title: 'Regex Rule Details',
      findRegex: 'Find Regex',
      replaceRegex: 'Replace With',
      targets: 'Targets',
      placement: 'Placement',
      views: 'Views',
      
      pageTitle: 'Regex Rule Editor',
      editMode: 'Edit Mode',
      editHint: 'This page is for editing independent regex rule sets, supports adding, editing, deleting, and drag-to-sort',
      saveFailed: 'Save failed',
      
      basicInfo: 'Basic Info',
      
      toolbar: {
        ruleCount: 'Rule Count',
        idPlaceholder: 'ID',
        namePlaceholder: 'Name',
      },
      
      list: {
        title: 'Regex Rule List',
        empty: 'No regex rules. Enter in the top right corner and click Add',
      },
      
      notes: {
        title: 'Usage Notes',
        line1: 'Regex rules are for text post-processing, supporting find and replace operations',
        line2: 'Each rule can set targets and views',
        line3: 'Supports depth filtering (min_depth / max_depth)',
        line4: 'Click "Edit" button to expand the full edit form',
        line5: 'Use the grip icon on the left to drag and reorder rules',
      },
      
      errors: {
        idRequired: 'Please fill in ID',
        nameRequired: 'Please fill in name',
        idExists: 'ID already exists',
      },
    },
    
    llmConfig: {
      title: 'AI Config Details',
      editMode: 'Edit Mode',
      editHint: 'This page supports full editing of AI configuration parameters',
      saveFailed: 'Save failed',
      
      basicInfo: 'Basic Info',
      baseConfig: 'Base Config',
      
      provider: 'Provider',
      baseUrl: 'Base URL',
      apiKey: 'API Key',
      model: 'Model',
      modelPlaceholder: 'e.g., gpt-4o-mini',
      selectModel: 'Select Model',
      modelListPlaceholder: 'Select model (placeholder)',
      
      requestParams: {
        title: 'Request Parameters',
        maxTokens: 'max_tokens',
        temperature: 'temperature',
        topP: 'top_p',
        presencePenalty: 'presence_penalty',
        frequencyPenalty: 'frequency_penalty',
        stream: 'Streaming',
        on: 'On',
      },
      
      network: {
        title: 'Network & Logging',
        connectTimeout: 'Connection Timeout (sec)',
        requestTimeout: 'Request Timeout (sec)',
        enableLogging: 'Enable Logging',
      },
      
      customParams: {
        title: 'Custom Parameters (JSON)',
        hint: 'Enter custom parameters in JSON format, will be merged into request',
      },
      
      gemini: {
        title: 'Gemini Advanced Config',
        stopSequences: 'stopSequences (comma-separated)',
        safetySettings: 'safetySettings (JSON)',
        customParams: 'customParams (JSON)',
      },
      
      anthropic: {
        title: 'Anthropic Advanced Config',
        stopSequences: 'stop_sequences (comma-separated)',
        enableThinking: 'enable_thinking',
        thinkingBudget: 'thinking_budget',
      },
      
      errors: {
        jsonFormatError: 'JSON format error',
        fixJsonErrors: 'Please fix JSON format errors before saving',
      },
    },
  },

  // ==================== Appearance Panel ====================
  appearance: {
    title: 'Appearance',
    tabs: {
      home: 'Home',
      threaded: 'Threaded Chat',
      sandbox: 'Fullscreen Sandbox',
      backgrounds: 'Backgrounds',
      theme: 'Theme',
    },
    placeholder: 'This is a placeholder page for configuring home page options.',
    unknownTab: 'Unknown Tab',
    placeholderContent: 'Placeholder Content',
    
    // Background Image Management
    backgrounds: {
      title: 'Background Images',
      desc: 'Set background images for Start page, Threaded Chat page, and Sandbox page. Can override default images with instant preview.',
      startPage: 'Start Page',
      threadedPage: 'Threaded Chat Page',
      sandboxPage: 'Sandbox Page',
      selectImage: 'Select Image',
      resetDefault: 'Reset Default',
    },
    
    // Sandbox Appearance
    sandbox: {
      title: 'Fullscreen Sandbox Appearance',
      desc: 'Configure sandbox stage dimensions and aspect ratio for embedding visuals/preview alignment.',
      displayMode: 'Display Mode',
      displayModeAuto: 'Auto Height (Default)',
      displayModeFixed: 'Fixed Container (Use Aspect Ratio)',
      displayModeInline: 'Determined by Sandbox Code (Fallback to Auto)',
      displayModeHint: 'When using "Determined by Sandbox Code", add comment in HTML: <!-- st:display-mode=auto|fixed --> Falls back to auto height if not declared.',
      aspectRatio: 'Aspect Ratio',
      preset: 'Preset',
      orCustom: 'or Custom',
      stageMaxWidth: 'Stage Max Width',
      sliderMax: 'Slider Max',
      stagePadding: 'Stage Padding',
      stageRadius: 'Stage Radius',
      bgMaskOpacity: 'Background Mask Opacity',
      bgMaskBlur: 'Background Mask Blur',
      bgMaskBlurHint: 'Apply Gaussian blur to background via mask layer (recommend 0~12px, higher values may affect performance)',
      stageBgOpacity: 'Stage Background Opacity',
      tip: 'Tip: These settings apply in real-time to the "Global Sandbox" stage and are saved as CSS variables for theme/script integration.',
    },
    
    // Theme Management
    theme: {
      title: 'Theme Management',
      desc: 'Import external theme packages (.json/.sttheme.json) or reset to built-in style.',
      importTitle: 'Import Theme Package',
      selectFile: 'Select .json / .sttheme.json',
      importHint: 'Theme packages contain tokens and optional CSS; applied settings persist in browser.',
      quickTry: 'Quick Try',
      applyDemo: 'Apply Demo Theme',
      enableExtension: 'Enable sample extension: Rounded Shadow Follow',
      extensionHint: 'Extensions only link style tokens, no external scripts; can be disabled anytime.',
      currentTheme: 'Current Theme',
      applied: 'Applied',
      notApplied: 'Not Applied',
      name: 'Name',
      id: 'ID',
      version: 'Version',
      unnamed: 'Unnamed',
      resetDefault: 'Reset to Default Theme',
    },
    
    // Threaded Chat Appearance
    threaded: {
      title: 'Threaded Chat Appearance',
      contentFontSize: 'Content Font Size',
      nameFontSize: 'Name Font Size',
      badgeFontSize: 'Badge Font Size',
      floorFontSize: 'Floor Number Font Size',
      avatarSize: 'Avatar Size',
      chatWidth: 'Chat Page Width',
      inputHeight: 'Input Box Height',
      lineHeight: 'Line Height',
      messageGap: 'Message Gap',
      cardRadius: 'Message Card Radius',
      stripeWidth: 'Color Stripe Width',
      bgMaskOpacity: 'Background Mask Opacity',
      bgMaskBlur: 'Background Mask Blur',
      bgMaskBlurHint: 'Apply Gaussian blur to background via mask layer (recommend 0~12px for performance/quality balance)',
      msgBgOpacity: 'Message Background Opacity',
      listBgOpacity: 'Chat Container Background Opacity',
      inputBgOpacity: 'Input Box Background Opacity',
      htmlStage: 'HTML Stage (In-floor iframe)',
      displayMode: 'Display Mode',
      displayModeAuto: 'Auto Height (Default)',
      displayModeFixed: 'Fixed Container (Use Aspect Ratio)',
      displayModeInline: 'Determined by Sandbox Code (Fallback to Auto)',
      displayModeHint: 'When using "Determined by Sandbox Code", add comment in HTML: <!-- st:display-mode=auto|fixed --> Falls back to auto height if not declared.',
      aspectRatio: 'Aspect Ratio',
      preset: 'Preset',
      orCustom: 'or Custom',
      stageMaxWidth: 'Stage Max Width',
      stageMaxWidthHint: 'Set relative percentage width with message content width as upper limit',
      stagePadding: 'Stage Padding',
      stageRadius: 'Stage Radius',
      tuningTip: 'When dragging sliders, the page will become transparent, leaving only this panel opaque for real-time preview.',
    },
  },

  // ==================== App Settings Panel ====================
  appSettings: {
    title: 'App Settings',
    optionsTitle: 'Options',
    optionsDesc: 'Same settings as Home Options: Theme switch between "System/Light/Dark".',
    
    language: {
      label: 'Language',
      zhCN: '简体中文',
      enUS: 'English',
      jaJP: '日本語',
    },
    
    theme: {
      label: 'Theme',
      current: 'Currently using',
    },
    
    backend: {
      label: 'Backend API URL',
      placeholder: 'http://localhost:8050',
    },
  },

  // ==================== Toast Messages ====================
  toast: {
    plugin: {
      loaded: 'Loaded plugin: {name}',
      loadFailed: 'Load failed: {error}',
      unloaded: 'Unloaded plugin: {name}',
      unloadFailed: 'Unload failed: {error}',
      notFound: 'Loaded plugin instance not found',
      enabled: 'Enabled plugin: {name}',
      disabled: 'Disabled plugin: {name}',
      missingSwitch: 'Missing plugin switch file (plugins_switch.json)',
      dirMissing: 'Plugin directory missing: {path}',
      importedAndEnabled: 'Imported and enabled plugin: {name}',
      imported: 'Imported plugin: {name}',
      importAutoLoadFailed: 'Plugin imported, but auto-load failed: {error}',
    },
    
    save: {
      success: 'Save successful',
      failed: 'Save failed: {error}',
    },
    
    import: {
      success: 'Import successful',
      failed: 'Import failed: {error}',
    },
    
    export: {
      success: 'Export successful',
      failed: 'Export failed: {error}',
    },
  },

  // ==================== Language Settings ====================
  language: {
    title: 'Language Settings',
    current: 'Current Language',
    select: 'Select Language',
    
    // Language Names
    zhCN: '简体中文',
    zhTW: '繁體中文',
    enUS: 'English',
    jaJP: '日本語',
    koKR: '한국어',
  },

  // ==================== Special Component Names ====================
  specialComponents: {
    charBefore: 'char Before',
    personaDescription: 'Persona Description',
    charDescription: 'Char Description',
    charAfter: 'char After',
    chatHistory: 'Chat History',
  },

  // ==================== Roles ====================
  role: {
    system: 'System',
    user: 'User',
    assistant: 'Assistant',
  },

  // ==================== Positions ====================
  position: {
    relative: 'Relative Position',
    inChat: 'In Chat',
    before: 'Before',
    after: 'After',
  },

  // ==================== Common Components ====================
  components: {
    topBar: {
      viewThreaded: 'Threaded Chat',
      viewSandbox: 'Global Sandbox',
      viewStart: 'Start',
    },
    modal: {
      defaultTitle: 'Details',
      closeEsc: 'Close (ESC)',
    },
    modeSwitch: {
      threaded: 'Threaded Chat',
      sandbox: 'Global Sandbox (Placeholder)',
    },
    themeSwitch: {
      system: 'System',
      light: 'Light',
      dark: 'Dark',
      switchTo: 'Switch theme: {label}',
    },
    optionsPanel: {
      cancel: 'Cancel',
      confirm: 'Confirm',
    },
    toasts: {
      success: 'Success',
      warning: 'Warning',
      error: 'Error',
      info: 'Info',
      close: 'Close',
    },
  },

  // ==================== Card Components ====================
  cards: {
    // Common
    common: {
      edit: 'Edit',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      enabled: 'Enabled',
      disabled: 'Disabled',
      notSet: 'Not set',
      empty: '(Empty)',
      noContent: '(No content)',
    },
    // Preset Prompt Card
    presetPrompt: {
      name: 'Name',
      enabledStatus: 'Enabled Status',
      role: 'Role',
      depth: 'Depth',
      order: 'Order',
      content: 'Content',
    },
    // Regex Rule Card
    regexRule: {
      phase: 'Phase',
      targets: 'Targets',
      views: 'Views',
      condition: 'Condition',
      findRegex: 'find_regex',
      replaceRegex: 'replace_regex',
      name: 'Name',
      enabledStatus: 'Enabled Status',
      placement: 'Placement',
      mode: 'Mode',
      targetCategories: 'Targets',
      categoryLabel: 'Category',
      detailLabel: 'Details',
      viewsLabel: 'Views',
      conditionExpr: 'Condition (expression)',
      conditionPlaceholder: "e.g., {{ keywords('Alice','Engineer') }} or true/false",
      minDepth: 'min_depth (optional)',
      maxDepth: 'max_depth (optional)',
      description: 'Description (optional)',
    },
    // World Book Card
    worldBook: {
      id: 'ID',
      idPlaceholder: 'e.g., 1 or my-id',
      name: 'Name',
      enabledLabel: 'Enabled',
      mode: 'Mode',
      position: 'Position',
      positionFraming: 'framing (before/after character)',
      positionInChat: 'in-chat (insert in conversation)',
      orderLabel: 'Order (sort weight)',
      depthLabel: 'Depth (injection depth)',
      conditionLabel: 'Condition (expression, supports macros)',
      conditionPlaceholder: "e.g., {{ keywords('Alice','Engineer') }}",
      content: 'Content',
      notSetCondition: '(Not set)',
      errorIdRequired: 'Please fill in ID',
    },
  },

  // ==================== App Level ====================
  app: {
    // Toast Messages
    toast: {
      loadSuccess: 'Conversation loaded',
      loadFailed: 'Failed to load conversation',
    },
    // Error Messages
    error: {
      getContentFailed: 'Failed to get conversation content',
      loadFailed: 'Failed to load conversation',
      createFailed: 'Failed to process after creating conversation',
    },
    // Empty States
    empty: {
      conversation: '(Empty conversation)',
    },
    // Detail Dialog Titles
    detail: {
      preset: 'Preset Details - {name}',
      worldbook: 'World Book Details - {name}',
      character: 'Character Details - {name}',
      persona: 'Persona Details - {name}',
      regex: 'Regex Rule Details - {name}',
      aiconfig: 'AI Config Details - {name}',
    },
    // Modal Default Titles
    modal: {
      newChat: 'New Chat',
      loadGame: 'Load Game',
      gallery: 'Gallery',
      options: 'Options',
    },
  },
  
  // ==================== Home Components ====================
  home: {
    // Home Menu Buttons
    menu: {
      newGame: 'New Game',
      loadGame: 'Load Game',
      gallery: 'Gallery',
      options: 'Options',
    },
    // Gallery
    gallery: {
      title: 'Gallery',
      placeholder: 'Placeholder: In the future, this will display screenshots and illustrations with filtering and fullscreen preview.',
    },
    // Load Game
    loadGame: {
      title: 'Load Game',
      roleUser: 'User',
      roleAssistant: 'Assistant',
      roleSystem: 'System',
      roleUnknown: 'Unknown',
      characterCard: 'Character Card',
      floor: 'Floor',
      noLatestMessage: 'No latest message',
      getLatestFailed: 'Failed to get latest message',
      loadFailed: 'Load failed',
      notFound: 'No saved conversations found',
      confirm: 'Confirm',
      delete: 'Delete',
    },
    // New Chat
    newChat: {
      title: 'New Chat',
      loading: 'Loading list...',
      creating: 'Creating...',
      nameLabel: 'New Chat Name',
      namePlaceholder: 'Enter chat name',
      nameHelp: 'Allowed characters: letters, numbers, spaces, Chinese, -, _; Special characters (/ \\ : * ? " < > |) will be replaced with "-".',
      nameReplaced: 'Disallowed characters replaced with "-" for file name safety.',
      nameDupFile: 'File name taken: {name}.json already exists, please use a different name.',
      nameDupTitle: 'Internal name taken: A chat with name "{name}" already exists, please use a different name.',
      descLabel: 'Description (optional)',
      descPlaceholder: 'Enter chat description',
      llmConfigLabel: 'AI Config (required)',
      llmConfigPlaceholder: 'Select AI Config',
      presetLabel: 'Preset (required)',
      presetPlaceholder: 'Select Preset',
      characterLabel: 'Character (required)',
      characterPlaceholder: 'Select Character',
      personaLabel: 'Persona (required)',
      personaPlaceholder: 'Select Persona',
      regexLabel: 'Regex (optional)',
      worldbookLabel: 'World Book (optional)',
      optional: '(optional)',
      typeLabel: 'Chat Type',
      typeThreaded: 'Threaded Chat',
      typeThreadedSub: 'Threaded Chat',
      typeSandbox: 'Frontend Sandbox',
      typeSandboxSub: 'Frontend Sandbox',
      requiredError: 'Please select: AI Config, Preset, Character, Persona (required)',
      duplicateError: 'Duplicate chat name: Please use a different name (file name or internal name cannot be duplicated)',
      createFailed: 'Failed to create chat',
      listFailed: 'Failed to load list',
      convListFailed: 'Failed to load conversation list',
      confirm: 'Confirm',
      cancel: 'Cancel',
    },
    // Options
    options: {
      title: 'Options',
      desc: 'Home options consistent with sidebar: Theme switch between "System/Light/Dark".',
      language: 'Language',
      theme: 'Theme',
      themeSystem: 'System',
      themeLight: 'Light',
      themeDark: 'Dark',
      themeUsing: 'Currently using: {theme}',
      backendApi: 'Backend API URL',
      save: 'Save',
      reset: 'Reset',
    },
  },

  // ==================== Services ====================
  services: {
    dataCatalog: {
      unnamed: 'Unnamed',
    },
    routerClient: {
      routerNotInjected: 'Router not injected or does not support call(action, ...)',
    },
  },

  // ==================== Stores ====================
  stores: {
    character: {
      defaultAvatarLetter: 'A',
    },
    persona: {
      defaultAvatarLetter: 'U',
    },
  },

  // ==================== Utils ====================
  utils: {
    resourceLoader: {
      done: 'Done',
      loadComplete: 'Load Complete',
      loading: 'Loading: {resource} ({progress}%)',
    },
  },

  // ==================== Workflow Slots ====================
  slots: {
    homeMenu: {
      newGame: 'New Game',
      loadGame: 'Load Game',
      gallery: 'Gallery',
      options: 'Options',
    },
    sidebar: {
      presets: {
        label: 'Presets',
        desc: 'Manage prompt presets',
      },
      worldbooks: {
        label: 'World Books',
        desc: 'Define world lore & glossary',
      },
      characters: {
        label: 'Characters',
        desc: 'Manage character cards',
      },
      personas: {
        label: 'Personas',
        desc: 'Configure user profiles',
      },
      regexrules: {
        label: 'Regex Rules',
        desc: 'Text processing rules',
      },
      llmconfigs: {
        label: 'LLM Configs',
        desc: 'AI providers & parameters',
      },
      plugins: {
        label: 'Plugins',
        desc: 'Manage frontend plugins',
      },
      appearance: {
        label: 'Appearance',
        desc: 'Theme & visual settings',
      },
      app: {
        label: 'App Settings',
        desc: 'Global app behavior',
      },
    },
  },

  // ==================== Workflow Orchestrator ====================
  orchestrator: {
    placeholderCompletionFail: 'Placeholder/completion trigger failed: {error}',
    retryCompletionFail: 'Retry completion trigger failed: {error}',
    createAssistBranchFail: 'Create assistant branch failed: {error}',
  },

  // ==================== Workflow Controllers ====================
  workflow: {
    controllers: {
      branch: {
        readTableFailMissingParam: 'Failed to read branch table: Missing parameter',
        readTableFail: 'Failed to read branch table',
        switchFailIncompleteParam: 'Failed to switch branch: Incomplete parameters',
        switchSuccess: 'Branch switched',
        switchFail: 'Failed to switch branch',
        deleteFailIncompleteParam: 'Failed to delete branch: Incomplete parameters',
        deleteSuccess: 'Branch deleted',
        deleteFail: 'Failed to delete branch',
        retryFailIncompleteParam: 'Retry failed: Incomplete parameters',
        retryAssistSuccess: 'New branch created',
        retryAssistFail: 'Failed to create new branch',
        retryUserSuccess: 'Smart retry triggered',
        retryUserFail: 'Smart retry failed',
        truncateFailIncompleteParam: 'Truncate failed: Incomplete parameters',
        truncateSuccess: 'Branch truncated',
        truncateFail: 'Truncate failed',
      },
      catalog: {
        unknownResourceType: 'Unknown resource type: {category}',
      },
      completion: {
        completionFail: 'Completion failed',
        routerNotInjected: 'Prompt Router not injected or unsupported',
        completionCancelled: 'Completion cancelled',
      },
      message: {
        sendFailIncompleteParam: 'Send failed: Incomplete parameters',
        sendSuccess: 'Message sent',
        sendFail: 'Failed to send message',
        editFailIncompleteParam: 'Edit failed: Incomplete parameters',
        editSuccess: 'Message saved',
        editFail: 'Failed to save message',
      },
      settings: {
        missingConversationFile: 'Missing conversationFile parameter',
        missingOrInvalidPatch: 'Missing or invalid patch parameter',
      },
    },
  },

  // ==================== Chat Components ====================
  chat: {
    input: {
      expand: 'Expand',
      send: 'Send',
      sending: 'Sending',
      stop: 'Stop',
      stopWaiting: 'Stop Waiting',
      placeholder: 'Enter message... (Enter to send, Shift+Enter for new line)',
      sendShortcut: 'Send (Enter)',
    },
    
    message: {
      avatarAlt: "{name}'s avatar",
      floorIndex: 'Floor Index',
      moreActions: 'More Actions',
      more: 'More',
      copy: 'Copy',
      copied: 'Copied',
      retry: 'Retry',
      editPlaceholder: 'Enter message content...',
      saveShortcut: 'Save (Ctrl+Enter)',
      cancelShortcut: 'Cancel (Esc)',
      
      // Status
      waiting: 'Waiting...{seconds}s',
      waitingAI: 'Waiting for AI response ({seconds}s)',
      sendSuccess: 'Sent successfully',
      deleting: 'Deleting...',
      deleteSuccess: 'Deleted successfully',
      deleteFailed: 'Delete failed',
      switchedToBranch: 'Switched to adjacent branch',
      saving: 'Saving...',
      saveSuccess: 'Saved successfully',
      saveFailed: 'Save failed',
    },
    
    branch: {
      switching: 'Switching...',
      switched: 'Switched',
      prevBranch: 'Switch to previous branch',
      nextBranch: 'Switch to next branch',
      createNew: 'Create new branch (retry)',
    },
    
    errors: {
      aiCallFailed: 'AI call failed',
      noConversationFile: 'No conversation file, skipping branch info load',
      cannotDetermineParentId: 'Cannot determine parent node ID',
      missingConversationFile: 'Missing conversation file',
      loadBranchFailed: 'Failed to load branch info',
      switchBranchFailed: 'Failed to switch branch',
      cannotDelete: 'Cannot delete: missing conversationFile',
      cannotSaveEdit: 'Cannot save edit: missing conversationFile',
      retryFailed: 'Retry failed',
      sendFailed: 'Send failed',
      noConversationDoc: 'No conversation file or document, cannot send message',
      missingFileOrDoc: 'Missing conversation file or document',
      avatarLoadFailed: 'Avatar load failed, using default style',
    },
  },
}

export default enUS

// Export type (for type constraints of other language packs)
export type LocaleMessages = typeof enUS