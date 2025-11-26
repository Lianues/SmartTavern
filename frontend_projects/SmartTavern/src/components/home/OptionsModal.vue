<script setup>
import { computed } from 'vue'
import ContentViewModal from '@/components/common/ContentViewModal.vue'
import OptionsView from '@/components/home/OptionsView.vue'
import { useI18n } from '@/locales'

const { t } = useI18n()

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '' },
  icon: { type: String, default: '' },
  theme: { type: String, default: 'system' },
})

const effectiveTitle = computed(() => props.title || t('home.options.title'))

const emit = defineEmits(['update:show', 'close', 'update:theme'])

function onClose() {
  emit('close')
  emit('update:show', false)
}

function onThemeUpdate(t) {
  emit('update:theme', t)
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
    <OptionsView :theme="props.theme" @update:theme="onThemeUpdate" />
  </ContentViewModal>
</template>

<style scoped>
/* 占位：OptionsModal 目前复用内部视图样式 */
</style>