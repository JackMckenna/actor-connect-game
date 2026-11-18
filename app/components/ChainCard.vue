<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  image: string | null
  subtitle?: string
  tag?: string
  variant?: 'start' | 'target' | 'actor' | 'film' | 'mystery'
  size?: 'big' | 'small'
  pending?: boolean
}>(), { variant: 'actor', size: 'small' })
</script>

<template>
  <div
    class="card"
    :class="[`card--${variant}`, `card--${size}`, { 'card--pending': pending }]"
  >
    <span v-if="tag" class="card__tag">{{ tag }}</span>
    <div class="card__img">
      <div v-if="variant === 'mystery'" class="card__mystery">?</div>
      <PixelImage v-else :src="image" :label="title" :icon="variant === 'film' ? 'film' : 'actor'" />
    </div>
    <p class="card__name">{{ title }}</p>
    <p v-if="subtitle" class="card__sub">{{ subtitle }}</p>
  </div>
</template>

<style scoped lang="scss">
.card {
  --accent: var(--cyan);
  position: relative;
  flex: none;
  padding: 8px;
  background: var(--panel);
  border: 4px solid var(--accent);
  box-shadow: 5px 5px 0 #000;
  text-align: center;
  animation: pop 0.25s steps(3);

  &--big { width: clamp(104px, 15vw, 150px); }
  &--small { width: clamp(78px, 10vw, 104px); padding: 6px; border-width: 3px; }

  &--target {
    --accent: var(--pink);
    animation: bob 1.2s steps(2) infinite;
  }
  &--film { --accent: var(--yellow); }
  &--mystery {
    --accent: var(--muted);
    border-style: dashed;
    background: transparent;
    box-shadow: none;
  }
  &--pending { border-style: dashed; }

  &__tag {
    position: absolute;
    z-index: 1;
    top: -14px;
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 7px;
    background: var(--accent);
    color: #000;
    font-family: var(--font-pixel);
    font-size: 9px;
    white-space: nowrap;
    border: 3px solid #000;
  }

  &__img {
    border: 3px solid #000;
    margin-top: 4px;
  }

  &__mystery {
    aspect-ratio: 2 / 3;
    display: grid;
    place-items: center;
    font-family: var(--font-pixel);
    font-size: 26px;
    color: var(--muted);
    background: repeating-linear-gradient(45deg, #24164a 0 6px, #1a1033 6px 12px);
    animation: blink 1.2s steps(1) infinite;
  }

  &__name {
    margin: 6px 0 0;
    color: var(--white);
    overflow-wrap: break-word;
    hyphens: auto;
  }

  &--big &__name {
    font-family: var(--font-pixel);
    font-size: clamp(8px, 1.2vw, 11px);
    line-height: 1.5;
  }

  &--small &__name {
    font-size: 18px;
    line-height: 0.95;
  }

  &__sub {
    margin: 2px 0 0;
    font-size: 16px;
    line-height: 1;
    color: var(--muted);
  }
}

@keyframes bob {
  50% { transform: translateY(-4px); }
}

@keyframes pop {
  0% { transform: scale(0.6); }
  60% { transform: scale(1.08); }
}
</style>
