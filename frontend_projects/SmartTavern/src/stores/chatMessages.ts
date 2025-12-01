// 消息双状态管理 Store (TypeScript)
// 
// 职责：
// 1. 维护原始消息（rawMessages）：来自后端的原始对话数据
// 2. 维护用户视图消息（displayMessages）：经过 user_view 处理后的显示消息
// 3. 监听原始消息变化，自动调用 process_messages_view API 更新显示消息
// 4. 提供编辑模式：编辑时使用原始消息，保存后更新并重新处理

import { ref, watch, computed } from 'vue'
import { defineStore } from 'pinia'
import Host from '@/workflow/core/host'
import * as Completion from '@/workflow/channels/completion'
import { usePresetStore } from './preset'
import { useCharacterStore } from './character'
import { useWorldBooksStore } from './worldBooks'
import { useRegexRulesStore } from './regexRules'
import { usePersonaStore } from './persona'
import { useChatVariablesStore } from './chatVariables'

// ========== 类型定义 ==========

/**
 * 消息接口
 */
export interface Message {
	/** 消息 ID（节点 ID） */
	id: string
	/** 角色 */
	role: 'system' | 'user' | 'assistant'
	/** 消息内容 */
	content: string
	/** 节点更新时间 */
	node_updated_at?: string
}

/**
 * 处理消息视图 API 的响应接口
 */
// 兼容旧注释接口：现使用动态结果类型

/**
 * 编辑状态映射接口
 */
type EditingStates = Record<string, boolean>

// ========== Pinia Store 定义 ==========

export const useMessagesStore = defineStore('chatMessages', () => {
	// ========== 状态 ==========
	
	// 当前对话文件路径
	const conversationFile = ref<string | null>(null)
	
	// 原始消息数组（来自后端）
	const rawMessages = ref<Message[]>([])
	
	// 用户视图消息数组（经过 user_view 处理）
	const displayMessages = ref<Message[]>([])
	
	// 处理状态
	const isProcessing = ref<boolean>(false)
	const processError = ref<string | null>(null)
	// 每次加载对话时刷新会话标识，避免复用旧后端缓存基线
	const routerSessionId = ref<string | null>(null)
	
	// 编辑状态映射 { nodeId: isEditing }
	const editingStates = ref<EditingStates>({})
	
	// ===== 流式处理控制（防止每个 chunk 触发视图处理）=====
	const activeStreamCount = ref<number>(0)
	const _streamingTags = new Set<string>()
	let _streamProcessTimer: ReturnType<typeof setTimeout> | null = null

	function _markStreamStart(tag?: string): void {
		if (!tag) return
		if (_streamingTags.has(tag)) return
		_streamingTags.add(tag)
		activeStreamCount.value++
	}

	function _markStreamEnd(tag?: string): void {
		if (!tag) return
		if (_streamingTags.delete(tag)) {
			activeStreamCount.value = Math.max(0, activeStreamCount.value - 1)
			_scheduleProcessAfterStreams()
		}
	}

	function _scheduleProcessAfterStreams(delay: number = 20): void {
		if (activeStreamCount.value > 0) return
		if (_streamProcessTimer) clearTimeout(_streamProcessTimer)
		_streamProcessTimer = setTimeout(async () => {
			_streamProcessTimer = null
			try { await processMessagesView() } catch {}
		}, delay)
	}

	// ========== 计算属性 ==========
	
	// 当前是否有消息
	const hasMessages = computed(() => rawMessages.value.length > 0)
	
	// 是否有任何消息正在编辑
	const hasEditing = computed(() => 
		Object.values(editingStates.value).some(v => v === true)
	)
	
	// ========== 方法 ==========
	
	/**
	 * 加载对话消息（初始化）
	 */
	async function loadConversation(file: string, initialMessages: Message[] = []): Promise<void> {
		conversationFile.value = file
		rawMessages.value = initialMessages
		// 生成新的会话标识，强制后端为本次会话使用独立缓存
		try { routerSessionId.value = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}` } catch { routerSessionId.value = `${Date.now()}` }
		
		// 自动触发处理（通过 watch）
	}
	
	/**
	 * 更新原始消息
	 * 当后端消息变化时调用（如新增、删除、编辑）
	 */
	function updateRawMessages(newMessages: Message[]): void {
		rawMessages.value = newMessages
		// watch 会自动触发处理
	}
	
	/**
	 * 处理消息视图
	 * 调用后端 API 获取 user_view 处理后的消息
	 */
	async function processMessagesView(): Promise<void> {
		if (!conversationFile.value) {
			console.warn('No conversation file set')
			return
		}
		if (isProcessing.value) {
			console.log('Already processing, skip')
			return
		}

		isProcessing.value = true
		processError.value = null

		try {
			const RouterClient = (await import('@/services/routerClient.js')).default as any
			// 优先使用增量接口；后端若不支持则回退到 history 全量
			let result: any
			try {
				result = await RouterClient.routeWithHooksDelta({
					conversationFile: conversationFile.value,
					view: 'user_view',
					routerSessionId: routerSessionId.value,
				})
			} catch (_) {
				result = await RouterClient.routeWithHooksBackend({
					conversationFile: conversationFile.value,
					view: 'user_view',
					output: 'history',
				})
			}

			if (!result?.success) {
				throw new Error(result?.error || 'Failed to process messages view')
			}

			// 增量（delta）返回
			if (Array.isArray(result.changed)) {
				const updatesById: Record<string, { role: string; content: string }> = {}
				for (const ch of result.changed) {
					const sid = ch?.source_id
					if (typeof sid === 'string') {
						updatesById[sid] = { role: ch.role, content: ch.content }
					}
				}
				// 变量增量：按路径应用 changed / deleted
				try {
					const variablesStore = useChatVariablesStore()
					const currentVars = JSON.parse(JSON.stringify((variablesStore.meta as any)?.value || {}))

					const setByPath = (obj: any, path: string, value: any) => {
						if (!path) return
						const regex = /\[(\d+)\]|[^.\[\]]+/g
						const tokens: (string|number)[] = []
						let m: RegExpExecArray | null
						while ((m = regex.exec(path))) {
							if (m[1] !== undefined) tokens.push(Number(m[1]))
							else tokens.push(m[0])
						}
						let target = obj
					for (let i = 0; i < tokens.length - 1; i++) {
						const k = tokens[i]
						if (typeof k === 'number') {
							if (!Array.isArray(target)) return
							if (!(target as any)[k]) (target as any)[k] = {}
							target = (target as any)[k]
						} else {
							const tk = k as any
							if (typeof (target as any)[tk] !== 'object' || (target as any)[tk] === null) (target as any)[tk] = {}
							target = (target as any)[tk]
						}
					}
						const last = tokens[tokens.length - 1]
						if (last !== undefined) (target as any)[last as any] = value
					}
					const deleteByPath = (obj: any, path: string) => {
						if (!path) return
						const regex = /\[(\d+)\]|[^.\[\]]+/g
						const tokens: (string|number)[] = []
						let m: RegExpExecArray | null
						while ((m = regex.exec(path))) {
							if (m[1] !== undefined) tokens.push(Number(m[1]))
							else tokens.push(m[0])
						}
						let target = obj
					for (let i = 0; i < tokens.length - 1; i++) {
						const k = tokens[i]
						if (target == null) return
						target = (target as any)[k as any]
						if (typeof target !== 'object') return
					}
						const last = tokens[tokens.length - 1]
						if (target && last !== undefined) {
							if (Array.isArray(target) && typeof last === 'number') target.splice(last, 1)
							else delete (target as any)[last as any]
						}
					}

					if (Array.isArray(result.variables_changed)) {
						for (const ch of result.variables_changed) {
							if (typeof ch?.path === 'string') {
								setByPath(currentVars, ch.path, ch.value)
							}
						}
					}
					if (Array.isArray(result.variables_deleted)) {
						for (const p of result.variables_deleted) {
							if (typeof p === 'string') deleteByPath(currentVars, p)
						}
					}

					try {
						Host.events.emit('workflow.message.view.updated', {
							conversationFile: conversationFile.value,
							messages: displayMessages.value,
							variables: currentVars,
						})
					} catch {}
				} catch {}

				// 构造显示数组：仅更新发生变更的节点，并处理删除
				const out: Message[] = []
				const existingById: Record<string, Message> = {}
				for (const m of displayMessages.value) existingById[m.id] = m
				const skipIds = new Set<string>(Array.isArray(result.messages_deleted) ? result.messages_deleted.filter((x: any) => typeof x === 'string') : [])
				for (const r of (rawMessages.value || [])) {
					if (skipIds.has(r.id)) continue
					const prev = existingById[r.id]
					const upd = updatesById[r.id]
					if (prev) {
						if (upd) {
							prev.content = typeof upd.content === 'string' ? upd.content : prev.content
						}
						// 保持 node_updated_at
						if (r.node_updated_at) prev.node_updated_at = r.node_updated_at
						out.push(prev)
					} else {
						const entry: Message = { id: r.id, role: r.role, content: r.content }
						if (r.node_updated_at) entry.node_updated_at = r.node_updated_at
						if (upd) {
							entry.content = typeof upd.content === 'string' ? upd.content : entry.content
						}
						out.push(entry)
					}
				}
				displayMessages.value = out

				try {
					Host.events.emit('workflow.message.view.updated', {
						conversationFile: conversationFile.value,
						messages: displayMessages.value,
						variables: result.variables || undefined,
					})
				} catch {}
				return
			}

			// 兼容：全量返回 messages（history）
			const processed = Array.isArray(result.messages) ? result.messages : []
			const outMap: Record<string, string> = {}
			for (const m of processed) {
				const sid = m?.source?.source_id
				if (typeof sid === 'string') outMap[sid] = typeof m.content === 'string' ? m.content : ''
			}
			const out: Message[] = []
			for (const r of (rawMessages.value || [])) {
				const entry: Message = { id: r.id, role: r.role, content: r.content }
				if (r.node_updated_at) entry.node_updated_at = r.node_updated_at
				const mapped = outMap[r.id]
				if (typeof mapped === 'string') entry.content = mapped
				out.push(entry)
			}
			displayMessages.value = out

			try {
				Host.events.emit('workflow.message.view.updated', {
					conversationFile: conversationFile.value,
					messages: displayMessages.value,
					variables: result.variables || undefined,
				})
			} catch {}
		} catch (err) {
			console.error('Failed to process messages view:', err)
			processError.value = (err as Error)?.message || String(err)
			displayMessages.value = rawMessages.value
			try {
				Host.events.emit('workflow.message.view.failed', {
					conversationFile: conversationFile.value,
					error: processError.value
				})
			} catch {}
		} finally {
			isProcessing.value = false
		}
	}
	
	/**
	 * 开始编辑消息
	 */
	function startEdit(nodeId: string): void {
		editingStates.value[nodeId] = true
	}
	
	/**
	 * 取消编辑消息
	 */
	function cancelEdit(nodeId: string): void {
		editingStates.value[nodeId] = false
	}
	
	/**
	 * 完成编辑并保存
	 * 保存后会自动触发重新处理
	 */
	function finishEdit(nodeId: string): void {
		editingStates.value[nodeId] = false
		// 编辑完成后，rawMessages 应该已经通过其他方式更新
		// watch 会自动触发重新处理
	}
	
	/**
	 * 检查消息是否正在编辑
	 */
	function isEditing(nodeId: string): boolean {
		return editingStates.value[nodeId] === true
	}
	
	/**
	 * 获取消息显示内容
	 * 编辑时返回原始内容，否则返回处理后的内容
	 */
	function getMessageContent(nodeId: string): string {
		if (isEditing(nodeId)) {
			const rawMsg = rawMessages.value.find(m => m.id === nodeId)
			return rawMsg?.content || ''
		}

		// 流式期间：仅对“正在流式的节点”返回原始内容；其他节点仍返回处理后的视图内容，避免被清空
		if (activeStreamCount.value > 0) {
			const isStreamingNode = _streamingTags.has(nodeId)
			if (isStreamingNode) {
			const rawMsg = rawMessages.value.find(m => m.id === nodeId)
			return rawMsg?.content || ''
			}
		}
		
		const displayMsg = displayMessages.value.find(m => m.id === nodeId)
		return displayMsg?.content || ''
	}
	
	/**
	 * 清空状态
	 */
	function reset(): void {
		conversationFile.value = null
		rawMessages.value = []
		displayMessages.value = []
		editingStates.value = {}
		isProcessing.value = false
		processError.value = null
		routerSessionId.value = null
	}
	
	// ====== 补全事件订阅：用于抑制流式过程中的视图处理 ======
	try {
		Host.events.on(Completion.EVT_COMPLETION_CHUNK, ({ tag }: { tag?: string }) => { _markStreamStart(tag) })
		Host.events.on(Completion.EVT_COMPLETION_END, ({ tag }: { tag?: string }) => { _markStreamEnd(tag) })
		Host.events.on(Completion.EVT_COMPLETION_ERROR, ({ tag }: { tag?: string }) => { _markStreamEnd(tag) })
		Host.events.on(Completion.EVT_COMPLETION_ABORTED, ({ tag }: { tag?: string }) => { _markStreamEnd(tag) })
		// 补全保存后：将临时ID替换为真实节点ID，并写回最终内容到 rawMessages
		Host.events.on(Completion.EVT_COMPLETION_SAVED, ({ conversationFile: cf, node_id, content, tag }: any) => {
			try {
				if (!cf || cf !== conversationFile.value) return
				const raw = Array.isArray(rawMessages.value) ? rawMessages.value.slice() : []
				const idx = raw.findIndex(m => m && (m.id === tag || m.id === node_id))
				if (idx >= 0 && idx < raw.length && raw[idx]) {
					const prev = raw[idx] as any
					const newId = (typeof node_id === 'string' && node_id) ? node_id : (prev?.id || '')
					const nextRole = (prev?.role === 'user' || prev?.role === 'assistant' || prev?.role === 'system') ? prev.role : 'assistant'
					const nextContent = (typeof content === 'string') ? content : (prev?.content ?? '')
					raw[idx] = { id: newId || (prev?.id ?? ''), role: nextRole, content: nextContent }
				} else if (typeof node_id === 'string' && node_id) {
					// 若列表中不存在该消息，追加一条（兜底）
					raw.push({ id: node_id, role: 'assistant', content: (typeof content === 'string' ? content : '') })
				}
				rawMessages.value = raw
			} catch (_) {}
		})
	} catch {}

	// ========== 监听器 ==========
	
	// 监听原始消息变化，自动触发处理
	watch(
		() => rawMessages.value,
		async (newMessages) => {
			if (newMessages && newMessages.length > 0 && conversationFile.value) {
				// 流式期间不触发处理，待流结束统一处理
				if (activeStreamCount.value > 0) {
					// 延后到流式结束
					return
				}
				await processMessagesView()
			} else if ((newMessages || []).length === 0) {
				// 消息为空时清空显示
				displayMessages.value = []
				try {
					Host.events.emit('workflow.message.view.updated', {
						conversationFile: conversationFile.value,
						messages: displayMessages.value
					})
				} catch {}
			}
		},
		{ deep: true, immediate: true }
	)
	
	// ========== 配置状态监听（响应式更新）==========
	// 当预设/角色卡/世界书/正则规则/用户信息变化时，自动调用 processMessagesView
	// 排除：llmConfig 和插件开关
	
	// 防抖计时器，避免多个配置同时变化时重复调用
	let configChangeDebounceTimer: ReturnType<typeof setTimeout> | null = null
	const CONFIG_DEBOUNCE_MS = 100
	
	function scheduleConfigRefresh() {
		// 没有对话或没有消息时跳过
		if (!conversationFile.value || !rawMessages.value?.length) return
		// 流式期间跳过
		if (activeStreamCount.value > 0) return
		// 正在处理中跳过
		if (isProcessing.value) return
		
		if (configChangeDebounceTimer) {
			clearTimeout(configChangeDebounceTimer)
		}
		configChangeDebounceTimer = setTimeout(async () => {
			configChangeDebounceTimer = null
			try {
				await processMessagesView()
			} catch (err) {
				console.warn('[chatMessages] Config change refresh failed:', err)
			}
		}, CONFIG_DEBOUNCE_MS)
	}
	
	// 延迟初始化配置监听（避免循环依赖）
	let configWatchersInitialized = false
	function initConfigWatchers() {
		if (configWatchersInitialized) return
		configWatchersInitialized = true
		
		try {
			// 监听预设变化（meta 包含完整预设内容）
			const presetStore = usePresetStore()
			watch(
				() => presetStore.meta,
				() => { scheduleConfigRefresh() },
				{ deep: true }
			)
			
			// 监听角色卡变化
			const characterStore = useCharacterStore()
			watch(
				() => characterStore.meta,
				() => { scheduleConfigRefresh() },
				{ deep: true }
			)
			
			// 监听世界书变化（文件列表或内容）
			const worldBooksStore = useWorldBooksStore()
			watch(
				[() => worldBooksStore.currentWorldBookFiles, () => worldBooksStore.metas],
				() => { scheduleConfigRefresh() },
				{ deep: true }
			)
			
			// 监听正则规则变化
			const regexRulesStore = useRegexRulesStore()
			watch(
				[() => regexRulesStore.currentRegexRuleFiles, () => regexRulesStore.metas],
				() => { scheduleConfigRefresh() },
				{ deep: true }
			)
			
			// 监听用户信息变化
			const personaStore = usePersonaStore()
			watch(
				() => personaStore.meta,
				() => { scheduleConfigRefresh() },
				{ deep: true }
			)
			
			console.log('[chatMessages] Config watchers initialized')
		} catch (err) {
			console.warn('[chatMessages] Failed to init config watchers:', err)
		}
	}
	
	// 在 loadConversation 时初始化配置监听
	const originalLoadConversation = loadConversation
	async function loadConversationWithWatchers(file: string, initialMessages: Message[] = []): Promise<void> {
		// 首次调用时初始化配置监听
		initConfigWatchers()
		return originalLoadConversation(file, initialMessages)
	}
	
	return {
		// 状态
		conversationFile,
		rawMessages,
		displayMessages,
		isProcessing,
		processError,
		routerSessionId,
		editingStates,
		
		// 计算属性
		hasMessages,
		hasEditing,
		
		// 方法
		loadConversation: loadConversationWithWatchers,
		updateRawMessages,
		processMessagesView,
		startEdit,
		cancelEdit,
		finishEdit,
		isEditing,
		getMessageContent,
		reset,
	}
})

export default useMessagesStore