import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.mount('#app')

// 初始化 Lucide 图标（挂载后）
nextTick(() => {
  (window as any).lucide?.createIcons?.()
})
