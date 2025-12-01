<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from '@/locales'
import StylesService from '@/services/stylesService'
import BackgroundsManager from '@/features/backgrounds/manager'
import type { PageName, Orientation } from '@/services/backgroundsService'

const { t } = useI18n()

/**
 * 背景图片管理（横版/竖版分别管理）
 * - 使用后端 API 加载和上传图片
 * - 支持横版（landscape）和竖版（portrait）独立管理
 * - 上传后自动刷新背景
 */

interface BackgroundInfo {
  file: string | null
  hash: string | null
  size: number
  preview: string | null
}

interface BackgroundState {
  landscape: Record<PageName, BackgroundInfo>
  portrait: Record<PageName, BackgroundInfo>
  loading: boolean
  uploading: Record<string, boolean>
}

const state = ref<BackgroundState>({
  landscape: {
    HomePage: { file: null, hash: null, size: 0, preview: null },
    ThreadedChat: { file: null, hash: null, size: 0, preview: null },
    SandboxChat: { file: null, hash: null, size: 0, preview: null },
  },
  portrait: {
    HomePage: { file: null, hash: null, size: 0, preview: null },
    ThreadedChat: { file: null, hash: null, size: 0, preview: null },
    SandboxChat: { file: null, hash: null, size: 0, preview: null },
  },
  loading: true,
  uploading: {},
})

const pages: Array<{ key: PageName; labelKey: string }> = [
  { key: 'HomePage', labelKey: 'appearance.backgrounds.startPage' },
  { key: 'ThreadedChat', labelKey: 'appearance.backgrounds.threadedPage' },
  { key: 'SandboxChat', labelKey: 'appearance.backgrounds.sandboxPage' },
]

/**
 * 从持久化缓存加载图片
 */
async function loadImageFromCache(hash: string): Promise<string | null> {
  try {
    const cached = localStorage.getItem(`st:bg:${hash}`)
    if (cached) {
      // 验证缓存的 blob URL 是否仍然有效
      try {
        const response = await fetch(cached)
        if (response.ok) {
          console.info(`[BackgroundsManager] Using cached blob URL for hash: ${hash}`)
          return cached
        }
      } catch {
        // blob URL 已失效，清除缓存
        localStorage.removeItem(`st:bg:${hash}`)
      }
    }
  } catch (err) {
    console.warn(`[BackgroundsManager] Failed to load from cache:`, err)
  }
  return null
}

/**
 * 保存图片到持久化缓存
 */
function saveImageToCache(hash: string, blobUrl: string): void {
  try {
    localStorage.setItem(`st:bg:${hash}`, blobUrl)
    console.info(`[BackgroundsManager] Saved to cache: ${hash}`)
  } catch (err) {
    console.warn(`[BackgroundsManager] Failed to save to cache:`, err)
  }
}

/**
 * 加载背景图片信息（优化版：先获取哈希，再决定是否下载）
 */
async function loadBackgrounds(): Promise<void> {
  state.value.loading = true
  try {
    // 步骤1：获取所有背景图片的哈希值
    const hashResponse = await StylesService.getPageBackgroundsHash()
    
    // 步骤2：加载横版预览
    for (const page of pages) {
      const hash = hashResponse.landscape?.[page.key]
      if (hash) {
        // 先尝试从缓存加载
        const cachedUrl = await loadImageFromCache(hash)
        if (cachedUrl) {
          state.value.landscape[page.key] = {
            file: `${page.key}_landscape.png`,
            hash,
            size: 0,
            preview: cachedUrl,
          }
          console.info(`[BackgroundsManager] Loaded landscape from cache: ${page.key} (${hash})`)
        } else {
          // 缓存未命中，从后端下载
          try {
            const { blob, size } = await StylesService.getPageBackgroundBlob(page.key, 'landscape')
            const url = URL.createObjectURL(blob)
            state.value.landscape[page.key] = {
              file: `${page.key}_landscape.png`,
              hash,
              size,
              preview: url,
            }
            saveImageToCache(hash, url)
            console.info(`[BackgroundsManager] Downloaded and cached landscape: ${page.key} (${hash})`)
          } catch (err) {
            console.warn(`[BackgroundsManager] Failed to load landscape: ${page.key}`, err)
          }
        }
      }
    }
    
    // 步骤3：加载竖版预览
    for (const page of pages) {
      const hash = hashResponse.portrait?.[page.key]
      if (hash) {
        // 先尝试从缓存加载
        const cachedUrl = await loadImageFromCache(hash)
        if (cachedUrl) {
          state.value.portrait[page.key] = {
            file: `${page.key}_portrait.png`,
            hash,
            size: 0,
            preview: cachedUrl,
          }
          console.info(`[BackgroundsManager] Loaded portrait from cache: ${page.key} (${hash})`)
        } else {
          // 缓存未命中，从后端下载
          try {
            const { blob, size } = await StylesService.getPageBackgroundBlob(page.key, 'portrait')
            const url = URL.createObjectURL(blob)
            state.value.portrait[page.key] = {
              file: `${page.key}_portrait.png`,
              hash,
              size,
              preview: url,
            }
            saveImageToCache(hash, url)
            console.info(`[BackgroundsManager] Downloaded and cached portrait: ${page.key} (${hash})`)
          } catch (err) {
            console.warn(`[BackgroundsManager] Failed to load portrait: ${page.key}`, err)
          }
        }
      }
    }
  } catch (err) {
    console.error('[BackgroundsManager] Failed to load backgrounds:', err)
  } finally {
    state.value.loading = false
  }
}

/**
 * 上传背景图片
 */
async function onFileChange(page: PageName, orientation: Orientation, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  
  const uploadKey = `${page}-${orientation}`
  state.value.uploading[uploadKey] = true
  
  try {
    const result = await StylesService.uploadPageBackgroundFromFile(page, orientation, file)
    
    if (!result.success) {
      throw new Error(result.error || result.message || '上传失败')
    }
    
    console.info(`[BackgroundsManager] Uploaded ${page} (${orientation}):`, result)
    
    // 更新状态并加载预览
    state.value[orientation][page] = {
      file: result.file,
      hash: result.hash,
      size: result.size,
      preview: null,
    }
    
    // 上传后重新加载该图片（使用哈希校验）
    if (result.hash) {
      try {
        const { blob } = await StylesService.getPageBackgroundBlob(page, orientation)
        const url = URL.createObjectURL(blob)
        state.value[orientation][page].preview = url
        saveImageToCache(result.hash, url)
        console.info(`[BackgroundsManager] Uploaded and cached: ${page} (${orientation}, hash: ${result.hash})`)
      } catch (err) {
        console.warn(`[BackgroundsManager] Failed to load preview after upload:`, err)
      }
    }
    
    // 刷新背景管理器（使新背景生效）
    await BackgroundsManager.refresh()
    
    // 清空输入框
    input.value = ''
  } catch (err) {
    console.error(`[BackgroundsManager] Failed to upload ${page} (${orientation}):`, err)
    alert(`上传失败: ${err}`)
  } finally {
    state.value.uploading[uploadKey] = false
  }
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

onMounted(() => {
  loadBackgrounds()
})
</script>

<template>
  <div class="st-tab-panel backgrounds-manager" data-scope="settings-backgrounds">
    <div class="panel-header">
      <h3>{{ t('appearance.backgrounds.title') }}</h3>
      <p class="muted">{{ t('appearance.backgrounds.desc') }}</p>
    </div>

    <div v-if="state.loading" class="loading-state">
      <div class="spinner"></div>
      <p>{{ t('common.loading') }}</p>
    </div>

    <div v-else class="backgrounds-grid">
      <!-- 每个页面一个卡片 -->
      <div v-for="page in pages" :key="page.key" class="page-card">
        <div class="page-title">{{ t(page.labelKey) }}</div>
        
        <!-- 横版图片 -->
        <div class="orientation-section">
          <div class="orientation-header">
            <span class="orientation-label">{{ t('appearance.backgrounds.landscape') }}</span>
            <span v-if="state.landscape[page.key].size > 0" class="file-size">
              {{ formatSize(state.landscape[page.key].size) }}
            </span>
          </div>
          <div class="bg-preview" :style="{ backgroundImage: state.landscape[page.key].preview ? `url(${state.landscape[page.key].preview})` : 'none' }">
            <div v-if="!state.landscape[page.key].file" class="no-image">
              {{ t('appearance.backgrounds.noImage') }}
            </div>
          </div>
          <div class="bg-actions">
            <label class="bg-upload" :class="{ uploading: state.uploading[`${page.key}-landscape`] }">
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                @change="onFileChange(page.key, 'landscape', $event)"
                :disabled="state.uploading[`${page.key}-landscape`]"
              />
              <span v-if="state.uploading[`${page.key}-landscape`]">
                {{ t('appearance.backgrounds.uploading') }}
              </span>
              <span v-else>
                {{ t('appearance.backgrounds.selectImage') }}
              </span>
            </label>
          </div>
        </div>

        <!-- 竖版图片 -->
        <div class="orientation-section">
          <div class="orientation-header">
            <span class="orientation-label">{{ t('appearance.backgrounds.portrait') }}</span>
            <span v-if="state.portrait[page.key].size > 0" class="file-size">
              {{ formatSize(state.portrait[page.key].size) }}
            </span>
          </div>
          <div class="bg-preview portrait" :style="{ backgroundImage: state.portrait[page.key].preview ? `url(${state.portrait[page.key].preview})` : 'none' }">
            <div v-if="!state.portrait[page.key].file" class="no-image">
              {{ t('appearance.backgrounds.noImage') }}
            </div>
          </div>
          <div class="bg-actions">
            <label class="bg-upload" :class="{ uploading: state.uploading[`${page.key}-portrait`] }">
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                @change="onFileChange(page.key, 'portrait', $event)"
                :disabled="state.uploading[`${page.key}-portrait`]"
              />
              <span v-if="state.uploading[`${page.key}-portrait`]">
                {{ t('appearance.backgrounds.uploading') }}
              </span>
              <span v-else>
                {{ t('appearance.backgrounds.selectImage') }}
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backgrounds-manager {
  padding: 1.5rem;
}

.panel-header {
  margin-bottom: 2rem;
}

.panel-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: rgb(var(--st-text-primary));
}

.panel-header .muted {
  font-size: 0.875rem;
  color: rgb(var(--st-text-secondary));
  margin: 0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid rgb(var(--st-border-subtle));
  border-top-color: rgb(var(--st-primary));
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.backgrounds-grid {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.page-card {
  background: rgb(var(--st-surface-secondary) / 0.5);
  border: 2px solid rgba(128, 128, 128, 0.3);
  border-radius: 0.75rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* 深色模式下的卡片边框 */
@media (prefers-color-scheme: dark) {
  .page-card {
    border-color: rgba(200, 200, 200, 0.2);
  }
}

[data-theme="dark"] .page-card {
  border-color: rgba(200, 200, 200, 0.2);
}

.page-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: rgb(var(--st-text-primary));
  margin-bottom: 0.5rem;
}

.orientation-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.orientation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.orientation-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--st-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.file-size {
  font-size: 0.75rem;
  color: rgb(var(--st-text-tertiary));
  font-family: 'Courier New', monospace;
}

.bg-preview {
  width: 100%;
  height: var(--st-bg-preview-height);
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  border-radius: var(--st-radius-md);
  border: 2px solid rgba(128, 128, 128, 0.5);
  position: relative;
  overflow: hidden;
  background-color: rgb(var(--st-surface-tertiary));
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 深色模式下使用浅色边框 */
@media (prefers-color-scheme: dark) {
  .bg-preview {
    border-color: rgba(200, 200, 200, 0.3);
  }
}

/* 通过 data 属性判断主题 */
[data-theme="dark"] .bg-preview {
  border-color: rgba(200, 200, 200, 0.3);
}

.no-image {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--st-font-sm);
  color: rgb(var(--st-text-tertiary));
  background: repeating-conic-gradient(
    rgb(var(--st-surface-tertiary)) 0% 25%,
    rgb(var(--st-surface-secondary)) 0% 50%
  );
  background-size: var(--st-bg-preview-checkerboard-size) var(--st-bg-preview-checkerboard-size);
  background-position: 0 0, 10px 10px;
}

.bg-actions {
  display: flex;
  gap: 0.5rem;
}

.bg-upload {
  flex: 1;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(var(--st-text-primary));
  background: rgb(var(--st-surface-secondary));
  border: 1px solid rgb(var(--st-border-default));
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
}

.bg-upload:hover {
  background: rgb(var(--st-surface-tertiary));
  border-color: rgb(var(--st-primary));
}

.bg-upload.uploading {
  opacity: 0.6;
  cursor: wait;
}

.bg-upload input[type="file"] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.bg-upload input[type="file"]:disabled {
  cursor: wait;
}
</style>