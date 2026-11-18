<script setup lang="ts">
import type { Actor, Film } from '#shared/types/game'
import type { ChainLink } from '~/composables/useGame'

const props = defineProps<{
  chain: ChainLink[]
  pendingFilm?: Film | null
  target: Actor
}>()

const track = ref<HTMLElement>()

// Keep the newest step (and the target) in view as the chain grows
watch(() => [props.chain.length, props.pendingFilm], async () => {
  await nextTick()
  track.value?.scrollTo({ left: track.value.scrollWidth, behavior: 'smooth' })
})

const lastIndex = computed(() => props.chain.length - 1)
</script>

<template>
  <div ref="track" class="board-chain">
    <template v-for="(link, i) in chain" :key="`${i}-${link.actor.id}`">
      <template v-if="link.film">
        <span class="board-chain__arrow">▶</span>
        <ChainCard variant="film" :title="link.film.title" :subtitle="link.film.year" :image="link.film.image" />
        <span class="board-chain__arrow">▶</span>
      </template>
      <ChainCard
        :variant="i === 0 ? 'start' : 'actor'"
        :size="i === 0 ? 'big' : 'small'"
        :title="link.actor.name"
        :image="link.actor.image"
        :tag="i === 0 ? 'START' : (i === lastIndex && !pendingFilm ? 'NOW' : undefined)"
      />
    </template>

    <template v-if="pendingFilm">
      <span class="board-chain__arrow">▶</span>
      <ChainCard
        variant="film"
        pending
        tag="NOW"
        :title="pendingFilm.title"
        :subtitle="pendingFilm.year"
        :image="pendingFilm.image"
      />
    </template>

    <span class="board-chain__arrow board-chain__arrow--dim">▶</span>
    <ChainCard variant="mystery" :title="pendingFilm ? 'co-star?' : 'film?'" :image="null" />
    <span class="board-chain__arrow board-chain__arrow--dim">· · ·</span>

    <ChainCard variant="target" size="big" tag="TARGET" :title="target.name" :image="target.image" />
  </div>
</template>

<style scoped lang="scss">
.board-chain {
  display: flex;
  align-items: center;
  justify-content: safe center;
  gap: 10px;
  overflow-x: auto;
  padding: 22px 8px 18px;
  margin-bottom: 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--pink) transparent;

  &__arrow {
    flex: none;
    color: var(--yellow);
    font-size: 14px;
    text-shadow: 2px 2px 0 #000;

    &--dim {
      color: var(--muted);
      font-family: var(--font-pixel);
      font-size: 10px;
    }
  }
}
</style>
