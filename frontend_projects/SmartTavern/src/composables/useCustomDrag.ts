/**
 * 自定义拖拽组合式函数
 * 
 * 提供支持滚轮的自定义拖拽实现，解决HTML5原生拖拽在拖拽过程中无法触发滚轮事件的问题
 * 
 * 功能特性：
 * - 拖拽时支持鼠标滚轮滚动
 * - 边缘自动滚动（内部慢速，外部快速）
 * - 自定义拖拽幽灵元素，显示条目标题
 * - 主题自适应的拖拽样式
 */

import { ref, type Ref } from 'vue'

interface DragState {
  id: string
  [key: string]: any
}

interface DragOptions {
  scrollContainerSelector?: string
  itemSelector?: string
  dataAttribute?: string
  edgeSize?: number
  insideMinSpeed?: number
  insideMaxSpeed?: number
  outsideSpeed?: number
  onReorder?: (draggedId: string, targetId: string | null, insertBefore: boolean) => void
  getTitleForItem?: (id: string) => string
}

export function useCustomDrag(options: DragOptions = {}) {
  const {
    scrollContainerSelector = '.modal-scroll .scroll-container2',
    itemSelector = '.draglist-item',
    dataAttribute = 'data-identifier',
    edgeSize = 80,
    insideMinSpeed = 2,
    insideMaxSpeed = 15,
    outsideSpeed = 25,
    onReorder,
    getTitleForItem = (id) => id
  } = options

  // 拖拽状态
  const dragging: Ref<DragState | null> = ref(null)
  const dragOverId = ref<string | null>(null)
  const dragOverBefore = ref(true)
  let dragGhost: HTMLElement | null = null
  let isDraggingActive = false
  let autoScrollInterval: number | null = null
  let currentScrollSpeed = 0
  let currentScrollDirection = 0

  // 创建拖拽幽灵元素
  function createDragGhost(title: string): HTMLElement {
    const ghost = document.createElement('div')
    ghost.className = 'drag-ghost'
    ghost.style.position = 'fixed'
    ghost.style.pointerEvents = 'none'
    ghost.style.zIndex = '10000'
    ghost.style.opacity = '0.9'
    ghost.style.transform = 'rotate(2deg)'
    
    // 使用CSS变量适配主题
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--st-drag-ghost-bg').trim() || 'rgba(255, 255, 255, 0.95)'
    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--st-drag-ghost-border').trim() || 'rgba(59, 130, 246, 0.8)'
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--st-drag-ghost-text').trim() || 'rgba(31, 41, 55, 0.95)'
    const shadowColor = getComputedStyle(document.documentElement).getPropertyValue('--st-drag-ghost-shadow').trim() || 'rgba(0, 0, 0, 0.25)'
    
    ghost.innerHTML = `<div style="background: ${bgColor}; border: 2px solid ${borderColor}; border-radius: 8px; padding: 10px 16px; box-shadow: 0 4px 16px ${shadowColor}; font-size: 14px; font-weight: 500; color: ${textColor}; max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; backdrop-filter: blur(8px);">${title || '拖拽中...'}</div>`
    document.body.appendChild(ghost)
    return ghost
  }

  // 更新拖拽幽灵元素位置
  function updateDragGhostPosition(clientX: number, clientY: number) {
    if (!dragGhost) return
    dragGhost.style.left = `${clientX + 10}px`
    dragGhost.style.top = `${clientY + 10}px`
  }

  // 滚轮事件处理器
  function handleWheelDuringDrag(ev: WheelEvent) {
    if (!isDraggingActive) return
    
    const scrollContainer = document.querySelector(scrollContainerSelector) as HTMLElement
    if (!scrollContainer) return
    
    ev.preventDefault()
    ev.stopPropagation()
    
    scrollContainer.scrollTop += ev.deltaY
  }

  // 更新边缘自动滚动的速度和方向
  function updateEdgeAutoScroll(mouseY: number) {
    const scrollContainer = document.querySelector(scrollContainerSelector) as HTMLElement
    if (!scrollContainer) {
      stopEdgeAutoScroll()
      return
    }
    
    const rect = scrollContainer.getBoundingClientRect()
    const distanceFromTop = mouseY - rect.top
    const distanceFromBottom = rect.bottom - mouseY
    
    let speed = 0
    let direction = 0
    
    // 检测是否在边缘区域
    if (distanceFromTop < 0) {
      // 鼠标在容器上方（外部）
      speed = outsideSpeed
      direction = -1
    } else if (distanceFromTop < edgeSize) {
      // 鼠标在容器顶部边缘（内部）
      const ratio = 1 - (distanceFromTop / edgeSize)
      speed = insideMinSpeed + (insideMaxSpeed - insideMinSpeed) * ratio
      direction = -1
    } else if (distanceFromBottom < 0) {
      // 鼠标在容器下方（外部）
      speed = outsideSpeed
      direction = 1
    } else if (distanceFromBottom < edgeSize) {
      // 鼠标在容器底部边缘（内部）
      const ratio = 1 - (distanceFromBottom / edgeSize)
      speed = insideMinSpeed + (insideMaxSpeed - insideMinSpeed) * ratio
      direction = 1
    }
    
    // 更新当前速度和方向
    currentScrollSpeed = speed
    currentScrollDirection = direction
    
    // 如果不在边缘区域，停止自动滚动
    if (direction === 0 || speed <= 0) {
      stopEdgeAutoScroll()
      return
    }
    
    // 如果还没有启动滚动间隔，创建一个
    if (!autoScrollInterval) {
      autoScrollInterval = window.setInterval(() => {
        const container = document.querySelector(scrollContainerSelector) as HTMLElement
        if (!container || currentScrollDirection === 0 || currentScrollSpeed <= 0) {
          stopEdgeAutoScroll()
          return
        }
        
        if (currentScrollDirection === -1) {
          if (container.scrollTop > 0) {
            container.scrollTop -= currentScrollSpeed
          }
        } else {
          const maxScroll = container.scrollHeight - container.clientHeight
          if (container.scrollTop < maxScroll) {
            container.scrollTop += currentScrollSpeed
          }
        }
      }, 16)
    }
  }

  // 停止边缘自动滚动
  function stopEdgeAutoScroll() {
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval)
      autoScrollInterval = null
    }
    currentScrollSpeed = 0
    currentScrollDirection = 0
  }

  // 开始拖拽
  function startDrag(id: string, ev: MouseEvent, extraData: any = {}) {
    if (ev.button !== 0) return
    
    const title = getTitleForItem(id)
    
    dragging.value = { id, ...extraData }
    isDraggingActive = true
    
    dragGhost = createDragGhost(title)
    updateDragGhostPosition(ev.clientX, ev.clientY)
    
    document.addEventListener('wheel', handleWheelDuringDrag, { passive: false })
    document.addEventListener('mousemove', handleDragMove)
    document.addEventListener('mouseup', handleDragEnd)
    
    ev.preventDefault()
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'
  }

  // 拖拽移动
  function handleDragMove(ev: MouseEvent) {
    if (!isDraggingActive || !dragging.value) return
    
    updateDragGhostPosition(ev.clientX, ev.clientY)
    updateEdgeAutoScroll(ev.clientY)
    
    const elements = document.elementsFromPoint(ev.clientX, ev.clientY)
    let targetElement: Element | null = null
    let targetId: string | null = null
    
    for (const el of elements) {
      if (el.matches(itemSelector)) {
        targetElement = el
        
        // 先检查元素自身是否有 dataAttribute
        if (el.hasAttribute(dataAttribute)) {
          targetId = el.getAttribute(dataAttribute)
        } else {
          // 如果没有，再查找子元素
          const cardElement = el.querySelector(`[${dataAttribute}]`)
          if (cardElement) {
            targetId = cardElement.getAttribute(dataAttribute)
          }
        }
        break
      }
    }
    
    if (targetElement && targetId) {
      const rect = targetElement.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      dragOverBefore.value = ev.clientY < mid
      dragOverId.value = targetId
    } else {
      dragOverId.value = null
    }
  }

  // 结束拖拽
  function handleDragEnd(_ev: MouseEvent) {
    if (!isDraggingActive) return
    
    stopEdgeAutoScroll()
    
    // 执行重排序回调
    if (dragging.value && onReorder) {
      const draggedId = dragging.value.id
      const targetId = dragOverId.value
      const insertBefore = dragOverBefore.value
      
      // 只有当 targetId 存在且不等于 draggedId 时才触发重排序
      // 避免原地拖拽松开时触发重排序
      if (draggedId && targetId && draggedId !== targetId) {
        onReorder(draggedId, targetId, insertBefore)
      }
    }
    
    if (dragGhost) {
      document.body.removeChild(dragGhost)
      dragGhost = null
    }
    
    document.removeEventListener('wheel', handleWheelDuringDrag)
    document.removeEventListener('mousemove', handleDragMove)
    document.removeEventListener('mouseup', handleDragEnd)
    
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    
    isDraggingActive = false
    dragging.value = null
    dragOverId.value = null
  }

  // 重置拖拽状态
  function resetDrag() {
    dragging.value = null
    dragOverId.value = null
  }

  // 执行拖拽排序（通用逻辑）
  function performReorder<T extends { id?: string; identifier?: string }>(
    list: T[],
    draggedId: string,
    overId: string | null,
    before: boolean
  ): T[] {
    const ids = list.map(item => item.id || item.identifier || '')
    const fromIdx = ids.indexOf(draggedId)
    
    if (fromIdx < 0 || overId === draggedId) {
      return list
    }
    
    const newIds = [...ids]
    newIds.splice(fromIdx, 1)
    
    if (overId) {
      const toIdx = newIds.indexOf(overId)
      let insertIdx = toIdx < 0 ? newIds.length : toIdx + (before ? 0 : 1)
      if (insertIdx < 0) insertIdx = 0
      if (insertIdx > newIds.length) insertIdx = newIds.length
      newIds.splice(insertIdx, 0, draggedId)
    } else {
      newIds.push(draggedId)
    }
    
    return newIds.map(id => list.find(item => (item.id || item.identifier) === id)).filter(Boolean) as T[]
  }

  return {
    dragging,
    dragOverId,
    dragOverBefore,
    startDrag,
    resetDrag,
    performReorder
  }
}