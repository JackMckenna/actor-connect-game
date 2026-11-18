<script setup lang="ts">
const props = withDefaults(defineProps<{
  src: string | null
  label: string
  icon?: 'actor' | 'film'
}>(), { icon: 'actor' })

const COLORS = ['#ff3cac', '#2bd9fe', '#ffe14d', '#3dff8b', '#ff8a3d', '#a66bff']
const color = computed(() => {
  let h = 0
  for (const c of props.label) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
})
const initials = computed(() =>
  props.label.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(),
)
</script>

<template>
  <div class="pixel-image" :style="{ '--fallback': color }">
    <img v-if="src" :src="src" :alt="label" class="pixel-image__photo" loading="lazy" draggable="false">
    <div v-else class="pixel-image__fallback" :class="{ 'pixel-image__fallback--film': icon === 'film' }">
      <span>{{ initials }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pixel-image {
  position: relative;
  aspect-ratio: 2 / 3;
  width: 100%;
  background: #000;
  overflow: hidden;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &__fallback {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    background:
      linear-gradient(transparent 50%, rgba(0, 0, 0, 0.15) 50%) 0 0 / 100% 4px,
      var(--fallback);
    color: #1a1033;
    font-family: var(--font-pixel);
    font-size: clamp(10px, 2.2vw, 18px);

    // Film-strip sprocket holes down both sides
    &--film {
      background:
        repeating-linear-gradient(#000 0 6px, transparent 6px 12px) left 3px top 0 / 6px 100% no-repeat,
        repeating-linear-gradient(#000 0 6px, transparent 6px 12px) right 3px top 0 / 6px 100% no-repeat,
        linear-gradient(transparent 50%, rgba(0, 0, 0, 0.15) 50%) 0 0 / 100% 4px,
        var(--fallback);
    }
  }
}

</style>
