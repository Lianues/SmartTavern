<script setup>
import { ref, watch, nextTick, onBeforeUnmount, computed } from 'vue'
import ContentViewModal from '@/components/common/ContentViewModal.vue'
import Host from '@/workflow/core/host'
import * as Catalog from '@/workflow/channels/catalog'
import * as Conversation from '@/workflow/channels/conversation'
import { useI18n } from '@/locales'

const { t } = useI18n()
 
const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
  icon: { type: String, default: '' },
})

const effectiveTitle = computed(() => props.title || t('home.newChat.title'))
 
const emit = defineEmits(['update:show', 'confirm', 'close'])
 
const newChatName = ref('')
const newChatDesc = ref('')
const nameReplaced = ref(false)
const newChatType = ref('threaded') // 'threaded' | 'sandbox'

// 已存在的对话：文件基名（不含扩展名）与内部 name
const existingFileBases = ref(new Set())
const existingTitles = ref(new Set())

// 重名检测状态
const nameDupByFile = ref(false)
const nameDupByTitle = ref(false)
 
// 下拉选项（运行时从后端装载）
const presetOptions = ref([])
const characterOptionsRaw = ref([])  // 原始角色卡列表
const personaOptions = ref([])
const regexOptions = ref([])
const worldbookOptions = ref([])
const llmConfigOptions = ref([])

// 根据对话类型筛选角色卡列表
const characterOptions = computed(() => {
  if (!newChatType.value) return characterOptionsRaw.value
  
  // 筛选匹配当前对话类型的角色卡
  return characterOptionsRaw.value.filter(opt => {
    // 如果角色卡没有type字段，视为兼容所有类型
    if (!opt.type) return true
    // 如果type匹配当前选择的对话类型，则显示
    return opt.type === newChatType.value
  })
})
 
const selectedPreset = ref('')
const selectedCharacter = ref('')
const selectedPersona = ref('')
const selectedRegex = ref('')
const selectedWorldbook = ref('')
const selectedLLMConfig = ref('')

// 监听对话类型变化，清空不匹配的角色卡选择
watch(newChatType, (newType) => {
  if (!selectedCharacter.value) return
  
  // 检查当前选择的角色卡是否匹配新的对话类型
  const currentChar = characterOptionsRaw.value.find(opt => opt.file === selectedCharacter.value)
  if (currentChar && currentChar.type && currentChar.type !== newType) {
    // 如果角色卡类型与新选择的对话类型不匹配，清空角色卡选择
    selectedCharacter.value = ''
  }
})
 
// 加载与提交状态
const loadingLists = ref(false)
const submitting = ref(false)
const fetchError = ref('')
const newGameError = ref('')

// 事件监听清理器
const __eventOffs = []

onBeforeUnmount(() => {
  try {
    __eventOffs?.forEach(fn => { try { fn?.() } catch (_) {} })
    __eventOffs.length = 0
  } catch (_) {}
})
 
function resetForm() {
  newChatName.value = ''
  newChatDesc.value = ''
  newChatType.value = 'threaded'
  selectedPreset.value = ''
  selectedCharacter.value = ''
  selectedPersona.value = ''
  selectedRegex.value = ''
  selectedWorldbook.value = ''
  selectedLLMConfig.value = ''
  newGameError.value = ''
  fetchError.value = ''
  existingFileBases.value = new Set()
  existingTitles.value = new Set()
  nameDupByFile.value = false
  nameDupByTitle.value = false
}
 
/**
 * 名称输入最小化清洗：禁止 / \ : * ? " < > |，避免路径问题
 * 其余字符保留，后端仍做最终安全处理与唯一化
 */
function toFileBase(n) {
  const s = String(n ?? '');
  return s.replace(/[\\/:*?"<>|]/g, '-').replace(/[ \.]+$/g, '').trim();
}
function validateName(n) {
  const base = toFileBase(n);
  nameDupByFile.value = !!base && existingFileBases.value?.has(base);
  const title = String(n ?? '').trim();
  nameDupByTitle.value = !!title && existingTitles.value?.has(title);
}

watch(newChatName, (v) => {
  if (v == null) return;
  const s = String(v);
  // 替换不允许字符，并去掉结尾的空格/点，避免路径问题
  const nv = s
    .replace(/[\\/:*?"<>|]/g, '-')   // 特殊字符 → “-”
    .replace(/[ \.]+$/g, '');        // 结尾空格与点移除
  nameReplaced.value = nv !== s;
  if (nv !== s) newChatName.value = nv;
  validateName(newChatName.value);
});

function baseName(file) {
  const s = String(file || '')
  const i = s.lastIndexOf('/')
  return i >= 0 ? s.slice(i + 1) : s
}
 
async function loadLists() {
  loadingLists.value = true
  fetchError.value = ''
  
  const tag = `load_lists_${Date.now()}`
  
  // 用于收集各类型数据
  const results = {
    presets: null,
    chars: null,
    personas: null,
    regex: null,
    worlds: null,
    llmConfigs: null,
    convs: null
  }
  
  let completed = 0
  const total = 7
  
  const checkComplete = () => {
    if (completed >= total) {
      try {
        const mapOpts = (res, required, placeholder) => {
          const items = Array.isArray(res?.items) ? res.items : []
          const opts = items.map(it => ({
            value: it.file,
            label: it.name || baseName(it.file),
            file: it.file,
            type: it.type || null,  // 保留type字段（角色卡类型）
          }))
          const head = { value: '', label: placeholder, file: '', type: null }
          return required ? [head, ...opts] : [{ value: '', label: t('home.newChat.optional'), file: '', type: null }, ...opts]
        }
        
        llmConfigOptions.value = mapOpts(results.llmConfigs, true, t('home.newChat.llmConfigPlaceholder'))
        presetOptions.value = mapOpts(results.presets, true, t('home.newChat.presetPlaceholder'))
        characterOptionsRaw.value = mapOpts(results.chars, true, t('home.newChat.characterPlaceholder'))
        personaOptions.value = mapOpts(results.personas, true, t('home.newChat.personaPlaceholder'))
        regexOptions.value = mapOpts(results.regex, false, t('home.newChat.optional'))
        worldbookOptions.value = mapOpts(results.worlds, false, t('home.newChat.optional'))

        // 组装重名检测集合
        const bases = new Set()
        const titles = new Set()
        const convItems = Array.isArray(results.convs?.items) ? results.convs.items : []
        convItems.forEach(it => {
          const f = String(it?.file || '')
          const bn = baseName(f).replace(/\.json$/i, '')
          if (bn) bases.add(bn)
          const nm = (it?.name ?? '').trim()
          if (nm) titles.add(nm)
        })
        existingFileBases.value = bases
        existingTitles.value = titles
        validateName(newChatName.value)

        nextTick(() => {
          try { window?.lucide?.createIcons?.() } catch (_) {}
          if (typeof window.initFlowbite === 'function') {
            try { window.initFlowbite() } catch (_) {}
          }
        })
      } catch (e) {
        fetchError.value = e?.message || t('home.newChat.listFailed')
      } finally {
        loadingLists.value = false
      }
    }
  }
  
  try {
    // 监听各类数据加载结果
    const offPresetOk = Host.events.on(Catalog.EVT_CATALOG_LIST_OK, ({ category, items, tag: resTag }) => {
      if (resTag !== tag) return
      if (category === 'preset') {
        results.presets = { items }
        completed++
        checkComplete()
      }
    })
    
    const offCharOk = Host.events.on(Catalog.EVT_CATALOG_LIST_OK, ({ category, items, tag: resTag }) => {
      if (resTag !== tag) return
      if (category === 'character') {
        results.chars = { items }
        completed++
        checkComplete()
      }
    })
    
    const offPersonaOk = Host.events.on(Catalog.EVT_CATALOG_LIST_OK, ({ category, items, tag: resTag }) => {
      if (resTag !== tag) return
      if (category === 'persona') {
        results.personas = { items }
        completed++
        checkComplete()
      }
    })
    
    const offRegexOk = Host.events.on(Catalog.EVT_CATALOG_LIST_OK, ({ category, items, tag: resTag }) => {
      if (resTag !== tag) return
      if (category === 'regex') {
        results.regex = { items }
        completed++
        checkComplete()
      }
    })
    
    const offWorldOk = Host.events.on(Catalog.EVT_CATALOG_LIST_OK, ({ category, items, tag: resTag }) => {
      if (resTag !== tag) return
      if (category === 'worldbook') {
        results.worlds = { items }
        completed++
        checkComplete()
      }
    })
    
    const offLLMOk = Host.events.on(Catalog.EVT_CATALOG_LIST_OK, ({ category, items, tag: resTag }) => {
      if (resTag !== tag) return
      if (category === 'llm_config') {
        results.llmConfigs = { items }
        completed++
        checkComplete()
      }
    })
    
    const offConvOk = Host.events.on(Conversation.EVT_CONVERSATION_LIST_OK, ({ items, tag: resTag }) => {
      if (resTag !== tag) return
      results.convs = { items }
      completed++
      checkComplete()
    })
    
    const offFail = Host.events.on(Catalog.EVT_CATALOG_LIST_FAIL, ({ message, tag: resTag }) => {
      if (resTag && resTag !== tag) return
      fetchError.value = message || t('home.newChat.listFailed')
      loadingLists.value = false
    })
    
    const offConvFail = Host.events.on(Conversation.EVT_CONVERSATION_LIST_FAIL, ({ message, tag: resTag }) => {
      if (resTag && resTag !== tag) return
      fetchError.value = message || t('home.newChat.convListFailed')
      loadingLists.value = false
    })
    
    __eventOffs.push(offPresetOk, offCharOk, offPersonaOk, offRegexOk, offWorldOk, offLLMOk, offConvOk, offFail, offConvFail)
    
    // 发送所有列表请求
    Host.events.emit(Catalog.EVT_CATALOG_LIST_REQ, { category: 'preset', tag })
    Host.events.emit(Catalog.EVT_CATALOG_LIST_REQ, { category: 'character', tag })
    Host.events.emit(Catalog.EVT_CATALOG_LIST_REQ, { category: 'persona', tag })
    Host.events.emit(Catalog.EVT_CATALOG_LIST_REQ, { category: 'regex', tag })
    Host.events.emit(Catalog.EVT_CATALOG_LIST_REQ, { category: 'worldbook', tag })
    Host.events.emit(Catalog.EVT_CATALOG_LIST_REQ, { category: 'llm_config', tag })
    Host.events.emit(Conversation.EVT_CONVERSATION_LIST_REQ, { tag })
  } catch (e) {
    fetchError.value = e?.message || t('home.newChat.listFailed')
    loadingLists.value = false
  }
}
 
watch(() => props.show, (v) => {
  if (v) {
    resetForm()
    loadLists()
  }
})
 
async function onSubmit() {
  const name = (newChatName.value ?? '').trim()

  // 必填字段：新对话名称 / 预设 / 角色卡 / 用户信息（persona）
  if (!name || !selectedPreset.value || !selectedCharacter.value || !selectedPersona.value) {
    newGameError.value = t('home.newChat.requiredError')
    return
  }

  // 重名校验
  if (nameDupByFile.value || nameDupByTitle.value) {
    newGameError.value = t('home.newChat.duplicateError')
    return
  }

  newGameError.value = ''
  const payload = {
    name,
    description: (newChatDesc.value ?? '').trim(),
    type: newChatType.value,
    // LLM 配置为可选：允许为空，由后端按需使用默认配置
    llm_config: selectedLLMConfig.value || null,
    preset: selectedPreset.value,
    character: selectedCharacter.value,
    persona: selectedPersona.value,
    regex: selectedRegex.value || null,
    worldbook: selectedWorldbook.value || null,
  }

  // 无论是 threaded 还是 sandbox，都调用后端创建对话 API
  submitting.value = true
  const createTag = `create_${Date.now()}`
  
  try {
    // 监听创建结果（一次性）
    const offOk = Host.events.on(Conversation.EVT_CONVERSATION_CREATE_OK, ({ result, tag: resTag }) => {
      if (resTag !== createTag) return
      
      // 将创建结果上抛：包含文件路径，便于上层后续打开该对话
      emit('confirm', { ...payload, ...result })
      emit('update:show', false)
      submitting.value = false
      
      try { offOk?.() } catch (_) {}
      try { offFail?.() } catch (_) {}
    })
    
    const offFail = Host.events.on(Conversation.EVT_CONVERSATION_CREATE_FAIL, ({ message, tag: resTag }) => {
      if (resTag && resTag !== createTag) return
      
      newGameError.value = message || t('home.newChat.createFailed')
      submitting.value = false
      
      try { offOk?.() } catch (_) {}
      try { offFail?.() } catch (_) {}
    })
    
    __eventOffs.push(offOk, offFail)
    
    // 发送创建请求（展开 payload，避免嵌套）
    Host.events.emit(Conversation.EVT_CONVERSATION_CREATE_REQ, { ...payload, tag: createTag })
  } catch (e) {
    newGameError.value = e?.message || t('home.newChat.createFailed')
    submitting.value = false
  }
}
 
function onCancel() {
  if (submitting.value) return
  emit('close')
  emit('update:show', false)
}
</script>

<template>
  <ContentViewModal
    :show="props.show"
    :title="effectiveTitle"
    :icon="props.icon"
    @update:show="(v) => emit('update:show', v)"
    @close="onCancel"
  >
    <!-- 加载中（与 LoadGame 一致的旋转等待风格） -->
    <div v-if="loadingLists" class="new-chat-loading">
      <div class="spinner" aria-hidden="true"></div>
      <div class="loading-text">{{ t('home.newChat.loading') }}</div>
    </div>

    <!-- 加载失败 -->
    <div v-else-if="fetchError" class="form-error" role="alert">{{ fetchError }}</div>

    <!-- 表单 -->
    <form v-else class="new-chat-form" @submit.prevent="onSubmit">
      <div class="new-chat-layout">
        <!-- 左侧：基础信息与类型 -->
        <section class="new-chat-panel new-chat-panel-main" aria-label="basic-settings">
          <header class="panel-header">
            <h2 class="panel-title">
              {{ t('home.newChat.title') }}
            </h2>
            <p class="panel-subtitle">
              {{ t('home.newChat.descPlaceholder') }}
            </p>
          </header>

          <div class="form-row">
            <label for="new-chat-name">{{ t('home.newChat.nameLabel') }}</label>
            <input
              id="new-chat-name"
              type="text"
              v-model="newChatName"
              :disabled="submitting"
              :placeholder="t('home.newChat.namePlaceholder')"
              aria-describedby="name-help name-warn"
            />
            <div id="name-help" class="form-hint">
              {{ t('home.newChat.nameHelp') }}
            </div>
            <div
              id="name-warn"
              class="form-hint warn"
              aria-live="polite"
              v-if="nameReplaced"
            >
              {{ t('home.newChat.nameReplaced') }}
            </div>
            <div class="form-hint warn" v-if="nameDupByFile">
              {{ t('home.newChat.nameDupFile', { name: toFileBase(newChatName) }) }}
            </div>
            <div class="form-hint warn" v-if="!nameDupByFile && nameDupByTitle">
              {{ t('home.newChat.nameDupTitle', { name: (newChatName || '').trim() }) }}
            </div>
          </div>

          <div class="form-row">
            <label for="new-chat-desc">{{ t('home.newChat.descLabel') }}</label>
            <textarea
              id="new-chat-desc"
              v-model="newChatDesc"
              :disabled="submitting"
              rows="3"
              :placeholder="t('home.newChat.descPlaceholder')"
            ></textarea>
          </div>

          <div class="form-row">
            <label>{{ t('home.newChat.typeLabel') }}</label>
            <div class="type-options">
              <label class="type-option">
                <input
                  class="type-radio"
                  type="radio"
                  value="threaded"
                  v-model="newChatType"
                  :disabled="submitting"
                />
                <div class="type-content">
                  <span class="type-title">{{ t('home.newChat.typeThreaded') }}</span>
                  <small class="type-subtitle">{{ t('home.newChat.typeThreadedSub') }}</small>
                </div>
              </label>
              <label class="type-option">
                <input
                  class="type-radio"
                  type="radio"
                  value="sandbox"
                  v-model="newChatType"
                  :disabled="submitting"
                />
                <div class="type-content">
                  <span class="type-title">{{ t('home.newChat.typeSandbox') }}</span>
                  <small class="type-subtitle">{{ t('home.newChat.typeSandboxSub') }}</small>
                </div>
              </label>
            </div>
          </div>
        </section>

        <!-- 右侧：对话配置选择 -->
        <section class="new-chat-panel new-chat-panel-config" aria-label="config-selection">
          <header class="panel-header">
            <h2 class="panel-title">
              {{ t('home.newChat.configPanelTitle') }}
            </h2>
            <p class="panel-subtitle">
              {{ t('home.newChat.configPanelSubtitle') }}
            </p>
          </header>

          <div class="panel-grid">
            <!-- 行1：预设 + 角色卡 -->
            <div class="form-row">
              <label for="new-chat-preset">{{ t('home.newChat.presetLabel') }}</label>
              <select
                id="new-chat-preset"
                v-model="selectedPreset"
                :disabled="submitting"
              >
                <option
                  v-for="opt in presetOptions"
                  :key="opt.value"
                  :value="opt.value"
                  :disabled="opt.value === ''"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="form-row">
              <label for="new-chat-character">{{ t('home.newChat.characterLabel') }}</label>
              <select
                id="new-chat-character"
                v-model="selectedCharacter"
                :disabled="submitting"
              >
                <option
                  v-for="opt in characterOptions"
                  :key="opt.value"
                  :value="opt.value"
                  :disabled="opt.value === ''"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <!-- 行2：用户信息 + 正则 -->
            <div class="form-row">
              <label for="new-chat-persona">{{ t('home.newChat.personaLabel') }}</label>
              <select
                id="new-chat-persona"
                v-model="selectedPersona"
                :disabled="submitting"
              >
                <option
                  v-for="opt in personaOptions"
                  :key="opt.value"
                  :value="opt.value"
                  :disabled="opt.value === ''"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="form-row">
              <label for="new-chat-regex">{{ t('home.newChat.regexLabel') }}</label>
              <select
                id="new-chat-regex"
                v-model="selectedRegex"
                :disabled="submitting"
              >
                <option
                  v-for="opt in regexOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <!-- 行3：世界书 + AI 配置 -->
            <div class="form-row">
              <label for="new-chat-worldbook">{{ t('home.newChat.worldbookLabel') }}</label>
              <select
                id="new-chat-worldbook"
                v-model="selectedWorldbook"
                :disabled="submitting"
              >
                <option
                  v-for="opt in worldbookOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="form-row">
              <label for="new-chat-llmconfig">{{ t('home.newChat.llmConfigLabel') }}</label>
              <select
                id="new-chat-llmconfig"
                v-model="selectedLLMConfig"
                :disabled="submitting"
              >
                <option
                  v-for="opt in llmConfigOptions"
                  :key="opt.value"
                  :value="opt.value"
                  :disabled="opt.value === ''"
                >
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>
        </section>
      </div>

      <div
        v-if="newGameError"
        class="form-error"
        role="alert"
      >
        {{ newGameError }}
      </div>

      <div class="form-actions">
        <button
          type="submit"
          class="btn primary"
          :disabled="submitting || nameDupByFile || nameDupByTitle"
        >
          <span v-if="!submitting">{{ t('home.newChat.confirm') }}</span>
          <span v-else class="btn-loading">
            <span class="spinner spinner-sm" aria-hidden="true"></span>
            {{ t('home.newChat.creating') }}
          </span>
        </button>
        <button
          type="button"
          class="btn"
          :disabled="submitting"
          @click="onCancel"
        >
          {{ t('home.newChat.cancel') }}
        </button>
      </div>
    </form>
  </ContentViewModal>
</template>

<style scoped>
.new-chat-loading {
  display: grid;
  place-items: center;
  gap: var(--st-spacing-md);
  padding: 40px var(--st-spacing-4xl);
  text-align: center;
  color: #000000;
}

[data-theme="dark"] .new-chat-loading {
  color: #ffffff;
}

.loading-text {
  font-weight: 700;
  font-size: var(--st-font-xl);
}

.spinner {
  width: var(--st-icon-3xl);
  height: var(--st-icon-3xl);
  border-radius: var(--st-radius-full);
  border: 4px solid currentColor;
  border-top-color: transparent;
  animation: st-spin 0.9s linear infinite;
  opacity: 0.9;
}

.spinner-sm {
  width: var(--st-icon-lg);
  height: var(--st-icon-lg);
  border-width: 2px;
}

@keyframes st-spin {
  to {
    transform: rotate(360deg);
  }
}

.new-chat-form {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-4xl);
  color: #000000;
}

[data-theme="dark"] .new-chat-form {
  color: #ffffff;
}

.new-chat-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 2fr);
  gap: var(--st-spacing-4xl);
}

@media (max-width: 1024px) {
  .new-chat-layout {
    grid-template-columns: 1fr;
  }
}

.new-chat-panel {
  position: relative;
  padding: var(--st-spacing-4xl) var(--st-spacing-3xl);
  border-radius: var(--st-radius-lg);
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.94),
    rgba(242, 242, 246, 0.98)
  );
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(var(--st-blur-lg)) saturate(130%);
  -webkit-backdrop-filter: blur(var(--st-blur-lg)) saturate(130%);
}

[data-theme="dark"] .new-chat-panel {
  border-color: rgba(255, 255, 255, 0.14);
  background: linear-gradient(
    145deg,
    rgba(20, 20, 24, 0.96),
    rgba(32, 32, 38, 0.98)
  );
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85);
}

.new-chat-panel-main {
  align-self: stretch;
}

.new-chat-panel-config {
  align-self: stretch;
  display: flex;
  flex-direction: column;
}

.panel-header {
  margin-bottom: var(--st-spacing-3xl);
}

.panel-title {
  font-size: var(--st-font-3xl);
  line-height: 28px;
  font-weight: 700;
}

.panel-subtitle {
  margin-top: var(--st-spacing-md);
  font-size: var(--st-font-md);
  line-height: 24px;
  opacity: 0.82;
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--st-spacing-2xl) var(--st-spacing-3xl);
  flex: 1;
  align-content: start;
}

/* 右侧配置区：使用 grid 的行间距，不再让第二列额外下移 */
.new-chat-panel-config .panel-grid .form-row + .form-row {
  margin-top: 0;
}

@media (max-width: 1024px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-md);
}

.form-row + .form-row {
  margin-top: var(--st-spacing-3xl);
}

.form-row label {
  font-weight: 600;
  font-size: var(--st-font-md);
}

.form-row input[type="text"],
.form-row textarea,
.form-row select {
  width: 100%;
  padding: var(--st-spacing-input-md);
  border-radius: var(--st-radius-lg);
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.96);
  color: #000000;
  outline: none;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    background-color 0.16s ease,
    transform 0.12s ease;
}

/* 描述输入框禁用拖拽调整，避免挤压下方按钮区域 */
.form-row textarea {
  resize: none;
}

[data-theme="dark"] .form-row input[type="text"],
[data-theme="dark"] .form-row textarea,
[data-theme="dark"] .form-row select {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(18, 18, 22, 0.96);
  color: #ffffff;
}

.form-row input[type="text"]::placeholder,
.form-row textarea::placeholder {
  color: #000000;
  opacity: 0.45;
}

[data-theme="dark"] .form-row input[type="text"]::placeholder,
[data-theme="dark"] .form-row textarea::placeholder {
  color: #ffffff;
  opacity: 0.5;
}

.form-row input[type="text"]:focus,
.form-row textarea:focus,
.form-row select:focus {
  border-color: #000000;
  box-shadow: 0 0 0 1px #000000;
  background: #ffffff;
  transform: translateY(-1px);
}

[data-theme="dark"] .form-row input[type="text"]:focus,
[data-theme="dark"] .form-row textarea:focus,
[data-theme="dark"] .form-row select:focus {
  border-color: #ffffff;
  box-shadow: 0 0 0 1px #ffffff;
  background: rgba(10, 10, 14, 1);
}

.form-hint {
  font-size: var(--st-font-sm);
  line-height: 20px;
  opacity: 0.9;
}

.form-hint.warn {
  position: relative;
  padding: var(--st-spacing-md) var(--st-spacing-lg);
  margin-top: var(--st-spacing-xs);
  border-radius: var(--st-radius-lg);
  background: rgba(0, 0, 0, 0.04);
  color: #000000;
}

.form-hint.warn::before {
  content: '!';
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--st-icon-md);
  height: var(--st-icon-md);
  border-radius: var(--st-radius-full);
  margin-right: var(--st-spacing-md);
  font-size: var(--st-font-sm);
  font-weight: 700;
  background: #000000;
  color: #ffffff;
}

[data-theme="dark"] .form-hint.warn {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

[data-theme="dark"] .form-hint.warn::before {
  background: #ffffff;
  color: #000000;
}

/* 类型切换 */
.type-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--st-spacing-xl);
}

@media (max-width: 720px) {
  .type-options {
    grid-template-columns: 1fr;
  }
}

.type-option {
  display: flex;
  align-items: stretch;
  gap: var(--st-spacing-xl);
  padding: var(--st-spacing-xl);
  border-radius: var(--st-radius-lg);
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.86);
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.12s ease;
}

[data-theme="dark"] .type-option {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(18, 18, 22, 0.9);
}

.type-option:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
}

[data-theme="dark"] .type-option:hover {
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.85);
}

.type-radio {
  width: var(--st-icon-lg);
  height: var(--st-icon-lg);
  margin-top: var(--st-spacing-xs);
}

.type-content {
  display: flex;
  flex-direction: column;
  gap: var(--st-spacing-xs);
}

.type-title {
  font-weight: 700;
  font-size: var(--st-font-md);
}

.type-subtitle {
  font-size: var(--st-font-sm);
  line-height: 20px;
  opacity: 0.86;
}

/* 高亮当前选择 */
.type-option:has(.type-radio:checked) {
  border-color: #000000;
  background: #000000;
  color: #ffffff;
}

[data-theme="dark"] .type-option:has(.type-radio:checked) {
  border-color: #ffffff;
  background: #ffffff;
  color: #000000;
}

/* 错误与操作区 */
.form-error {
  margin-top: var(--st-spacing-xs);
  padding: var(--st-spacing-xl) var(--st-spacing-xl);
  border-radius: var(--st-radius-lg);
  border: 1px solid #000000;
  background: rgba(0, 0, 0, 0.04);
  color: #000000;
  font-size: var(--st-font-base);
}

[data-theme="dark"] .form-error {
  border-color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.form-actions {
  display: flex;
  gap: var(--st-spacing-xl);
  justify-content: flex-end;
  margin-top: var(--st-spacing-md);
}

.btn {
  appearance: none;
  min-width: var(--st-btn-min-width-md);
  padding: var(--st-spacing-input-md);
  border-radius: var(--st-radius-lg);
  border: 1px solid rgba(0, 0, 0, 0.16);
  background: #ffffff;
  color: #000000;
  cursor: pointer;
  font-weight: 500;
  font-size: var(--st-font-md);
  line-height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--st-spacing-md);
  transition:
    transform 0.12s ease,
    box-shadow 0.16s ease,
    background-color 0.16s ease,
    border-color 0.16s ease;
}

[data-theme="dark"] .btn {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.26);
}

[data-theme="dark"] .btn:hover:not(:disabled) {
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.9);
}

.btn.primary {
  background: linear-gradient(135deg, #111111, #000000);
  color: #ffffff;
  border-color: #000000;
}

[data-theme="dark"] .btn.primary {
  background: linear-gradient(135deg, #ffffff, #e5e5e5);
  color: #000000;
  border-color: #ffffff;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.btn-loading {
  display: inline-flex;
  align-items: center;
  gap: var(--st-spacing-md);
}
</style>