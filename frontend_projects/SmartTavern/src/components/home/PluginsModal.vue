<script setup>
import { computed } from 'vue'
import ContentViewModal from '@/components/common/ContentViewModal.vue'
import PluginsView from '@/components/home/PluginsView.vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
  icon: { type: String, default: '' },
})

const effectiveTitle = computed(() => props.title || t('home.plugins.title'))

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
    <PluginsView />
  </ContentViewModal>
</template>

<style scoped>
/* PluginsModal 使用内部视图样式 */
</style>