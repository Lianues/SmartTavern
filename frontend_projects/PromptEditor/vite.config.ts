import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 从项目根的 modularflow_config.py 中读取 FRONTEND_PORT
 * - 若读取失败则回退到 5178（与 modularflow_config.py 的默认一致）
 */
function getFrontendPortFromPythonConfig(): number | null {
  try {
    const rootDir = fileURLToPath(new URL('.', import.meta.url))
    const configPath = path.resolve(rootDir, 'modularflow_config.py')
    if (!fs.existsSync(configPath)) return null
    const txt = fs.readFileSync(configPath, 'utf-8')
    const m = txt.match(/(^|\n)\s*FRONTEND_PORT\s*=\s*([0-9]+)\s*(#.*)?$/m)
    if (!m) return null
    const n = Number(m[2])
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

const FRONTEND_PORT = getFrontendPortFromPythonConfig() ?? 5178

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: FRONTEND_PORT,
    // 仅监听本地回环地址，不对外暴露网络接口
    host: '127.0.0.1',
    // 若端口被占用，则自动选择下一个可用端口；如需强制，请改为 strictPort: true
    strictPort: false,
  },
})
