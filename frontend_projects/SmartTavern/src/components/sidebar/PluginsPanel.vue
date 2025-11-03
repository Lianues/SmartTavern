<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import Host from '@/workflow/core/host'
import { PluginLoader } from '@/workflow/loader.js'
import DataCatalog from '@/services/dataCatalog'

const props = defineProps({
  anchorLeft: { type: Number, default: 308 },
  width: { type: Number, default: 560 },
  zIndex: { type: Number, default: 59 },
  top: { type: Number, default: 64 },
  bottom: { type: Number, default: 12 },
  title: { type: String, default: '插件 Plugins' },
  // 预留：如需与当前会话绑定工作流策略，可透传 conversationFile
  conversationFile: { type: String, default: null },
})

const emit = defineEmits(['close','use','delete'])

const panelStyle = computed(() => ({
  position: 'fixed',
  left: props.anchorLeft + 'px',
  top: props.top + 'px',
  bottom: props.bottom + 'px',
  width: props.width + 'px',
  zIndex: String(props.zIndex),
}))

 // 插件清单：从后端扫描 plugins
 const plugins = ref([])

// 正在处理的条目（防止重复点击）
const pending = ref({})

/** 规范化插件 ID：使用文件路径派生稳定 ID，便于 load/unload */
function mkId(file) {
  const safe = String(file || '').replace(/[^a-zA-Z0-9:_\-./]/g, '_')
  return `plg:${safe}`
}

/** 判断是否已加载（基于派生的 id） */
function isLoaded(file) {
  try {
    const id = mkId(file)
    return PluginLoader?.has?.(id) === true
  } catch (_) {
    return false
  }
}

async function onUse(dir) {
  const id = mkId(dir)
  if (pending.value[id]) return
  pending.value[id] = true
  try {
    await PluginLoader.loadPluginByDir(String(dir).replace(/\\/g, '/'), { id, replace: true })
    Host.pushToast?.({ type: 'success', message: `已加载插件：${dir}`, timeout: 1800 })
    emit('use', dir)
  } catch (e) {
    console.warn('[PluginsPanel] load plugin failed:', e)
    Host.pushToast?.({ type: 'error', message: `加载失败：${e?.message || e}`, timeout: 2200 })
  } finally {
    delete pending.value[id]
    nextTick(() => { try { window?.lucide?.createIcons?.() } catch (_) {} })
  }
}

async function onUnload(dir) {
  const realId = mkId(dir)
  if (pending.value[realId]) return
  pending.value[realId] = true
  try {
    const ok = await PluginLoader.unload(realId)
    if (ok) {
      Host.pushToast?.({ type: 'info', message: `已卸载插件：${dir}`, timeout: 1600 })
      emit('delete', dir)
    } else {
      Host.pushToast?.({ type: 'warning', message: `未找到已加载的插件实例`, timeout: 1800 })
    }
  } catch (e) {
    console.warn('[PluginsPanel] unload plugin failed:', e)
    Host.pushToast?.({ type: 'error', message: `卸载失败：${e?.message || e}`, timeout: 2200 })
  } finally {
    delete pending.value[realId]
    nextTick(() => { try { window?.lucide?.createIcons?.() } catch (_) {} })
  }
}


function close(){ emit('close') }

const isLucide = (v) => typeof v === 'string' && /^[a-z\-]+$/.test(v)

// 拉取后端插件清单，并富化 icon（icon.png）
async function loadPlugins() {
  try {
    const sw = await DataCatalog.getPluginsSwitch()
    if (!Array.isArray(sw?.enabled)) {
      Host.pushToast?.({ type: 'error', message: '缺失插件开关文件（plugins_switch.json）', timeout: 2800 })
      plugins.value = []
      return
    }
    const enabledArr = sw.enabled.map(x => String(x))
    const enabledSet = new Set(enabledArr)

    const res = await DataCatalog.listPlugins() // backend: smarttavern/data_catalog/list_plugins
    const arr = Array.isArray(res?.items) ? res.items : []
    const errs = Array.isArray(res?.errors) ? res.errors : []
    for (const er of errs) {
      Host.pushToast?.({ type: 'warning', message: `插件目录缺失：${er?.file || ''}`, timeout: 2600 })
    }

    const items = await Promise.all(arr.map(async (it) => {
      const dir = String(it.dir || '')
      const name = it.name || (dir.split('/').pop() || '未命名')
      const desc = it.description || ''
      const plugName = dir.split('/').pop() || dir
      const obj = {
        key: dir,
        icon: 'puzzle',
        name,
        desc,
        dir,
        enabled: (enabledSet === null ? true : enabledSet.has(plugName)),
        avatarUrl: null,
      }
      // 目录 -> icon.png
      const iconPath = dir ? `${dir}/icon.png` : ''
      if (iconPath) {
        try {
          const { blob } = await DataCatalog.getPluginsAssetBlob(iconPath)
          obj.avatarUrl = URL.createObjectURL(blob)
        } catch (_) {
          // ignore; fallback emoji/lucide
        }
      }
      return obj
    }))
    plugins.value = items
  } catch (e) {
    console.warn('[PluginsPanel] loadPlugins failed:', e)
  } finally {
    nextTick(() => { try { window?.lucide?.createIcons?.() } catch (_) {} })
  }
}

onMounted(async () => {
  await loadPlugins()
  // 初次渲染后刷新图标
  setTimeout(() => { try { window?.lucide?.createIcons?.() } catch (_) {} }, 50)
})
onUnmounted(() => {})
async function onToggle(it) {
  const dir = String(it?.dir || it?.key || '')
  if (!dir) return
  const id = mkId(dir)
  if (pending.value[id]) return
  pending.value[id] = true

  const name = dir.split('/').pop() || dir
  const allNames = (plugins.value || []).map(x => (String(x.dir || x.key || '').split('/').pop() || x.name || ''))
  try {
    // 严格开关模式：必须存在并返回 enabled 数组
    const sw = await DataCatalog.getPluginsSwitch()
    if (!Array.isArray(sw?.enabled)) {
      Host.pushToast?.({ type: 'error', message: '缺失插件开关文件（plugins_switch.json）', timeout: 2800 })
      return
    }
    const set = new Set(sw.enabled.map(x => String(x)))

    let nextEnabled = []
    if (it.enabled) {
      // 禁用：从 enabled 删除
      set.delete(name)
      nextEnabled = Array.from(set)
      const nextDisabled = allNames.filter(n => nextEnabled.indexOf(n) === -1)
      await DataCatalog.updatePluginsSwitch({ enabled: nextEnabled, disabled: nextDisabled })
      await PluginLoader.unload(id)
      it.enabled = false
      Host.pushToast?.({ type: 'info', message: `已禁用插件：${name}`, timeout: 1600 })
    } else {
      // 启用：添加到 enabled
      set.add(name)
      nextEnabled = Array.from(set)
      const nextDisabled = allNames.filter(n => nextEnabled.indexOf(n) === -1)
      await DataCatalog.updatePluginsSwitch({ enabled: nextEnabled, disabled: nextDisabled })
      await PluginLoader.loadPluginByDir(dir, { id, replace: true })
      it.enabled = true
      Host.pushToast?.({ type: 'success', message: `已启用插件：${name}`, timeout: 1600 })
    }
  } catch (e) {
    console.warn('[PluginsPanel] toggle failed:', e)
    Host.pushToast?.({ type: 'error', message: `操作失败：${e?.message || e}`, timeout: 2200 })
  } finally {
    delete pending.value[id]
    nextTick(() => { try { window?.lucide?.createIcons?.() } catch (_) {} })
  }
}
</script>

<template>
  <div
    data-scope="plugins-view"
    class="wf-panel glass"
    :style="panelStyle"
  >
    <header class="wf-header">
      <div class="wf-title">
        <span class="wf-icon"><i data-lucide="puzzle"></i></span>
        {{ props.title }}
      </div>
      <button class="wf-close" type="button" title="关闭" @click="close">✕</button>
    </header>

    <CustomScrollbar class="wf-body">
      <div class="wf-hint">用于管理插件（后端 plugins 目录）：加载 / 卸载。</div>

      <div class="wf-list">
        <div
          v-for="it in plugins"
          :key="it.key"
          class="wf-card"
        >
          <div class="wf-main">
            <div class="wf-avatar">
              <img v-if="it.avatarUrl" :src="it.avatarUrl" alt="" class="wf-avatar-img" />
              <i v-else-if="isLucide(it.icon)" :data-lucide="it.icon"></i>
              <span v-else>{{ it.icon }}</span>
            </div>
            <div class="wf-texts">
              <div class="wf-name">{{ it.name }}</div>
              <div class="wf-desc">{{ it.desc }}</div>
            </div>
          </div>


          <div class="wf-actions">
            <button
              class="wf-btn"
              :class="{ active: it.enabled }"
              type="button"
              :disabled="pending[mkId(it.key)]"
              @click="onToggle(it)"
            >
              {{ it.enabled ? '已启用' : '启用' }}
            </button>
          </div>
        </div>
      </div>
    </CustomScrollbar>
  </div>
</template>

<style scoped>
.wf-panel {
  display: grid;
  grid-template-rows: auto 1fr;
  border-radius: var(--st-radius-lg);
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface));
  backdrop-filter: blur(8px) saturate(130%);
  -webkit-backdrop-filter: blur(8px) saturate(130%);
  box-shadow: var(--st-shadow-md);
  overflow: hidden;
}

/* Header */
.wf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(var(--st-border), 0.85);
}
.wf-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: rgb(var(--st-color-text));
}
.wf-icon i { width: 18px; height: 18px; display: inline-block; }
.wf-close {
  appearance: none;
  border: 1px solid rgba(var(--st-border), 0.9);
  background: rgb(var(--st-surface-2));
  border-radius: 4px;
  padding: 6px 8px;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.22,.61,.36,1), background .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
.wf-close:hover {
  background: rgb(var(--st-surface));
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

/* Body */
.wf-body {
  padding: 12px;
  overflow: hidden;
}
.wf-hint {
  font-size: 12px;
  color: rgba(var(--st-color-text), 0.7);
  margin-bottom: 8px;
}
.wf-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

/* Card */
.wf-card {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: stretch;
  border: 1px solid rgb(var(--st-border));
  border-radius: var(--st-radius-md);
  background: rgb(var(--st-surface));
  padding: 12px;
  height: 88px; /* 固定高度统一，超出内容省略 */
  overflow: hidden;
  transition: background .2s cubic-bezier(.22,.61,.36,1), border-color .2s cubic-bezier(.22,.61,.36,1), transform .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1);
}
.wf-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}

/* Left main */
.wf-main {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: center;
}
.wf-avatar {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: linear-gradient(135deg, rgba(var(--st-primary),0.12), rgba(var(--st-accent),0.12));
  border: 1px solid rgba(var(--st-border), 0.9);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.25);
}
.wf-avatar i { width: 18px; height: 18px; display: inline-block; }
.wf-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; }
.wf-texts { min-width: 0; }
.wf-name {
  font-weight: 700;
  color: rgb(var(--st-color-text));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wf-desc {
  margin-top: 4px;
  color: rgba(var(--st-color-text), 0.75);
  font-size: 12px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.wf-url {
  margin-top: 4px;
  font-family: var(--st-font-mono, 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);
  font-size: 11px;
  color: rgba(var(--st-color-text), 0.6);
  word-break: break-all;
}

/* Right actions */
.wf-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}
.wf-btn {
  appearance: none;
  border: 1px solid rgb(var(--st-border));
  background: rgb(var(--st-surface));
  color: rgb(var(--st-color-text));
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: transform .2s cubic-bezier(.22,.61,.36,1), box-shadow .2s cubic-bezier(.22,.61,.36,1), background .2s cubic-bezier(.22,.61,.36,1), border-color .2s cubic-bezier(.22,.61,.36,1);
  min-width: 64px;
  text-align: center;
}
.wf-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--st-shadow-sm);
}
.wf-btn.active {
  border-color: rgba(var(--st-primary), 0.5);
  background: rgba(var(--st-primary), 0.08);
}
.wf-btn.wf-danger {
  border-color: rgba(220, 38, 38, 0.5);
  color: rgb(var(--st-color-text));
  background: rgba(220, 38, 38, 0.06);
}
.wf-btn.wf-danger:hover {
  border-color: rgba(220, 38, 38, 0.7);
  background: rgba(220, 38, 38, 0.1);
}

@media (max-width: 640px) {
  .wf-card { grid-template-columns: 1fr; }
  .wf-actions { flex-direction: row; }
}
</style>