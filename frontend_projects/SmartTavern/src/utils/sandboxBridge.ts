// SmartTavern - 沙盒桥接脚本
// 目标：在 iframe 内注入此脚本，自动桥接父窗口的前端 API，使沙盒 HTML 可直接调用
// 
// 用法：HtmlIframeSandbox 在 srcdoc 的 <head> 中注入此脚本，沙盒内即可：
//   const url = await getCurrentCharAvatarPath()
//   const url2 = await getCharAvatarPath('current')
// 而无需写 parent.getCurrentCharAvatarPath()

/**
 * 生成沙盒桥接脚本（返回 JS 代码字符串，可内联到 <script> 标签）
 * @returns {string} 桥接脚本源码
 */
export function generateSandboxBridgeScript(): string {
  // IIFE 避免污染全局作用域，但需要的函数会主动挂到 window
  return `
(function() {
  'use strict';
  
  // 检测是否在 iframe 内且有父窗口
  const isIframe = (typeof window !== 'undefined' && window !== window.parent);
  if (!isIframe) {
    console.warn('[SandboxBridge] Not in iframe, bridge functions unavailable');
    return;
  }

  /**
   * 桥接：获取当前角色卡头像 URL
   * @returns {string}
   */
  function getCharAvatarPath() {
    try {
      if (typeof window.parent.getCharAvatarPath === 'function') {
        return window.parent.getCharAvatarPath();
      } else {
        console.error('[SandboxBridge] parent.getCharAvatarPath is not available');
        return null;
      }
    } catch (e) {
      console.error('[SandboxBridge] getCharAvatarPath failed:', e);
      return null;
    }
  }

  /**
   * 桥接：获取当前用户画像头像 URL
   * @returns {string}
   */
  function getPersonaAvatarPath() {
    try {
      if (typeof window.parent.getPersonaAvatarPath === 'function') {
        return window.parent.getPersonaAvatarPath();
      } else {
        console.error('[SandboxBridge] parent.getPersonaAvatarPath is not available');
        return null;
      }
    } catch (e) {
      console.error('[SandboxBridge] getPersonaAvatarPath failed:', e);
      return null;
    }
  }

  /**
   * 桥接：获取角色卡的完整状态或指定字段
   * @param {string} key - 可选，要获取的字段路径；不传则返回完整状态
   * @returns {any}
   */
  function getChar(key) {
    try {
      if (typeof window.parent.getChar === 'function') {
        return window.parent.getChar(key);
      } else {
        console.error('[SandboxBridge] parent.getChar is not available');
        return undefined;
      }
    } catch (e) {
      console.error('[SandboxBridge] getChar failed:', e);
      return undefined;
    }
  }


  /**
   * 桥接：获取用户画像的完整状态或指定字段
   * @param {string} key - 可选，要获取的字段路径；不传则返回完整状态
   * @returns {any}
   */
  function getPersona(key) {
    try {
      if (typeof window.parent.getPersona === 'function') {
        return window.parent.getPersona(key);
      } else {
        console.error('[SandboxBridge] parent.getPersona is not available');
        return undefined;
      }
    } catch (e) {
      console.error('[SandboxBridge] getPersona failed:', e);
      return undefined;
    }
  }


  /**
   * 桥接：获取当前对话的单个变量值
   * @param {string} key - 变量路径（如 'user.name'）
   * @returns {Promise<any>}
   */
  async function getVariable(key) {
    try {
      if (typeof window.parent.getVariable === 'function') {
        return await window.parent.getVariable(key);
      } else {
        console.error('[SandboxBridge] parent.getVariable is not available');
        return undefined;
      }
    } catch (e) {
      console.error('[SandboxBridge] getVariable failed:', e);
      return undefined;
    }
  }

  /**
   * 桥接：获取当前对话的多个变量值
   * @param {...string} keys - 变量路径列表
   * @returns {Promise<object>}
   */
  async function getVariables(...keys) {
    try {
      if (typeof window.parent.getVariables === 'function') {
        return await window.parent.getVariables(...keys);
      } else {
        console.error('[SandboxBridge] parent.getVariables is not available');
        return {};
      }
    } catch (e) {
      console.error('[SandboxBridge] getVariables failed:', e);
      return {};
    }
  }

  /**
   * 桥接：获取变量路径对应的 JSON（不传则返回整个变量对象）
   * @param {string} key - 可选，变量路径
   * @returns {Promise<any>}
   */
  async function getVariableJSON(key) {
    try {
      if (typeof window.parent.getVariableJSON === 'function') {
        return await window.parent.getVariableJSON(key);
      } else {
        console.error('[SandboxBridge] parent.getVariableJSON is not available');
        return {};
      }
    } catch (e) {
      console.error('[SandboxBridge] getVariableJSON failed:', e);
      throw e;
    }
  }

  /**
   * 桥接：设置当前对话的单个变量值
   * @param {string} key - 变量路径
   * @param {any} value - 变量值
   * @returns {Promise<void>}
   */
  async function setVariable(key, value) {
    try {
      if (typeof window.parent.setVariable === 'function') {
        return await window.parent.setVariable(key, value);
      } else {
        console.error('[SandboxBridge] parent.setVariable is not available');
      }
    } catch (e) {
      console.error('[SandboxBridge] setVariable failed:', e);
      throw e;
    }
  }

  /**
   * 桥接：批量设置当前对话的变量值
   * @param {object} data - 变量字典，键为路径，值为对应的变量值
   * @returns {Promise<void>}
   */
  async function setVariables(data) {
    try {
      if (typeof window.parent.setVariables === 'function') {
        return await window.parent.setVariables(data);
      } else {
        console.error('[SandboxBridge] parent.setVariables is not available');
      }
    } catch (e) {
      console.error('[SandboxBridge] setVariables failed:', e);
      throw e;
    }
  }

  /**
   * 桥接：删除当前对话的单个变量
   * @param {string} key - 变量路径
   * @returns {Promise<void>}
   */
  async function deleteVariable(key) {
    try {
      if (typeof window.parent.deleteVariable === 'function') {
        return await window.parent.deleteVariable(key);
      } else {
        console.error('[SandboxBridge] parent.deleteVariable is not available');
      }
    } catch (e) {
      console.error('[SandboxBridge] deleteVariable failed:', e);
      throw e;
    }
  }

  /**
   * 桥接：批量删除当前对话的变量
   * @param {string[]} keys - 变量路径数组
   * @returns {Promise<void>}
   */
  async function deleteVariables(keys) {
    try {
      if (typeof window.parent.deleteVariables === 'function') {
        return await window.parent.deleteVariables(keys);
      } else {
        console.error('[SandboxBridge] parent.deleteVariables is not available');
      }
    } catch (e) {
      console.error('[SandboxBridge] deleteVariables failed:', e);
      throw e;
    }
  }

  /**
   * 桥接：获取当前对话的 settings
   * @returns {object|null} settings 对象
   */
  function getChatSettings() {
    try {
      if (typeof window.parent.getChatSettings === 'function') {
        return window.parent.getChatSettings();
      } else {
        console.error('[SandboxBridge] parent.getChatSettings is not available');
        return null;
      }
    } catch (e) {
      console.error('[SandboxBridge] getChatSettings failed:', e);
      return null;
    }
  }

  /**
   * 桥接：获取当前对话 settings 的特定字段
   * @param {string} key - settings 字段名（如 'preset', 'llm_config', 'character'）
   * @returns {any} 字段值，如果不存在返回 undefined
   */
  function getChatSettingsField(key) {
    try {
      if (typeof window.parent.getChatSettingsField === 'function') {
        return window.parent.getChatSettingsField(key);
      } else {
        console.error('[SandboxBridge] parent.getChatSettingsField is not available');
        return undefined;
      }
    } catch (e) {
      console.error('[SandboxBridge] getChatSettingsField failed:', e);
      return undefined;
    }
  }

  /**
   * 桥接：获取当前 LLM 配置
   * @returns {object|null} LLM 配置对象
   */
  function getLlmConfig() {
    try {
      if (typeof window.parent.getLlmConfig === 'function') {
        return window.parent.getLlmConfig();
      } else {
        console.error('[SandboxBridge] parent.getLlmConfig is not available');
        return null;
      }
    } catch (e) {
      console.error('[SandboxBridge] getLlmConfig failed:', e);
      return null;
    }
  }

  /**
   * 桥接：获取当前 LLM 配置的特定字段
   * @param {string} key - 配置字段名（如 'provider', 'model', 'temperature'）
   * @returns {any} 字段值，如果不存在返回 undefined
   */
  function getLlmConfigField(key) {
    try {
      if (typeof window.parent.getLlmConfigField === 'function') {
        return window.parent.getLlmConfigField(key);
      } else {
        console.error('[SandboxBridge] parent.getLlmConfigField is not available');
        return undefined;
      }
    } catch (e) {
      console.error('[SandboxBridge] getLlmConfigField failed:', e);
      return undefined;
    }
  }

  /**
   * 桥接：获取当前预设的完整状态或指定字段
   * @param {string} key - 可选，要获取的字段路径；不传则返回完整状态
   * @returns {any}
   */
  function getPreset(key) {
    try {
      if (typeof window.parent.getPreset === 'function') {
        return window.parent.getPreset(key);
      } else {
        console.error('[SandboxBridge] parent.getPreset is not available');
        return undefined;
      }
    } catch (e) {
      console.error('[SandboxBridge] getPreset failed:', e);
      return undefined;
    }
  }


  /**
   * 桥接：获取世界书列表的完整状态或指定字段
   * @param {string} key - 可选，要获取的字段路径；不传则返回完整状态
   * @returns {any}
   */
  function getWorldBooks(key) {
    try {
      if (typeof window.parent.getWorldBooks === 'function') {
        return window.parent.getWorldBooks(key);
      } else {
        console.error('[SandboxBridge] parent.getWorldBooks is not available');
        return undefined;
      }
    } catch (e) {
      console.error('[SandboxBridge] getWorldBooks failed:', e);
      return undefined;
    }
  }

  /**
   * 桥接：获取正则规则列表的完整状态或指定字段
   * @param {string} key - 可选，要获取的字段路径；不传则返回完整状态
   * @returns {any}
   */
  function getRegexRules(key) {
    try {
      if (typeof window.parent.getRegexRules === 'function') {
        return window.parent.getRegexRules(key);
      } else {
        console.error('[SandboxBridge] parent.getRegexRules is not available');
        return undefined;
      }
    } catch (e) {
      console.error('[SandboxBridge] getRegexRules failed:', e);
      return undefined;
    }
  }

  /**
   * 桥接：自定义参数聊天补全
   * @param {object} params - 参数对象
   * @param {string} params.provider - API提供商 ('openai'|'anthropic'|'gemini'|'openai_compatible')
   * @param {string} params.api_key - API密钥
   * @param {string} params.base_url - API基础URL
   * @param {Array} params.messages - 消息数组
   * @param {string} params.model - 模型名称
   * @param {boolean} [params.stream=false] - 是否流式返回
   * @param {number} [params.max_tokens] - 最大token数
   * @param {number} [params.temperature] - 温度参数
   * @param {number} [params.top_p] - top_p参数
   * @returns {Promise<object|EventSource>}
   */
  async function chatCompletion(params) {
    try {
      if (typeof window.parent.chatCompletion === 'function') {
        return await window.parent.chatCompletion(params);
      } else {
        console.error('[SandboxBridge] parent.chatCompletion is not available');
        throw new Error('chatCompletion is not available');
      }
    } catch (e) {
      console.error('[SandboxBridge] chatCompletion failed:', e);
      throw e;
    }
  }

  /**
   * 桥接：使用当前对话配置进行聊天补全
   * @param {object} params - 参数对象
   * @param {Array} params.messages - 消息数组
   * @param {boolean} [params.stream=false] - 是否流式返回
   * @returns {Promise<object|EventSource>}
   */
  async function chatCompletionWithCurrentConfig(params) {
    try {
      if (typeof window.parent.chatCompletionWithCurrentConfig === 'function') {
        return await window.parent.chatCompletionWithCurrentConfig(params);
      } else {
        console.error('[SandboxBridge] parent.chatCompletionWithCurrentConfig is not available');
        throw new Error('chatCompletionWithCurrentConfig is not available');
      }
    } catch (e) {
      console.error('[SandboxBridge] chatCompletionWithCurrentConfig failed:', e);
      throw e;
    }
  }

  /**
   * 桥接：提示词装配（RAW：prefix + in-chat）
   * @param {object} params - 参数对象
   * @param {object} params.presets - 预设文档对象
   * @param {Array|object} params.world_books - 世界书条目数组/对象
   * @param {Array} params.history - OpenAI Chat messages 数组
   * @param {object} [params.character] - 可选，角色文档对象
   * @param {object} [params.persona] - 可选，用户画像文档对象
   * @param {object} [params.variables] - 可选，变量对象
   * @returns {Promise<object>} { messages: [...] }
   */
  async function assemblePrompt(params) {
    try {
      if (typeof window.parent.assemblePrompt === 'function') {
        return await window.parent.assemblePrompt(params);
      } else {
        console.error('[SandboxBridge] parent.assemblePrompt is not available');
        throw new Error('assemblePrompt is not available');
      }
    } catch (e) {
      console.error('[SandboxBridge] assemblePrompt failed:', e);
      throw e;
    }
  }

  /**
   * 桥接：使用当前对话配置进行提示词装配
   * @param {object} params - 参数对象
   * @param {Array} params.history - 必需，OpenAI Chat messages 数组
   * @returns {Promise<object>} { messages: [...] }
   */
  async function assemblePromptWithCurrentConfig(params) {
    try {
      if (typeof window.parent.assemblePromptWithCurrentConfig === 'function') {
        return await window.parent.assemblePromptWithCurrentConfig(params);
      } else {
        console.error('[SandboxBridge] parent.assemblePromptWithCurrentConfig is not available');
        throw new Error('assemblePromptWithCurrentConfig is not available');
      }
    } catch (e) {
      console.error('[SandboxBridge] assemblePromptWithCurrentConfig failed:', e);
      throw e;
    }
  }

  /**
   * 桥接：提示词后处理（单视图：正则 + 宏）
   * @param {object} params - 参数对象
   * @param {Array} params.messages - OpenAI Chat 消息数组
   * @param {Array|object} params.regex_rules - 正则规则
   * @param {string} params.view - 视图选择 ('user_view' | 'assistant_view')
   * @param {object} [params.variables] - 可选，变量对象
   * @returns {Promise<object>} { message: [...], variables: {...} }
   */
  async function postprocessPrompt(params) {
    try {
      if (typeof window.parent.postprocessPrompt === 'function') {
        return await window.parent.postprocessPrompt(params);
      } else {
        console.error('[SandboxBridge] parent.postprocessPrompt is not available');
        throw new Error('postprocessPrompt is not available');
      }
    } catch (e) {
      console.error('[SandboxBridge] postprocessPrompt failed:', e);
      throw e;
    }
  }

  /**
   * 桥接：使用当前对话配置进行提示词后处理
   * @param {object} params - 参数对象
   * @param {Array} params.messages - 必需，OpenAI Chat 消息数组
   * @param {string} params.view - 必需，视图选择 ('user_view' | 'assistant_view')
   * @returns {Promise<object>} { message: [...], variables: {...} }
   */
  async function postprocessPromptWithCurrentConfig(params) {
    try {
      if (typeof window.parent.postprocessPromptWithCurrentConfig === 'function') {
        return await window.parent.postprocessPromptWithCurrentConfig(params);
      } else {
        console.error('[SandboxBridge] parent.postprocessPromptWithCurrentConfig is not available');
        throw new Error('postprocessPromptWithCurrentConfig is not available');
      }
    } catch (e) {
      console.error('[SandboxBridge] postprocessPromptWithCurrentConfig failed:', e);
      throw e;
    }
  }

  // ========== 动态桥接注册（供父窗口/插件调用） ==========
  const __SB_REGISTRY = Object.create(null);

  function __attachToWindow(name, fn) {
    try { window[name] = fn } catch (_) {}
  }

  function __attachToSandbox(name, fn) {
    try {
      if (window.STSandbox && typeof window.STSandbox === 'object') {
        window.STSandbox[name] = fn;
      }
    } catch (_) {}
  }

  function registerSandboxFunction(name, fn, options) {
    if (!name || typeof fn !== 'function') return false;
    if (!options || options.override !== false || !__SB_REGISTRY[name]) {
      __SB_REGISTRY[name] = fn;
      __attachToWindow(name, fn);
      __attachToSandbox(name, fn);
      return true;
    }
    return false;
  }

  function registerSandboxFunctions(map, options) {
    if (!map || typeof map !== 'object') return 0;
    let n = 0;
    for (const k in map) {
      const ok = registerSandboxFunction(k, map[k], options);
      if (ok) n++;
    }
    return n;
  }

  function registerParentFunctions(names, options) {
    if (!Array.isArray(names)) return 0;
    let n = 0;
    for (const nm of names) {
      try {
        const pfn = window.parent && window.parent[nm];
        if (typeof pfn === 'function') {
          const wrapper = async function(...args) { return await pfn.apply(window.parent, args) };
          if (registerSandboxFunction(nm, wrapper, options)) n++;
        }
      } catch (_) {}
    }
    return n;
  }

  function unregisterSandboxFunction(name) {
    if (!name || !__SB_REGISTRY[name]) return false;
    try { delete __SB_REGISTRY[name] } catch (_) {}
    try { delete (window)[name] } catch (_) {}
    try { if (window.STSandbox) delete window.STSandbox[name] } catch (_) {}
    return true;
  }

  function listSandboxFunctions() {
    return Object.keys(__SB_REGISTRY);
  }

  // 预设自动桥接：若父窗口已提供这些函数，则自动注入到沙盒
  try {
    registerParentFunctions([
      'getCtxVarJSON', 'getCtxVarJSONUntil',
      'getCtxVar', 'getCtxVars', 'getCtxVarUntil', 'getCtxVarsUntil'
    ], { override: false });
  } catch (_) {}

  /**
   * 桥接：使用后端路由处理提示词（带完整 Hook 执行）
   * @param {object} [params] - 参数对象
   * @param {string} [params.conversation_file] - 对话文件路径，不传则使用当前对话
   * @param {string} [params.view='user_view'] - 视图选择
   * @param {string} [params.output='full'] - 输出模式
   * @returns {Promise<object>} { messages: [...], variables?: {...} }
   */
  async function routePromptWithHooks(params) {
    try {
      if (typeof window.parent.routePromptWithHooks === 'function') {
        return await window.parent.routePromptWithHooks(params);
      } else {
        console.error('[SandboxBridge] parent.routePromptWithHooks is not available');
        throw new Error('routePromptWithHooks is not available');
      }
    } catch (e) {
      console.error('[SandboxBridge] routePromptWithHooks failed:', e);
      throw e;
    }
  }

  /**
   * 桥接：使用后端路由进行 AI 调用（带完整 Hook 执行）
   * @param {object} [params] - 参数对象
   * @param {string} [params.conversation_file] - 对话文件路径，不传则使用当前对话
   * @param {boolean} [params.stream=false] - 是否流式返回
   * @returns {Promise<object|EventSource>}
   */
  async function completeWithHooks(params) {
    try {
      if (typeof window.parent.completeWithHooks === 'function') {
        return await window.parent.completeWithHooks(params);
      } else {
        console.error('[SandboxBridge] parent.completeWithHooks is not available');
        throw new Error('completeWithHooks is not available');
      }
    } catch (e) {
      console.error('[SandboxBridge] completeWithHooks failed:', e);
      throw e;
    }
  }

  /**
   * 桥接：显示 Toast 提示
   * @param {string|object} options - 消息内容或配置对象
   * @returns {object|null} Toast 对象
   */
  function showToast(options) {
    try {
      if (typeof window.parent.showToast === 'function') {
        return window.parent.showToast(options);
      } else {
        console.error('[SandboxBridge] parent.showToast is not available');
        return null;
      }
    } catch (e) {
      console.error('[SandboxBridge] showToast failed:', e);
      return null;
    }
  }

  // Toast 快捷方法
  showToast.success = function(message, timeout) {
    return showToast({ type: 'success', message, timeout });
  };
  showToast.error = function(message, timeout) {
    return showToast({ type: 'error', message, timeout });
  };
  showToast.warning = function(message, timeout) {
    return showToast({ type: 'warning', message, timeout });
  };
  showToast.info = function(message, timeout) {
    return showToast({ type: 'info', message, timeout });
  };

  /**
   * 桥接：显示选项面板
   * @param {object} config - 配置对象
   * @returns {Promise<any>} 用户选择的值
   */
  async function showOptions(config) {
    try {
      if (typeof window.parent.showOptions === 'function') {
        return await window.parent.showOptions(config);
      } else {
        console.error('[SandboxBridge] parent.showOptions is not available');
        throw new Error('showOptions is not available');
      }
    } catch (e) {
      console.error('[SandboxBridge] showOptions failed:', e);
      throw e;
    }
  }

  // Options 快捷方法
  showOptions.single = async function(config) {
    return await showOptions({ ...config, type: 'single' });
  };
  showOptions.multiple = async function(config) {
    return await showOptions({ ...config, type: 'multiple' });
  };
  showOptions.any = async function(config) {
    return await showOptions({ ...config, type: 'any' });
  };

  /**
   * 桥接：访问父窗口的工作流 Host 事件总线（供插件使用）
   * 使沙盒内可以 emit/on 事件
   */
  const HostEvents = {
    emit: function(eventName, data) {
      try {
        if (window.parent.STHost && typeof window.parent.STHost.events.emit === 'function') {
          window.parent.STHost.events.emit(eventName, data);
        } else {
          console.warn('[SandboxBridge] parent.STHost.events not available');
        }
      } catch (e) {
        console.error('[SandboxBridge] HostEvents.emit failed:', e);
      }
    },
    on: function(eventName, handler) {
      try {
        if (window.parent.STHost && typeof window.parent.STHost.events.on === 'function') {
          return window.parent.STHost.events.on(eventName, handler);
        } else {
          console.warn('[SandboxBridge] parent.STHost.events not available');
          return () => {};
        }
      } catch (e) {
        console.error('[SandboxBridge] HostEvents.on failed:', e);
        return () => {};
      }
    }
  };

  // 挂载到 window（沙盒全局作用域）
  window.getCharAvatarPath = getCharAvatarPath;
  window.getPersonaAvatarPath = getPersonaAvatarPath;
  window.getChar = getChar;
  window.getPersona = getPersona;
  window.getVariable = getVariable;
  window.getVariables = getVariables;
  window.getVariableJSON = getVariableJSON;
  window.setVariable = setVariable;
  window.setVariables = setVariables;
  window.deleteVariable = deleteVariable;
  window.deleteVariables = deleteVariables;
  window.getChatSettings = getChatSettings;
  window.getChatSettingsField = getChatSettingsField;
  window.getLlmConfig = getLlmConfig;
  window.getLlmConfigField = getLlmConfigField;
  window.getPreset = getPreset;
  window.getWorldBooks = getWorldBooks;
  window.getRegexRules = getRegexRules;
  window.chatCompletion = chatCompletion;
  window.chatCompletionWithCurrentConfig = chatCompletionWithCurrentConfig;
  window.assemblePrompt = assemblePrompt;
  window.assemblePromptWithCurrentConfig = assemblePromptWithCurrentConfig;
  window.postprocessPrompt = postprocessPrompt;
  window.postprocessPromptWithCurrentConfig = postprocessPromptWithCurrentConfig;
  window.routePromptWithHooks = routePromptWithHooks;
  window.completeWithHooks = completeWithHooks;
  window.showToast = showToast;
  window.showOptions = showOptions;
  window.HostEvents = HostEvents;
  window.STSandboxRegistry = {
    register: registerSandboxFunction,
    registerBatch: registerSandboxFunctions,
    registerParent: registerParentFunctions,
    unregister: unregisterSandboxFunction,
    list: listSandboxFunctions,
  };

  // 提供一个便捷的工具对象，集成所有桥接 API
  window.STSandbox = {
    getCharAvatarPath,
    getPersonaAvatarPath,
    getChar,
    getPersona,
    getVariable,
    getVariables,
    getVariableJSON,
    setVariable,
    setVariables,
    deleteVariable,
    deleteVariables,
    getChatSettings,
    getChatSettingsField,
    getLlmConfig,
    getLlmConfigField,
    getPreset,
    getWorldBooks,
    getRegexRules,
    chatCompletion,
    chatCompletionWithCurrentConfig,
    assemblePrompt,
    assemblePromptWithCurrentConfig,
    postprocessPrompt,
    postprocessPromptWithCurrentConfig,
    routePromptWithHooks,
    completeWithHooks,
    showToast,
    showOptions,
    HostEvents,
    version: '1.7.0'
  };

  // 同步将已注册函数写入 STSandbox（若先前注册发生在 STSandbox 创建之前）
  try {
    if (window.STSandbox && __SB_REGISTRY) {
      for (const k of Object.keys(__SB_REGISTRY)) {
        try { window.STSandbox[k] = __SB_REGISTRY[k] } catch (_) {}
      }
    }
  } catch (_) {}

  console.log('[SandboxBridge] Bridge functions ready:', Object.keys(window.STSandbox));
})();
`.trim();
}

/**
 * 便捷函数：返回可直接嵌入 <script> 标签的完整脚本片段
 * @returns {string} <script>...</script>
 */
export function getSandboxBridgeScriptTag(): string {
  return `<script>${generateSandboxBridgeScript()}</script>`;
}

const sandboxBridge = {
  generateSandboxBridgeScript,
  getSandboxBridgeScriptTag
}

export default sandboxBridge