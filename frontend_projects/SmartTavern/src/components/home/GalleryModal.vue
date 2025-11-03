<script setup>
import ContentViewModal from '@/components/common/ContentViewModal.vue'
import GalleryView from '@/components/home/GalleryView.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '画廊' },
  icon: { type: String, default: '' },
})

const emit = defineEmits(['update:show', 'close'])

function onClose() {
  emit('close')
  emit('update:show', false)
}
</script>

<template>
  <ContentViewModal
    :show="props.show"
    :title="props.title"
    :icon="props.icon"
    @update:show="(v) => emit('update:show', v)"
    @close="onClose"
  >
    <GalleryView />
  </ContentViewModal>
</template>

<style scoped>
/* 占位：GalleryModal 目前使用内部视图样式 */
</style>