/**
 * API客户端
 * 负责与后端API网关通信
 */

class APIClient {
    constructor(baseURL = 'http://localhost:8050', apiPrefix = '/api') {
        this.baseURL = baseURL;
        this.apiPrefix = apiPrefix;
        this.websocket = null;
        this.wsCallbacks = new Map();
        this.wsCallbackId = 0;
    }

    /**
     * 发送HTTP请求
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${this.apiPrefix}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const config = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API请求失败:', error);
            throw error;
        }
    }

    /**
     * GET请求
     */
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    /**
     * POST请求
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * 健康检查
     */
    async healthCheck() {
        try {
            return await this.get('/health');
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }

    /**
     * 获取系统信息
     */
    async getInfo() {
        try {
            return await this.get('/info');
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * 获取已注册的 API 定义
     */
    async listApis() {
        return this.get('/modules/api_gateway/list_apis');
    }

    /**
     * 项目管理API
     */
    async getProjectStatus(projectName = null) {
        const endpoint = projectName
            ? `/modules/project_manager/get_status?project_name=${encodeURIComponent(projectName)}`
            : '/modules/project_manager/get_status';
        return this.get(endpoint);
    }

    async startProject(projectName, component = 'all') {
        return this.post('/modules/project_manager/start_project', {
            project_name: projectName,
            component: component
        });
    }

    async stopProject(projectName, component = 'all') {
        return this.post('/modules/project_manager/stop_project', {
            project_name: projectName,
            component: component
        });
    }

    async restartProject(projectName, component = 'all') {
        return this.post('/modules/project_manager/restart_project', {
            project_name: projectName,
            component: component
        });
    }

    async getPortUsage() {
        return this.post('/modules/project_manager/get_ports');
    }

    async performHealthCheck() {
        return this.post('/modules/project_manager/health_check');
    }
    
    /**
     * 项目管理API
     */
    async getManagedProjects() {
        return this.post('/modules/project_manager/get_managed_projects');
    }

    async importProject(formData) {
        const url = `${this.baseURL}${this.apiPrefix}/modules/project_manager/import_project`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData, // 直接使用FormData，不需要JSON序列化
                // 不设置Content-Type，让浏览器自动设置multipart/form-data
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('导入项目失败:', error);
            throw error;
        }
    }

    // 新增：导入后端项目（zip）
    async importBackendProject(formData) {
        const url = `${this.baseURL}${this.apiPrefix}/modules/project_manager/import_backend_project`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error('导入后端项目失败:', error);
            throw error;
        }
    }

    /**
     * 将zip嵌入PNG图片
     * 后端函数：project_manager.embed_zip_into_image
     */
    async embedZipIntoImage(formData) {
        const url = `${this.baseURL}${this.apiPrefix}/modules/project_manager/embed_zip_into_image`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData, // multipart/form-data 自动由浏览器设置
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || data.message || `HTTP ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error('嵌入zip到图片失败:', error);
            throw error;
        }
    }

    /**
     * 从PNG图片反嵌入zip并导入项目
     * 后端函数：project_manager.import_project_from_image
     */
    async importProjectFromImage(formData) {
        const url = `${this.baseURL}${this.apiPrefix}/modules/project_manager/import_project_from_image`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || data.message || `HTTP ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error('从图片导入项目失败:', error);
            throw error;
        }
    }

    // 新增：从图片导入后端项目
    async importBackendProjectFromImage(formData) {
        const url = `${this.baseURL}${this.apiPrefix}/modules/project_manager/import_backend_project_from_image`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || data.message || `HTTP ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error('从图片导入后端项目失败:', error);
            throw error;
        }
    }

    async deleteProject(projectName) {
        return this.post('/modules/project_manager/delete_project', {
            project_name: projectName
        });
    }

    async updateProjectPorts(projectName, ports) {
        return this.post('/modules/project_manager/update_ports', {
            project_name: projectName,
            ports: ports
        });
    }

    async installProjectDependencies(projectName) {
        return this.post('/modules/project_manager/install_project', {
            project_name: projectName
        });
    }

    /**
     * WebSocket连接
     */
    connectWebSocket() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            return;
        }

        const wsURL = this.baseURL.replace('http', 'ws') + '/ws';
        this.websocket = new WebSocket(wsURL);

        this.websocket.onopen = () => {
            console.log('WebSocket连接已建立');
        };

        this.websocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('WebSocket消息解析失败:', error);
            }
        };

        this.websocket.onclose = () => {
            console.log('WebSocket连接已关闭');
            // 5秒后尝试重连
            setTimeout(() => this.connectWebSocket(), 5000);
        };

        this.websocket.onerror = (error) => {
            console.error('WebSocket错误:', error);
        };
    }

    /**
     * 处理WebSocket消息
     */
    handleWebSocketMessage(data) {
        if (data.callback_id && this.wsCallbacks.has(data.callback_id)) {
            const callback = this.wsCallbacks.get(data.callback_id);
            callback(data);
            this.wsCallbacks.delete(data.callback_id);
        }

        // 广播消息给所有监听器
        window.dispatchEvent(new CustomEvent('websocket-message', { detail: data }));
    }

    /**
     * 通过WebSocket调用函数
     */
    callFunctionWS(functionName, params = {}) {
        return new Promise((resolve, reject) => {
            if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket未连接'));
                return;
            }

            const callbackId = ++this.wsCallbackId;
            
            this.wsCallbacks.set(callbackId, (data) => {
                if (data.error) {
                    reject(new Error(data.error));
                } else {
                    resolve(data.result);
                }
            });

            const message = {
                type: 'function_call',
                function: functionName,
                params: params,
                callback_id: callbackId
            };

            this.websocket.send(JSON.stringify(message));

            // 30秒超时
            setTimeout(() => {
                if (this.wsCallbacks.has(callbackId)) {
                    this.wsCallbacks.delete(callbackId);
                    reject(new Error('WebSocket调用超时'));
                }
            }, 30000);
        });
    }

    /**
     * 断开WebSocket连接
     */
    disconnectWebSocket() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
    }
}

/**
 * 统一使用后端端口 + /api 作为默认配置
 * WebSocket 走后端端口 /ws
 */


function resolveBackendBase() {
    try {
        if (typeof window !== 'undefined') {
            const fromLS = (function(){ try { return localStorage.getItem('st.backend_base') } catch(_) { return null } })();
            const fromWin = window.ST_BACKEND_BASE;
            const base = String(fromLS || fromWin || 'http://localhost:8050');
            return base.replace(/\/+$/, '');
        }
    } catch (_) {}
    return 'http://localhost:8050';
}

async function initApiClient() {
    const baseURL = resolveBackendBase();
    const apiPrefix = '/api';
    window.apiClient = new APIClient(baseURL, apiPrefix);
}

// 页面加载完成后连接WebSocket
document.addEventListener('DOMContentLoaded', async () => {
    await initApiClient();
    window.apiClient.connectWebSocket();
});

 // 页面卸载时断开WebSocket连接
window.addEventListener('beforeunload', () => {
    if (window.apiClient) {
        window.apiClient.disconnectWebSocket();
    }
});

// 通用 API 文件管理 - 客户端扩展（放置在类定义之后，避免引用错误）
// 列出模块/工作流 API 文件夹
APIClient.prototype.listApiFolders = async function() {
    return this.get('/modules/api_files/list_folders');
};

// 删除指定命名空间下的 API 文件夹
APIClient.prototype.deleteApiFolder = async function(namespace, relative_path) {
    return this.post('/modules/api_files/delete_folder', {
        namespace,
        relative_path
    });
};
// 通用 API 文件管理 - 客户端扩展
// 列出模块/工作流 API 文件夹
APIClient.prototype.listApiFolders = async function() {
    return this.get('/modules/api_files/list_folders');
};

// 删除指定命名空间下的 API 文件夹
APIClient.prototype.deleteApiFolder = async function(namespace, relative_path) {
    return this.post('/modules/api_files/delete_folder', {
        namespace,
        relative_path
    });
};

// 导入单个 API 脚本（zip），需附带 namespace
APIClient.prototype.importApiScript = async function(formData) {
    const url = `${this.baseURL}${this.apiPrefix}/modules/api_files/import_script`;
    const response = await fetch(url, { method: 'POST', body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    return data;
};

// 从PNG图片导入单个 API 脚本（嵌入zip），需附带 namespace
APIClient.prototype.importApiScriptFromImage = async function(formData) {
    const url = `${this.baseURL}${this.apiPrefix}/modules/api_files/import_script_from_image`;
    const response = await fetch(url, { method: 'POST', body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    return data;
};