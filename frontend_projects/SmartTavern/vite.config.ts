import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    // 提高 chunk 大小警告阈值到 1000kb
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // 手动配置代码分块策略
        manualChunks: {
          // Vue 核心库
          'vue-vendor': ['vue', 'vue-router'],
          // Pinia 状态管理
          'pinia-vendor': ['pinia'],
          // 工作流核心（dataCatalog 和 host 会被多处引用）
          'workflow-core': [
            './src/services/dataCatalog.ts',
            './src/workflow/core/host.ts',
            './src/stores/chatVariables.ts'
          ],
        },
      },
    },
  },
})