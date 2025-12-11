/* SmartTavern Frontend API Client — Chat Branches (v1)
 * - 后端基址统一来源：localStorage('st.backend_base') → window.ST_BACKEND_BASE → import.meta.env.VITE_API_BASE → 'http://localhost:8050'
 * - 实际请求使用 `${backend}/api/modules/...`
 */

// ============ Type Definitions ============

declare global {
  interface Window {
    ST_BACKEND_BASE?: string;
  }
  interface ImportMetaEnv {
    VITE_API_BASE?: string;
  }
}

interface ErrorWithDetails extends Error {
  cause?: Error;
  url?: string;
  status?: number;
  details?: any;
}

// 消息节点类型
interface MessageNode {
  node_id: string;
  pid: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  children?: string[];
  [key: string]: any;
}

// 最新消息响应
interface LatestMessageResponse {
  success: boolean;
  message?: MessageNode;
  active_path?: string[];
  [key: string]: any;
}

// OpenAI 消息格式
interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenAIMessagesResponse {
  success: boolean;
  messages?: OpenAIMessage[];
  [key: string]: any;
}

// 分支表响应
interface BranchInfo {
  node_id: string;
  branches: number;
  current_branch?: number;
  [key: string]: any;
}

interface BranchTableResponse {
  success: boolean;
  table?: BranchInfo[];
  [key: string]: any;
}

// 创建对话参数
interface CreateConversationParams {
  name: string;
  description?: string;
  type?: 'threaded' | 'sandbox';
  character: string;
  preset: string;
  persona: string;
  regex?: string | null;
  worldbook?: string | null;
  llm_config?: string | null;
}

// 创建对话响应
interface CreateConversationResponse {
  success: boolean;
  file?: string;
  settings_file?: string;
  variables_file?: string;
  [key: string]: any;
}

// Settings 参数
interface SettingsGetParams {
  action: 'get';
  file?: string;
  slug?: string;
}

interface SettingsUpdateParams {
  action: 'update';
  patch: {
    preset?: string;
    character?: string;
    persona?: string;
    regex_rules?: string[];
    world_books?: string[];
    llm_config?: string;
    [key: string]: any;
  };
  file?: string;
  slug?: string;
}

type SettingsParams = SettingsGetParams | SettingsUpdateParams;

// Settings 响应
interface SettingsData {
  preset?: string;
  character?: string;
  persona?: string;
  regex_rules?: string[];
  world_books?: string[];
  llm_config?: string;
  [key: string]: any;
}

interface SettingsResponse {
  success: boolean;
  settings?: SettingsData;
  [key: string]: any;
}

// Variables 参数
interface VariablesParams {
  action: 'get' | 'set' | 'merge' | 'reset';
  data?: Record<string, any>;
  file?: string;
  slug?: string;
}

// Variables 响应
interface VariablesResponse {
  success: boolean;
  variables?: Record<string, any>;
  [key: string]: any;
}

// 追加消息参数
interface AppendMessageParams {
  file: string;
  node_id: string;
  pid: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 追加消息响应
interface AppendMessageResponse {
  success: boolean;
  node?: MessageNode;
  [key: string]: any;
}

// 更新消息参数
interface UpdateMessageParams {
  file: string;
  node_id: string;
  content: string;
}

// 更新消息响应
interface UpdateMessageResponse {
  success: boolean;
  node?: MessageNode;
  [key: string]: any;
}

// 修剪消息参数
interface TruncateAfterParams {
  file: string;
  node_id: string;
}

// 修剪消息响应
interface TruncateAfterResponse {
  success: boolean;
  deleted_count?: number;
  [key: string]: any;
}

// 切换分支参数
interface SwitchBranchParams {
  file: string;
  target_j: number;
}

// 切换分支响应
interface SwitchBranchResponse {
  success: boolean;
  active_path?: string[];
  [key: string]: any;
}

// 重试分支参数
interface RetryBranchParams {
  file: string;
  new_node_id: string;
  retry_node_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 重试分支响应
interface RetryBranchResponse {
  success: boolean;
  node?: MessageNode;
  [key: string]: any;
}

// 删除分支参数
interface DeleteBranchParams {
  file: string;
  node_id: string;
}

// 删除分支响应
interface DeleteBranchResponse {
  success: boolean;
  active_path?: string[];
  [key: string]: any;
}

// 重试用户消息参数
interface RetryUserMessageParams {
  file: string;
  user_node_id: string;
}

// 重试用户消息响应
interface RetryUserMessageResponse {
  success: boolean;
  [key: string]: any;
}

// ============ Helper Functions ============

const DEFAULT_BACKEND: string = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || 'http://localhost:8050';

function _readLS(key: string): string | null {
  try { return (typeof window !== 'undefined') ? localStorage.getItem(key) : null } catch (_) { return null }
}

function getBackendBase(): string {
  const fromLS = _readLS('st.backend_base');
  const fromWin = (typeof window !== 'undefined') ? window.ST_BACKEND_BASE : null;
  const base = String(fromLS || fromWin || DEFAULT_BACKEND || 'http://localhost:8050');
  return base.replace(/\/+$/, '');
}

function ensureBase(): string {
  return `${getBackendBase()}/api/modules`.replace(/\/+$/, '');
}

async function postJSON<T = any>(path: string, body: Record<string, any> = {}): Promise<T> {
  const base = ensureBase();
  const url = `${base}/${String(path).replace(/^\/+/, '')}`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
  } catch (networkError) {
    const err = new Error(`[ChatBranches] Network error: ${(networkError as Error)?.message || networkError}`) as ErrorWithDetails;
    err.cause = networkError as Error;
    err.url = url;
    throw err;
  }

  let data: any = null;
  const text = await resp.text().catch(() => '');
  try {
    data = text ? JSON.parse(text) : null;
  } catch (parseError) {
    const err = new Error(`[ChatBranches] Invalid JSON response (${resp.status}): ${text?.slice(0, 200)}`) as ErrorWithDetails;
    err.cause = parseError as Error;
    err.status = resp.status;
    err.url = url;
    throw err;
  }

  if (!resp.ok) {
    const err = new Error(`[ChatBranches] HTTP ${resp.status}: ${data && (data.message || data.error) || 'Unknown error'}`) as ErrorWithDetails;
    err.status = resp.status;
    err.url = url;
    err.details = data;
    throw err;
  }
  return data as T;
}

// 轻量缓存（仅本会话内存）
const _mem = new Map<string, any>();
const _ck = (k: string): string => `cb:${k}`;

// ============ Main API ============

const ChatBranches = {
  // 获取某个对话文件的最新消息（依据 active_path）
  // 后端实现参考：[python.function(get_latest_message)](api/modules/SmartTavern/chat_branches/chat_branches.py:130)
  async getLatestMessageByFile(file: string, { useCache = true }: { useCache?: boolean } = {}): Promise<LatestMessageResponse> {
    const key = _ck(`latest:${file}`);
    if (useCache && _mem.has(key)) return _mem.get(key) as LatestMessageResponse;

    const res = await postJSON<LatestMessageResponse>('smarttavern/chat_branches/get_latest_message', { file });
    _mem.set(key, res);
    return res;
  },

  // 导出 OpenAI messages（可选）
  // 参考：[python.function(openai_messages)](api/modules/SmartTavern/chat_branches/chat_branches.py:68)
  async openaiMessagesByFile(file: string): Promise<OpenAIMessagesResponse> {
    return postJSON<OpenAIMessagesResponse>('smarttavern/chat_branches/openai_messages', { file });
  },

  // 计算分支情况表（可选）
  // 参考：[python.function(branch_table)](api/modules/SmartTavern/chat_branches/chat_branches.py:98)
  async branchTableByFile(file: string): Promise<BranchTableResponse> {
    return postJSON<BranchTableResponse>('smarttavern/chat_branches/branch_table', { file });
  },

  // 创建初始对话（从角色卡 messages[0] 作为根消息），返回三件套路径
  // 后端实现见：[python.function(create_conversation)](api/modules/SmartTavern/chat_branches/chat_branches.py:215)
  async createConversation({
    name,
    description = '',
    type = 'threaded',
    character,
    preset,
    persona,
    regex = null,
    worldbook = null,
    llm_config = null,
  }: CreateConversationParams): Promise<CreateConversationResponse> {
    return postJSON<CreateConversationResponse>('smarttavern/chat_branches/create_conversation', {
      name,
      description,
      type,
      character_file: character,
      preset_file: preset,
      persona_file: persona,
      regex_file: regex ?? null,
      worldbook_file: worldbook ?? null,
      llm_config_file: llm_config ?? null,
    });
  },

  // 综合设置管理：读取(action=get)或更新(action=update)对话 settings
  // 使用 file 或 slug 二选一定位（file 可传 conversations/{name}/conversation.json 或同目录 settings/variables）
  // 字段：preset(string)、character(string)、persona(string)、regex_rules(array)、world_books(array)、llm_config(string)
  // 后端实现见：[python.function(settings)](api/modules/SmartTavern/chat_branches/chat_branches.py:470)
  async settings(params: SettingsParams): Promise<SettingsResponse> {
    const { action } = params;
    if (!action || !['get', 'update'].includes(action)) {
      throw new Error('[ChatBranches] settings: action must be "get" or "update"');
    }
    if (action === 'update') {
      const updateParams = params as SettingsUpdateParams;
      if (!updateParams.patch || typeof updateParams.patch !== 'object') {
        throw new Error('[ChatBranches] settings: patch required for action=update');
      }
    }
    const body: Record<string, any> = { action };
    if ('patch' in params && params.patch) body.patch = params.patch;
    if ('file' in params && params.file) body.file = params.file;
    if ('slug' in params && params.slug) body.slug = params.slug;
    return postJSON<SettingsResponse>('smarttavern/chat_branches/settings', body);
  },

  // 管理 variables：action=get|set|merge|reset；set/merge 需提供 data 对象
  // 使用 file 或 slug 二选一定位
  // 后端实现见：[python.function(variables)](api/modules/SmartTavern/chat_branches/chat_branches.py:215)
  async variables({ action, data, file, slug }: VariablesParams): Promise<VariablesResponse> {
    const body: Record<string, any> = { action };
    if (data !== undefined) body.data = data;
    if (file) body.file = file;
    if (slug) body.slug = slug;
    return postJSON<VariablesResponse>('smarttavern/chat_branches/variables', body);
  },

  // 追加新消息：创建新节点并更新父节点 children 与 active_path
  // 后端实现见：[python.function(append_message)](api/modules/SmartTavern/chat_branches/chat_branches.py:192)
  async appendMessage({ file, node_id, pid, role, content }: AppendMessageParams): Promise<AppendMessageResponse> {
    if (!file) {
      throw new Error('[ChatBranches] appendMessage: file is required');
    }
    if (!node_id || !pid || !role || !content) {
      throw new Error('[ChatBranches] appendMessage: node_id, pid, role, content are required');
    }
    return postJSON<AppendMessageResponse>('smarttavern/chat_branches/append_message', {
      file,
      node_id,
      pid,
      role,
      content,
      // 返回 active_path 与 latest，便于前端更新分支指示
      return_mode: 'path'
    });
  },

  // 更新消息内容：修改指定节点的 content
  // 后端实现见：[python.function(update_message)](api/modules/SmartTavern/chat_branches/chat_branches.py:138)
  async updateMessage({ file, node_id, content }: UpdateMessageParams): Promise<UpdateMessageResponse> {
    if (!file) {
      throw new Error('[ChatBranches] updateMessage: file is required');
    }
    if (!node_id || content === undefined) {
      throw new Error('[ChatBranches] updateMessage: node_id and content are required');
    }
    return postJSON<UpdateMessageResponse>('smarttavern/chat_branches/update_message', {
      file,
      node_id,
      content,
      // 仅需要轻量响应；前端后续会再走路由获取完整内容
      return_mode: 'none'
    });
  },

  // 修剪消息树：删除指定节点及其所有子孙
  // 后端实现见：[python.function(truncate_after)](api/modules/SmartTavern/chat_branches/chat_branches.py:165)
  async truncateAfter({ file, node_id }: TruncateAfterParams): Promise<TruncateAfterResponse> {
    if (!file) {
      throw new Error('[ChatBranches] truncateAfter: file is required');
    }
    if (!node_id) {
      throw new Error('[ChatBranches] truncateAfter: node_id is required');
    }
    return postJSON<TruncateAfterResponse>('smarttavern/chat_branches/truncate_after', {
      file,
      node_id
    });
  },

  // 切换分支：切换 active_path 最后节点到目标分支序号
  // 后端实现见：[python.function(switch_branch)](api/modules/SmartTavern/chat_branches/chat_branches.py:222)
  async switchBranch({ file, target_j }: SwitchBranchParams): Promise<SwitchBranchResponse> {
    if (!file) {
      throw new Error('[ChatBranches] switchBranch: file is required');
    }
    if (!target_j || target_j < 1) {
      throw new Error('[ChatBranches] switchBranch: target_j must be >= 1');
    }
    return postJSON<SwitchBranchResponse>('smarttavern/chat_branches/switch_branch', {
      file,
      target_j,
      // 轻量返回：仅需要目标节点信息（UI 立即切换）
      return_mode: 'node'
    });
  },

  // 重试分支：创建新分支节点
  async retryBranch({ file, new_node_id, retry_node_id, role, content }: RetryBranchParams): Promise<RetryBranchResponse> {
    if (!file) {
      throw new Error('[ChatBranches] retryBranch: file is required');
    }
    if (!new_node_id || !retry_node_id || !role || content === undefined) {
      throw new Error('[ChatBranches] retryBranch: new_node_id, retry_node_id, role, content are required');
    }
    return postJSON<RetryBranchResponse>('smarttavern/chat_branches/retry_branch', {
      file,
      new_node_id,
      retry_node_id,
      role,
      content,
      // 轻量返回：路径与更新时间足够，组件通过事件驱动刷新
      return_mode: 'path'
    });
  },

  // 删除分支：删除单个分支节点并智能切换
  async deleteBranch({ file, node_id }: DeleteBranchParams): Promise<DeleteBranchResponse> {
    if (!file) {
      throw new Error('[ChatBranches] deleteBranch: file is required');
    }
    if (!node_id) {
      throw new Error('[ChatBranches] deleteBranch: node_id is required');
    }
    return postJSON<DeleteBranchResponse>('smarttavern/chat_branches/delete_branch', {
      file,
      node_id,
      // 仅需要 active_path 以便前端计算切换到的节点
      return_mode: 'path'
    });
  },

  // 智能重试用户消息
  async retryUserMessage({ file, user_node_id }: RetryUserMessageParams): Promise<RetryUserMessageResponse> {
    if (!file) {
      throw new Error('[ChatBranches] retryUserMessage: file is required');
    }
    if (!user_node_id) {
      throw new Error('[ChatBranches] retryUserMessage: user_node_id is required');
    }
    return postJSON<RetryUserMessageResponse>('smarttavern/chat_branches/retry_user_message', {
      file,
      user_node_id
    });
  },

  // 保存对话（后端每次操作都自动保存，此方法用于显式确认）
  // 使用 settings API 验证对话存在，兼容 threaded/sandbox 模式
  async saveConversation(file: string, _doc?: any): Promise<{ success: boolean }> {
    if (!file) {
      throw new Error('[ChatBranches] saveConversation: file is required');
    }
    // 使用 settings API 验证对话存在（比 getLatestMessage 更通用，sandbox 也支持）
    await this.settings({ action: 'get', file });
    return { success: true };
  },

  // 删除对话（删除整个对话目录）
  async deleteConversation(file: string): Promise<{ success: boolean }> {
    if (!file) {
      throw new Error('[ChatBranches] deleteConversation: file is required');
    }
    // 从对话文件路径推导出目录路径（取父目录）
    // file 格式: backend_projects/SmartTavern/data/conversations/{name}/conversation.json
    //        或: backend_projects/SmartTavern/data/conversations/{name}/settings.json
    //        或: backend_projects/SmartTavern/data/conversations/{name}/variables.json
    const normalized = file.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    const folderPath = lastSlash > 0 ? normalized.slice(0, lastSlash) : normalized;
    return postJSON<{ success: boolean }>('smarttavern/data_catalog/delete_data_folder', {
      folder_path: folderPath
    });
  },
};

export default ChatBranches;