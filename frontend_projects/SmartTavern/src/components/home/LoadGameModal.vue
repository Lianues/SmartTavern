<script setup>
import { computed } from 'vue'
import ContentViewModal from '@/components/common/ContentViewModal.vue'
import LoadGameView from '@/components/home/LoadGameView.vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
  icon: { type: String, default: '' },
})

const effectiveTitle = computed(() => props.title || t('home.loadGame.title'))

const emit = defineEmits(['update:show', 'close', 'confirm'])

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
    <LoadGameView @confirm="(file) => emit('confirm', file)" />
  </ContentViewModal>
</template>

<style scoped>
/* 占位：LoadGameModal 目前使用内部视图样式，无需额外样式 */
</style>