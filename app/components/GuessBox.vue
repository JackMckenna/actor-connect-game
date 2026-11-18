<script setup lang="ts">
import type { Suggestion } from '#shared/types/game'
import type { Guess } from '~/composables/useGame'

const props = defineProps<{
  kind: 'movie' | 'person'
  placeholder: string
  disabled?: boolean
  /** Bump this number to play the "wrong" shake */
  shake?: number
}>()

const emit = defineEmits<{ guess: [g: Guess] }>()
const text = defineModel<string>({ default: '' })

const input = ref<HTMLInputElement>()
const suggestions = ref<Suggestion[]>([])
const active = ref(-1)
const open = ref(false)
const shaking = ref(false)

// --- autocomplete (searches the whole catalogue, so it only helps with spelling) ---
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
watch(text, (q) => {
  clearTimeout(timer)
  active.value = -1
  if (q.trim().length < 2) {
    suggestions.value = []
    return
  }
  timer = setTimeout(async () => {
    const mine = ++seq
    try {
      const res = await search(props.kind, q)
      if (mine === seq) {
        suggestions.value = res
        open.value = true
      }
    }
    catch {
      suggestions.value = []
    }
  }, 220)
})

watch(() => props.kind, () => {
  suggestions.value = []
  focus()
})

// Wrong guess: shake, and select the text so you can fix a typo or just type over it
watch(() => props.shake, () => {
  shaking.value = false
  requestAnimationFrame(() => (shaking.value = true))
  nextTick(() => input.value?.select())
})

function focus() {
  nextTick(() => input.value?.focus())
}
onMounted(focus)

function submit(s?: Suggestion) {
  const pick = s ?? (active.value >= 0 ? suggestions.value[active.value] : undefined)
  const value = pick ? pick.title : text.value.trim()
  if (!value) return
  open.value = false
  emit('guess', pick ? { text: pick.title, id: pick.id } : { text: value })
}

function onKey(e: KeyboardEvent) {
  const n = suggestions.value.length
  if (e.key === 'ArrowDown' && n) {
    e.preventDefault()
    open.value = true
    active.value = (active.value + 1) % n
  }
  else if (e.key === 'ArrowUp' && n) {
    e.preventDefault()
    active.value = active.value <= 0 ? n - 1 : active.value - 1
  }
  else if (e.key === 'Escape' && open.value) {
    e.stopPropagation()
    open.value = false
    active.value = -1
  }
}

defineExpose({ focus })
</script>

<template>
  <form class="guess" :class="{ 'guess--shake': shaking }" autocomplete="off" @submit.prevent="submit()" @animationend="shaking = false">
    <div class="guess__row">
      <span class="guess__prompt">&gt;</span>
      <input
        ref="input"
        v-model="text"
        class="guess__input"
        type="text"
        :placeholder="placeholder"
        :disabled="disabled"
        spellcheck="false"
        autocapitalize="words"
        enterkeyhint="go"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open && suggestions.length > 0"
        @keydown="onKey"
        @focus="open = true"
        @blur="open = false"
      >
      <button type="submit" class="btn btn--pink guess__go" :disabled="disabled || !text.trim()">ENTER</button>
    </div>

    <ul v-if="open && suggestions.length" class="guess__list" role="listbox">
      <li
        v-for="(s, i) in suggestions"
        :key="s.id"
        role="option"
        :aria-selected="i === active"
        class="guess__opt"
        :class="{ 'guess__opt--active': i === active }"
        @mousedown.prevent="submit(s)"
        @mouseenter="active = i"
      >
        <span class="guess__thumb">
          <PixelImage :src="s.image" :label="s.title" :icon="kind === 'movie' ? 'film' : 'actor'" />
        </span>
        <span class="guess__name">{{ s.title }}</span>
        <span v-if="s.subtitle" class="guess__sub">{{ s.subtitle }}</span>
      </li>
    </ul>
  </form>
</template>

<style scoped lang="scss">
.guess {
  position: relative;

  &--shake { animation: shake 0.35s steps(6); }

  &__row {
    display: flex;
    align-items: stretch;
    gap: 10px;
  }

  &__prompt {
    display: grid;
    place-items: center;
    padding: 0 6px;
    font-family: var(--font-pixel);
    font-size: 18px;
    color: var(--green);
    animation: blink 1s steps(1) infinite;
  }

  &__input {
    flex: 1;
    min-width: 0;
    padding: 12px 14px;
    background: #0d0820;
    color: var(--white);
    border: 4px solid var(--white);
    box-shadow: 4px 4px 0 #000;
    font: inherit;
    font-size: 28px;
    outline: none;
    caret-color: var(--green);

    &:focus { border-color: var(--yellow); }
    &::placeholder { color: var(--muted); }
  }

  &__go { flex: none; }

  &__list {
    position: absolute;
    z-index: 10;
    left: 0;
    right: 0;
    top: calc(100% + 6px);
    margin: 0;
    padding: 0;
    list-style: none;
    background: #0d0820;
    border: 4px solid var(--yellow);
    box-shadow: 6px 6px 0 #000;
  }

  &__opt {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 24px;

    & + & { border-top: 2px dashed #2c1d5c; }

    &--active {
      background: var(--yellow);
      color: #000;

      .guess__sub { color: #4b3a00; }
    }
  }

  &__thumb {
    width: 26px;
    flex: none;
    border: 2px solid #000;
  }

  &__name { flex: 1; }

  &__sub {
    color: var(--muted);
    font-size: 20px;
  }
}

@media (max-width: 520px) {
  .guess__prompt { display: none; }
  .guess__input { font-size: 22px; }
  .guess__go { padding: 10px; font-size: 10px; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-8px); }
  40%, 80% { transform: translateX(8px); }
}
</style>
