<template>
  <iframe
    ref="frame"
    class="st-iframe"
    :sandbox="sandbox"
    :allow="allow"
    allowfullscreen
    :srcdoc="computedSrcdoc"
    :style="autoHeight && heightPx > 0 ? { height: heightPx + 'px' } : null">
  </iframe>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch, onBeforeUnmount, nextTick } from 'vue'
import { generateSandboxBridgeScript } from '@/utils/sandboxBridge'

const props = defineProps({
  html: { type: String, default: '' },
  baseUrl: { type: String, default: '' },
  sandbox: { type: String, default: 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox allow-presentation allow-pointer-lock allow-orientation-lock allow-top-navigation-by-user-activation allow-storage-access-by-user-activation' },
  allow: { type: String, default: 'fullscreen *; clipboard-read *; clipboard-write *; geolocation *; microphone *; camera *; autoplay *; encrypted-media *; payment *; usb *; serial *; midi *; gyroscope *; magnetometer *; xr-spatial-tracking *; display-capture *; gamepad *; idle-detection *' },
  injectCss: { type: String, default: '' },
  csp: { type: String, default: '' },
  // 新增：自适应高度模式（默认开启）
  autoHeight: { type: Boolean, default: true }
})

const emit = defineEmits(['iframe-loaded'])

const frame = ref<HTMLIFrameElement | null>(null)
const heightPx = ref<number>(0)

let __ro: ResizeObserver | null = null
let __onLoad: ((this: HTMLIFrameElement, ev: Event) => any) | null = null

const computedSrcdoc = computed(() => {
  const base = props.baseUrl ? `<base href="${props.baseUrl}">` : ''
  const csp = props.csp ? `<meta http-equiv="Content-Security-Policy" content="${props.csp}">` : ''
  const injected = props.injectCss ? `<style>${props.injectCss}</style>` : ''
  const normalize = props.autoHeight
    ? `<style>html,body{min-height:100%;margin:0;padding:0;background:transparent}</style>`
    : `<style>html,body{height:100%;margin:0;padding:0;background:transparent}</style>`
  // 注入沙盒桥接脚本（优先于用户 HTML，使API立即可用）
  // 使用字符串拼接避免 Vue SFC 编译器误判闭合标签
  const scriptOpen = '<' + 'script>'
  const scriptClose = '<' + '/script>'
  const bridgeScript = scriptOpen + generateSandboxBridgeScript() + scriptClose
  return `<!doctype html><html><head><meta charset="utf-8">${csp}${base}${normalize}${injected}${bridgeScript}</head><body>${props.html}</body></html>`
})

function __measure() {
  if (!props.autoHeight) return
  const f = frame.value
  const doc = f?.contentDocument
  const de = doc?.documentElement
  const body = doc?.body
  if (!doc || !de || !body) return
  const h = Math.max(
    body.scrollHeight,
    de.scrollHeight,
    body.offsetHeight,
    de.offsetHeight,
    body.getBoundingClientRect().height
  )
  heightPx.value = Math.max(1, Math.round(h))
}

function __disposeObservers() {
  if (__ro) {
    try { __ro.disconnect() } catch (_) {}
    __ro = null
  }
}

function __setupObservers() {
  __disposeObservers()
  if (!props.autoHeight) return
  const f = frame.value
  const doc = f?.contentDocument
  const de = doc?.documentElement
  const body = doc?.body
  if (!doc || !de || !body) return
  // 使用 iframe 内文档的 ResizeObserver 监听 body 尺寸变化
  const RO = (f!.contentWindow as any)?.ResizeObserver || ResizeObserver
  __ro = new RO(() => __measure())
  if (__ro) {
    try {
      __ro.observe(body)
      __ro.observe(de)
    } catch (_) {}
  }
  // 初始测量
  __measure()
}

onMounted(() => {
  const f = frame.value
  if (!f) return
  __onLoad = () => {
    // srcdoc 变化会触发 load，重新建立观察
    __setupObservers()
    // 再次测量，确保首次绘制后校准
    nextTick(() => {
      __measure()
      // 发出iframe加载完成事件
      emit('iframe-loaded')
    })
  }
  f.addEventListener('load', __onLoad)
  // 如果 iframe 已经就绪，尝试设置一次
  nextTick(() => __setupObservers())
})

onBeforeUnmount(() => {
  const f = frame.value
  if (f && __onLoad) {
    try { f.removeEventListener('load', __onLoad) } catch (_) {}
  }
  __onLoad = null
  __disposeObservers()
})

// 当 html 更新，等待 load 回调重建观察；这里清零高度避免短暂旧高度残留
watch(() => props.html, () => {
  if (props.autoHeight) heightPx.value = 0
})
</script>

<style scoped>
.st-iframe {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: inherit;
  background: transparent;
  display: block;
}
</style>