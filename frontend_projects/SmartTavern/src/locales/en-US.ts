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
    create: 'Create',
    
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
    
    // Time
    am: 'AM',
    pm: 'PM',
    
    // Other
    noDescription: 'No description',
    noData: 'No data',
    dragToSort: 'Drag to sort',
    unknown: 'Unknown',
    none: 'None',
    all: 'All',
    selected: 'Selected',
    required: 'Required',
    optional: 'Optional',
    default: 'Default',
  },

  // ==================== Panel Titles & Actions ====================
  panel: {
    presets: {
      title: 'Presets',
      createTitle: 'Create Preset',
      importTitle: 'Import Preset (.json, .zip, .png)',
      exportTitle: 'Export Preset',
      typeName: 'preset',
    },
    worldBooks: {
      title: 'World Books',
      createTitle: 'Create World Book',
      importTitle: 'Import World Book (.json, .zip, .png)',
      exportTitle: 'Export World Book',
      typeName: 'world book',
    },
    characters: {
      title: 'Characters',
      createTitle: 'Create Character',
      importTitle: 'Import Character (.json, .zip, .png)',
      exportTitle: 'Export Character',
      typeName: 'character',
    },
    character: {
      type: {
        threaded: 'Threaded',
        sandbox: 'Sandbox',
      },
      importTitle: 'Import Character (.json, .zip, .png)',
      exportTitle: 'Export Character',
      typeName: 'character',
    },
    personas: {
      title: 'Personas',
      createTitle: 'Create Persona',
      importTitle: 'Import Persona (.json, .zip, .png)',
      exportTitle: 'Export Persona',
      typeName: 'persona',
    },
    regexRules: {
      title: 'Regex Rules',
      createTitle: 'Create Regex Rule',
      importTitle: 'Import Regex Rule (.json, .zip, .png)',
      exportTitle: 'Export Regex Rule',
      typeName: 'regex rule',
    },
    llmConfigs: {
      title: 'AI Configs',
      createTitle: 'Create AI Config',
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
      detailTitle: 'Plugin Details',
    },
    
    themes: {
      title: 'Themes',
      detailTitle: 'Theme Details',
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
      json: {
        title: 'JSON File',
        desc: 'Lightweight format, easy to edit and version control',
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
    exportSuccess: 'Export successful!',
    
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

  // ==================== Delete Confirm Modal ====================
  deleteConfirm: {
    title: 'Confirm Delete',
    message: 'Are you sure you want to delete {type} "{name}"?',
    warning: 'This will delete the entire folder and all files within it. This action cannot be undone!',
    deleting: 'Deleting...',
  },

  // ==================== Create Item Modal ====================
  createItem: {
    title: 'Create {type}',
    nameLabel: 'Name',
    namePlaceholder: 'Enter name',
    descriptionLabel: 'Description',
    descriptionPlaceholder: 'Enter description (optional)',
    folderLabel: 'Folder Name',
    folderPlaceholder: 'Enter folder name',
    folderHint: 'Only letters, numbers, underscores, hyphens, and Chinese characters are allowed',
    iconLabel: 'Icon',
    uploadIcon: 'Upload',
    removeIcon: 'Remove Icon',
    iconHint: 'Optional, supports common image formats',
    create: 'Create',
    creating: 'Creating...',
    errors: {
      emptyName: 'Name cannot be empty',
      emptyFolder: 'Folder name cannot be empty',
      invalidFolder: 'Invalid folder name format. Only letters, numbers, underscores, hyphens, and Chinese characters are allowed',
      folderExists: 'Folder "{folder}" already exists',
      createFailed: 'Creation failed, please try again',
    },
  },

  // ==================== Import Error Modal ====================
  import: {
    error: {
      // Error titles
      typeMismatch: 'File Type Mismatch',
      noTypeInfo: 'Missing Type Information',
      noTypeInFilename: 'Missing Type in Filename',
      invalidZip: 'Invalid Archive',
      invalidFormat: 'Unsupported Format',
      importFailed: 'Import Failed',
      
      // Error descriptions
      typeMismatchDesc: 'The selected file contains data of a different type than expected by this panel.',
      noTypeInfoDesc: 'This file is missing type marker information, unable to verify if it is the correct data type.',
      noTypeInFilenameDesc: 'The JSON filename does not contain a type identifier. Please ensure the filename starts with a type prefix, such as "preset_name.json".',
      genericDesc: 'An error occurred during import. Please check if the file format is correct.',
      
      // Type information
      fileContains: 'File contains',
      panelExpects: 'Panel expects',
      
      // Hints
      typeMismatchHint: 'Please make sure to import files in the correct panel for their type, or select a different file.',
      noTypeInfoHint: 'This file may be from an older version or not exported from this system. Please manually verify the data format if you need to import it.',
      noTypeInFilenameHint: 'JSON files exported from this system will automatically include type prefixes. Please use correctly named files.',
    },
  },

  // ==================== Sidebar ====================
  sidebar: {
    title: 'Settings',
    collapse: 'Collapse',
    expand: 'Expand Sidebar',
    configPreview: 'Config Preview',
    configPreviewHint: 'Configuration entry displayed on the right side of chat page (preview placeholder)',
    backToHome: 'Back to Home',
    
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
      characterName: 'Character Card Name',
      characterDesc: 'Character Card Description',
      displayName: 'Character Name',
      displayNamePlaceholder: 'Character name to display in chat (optional)',
      badgeName: 'Character Badge',
      badgeNamePlaceholder: 'Character badge identifier (optional)',
      avatarLabel: 'Avatar',
      uploadAvatar: 'Upload Avatar',
      removeAvatar: 'Remove Avatar',
      
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
      personaInfoName: 'Persona Info Name',
      personaInfoNamePlaceholder: 'Enter persona info name',
      personaInfoDesc: 'Persona Info Description',
      personaInfoDescPlaceholder: 'Enter persona info description, can include preferences, background, conversation style, etc.',
      personaName: 'Persona Name',
      personaNamePlaceholder: 'Persona name to display in chat (optional)',
      personaBadge: 'Persona Badge',
      personaBadgePlaceholder: 'Persona badge identifier (optional)',
      currentValue: 'Current',
      notSet: '(Not set)',
      charCount: 'Characters',
      avatarLabel: 'Avatar',
      uploadAvatar: 'Upload Avatar',
      removeAvatar: 'Remove Avatar',
      
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
    
    plugin: {
      title: 'Plugin Details',
      pageTitle: 'Plugin Info Editor',
      editMode: 'Edit Mode',
      editHint: 'This page is for editing plugin basic information, including name and description',
      saveFailed: 'Save failed',
      saved: 'Saved successfully',
      
      basicInfo: 'Basic Info',
      pluginName: 'Plugin Name',
      pluginNamePlaceholder: 'Enter plugin name',
      pluginDesc: 'Plugin Description',
      pluginDescPlaceholder: 'Enter plugin description, can include features, usage, etc.',
      
      notes: {
        title: 'Notes',
        line1: 'Plugin info includes only name and description, saved to manifest.json',
        line2: 'Auto-saves to memory when input loses focus',
        line3: 'Click "Save" button to write changes to backend file',
      },
    },
    
    theme: {
      title: 'Theme Details',
      pageTitle: 'Theme Info Editor',
      editMode: 'Edit Mode',
      editHint: 'This page is for editing theme basic information, including name and description',
      saveFailed: 'Save failed',
      saved: 'Saved successfully',
      
      basicInfo: 'Basic Info',
      themeName: 'Theme Name',
      themeNamePlaceholder: 'Enter theme name',
      themeDesc: 'Theme Description',
      themeDescPlaceholder: 'Enter theme description, can include style, features, etc.',
      
      notes: {
        title: 'Notes',
        line1: 'Theme info includes only name and description, saved to manifest.json',
        line2: 'Auto-saves to memory when input loses focus',
        line3: 'Click "Save" button to write changes to backend file',
      },
    },
  },

  // ==================== Appearance Panel ====================
  appearance: {
    title: 'Appearance',
    tabs: {
      threaded: 'Threaded Chat',
      sandbox: 'Frontend Sandbox',
      backgrounds: 'Backgrounds',
      theme: 'Theme',
      others: 'Others',
    },
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
      landscape: 'Landscape (Desktop/Tablet)',
      portrait: 'Portrait (Mobile)',
      noImage: 'No Image',
      uploading: 'Uploading...',
    },
    
    // Sandbox Appearance
    sandbox: {
      title: 'Frontend Sandbox Appearance',
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
      desc: 'Import external themes or reset to built-in style.',
      typeName: 'theme',
      backendThemes: 'Backend Themes',
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
      // Multi-theme layering
      multiThemeInfo: 'Multi-Theme Layering',
      multiThemeHint: 'Enable multiple themes simultaneously. Themes higher in the list have higher priority and will override matching styles from themes below. Drag to reorder.',
    },
    
    // Others Appearance Settings
    others: {
      title: 'Other Appearance Settings',
      desc: 'Configure FAB (Floating Action Button) snap margin, controlling the distance from screen edges when the sidebar FAB snaps.',
      fabMargin: 'FAB Snap Margin',
      fabMarginHint: 'Control the distance from screen edges when the sidebar floating button snaps. Higher values move the FAB further from edges.',
      tuningTip: 'Tip: When dragging sliders, the page will become transparent, leaving only this panel opaque for real-time margin adjustment preview.',
      timezone: 'Timezone',
      timezoneHint: 'Select timezone for message timestamps display',
      dateTimeFormat: 'Date Time Format',
      dateTimeFormatHint: 'Choose display format for message timestamps',
      // Timezone city names
      tzShanghai: 'Shanghai (UTC+8)',
      tzTokyo: 'Tokyo (UTC+9)',
      tzSeoul: 'Seoul (UTC+9)',
      tzHongKong: 'Hong Kong (UTC+8)',
      tzSingapore: 'Singapore (UTC+8)',
      tzLondon: 'London (UTC+0/+1)',
      tzParis: 'Paris (UTC+1/+2)',
      tzNewYork: 'New York (UTC-5/-4)',
      tzLosAngeles: 'Los Angeles (UTC-8/-7)',
      tzChicago: 'Chicago (UTC-6/-5)',
      tzUTC: 'UTC (UTC+0)',
      formatISO24: 'ISO 24h (2025-12-01 14:30)',
      formatISO12: 'ISO 12h (2025-12-01 02:30 PM)',
      formatUS24: 'US 24h (12/01/2025 14:30)',
      formatUS12: 'US 12h (12/01/2025 02:30 PM)',
      formatEU24: 'EU 24h (01/12/2025 14:30)',
      formatEU12: 'EU 12h (01/12/2025 02:30 PM)',
      formatCN24: 'CN 24h (2025年12月01日 14:30)',
      formatCN12: 'CN 12h (2025年12月01日 02:30 PM)',
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
      inputBottomMargin: 'Input Box Bottom Margin',
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
      messageSidebarWidth: 'Message Sidebar Width',
      messageSidebarWidthHint: 'Adjust the width of the left sidebar in message list (including avatar, badge, and floor number)',
      iframeRenderOptimization: 'iframe Render Optimization',
      iframeRenderMode: 'iframe Render Mode',
      iframeRenderModeAll: 'Render All',
      iframeRenderModeTrackLatest: 'Track Latest Messages',
      iframeRenderModeTrackViewport: 'Track Viewport Messages',
      iframeRenderModeHint: 'Choose rendering strategy to optimize memory usage. "Render All" renders all HTML; "Track Latest" only renders the latest N layers; "Track Viewport" only renders messages near the viewport',
      iframeRenderRange: 'Render Range',
      layers: 'layers',
      iframeRenderRangeHint: 'Set the number of floors to render. Lower values use less memory but may require re-rendering when scrolling',
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
    
    uiScale: {
      label: 'UI Scale',
      placeholder: '1.0',
      hint: 'Adjust global UI scale (0.5 - 2.0), default is 1.0',
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
    // Loading States
    loading: {
      conversation: 'Loading conversation...',
      sandbox: 'Loading sandbox project...',
    },
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
      appearance: 'Appearance',
      plugins: 'Plugins',
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
    // Plugins
    plugins: {
      title: 'Plugins',
      description: 'Browse installed plugins and view plugin details.',
      empty: 'No plugins found. Please manage plugins in the sidebar panel.',
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
      emptyHint: 'No saved conversations yet. Start a new chat and it will appear here.',
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
      llmConfigLabel: 'AI Config (optional)',
      llmConfigPlaceholder: 'Optional, use default AI config if empty',
      presetLabel: 'Preset (required)',
      presetPlaceholder: 'Select Preset',
      characterLabel: 'Character (required)',
      characterPlaceholder: 'Select Character',
      personaLabel: 'Persona (required)',
      personaPlaceholder: 'Select Persona',
      regexLabel: 'Regex (optional)',
      worldbookLabel: 'World Book (optional)',
      optional: '(optional)',
      configPanelTitle: 'Conversation Setup',
      configPanelSubtitle: 'Preset (required) · Character (required) · Persona (required) · Regex (optional) · World Book (optional) · AI Config (optional)',
      typeLabel: 'Chat Type',
      typeThreaded: 'Threaded Chat',
      typeThreadedSub: 'Threaded Chat',
      typeSandbox: 'Frontend Sandbox',
      typeSandboxSub: 'Frontend Sandbox',
      requiredError: 'Please enter a name and select: Preset, Character, Persona (required)',
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
      appearance: 'Appearance',
      plugins: 'Plugins',
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
    iframe: {
      notRendered: 'HTML Content Not Rendered',
      notRenderedHint: 'HTML content hidden to save memory',
    },
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