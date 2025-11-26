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
const characterOptions = ref([])
const personaOptions = ref([])
const regexOptions = ref([])
const worldbookOptions = ref([])
const llmConfigOptions = ref([])
 
const selectedPreset = ref('')
const selectedCharacter = ref('')
const selectedPersona = ref('')
const selectedRegex = ref('')
const selectedWorldbook = ref('')
const selectedLLMConfig = ref('')
 
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
          }))
          const head = { value: '', label: placeholder, file: '' }
          return required ? [head, ...opts] : [{ value: '', label: t('home.newChat.optional'), file: '' }, ...opts]
        }
        
        llmConfigOptions.value = mapOpts(results.llmConfigs, true, t('home.newChat.llmConfigPlaceholder'))
        presetOptions.value = mapOpts(results.presets, true, t('home.newChat.presetPlaceholder'))
        characterOptions.value = mapOpts(results.chars, true, t('home.newChat.characterPlaceholder'))
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
  const name = (newChatName.value ?? '').trim() || t('common.unknown')
  if (!selectedLLMConfig.value || !selectedPreset.value || !selectedCharacter.value || !selectedPersona.value) {
    newGameError.value = t('home.newChat.requiredError')
    return
  }
  if (nameDupByFile.value || nameDupByTitle.value) {
    newGameError.value = t('home.newChat.duplicateError')
    return
  }
  newGameError.value = ''
  const payload = {
    name,
    description: (newChatDesc.value ?? '').trim(),
    type: newChatType.value,
    llm_config: selectedLLMConfig.value,
    preset: selectedPreset.value,
    character: selectedCharacter.value,
    persona: selectedPersona.value,
    regex: selectedRegex.value || null,
    worldbook: selectedWorldbook.value || null,
  }

  if (newChatType.value === 'threaded') {
    // 调用后端创建初始对话 API（带提交等待动画）
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
      
      // 发送创建请求
      Host.events.emit(Conversation.EVT_CONVERSATION_CREATE_REQ, { payload, tag: createTag })
    } catch (e) {
      newGameError.value = e?.message || t('home.newChat.createFailed')
      submitting.value = false
    }
  } else {
    // 其他类型保持原行为
    emit('confirm', payload)
    emit('update:show', false)
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
    <div v-else-if="fetchError" class="form-error">{{ fetchError }}</div>

    <!-- 表单 -->
    <form v-else class="new-chat-form" @submit.prevent="onSubmit">
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
        <div id="name-warn" class="form-hint warn" aria-live="polite" v-if="nameReplaced">
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
        <textarea id="new-chat-desc" v-model="newChatDesc" :disabled="submitting" rows="3" :placeholder="t('home.newChat.descPlaceholder')"></textarea>
      </div>
 
      <div class="form-row">
        <label for="new-chat-llmconfig">{{ t('home.newChat.llmConfigLabel') }}</label>
        <select id="new-chat-llmconfig" v-model="selectedLLMConfig" :disabled="submitting">
          <option v-for="opt in llmConfigOptions" :key="opt.value" :value="opt.value" :disabled="opt.value === ''">{{ opt.label }}</option>
        </select>
      </div>

      <div class="form-row">
        <label for="new-chat-preset">{{ t('home.newChat.presetLabel') }}</label>
        <select id="new-chat-preset" v-model="selectedPreset" :disabled="submitting">
          <option v-for="opt in presetOptions" :key="opt.value" :value="opt.value" :disabled="opt.value === ''">{{ opt.label }}</option>
        </select>
      </div>

      <div class="form-row">
        <label for="new-chat-character">{{ t('home.newChat.characterLabel') }}</label>
        <select id="new-chat-character" v-model="selectedCharacter" :disabled="submitting">
          <option v-for="opt in characterOptions" :key="opt.value" :value="opt.value" :disabled="opt.value === ''">{{ opt.label }}</option>
        </select>
      </div>

      <div class="form-row">
        <label for="new-chat-persona">{{ t('home.newChat.personaLabel') }}</label>
        <select id="new-chat-persona" v-model="selectedPersona" :disabled="submitting">
          <option v-for="opt in personaOptions" :key="opt.value" :value="opt.value" :disabled="opt.value === ''">{{ opt.label }}</option>
        </select>
      </div>

      <div class="form-row">
        <label for="new-chat-regex">{{ t('home.newChat.regexLabel') }}</label>
        <select id="new-chat-regex" v-model="selectedRegex" :disabled="submitting">
          <option v-for="opt in regexOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>

      <div class="form-row">
        <label for="new-chat-worldbook">{{ t('home.newChat.worldbookLabel') }}</label>
        <select id="new-chat-worldbook" v-model="selectedWorldbook" :disabled="submitting">
          <option v-for="opt in worldbookOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>

      <div class="form-row">
        <label>{{ t('home.newChat.typeLabel') }}</label>
        <div class="type-options">
          <label class="type-option">
            <input type="radio" value="threaded" v-model="newChatType" :disabled="submitting" />
            <span>{{ t('home.newChat.typeThreaded') }}</span>
            <small>{{ t('home.newChat.typeThreadedSub') }}</small>
          </label>
          <label class="type-option">
            <input type="radio" value="sandbox" v-model="newChatType" :disabled="submitting" />
            <span>{{ t('home.newChat.typeSandbox') }}</span>
            <small>{{ t('home.newChat.typeSandboxSub') }}</small>
          </label>
        </div>
      </div>

      <div v-if="newGameError" class="form-error">{{ newGameError }}</div>

      <div class="form-actions">
        <button type="submit" class="btn primary" :disabled="submitting || nameDupByFile || nameDupByTitle">
          <span v-if="!submitting">{{ t('home.newChat.confirm') }}</span>
          <span v-else class="btn-loading"><span class="spinner spinner-sm" aria-hidden="true"></span> {{ t('home.newChat.creating') }}</span>
        </button>
        <button type="button" class="btn" :disabled="submitting" @click="onCancel">{{ t('home.newChat.cancel') }}</button>
      </div>
    </form>
  </ContentViewModal>
</template>

<style scoped>
.new-chat-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* 顶部加载块 */
.new-chat-loading {
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 40px 20px;
  color: rgba(var(--st-color-text), 0.9);
}
.loading-text { font-weight: 700; font-size: 14px; }
.spinner {
  width: 22px; height: 22px; border-radius: 50%;
  border: 3px solid currentColor; border-top-color: transparent;
  animation: st-spin 0.9s linear infinite;
  opacity: 0.9;
}
.spinner-sm { width: 16px; height: 16px; border-width: 2px; }
@keyframes st-spin { to { transform: rotate(360deg); } }
 
.new-chat-form .form-row label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: rgb(var(--st-color-text));
}
.new-chat-form .form-row input[type="text"] {
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--st-radius-md);
  border: 1px solid rgb(var(--st-border) / 0.9);
  background: rgb(var(--st-surface));
  color: rgb(var(--st-color-text));
  outline: none;
}
.new-chat-form .form-row input[type="text"]::placeholder {
  color: rgb(var(--st-color-text) / 0.55);
}
.new-chat-form .form-row textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--st-radius-md);
  border: 1px solid rgb(var(--st-border) / 0.9);
  background: rgb(var(--st-surface));
  color: rgb(var(--st-color-text));
  outline: none;
  resize: vertical;
}
.form-hint {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(var(--st-color-text), 0.65);
}
.form-hint.warn {
  color: rgb(245, 158, 11); /* 提醒色：amber-500 */
}
.new-chat-form .form-row select {
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--st-radius-md);
  border: 1px solid rgb(var(--st-border) / 0.9);
  background: rgb(var(--st-surface));
  color: rgb(var(--st-color-text));
  outline: none;
}
.new-chat-form .type-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
  gap: 12px;
}
@media (max-width: 720px) {
  .new-chat-form .type-options { grid-template-columns: 1fr; }
}
.new-chat-form .type-option {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  grid-template-areas:
    "radio title"
    "radio sub";
  align-items: center;
  column-gap: 10px;
  row-gap: 4px;
  padding: 12px;
  border-radius: var(--st-radius-lg);
  border: 1px solid rgb(var(--st-border) / 0.9);
  background: rgb(var(--st-surface) / 0.72);
  backdrop-filter: blur(6px) saturate(130%);
  -webkit-backdrop-filter: blur(6px) saturate(130%);
}
.new-chat-form .type-option input[type="radio"] {
  grid-area: radio;
  width: 16px;
  height: 16px;
  accent-color: rgb(var(--st-primary));
}
.new-chat-form .type-option span {
  grid-area: title;
  font-weight: 700;
  color: rgb(var(--st-color-text));
}
.new-chat-form .type-option small {
  grid-area: sub;
  font-size: 12px;
  color: rgb(var(--st-color-text) / 0.7);
}
.new-chat-form .form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 8px;
}
.new-chat-form .btn {
  appearance: none;
  border: 1px solid rgb(var(--st-border));
  background: rgb(var(--st-surface));
  padding: 10px 14px;
  border-radius: var(--st-radius-md);
  color: rgb(var(--st-color-text));
  cursor: pointer;
  transition: transform .12s ease, box-shadow .12s ease, background .12s ease, border-color .12s ease;
}
.new-chat-form .btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}
.new-chat-form .btn.primary {
  background: linear-gradient(135deg, rgb(var(--st-primary) / 1), rgb(var(--st-accent) / 1));
  color: var(--st-primary-contrast);
  border-color: transparent;
}
.btn-loading {
  display: inline-flex; align-items: center; gap: 8px;
}
.new-chat-form .form-error {
  margin-top: 4px;
  padding: 10px 12px;
  border-radius: var(--st-radius-md);
  border: 1px solid rgba(220, 38, 38, 0.6);
  background: rgba(220, 38, 38, 0.08);
  color: rgb(220, 38, 38);
  font-size: 13px;
}
</style>