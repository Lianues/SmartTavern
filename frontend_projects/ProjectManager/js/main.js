/**
 * 主应用逻辑
 * 负责页面交互和数据展示
 */

class ProjectManagerApp {
    constructor() {
        this.projects = {};
        this.portUsage = {};
        this.managedProjects = [];
        this.currentDeleteProject = null;
        this.refreshInterval = null;
        // 启动后初始状态轮询次数（避免必须手动刷新）
        this.initialStatusAttempts = 0;
        this.init();
    }

    /**
     * 初始化应用
     */
    async init() {
        this.initializeElements();
        this.bindEvents();
        // 修正可能被错误嵌套的模态框位置，确保点击按钮可见
        this.relocateModals();
        this.startClock();
        this.startAutoRefresh();

        // 确保 API 客户端已就绪（避免 window.apiClient 未初始化导致报错）
        await this.ensureApiClientReady();
        
        // 初始加载数据
        await this.loadData();
        // 同步加载 API 文件管理面板数据
        await this.loadApiFiles();
        // 延迟二次刷新，确保后台状态就绪（避免启动后需手动刷新）
        setTimeout(() => { this.loadData(false); }, 1500);
        // 若仍为空，做短期轮询，避免必须手动点击刷新
        this.ensureInitialStatus();
        
        // 初始化Lucide图标
        lucide.createIcons();
    }

    /**
     * 初始化DOM元素
     */
    initializeElements() {
        this.elements = {
            // 统计数据
            totalProjects: document.getElementById('totalProjects'),
            runningProjects: document.getElementById('runningProjects'),
            stoppedProjects: document.getElementById('stoppedProjects'),
            usedPorts: document.getElementById('usedPorts'),
            
            // 项目网格
            projectsGrid: document.getElementById('projectsGrid'),
            projectsGridFrontend: document.getElementById('projectsGridFrontend'),
            projectsGridBackend: document.getElementById('projectsGridBackend'),
            
            // 端口使用
            portUsage: document.getElementById('portUsage'),
            
            // 项目管理
            managedProjectsList: document.getElementById('managedProjectsList'),
            projectPortConfig: document.getElementById('projectPortConfig'),
            
            // 按钮
            refreshBtn: document.getElementById('refreshBtn'),
            startAllBtn: document.getElementById('startAllBtn'),
            stopAllBtn: document.getElementById('stopAllBtn'),
            importProjectBtn: document.getElementById('importProjectBtn'),
            importProjectBtnSection: document.getElementById('importProjectBtnSection'),
            
            // 导入项目模态框
            importProjectModal: document.getElementById('importProjectModal'),
            closeImportModal: document.getElementById('closeImportModal'),
            importProjectForm: document.getElementById('importProjectForm'),
            cancelImportBtn: document.getElementById('cancelImportBtn'),
            
            // 删除项目确认模态框
            deleteProjectModal: document.getElementById('deleteProjectModal'),
            closeDeleteModal: document.getElementById('closeDeleteModal'),
            deleteProjectName: document.getElementById('deleteProjectName'),
            confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
            cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
            
            // 编辑端口模态框
            editPortModal: document.getElementById('editPortModal'),
            closePortModal: document.getElementById('closePortModal'),
            editPortForm: document.getElementById('editPortForm'),
            cancelPortBtn: document.getElementById('cancelPortBtn'),
            editProjectName: document.getElementById('editProjectName'),
            frontendPort: document.getElementById('frontendPort'),
            backendPort: document.getElementById('backendPort'),
            websocketPort: document.getElementById('websocketPort'),
            
            // 模态框和通知
            loadingModal: document.getElementById('loadingModal'),
            loadingText: document.getElementById('loadingText'),
            toast: document.getElementById('toast'),
            toastIcon: document.getElementById('toastIcon'),
            toastTitle: document.getElementById('toastTitle'),
            toastMessage: document.getElementById('toastMessage'),
            
            // 时间显示
            currentTime: document.getElementById('currentTime'),

            // 新增：前端卡导出与图片导入
            exportCardBtn: document.getElementById('exportCardBtn'),
            importFromImageBtn: document.getElementById('importFromImageBtn'),
            exportCardModal: document.getElementById('exportCardModal'),
            closeExportCardModal: document.getElementById('closeExportCardModal'),
            exportCardForm: document.getElementById('exportCardForm'),
            cancelExportCardBtn: document.getElementById('cancelExportCardBtn'),
            importFromImageModal: document.getElementById('importFromImageModal'),
            closeImportFromImageModal: document.getElementById('closeImportFromImageModal'),
            importFromImageFile: document.getElementById('importFromImageFile'),
            cancelImportFromImageBtn: document.getElementById('cancelImportFromImageBtn'),

            // 新增：API 目录面板
            openApiPanelBtn: document.getElementById('openApiPanelBtn'),
            apiRegistryModal: document.getElementById('apiRegistryModal'),
            closeApiRegistryModal: document.getElementById('closeApiRegistryModal'),
            apiSearchInput: document.getElementById('apiSearchInput'),
            apiListContainer: document.getElementById('apiListContainer'),
            apiTotalCount: document.getElementById('apiTotalCount')
        };
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 刷新按钮
        this.elements.refreshBtn.addEventListener('click', () => this.loadData());
        
        // 批量操作按钮
        this.elements.startAllBtn.addEventListener('click', () => this.startAllProjects());
        this.elements.stopAllBtn.addEventListener('click', () => this.stopAllProjects());
        
        // 项目管理按钮
        this.elements.importProjectBtn.addEventListener('click', () => this.showImportProjectModal());
        this.elements.importProjectBtnSection.addEventListener('click', () => this.showImportProjectModal());
        
        // 导入项目模态框
        this.elements.closeImportModal.addEventListener('click', () => this.hideImportProjectModal());
        this.elements.cancelImportBtn.addEventListener('click', () => this.hideImportProjectModal());
        this.elements.importProjectForm.addEventListener('submit', (e) => this.handleProjectImport(e));
        
        // 删除项目模态框
        this.elements.closeDeleteModal.addEventListener('click', () => this.hideDeleteProjectModal());
        this.elements.cancelDeleteBtn.addEventListener('click', () => this.hideDeleteProjectModal());
        this.elements.confirmDeleteBtn.addEventListener('click', () => this.deleteProject());
        
        // 编辑端口模态框
        this.elements.closePortModal.addEventListener('click', () => this.hideEditPortModal());
        this.elements.cancelPortBtn.addEventListener('click', () => this.hideEditPortModal());
        this.elements.editPortForm.addEventListener('submit', (e) => this.savePortConfig(e));

        // 新增：导出前端卡与从图片导入（安全绑定）
        const add = (el, evt, fn) => { if (el) el.addEventListener(evt, fn); };

        add(this.elements.exportCardBtn, 'click', () => this.showExportCardModal());
        add(this.elements.closeExportCardModal, 'click', () => this.hideExportCardModal());
        add(this.elements.cancelExportCardBtn, 'click', () => this.hideExportCardModal());
        add(this.elements.exportCardForm, 'submit', (e) => this.handleExportCard(e));

        add(this.elements.importFromImageBtn, 'click', () => this.showImportFromImageModal());
        add(this.elements.closeImportFromImageModal, 'click', () => this.hideImportFromImageModal());
        add(this.elements.cancelImportFromImageBtn, 'click', () => this.hideImportFromImageModal());
        add(this.elements.importFromImageFile, 'change', (e) => this.handleImportFromImageChange(e));

        // 新增：API 目录面板事件绑定
        add(this.elements.openApiPanelBtn, 'click', () => this.showApiRegistryModal());
        add(this.elements.closeApiRegistryModal, 'click', () => this.hideApiRegistryModal());
        add(this.elements.apiSearchInput, 'input', (e) => this.filterApiList(e.target.value));
        
        // WebSocket消息监听
        window.addEventListener('websocket-message', (event) => {
            this.handleWebSocketMessage(event.detail);
        });

        // 事件委托兜底：确保即使元素在脚本初始化后才出现，也能响应点击
        document.addEventListener('click', (evt) => {
            const t = evt.target;
            // 导出前端卡按钮
            if (t && typeof t.closest === 'function' && t.closest('#exportCardBtn')) {
                this.showExportCardModal();
            }
            // 从图片导入按钮
            if (t && typeof t.closest === 'function' && t.closest('#importFromImageBtn')) {
                this.showImportFromImageModal();
            }
            // API 目录面板按钮
            if (t && typeof t.closest === 'function' && t.closest('#openApiPanelBtn')) {
                this.showApiRegistryModal();
            }
        });
    }
    
    // 确保所有模态框在 body 直接子级，避免嵌套导致层级与显示问题
    relocateModals() {
        const moveToBody = (el) => {
            if (el && el.parentElement && el.parentElement !== document.body) {
                document.body.appendChild(el);
            }
        };
        // 需要置于顶层的弹窗/遮罩
        moveToBody(this.elements.exportCardModal);
        moveToBody(this.elements.importFromImageModal);
        moveToBody(this.elements.importProjectModal);
        moveToBody(this.elements.deleteProjectModal);
        moveToBody(this.elements.editPortModal);
        moveToBody(this.elements.loadingModal);
        moveToBody(this.elements.toast);
        moveToBody(this.elements.apiRegistryModal);

        // 解决重复ID的弹窗选择问题：选择包含有效内容的元素
        const pickBestById = (id) => {
            const nodes = Array.from(document.querySelectorAll(`[id="${id}"]`));
            if (nodes.length <= 1) return nodes[0] || document.getElementById(id);
            // 选择内容较多且包含交互控件的节点
            const scored = nodes.map(n => {
                const html = (n.innerHTML || '').trim();
                const score = html.length
                    + (html.includes('<form') ? 1000 : 0)
                    + (html.includes('input') ? 200 : 0)
                    + (html.includes('label') ? 100 : 0)
                    + (html.includes('button') ? 50 : 0);
                return { n, score };
            }).sort((a, b) => b.score - a.score);
            return scored[0]?.n || nodes[0];
        };

        // 重新指向具有有效内容的弹窗元素
        this.elements.exportCardModal = pickBestById('exportCardModal') || this.elements.exportCardModal;
        this.elements.importFromImageModal = pickBestById('importFromImageModal') || this.elements.importFromImageModal;
        this.elements.importProjectModal = pickBestById('importProjectModal') || this.elements.importProjectModal;
        this.elements.deleteProjectModal = pickBestById('deleteProjectModal') || this.elements.deleteProjectModal;
        this.elements.editPortModal = pickBestById('editPortModal') || this.elements.editPortModal;
        this.elements.loadingModal = pickBestById('loadingModal') || this.elements.loadingModal;
        this.elements.toast = pickBestById('toast') || this.elements.toast;
        this.elements.apiRegistryModal = pickBestById('apiRegistryModal') || this.elements.apiRegistryModal;
    }
    
    /**
     * 启动时钟
     */
    startClock() {
        const updateTime = () => {
            const now = new Date();
            this.elements.currentTime.textContent = now.toLocaleTimeString('zh-CN');
        };
        
        updateTime();
        setInterval(updateTime, 1000);
    }

    /**
     * 启动自动刷新
     */
    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            this.loadData(false); // 静默刷新
        }, 30000); // 每30秒刷新一次
    }

    /**
     * 首次启动时的短期轮询，解决“启动后需要手动刷新”的问题
     * 最多尝试5次，每次间隔2秒
     */
    ensureInitialStatus() {
        const tryPoll = async () => {
            try {
                if (Object.keys(this.projects || {}).length > 0) return;
                if (this.initialStatusAttempts >= 5) return;
                this.initialStatusAttempts += 1;
                await this.loadData(false);
                if (Object.keys(this.projects || {}).length === 0) {
                    setTimeout(tryPoll, 2000);
                }
            } catch (e) {
                // 安静失败，继续尝试
                if (this.initialStatusAttempts < 5) {
                    setTimeout(tryPoll, 2000);
                }
            }
        };
        setTimeout(tryPoll, 2000);
    }
    /**
     * 确保 API 客户端已初始化并可用
     * 解决页面加载时 window.apiClient 尚未就绪导致的调用错误
     */
    async ensureApiClientReady() {
        try {
            // 已就绪则直接返回
            if (window.apiClient && typeof window.apiClient.getProjectStatus === 'function') return;

            // 若全局提供了初始化函数，则尝试调用
            if (typeof window.initApiClient === 'function') {
                await window.initApiClient();
            }

            // 轮询等待就绪（最多3秒）
            const timeoutMs = 3000;
            const step = 100;
            let waited = 0;
            while (!(window.apiClient && typeof window.apiClient.getProjectStatus === 'function') && waited < timeoutMs) {
                await new Promise(r => setTimeout(r, step));
                waited += step;
            }
        } catch (e) {
            // 安静失败，后续调用仍会捕获并提示
        }
    }

    /**
     * 加载数据
     */
    async loadData(showLoading = true) {
        // 确保 API 客户端可用
        await this.ensureApiClientReady();
        if (showLoading) {
            this.showLoading('正在加载项目数据...');
        }

        try {
            // 并行加载数据
            const [statusResult, portResult, managedProjectsResult] = await Promise.all([
                window.apiClient.getProjectStatus(),
                window.apiClient.getPortUsage(),
                window.apiClient.getManagedProjects()
            ]);

            console.log('状态结果:', statusResult);
            console.log('端口结果:', portResult);
            console.log('项目管理结果:', managedProjectsResult);

            // 规范化为字典映射（新格式适配）
            const statusMap = this.coerceStatusDict(statusResult);
            const portsMap = this.coercePortsDict(portResult);

            // 处理可管理项目（兼容多种返回包装；也兼容直接返回数组）
            let mp = null;
            if (Array.isArray(managedProjectsResult)) {
                mp = managedProjectsResult;
            } else {
                mp = managedProjectsResult?.projects
                    || managedProjectsResult?.result
                    || (managedProjectsResult?.data && (managedProjectsResult.data.projects || managedProjectsResult.data));
            }

            if (Array.isArray(mp)) {
                this.managedProjects = mp;
            } else if (mp && typeof mp === 'object' && Array.isArray(mp.projects)) {
                this.managedProjects = mp.projects;
            } else {
                console.warn('未找到可管理项目数据:', managedProjectsResult);
                this.managedProjects = [];
            }

            // 保存端口使用原始映射
            this.portUsage = portsMap;

            // 合并生成统一结构的 this.projects
            this.projects = this.mergeProjectsData(this.managedProjects, statusMap, portsMap);

            // 兜底：若仍为空且存在端口映射，则直接由端口推断基本状态
            if (Object.keys(this.projects).length === 0 && Object.keys(portsMap).length > 0) {
                console.log('从端口数据构建项目信息（兜底）');
                Object.entries(portsMap).forEach(([projectName, ports]) => {
                    this.projects[projectName] = {
                        name: projectName,
                        namespace: projectName,
                        enabled: true,
                        frontend_running: !!(ports.frontend && ports.frontend.running),
                        backend_running: !!(ports.backend && ports.backend.running),
                        frontend_port: this.ensureNumber(ports.frontend && ports.frontend.port),
                        backend_port: this.ensureNumber(ports.backend && ports.backend.port),
                        frontend_pid: (ports.frontend && ports.frontend.pid) || null,
                        backend_pid: (ports.backend && ports.backend.pid) || null,
                        health_status: ((ports.frontend && ports.frontend.running) || (ports.backend && ports.backend.running)) ? 'healthy' : 'stopped',
                        errors: 0
                    };
                });
            }

            this.updateUI();
        } catch (error) {
            console.error('加载数据失败:', error);
            this.showToast('error', '加载失败', error.message);
        } finally {
            if (showLoading) {
                this.hideLoading();
            }
        }
    }

    /**
     * 更新UI
     */
    updateUI() {
        this.updateStatistics();
        this.updateProjectsGrid();
        this.updatePortUsage();
        this.updateManagedProjectsList();
        this.updateProjectPortConfig();
    }

    /**
     * 更新统计数据
     */
    updateStatistics() {
        const projectList = Object.values(this.projects);
        const total = projectList.length;
        const running = projectList.filter(p => p.frontend_running || p.backend_running).length;
        const stopped = total - running;
        
        // 计算使用的端口数
        const usedPorts = new Set();
        projectList.forEach(project => {
            if (project.frontend_port && project.frontend_running) {
                usedPorts.add(project.frontend_port);
            }
            if (project.backend_port && project.backend_running) {
                usedPorts.add(project.backend_port);
            }
        });

        this.elements.totalProjects.textContent = total;
        this.elements.runningProjects.textContent = running;
        this.elements.stoppedProjects.textContent = stopped;
        this.elements.usedPorts.textContent = usedPorts.size;
    }

    /**
     * 更新项目网格
     */
    updateProjectsGrid() {
        const entries = Object.entries(this.projects || {});
        const host = (() => {
            try { return new URL(window.apiClient?.baseURL || 'http://localhost').hostname; }
            catch { return 'localhost'; }
        })();

        const isFrontendProject = (p) => {
            const r = String((p && p.role) || '').toLowerCase();
            // 不做旧兼容：仅依据 role 分类
            return r === 'frontend';
        };

        const renderCards = (items) => items.map(([name, project]) => {
            const displayName = project.display_name || name;
            const subtitle = project.description || project.namespace || '';
            const version = project.version ? `v${project.version}` : '';
            const health = project.health_status || (project.frontend_running || project.backend_running ? 'healthy' : 'stopped');

            const frontendStatus = project.frontend_running ? 'running' : 'stopped';
            const backendStatus = project.backend_running ? 'running' : 'stopped';
            const overallStatus = (project.frontend_running || project.backend_running) ? 'running' : 'stopped';
            const ports = this.getProjectPorts(project);
            const websocketPort = ports.websocket;

            return `
                <div class="bg-white project-card p-6">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900">${displayName}</h3>
                            <p class="text-sm text-gray-600">
                                ${version ? `<span class="font-mono mr-2">${version}</span>` : ''}
                                ${subtitle}
                            </p>
                        </div>
                        <div class="flex items-center space-x-3">
                            <div class="flex items-center">
                                <span class="status-dot status-${overallStatus}"></span>
                                <span class="text-sm font-medium whitespace-nowrap flex-none ${overallStatus === 'running' ? 'text-green-600' : 'text-red-600'}">
                                    ${overallStatus === 'running' ? '运行中' : '已停止'}
                                </span>
                            </div>
                            <span class="text-xs px-2 py-1 rounded-4 whitespace-nowrap flex-none border ${
                                health === 'healthy' ? 'border-green-600 text-green-600' :
                                health === 'degraded' ? 'border-yellow-600 text-yellow-600' :
                                'border-gray-500 text-gray-500'
                            }">健康: ${health}</span>
                        </div>
                    </div>

                    <div class="space-y-3 mb-4">
                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">前端</span>
                            <div class="flex items-center space-x-2">
                                ${project.frontend_port ? `<span class="port-badge">:${project.frontend_port}</span>` : ''}
                                <span class="status-dot status-${frontendStatus}"></span>
                                <span class="text-sm ${frontendStatus === 'running' ? 'text-green-600' : 'text-gray-500'}">
                                    ${frontendStatus === 'running' ? '运行' : '停止'}
                                </span>
                            </div>
                        </div>

                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">后端</span>
                            <div class="flex items-center space-x-2">
                                ${project.backend_port ? `<span class="port-badge">:${project.backend_port}</span>` : ''}
                                <span class="status-dot status-${backendStatus}"></span>
                                <span class="text-sm ${backendStatus === 'running' ? 'text-green-600' : 'text-gray-500'}">
                                    ${backendStatus === 'running' ? '运行' : '停止'}
                                </span>
                            </div>
                        </div>

                        <div class="flex items-center justify-between">
                            <span class="text-sm text-gray-600">WebSocket</span>
                            <div class="flex items-center space-x-2">
                                ${websocketPort && websocketPort !== '未设置' ? `<span class="port-badge">:${websocketPort}</span>` : ''}
                                <span class="status-dot status-${backendStatus}"></span>
                                <span class="text-sm ${backendStatus === 'running' ? 'text-green-600' : 'text-gray-500'}">
                                    ${backendStatus === 'running' ? '运行' : '停止'}
                                </span>
                            </div>
                        </div>
                    </div>

                    ${project.errors && project.errors > 0 ? `
                        <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                            <div class="flex items-center">
                                <i data-lucide="alert-circle" class="w-4 h-4 text-red-600 mr-2"></i>
                                <span class="text-sm text-red-700">${project.errors} 个错误</span>
                            </div>
                        </div>
                    ` : ''}

                    <div class="flex space-x-2">
                        <button onclick="app.startProject('${name}')"
                                class="btn-primary px-3 py-2 rounded text-sm flex items-center justify-center space-x-1 w-28 whitespace-nowrap flex-none"
                                ${overallStatus === 'running' ? 'disabled opacity-50' : ''}>
                            <i data-lucide="play" class="w-4 h-4"></i>
                            <span>启动</span>
                        </button>

                        <button onclick="app.stopProject('${name}')"
                                class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm flex items-center justify-center space-x-1 w-28 whitespace-nowrap flex-none"
                                ${overallStatus === 'stopped' ? 'disabled opacity-50' : ''}>
                            <i data-lucide="stop-circle" class="w-4 h-4"></i>
                            <span>停止</span>
                        </button>

                        <button onclick="app.installProjectDependencies('${name}')"
                                class="bg-gray-900 hover:bg-black text-white px-3 py-2 rounded text-sm flex items-center justify-center space-x-1">
                            <i data-lucide="download" class="w-4 h-4"></i>
                            <span>安装</span>
                        </button>

                        <button onclick="app.restartProject('${name}')"
                                class="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded text-sm flex items-center justify-center">
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        </button>

                        ${project.frontend_port ? `
                            <a href="http://${host}:${project.frontend_port}" target="_blank"
                               class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm flex items-center justify-center">
                                <i data-lucide="external-link" class="w-4 h-4"></i>
                            </a>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // 分离前端/后端
        const frontendItems = entries.filter(([_, p]) => isFrontendProject(p));
        const backendItems = entries.filter(([_, p]) => !isFrontendProject(p));

        const emptyHtml = `
            <div class="col-span-full text-center py-12">
                <i data-lucide="folder-x" class="w-12 h-12 text-gray-400 mx-auto mb-4"></i>
                <p class="text-gray-500">暂无项目数据</p>
                <p class="text-gray-400 text-sm mt-2">请检查项目配置或后端连接</p>
                <button onclick="app.loadData(true)" class="mt-4 btn-primary px-4 py-2 rounded-lg text-sm">
                    重新加载
                </button>
            </div>
        `;

        const frontendContainer = this.elements.projectsGridFrontend || this.elements.projectsGrid;
        const backendContainer = this.elements.projectsGridBackend || this.elements.projectsGrid;

        frontendContainer.innerHTML = frontendItems.length ? renderCards(frontendItems) : emptyHtml;
        backendContainer.innerHTML = backendItems.length ? renderCards(backendItems) : emptyHtml;

        lucide.createIcons();
    }

    /**
     * 更新端口使用情况（按端口分组 + 系统 API Core 标注 + 前端/后端/WS 分区）
     * - 第一行以“端口”为核心：:port + 使用状态 + 共享项目数 + API Core 标注（从全局 API 客户端 baseURL 解析端口）
     * - 将使用该端口的项目按前端/后端/WebSocket分开展示，列出各项目的真实使用情况（含PID）
     */
    updatePortUsage() {
        const portEntries = Object.entries(this.portUsage || {});
        if (portEntries.length === 0) {
            this.elements.portUsage.innerHTML = `
                <p class="text-gray-500 text-center py-4">暂无端口使用数据</p>
            `;
            return;
        }

        // 系统 API Core 端口（从全局 API 客户端读取）
        const baseCorePort = this.parsePortFromUrl(window.apiClient?.baseURL || '');

        // 构建聚合：port -> { port, items: [{project,type,running,pid}], runningAny, types:Set }
        const agg = new Map();
        for (const [projectName, ports] of portEntries) {
            for (const [type, info] of Object.entries(ports || {})) {
                if (!info || !info.port) continue;
                const port = Number(info.port);
                if (!agg.has(port)) {
                    agg.set(port, { port, items: [], runningAny: false, types: new Set(), pids: [] });
                }
                const g = agg.get(port);
                g.items.push({
                    project: projectName,
                    type, // 'frontend' | 'backend'
                    running: !!info.running,
                    pid: info.pid || null,
                });
                if (info.running) g.runningAny = true;
                if (info.pid) g.pids.push(info.pid);
                g.types.add(type);
            }
        }

        // 将 WS 端口也纳入统计（从 this.projects 推断）
        const projectsArray = Object.values(this.projects || {});
        for (const p of projectsArray) {
            const { websocket } = this.getProjectPorts(p);
            const wsPort = Number(this.ensureNumber(websocket));
            if (wsPort) {
                if (!agg.has(wsPort)) {
                    agg.set(wsPort, { port: wsPort, items: [], runningAny: false, types: new Set(), pids: [] });
                }
                const g = agg.get(wsPort);
                g.items.push({
                    project: p.name || p.namespace,
                    type: 'ws',
                    running: !!p.backend_running, // WS 随后端运行
                    pid: p.backend_pid || null
                });
                g.types.add('ws');
                if (p.backend_running) g.runningAny = true;
            }
        }

        // 与项目状态联动：若任一项目在该端口运行，则将该端口整体标记为使用中
        for (const g of agg.values()) {
            const runningFromProjects =
                projectsArray.some(p => (p.backend_port === g.port && !!p.backend_running) ||
                                        (p.frontend_port === g.port && !!p.frontend_running));
            if (runningFromProjects) g.runningAny = true;
        }

        // 排序：按端口号升序
        const groups = Array.from(agg.values()).sort((a, b) => a.port - b.port);

        // 渲染聚合视图（端口为核心 + 分区展示）
        this.elements.portUsage.innerHTML = groups.map(group => {
            const statusClass = group.runningAny ? 'text-green-600' : 'text-gray-500';
            const statusText = group.runningAny ? '使用中' : '空闲';
            const shareLabel = group.items.length > 1 ? `<span class="text-xs text-gray-500 ml-2">共享: ${group.items.length} 项目</span>` : '';

            const apiCoreBadge = (baseCorePort && group.port === baseCorePort)
                ? `<span class="text-xs px-2 py-1 rounded-4 border border-black text-black whitespace-nowrap">API Core</span>`
                : '';

            // 分区聚合
            const frontendRows = group.items.filter(i => i.type === 'frontend').map(i => {
                const rc = i.running ? 'text-green-600' : 'text-gray-500';
                const rt = i.running ? '使用中' : '空闲';
                const pidText = i.pid ? `<span class="text-xs text-gray-400">PID: ${i.pid}</span>` : '';
                return `
                    <div class="flex items-center justify-between">
                        <span class="text-sm">${i.project} - 前端</span>
                        <div class="flex items-center space-x-2">
                            <span class="text-sm ${rc}">${rt}</span>
                            ${pidText}
                        </div>
                    </div>
                `;
            }).join('');

            const backendRows = group.items.filter(i => i.type === 'backend').map(i => {
                const rc = i.running ? 'text-green-600' : 'text-gray-500';
                const rt = i.running ? '使用中' : '空闲';
                const pidText = i.pid ? `<span class="text-xs text-gray-400">PID: ${i.pid}</span>` : '';
                return `
                    <div class="flex items-center justify-between">
                        <span class="text-sm">${i.project} - 后端</span>
                        <div class="flex items-center space-x-2">
                            <span class="text-sm ${rc}">${rt}</span>
                            ${pidText}
                        </div>
                    </div>
                `;
            }).join('');

            const wsRows = group.items.filter(i => i.type === 'ws').map(i => {
                const rc = i.running ? 'text-green-600' : 'text-gray-500';
                const rt = i.running ? '使用中' : '空闲';
                const pidText = i.pid ? `<span class="text-xs text-gray-400">PID: ${i.pid}</span>` : '';
                return `
                    <div class="flex items-center justify-between">
                        <span class="text-sm">${i.project} - WebSocket</span>
                        <div class="flex items-center space-x-2">
                            <span class="text-sm ${rc}">${rt}</span>
                            ${pidText}
                        </div>
                    </div>
                `;
            }).join('');

            const sections = [
                { title: 'frontend', html: frontendRows },
                { title: 'backend', html: backendRows },
                { title: 'ws', html: wsRows },
            ].filter(s => !!s.html);

            return `
                <div class="border border-gray-200 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center space-x-2">
                            <span class="font-mono port-badge">:${group.port}</span>
                            <span class="text-sm ${statusClass}">${statusText}</span>
                            ${shareLabel}
                        </div>
                        <div class="flex items-center space-x-2">
                            ${apiCoreBadge}
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        ${sections.map(sec => `
                            <div class="border border-gray-200 rounded-4 p-3">
                                <div class="text-xs text-gray-600 mb-2">${sec.title}</div>
                                <div class="space-y-2">
                                    ${sec.html}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * 启动项目
     */
    async startProject(projectName) {
        this.showLoading(`正在启动 ${projectName}...`);
        
        try {
            const result = await window.apiClient.startProject(projectName);
            
            if (result.success || (result.result && result.result.success)) {
                this.showToast('success', '启动成功', `项目 ${projectName} 已启动`);
                await this.loadData(false);
            } else {
                const error = result.error || (result.result && result.result.error) || '未知错误';
                this.showToast('error', '启动失败', error);
            }
        } catch (error) {
            this.showToast('error', '启动失败', error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 停止项目
     */
    async stopProject(projectName) {
        this.showLoading(`正在停止 ${projectName}...`);
        
        try {
            const result = await window.apiClient.stopProject(projectName);
            
            if (result.success || (result.result && result.result.success)) {
                this.showToast('success', '停止成功', `项目 ${projectName} 已停止`);
                await this.loadData(false);
            } else {
                const error = result.error || (result.result && result.result.error) || '未知错误';
                this.showToast('error', '停止失败', error);
            }
        } catch (error) {
            this.showToast('error', '停止失败', error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 重启项目
     */
    async restartProject(projectName) {
        this.showLoading(`正在重启 ${projectName}...`);
        
        try {
            const result = await window.apiClient.restartProject(projectName);
            
            if (result.success || (result.result && result.result.success)) {
                this.showToast('success', '重启成功', `项目 ${projectName} 已重启`);
                await this.loadData(false);
            } else {
                const error = result.error || (result.result && result.result.error) || '未知错误';
                this.showToast('error', '重启失败', error);
            }
        } catch (error) {
            this.showToast('error', '重启失败', error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 启动所有项目
     */
    async startAllProjects() {
        const projectNames = Object.keys(this.projects);
        if (projectNames.length === 0) return;
        
        this.showLoading('正在启动所有项目...');
        
        try {
            const promises = projectNames.map(name => 
                window.apiClient.startProject(name).catch(error => ({ error: error.message, project: name }))
            );
            
            const results = await Promise.all(promises);
            const successful = results.filter(r => r.success || (r.result && r.result.success)).length;
            const failed = results.length - successful;
            
            if (failed === 0) {
                this.showToast('success', '全部启动成功', `${successful} 个项目已启动`);
            } else {
                this.showToast('warning', '部分启动成功', `${successful} 个成功，${failed} 个失败`);
            }
            
            await this.loadData(false);
        } catch (error) {
            this.showToast('error', '批量启动失败', error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 停止所有项目
     */
    async stopAllProjects() {
        const projectNames = Object.keys(this.projects);
        if (projectNames.length === 0) return;
        
        this.showLoading('正在停止所有项目...');
        
        try {
            const promises = projectNames.map(name => 
                window.apiClient.stopProject(name).catch(error => ({ error: error.message, project: name }))
            );
            
            const results = await Promise.all(promises);
            const successful = results.filter(r => r.success || (r.result && r.result.success)).length;
            const failed = results.length - successful;
            
            if (failed === 0) {
                this.showToast('success', '全部停止成功', `${successful} 个项目已停止`);
            } else {
                this.showToast('warning', '部分停止成功', `${successful} 个成功，${failed} 个失败`);
            }
            
            await this.loadData(false);
        } catch (error) {
            this.showToast('error', '批量停止失败', error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 处理WebSocket消息
     */
    handleWebSocketMessage(data) {
        // 处理实时状态更新
        if (data.type === 'project_status_update') {
            this.loadData(false); // 静默刷新
        }
    }

    /**
     * 解析 URL 端口
     */
    parsePortFromUrl(url) {
        if (!url || typeof url !== 'string') return null;
        try {
            const u = new URL(url);
            if (u.port) return parseInt(u.port, 10);
            // 未显式端口时返回协议默认端口
            if (u.protocol === 'http:' || u.protocol === 'ws:') return 80;
            if (u.protocol === 'https:' || u.protocol === 'wss:') return 443;
            return null;
        } catch {
            // 简单回退解析
            const m = url.match(/:(\d{2,5})(?:\/|$)/);
            return m ? parseInt(m[1], 10) : null;
        }
    }

    /**
     * 统一获取项目端口（支持后端未返回 ports 时的回退）
     */
    getProjectPorts(project) {
        // 优先使用后端提供的 ports 字段
        if (project && project.ports && typeof project.ports === 'object') {
            return {
                frontend_dev: project.ports.frontend_dev ?? '未设置',
                api_gateway: project.ports.api_gateway ?? '未设置',
                websocket: project.ports.websocket ?? '未设置',
            };
        }
        // 回退：从各字段推断
        const frontend_dev = project.frontend_port || (project.runtime && project.runtime.port) || null;
        const api_gateway =
            project.backend_port ||
            this.parsePortFromUrl(project.api && project.api.api_endpoint) ||
            null;
        const websocket =
            this.parsePortFromUrl(project.api && project.api.websocket_url) ||
            null;

        return {
            frontend_dev: frontend_dev ?? '未设置',
            api_gateway: api_gateway ?? '未设置',
            websocket: websocket ?? '未设置',
        };
    }
    /**
     * 数据结构规范化与合并（新格式适配）
     */

    // 将可能带有包装（status/result/data）的返回，规范化为 { [projectName]: statusObj } 映射
    coerceStatusDict(res) {
        if (!res) return {};
        const pick = (obj) => (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
        if (res.status) return pick(res.status);
        if (res.result) return pick(res.result);
        if (res.data) return pick(res.data);
        // 直接返回字典
        return pick(res);
    }

    // 将可能带有包装（ports/result/data）的返回，规范化为 { [projectName]: { frontend, backend } } 映射
    coercePortsDict(res) {
        if (!res) return {};
        const pick = (obj) => (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
        if (res.ports) return pick(res.ports);
        if (res.result) return pick(res.result);
        if (res.data) return pick(res.data);
        // 直接返回字典
        return pick(res);
    }

    // 归一项目Key，优先 name，其次 namespace
    normalizeProjectKey(project) {
        if (!project) return null;
        return project.name || project.namespace || project.project_name || null;
        // 若后续需要从路径推断，可在此扩展
    }

    ensureNumber(v) {
        const n = (typeof v === 'string' && v.trim() !== '') ? Number(v) : Number(v);
        return Number.isFinite(n) ? n : null;
    }

    ensureBoolean(v) {
        if (v === undefined || v === null) return false;
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v !== 0;
        if (typeof v === 'string') {
            const s = v.trim().toLowerCase();
            return s === 'true' || s === '1' || s === 'yes';
        }
        return !!v;
    }

    // 合并 managedProjects（列表） + statusMap（状态映射） + portsMap（端口映射）为统一字典
    mergeProjectsData(managedProjects, statusMap, portsMap) {
        const merged = {};

        if (Array.isArray(managedProjects) && managedProjects.length > 0) {
            for (const item of managedProjects) {
                const key = this.normalizeProjectKey(item);
                if (!key) continue;

                const s = statusMap[key] || {};
                const p = portsMap[key] || {};

                const frontend_port = this.ensureNumber(
                    s.frontend_port ?? (p.frontend && p.frontend.port) ?? (item.ports && item.ports.frontend_dev) ?? item.frontend_port ?? (item.runtime && item.runtime.port)
                );
                const backend_port = this.ensureNumber(
                    s.backend_port ?? (p.backend && p.backend.port) ?? (item.ports && item.ports.api_gateway) ?? item.backend_port
                );

                merged[key] = {
                    name: key,
                    namespace: item.namespace || key,
                    display_name: item.display_name || item.name || key,
                    version: item.version || null,
                    description: item.description || '',
                    enabled: (typeof item.enabled !== 'undefined') ? this.ensureBoolean(item.enabled) : true,

                    frontend_running: this.ensureBoolean(s.frontend_running ?? (p.frontend && p.frontend.running)),
                    backend_running: this.ensureBoolean(s.backend_running ?? (p.backend && p.backend.running)),

                    frontend_port,
                    backend_port,

                    frontend_pid: s.frontend_pid ?? (p.frontend && p.frontend.pid) ?? null,
                    backend_pid: s.backend_pid ?? (p.backend && p.backend.pid) ?? null,

                    health_status: s.health_status || ((this.ensureBoolean(s.frontend_running) || this.ensureBoolean(s.backend_running)) ? 'healthy' : 'stopped'),
                    errors: typeof s.errors === 'number' ? s.errors : 0,

                    // 保留原有可选字段，方便详情或配置编辑
                    ports: item.ports || undefined,
                    runtime: item.runtime || undefined,
                    api: item.api || undefined,

                    // 新增：类型（历史字段，前端分类改用 role）
                    type: item.type || 'web',
                    role: item.role || undefined,
                };
            }
            return merged;
        }

        // 无 managedProjects 时，使用 statusMap 为主
        const statusKeys = Object.keys(statusMap || {});
        if (statusKeys.length > 0) {
            for (const key of statusKeys) {
                const s = statusMap[key] || {};
                const p = portsMap[key] || {};
                merged[key] = {
                    name: key,
                    namespace: key,
                    display_name: key,
                    version: null,
                    description: '',

                    enabled: true,
                    frontend_running: this.ensureBoolean(s.frontend_running ?? (p.frontend && p.frontend.running)),
                    backend_running: this.ensureBoolean(s.backend_running ?? (p.backend && p.backend.running)),

                    frontend_port: this.ensureNumber(s.frontend_port ?? (p.frontend && p.frontend.port)),
                    backend_port: this.ensureNumber(s.backend_port ?? (p.backend && p.backend.port)),

                    frontend_pid: s.frontend_pid ?? (p.frontend && p.frontend.pid) ?? null,
                    backend_pid: s.backend_pid ?? (p.backend && p.backend.pid) ?? null,

                    health_status: s.health_status || ((this.ensureBoolean(s.frontend_running) || this.ensureBoolean(s.backend_running)) ? 'healthy' : 'stopped'),
                    errors: typeof s.errors === 'number' ? s.errors : 0,
                };
            }
            return merged;
        }

        // 再次兜底：仅有 portsMap
        const portKeys = Object.keys(portsMap || {});
        if (portKeys.length > 0) {
            for (const key of portKeys) {
                const p = portsMap[key] || {};
                merged[key] = {
                    name: key,
                    namespace: key,
                    display_name: key,
                    version: null,
                    description: '',

                    enabled: true,
                    frontend_running: this.ensureBoolean(p.frontend && p.frontend.running),
                    backend_running: this.ensureBoolean(p.backend && p.backend.running),

                    frontend_port: this.ensureNumber(p.frontend && p.frontend.port),
                    backend_port: this.ensureNumber(p.backend && p.backend.port),

                    frontend_pid: (p.frontend && p.frontend.pid) || null,
                    backend_pid: (p.backend && p.backend.pid) || null,

                    health_status: ((p.frontend && p.frontend.running) || (p.backend && p.backend.running)) ? 'healthy' : 'stopped',
                    errors: 0,
                };
            }
        }

        return merged;
    }

    /**
     * 显示加载框
     */
    showLoading(text = '正在处理...') {
        this.elements.loadingText.textContent = text;
        // 为避免与 Tailwind 'hidden' 冲突，显示时添加 flex
        this.elements.loadingModal.classList.remove('hidden');
        this.elements.loadingModal.classList.add('flex');
    }

    /**
     * 隐藏加载框
     */
    hideLoading() {
        // 隐藏时移除 flex，避免与 hidden 冲突
        this.elements.loadingModal.classList.remove('flex');
        this.elements.loadingModal.classList.add('hidden');
    }

    /**
     * 显示通知
     */
    showToast(type, title, message) {
        const iconMap = {
            success: 'check-circle',
            error: 'x-circle',
            warning: 'alert-circle',
            info: 'info'
        };
        
        const colorMap = {
            success: 'text-green-600',
            error: 'text-red-600',
            warning: 'text-yellow-600',
            info: 'text-blue-600'
        };

        this.elements.toastIcon.innerHTML = `<i data-lucide="${iconMap[type]}" class="w-5 h-5 ${colorMap[type]}"></i>`;
        this.elements.toastTitle.textContent = title;
        this.elements.toastMessage.textContent = message;
        
        this.elements.toast.classList.remove('hidden');
        lucide.createIcons();
        
        // 3秒后自动隐藏
        setTimeout(() => {
            this.elements.toast.classList.add('hidden');
        }, 3000);
    }

    /**
     * 更新可管理项目列表
     */
    updateManagedProjectsList() {
        if (!this.managedProjects || this.managedProjects.length === 0) {
            this.elements.managedProjectsList.innerHTML = `
                <p class="text-gray-500 text-center py-4">暂无可管理项目</p>
            `;
            return;
        }

        this.elements.managedProjectsList.innerHTML = this.managedProjects.map(project => {
            // 获取项目的端口配置
            const ports = this.getProjectPorts(project);
            const frontendPort = ports.frontend_dev;
            const backendPort = ports.api_gateway;
            const websocketPort = ports.websocket;

            return `
                <div class="border border-gray-200 rounded-4 p-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h5 class="font-medium text-gray-900">${project.name}</h5>
                            <p class="text-sm text-gray-600">${project.description || '无描述'}</p>
                        </div>
                        <div class="flex space-x-2">
                            <button onclick="app.installProjectDependencies('${project.name}')"
                                    class="btn-secondary px-3 py-1 rounded text-sm flex items-center justify-center space-x-1">
                                <i data-lucide="download" class="w-4 h-4"></i>
                                <span>安装</span>
                            </button>
                            <button onclick="app.showEditPortModal('${project.name}')"
                                    class="btn-secondary px-3 py-1 rounded text-sm flex items-center justify-center space-x-1">
                                <i data-lucide="settings" class="w-4 h-4"></i>
                                <span>端口</span>
                            </button>
                            <button onclick="app.confirmDeleteProject('${project.name}')"
                                    class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm flex items-center justify-center space-x-1">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                                <span>删除</span>
                            </button>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        <div class="flex justify-between">
                            <span class="text-sm text-gray-600">前端端口:</span>
                            <span class="font-mono text-sm">${frontendPort}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-sm text-gray-600">后端端口:</span>
                            <span class="font-mono text-sm">${backendPort}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-sm text-gray-600">WebSocket端口:</span>
                            <span class="font-mono text-sm">${websocketPort}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        lucide.createIcons();
    }

    /**
     * 更新项目端口配置UI
     */
    updateProjectPortConfig() {
        // 已将端口展示合并到“可管理项目列表”，避免两个区域重复展示
        if (!this.elements.projectPortConfig) {
            return;
        }
        if (!this.managedProjects || this.managedProjects.length === 0) {
            this.elements.projectPortConfig.innerHTML = `
                <p class="text-gray-500 text-center py-4">暂无可管理项目</p>
            `;
            return;
        }
        this.elements.projectPortConfig.innerHTML = `
            <div class="text-sm text-gray-600">
                端口配置已合并到“可管理项目列表”中，请在上方列表中查看和编辑端口。
            </div>
        `;
        lucide.createIcons();
    }

    /**
     * 显示导入项目模态框
     */
    showImportProjectModal() {
        const m = this.elements.importProjectModal;
        m.classList.remove('hidden');
        m.classList.add('flex');
        // 扩宽面板，避免选项换行
        try {
            const panel = m.querySelector('.bg-white.rounded-4');
            if (panel) {
                panel.style.maxWidth = '64rem'; // 1024px
            }
        } catch {}
    }

    /**
     * 隐藏导入项目模态框
     */
    hideImportProjectModal() {
        this.elements.importProjectModal.classList.remove('flex');
        this.elements.importProjectModal.classList.add('hidden');
        this.elements.importProjectForm.reset();
    }

    /**
     * 导出前端卡 - 显示/隐藏
     */
    showExportCardModal() {
        const m = this.elements.exportCardModal;
        if (!m) return;
        // 确保在body下
        if (m.parentElement !== document.body) document.body.appendChild(m);
        m.classList.remove('hidden');
        m.classList.add('flex');
        m.style.display = 'flex';
    }
    hideExportCardModal() {
        const m = this.elements.exportCardModal;
        if (!m) return;
        m.classList.remove('flex');
        m.classList.add('hidden');
        m.style.display = 'none';
        if (this.elements.exportCardForm) this.elements.exportCardForm.reset();
    }

    /**
     * 从图片导入 - 显示/隐藏
     */
    showImportFromImageModal() {
        const m = this.elements.importFromImageModal;
        if (!m) return;
        if (m.parentElement !== document.body) document.body.appendChild(m);
        m.classList.remove('hidden');
        m.classList.add('flex');
        m.style.display = 'flex';
        // 扩宽面板，避免选项换行
        try {
            const panel = m.querySelector('.bg-white.rounded-4');
            if (panel) {
                panel.style.maxWidth = '64rem'; // 1024px
            }
        } catch {}
    }
    hideImportFromImageModal() {
        const m = this.elements.importFromImageModal;
        if (!m) return;
        m.classList.remove('flex');
        m.classList.add('hidden');
        m.style.display = 'none';
        const input = document.getElementById('importFromImageFile');
        if (input) input.value = '';
    }

    /**
     * 处理导出项目卡提交（zip+png -> 嵌入png）
     * 支持导出类型区分（前端/后端），目前对嵌入流程无差异，仅用于命名与后续扩展
     */
    async handleExportCard(event) {
        event.preventDefault();
        const zipInput = document.getElementById('exportZipFile');
        const imgInput = document.getElementById('exportImageFile');
        const zipFile = zipInput?.files?.[0];
        const imgFile = imgInput?.files?.[0];
        // 导出卡片为通用格式，无需区分前后端

        if (!zipFile || !imgFile) {
            this.showToast('error', '输入错误', '请同时选择压缩包(.zip)与PNG图片(.png)');
            return;
        }
        if (!zipFile.name.toLowerCase().endsWith('.zip')) {
            this.showToast('error', '输入错误', '压缩包必须为.zip');
            return;
        }
        if (!imgFile.name.toLowerCase().endsWith('.png')) {
            this.showToast('error', '输入错误', '图片必须为.png');
            return;
        }

        this.hideExportCardModal();
        this.showLoading('正在生成嵌入图片...');
        try {
            const formData = new FormData();
            formData.append('archive', zipFile);
            formData.append('image', imgFile);
            // 可选：标记类型，便于后端或后续扩展识别
            // formData.append('card_type', exportType);

            const result = await window.apiClient.embedZipIntoImage(formData);
            const ok = result.success || (result.result && result.result.success);
            const data = ok ? (result.data || result) : null;

            if (!ok) {
                const error = result.error || (result.result && result.result.error) || '未知错误';
                this.showToast('error', '生成失败', error);
                return;
            }

            const base64 = (data.image_base64) || (data.result && data.result.image_base64);
            const fallbackName = 'project_card.png';
            const filename = (data.filename) || (data.result && data.result.filename) || fallbackName;
            if (!base64) {
                this.showToast('error', '生成失败', '未获取到嵌入图片数据');
                return;
            }

            // 触发下载
            this.downloadBase64PNG(filename, base64);
            this.showToast('success', '生成成功', '嵌入图片已生成并下载');
        } catch (error) {
            this.showToast('error', '生成失败', error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 选择图片后自动导入
     */
    async handleImportFromImageChange(event) {
        const file = event?.target?.files?.[0];
        if (!file) {
            return;
        }
        if (!file.name.toLowerCase().endsWith('.png')) {
            this.showToast('error', '输入错误', '图片必须为.png');
            return;
        }

        // 读取导入类型（前端/后端/模块脚本/工作流脚本）
        const typeEl = document.querySelector('input[name="importFromImageType"]:checked');
        const importType = typeEl ? typeEl.value : 'frontend';

        this.hideImportFromImageModal();
        this.showLoading('正在从图片解析并导入...');
        try {
            let result;

            if (importType === 'api_module_script' || importType === 'api_workflow_script') {
                // 从图片导入单个 API 脚本
                const fd = new FormData();
                fd.append('image', file);
                fd.append('namespace', importType === 'api_module_script' ? 'modules' : 'workflow');

                result = await window.apiClient.importApiScriptFromImage(fd);

                const ok = result.success || (result.result && result.result.success);
                if (!ok) {
                    const error = result.error || result.message || (result.result && result.result.error) || '未知错误';
                    this.showToast('error', '导入失败', error);
                    return;
                }

                const writtenPath = result.written_path || (result.result && result.result.written_path) || '';
                this.showToast('success', '导入成功', `API脚本已导入: ${writtenPath}`);
                await this.loadApiFiles();
                return;
            }

            // 项目导入（前端/后端）
            const fd = new FormData();
            fd.append('image', file);
            if (importType === 'backend') {
                result = await window.apiClient.importBackendProjectFromImage(fd);
            } else {
                result = await window.apiClient.importProjectFromImage(fd);
            }

            const ok = result.success || (result.result && result.result.success);
            const data = ok ? (result.data || result) : null;

            if (!ok) {
                const error = result.error || (result.result && result.result.error) || '未知错误';
                this.showToast('error', '导入失败', error);
                return;
            }

            const projectName = data.project_name || (data.result && data.result.project_name) || '新项目';
            this.showToast('success', '导入成功', `项目 ${projectName} 已导入`);
            await this.loadData(false);
        } catch (error) {
            this.showToast('error', '导入失败', error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 下载base64 PNG
     */
    downloadBase64PNG(filename, base64) {
        try {
            const a = document.createElement('a');
            a.href = `data:image/png;base64,${base64}`;
            a.download = filename || 'embedded.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            console.error('下载失败:', e);
        }
    }

    /**
     * 显示端口编辑模态框
     */
    showEditPortModal(projectName) {
        const project = this.managedProjects.find(p => p.name === projectName);
        if (!project) {
            this.showToast('error', '错误', `找不到项目: ${projectName}`);
            return;
        }

        // 设置当前编辑的项目名称
        this.elements.editProjectName.value = projectName;
        
        // 获取项目的端口配置（含回退推断）
const ports = this.getProjectPorts(project);
// 设置表单字段值（"未设置" 显示为空）
this.elements.frontendPort.value = (ports.frontend_dev && ports.frontend_dev !== '未设置') ? ports.frontend_dev : '';
this.elements.backendPort.value = (ports.api_gateway && ports.api_gateway !== '未设置') ? ports.api_gateway : '';
this.elements.websocketPort.value = (ports.websocket && ports.websocket !== '未设置') ? ports.websocket : '';
        
        // 显示模态框
        this.elements.editPortModal.classList.remove('hidden');
        this.elements.editPortModal.classList.add('flex');
    }

    /**
     * 隐藏端口编辑模态框
     */
    hideEditPortModal() {
        this.elements.editPortModal.classList.remove('flex');
        this.elements.editPortModal.classList.add('hidden');
        this.elements.editPortForm.reset();
    }

    /**
     * 处理项目导入
     */
    async handleProjectImport(event) {
        event.preventDefault();
        
        const formData = new FormData(this.elements.importProjectForm);
        const file = formData.get('projectArchive');
        
        if (!file || file.size === 0) {
            this.showToast('error', '导入失败', '请选择有效的文件（.zip 或 .png）');
            return;
        }

        const filename = (file.name || '').toLowerCase();
        const isZip = filename.endsWith('.zip');
        const isPng = filename.endsWith('.png');

        // 读取导入类型（前端/后端/API脚本）
        const typeEl = document.querySelector('input[name="importType"]:checked');
        const importType = typeEl ? typeEl.value : 'frontend';
        
        this.hideImportProjectModal();
        this.showLoading('正在导入...');
        
        try {
            let result;

            // API脚本导入（模块/工作流）
            if (importType === 'api_module_script' || importType === 'api_workflow_script') {
                const namespace = importType === 'api_module_script' ? 'modules' : 'workflow';

                if (!isZip && !isPng) {
                    this.showToast('error', '导入失败', 'API脚本导入仅支持 .zip 或 .png');
                    return;
                }

                if (isZip) {
                    const fd = new FormData();
                    fd.append('archive', file);
                    fd.append('namespace', namespace);
                    result = await window.apiClient.importApiScript(fd);
                } else {
                    const fd = new FormData();
                    fd.append('image', file);
                    fd.append('namespace', namespace);
                    result = await window.apiClient.importApiScriptFromImage(fd);
                }

                const ok = result.success || (result.result && result.result.success);
                if (!ok) {
                    const error = result.error || result.message || (result.result && result.result.error) || '未知错误';
                    this.showToast('error', '导入失败', error);
                    return;
                }

                const writtenPath = result.written_path || (result.result && result.result.written_path) || '';
                this.showToast('success', '导入成功', `API脚本已导入: ${writtenPath}`);
                // 刷新 API 文件管理面板
                await this.loadApiFiles();
                return;
            }

            // 项目导入（前端/后端）
            if (importType === 'backend') {
                if (!isZip) {
                    this.showToast('error', '导入失败', '后端项目导入仅支持 .zip');
                    return;
                }
                result = await window.apiClient.importBackendProject(formData);
            } else {
                if (!isZip) {
                    this.showToast('error', '导入失败', '前端项目导入仅支持 .zip');
                    return;
                }
                result = await window.apiClient.importProject(formData);
            }
            
            if (result.success || (result.result && result.result.success)) {
                const projectName = result.project_name || (result.result && result.result.project_name) || '新项目';
                this.showToast('success', '导入成功', `项目 ${projectName} 已导入`);
                await this.loadData(false);
            } else {
                const error = result.error || (result.result && result.result.error) || '未知错误';
                this.showToast('error', '导入失败', error);
            }
        } catch (error) {
            this.showToast('error', '导入失败', error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 确认删除项目
     */
    confirmDeleteProject(projectName) {
        this.currentDeleteProject = projectName;
        this.elements.deleteProjectName.textContent = projectName;
        this.elements.deleteProjectModal.classList.remove('hidden');
        this.elements.deleteProjectModal.classList.add('flex');
    }

    /**
     * 隐藏删除项目确认模态框
     */
    hideDeleteProjectModal() {
        this.elements.deleteProjectModal.classList.remove('flex');
        this.elements.deleteProjectModal.classList.add('hidden');
        this.currentDeleteProject = null;
    }

    /**
     * 删除项目
     */
    async deleteProject() {
        if (!this.currentDeleteProject) return;
        
        const projectName = this.currentDeleteProject;
        this.hideDeleteProjectModal();
        this.showLoading(`正在删除项目 ${projectName}...`);
        
        try {
            const result = await window.apiClient.deleteProject(projectName);
            
            if (result.success || (result.result && result.result.success)) {
                this.showToast('success', '删除成功', `项目 ${projectName} 已删除`);
                await this.loadData(false);
            } else {
                const error = result.error || (result.result && result.result.error) || '未知错误';
                this.showToast('error', '删除失败', error);
            }
        } catch (error) {
            this.showToast('error', '删除失败', error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 安装项目依赖
     */
    async installProjectDependencies(projectName) {
        this.showLoading(`正在安装 ${projectName} 项目依赖...`);
        
        try {
            const result = await window.apiClient.installProjectDependencies(projectName);
            
            if (result.success || (result.result && result.result.success)) {
                this.showToast('success', '安装成功', `项目 ${projectName} 依赖安装完成`);
                await this.loadData(false);
            } else {
                const error = result.error || (result.result && result.result.error) || '未知错误';
                this.showToast('error', '安装失败', error);
            }
        } catch (error) {
            this.showToast('error', '安装失败', error.message);
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 保存端口配置
     */
    async savePortConfig(event) {
        event.preventDefault();
        
        const projectName = this.elements.editProjectName.value;
        if (!projectName) return;
        
        // 获取端口值
        const frontendPort = parseInt(this.elements.frontendPort.value);
        const backendPort = parseInt(this.elements.backendPort.value);
        const websocketPort = parseInt(this.elements.websocketPort.value);
        
        // 验证端口值
        if (isNaN(frontendPort) || frontendPort < 1024 || frontendPort > 65535) {
            this.showToast('error', '输入错误', '前端端口必须是1024-65535之间的数字');
            return;
        }
        
        if (isNaN(backendPort) || backendPort < 1024 || backendPort > 65535) {
            this.showToast('error', '输入错误', '后端端口必须是1024-65535之间的数字');
            return;
        }
        
        if (isNaN(websocketPort) || websocketPort < 1024 || websocketPort > 65535) {
            this.showToast('error', '输入错误', 'WebSocket端口必须是1024-65535之间的数字');
            return;
        }
        
        this.hideEditPortModal();
        this.showLoading(`正在保存端口配置...`);
        
        try {
            const result = await window.apiClient.updateProjectPorts(
                projectName,
                {
                    frontend_dev: frontendPort,
                    api_gateway: backendPort,
                    websocket: websocketPort
                }
            );
            
            if (result.success || (result.result && result.result.success)) {
                this.showToast('success', '保存成功', `项目 ${projectName} 端口配置已更新`);
                await this.loadData(false);
            } else {
                const error = result.error || (result.result && result.result.error) || '未知错误';
                this.showToast('error', '保存失败', error);
            }
        } catch (error) {
            this.showToast('error', '保存失败', error.message);
        } finally {
            this.hideLoading();
        }
    }
    /**
     * 显示 API 目录面板
     */
    async showApiRegistryModal() {
        const m = this.elements.apiRegistryModal;
        if (!m) return;
        if (m.parentElement !== document.body) document.body.appendChild(m);
        m.classList.remove('hidden');
        m.classList.add('flex');
        await this.loadAndRenderApiList();
    }

    /**
     * 隐藏 API 目录面板
     */
    hideApiRegistryModal() {
        const m = this.elements.apiRegistryModal;
        if (!m) return;
        m.classList.remove('flex');
        m.classList.add('hidden');
        if (this.elements.apiSearchInput) this.elements.apiSearchInput.value = '';
    }

    /**
     * 加载并渲染 API 列表
     * 在请求期间在面板内显示等待动画
     */
    async loadAndRenderApiList() {
        try {
            const container = this.elements.apiListContainer;
            if (container) {
                container.innerHTML = `
                    <div class="flex items-center justify-center py-12">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 spinner border-black mr-3"></div>
                        <span class="text-gray-700 text-sm">正在加载API定义...</span>
                    </div>
                `;
            }
            this.showLoading('正在加载API定义...');
            const res = await window.apiClient.listApis();
            const apis = Array.isArray(res?.apis) ? res.apis : (Array.isArray(res) ? res : []);
            if (this.elements.apiTotalCount) {
                this.elements.apiTotalCount.textContent = String(res?.total ?? apis.length);
            }
            this.apiList = apis;
            this.renderApiList(apis);
        } catch (e) {
            this.showToast('error', '加载失败', e.message || '未知错误');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * 根据搜索关键字过滤 API 列表
     */
    filterApiList(query = '') {
        const q = (query || '').trim().toLowerCase();
        const list = !q ? (this.apiList || []) : (this.apiList || []).filter(a => {
            const name = (a.name || '').toLowerCase();
            const path = (a.path || '').toLowerCase();
            const ns = (a.namespace || '').toLowerCase();
            const desc = (a.description || '').toLowerCase();
            return name.includes(q) || path.includes(q) || ns.includes(q) || desc.includes(q);
        });
        this.renderApiList(list);
    }

    /**
     * 构建 Schema 概览（字段名下显示“必填/可选”，不同字段之间使用浅水平分隔线）
     */
    buildSchemaSummary(schema) {
        try {
            const propsObj = (schema && schema.properties) || {};
            const keys = Object.keys(propsObj);
            const required = Array.isArray(schema && schema.required) ? schema.required : [];
            if (!keys.length) {
                return '<div class="text-xs text-gray-400">无 Schema</div>';
            }

            // 类型中文注释映射
            const typeNoteMap = {
                string: '字符串文本',
                number: '数值（浮点）',
                integer: '整数（不含小数）',
                boolean: '布尔型（true/false）',
                object: '对象（键值集合）',
                array: '数组（有序集合）',
                null: '空值（null）',
                any: '任意类型'
            };
            const asArray = (v) => Array.isArray(v) ? v : (v ? [v] : ['any']);
            const cnNoteFor = (tp) => typeNoteMap[tp] || '任意类型';
            const buildNote = (schemaProp) => {
                const tps = asArray(schemaProp.type);
                // 针对数组类型，尽量包含 items 的类型注释
                if (tps.includes('array')) {
                    const itemType = schemaProp.items && (Array.isArray(schemaProp.items.type) ? schemaProp.items.type[0] : schemaProp.items && schemaProp.items.type);
                    if (itemType) {
                        return `数组元素类型：${cnNoteFor(itemType)}`;
                    }
                    return '数组';
                }
                return tps.map(cnNoteFor).join(' | ');
            };

            const rows = keys.map((k, i) => {
                const s = propsObj[k] || {};
                const t = Array.isArray(s.type) ? s.type.join(' | ') : (s.type || 'any');
                const fmt = s.format ? ` (${s.format})` : '';
                const isReq = required.includes(k);
                const note = buildNote(s);
                const separator = i < (keys.length - 1) ? '<div class="border-t border-gray-200 my-2"></div>' : '';

                return `
                    <div class="py-2">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                            <div class="flex flex-col items-start gap-1">
                                <span class="port-badge">${k}</span>
                                <span class="text-[10px] ${isReq ? 'text-black' : 'text-gray-500'}">${isReq ? '必填' : '可选'}</span>
                            </div>
                            <div class="md:col-span-2 text-right">
                                <div class="font-mono text-xs text-black">${t}${fmt}</div>
                                <div class="text-gray-600 text-xs">${note}</div>
                            </div>
                        </div>
                    </div>
                    ${separator}
                `;
            }).join('');

            return `
                <div class="space-y-2 border border-gray-200 rounded-4 p-3">
                    ${rows}
                </div>
            `;
        } catch {
            return '<div class="text-xs text-gray-400">无 Schema</div>';
        }
    }

    /**
     * 渲染 API 列表
     */
    renderApiList(list = []) {
        const container = this.elements.apiListContainer;
        if (!container) return;
        if (!list || list.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <i data-lucide="list-x" class="w-10 h-10 text-gray-400 mx-auto mb-3"></i>
                    <p class="text-gray-500">暂无API定义</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }
        container.innerHTML = list.map(a => `
            <div class="bg-white project-card p-4">
                <div class="flex items-center justify-between mb-2">
                    <div>
                        <h4 class="text-base font-semibold text-gray-900">${a.name || a.path}</h4>
                        <p class="text-sm text-gray-600">${a.description || ''}</p>
                    </div>
                    <span class="text-xs px-2 py-1 rounded-4 border border-gray-500 text-gray-700">${a.namespace || 'modules'}</span>
                </div>
                <div class="flex items-center justify-between mb-3">
                    <div class="text-sm text-gray-600">路径</div>
                    <div class="font-mono text-sm">${a.path}</div>
                </div>
                <div class="space-y-2">
                    <div>
                        <div class="text-sm font-medium text-black mb-1">输入Schema</div>
                        ${this.buildSchemaSummary(a.input_schema || {})}
                    </div>
                    <div>
                        <div class="text-sm font-medium text-black mb-1">输出Schema</div>
                        ${this.buildSchemaSummary(a.output_schema || {})}
                    </div>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    }
}
 
// 初始化应用
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ProjectManagerApp();
});
 
// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (app && app.refreshInterval) {
        clearInterval(app.refreshInterval);
    }
});
// ===== 通用 API 文件管理：面板逻辑扩展（每页10条，模块/工作流双面板） =====

// 扩展 ProjectManagerApp 原型：状态、加载、渲染、删除与分页
ProjectManagerApp.prototype._initApiFilesState = function() {
    if (!this.apiFiles) {
        this.apiFiles = { modules: [], workflow: [] };
    }
    if (!this.apiModulesPage) this.apiModulesPage = 1;
    if (!this.apiWorkflowPage) this.apiWorkflowPage = 1;
    if (!this.apiFilesPageSize) this.apiFilesPageSize = 10;
};

ProjectManagerApp.prototype.loadApiFiles = async function() {
    try {
        this._initApiFilesState();
        // 确保 API 客户端就绪
        await this.ensureApiClientReady();

        // 在面板局部显示加载效果（复用全局 loading 以简化）
        this.showLoading('正在加载 API 文件夹与注册的 API...');
        const res = await window.apiClient.listApiFolders();
        const modules = Array.isArray(res?.modules) ? res.modules : [];
        const workflow = Array.isArray(res?.workflow) ? res.workflow : [];
        this.apiFiles.modules = modules;
        this.apiFiles.workflow = workflow;

        // 额外拉取已注册 API 列表并按命名空间/相对目录归并
        const apiRes = await window.apiClient.listApis();
        const allApis = Array.isArray(apiRes?.apis) ? apiRes.apis : (Array.isArray(apiRes) ? apiRes : []);

        const normalize = (s) => String(s || '').replace(/\\/g, '/').toLowerCase();

        // 归并到模块文件夹
        this.apiFiles.modules = (this.apiFiles.modules || []).map(folder => {
            const rel = normalize(folder.relative_path || folder.name || '');
            const matched = allApis.filter(a =>
                normalize(a.namespace) === 'modules' &&
                normalize(a.path).startsWith(rel)
            );
            return {
                ...folder,
                apis: matched,
                api_count: matched.length
            };
        });

        // 归并到工作流文件夹
        this.apiFiles.workflow = (this.apiFiles.workflow || []).map(folder => {
            const rel = normalize(folder.relative_path || folder.name || '');
            const matched = allApis.filter(a =>
                normalize(a.namespace) === 'workflow' &&
                normalize(a.path).startsWith(rel)
            );
            return {
                ...folder,
                apis: matched,
                api_count: matched.length
            };
        });

        // 更新总数（按文件夹计数）
        const mTotalEl = document.getElementById('apiModulesTotal');
        const wTotalEl = document.getElementById('apiWorkflowTotal');
        if (mTotalEl) mTotalEl.textContent = `${this.apiFiles.modules.length} 项`;
        if (wTotalEl) wTotalEl.textContent = `${this.apiFiles.workflow.length} 项`;

        // 初始渲染
        this.apiModulesPage = 1;
        this.apiWorkflowPage = 1;
        this.renderApiFiles();

        // 绑定分页与交互
        this._bindApiFilesPagination();

        this.showToast('success', '加载完成', 'API 文件夹与注册 API 已更新');
    } catch (e) {
        this.showToast('error', '加载失败', e.message || '未知错误');
    } finally {
        this.hideLoading();
    }
};

ProjectManagerApp.prototype._bindApiFilesPagination = function() {
    const mPrev = document.getElementById('apiModulesPrev');
    const mNext = document.getElementById('apiModulesNext');
    const wPrev = document.getElementById('apiWorkflowPrev');
    const wNext = document.getElementById('apiWorkflowNext');

    const add = (el, evt, fn) => { if (el) el.addEventListener(evt, fn); };

    add(mPrev, 'click', () => {
        const totalPages = Math.max(1, Math.ceil((this.apiFiles.modules || []).length / this.apiFilesPageSize));
        this.apiModulesPage = Math.max(1, this.apiModulesPage - 1);
        this.renderApiFiles();
    });
    add(mNext, 'click', () => {
        const totalPages = Math.max(1, Math.ceil((this.apiFiles.modules || []).length / this.apiFilesPageSize));
        this.apiModulesPage = Math.min(totalPages, this.apiModulesPage + 1);
        this.renderApiFiles();
    });
    add(wPrev, 'click', () => {
        const totalPages = Math.max(1, Math.ceil((this.apiFiles.workflow || []).length / this.apiFilesPageSize));
        this.apiWorkflowPage = Math.max(1, this.apiWorkflowPage - 1);
        this.renderApiFiles();
    });
    add(wNext, 'click', () => {
        const totalPages = Math.max(1, Math.ceil((this.apiFiles.workflow || []).length / this.apiFilesPageSize));
        this.apiWorkflowPage = Math.min(totalPages, this.apiWorkflowPage + 1);
        this.renderApiFiles();
    });

    // 事件委托：删除与展开/收起
    document.addEventListener('click', (evt) => {
        // 删除按钮
        const delBtn = evt.target && typeof evt.target.closest === 'function'
            ? evt.target.closest('[data-action="delete-api-folder"]')
            : null;
        if (delBtn) {
            const ns = delBtn.getAttribute('data-namespace');
            const rel = delBtn.getAttribute('data-relative-path');
            if (ns && rel) {
                this.deleteApiFolder(ns, rel);
            }
            return;
        }

        // 展开/收起按钮
        const toggleBtn = evt.target && typeof evt.target.closest === 'function'
            ? evt.target.closest('[data-action="toggle-api-folder"]')
            : null;
        if (toggleBtn) {
            const folderId = toggleBtn.getAttribute('data-folder-id');
            const listEl = folderId ? document.querySelector(`[data-api-folder-list="${folderId}"]`) : null;
            if (listEl) {
                const isHidden = listEl.classList.contains('hidden');
                if (isHidden) {
                    listEl.classList.remove('hidden');
                    toggleBtn.querySelector('span') && (toggleBtn.querySelector('span').textContent = '收起');
                    const iconEl = toggleBtn.querySelector('[data-lucide]');
                    if (iconEl) iconEl.setAttribute('data-lucide', 'chevron-up');
                } else {
                    listEl.classList.add('hidden');
                    toggleBtn.querySelector('span') && (toggleBtn.querySelector('span').textContent = '展开');
                    const iconEl = toggleBtn.querySelector('[data-lucide]');
                    if (iconEl) iconEl.setAttribute('data-lucide', 'chevron-down');
                }
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
};

ProjectManagerApp.prototype._renderApiListSection = function(items, page, namespace) {
    const start = (page - 1) * this.apiFilesPageSize;
    const end = start + this.apiFilesPageSize;
    const current = items.slice(start, end);

    if (!current.length) {
        return `
            <div class="text-gray-500 text-sm py-4 text-center">暂无数据</div>
        `;
    }

    const icon = namespace === 'modules' ? 'package' : 'workflow';
    const makeId = (ns, rel) => `${ns}:${rel}`.replace(/[^a-zA-Z0-9:_-]/g, '_');

    return current.map((it) => {
        const name = it.name || it.relative_path || '';
        const rel = it.relative_path || '';
        const count = Number(it.api_count || 0);
        const apis = Array.isArray(it.apis) ? it.apis : [];
        const folderId = makeId(namespace, rel);

        const apisHtml = apis.length
            ? apis.map(a => `
                <div class="border border-gray-200 rounded-4 p-2">
                    <div class="flex items-center justify-between">
                        <div class="min-w-0">
                            <div class="flex items-center space-x-2">
                                <span class="text-xs px-2 py-0.5 rounded-4 border border-gray-500 text-gray-700">${a.namespace || namespace}</span>
                                <span class="font-mono text-xs">${a.path || ''}</span>
                            </div>
                            <div class="text-sm font-bold text-black mt-1">${a.name || a.path || ''}</div>
                            ${a.description ? `<div class="text-xs text-gray-600 mt-1">${a.description}</div>` : ''}
                        </div>
                    </div>
                </div>
            `).join('')
            : `<div class="text-xs text-gray-500 py-2">该文件夹下暂无注册 API</div>`;

        return `
            <div class="border border-gray-200 rounded-4 p-3">
                <div class="flex items-center justify-between">
                    <div class="min-w-0">
                        <div class="flex items-center space-x-2">
                            <i data-lucide="${icon}" class="w-4 h-4 text-black"></i>
                            <span class="font-medium text-black truncate">${name}</span>
                            <span class="text-xs px-2 py-1 rounded-4 border border-gray-500 text-gray-700">API: ${count}</span>
                        </div>
                        <div class="mt-1 text-xs text-gray-600 flex items-center space-x-2">
                            <span class="port-badge">${rel}</span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button
                            class="btn-secondary px-3 py-1 rounded text-sm flex items-center justify-center space-x-1"
                            data-action="toggle-api-folder"
                            data-namespace="${namespace}"
                            data-relative-path="${rel}"
                            data-folder-id="${folderId}"
                            title="展开/收起注册的 API 列表">
                            <i data-lucide="chevron-down" class="w-4 h-4"></i>
                            <span>展开</span>
                        </button>
                        <button
                            class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm flex items-center justify-center space-x-1"
                            data-action="delete-api-folder"
                            data-namespace="${namespace}"
                            data-relative-path="${rel}"
                            title="删除该文件夹">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                            <span>删除</span>
                        </button>
                    </div>
                </div>
                <div class="mt-3 hidden" data-api-folder-list="${folderId}">
                    ${apisHtml}
                </div>
            </div>
        `;
    }).join('');
};

ProjectManagerApp.prototype.renderApiFiles = function() {
    this._initApiFilesState();

    // 模块
    const mContainer = document.getElementById('apiModulesList');
    const mPageInfo = document.getElementById('apiModulesPageInfo');
    const mTotalPages = Math.max(1, Math.ceil((this.apiFiles.modules || []).length / this.apiFilesPageSize));
    this.apiModulesPage = Math.min(Math.max(1, this.apiModulesPage), mTotalPages);
    if (mContainer) {
        mContainer.innerHTML = this._renderApiListSection(this.apiFiles.modules || [], this.apiModulesPage, 'modules');
    }
    if (mPageInfo) {
        mPageInfo.textContent = `第 ${this.apiModulesPage} / ${mTotalPages} 页`;
    }

    // 工作流
    const wContainer = document.getElementById('apiWorkflowList');
    const wPageInfo = document.getElementById('apiWorkflowPageInfo');
    const wTotalPages = Math.max(1, Math.ceil((this.apiFiles.workflow || []).length / this.apiFilesPageSize));
    this.apiWorkflowPage = Math.min(Math.max(1, this.apiWorkflowPage), wTotalPages);
    if (wContainer) {
        wContainer.innerHTML = this._renderApiListSection(this.apiFiles.workflow || [], this.apiWorkflowPage, 'workflow');
    }
    if (wPageInfo) {
        wPageInfo.textContent = `第 ${this.apiWorkflowPage} / ${wTotalPages} 页`;
    }

    // 刷新图标
    if (window.lucide) {
        window.lucide.createIcons();
    }
};

ProjectManagerApp.prototype.deleteApiFolder = async function(namespace, relative_path) {
    try {
        // 二次确认
        if (!confirm(`确定删除 ${namespace} / ${relative_path} 目录吗？此操作不可撤销！`)) {
            return;
        }
        this.showLoading('正在删除目录...');
        const res = await window.apiClient.deleteApiFolder(namespace, relative_path);
        const ok = !!(res && (res.success || (res.result && res.result.success)));
        if (!ok) {
            const msg = res?.message || (res?.result && res.result.message) || '删除失败';
            this.showToast('error', '删除失败', msg);
            return;
        }
        this.showToast('success', '删除成功', `${namespace}/${relative_path} 已删除`);
        // 重新加载并渲染
        await this.loadApiFiles();
    } catch (e) {
        this.showToast('error', '删除失败', e.message || '未知错误');
    } finally {
        this.hideLoading();
    }
};

// 页面就绪后自动加载 API 文件管理面板数据（避免改动现有 init 流程）
document.addEventListener('DOMContentLoaded', () => {
    // app 已在下方初始化，这里延迟触发加载
    setTimeout(() => {
        try {
            if (window.app && typeof window.app.loadApiFiles === 'function') {
                window.app.loadApiFiles();
            }
        } catch (e) {
            // 安静失败
            console.warn('加载 API 文件面板失败:', e);
        }
    }, 600);
});