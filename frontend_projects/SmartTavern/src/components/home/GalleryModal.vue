<script setup>
import { computed } from 'vue'
import ContentViewModal from '@/components/common/ContentViewModal.vue'
import GalleryView from '@/components/home/GalleryView.vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
  icon: { type: String, default: '' },
})

const effectiveTitle = computed(() => props.title || t('home.gallery.title'))

const emit = defineEmits(['update:show', 'close'])

function onClose() {
  emit('close')
  emit('update:show', false)
}
</script>

<template>
  <ContentViewModal
    :show="props.show"
    :title="effectiveTitle"
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