<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import SandboxStage from '@/components/sandbox/SandboxStage.vue'
import { useChatSettingsStore } from '@/stores/chatSettings'
import DataCatalog from '@/services/dataCatalog'
import JSZip from 'jszip'
import { useI18n } from '@/locales'

const { t } = useI18n()
const chatSettingsStore = useChatSettingsStore()

// 状态管理
const loading = ref(true)
const error = ref<string | null>(null)
const htmlContent = ref('')
const baseUrl = ref('')

// 定义emit
const emit = defineEmits<{
  'update:loading': [value: boolean]
  'update:loadingMessage': [value: string]
  'ready': []
}>()

/**
 * 从zip文件中查找index.html
 * 遍历所有文件，找到最根层的index.html
 */
async function findIndexHtml(zip: JSZip): Promise<{ html: string; basePath: string } | null> {
  const files = Object.keys(zip.files).filter(name => {
    const fileObj = zip.files[name]
    return fileObj && !fileObj.dir
  })
  
  // 查找所有index.html文件（不区分大小写）
  const indexFiles = files.filter(name => {
    const basename = name.split('/').pop()?.toLowerCase()
    return basename === 'index.html' || basename === 'index.htm'
  })
  
  if (indexFiles.length === 0) {
    return null
  }
  
  // 按路径深度排序，选择最浅的那个
  indexFiles.sort((a, b) => {
    const depthA = a.split('/').length
    const depthB = b.split('/').length
    return depthA - depthB
  })
  
  const indexPath = indexFiles[0]
  
  if (!indexPath) {
    return null
  }
  
  const file = zip.files[indexPath]
  
  if (!file) {
    return null
  }
  
  const html = await file.async('text')
  // 获取基础路径（index.html所在目录）
  const lastSlashIndex = indexPath.lastIndexOf('/')
  const basePath = lastSlashIndex >= 0 ? indexPath.substring(0, lastSlashIndex + 1) : ''
  
  return { html, basePath }
}

/**
 * 加载sandbox项目
 */
async function loadSandbox() {
  loading.value = true
  error.value = null
  htmlContent.value = ''
  
  // 通知父组件显示加载动画
  emit('update:loading', true)
  emit('update:loadingMessage', t('app.loading.sandbox'))
  
  try {
    // 1. 获取当前对话的角色卡文件
    const characterFile = chatSettingsStore.characterFile
    
    if (!characterFile) {
      throw new Error('未找到角色卡配置')
    }
    
    // 2. 获取角色卡详情
    const characterDetail = await DataCatalog.getCharacterDetail(characterFile, { useCache: false })
    
    if (!characterDetail?.content) {
      throw new Error('角色卡数据加载失败')
    }
    
    // 3. 检查是否为sandbox类型
    if (characterDetail.content.type !== 'sandbox') {
      throw new Error('当前角色卡不是sandbox类型')
    }
    
    // 4. 构建sandbox.zip的路径
    // characterFile 格式: backend_projects/SmartTavern/data/characters/角色名/character.json
    const characterDir = characterFile.substring(0, characterFile.lastIndexOf('/'))
    const sandboxZipPath = `${characterDir}/sandbox.zip`
    
    // 5. 获取sandbox.zip文件
    const zipBlob = await DataCatalog.getDataAssetBlob(sandboxZipPath)
    
    // 6. 解压zip文件
    const zip = await JSZip.loadAsync(zipBlob.blob)
    
    // 7. 查找index.html
    const result = await findIndexHtml(zip)
    
    if (!result) {
      throw new Error('在压缩包中未找到index.html文件')
    }
    
    // 8. 设置HTML内容和基础路径
    htmlContent.value = result.html
    baseUrl.value = result.basePath
    
    // 通知视图已准备好
    emit('ready')
    // 关闭加载动画
    emit('update:loading', false)
    emit('update:loadingMessage', '')
    
  } catch (err: any) {
    console.error('[SandboxView] 加载失败:', err)
    error.value = err.message || '加载sandbox项目失败'
    // 出错时也要关闭加载动画
    emit('update:loading', false)
    emit('update:loadingMessage', '')
  } finally {
    loading.value = false
  }
}

// 监听角色卡变化，重新加载
watch(() => chatSettingsStore.characterFile, () => {
  loadSandbox()
})

// 组件挂载时加载
onMounted(() => {
  loadSandbox()
})
</script>

<template>
  <section data-scope="chat-sandbox" class="st-sandbox">
    <!-- 错误状态 -->
    <div v-if="error" class="sandbox-status error">
      <div class="status-icon">❌</div>
      <div class="status-text">{{ error }}</div>
      <button class="retry-button" @click="loadSandbox">重试</button>
    </div>
    
    <!-- 显示内容 -->
    <SandboxStage v-else-if="htmlContent" :html="htmlContent" :base-url="baseUrl" />
  </section>
</template>

<style scoped>
/* Sandbox container */
.st-sandbox {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--st-spacing-xl);
  margin: 0 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  position: relative;
  padding: 0;
}
.st-sandbox::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: var(--st-bg-sandbox);
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
  opacity: 1; /* 背景图始终全可见，遮罩由 ::after 控制 */
  /* 直接对背景图片层应用模糊（更稳定的实现） */
  filter: blur(var(--st-sandbox-bg-blur, 0px));
  will-change: filter;
  z-index: -1;
  pointer-events: none;
}
.st-sandbox::after {
  content: '';
  position: fixed;
  inset: 0;
  /* 主题自适应遮罩（不透明度独立为元素 opacity，避免动画终值跳跃） */
  background: rgb(var(--st-overlay-ink));
  opacity: var(--st-sandbox-bg-opacity, 0.12);
  /* 对背景图片应用可调模糊（通过遮罩层的 backdrop-filter 实现） */
  backdrop-filter: blur(var(--st-sandbox-bg-blur, 0px));
  -webkit-backdrop-filter: blur(var(--st-sandbox-bg-blur, 0px));
  z-index: -1;
  pointer-events: none;
  /* 为 overlay 动画提供目标变量（沙盒页） */
  --st-target-bg-opacity: var(--st-sandbox-bg-opacity, 0.12);
}

/* 状态显示 */
.sandbox-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--st-spacing-2xl);
  padding: var(--st-spacing-5xl) var(--st-spacing-4xl);
  background: rgb(var(--st-surface) / var(--st-status-card-bg-opacity, 0.85));
  backdrop-filter: blur(var(--st-status-card-blur, 12px));
  -webkit-backdrop-filter: blur(var(--st-status-card-blur, 12px));
  border-radius: var(--st-radius-2xl);
  border: var(--st-status-card-border-width, 1px) solid rgb(var(--st-primary) / var(--st-status-card-border-opacity, 0.2));
  box-shadow: var(--st-status-card-shadow, 0 8px 32px rgba(0, 0, 0, 0.12));
  max-width: var(--st-status-card-max-width, 480px);
  text-align: center;
}

.sandbox-status.error {
  border-color: var(--st-status-card-error-border, rgb(239, 68, 68, 0.3));
}

.status-icon {
  font-size: var(--st-status-icon-size, 64px);
  line-height: var(--st-status-icon-line-height, 1);
  opacity: var(--st-status-icon-opacity, 0.9);
}

.status-text {
  font-size: var(--st-font-lg);
  font-weight: var(--st-status-text-font-weight, 500);
  color: rgb(var(--st-color-text));
  line-height: var(--st-status-text-line-height, 1.6);
}

.retry-button {
  margin-top: var(--st-spacing-md);
  padding: var(--st-spacing-lg) var(--st-spacing-3xl);
  background: rgb(var(--st-primary) / var(--st-retry-btn-bg-opacity, 0.12));
  border: var(--st-retry-btn-border-width, 1px) solid rgb(var(--st-primary) / var(--st-retry-btn-border-opacity, 0.3));
  border-radius: var(--st-radius-lg);
  color: rgb(var(--st-color-text));
  font-size: var(--st-font-md);
  font-weight: var(--st-retry-btn-font-weight, 500);
  cursor: pointer;
  transition: all var(--st-transition-normal) ease;
}

.retry-button:hover {
  background: rgb(var(--st-primary) / var(--st-retry-btn-hover-bg-opacity, 0.2));
  border-color: rgb(var(--st-primary) / var(--st-retry-btn-hover-border-opacity, 0.5));
  transform: translateY(var(--st-retry-btn-hover-lift, -1px));
}

.retry-button:active {
  transform: translateY(0);
}
</style>