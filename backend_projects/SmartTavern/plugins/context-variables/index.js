 // Context Variables Plugin — 上下文变量（初始化）
 // 功能：
 // - 监听“新建对话成功/加载对话成功”事件
 // - 调用后端插件 API 确保/创建 context_variables.json（从角色世界书 [InitVar] 条目平移）
 // - 成功与失败均以 Toast 提示
 //
 // 说明：不使用对话 variables 的旧占位回退逻辑，仅依赖后端 API。
 //
 // 事件来源：conversation 通道（参考 src/workflow/channels/conversation.ts）
 //   - 'conversation:create:ok'
 //   - 'conversation:load:ok'
 //
 // 后端地址解析：与现有统一规范一致
 //   localStorage('st.backend_base') → window.ST_BACKEND_BASE → import.meta.env.VITE_API_BASE → 'http://localhost:8050'

export default async function activate(host) {
  const disposers = [];

  // ========= 后端地址工具 =========
  const DEFAULT_BACKEND =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) ||
    'http://localhost:8050';

  function _readLS(key) {
    try { return (typeof window !== 'undefined') ? localStorage.getItem(key) : null } catch (_) { return null }
  }
  function getBackendBase() {
    const fromLS = _readLS('st.backend_base');
    const fromWin = (typeof window !== 'undefined') ? window.ST_BACKEND_BASE : null;
    const base = String(fromLS || fromWin || DEFAULT_BACKEND || 'http://localhost:8050');
    return base.replace(/\/+$/, '');
  }
  function ensureBase(ns = 'modules') {
    // 只用 modules 命名空间
    return `${getBackendBase()}/api/${ns}`.replace(/\/+$/, '');
  }
  async function postJSON(ns, path, body = {}, headers = {}) {
    const base = ensureBase(ns);
    const url = `${base}/${String(path).replace(/^\/+/, '')}`;
    let resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
        body: JSON.stringify(body || {}),
      });
    } catch (e) {
      const err = new Error(`[context-variables] Network error: ${e?.message || e}`);
      err.cause = e;
      err.url = url;
      throw err;
    }
    const text = await resp.text().catch(() => '');
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (pe) {
      const err = new Error(`[context-variables] Invalid JSON (${resp.status}): ${text?.slice(0,200)}`);
      err.cause = pe;
      err.status = resp.status;
      err.url = url;
      throw err;
    }
    if (!resp.ok) {
      const err = new Error(`[context-variables] HTTP ${resp.status}: ${(data && (data.message || data.error)) || 'Unknown'}`);
      err.status = resp.status;
      err.details = data;
      err.url = url;
      throw err;
    }
    return data;
  }

  // ========= 业务辅助 =========
  async function getSettings(conversationFile) {
    try {
      const res = await postJSON('modules', 'smarttavern/chat_branches/settings', { action: 'get', file: conversationFile });
      return res?.settings || {};
    } catch (_) {
      return {};
    }
  }

  async function getCharacterDetail(characterFile) {
    if (!characterFile) return null;
    try {
      const res = await postJSON('modules', 'smarttavern/data_catalog/get_character_detail', { file: characterFile });
      // DataCatalog 风格：{ file, content }
      return res?.content || res || null;
    } catch (_) {
      return null;
    }
  }

  function extractInitVarFromCharacter(characterDoc) {
    try {
      if (!characterDoc || !characterDoc.world_book || !Array.isArray(characterDoc.world_book.entries)) return null;
      const entry = characterDoc.world_book.entries.find(e => {
        const nm = String(e?.name || '');
        return nm.includes('[InitVar]');
      });
      if (!entry) return null;

      // entry.content 是字符串化 JSON
      const raw = entry.content;
      if (raw == null) return null;

      // content 可能已是对象或 JSON 字符串（字符串中仍包含转义），逐层尝试
      if (typeof raw === 'object') return raw;
      if (typeof raw === 'string') {
        // 尝试直接 JSON.parse
        try {
          return JSON.parse(raw);
        } catch (_) {
          // 若内部仍是字符串（双重转义），再解析一次
          try {
            const once = JSON.parse(raw);
            if (typeof once === 'string') {
              return JSON.parse(once);
            }
            return once;
          } catch (e2) {
            console.warn('[context-variables] 解析 InitVar 失败：', e2);
            return null;
          }
        }
      }
      return null;
    } catch (e) {
      console.warn('[context-variables] 提取 InitVar 异常：', e);
      return null;
    }
  }

  async function getVariables(conversationFile) {
    try {
      const res = await postJSON('modules', 'smarttavern/chat_branches/variables', { action: 'get', file: conversationFile });
      return res?.variables || {};
    } catch (_) {
      return {};
    }
  }

  async function mergeVariables(conversationFile, data) {
    try {
      await postJSON('modules', 'smarttavern/chat_branches/variables', {
        action: 'merge',
        file: conversationFile,
        data: data || {}
      });
      return true;
    } catch (e) {
      console.warn('[context-variables] merge variables 失败：', e);
      return false;
    }
  }

  async function ensureContextVariables(conversationFile) {
    if (!conversationFile) return;
    try {
      // 后端占位（创建 context_variables.json，包含 initialized=false）
      await postJSON('plugins', 'smarttavern/context_variables/ensure_init', {
        conversation_file: conversationFile
      });

      // 读取当前占位状态
      const cur = await postJSON('plugins', 'smarttavern/context_variables/get', {
        conversation_file: conversationFile
      });

      const content = cur?.content || {};
      const initialized = content?.initialized === true;

      if (!initialized) {
        // 尚未初始化 → 启动状态监听，待 Pinia settings 完全就绪后再写入
        startInitWatcher(conversationFile);
      } else {
        host.pushToast?.({
          type: 'success',
          message: '上下文变量已初始化',
          timeout: 1500
        });
      }
    } catch (e) {
      console.warn('[context-variables] ensureContextVariables error:', e);
      host.pushToast?.({ type: 'error', message: '上下文变量初始化流程启动失败', timeout: 2000 });
    }
  }

  // 解析 world_book 中 [InitVar]（支持双层字符串 JSON）
  function extractInitVarFromWorldBook(wbDoc) {
    try {
      let entries = null;
      if (wbDoc && typeof wbDoc === 'object') {
        entries = Array.isArray(wbDoc.entries) ? wbDoc.entries : null;
        if (!entries) {
          // 兜底：有些 world_book 可能以 { world_book: { entries: [...] } } 或 { world_book: [...] } 表示
          const maybe = wbDoc.world_book;
          if (maybe && typeof maybe === 'object') {
            entries = Array.isArray(maybe.entries) ? maybe.entries : (Array.isArray(maybe) ? maybe : null);
          }
        }
      }
      if (!Array.isArray(entries)) return null;

      const entry = entries.find(e => String(e?.name || '').includes('[InitVar]'));
      if (!entry) return null;

      const raw = entry.content;
      if (raw == null) return null;

      if (typeof raw === 'object') return raw;
      if (typeof raw === 'string') {
        try {
          const first = JSON.parse(raw);
          if (typeof first === 'object' && first) return first;
          if (typeof first === 'string') {
            const second = JSON.parse(first);
            if (typeof second === 'object' && second) return second;
          }
        } catch (_) {
          return null;
        }
      }
      return null;
    } catch (e) {
      console.warn('[context-variables] 提取 InitVar(world_book) 异常：', e);
      return null;
    }
  }

  // 简化 JSON 解析：仅尝试标准 JSON.parse，失败则跳过
  // 说明：Pinia 提供的 meta 数据中，content 字段应该已经是解析好的对象
  // 如果仍然是字符串且包含 JSON 错误，直接跳过不处理
  function parseInitVarLoose(raw) {
    if (typeof raw !== 'string') return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[context-variables] content 为无效 JSON 字符串，跳过：', e.message);
      return null;
    }
  }

  // 状态监听：等待 Pinia settings.world_books/character 加载完毕后，读取并写入
  function startInitWatcher(conversationFile) {
    const MAX_TICKS = 80; // 最多等待 ~24s（300ms * 80）
    const INTERVAL_MS = 300;
    let ticks = 0;

    const timer = setInterval(async () => {
      ticks++;
      try {
        // 使用前端全局 API，确保从 Pinia 状态读取角色内嵌世界书
        const charWBMeta = (typeof window !== 'undefined' && typeof window.getChar === 'function')
          ? (window.getChar('meta.world_book') || null)
          : null;

        const ready = !!charWBMeta;

        if (!ready) {
          if (ticks >= MAX_TICKS) {
            clearInterval(timer);
            host.pushToast?.({ type: 'warning', message: '上下文变量初始化超时（角色世界书未就绪）', timeout: 2000 });
          }
          return;
        }

        // 提取角色内嵌 world_book 的 InitVar
        let charInitVar = null;
        if (charWBMeta && Array.isArray(charWBMeta.entries)) {
          const entry = charWBMeta.entries.find(e => String(e?.name || '').includes('[InitVar]'));
          if (entry && entry.content) {
            const raw = entry.content;
            if (typeof raw === 'object' && raw !== null) {
              // content 已经是对象，直接使用
              charInitVar = raw;
            } else if (typeof raw === 'string') {
              // content 是字符串，尝试解析（仅处理有效 JSON）
              const parsed = parseInitVarLoose(raw);
              if (parsed && typeof parsed === 'object') {
                charInitVar = parsed;
              } else {
                console.warn('[context-variables] 角色 InitVar content 无法解析，已跳过');
              }
            }
          }
        }

        // 若为空，继续等待（避免写入 {}）
        if (!charInitVar || Object.keys(charInitVar).length === 0) {
          if (ticks >= MAX_TICKS) {
            clearInterval(timer);
            host.pushToast?.({ type: 'warning', message: '上下文变量初始化为空，已终止', timeout: 2000 });
          }
          return;
        }

        // 组装 payload：仅写入初始化标记与 __char_initvar，避免顶层重复
        const payload = { initialized: true, __char_initvar: charInitVar };

        // 写入
        const setRes = await postJSON('plugins', 'smarttavern/context_variables/set', {
          conversation_file: conversationFile,
          content: payload
        });

        clearInterval(timer);
        if (setRes?.success) {
          host.pushToast?.({ type: 'success', message: '上下文变量已初始化', timeout: 1600 });
        } else {
          host.pushToast?.({ type: 'error', message: '上下文变量写入失败', timeout: 2000 });
        }
      } catch (e) {
        console.warn('[context-variables] 初始化监听发生错误：', e);
        if (ticks >= MAX_TICKS) {
          clearInterval(timer);
          host.pushToast?.({ type: 'error', message: '上下文变量初始化错误', timeout: 2000 });
        }
      }
    }, INTERVAL_MS);

    // 插件卸载时清理监听
    disposers.push(() => { try { clearInterval(timer) } catch (_) {} });
  }

  // ========= 事件绑定 =========
  // 对话创建成功
  const offCreateOk = host.events.on('conversation:create:ok', async (payload) => {
    try {
      const file = payload?.file || payload?.conversation_file || payload?.result?.conversation_file || null;
      await ensureContextVariables(file);
    } catch (e) {
      console.warn('[context-variables] create:ok handler error:', e);
    }
  });
  disposers.push(offCreateOk);

  // 对话加载成功
  const offLoadOk = host.events.on('conversation:load:ok', async (payload) => {
    try {
      const file = payload?.file || null;
      await ensureContextVariables(file);
    } catch (e) {
      console.warn('[context-variables] load:ok handler error:', e);
    }
  });
  disposers.push(offLoadOk);

  // ========= 全局上下文变量 API（前端访问用；不主动修改，仅暴露函数） =========
  try {
    const baseURL = ensureBase('plugins');
    async function _post(path, body = {}) {
      const url = `${baseURL}/${String(path).replace(/^\/+/, '')}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      const txt = await resp.text().catch(() => '');
      const data = txt ? JSON.parse(txt) : null;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return data;
    }

    function _getConvFile() {
      try { return (typeof window !== 'undefined' && window.STSandbox && window.STSandbox.conversationFile) || null } catch (_) { return null }
    }

    async function getCtxVar(key) {
      const file = _getConvFile(); if (!file) return undefined;
      // 基于重放机制计算“即时变量”
      const r = await _post('smarttavern/context_variables/replay_get', { conversation_file: file, key: String(key || '').trim() });
      return (r && typeof r.value !== 'undefined') ? r.value : '';
    }

    async function getCtxVars(...keys) {
      const file = _getConvFile(); if (!file) return {};
      const out = {};
      for (const k of keys) {
        const r = await _post('smarttavern/context_variables/replay_get', { conversation_file: file, key: String(k || '').trim() });
        out[k] = (r && typeof r.value !== 'undefined') ? r.value : '';
      }
      return out;
    }

    // 截止到指定消息ID
    async function getCtxVarUntil(key, untilNodeId) {
      const file = _getConvFile(); if (!file) return undefined;
      const r = await _post('smarttavern/context_variables/replay_get', { conversation_file: file, key: String(key || '').trim(), until_node_id: String(untilNodeId || '') });
      return (r && typeof r.value !== 'undefined') ? r.value : '';
    }
    async function getCtxVarsUntil(untilNodeId, ...keys) {
      const file = _getConvFile(); if (!file) return {};
      const out = {};
      for (const k of keys) {
        const r = await _post('smarttavern/context_variables/replay_get', { conversation_file: file, key: String(k || '').trim(), until_node_id: String(untilNodeId || '') });
        out[k] = (r && typeof r.value !== 'undefined') ? r.value : '';
      }
      return out;
    }

    function _resolveFrom(obj, path) {
      if (!path) return obj;
      const s2 = String(path || '').replace(/\[/g, '.').replace(/\]/g, '.');
      const toks = s2.split('.').map(t => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      let cur = obj;
      for (const t of toks) {
        if (Array.isArray(cur) && /^-?\d+$/.test(t)) {
          const idx = parseInt(t, 10);
          if (idx < 0 || idx >= cur.length) return undefined;
          cur = cur[idx];
        } else if (cur && typeof cur === 'object') {
          if (!(t in cur)) return undefined;
          cur = cur[t];
        } else {
          return undefined;
        }
      }
      return cur;
    }

    async function getCtxVarJSON(key) {
      const file = _getConvFile(); if (!file) return {};
      const k = (key == null ? '' : String(key || '').trim());
      const r = await _post('smarttavern/context_variables/replay', { conversation_file: file });
      const content = (r && r.content) ? r.content : {};
      if (!k) return content;
      const v = _resolveFrom(content, k);
      return (typeof v === 'undefined') ? undefined : v;
    }
    async function getCtxVarJSONUntil(untilNodeId, key) {
      const file = _getConvFile(); if (!file) return {};
      const k = (key == null ? '' : String(key || '').trim());
      const r = await _post('smarttavern/context_variables/replay', { conversation_file: file, until_node_id: String(untilNodeId || '') });
      const content = (r && r.content) ? r.content : {};
      if (!k) return content;
      const v = _resolveFrom(content, k);
      return (typeof v === 'undefined') ? undefined : v;
    }

    // 仅暴露，不主动调用（实际更新由后端 afterLLMCall 处理）
    if (typeof window !== 'undefined') {
      window.getCtxVar = getCtxVar;
      window.getCtxVars = getCtxVars;
      window.getCtxVarUntil = getCtxVarUntil;
      window.getCtxVarsUntil = getCtxVarsUntil;
      window.getCtxVarJSON = getCtxVarJSON;
      window.getCtxVarJSONUntil = getCtxVarJSONUntil;
      window.STSandbox = window.STSandbox || {};
      window.STSandbox.getCtxVar = getCtxVar;
      window.STSandbox.getCtxVars = getCtxVars;
      window.STSandbox.getCtxVarUntil = getCtxVarUntil;
      window.STSandbox.getCtxVarsUntil = getCtxVarsUntil;
      window.STSandbox.getCtxVarJSON = getCtxVarJSON;
      window.STSandbox.getCtxVarJSONUntil = getCtxVarJSONUntil;
    }
  } catch (_) {}

  // 激活提示（不提示即可；保持安静）
  // host.pushToast?.({ type: 'info', message: 'Context Variables 插件已启用', timeout: 1600 });

  // 返回清理函数
  return () => {
    try { disposers.forEach(fn => { try { fn?.() } catch (_) {} }) } catch (_) {}
    // host.pushToast?.({ type: 'info', message: 'Context Variables 插件已卸载', timeout: 1400 });
  };
}