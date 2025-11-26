<script setup>
import { onMounted } from "vue"
import { useI18n } from '@/locales'

const { t } = useI18n()

onMounted(() => window.lucide?.createIcons?.())
</script>

<template>
  <section class="home-modal-section">
    <p class="hm-desc">{{ t('home.gallery.placeholder') }}</p>

    <div class="gallery-grid">
      <div v-for="i in 12" :key="i" class="g-item">
        <div class="g-thumb" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-modal-section { display: grid; gap: 12px; }
.hm-desc { margin: 0 0 8px; font-size: 12px; color: rgba(var(--st-color-text), 0.7); }

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 10px;
}
@media (max-width: 980px) { .gallery-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 720px) { .gallery-grid { grid-template-columns: repeat(2, 1fr); } }

.g-item {
  aspect-ratio: 4 / 3;
  border-radius: 10px;
  border: 1px solid rgb(var(--st-border));
  background: rgb(var(--st-surface));
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  transition: transform .18s cubic-bezier(.22,.61,.36,1), box-shadow .18s, border-color .18s;
}
.g-item:hover { transform: translateY(-1px); box-shadow: var(--st-shadow-sm); border-color: rgba(var(--st-primary), .45); }

.g-thumb {
  width: 100%; height: 100%;
  background:
    linear-gradient(135deg, rgba(var(--st-primary), .1), rgba(var(--st-accent), .08)),
    repeating-conic-gradient(from 45deg, rgba(0,0,0,.05) 0 10deg, transparent 10deg 20deg);
  filter: saturate(120%);
}
</style>
