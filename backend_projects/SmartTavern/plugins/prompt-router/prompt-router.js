/* no code changes; comment path update only */
 // Prompt Router Plugin — 后端版（前端路由控制）
 // 目标：将 AI 调用与提示词后处理的“路由策略”前移到前端插件（位于 backend_projects/SmartTavern/plugins），
 //       前端统一触发路由器，由路由器根据策略选择具体后端 API（modules/workflow）进行调用，从而实现自由的后处理。
// 说明：本插件在激活时向前端桥接层注册“路由器提供者”，由 CompletionBridge 使用该提供者接管补全请求。
// 参考（桥接层可接管事件）：[javascript.initCompletionBridge()](frontend_projects/SmartTavern/src/workflow/controllers/completionBridge.js:41)
// 路由器注入点：在桥接层扩展的事件中设置，[javascript.Host.events.on('workflow.router.set', ...)](frontend_projects/SmartTavern/src/workflow/controllers/completionBridge.js:7)
//
// 默认策略：
// - 自动根据 LLM 配置决定走流式或非流式
// - 调用 workflow/smarttavern/prompt_router/complete_with_hooks（支持 stream / non-stream）
//
// 事件/回调协议对齐：参考 CompletionBridge 对 callbacks 的广播
// - onChunk(content)   // 流式文本块
// - onFinish(reason)   // 结束原因
// - onUsage(usage)     // 用量信息
// - onSaved({node_id, doc, usage, content}) // 保存成功
// - onError(message)   // 错误
// - onEnd()            // 流结束
//
// 激活与卸载约定：默认导出 activate(host)；返回 dispose() 清理。

export default async function activate(host) {
  const disposers = [];

  // 统一 Hooks 管理（权重与去重由 Hooks 实现）
  // 插件通过事件注册/注销策略，不需修改路由器主文件
  const { default: Hooks } = await import('./hooks.js');
  try {
    const offReg = host.events.on('prompt.router.strategy.register', (strategy) => {
      try { Hooks.registerStrategy(strategy) } catch (_) {}
    });
    disposers.push(offReg);

    const offUnreg = host.events.on('prompt.router.strategy.unregister', (id) => {
      try { Hooks.unregisterStrategy(id) } catch (_) {}
    });
    disposers.push(offUnreg);
  } catch (_) {}

  // 后端基址解析：localStorage('st.backend_base') → window.ST_BACKEND_BASE → import.meta.env.VITE_BACKEND_BASE → 'http://localhost:8050'
  const DEFAULT_BACKEND = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || 'http://localhost:8050';

  function _readLS(key) {
    try { return (typeof window !== 'undefined') ? localStorage.getItem(key) : null } catch (_) { return null }
  }

  function getBackendBase() {
    const fromLS = _readLS('st.backend_base');
    const fromWin = (typeof window !== 'undefined') ? window.ST_BACKEND_BASE : null;
    const base = String(fromLS || fromWin || DEFAULT_BACKEND || 'http://localhost:8050');
    return base.replace(/\/+$/, '');
  }

  function ensureBase(ns = 'workflow') {
    const backend = getBackendBase();
    return `${backend}/api/${ns}`.replace(/\/+$/, '');
  }

  async function postJSON(ns, path, body = {}, headers = {}) {
    const base = ensureBase(ns);
    const url = `${base}/${String(path).replace(/^\/+/, '')}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
      body: JSON.stringify(body || {}),
    });
    const text = await resp.text().catch(() => '');
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) {
      throw new Error(`[PromptRouter] Invalid JSON (${resp.status}): ${text?.slice(0,200)}`);
    }
    if (!resp.ok) {
      const msg = (data && (data.message || data.error)) || `HTTP ${resp.status}`;
      const err = new Error(`[PromptRouter] ${msg}`);
      err.status = resp.status;
      err.details = data;
      err.url = url;
      throw err;
    }
    return data;
  }

  // ==== 后处理桥接：仅消费后端推送的 postprocess 事件（不做前端解析） ====
  function _getBridge() {
    try {
      if (typeof window !== 'undefined') {
        if (window.STPostprocessBridge) return window.STPostprocessBridge;
        if (window.STSandbox && window.STSandbox.PostprocessBridge) return window.STSandbox.PostprocessBridge;
      }
    } catch (_) {}
    return null;
  }

  function emitPostprocessViaBridge(dict, ctx) {
    const bridge = _getBridge();
    if (bridge && typeof bridge.dispatch === 'function') {
      try { bridge.dispatch(dict, ctx || {}); } catch (_) {}
    }
  }

  // 不再在前端解析 <postprocess>，只通过桥接分发

  async function readSettings(conversationFile) {
    try {
      const res = await postJSON('modules', 'smarttavern/chat_branches/settings', { action: 'get', file: conversationFile });
      return res?.settings || {};
    } catch (_) {
      return {};
    }
  }

  async function fetchLLMConfigDetail(llmConfigFile) {
    try {
      const res = await postJSON('modules', 'smarttavern/data_catalog/get_llm_config_detail', { file: llmConfigFile });
      return res?.content || {};
    } catch (e) {
      // 默认：开启流式
      return { stream: true };
    }
  }

  async function resolveLLMConfigFile(conversationFile, explicitFile) {
    if (explicitFile) return explicitFile;
    try {
      const res = await postJSON('modules', 'smarttavern/chat_branches/settings', { action: 'get', file: conversationFile });
      return res?.settings?.llm_config || '/data/llm_configs/openai_gpt4.json';
    } catch (_) {
      return '/data/llm_configs/openai_gpt4.json';
    }
  }

  // 已不再需要 openai_messages 辅助查询

  async function fetchSavedContent(conversationFile, nodeId) {
    if (!nodeId) return '';
    try {
      const res = await postJSON('modules', 'smarttavern/data_catalog/get_node_detail', { file: conversationFile, node_id: nodeId });
      const n = res?.node || {};
      return typeof n.content === 'string' ? n.content : '';
    } catch (_) {
      return '';
    }
  }

  // 流式（带 Hook 的路由）
  function routeChatCompletionStream({ conversationFile, targetNodeId, callbacks }) {
    const base = ensureBase('workflow');
    const url  = `${base}/smarttavern/prompt_router/complete_with_hooks`;
    const abortController = new AbortController();

    let fullText = '';
    let finishReason = undefined;
    let usageCache = undefined;
    let savedEmitted = false;

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify({ conversation_file: conversationFile, stream: true, target_node_id: targetNodeId }),
      signal: abortController.signal,
    })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      function readChunk() {
        reader.read().then(({ done, value }) => {
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n'); buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const dataStr = line.slice(6).trim(); if (!dataStr) continue;
            try {
              const data = JSON.parse(dataStr);
              switch (data.type) {
                case 'chunk':   {
                  const chunk = String(data.content || '');
                  fullText += chunk;
                  callbacks.onChunk?.(chunk);
                  break;
                }
                case 'postprocess': {
                  // 后端主动推送 postprocess 事件（推荐）
                  // 约定：data.items 为统一协议字典，data.node_id 为关联节点
                  const dict = (data && (data.items || data.dict || data.payload)) || null;
                  if (dict && typeof dict === 'object') {
                    emitPostprocessViaBridge(dict, { conversationFile, nodeId: data.node_id });
                  }
                  break;
                }
                case 'finish':  {
                  finishReason = data.finish_reason;
                  callbacks.onFinish?.(finishReason);
                  break;
                }
                case 'usage':   {
                  usageCache = data.usage;
                  callbacks.onUsage?.(usageCache);
                  break;
                }
                case 'saved':   {
                  savedEmitted = true;
                  const nodeId = data.node_id;
                  // 优先取后端已保存（已剔除一次性项）的最终内容
                  fetchSavedContent(conversationFile, nodeId)
                    .then(savedContent => {
                      const finalContent = savedContent || fullText;
                      callbacks.onSaved?.({ node_id: nodeId, doc: data.doc, usage: data.usage, content: finalContent });
                    })
                    .catch(() => {
                      callbacks.onSaved?.({ node_id: nodeId, doc: data.doc, usage: data.usage, content: fullText });
                    });
                  break;
                }
                case 'error':   callbacks.onError?.(data.message); return;
                case 'end':     {
                  // 若未收到 saved，则用 get_latest_message 获取最新节点，再读取节点内容
                  if (!savedEmitted) {
                    postJSON('modules', 'smarttavern/chat_branches/get_latest_message', { file: conversationFile })
                      .then((latest) => {
                        const nodeId = latest?.node_id;
                        if (nodeId) {
                          fetchSavedContent(conversationFile, nodeId)
                            .then(savedContent => {
                              const finalContent = savedContent || fullText;
                              callbacks.onSaved?.({ node_id: nodeId, doc: undefined, usage: usageCache, content: finalContent });
                            })
                            .catch(() => {
                              callbacks.onSaved?.({ node_id: nodeId, doc: undefined, usage: usageCache, content: fullText });
                            })
                            .finally(() => { callbacks.onEnd?.(); });
                          return;
                        }
                        callbacks.onEnd?.();
                      })
                      .catch(() => { callbacks.onEnd?.(); });
                    return;
                  }
                  // 已收到 saved
                  callbacks.onEnd?.();
                  return;
                }
              }
            } catch (e) {
              console.error('[PromptRouter] SSE parse error:', e);
            }
          }
          readChunk();
        }).catch(err => {
          if (err?.name !== 'AbortError') {
            console.error('[PromptRouter] Stream read error:', err);
            callbacks.onError?.('Stream read error');
          }
        });
      }
      readChunk();
    })
    .catch(err => {
      if (err?.name !== 'AbortError') {
        console.error('[PromptRouter] Fetch error:', err);
        callbacks.onError?.(err.message || 'Request failed');
        callbacks.onEnd?.();
      }
    });

    return { abort: () => abortController.abort() };
  }

  // 非流式（带 Hook 的 AI 调用）
  async function routeChatCompletionSingle({ conversationFile, targetNodeId, callbacks }) {
    // 🚀 使用新的 complete_with_hooks API
    // 自动执行所有 Hook（11个提示词Hook + 4个LLM Hook）
    const res = await postJSON('workflow', 'smarttavern/prompt_router/complete_with_hooks', {
      conversation_file: conversationFile,
      target_node_id: targetNodeId,
    });
    if (res?.success) {
      callbacks.onSaved?.({
        node_id: res.node_id,
        doc: res.doc,
        usage: res.usage,
        content: res.content,
      });
      // 分发后处理事件（非流式）：后端在响应中携带 postprocess_items
      try {
        const dict = res.postprocess_items;
        if (dict && typeof dict === 'object') {
          emitPostprocessViaBridge(dict, { conversationFile, nodeId: res.node_id });
        }
      } catch (_) {}
      callbacks.onFinish?.(res.finish_reason || 'stop');
      callbacks.onUsage?.(res.usage);
      callbacks.onEnd?.();
    } else {
      callbacks.onError?.(res?.error || 'AI调用失败');
      callbacks.onEnd?.();
    }
  }

  // 视图处理路由（使用后端 Hook API）
  async function routeProcessView({ conversationFile, view = 'user_view', output = 'full' }) {
    try {
      // 🚀 新架构：直接调用后端 API，所有 Hook 在后端执行
      // 后端会自动：
      // 1. 读取所有配置文件
      // 2. 执行所有 Hook（beforeNormalizeAssets → afterVariablesSave）
      // 3. 调用所有处理 API（assets_normalizer → prompt_postprocess）
      // 4. 返回最终处理后的提示词
      const res = await postJSON('workflow', 'smarttavern/prompt_router/route_with_hooks', {
        conversation_file: conversationFile,
        view,
        output
      })
      
      return res || { success: false, error: 'No response', messages: [], variables: {} }
    } catch (e) {
      return { success: false, error: String(e), messages: [], variables: {} }
    }
  }

  // 路由器提供者：统一动作接口
  const routerProvider = {
    /**
     * 统一动作接口：call(action, payload, callbacks)
     * - completion.stream / completion.single / completion.auto
     * - prompt.process_view
     */
    async call(action, payload = {}, callbacks = {}) {
      const act = String(action || '').toLowerCase()
      if (!act) { callbacks.onError?.('PromptRouter: action required'); callbacks.onEnd?.(); return }

      // 统一：仅支持 completion.auto 与 prompt.process_view
      if (act === 'completion.auto') {
        const conversationFile = String(payload?.conversationFile || '').trim()
        const targetNodeId = payload?.tag ? String(payload.tag) : undefined
        // 默认走流式（后端会处理 Hook 与保存）；将目标节点ID传给后端用于精准写入
        const useStream = true
        if (useStream) {
          return routeChatCompletionStream({ conversationFile, targetNodeId, callbacks })
        }
        await routeChatCompletionSingle({ conversationFile, targetNodeId, callbacks })
        return
      }

      if (act === 'prompt.process_view') {
        const conversationFile = String(payload?.conversationFile || '').trim()
        const view = String(payload?.view || 'user_view')
        const output = String(payload?.output || 'full')
        const res = await routeProcessView({ conversationFile, view, output })
        if (res?.success) {
          callbacks.onFinish?.('stop')
          callbacks.onEnd?.()
          return res
        } else {
          callbacks.onError?.(res?.error || 'process_view failed')
          callbacks.onEnd?.()
          return res
        }
      }

      // 严格模式：不再支持 completion.stream/completion.single，请改用 completion.auto
      callbacks.onError?.(`PromptRouter: unsupported action '${act}' (use 'completion.auto')`)
      callbacks.onEnd?.()
    },
  };

  // 注册路由器（通知 CompletionBridge 接管）
  try {
    host.events.emit('workflow.router.set', routerProvider);
    host.pushToast?.({ type: 'info', message: 'Prompt Router 插件已启用（前端路由）', timeout: 2000 });
  } catch (e) {
    console.warn('[PromptRouter] 注册失败：', e);
  }

  // 卸载：解除路由器接管
  const dispose = () => {
    try { host.events.emit('workflow.router.set', null); } catch (_) {}
    host.pushToast?.({ type: 'info', message: 'Prompt Router 插件已卸载', timeout: 1800 });
  };

  disposers.push(() => dispose());

  // 返回清理函数
  return () => {
    try { disposers.forEach(fn => { try { fn?.(); } catch (_) {} }); } catch (_) {}
  };
}

// 索引/文档：
// - 路由器接管事件：[javascript.Host.events.on('workflow.router.set', ...)](frontend_projects/SmartTavern/src/workflow/controllers/completionBridge.js:7)
// - ChatCompletion 服务行为：[javascript.ChatCompletion.completeAuto()](frontend_projects/SmartTavern/src/services/chatCompletion.js:11)
// - hooks 管理器（更多侵入点与权重排序）：[`javascript.Hooks`](backend_projects/SmartTavern/plugins/prompt-router/hooks.js:1)
// - prompt_postprocess（正则+宏单视图）：[python.function(apply)](api/workflow/smarttavern/prompt_postprocess/prompt_postprocess.py:86)