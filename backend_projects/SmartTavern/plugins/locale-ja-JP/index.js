/**
 * 日本語言語パック / Japanese Language Pack Plugin
 * 
 * このプラグインは SmartTavern に日本語のローカライズを追加します。
 * This plugin adds Japanese localization to SmartTavern.
 * 
 * 使い方 / Usage:
 * - plugins_switch.json の enabled に "locale-ja-JP" を追加
 * - Add "locale-ja-JP" to enabled in plugins_switch.json
 */

// 日本語メッセージ / Japanese messages
const jaJP = {
  // ==================== 共通 ====================
  common: {
    // ボタン
    import: 'インポート',
    export: 'エクスポート',
    close: '閉じる',
    cancel: 'キャンセル',
    confirm: '確認',
    save: '保存',
    delete: '削除',
    use: '使用',
    using: '使用中',
    view: '詳細',
    add: '追加',
    edit: '編集',
    refresh: '更新',
    reset: 'リセット',
    apply: '適用',
    enable: '有効化',
    disable: '無効化',
    enabled: '有効',
    disabled: '無効',
    create: '新規作成',
    
    // ステータス
    loading: '読み込み中...',
    importing: 'インポート中...',
    exporting: 'エクスポート中...',
    saving: '保存中...',
    saved: '保存しました！',
    checking: '確認中...',
    processing: '処理中...',
    
    // フォーム
    name: '名前',
    description: '説明',
    id: 'ID',
    folder: 'フォルダ',
    file: 'ファイル',
    type: 'タイプ',
    content: '内容',
    value: '値',
    
    // 時間
    am: '午前',
    pm: '午後',
    
    // その他
    noDescription: '説明なし',
    noData: 'データなし',
    dragToSort: 'ドラッグして並び替え',
    unknown: '不明',
    none: 'なし',
    all: 'すべて',
    selected: '選択済み',
    required: '必須',
    optional: '任意',
    default: 'デフォルト',
  },

  // ==================== パネル ====================
  panel: {
    presets: {
      title: 'プリセット Presets',
      createTitle: '新規プリセット',
      importTitle: 'プリセットをインポート (.json, .zip, .png)',
      exportTitle: 'プリセットをエクスポート',
      typeName: 'プリセット',
    },
    worldBooks: {
      title: 'ワールドブック World Books',
      createTitle: '新規ワールドブック',
      importTitle: 'ワールドブックをインポート (.json, .zip, .png)',
      exportTitle: 'ワールドブックをエクスポート',
      typeName: 'ワールドブック',
    },
    characters: {
      title: 'キャラクター Characters',
      createTitle: '新規キャラクター',
      importTitle: 'キャラクターをインポート (.json, .zip, .png)',
      exportTitle: 'キャラクターをエクスポート',
      typeName: 'キャラクター',
    },
    character: {
      type: {
        threaded: 'スレッドチャット',
        sandbox: 'フロントエンドサンドボックス',
      },
      importTitle: 'キャラクターをインポート (.json, .zip, .png)',
      exportTitle: 'キャラクターをエクスポート',
      typeName: 'キャラクター',
    },
    personas: {
      title: 'ペルソナ Personas',
      createTitle: '新規ペルソナ',
      importTitle: 'ペルソナをインポート (.json, .zip, .png)',
      exportTitle: 'ペルソナをエクスポート',
      typeName: 'ペルソナ',
    },
    regexRules: {
      title: '正規表現 Regex Rules',
      createTitle: '新規正規表現ルール',
      importTitle: '正規表現ルールをインポート (.json, .zip, .png)',
      exportTitle: '正規表現ルールをエクスポート',
      typeName: '正規表現ルール',
    },
    llmConfigs: {
      title: 'AI設定 AI Configs',
      createTitle: '新規AI設定',
      importTitle: 'AI設定をインポート (.json, .zip, .png)',
      exportTitle: 'AI設定をエクスポート',
      typeName: 'AI設定',
    },
    plugins: {
      title: 'プラグイン Plugins',
      importTitle: 'プラグインをインポート (.json, .zip, .png)',
      exportTitle: 'プラグインをエクスポート',
      typeName: 'プラグイン',
      hint: 'プラグインの管理（バックエンドのpluginsディレクトリ）：ロード / アンロード。インポート後は自動的に有効化されます。',
      detailTitle: 'プラグイン詳細',
    },
    
    themes: {
      title: 'テーマ',
      detailTitle: 'テーマ詳細',
    },
    appearance: {
      title: '外観設定',
    },
    appSettings: {
      title: 'アプリ設定',
    },
  },

  // ==================== インポート競合ダイアログ ====================
  importConflict: {
    title: '⚠️ 名前の競合',
    message: '{name} という名前の{type}フォルダが既に存在します。',
    hint: '処理方法を選択してください：',
    
    overwrite: {
      title: '既存の{type}を上書き',
      desc: '古い{type}を削除し、新しくインポートした内容で置き換えます',
    },
    rename: {
      title: '両方を保持（名前変更）',
      desc: '新しい{type}の名前を入力：',
      placeholder: '新しい名前を入力',
      button: '確認',
    },
    
    cancelButton: 'インポートをキャンセル',
    
    errors: {
      emptyName: '名前を入力してください',
      nameExists: '名前「{name}」は既に存在します。別の名前を使用してください',
    },
  },

  // ==================== エクスポートダイアログ ====================
  exportModal: {
    title: '{type}をエクスポート',
    selectItem: '{type}を選択',
    
    format: {
      title: 'エクスポート形式',
      zip: {
        title: 'ZIP圧縮ファイル',
        desc: '標準的な圧縮形式、共有に便利',
      },
      json: {
        title: 'JSONファイル',
        desc: '軽量フォーマット、編集とバージョン管理に便利',
      },
      png: {
        title: 'PNG画像',
        desc: 'データを画像に埋め込み、直接プレビュー可能',
      },
    },
    
    embedImage: {
      title: '埋め込み画像（オプション）',
      hint: 'PNG画像を選択してキャリアとして使用、データがその中に埋め込まれます',
      dropzone: 'クリックして選択またはここに画像をドロップ',
      note: 'PNG形式のみ対応。選択しない場合は{type}のアイコンを使用します',
    },
    
    cancelButton: 'キャンセル',
    confirmButton: 'エクスポートを確認',
    exportSuccess: 'エクスポート成功！',
    
    errors: {
      noSelection: 'エクスポートする{type}を選択してください',
      noPath: '{type}のパスを取得できません',
      pngOnly: 'PNG形式の画像を選択してください',
    },
  },

  // ==================== エラーメッセージ ====================
  error: {
    loadFailed: '読み込み失敗：{error}',
    importFailed: 'インポート失敗',
    exportFailed: 'エクスポート失敗',
    saveFailed: '保存失敗：{error}',
    deleteFailed: '削除失敗：{error}',
    networkError: 'ネットワークエラー',
    unknownError: '不明なエラー',
    unknownType: '不明なタイプ: {type}',
    getDetailFailed: '詳細の取得に失敗しました',
    invalidFileType: 'サポートされていないファイル形式: {ext}。.json、.zip、または .png ファイルを選択してください',
    missingFilePath: 'ファイルパスがありません。保存できません',
    operationFailed: '操作失敗：{error}',
  },

  // ==================== 削除確認ダイアログ ====================
  deleteConfirm: {
    title: '削除の確認',
    message: '{type}「{name}」を削除してもよろしいですか？',
    warning: 'この操作によりフォルダ全体とその中のすべてのファイルが削除されます。元に戻すことはできません！',
    deleting: '削除中...',
  },

  // ==================== 新規作成ダイアログ ====================
  createItem: {
    title: '新規{type}',
    nameLabel: '名前',
    namePlaceholder: '名前を入力',
    descriptionLabel: '説明',
    descriptionPlaceholder: '説明を入力（任意）',
    folderLabel: 'フォルダ名',
    folderPlaceholder: 'フォルダ名を入力',
    folderHint: '使用可能な文字：文字、数字、アンダースコア、ハイフン、中国語文字',
    iconLabel: 'アイコン',
    uploadIcon: 'アップロード',
    removeIcon: 'アイコンを削除',
    iconHint: '任意、一般的な画像形式に対応',
    create: '作成',
    creating: '作成中...',
    errors: {
      emptyName: '名前を入力してください',
      emptyFolder: 'フォルダ名を入力してください',
      invalidFolder: 'フォルダ名の形式が正しくありません。文字、数字、アンダースコア、ハイフン、中国語文字のみ使用できます',
      folderExists: 'フォルダ「{folder}」は既に存在します',
      createFailed: '作成に失敗しました。もう一度お試しください',
    },
  },

  // ==================== インポートエラーダイアログ ====================
  import: {
    error: {
      // エラータイトル
      typeMismatch: 'ファイルタイプが一致しません',
      noTypeInfo: 'タイプ情報がありません',
      noTypeInFilename: 'ファイル名にタイプ識別子がありません',
      invalidZip: '無効な圧縮ファイル',
      invalidFormat: 'サポートされていない形式',
      importFailed: 'インポート失敗',
      
      // エラー説明
      typeMismatchDesc: '選択したファイルのデータタイプは現在のパネルと一致しません。',
      noTypeInfoDesc: 'このファイルにはタイプマーカー情報がないため、正しいデータタイプかどうか検証できません。',
      noTypeInFilenameDesc: 'JSONファイル名にタイプ識別子が含まれていません。ファイル名が「preset_名前.json」のようなタイププレフィックスで始まることを確認してください。',
      genericDesc: 'インポート中にエラーが発生しました。ファイル形式を確認してください。',
      
      // タイプ情報
      fileContains: 'ファイルに含まれる',
      panelExpects: '現在のパネルが期待する',
      
      // ヒント
      typeMismatchHint: '正しいパネルで対応するタイプのファイルをインポートするか、別のファイルを選択してください。',
      noTypeInfoHint: 'このファイルは古いバージョンからエクスポートされたか、このシステムからエクスポートされたものではない可能性があります。インポートする場合は、データ形式を手動で確認してください。',
      noTypeInFilenameHint: 'このシステムからエクスポートされたJSONファイルには自動的にタイププレフィックスが含まれます。正しく命名されたファイルを使用してください。',
    },
  },

  // ==================== サイドバー ====================
  sidebar: {
    title: '設定',
    collapse: '折りたたむ',
    expand: 'サイドバーを展開',
    configPreview: '設定プレビュー',
    configPreviewHint: 'チャットページの右側に表示される設定エントリ（プレビュープレースホルダ）',
    backToHome: 'ホームに戻る',
    
    viewMode: {
      threaded: 'スレッド',
      sandbox: 'フロントエンド',
    },
    
    theme: {
      dark: 'ダーク',
      light: 'ライト',
      system: 'システム',
    },
  },

  // ==================== 詳細ページ ====================
  detail: {
    preset: {
      title: 'プリセット詳細',
      editMode: '編集モード',
      editHint: 'このページでは完全な編集、追加、削除、ドラッグ＆ドロップによる並び替えが可能です',
      saveToBackend: 'バックエンドに保存',
      saving: '保存中',
      saved: '保存しました！',
      saveFailed: '保存に失敗しました',
      
      basicInfo: '基本情報',
      
      apiConfig: {
        title: 'API設定',
        enableTitle: 'API設定を有効化',
        enabled: '有効',
        notEnabled: '無効',
        enable: '有効化',
        temperature: 'Temperature',
        topP: 'Top P',
        topK: 'Top K',
        maxContext: 'Max Context',
        maxTokens: 'Max Tokens',
        stream: 'ストリーミング出力（stream）',
        frequencyPenalty: 'Frequency Penalty',
        presencePenalty: 'Presence Penalty',
        on: 'オン',
      },
      
      prompts: {
        title: 'プロンプト編集',
        items: 'プロンプトアイテム',
        relative: 'Relative アイテム',
        inChat: 'In-Chat アイテム',
        selectSpecial: '特殊コンポーネントを選択',
        addSpecial: '特殊を追加',
        dragToSort: 'ドラッグして並び替え',
      },
      
      regex: {
        title: '正規表現編集',
        empty: 'ルールがありません。右上で入力して追加してください',
      },
      
      errors: {
        idRequired: 'IDを入力してください',
        nameRequired: '名前を入力してください',
        reservedConflict: 'IDまたは名前が予約コンポーネントと重複しています',
        idExists: 'IDは既に存在します',
        nameExists: '名前は既に存在します',
        specialExists: 'この特殊コンポーネントは既に存在します',
      },
    },
    
    character: {
      title: 'キャラクター詳細',
      pageTitle: 'キャラクターカード編集',
      editMode: '編集モード',
      editHint: 'このページでは基本情報、初期メッセージ、埋め込みワールドブック、正規表現ルールの編集が可能です',
      
      basicInfo: '基本設定',
      characterName: 'キャラクターカード名',
      characterDesc: 'キャラクターカード説明',
      displayName: 'キャラクター名',
      displayNamePlaceholder: '会話で表示されるキャラクター名（任意）',
      badgeName: 'キャラクターバッジ',
      badgeNamePlaceholder: 'キャラクターバッジ識別子（任意）',
      avatarLabel: 'アバター',
      uploadAvatar: 'アバターをアップロード',
      removeAvatar: 'アバターを削除',
      
      messages: {
        title: '初期メッセージ',
        addNew: 'メッセージを追加',
        empty: '初期メッセージがありません。「メッセージを追加」ボタンをクリックして追加してください',
        messageNum: 'メッセージ #{num}',
        charCount: '文字数',
      },
      
      worldBook: {
        title: '埋め込みワールドブック',
        empty: 'ワールドブックエントリーがありません',
        idPlaceholder: 'ID',
        namePlaceholder: '名前',
        defaultName: 'キャラクターワールドブック',
      },
      
      regexRules: {
        title: '正規表現ルール',
        empty: '正規表現ルールがありません',
        idPlaceholder: 'ルールID',
        namePlaceholder: 'ルール名',
      },
      
      errors: {
        wbIdRequired: 'ワールドブックIDを入力してください',
        wbNameRequired: 'ワールドブック名を入力してください',
        wbIdExists: 'IDは既に存在します',
        ruleIdRequired: 'ルールIDを入力してください',
        ruleNameRequired: 'ルール名を入力してください',
        ruleIdExists: 'IDは既に存在します',
      },
    },
    
    persona: {
      title: 'ペルソナ詳細',
      pageTitle: 'ペルソナ編集',
      editMode: '編集モード',
      editHint: 'このページではユーザーの基本情報（名前と説明）を編集できます',
      
      basicInfo: '基本情報',
      personaInfoName: 'ペルソナ情報名',
      personaInfoNamePlaceholder: 'ペルソナ情報名を入力',
      personaInfoDesc: 'ペルソナ情報説明',
      personaInfoDescPlaceholder: 'ペルソナ情報の説明を入力（好み、背景、会話スタイルなど）...',
      personaName: 'ペルソナ名',
      personaNamePlaceholder: '会話で表示されるペルソナ名（任意）',
      personaBadge: 'ペルソナバッジ',
      personaBadgePlaceholder: 'ペルソナバッジ識別子（任意）',
      currentValue: '現在',
      notSet: '（未設定）',
      charCount: '文字数',
      avatarLabel: 'アバター',
      uploadAvatar: 'アバターをアップロード',
      removeAvatar: 'アバターを削除',
      
      notes: {
        title: '説明',
        line1: 'ペルソナはユーザーのアイデンティティ、好み、会話スタイルを定義するために使用されます',
        line2: '入力欄からフォーカスが外れると自動保存されます',
        line3: '「リセット」ボタンをクリックすると現在保存されている内容に戻ります',
      },
      
      preview: {
        title: '現在保存されているデータ',
      },
    },
    
    worldBook: {
      title: 'ワールドブック詳細',
      entries: 'エントリーリスト',
      addEntry: 'エントリーを追加',
      
      pageTitle: 'ワールドブック詳細',
      editMode: '編集モード',
      editHint: 'このページでは完全な編集、追加、削除、ドラッグ＆ドロップによる並び替えが可能です',
      saveFailed: '保存に失敗しました',
      
      basicInfo: '基本情報',
      
      toolbar: {
        entryCount: 'エントリー数',
        idPlaceholder: 'ID',
        namePlaceholder: '名前',
      },
      
      editor: {
        title: 'ワールドブック編集',
        empty: 'ワールドブックエントリーがありません。右上で入力して追加してください',
      },
      
      errors: {
        idRequired: 'IDを入力してください',
        nameRequired: '名前を入力してください',
        idExists: 'IDは既に存在します',
      },
    },
    
    regexRule: {
      title: '正規表現ルール詳細',
      findRegex: '検索正規表現',
      replaceRegex: '置換先',
      targets: 'ターゲット',
      placement: '配置',
      views: 'ビュー',
      
      pageTitle: '正規表現ルール編集',
      editMode: '編集モード',
      editHint: 'このページでは独立した正規表現ルールセットの編集が可能です（追加、編集、削除、ドラッグ＆ドロップによる並び替え）',
      saveFailed: '保存に失敗しました',
      
      basicInfo: '基本情報',
      
      toolbar: {
        ruleCount: 'ルール数',
        idPlaceholder: 'ID',
        namePlaceholder: '名前',
      },
      
      list: {
        title: '正規表現ルールリスト',
        empty: '正規表現ルールがありません。右上で入力して追加してください',
      },
      
      notes: {
        title: '使い方',
        line1: '正規表現ルールはテキスト後処理に使用され、検索と置換操作をサポートします',
        line2: '各ルールはターゲット（targets）とビュー（views）を設定できます',
        line3: '深度フィルタリング（min_depth / max_depth）をサポート',
        line4: '「編集」ボタンをクリックして完全な編集フォームを展開',
        line5: '左側のグリップアイコンをドラッグしてルールの実行順序を調整',
      },
      
      errors: {
        idRequired: 'IDを入力してください',
        nameRequired: '名前を入力してください',
        idExists: 'IDは既に存在します',
      },
    },
    
    llmConfig: {
      title: 'AI設定詳細',
      editMode: '編集モード',
      editHint: 'このページではAI設定パラメータの完全な編集が可能です',
      saveFailed: '保存に失敗しました',
      
      basicInfo: '基本情報',
      baseConfig: '基本設定',
      
      provider: 'プロバイダー',
      baseUrl: 'Base URL',
      apiKey: 'APIキー',
      model: 'モデル',
      modelPlaceholder: '例：gpt-4o-mini',
      selectModel: 'モデルを選択',
      modelListPlaceholder: 'モデルを選択（プレースホルダ）',
      
      requestParams: {
        title: 'リクエストパラメータ',
        maxTokens: 'max_tokens',
        temperature: 'temperature',
        topP: 'top_p',
        presencePenalty: 'presence_penalty',
        frequencyPenalty: 'frequency_penalty',
        stream: 'ストリーミング',
        on: 'オン',
      },
      
      network: {
        title: 'ネットワーク＆ログ',
        connectTimeout: '接続タイムアウト（秒）',
        requestTimeout: 'リクエストタイムアウト（秒）',
        enableLogging: 'ログを有効化',
      },
      
      customParams: {
        title: 'カスタムパラメータ（JSON）',
        hint: 'JSON形式でカスタムパラメータを入力、リクエストにマージされます',
      },
      
      gemini: {
        title: 'Gemini 高度な設定',
        stopSequences: 'stopSequences（カンマ区切り）',
        safetySettings: 'safetySettings（JSON）',
        customParams: 'customParams（JSON）',
      },
      
      anthropic: {
        title: 'Anthropic 高度な設定',
        stopSequences: 'stop_sequences（カンマ区切り）',
        enableThinking: 'enable_thinking',
        thinkingBudget: 'thinking_budget',
      },
      
      errors: {
        jsonFormatError: 'JSON形式エラー',
        fixJsonErrors: '保存する前にJSON形式エラーを修正してください',
      },
    },
    
    plugin: {
      title: 'プラグイン詳細',
      pageTitle: 'プラグイン情報編集',
      editMode: '編集モード',
      editHint: 'このページではプラグインの基本情報（名前と説明）を編集できます',
      saveFailed: '保存に失敗しました',
      saved: '保存成功',
      
      basicInfo: '基本情報',
      pluginName: 'プラグイン名',
      pluginNamePlaceholder: 'プラグイン名を入力',
      pluginDesc: 'プラグイン説明',
      pluginDescPlaceholder: 'プラグインの説明を入力（機能、使い方など）...',
      
      notes: {
        title: '説明',
        line1: 'プラグイン情報には名前と説明のみが含まれ、manifest.jsonに保存されます',
        line2: '入力欄からフォーカスが外れると自動的にメモリに保存されます',
        line3: '「保存」ボタンをクリックするとバックエンドファイルに変更を書き込みます',
      },
    },
    
    theme: {
      title: 'テーマ詳細',
      pageTitle: 'テーマ情報編集',
      editMode: '編集モード',
      editHint: 'このページではテーマの基本情報（名前と説明）を編集できます',
      saveFailed: '保存に失敗しました',
      saved: '保存成功',
      
      basicInfo: '基本情報',
      themeName: 'テーマ名',
      themeNamePlaceholder: 'テーマ名を入力',
      themeDesc: 'テーマ説明',
      themeDescPlaceholder: 'テーマの説明を入力（スタイル、特徴など）...',
      
      notes: {
        title: '説明',
        line1: 'テーマ情報には名前と説明のみが含まれ、manifest.jsonに保存されます',
        line2: '入力欄からフォーカスが外れると自動的にメモリに保存されます',
        line3: '「保存」ボタンをクリックするとバックエンドファイルに変更を書き込みます',
      },
    },
  },

  // ==================== 外観パネル ====================
  appearance: {
    title: '外観 Appearance',
    tabs: {
      threaded: 'スレッドチャット',
      sandbox: 'フロントエンドサンドボックス',
      backgrounds: '背景画像',
      theme: 'テーマ',
      others: 'その他',
    },
    unknownTab: '不明なタブ',
    placeholderContent: 'プレースホルダ内容',
    
    // 背景画像管理
    backgrounds: {
      title: '背景画像',
      desc: 'スタートページ、スレッドチャットページ、サンドボックスページの背景画像を設定。デフォルト画像を上書きしてすぐにプレビューできます。',
      startPage: 'スタートページ',
      threadedPage: 'スレッドチャットページ',
      sandboxPage: 'サンドボックスページ',
      selectImage: '画像を選択',
      resetDefault: 'デフォルトにリセット',
      landscape: '横向き（デスクトップ/タブレット）',
      portrait: '縦向き（モバイル）',
      noImage: '画像なし',
      uploading: 'アップロード中...',
    },
    
    // サンドボックス外観
    sandbox: {
      title: 'フロントエンドサンドボックス外観',
      desc: 'サンドボックスステージの寸法とアスペクト比を設定して、ビジュアルの埋め込み/プレビューを整列させます。',
      displayMode: '表示モード',
      displayModeAuto: '自動高さ（デフォルト）',
      displayModeFixed: '固定コンテナ（アスペクト比を使用）',
      displayModeInline: 'サンドボックスコードで決定（フォールバックは自動）',
      displayModeHint: '「サンドボックスコードで決定」を使用する場合、HTMLにコメントを追加: <!-- st:display-mode=auto|fixed --> 宣言がない場合は自動高さにフォールバックします。',
      aspectRatio: 'アスペクト比',
      preset: 'プリセット',
      orCustom: 'またはカスタム',
      stageMaxWidth: 'ステージ最大幅',
      sliderMax: 'スライダー最大値',
      stagePadding: 'ステージ内側余白',
      stageRadius: 'ステージ角丸',
      bgMaskOpacity: '背景マスク不透明度',
      bgMaskBlur: '背景マスクぼかし',
      bgMaskBlurHint: 'マスクレイヤーを通じて背景にガウスぼかしを適用（0～12pxを推奨、大きい値はパフォーマンスに影響する場合があります）',
      stageBgOpacity: 'ステージ背景不透明度',
      tip: 'ヒント：これらの設定は「グローバルサンドボックス」ステージにリアルタイムで適用され、CSS変数として保存されてテーマ/スクリプトと統合されます。',
    },
    
    // テーマ管理
    theme: {
      title: 'テーマ管理',
      desc: '外部テーマをインポートするか、組み込みスタイルにリセットします。',
      typeName: 'テーマ',
      backendThemes: 'バックエンドテーマ',
      importTitle: 'テーマパッケージをインポート',
      selectFile: '.json / .sttheme.json を選択',
      importHint: 'テーマパッケージにはトークンとオプションのCSSが含まれています；適用した設定はブラウザに永続化されます。',
      quickTry: 'クイックトライ',
      applyDemo: 'デモテーマを適用',
      enableExtension: 'サンプル拡張を有効化：角丸シャドウフォロー',
      extensionHint: '拡張はスタイルトークンのみをリンクし、外部スクリプトは実行しません；いつでも無効化できます。',
      currentTheme: '現在のテーマ',
      applied: '適用済み',
      notApplied: '未適用',
      name: '名前',
      id: 'ID',
      version: 'バージョン',
      unnamed: '無名',
      resetDefault: 'デフォルトテーマにリセット',
      // マルチテーマレイヤー
      multiThemeInfo: 'マルチテーマレイヤー',
      multiThemeHint: '複数のテーマを同時に有効化できます。リストの上位にあるテーマは優先度が高く、下位のテーマの同じスタイルを上書きします。ドラッグして並び替えられます。',
    },
    
    // その他外観設定
    others: {
      title: 'その他の外観設定',
      desc: 'FAB（フローティングアクションボタン）のスナップマージンを設定し、サイドバーFABがスナップする際の画面端からの距離を制御します。',
      fabMargin: 'FABスナップマージン',
      fabMarginHint: 'サイドバーのフローティングボタンが画面端にスナップする際の距離を制御します。値が大きいほど、FABは端から遠くなります。',
      tuningTip: 'ヒント：スライダーをドラッグすると、ページが透明になり、このパネルだけが不透明のままでリアルタイムでマージン調整をプレビューできます。',
      timezone: 'タイムゾーン設定',
      timezoneHint: 'メッセージタイムスタンプの表示タイムゾーンを選択',
      dateTimeFormat: '日時形式',
      dateTimeFormatHint: 'メッセージタイムスタンプの表示形式を選択',
      // タイムゾーン都市名
      tzShanghai: '上海 (UTC+8)',
      tzTokyo: '東京 (UTC+9)',
      tzSeoul: 'ソウル (UTC+9)',
      tzHongKong: '香港 (UTC+8)',
      tzSingapore: 'シンガポール (UTC+8)',
      tzLondon: 'ロンドン (UTC+0/+1)',
      tzParis: 'パリ (UTC+1/+2)',
      tzNewYork: 'ニューヨーク (UTC-5/-4)',
      tzLosAngeles: 'ロサンゼルス (UTC-8/-7)',
      tzChicago: 'シカゴ (UTC-6/-5)',
      tzUTC: '協定世界時 (UTC+0)',
      formatISO24: 'ISO 24時間 (2025-12-01 14:30)',
      formatISO12: 'ISO 12時間 (2025-12-01 02:30 PM)',
      formatUS24: '米国式 24時間 (12/01/2025 14:30)',
      formatUS12: '米国式 12時間 (12/01/2025 02:30 PM)',
      formatEU24: '欧州式 24時間 (01/12/2025 14:30)',
      formatEU12: '欧州式 12時間 (01/12/2025 02:30 PM)',
      formatCN24: '中国式 24時間 (2025年12月01日 14:30)',
      formatCN12: '中国式 12時間 (2025年12月01日 02:30 下午)',
    },
    
    // スレッドチャット外観
    threaded: {
      title: 'スレッドチャット外観',
      contentFontSize: '本文フォントサイズ',
      nameFontSize: '名前フォントサイズ',
      badgeFontSize: 'バッジフォントサイズ',
      floorFontSize: 'フロア番号フォントサイズ',
      avatarSize: 'アバターサイズ',
      chatWidth: 'チャットページ幅',
      inputHeight: '入力ボックス高さ',
      inputBottomMargin: '入力ボックス下マージン',
      lineHeight: '行の高さ',
      messageGap: 'メッセージ間隔',
      cardRadius: 'メッセージカード角丸',
      stripeWidth: 'カラーストライプ幅',
      bgMaskOpacity: '背景マスク不透明度',
      bgMaskBlur: '背景マスクぼかし',
      bgMaskBlurHint: 'マスクレイヤーを通じて背景にガウスぼかしを適用（パフォーマンス/品質バランスは0～12pxを推奨）',
      msgBgOpacity: 'メッセージ背景不透明度',
      listBgOpacity: 'チャットコンテナ背景不透明度',
      inputBgOpacity: '入力ボックス背景不透明度',
      htmlStage: 'HTMLステージ（フロア内iframe）',
      displayMode: '表示モード',
      displayModeAuto: '自動高さ（デフォルト）',
      displayModeFixed: '固定コンテナ（アスペクト比を使用）',
      displayModeInline: 'サンドボックスコードで決定（フォールバックは自動）',
      displayModeHint: '「サンドボックスコードで決定」を使用する場合、HTMLにコメントを追加: <!-- st:display-mode=auto|fixed --> 宣言がない場合は自動高さにフォールバックします。',
      aspectRatio: 'アスペクト比',
      preset: 'プリセット',
      orCustom: 'またはカスタム',
      stageMaxWidth: 'ステージ最大幅',
      stageMaxWidthHint: 'メッセージ内容幅を上限として相対パーセント幅を設定',
      stagePadding: 'ステージ内側余白',
      stageRadius: 'ステージ角丸',
      messageSidebarWidth: 'メッセージサイドバー幅',
      messageSidebarWidthHint: 'メッセージリストの左サイドバーの幅を調整（アバター、バッジ、フロア番号を含む）',
      tuningTip: 'スライダーをドラッグすると、ページが透明になり、このパネルだけが不透明のままでリアルタイムプレビューができます。',
      iframeRenderOptimization: 'iframe レンダリング最適化',
      iframeRenderMode: 'iframe レンダリングモード',
      iframeRenderModeAll: 'すべてレンダリング',
      iframeRenderModeTrackLatest: '最新メッセージを追跡',
      iframeRenderModeTrackViewport: 'ビューポート内のメッセージを追跡',
      iframeRenderModeHint: '長い会話でのメモリ使用量を削減するため、表示するHTMLレイヤーを制限します',
      iframeRenderRange: 'レンダリング層数範囲',
      iframeRenderRangeHint: 'レンダリングする層の数を設定（累積効果）',
      layers: '層',
    },
  },

  // ==================== アプリ設定パネル ====================
  appSettings: {
    title: 'アプリ設定 App Settings',
    optionsTitle: 'オプション',
    optionsDesc: 'ホームのオプションと同じ設定：テーマは「システム/ライト/ダーク」で切り替え。',
    
    language: {
      label: '言語',
      zhCN: '简体中文',
      enUS: 'English',
      jaJP: '日本語',
    },
    
    theme: {
      label: 'テーマ',
      current: '現在使用中',
    },
    
    backend: {
      label: 'バックエンドAPI URL',
      placeholder: 'http://localhost:8050',
    },
    
    uiScale: {
      label: 'UIスケール',
      placeholder: '1.0',
      hint: 'グローバルUIスケール比率を調整（0.5 - 2.0）、デフォルトは1.0',
    },
  },

  // ==================== トーストメッセージ ====================
  toast: {
    plugin: {
      loaded: 'プラグインをロードしました：{name}',
      loadFailed: 'ロード失敗：{error}',
      unloaded: 'プラグインをアンロードしました：{name}',
      unloadFailed: 'アンロード失敗：{error}',
      notFound: 'ロード済みのプラグインインスタンスが見つかりません',
      enabled: 'プラグインを有効化しました：{name}',
      disabled: 'プラグインを無効化しました：{name}',
      missingSwitch: 'プラグインスイッチファイルがありません（plugins_switch.json）',
      dirMissing: 'プラグインディレクトリがありません：{path}',
      importedAndEnabled: 'プラグインをインポートして有効化しました：{name}',
      imported: 'プラグインをインポートしました：{name}',
      importAutoLoadFailed: 'プラグインはインポートされましたが、自動ロードに失敗しました：{error}',
    },
    
    save: {
      success: '保存成功',
      failed: '保存失敗：{error}',
    },
    
    import: {
      success: 'インポート成功',
      failed: 'インポート失敗：{error}',
    },
    
    export: {
      success: 'エクスポート成功',
      failed: 'エクスポート失敗：{error}',
    },
  },

  // ==================== 言語設定 ====================
  language: {
    title: '言語設定',
    current: '現在の言語',
    select: '言語を選択',
    
    // 言語名
    zhCN: '简体中文',
    zhTW: '繁體中文',
    enUS: 'English',
    jaJP: '日本語',
    koKR: '한국어',
  },

  // ==================== 特殊コンポーネント名 ====================
  specialComponents: {
    charBefore: 'char Before',
    personaDescription: 'Persona Description',
    charDescription: 'Char Description',
    charAfter: 'char After',
    chatHistory: 'Chat History',
  },

  // ==================== ロール ====================
  role: {
    system: 'システム',
    user: 'ユーザー',
    assistant: 'アシスタント',
  },

  // ==================== 位置 ====================
  position: {
    relative: '相対位置',
    inChat: 'チャット内',
    before: '前',
    after: '後',
  },

  // ==================== 共通コンポーネント ====================
  components: {
    topBar: {
      viewThreaded: 'スレッドチャット',
      viewSandbox: 'グローバルサンドボックス',
      viewStart: 'スタート',
    },
    modal: {
      defaultTitle: '詳細',
      closeEsc: '閉じる (ESC)',
    },
    modeSwitch: {
      threaded: 'スレッドチャット',
      sandbox: 'グローバルサンドボックス（プレースホルダ）',
    },
    themeSwitch: {
      system: 'システム',
      light: 'ライト',
      dark: 'ダーク',
      switchTo: 'テーマを切り替え：{label}',
    },
    optionsPanel: {
      cancel: 'キャンセル',
      confirm: '確認',
    },
    toasts: {
      success: '成功',
      warning: '警告',
      error: 'エラー',
      info: '情報',
      close: '閉じる',
    },
  },

  // ==================== カードコンポーネント ====================
  cards: {
    // 共通
    common: {
      edit: '編集',
      save: '保存',
      cancel: 'キャンセル',
      delete: '削除',
      enabled: '有効',
      disabled: '無効',
      notSet: '未設定',
      empty: '（空）',
      noContent: '（内容なし）',
    },
    // プリセットプロンプトカード
    presetPrompt: {
      name: '名前',
      enabledStatus: '有効状態',
      role: 'ロール（role）',
      depth: '深度（depth）',
      order: '順序（order）',
      content: '内容（content）',
    },
    // 正規表現ルールカード
    regexRule: {
      phase: 'フェーズ',
      targets: 'targets',
      views: 'views',
      condition: 'condition',
      findRegex: 'find_regex',
      replaceRegex: 'replace_regex',
      name: '名前',
      enabledStatus: '有効状態',
      placement: 'フェーズ（placement）',
      mode: 'モード（mode）',
      targetCategories: 'Targets',
      categoryLabel: 'カテゴリ',
      detailLabel: '詳細',
      viewsLabel: 'Views',
      conditionExpr: 'condition（条件式）',
      conditionPlaceholder: "例：{{ keywords('アリス','エンジニア') }} または true/false",
      minDepth: 'min_depth（任意）',
      maxDepth: 'max_depth（任意）',
      description: '説明（任意）',
    },
    // ワールドブックカード
    worldBook: {
      id: 'ID',
      idPlaceholder: '例：1 または my-id',
      name: '名前',
      enabledLabel: '有効',
      mode: 'モード',
      position: '位置（position）',
      positionFraming: 'framing（キャラクターの前/後）',
      positionInChat: 'in-chat（会話に挿入）',
      orderLabel: 'order（ソート重み）',
      depthLabel: 'depth（注入深度）',
      conditionLabel: 'condition（条件式、マクロをサポート）',
      conditionPlaceholder: "例：{{ keywords('アリス','エンジニア') }}",
      content: '内容',
      notSetCondition: '（未設定）',
      errorIdRequired: 'IDを入力してください',
    },
  },

  // ==================== アプリレベル ====================
  app: {
    // ロード状態
    loading: {
      conversation: '会話を読み込み中...',
      sandbox: 'sandboxプロジェクトを読み込み中...',
    },
    // トーストメッセージ
    toast: {
      loadSuccess: '会話をロードしました',
      loadFailed: '会話のロードに失敗しました',
    },
    // エラーメッセージ
    error: {
      getContentFailed: '会話内容の取得に失敗しました',
      loadFailed: '会話のロードに失敗しました',
      createFailed: '会話作成後の処理に失敗しました',
    },
    // 空の状態
    empty: {
      conversation: '（空の会話）',
    },
    // 詳細ダイアログタイトル
    detail: {
      preset: 'プリセット詳細 - {name}',
      worldbook: 'ワールドブック詳細 - {name}',
      character: 'キャラクター詳細 - {name}',
      persona: 'ペルソナ詳細 - {name}',
      regex: '正規表現ルール詳細 - {name}',
      aiconfig: 'AI設定詳細 - {name}',
    },
    // モーダルデフォルトタイトル
    modal: {
      newChat: '新規チャット',
      loadGame: 'ゲームをロード',
      appearance: '外観',
      plugins: 'プラグイン',
      options: 'オプション',
    },
  },
  
  // ==================== ホームコンポーネント ====================
  home: {
    // ホームメニューボタン
    menu: {
      newGame: 'New Game',
      loadGame: 'Load Game',
      plugins: 'Plugins',
      options: 'Options',
    },
    // プラグイン展示
    plugins: {
      title: 'プラグイン',
      description: 'インストール済みのプラグインを閲覧し、プラグイン詳細を表示します。',
      empty: 'プラグインがありません。サイドバーのプラグインパネルでプラグインを管理してください。',
    },
    // ゲームをロード
    loadGame: {
      title: 'ゲームをロード',
      roleUser: 'ユーザー',
      roleAssistant: 'アシスタント',
      roleSystem: 'システム',
      roleUnknown: '不明',
      characterCard: 'キャラクターカード',
      floor: 'フロア',
      noLatestMessage: '最新メッセージなし',
      getLatestFailed: '最新メッセージの取得に失敗しました',
      loadFailed: 'ロード失敗',
      notFound: '保存された会話が見つかりません',
      emptyHint: '保存された会話がありません。新しいチャットを開始すると、ここに表示されます。',
      confirm: '確認',
      delete: '削除',
    },
    // 新規チャット
    newChat: {
      title: '新規チャット',
      loading: 'リストを読み込み中...',
      creating: '作成中...',
      nameLabel: '新しいチャット名',
      namePlaceholder: 'チャット名を入力',
      nameHelp: '使用可能な文字：文字、数字、スペース、中国語、-、_；特殊文字（/ \\ : * ? " < > |）は「-」に置き換えられます。',
      nameReplaced: '許可されていない文字はファイル名の安全のため「-」に置き換えられました。',
      nameDupFile: 'ファイル名が使用中：{name}.json は既に存在します。別の名前を使用してください。',
      nameDupTitle: '内部名が使用中：「{name}」という名前のチャットが既に存在します。別の名前を使用してください。',
      descLabel: '説明（任意）',
      descPlaceholder: 'チャットの説明を入力',
      llmConfigLabel: 'AI設定（任意）',
      llmConfigPlaceholder: '未選択の場合はデフォルトのAI設定を使用',
      presetLabel: 'プリセット（必須）',
      presetPlaceholder: 'プリセットを選択',
      characterLabel: 'キャラクター（必須）',
      characterPlaceholder: 'キャラクターを選択',
      personaLabel: 'ペルソナ（必須）',
      personaPlaceholder: 'ペルソナを選択',
      regexLabel: '正規表現（任意）',
      worldbookLabel: 'ワールドブック（任意）',
      optional: '（任意）',
      configPanelTitle: '会話設定',
      configPanelSubtitle: 'プリセット（必須）・キャラクター（必須）・ペルソナ（必須）・正規表現（任意）・ワールドブック（任意）・AI設定（任意）',
      typeLabel: 'チャットタイプ',
      typeThreaded: 'スレッドチャット',
      typeThreadedSub: 'Threaded Chat',
      typeSandbox: 'フロントエンドサンドボックス',
      typeSandboxSub: 'Frontend Sandbox',
      requiredError: '名前を入力し、プリセット・キャラクター・ペルソナを選択してください（必須）',
      duplicateError: 'チャット名が重複：別の名前を使用してください（ファイル名または内部名は重複できません）',
      createFailed: 'チャットの作成に失敗しました',
      listFailed: 'リストのロードに失敗しました',
      convListFailed: '会話リストのロードに失敗しました',
      confirm: '確認',
      cancel: 'キャンセル',
    },
    // オプション
    options: {
      title: 'オプション',
      desc: 'ホームオプションはサイドバーと同じ：テーマは「システム/ライト/ダーク」で切り替え。',
      language: '言語',
      theme: 'テーマ',
      themeSystem: 'システム',
      themeLight: 'ライト',
      themeDark: 'ダーク',
      themeUsing: '現在使用中：{theme}',
      backendApi: 'バックエンドAPI URL',
      save: '保存',
      reset: 'リセット',
    },
  },

  // ==================== サービス ====================
  services: {
    dataCatalog: {
      unnamed: '無名',
    },
    routerClient: {
      routerNotInjected: 'ルーターが注入されていないか、call(action, ...) をサポートしていません',
    },
  },

  // ==================== ストア ====================
  stores: {
    character: {
      defaultAvatarLetter: 'ア',
    },
    persona: {
      defaultAvatarLetter: 'ユ',
    },
  },

  // ==================== ユーティリティ ====================
  utils: {
    resourceLoader: {
      done: '完了',
      loadComplete: 'ロード完了',
      loading: '読み込み中: {resource} ({progress}%)',
    },
  },

  // ==================== ワークフロースロット ====================
  slots: {
    homeMenu: {
      newGame: 'ニューゲーム',
      loadGame: 'ロードゲーム',
      appearance: '外観',
      plugins: 'プラグイン',
      options: 'オプション',
    },
    sidebar: {
      presets: {
        label: 'プリセット',
        desc: 'プロンプトプリセットの管理',
      },
      worldbooks: {
        label: 'ワールドブック',
        desc: 'ワールド設定と用語集の定義',
      },
      characters: {
        label: 'キャラクター',
        desc: 'キャラクターカードの管理',
      },
      personas: {
        label: 'ペルソナ',
        desc: 'ユーザープロファイルの設定',
      },
      regexrules: {
        label: '正規表現ルール',
        desc: 'テキスト処理ルール',
      },
      llmconfigs: {
        label: 'LLM設定',
        desc: 'AIプロバイダーとパラメータ',
      },
      plugins: {
        label: 'プラグイン',
        desc: 'フロントエンドプラグインの管理',
      },
      appearance: {
        label: '外観',
        desc: 'テーマと表示設定',
      },
      app: {
        label: 'アプリ設定',
        desc: 'グローバルアプリの動作',
      },
    },
  },

  // ==================== ワークフローオーケストレーター ====================
  orchestrator: {
    placeholderCompletionFail: 'プレースホルダ/補完トリガー失敗: {error}',
    retryCompletionFail: 'リトライ補完トリガー失敗: {error}',
    createAssistBranchFail: 'アシスタントブランチの作成に失敗: {error}',
  },

  // ==================== ワークフローコントローラー ====================
  workflow: {
    controllers: {
      branch: {
        readTableFailMissingParam: 'ブランチテーブルの読み込み失敗：パラメータがありません',
        readTableFail: 'ブランチテーブルの読み込み失敗',
        switchFailIncompleteParam: 'ブランチ切り替え失敗：パラメータが不完全',
        switchSuccess: 'ブランチを切り替えました',
        switchFail: 'ブランチ切り替え失敗',
        deleteFailIncompleteParam: 'ブランチ削除失敗：パラメータが不完全',
        deleteSuccess: 'ブランチを削除しました',
        deleteFail: 'ブランチ削除失敗',
        retryFailIncompleteParam: 'リトライ失敗：パラメータが不完全',
        retryAssistSuccess: '新しいブランチを作成しました',
        retryAssistFail: '新しいブランチの作成に失敗しました',
        retryUserSuccess: 'スマートリトライをトリガーしました',
        retryUserFail: 'スマートリトライ失敗',
        truncateFailIncompleteParam: '切り詰め失敗：パラメータが不完全',
        truncateSuccess: 'ブランチを切り詰めました',
        truncateFail: '切り詰め失敗',
      },
      catalog: {
        unknownResourceType: '不明なリソースタイプ: {category}',
      },
      completion: {
        completionFail: '補完失敗',
        routerNotInjected: 'プロンプトルーターが注入されていないかサポートされていません',
        completionCancelled: '補完がキャンセルされました',
      },
      message: {
        sendFailIncompleteParam: '送信失敗：パラメータが不完全',
        sendSuccess: 'メッセージを送信しました',
        sendFail: 'メッセージ送信失敗',
        editFailIncompleteParam: '編集失敗：パラメータが不完全',
        editSuccess: 'メッセージを保存しました',
        editFail: 'メッセージ保存失敗',
      },
      settings: {
        missingConversationFile: 'conversationFileパラメータがありません',
        missingOrInvalidPatch: 'patchパラメータがないか無効です',
      },
    },
  },

  // ==================== チャットコンポーネント ====================
  chat: {
    iframe: {
      notRendered: 'HTML コンテンツは未レンダリング',
      notRenderedHint: 'メモリを節約するため、このメッセージのHTML コンテンツは非表示になっています',
    },
    input: {
      expand: '拡大',
      send: '送信',
      sending: '送信中',
      stop: '停止',
      stopWaiting: '待機を停止',
      placeholder: 'メッセージを入力... (Enterで送信、Shift+Enterで改行)',
      sendShortcut: '送信 (Enter)',
    },
    
    message: {
      avatarAlt: '{name}のアバター',
      floorIndex: 'フロア番号',
      moreActions: 'その他のアクション',
      more: 'その他',
      copy: 'コピー',
      copied: 'コピーしました',
      retry: 'リトライ',
      editPlaceholder: 'メッセージ内容を入力...',
      saveShortcut: '保存 (Ctrl+Enter)',
      cancelShortcut: 'キャンセル (Esc)',
      
      // ステータス
      waiting: '待機中...{seconds}秒',
      waitingAI: 'AI応答を待機中（{seconds}秒）',
      sendSuccess: '送信成功',
      deleting: '削除中...',
      deleteSuccess: '削除成功',
      deleteFailed: '削除失敗',
      switchedToBranch: '隣接ブランチに切り替えました',
      saving: '保存中...',
      saveSuccess: '保存成功',
      saveFailed: '保存失敗',
    },
    
    branch: {
      switching: '切り替え中...',
      switched: '切り替えました',
      prevBranch: '前のブランチに切り替え',
      nextBranch: '次のブランチに切り替え',
      createNew: '新しいブランチを作成（リトライ）',
    },
    
    errors: {
      aiCallFailed: 'AI呼び出し失敗',
      noConversationFile: '会話ファイルがありません、ブランチ情報のロードをスキップ',
      cannotDetermineParentId: '親ノードIDを決定できません',
      missingConversationFile: '会話ファイルがありません',
      loadBranchFailed: 'ブランチ情報のロードに失敗しました',
      switchBranchFailed: 'ブランチ切り替えに失敗しました',
      cannotDelete: '削除できません：conversationFileがありません',
      cannotSaveEdit: '編集を保存できません：conversationFileがありません',
      retryFailed: 'リトライ失敗',
      sendFailed: '送信失敗',
      noConversationDoc: '会話ファイルまたはドキュメントがありません、メッセージを送信できません',
      missingFileOrDoc: '会話ファイルまたはドキュメントがありません',
      avatarLoadFailed: 'アバターのロードに失敗しました、デフォルトスタイルを使用',
    },
  },
}

/**
 * プラグインのアクティベート関数
 * Plugin activation function
 */
export default async function activate(host) {
  const disposers = []
  
  try {
    // 全局 i18n 对象を取得 / Get global i18n object
    const i18n = (typeof window !== 'undefined') ? window.STI18n : null
    
    if (!i18n) {
      console.warn('[locale-ja-JP] i18n システムが見つかりません。後で再試行します。')
      
      // i18n システムが読み込まれるまで待機
      let attempts = 0
      const maxAttempts = 30
      const checkInterval = setInterval(() => {
        attempts++
        const i18nLate = (typeof window !== 'undefined') ? window.STI18n : null
        
        if (i18nLate) {
          clearInterval(checkInterval)
          registerJapanese(i18nLate, host)
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval)
          console.error('[locale-ja-JP] i18n システムが見つかりませんでした')
          host.pushToast?.({
            type: 'error',
            message: '日本語言語パックの登録に失敗しました（i18nシステムが見つかりません）',
            timeout: 3000
          })
        }
      }, 200)
      
      disposers.push(() => clearInterval(checkInterval))
    } else {
      registerJapanese(i18n, host)
    }
  } catch (e) {
    console.error('[locale-ja-JP] Activation error:', e)
    host.pushToast?.({
      type: 'error',
      message: `日本語言語パックのロードに失敗しました：${e?.message || e}`,
      timeout: 3000
    })
  }
  
  // クリーンアップ関数を返す / Return cleanup function
  return () => {
    try {
      disposers.forEach(fn => { try { fn?.() } catch (_) {} })
      
      // 言語登録を解除 / Unregister locale
      const i18n = (typeof window !== 'undefined') ? window.STI18n : null
      if (i18n && typeof i18n.unregisterLocale === 'function') {
        i18n.unregisterLocale('ja-JP')
      }
    } catch (_) {}
  }
}

/**
 * 日本語を登録 / Register Japanese locale
 */
function registerJapanese(i18n, host) {
  try {
    // 既に登録されているかチェック
    if (i18n.hasLocale && i18n.hasLocale('ja-JP')) {
      console.log('[locale-ja-JP] 日本語は既に登録されています。メッセージをマージします。')
      
      // 既存の言語にメッセージをマージ
      if (typeof i18n.mergeMessages === 'function') {
        i18n.mergeMessages('ja-JP', jaJP, 'locale-ja-JP')
      }
    } else {
      // 新しい言語を登録
      const success = i18n.registerLocale('ja-JP', jaJP, {
        name: 'Japanese',
        nativeName: '日本語',
        direction: 'ltr',
        source: 'locale-ja-JP'
      })
      
      if (success) {
        console.log('[locale-ja-JP] 日本語言語パックを登録しました')
        host.pushToast?.({
          type: 'success',
          message: '日本語言語パックをロードしました',
          timeout: 1800
        })
      } else {
        console.warn('[locale-ja-JP] 日本語言語パックの登録に失敗しました')
        host.pushToast?.({
          type: 'warning',
          message: '日本語言語パックの登録に失敗しました',
          timeout: 2000
        })
      }
    }
  } catch (e) {
    console.error('[locale-ja-JP] Register error:', e)
    throw e
  }
}