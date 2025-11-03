// SmartTavern Composable: useSidebar (v1)
// 作用：管理侧边抽屉的开关状态，并在本地持久化（localStorage），避免刷新丢失。
// 集成方式（示例）：
//   import { useSidebar } from '@/composables/useSidebar'
//   const { drawerOpen } = useSidebar()

import { ref, watch, onMounted, type Ref } from 'vue'

const LS_KEY = 'st.sidebar.open'

export interface UseSidebarAPI {
  drawerOpen: Ref<boolean>
}

export function useSidebar(): UseSidebarAPI {
  const drawerOpen = ref<boolean>(false)

  // 初始化：读取持久化的开关状态
  onMounted(() => {
    try {
      const v = localStorage.getItem(LS_KEY)
      if (v === '1') drawerOpen.value = true
      if (v === '0') drawerOpen.value = false
    } catch (_) {
      // Ignore errors
    }
  })

  // 监听：状态变化即写回浏览器
  watch(drawerOpen, (v) => {
    try { 
      localStorage.setItem(LS_KEY, v ? '1' : '0') 
    } catch (_) {
      // Ignore errors
    }
  }, { immediate: false })

  return {
    drawerOpen,
  }
}

export default useSidebar