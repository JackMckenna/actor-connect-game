<script setup lang="ts">
import type { Player } from '#shared/types/game'
import type { ChainLink } from '~/composables/useGame'

const props = defineProps<{
  chain: ChainLink[]
  best: number
  newBest: boolean
  hints: number
  misses: number
  /** Co-op team (empty in solo) */
  players: Player[]
  /** Guests wait for the host to deal the next pair */
  canReplay: boolean
}>()
defineEmits<{ again: [], title: [] }>()

const links = computed(() => props.chain.length - 1)
const score = computed(() => scoreFor(links.value, props.hints))
const rank = computed(() => rankFor(links.value))

// Count the score up arcade-style
const shownScore = ref(0)
onMounted(() => {
  const steps = 30
  let i = 0
  const t = setInterval(() => {
    i++
    shownScore.value = Math.round((score.value * i) / steps)
    if (i >= steps) clearInterval(t)
  }, 30)
})

const copied = ref(false)
async function share() {
  const path = props.chain
    .map((l, i) => (i === 0 ? l.actor.name : `→ 🎬 ${l.film!.title} → ${l.actor.name}`))
    .join(' ')
  const text = `ACTOR CONNECT 🕹️ ${links.value} film${links.value === 1 ? '' : 's'} · ${score.value} pts\n${path}`
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
  catch {}
}
</script>

<template>
  <div class="win">
    <div class="win__stars" aria-hidden="true">
      <span v-for="n in 14" :key="n" :style="{ '--i': n }">★</span>
    </div>

    <h2 class="win__title">CONNECTED!</h2>
    <p v-if="players.length" class="win__team">
      TEAM:
      <span v-for="p in players" :key="p.id" :style="{ color: p.color }">{{ p.name }}</span>
    </p>
    <p class="win__rank" :style="{ color: rank.color }">{{ rank.label }}</p>

    <div class="win__score">
      <span class="win__label">SCORE</span>
      <span class="win__points">{{ String(shownScore).padStart(4, '0') }}</span>
      <span class="win__label">{{ links }} FILM{{ links === 1 ? '' : 'S' }} · {{ hints }} HINT{{ hints === 1 ? '' : 'S' }} · {{ misses }} MISS{{ misses === 1 ? '' : 'ES' }}</span>
      <span v-if="!players.length" class="win__label">BEST {{ String(best).padStart(4, '0') }}</span>
      <span v-if="newBest" class="win__new blink">NEW HIGH SCORE!</span>
    </div>

    <ol class="win__chain">
      <li v-for="(link, i) in chain" :key="i">
        <span v-if="link.film" class="win__film">🎬 {{ link.film.title }} <small>({{ link.film.year }})</small></span>
        <span class="win__actor" :class="{ 'win__actor--end': i === chain.length - 1 }">{{ link.actor.name }}</span>
      </li>
    </ol>

    <div class="win__actions">
      <button v-if="canReplay" type="button" class="btn btn--pink" @click="$emit('again')">PLAY AGAIN</button>
      <p v-else class="win__wait">Waiting for the host to start the next round<span class="blink">_</span></p>
      <button type="button" class="btn" @click="share">{{ copied ? 'COPIED!' : 'SHARE' }}</button>
      <button type="button" class="btn btn--ghost" @click="$emit('title')">MENU</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.win {
  position: relative;
  max-width: 640px;
  margin: 0 auto;
  padding: 32px 20px;
  text-align: center;
  background: var(--panel);
  border: 4px solid var(--yellow);
  box-shadow: 8px 8px 0 #000;
  overflow: hidden;

  &__stars span {
    position: absolute;
    top: -20px;
    left: calc(var(--i) * 7%);
    color: var(--yellow);
    font-size: 14px;
    animation: fall 2.4s steps(12) infinite;
    animation-delay: calc(var(--i) * -0.37s);
    &:nth-child(3n) { color: var(--pink); }
    &:nth-child(3n + 1) { color: var(--cyan); }
  }

  &__title {
    margin: 0;
    font-family: var(--font-pixel);
    font-size: clamp(22px, 6vw, 40px);
    color: var(--green);
    text-shadow: 4px 4px 0 #000;
  }

  &__team {
    margin: 12px 0 0;
    font-family: var(--font-pixel);
    font-size: 10px;
    line-height: 2;
    color: var(--muted);

    span { margin-left: 10px; }
  }

  &__wait {
    width: 100%;
    margin: 0 0 6px;
    color: var(--cyan);
    font-size: 22px;
  }

  &__rank {
    margin: 12px 0 0;
    font-family: var(--font-pixel);
    font-size: clamp(14px, 3vw, 20px);
    text-shadow: 3px 3px 0 #000;
  }

  &__score {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 24px 0;
  }

  &__label {
    font-family: var(--font-pixel);
    font-size: 10px;
    color: var(--muted);
  }

  &__points {
    font-family: var(--font-pixel);
    font-size: clamp(32px, 9vw, 56px);
    color: var(--yellow);
    text-shadow: 4px 4px 0 var(--pink);
  }

  &__new {
    font-family: var(--font-pixel);
    font-size: 11px;
    color: var(--pink);
  }

  &__chain {
    list-style: none;
    margin: 0 0 24px;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    font-size: 22px;

    li {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
  }

  &__film {
    color: var(--yellow);
    small { color: var(--muted); }
  }

  &__actor {
    padding: 4px 10px;
    background: var(--cyan);
    color: #000;
    border: 3px solid #000;

    &--end { background: var(--pink); }
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }
}

@keyframes fall {
  to { transform: translateY(700px); }
}
</style>
