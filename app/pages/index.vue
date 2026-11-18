<script setup lang="ts">
import { HINT_COST, type Guess } from '~/composables/useGame'
import { cleanRoomCode } from '~/utils/net'

const game = useGame()
const {
  status, phase, demo, start, target, chain, selectedFilm, listLoading, error, feedback, choices,
  misses, hints, best, newBest, players, myId, myName, roomCode, current, links, potentialScore,
  deadEnd, multiplayer, isHost, currentPlayer, isMyTurn, shareLink,
} = game

/* ---------- title screen ---------- */
const nameInput = ref('')
const codeInput = ref('')
const roomFromUrl = ref('')
const nameError = ref(false)

onMounted(() => {
  game.loadBest()
  nameInput.value = myName.value
  roomFromUrl.value = cleanRoomCode(new URL(window.location.href).searchParams.get('room') ?? '')
})

function needName() {
  const name = nameInput.value.trim().slice(0, 16)
  nameError.value = !name
  return name || null
}

function onHost() {
  const name = needName()
  if (name) game.hostLobby(name)
}

function onJoin(code: string) {
  const name = needName()
  const clean = cleanRoomCode(code)
  if (name && clean) game.joinLobby(clean, name)
}

function onMenu() {
  roomFromUrl.value = ''
  game.exitToTitle()
}

const copied = ref(false)
async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareLink.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
  catch {}
}

/* ---------- playing ---------- */
const typed = ref('')
const shake = ref(0)
const box = ref<{ focus: () => void }>()

// New step (or new game) → clear the box
watch(() => `${chain.value.length}-${phase.value}-${status.value}`, () => {
  typed.value = ''
})
// Wrong guess on your turn → shake the box
watch(() => feedback.value?.n, () => {
  if (feedback.value?.kind === 'bad' && isMyTurn.value) shake.value++
})
// Your turn comes round → put the cursor in the box
watch(isMyTurn, (mine) => {
  if (mine) nextTick(() => box.value?.focus())
})

function onGuess(g: Guess) {
  game.guess(g)
}

const label = (item: { title?: string, name?: string, year?: string, character?: string }) =>
  item.title ? `${item.title} (${item.year})` : `${item.name}${item.character ? ` · ${item.character}` : ''}`

const turnLabel = computed(() => {
  if (!multiplayer.value) return ''
  return isMyTurn.value ? 'YOUR TURN!' : `${(currentPlayer.value?.name ?? '...').toUpperCase()}'S TURN`
})

const waitingText = computed(() => `Waiting for ${currentPlayer.value?.name ?? 'the next player'}...`)

// Keyboard: Escape = undo (when not typing in the box)
function onKey(e: KeyboardEvent) {
  if (status.value !== 'playing' || !isMyTurn.value) return
  if ((e.target as HTMLElement)?.tagName === 'INPUT') return
  if (e.key === 'Escape') {
    e.preventDefault()
    game.undo()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <main class="page">
    <!-- TITLE -->
    <section v-if="status === 'title'" class="title-screen">
      <h1 class="logo">
        <span class="logo__a">ACTOR</span>
        <span class="logo__b">CONNECT</span>
      </h1>
      <p class="title-screen__tag">LINK TWO STARS THROUGH THE FILMS THEY'VE MADE</p>

      <div class="menu panel">
        <label class="menu__label" for="player-name">YOUR NAME</label>
        <input
          id="player-name"
          v-model="nameInput"
          class="field"
          :class="{ 'field--error': nameError }"
          maxlength="16"
          placeholder="e.g. Jack"
          autocomplete="nickname"
          @input="nameError = false"
          @keydown.enter="roomFromUrl ? onJoin(roomFromUrl) : onHost()"
        >
        <p v-if="nameError" class="menu__error">Type a name so your friends know who's who!</p>

        <!-- Opened someone's invite link -->
        <template v-if="roomFromUrl">
          <button type="button" class="btn btn--big btn--pink" @click="onJoin(roomFromUrl)">
            JOIN ROOM {{ roomFromUrl }}
          </button>
          <button type="button" class="btn btn--small btn--ghost" @click="roomFromUrl = ''">NOT NOW · SHOW MENU</button>
        </template>

        <template v-else>
          <button type="button" class="btn btn--big btn--pink" @click="game.playSolo()">PLAY SOLO</button>
          <button type="button" class="btn btn--wide" @click="onHost">HOST A CO-OP GAME</button>
          <form class="menu__join" @submit.prevent="onJoin(codeInput)">
            <input v-model="codeInput" class="field field--code" maxlength="8" placeholder="ROOM CODE" aria-label="Room code">
            <button type="submit" class="btn btn--small" :disabled="!codeInput.trim()">JOIN</button>
          </form>
        </template>
      </div>

      <div class="how panel">
        <h2>HOW TO PLAY</h2>
        <ol>
          <li><b class="c-cyan">1.</b> You get a random <b class="c-cyan">START</b> actor and a <b class="c-pink">TARGET</b> actor.</li>
          <li><b class="c-yellow">2.</b> Type a film the current actor was in.</li>
          <li><b class="c-yellow">3.</b> Type a co-star from that film to jump to them.</li>
          <li><b class="c-green">4.</b> Keep hopping until you land on the target.</li>
          <li><b class="c-pink">★</b> They've never shared a film, so you need at least one actor in between. Fewer films = higher score. 2 films = <b class="c-yellow">1000</b> pts!</li>
          <li><b class="c-cyan">♥</b> <b class="c-cyan">CO-OP:</b> host a game, send the link, and take turns building one chain together.</li>
          <li><b class="c-orange">?</b> Stuck? Hints cost {{ HINT_COST }} pts. Wrong guesses are free.</li>
        </ol>
      </div>

      <p v-if="best" class="hiscore">SOLO HI-SCORE {{ String(best).padStart(4, '0') }}</p>
    </section>

    <!-- CONNECTING -->
    <section v-else-if="status === 'connecting'" class="center-msg">
      <p>CONNECTING<span class="blink">_</span></p>
      <p class="center-msg__small">{{ roomCode ? `Joining room ${roomCode}` : 'Creating your lobby' }}</p>
      <button type="button" class="btn btn--ghost" @click="onMenu">CANCEL</button>
    </section>

    <!-- LOBBY -->
    <section v-else-if="status === 'lobby'" class="lobby">
      <div class="panel lobby__card">
        <p class="lobby__label">ROOM CODE</p>
        <p class="lobby__code">{{ roomCode }}</p>

        <template v-if="isHost">
          <p class="lobby__hint">Send this link to your friends:</p>
          <div class="lobby__link">
            <input class="field" :value="shareLink" readonly aria-label="Invite link" @focus="($event.target as HTMLInputElement).select()">
            <button type="button" class="btn btn--small" @click="copyLink">{{ copied ? 'COPIED!' : 'COPY' }}</button>
          </div>
        </template>

        <p class="lobby__label">PLAYERS ({{ players.length }})</p>
        <ul class="lobby__players">
          <li v-for="(p, i) in players" :key="p.id" :style="{ '--c': p.color }">
            <span class="dot" />{{ p.name }}
            <small v-if="i === 0">HOST</small>
            <small v-if="p.id === myId">YOU</small>
          </li>
        </ul>

        <button v-if="isHost" type="button" class="btn btn--big btn--pink" @click="game.newGame()">
          START GAME
        </button>
        <p v-else class="lobby__wait">Waiting for {{ players[0]?.name ?? 'the host' }} to start<span class="blink">_</span></p>

        <button type="button" class="btn btn--small btn--ghost" @click="onMenu">LEAVE</button>
      </div>
      <p class="lobby__tip">Keep this tab open – as host, your browser runs the game.</p>
    </section>

    <!-- LOADING -->
    <section v-else-if="status === 'loading'" class="center-msg">
      <p>SHUFFLING STARS<span class="blink">_</span></p>
    </section>

    <!-- ERROR -->
    <section v-else-if="status === 'error'" class="center-msg">
      <p class="c-pink">GAME OVER</p>
      <p class="center-msg__small">{{ error }}</p>
      <div class="center-msg__actions">
        <button v-if="roomFromUrl" type="button" class="btn btn--pink" @click="onJoin(roomFromUrl)">REJOIN</button>
        <button v-else-if="!multiplayer" type="button" class="btn btn--pink" @click="game.playSolo()">TRY AGAIN</button>
        <button type="button" class="btn btn--ghost" @click="onMenu">MENU</button>
      </div>
    </section>

    <!-- WON -->
    <section v-else-if="status === 'won'">
      <WinScreen
        :chain="chain"
        :best="best"
        :new-best="newBest"
        :hints="hints"
        :misses="misses"
        :players="multiplayer ? players : []"
        :can-replay="!multiplayer || isHost"
        @again="game.newGame()"
        @title="onMenu"
      />
    </section>

    <!-- PLAYING -->
    <section v-else-if="start && target && current" class="play">
      <header class="hud">
        <button type="button" class="hud__logo" @click="onMenu">ACTOR<br><span>CONNECT</span></button>
        <div class="hud__stat">
          <span>FILMS</span><b class="c-yellow">{{ links }}</b>
        </div>
        <div class="hud__stat">
          <span>NEXT HIT</span><b class="c-green">{{ potentialScore }}</b>
        </div>
        <div v-if="multiplayer" class="hud__stat">
          <span>ROOM</span><b class="c-pink">{{ roomCode }}</b>
        </div>
        <div v-else class="hud__stat">
          <span>HI</span><b class="c-pink">{{ String(best).padStart(4, '0') }}</b>
        </div>
      </header>

      <p v-if="demo" class="demo-note">
        DEMO MODE · small built-in film list. Add a TMDB key to play with every actor.
      </p>

      <!-- Co-op players & whose turn it is -->
      <ul v-if="multiplayer" class="turns">
        <li
          v-for="p in players"
          :key="p.id"
          class="turns__p"
          :class="{ 'turns__p--now': p.id === currentPlayer?.id }"
          :style="{ '--c': p.color }"
        >
          <span class="dot" />{{ p.name }}<small v-if="p.id === myId"> (you)</small>
        </li>
        <li v-if="isHost" class="turns__invite">
          <button type="button" class="btn btn--small btn--ghost" @click="copyLink">{{ copied ? 'COPIED!' : '+ INVITE' }}</button>
        </li>
      </ul>

      <ChainBoard :chain="chain" :pending-film="selectedFilm" :target="target" />

      <div class="panel board" :class="{ 'board--mine': multiplayer && isMyTurn }" :style="multiplayer && currentPlayer ? { '--turn': currentPlayer.color } : undefined">
        <div class="board__head">
          <h2>
            <span v-if="turnLabel" class="board__turn">{{ turnLabel }}</span>
            <template v-if="phase === 'film'">
              NAME A FILM WITH <span class="c-cyan">{{ current.name }}</span>
            </template>
            <template v-else>
              NAME A CO-STAR IN <span class="c-yellow">{{ selectedFilm?.title }}</span>
              <small v-if="selectedFilm">({{ selectedFilm.year }})</small>
            </template>
          </h2>
          <div class="board__actions">
            <button
              type="button"
              class="btn btn--small"
              :disabled="!isMyTurn || (phase === 'film' && chain.length <= 1)"
              @click="game.undo()"
            >◀ UNDO</button>
            <button v-if="multiplayer" type="button" class="btn btn--small btn--ghost" :disabled="!isMyTurn || players.length < 2" @click="game.pass()">PASS ▶</button>
            <button v-if="!multiplayer || isHost" type="button" class="btn btn--small btn--ghost" @click="game.newGame()">NEW PAIR</button>
          </div>
        </div>

        <div class="board__body">
          <div class="board__now">
            <PixelImage
              v-if="phase === 'cast' && selectedFilm"
              :src="selectedFilm.image"
              :label="selectedFilm.title"
              icon="film"
            />
            <PixelImage v-else :src="current.image" :label="current.name" />
          </div>

          <div class="board__play">
            <GuessBox
              ref="box"
              v-model="typed"
              :kind="phase === 'film' ? 'movie' : 'person'"
              :placeholder="!isMyTurn ? waitingText : phase === 'film' ? 'Type a film title...' : 'Type an actor’s name...'"
              :disabled="listLoading || !isMyTurn"
              :shake="shake"
              @guess="onGuess"
            />

            <p v-if="listLoading" class="msg msg--info">CHECKING THE ARCHIVES<span class="blink">_</span></p>
            <p v-else-if="error" class="msg msg--bad">{{ error }}</p>
            <p v-else-if="deadEnd" class="msg msg--bad">
              DEAD END! There's nowhere new to go from here. Hit ◀ UNDO and try another route.
            </p>
            <p v-else-if="feedback" :key="feedback.n" class="msg" :class="`msg--${feedback.kind}`">
              {{ feedback.kind === 'bad' ? '✗' : feedback.kind === 'good' ? '✓' : '?' }} {{ feedback.text }}
            </p>

            <div v-if="choices.length && isMyTurn" class="choices">
              <button
                v-for="c in choices"
                :key="c.id"
                type="button"
                class="btn btn--small"
                @click="game.choose(c)"
              >{{ label(c) }}</button>
            </div>

            <div class="board__foot">
              <button type="button" class="btn btn--small btn--yellow" :disabled="listLoading || deadEnd || !isMyTurn" @click="game.hint()">
                HINT (-{{ HINT_COST }})
              </button>
              <span>MISSES <b class="c-pink">{{ misses }}</b></span>
              <span>HINTS <b class="c-yellow">{{ hints }}</b></span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <footer class="footer">
      Film data from <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a>.
      This product uses the TMDB API but is not endorsed or certified by TMDB.
    </footer>
  </main>
</template>

<style scoped lang="scss">
.page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 16px 40px;
}

/* ---------- Title ---------- */
.title-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  padding-top: 4vh;
  text-align: center;

  &__tag {
    margin: 0;
    font-family: var(--font-pixel);
    font-size: clamp(9px, 1.8vw, 12px);
    line-height: 1.8;
    color: var(--cyan);
  }
}

.logo {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: var(--font-pixel);
  line-height: 1;

  &__a {
    font-size: clamp(36px, 10vw, 80px);
    color: var(--yellow);
    text-shadow: 4px 4px 0 var(--pink), 8px 8px 0 #000;
  }

  &__b {
    font-size: clamp(28px, 8vw, 64px);
    color: var(--cyan);
    text-shadow: 4px 4px 0 var(--purple), 8px 8px 0 #000;
    animation: wiggle 1.6s steps(2) infinite;
  }
}

.how {
  max-width: 560px;
  text-align: left;

  h2 {
    margin: 0 0 12px;
    font-family: var(--font-pixel);
    font-size: 13px;
    color: var(--yellow);
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 24px;
    line-height: 1.1;
  }
}

.hiscore {
  margin: 0;
  font-family: var(--font-pixel);
  font-size: 12px;
  color: var(--pink);
}

.center-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 18vh 0;
  font-family: var(--font-pixel);
  font-size: 18px;
  text-align: center;

  p { margin: 0; }
  &__small { font-family: var(--font-body); font-size: 24px; color: var(--muted); }
}

/* ---------- HUD ---------- */
.hud {
  display: flex;
  align-items: stretch;
  gap: 10px;
  margin-bottom: 20px;

  &__logo {
    margin-right: auto;
    padding: 0;
    background: none;
    border: 0;
    cursor: pointer;
    text-align: left;
    font-family: var(--font-pixel);
    font-size: clamp(10px, 2vw, 14px);
    line-height: 1.3;
    color: var(--yellow);
    text-shadow: 2px 2px 0 var(--pink);

    span { color: var(--cyan); text-shadow: 2px 2px 0 var(--purple); }
  }

  &__stat {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    min-width: 72px;
    padding: 8px 10px;
    background: var(--panel);
    border: 3px solid #000;
    box-shadow: 3px 3px 0 #000;
    font-family: var(--font-pixel);
    text-align: center;

    span { font-size: 7px; color: var(--muted); }
    b { font-size: clamp(11px, 2vw, 16px); font-weight: 400; }
  }
}

.demo-note {
  margin: 0 0 20px;
  padding: 8px 12px;
  background: var(--orange);
  color: #000;
  border: 3px solid #000;
  font-size: 20px;
  text-align: center;
}

.board {
  margin-top: 8px;

  &__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;

    h2 {
      margin: 0;
      font-family: var(--font-pixel);
      font-size: clamp(10px, 1.8vw, 13px);
      line-height: 1.7;
    }
  }

  &__actions {
    display: flex;
    gap: 10px;
  }

  &__head small {
    color: var(--muted);
    font-size: 0.8em;
  }

  &__body {
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }

  &__now {
    width: 96px;
    flex: none;
    border: 4px solid #000;
    box-shadow: 4px 4px 0 #000;
  }

  &__play {
    flex: 1;
    min-width: 0;
  }

  &__foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 18px;
    margin-top: 18px;
    font-family: var(--font-pixel);
    font-size: 9px;
    color: var(--muted);

    b { font-size: 12px; margin-left: 4px; }
  }
}

.msg {
  margin: 16px 0 0;
  font-size: 24px;
  line-height: 1.1;
  animation: msg-in 0.2s steps(3);

  &--good { color: var(--green); }
  &--bad { color: var(--pink); }
  &--info { color: var(--yellow); }
}

.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;

  .btn { font-family: var(--font-body); font-size: 20px; text-transform: none; padding: 6px 10px; }
}

@media (max-width: 520px) {
  .board__now { display: none; }
}

@keyframes msg-in {
  from { opacity: 0; transform: translateY(-6px); }
}

.footer {
  margin-top: 48px;
  text-align: center;
  font-size: 16px;
  color: var(--muted);

  a { color: var(--cyan); }
}

@keyframes wiggle {
  50% { transform: rotate(-2deg) translateY(-2px); }
}

/* ---------- Menu / lobby ---------- */
.menu {
  width: min(100%, 460px);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
  text-align: left;

  &__label {
    font-family: var(--font-pixel);
    font-size: 11px;
    color: var(--yellow);
  }

  &__error {
    margin: -6px 0 0;
    color: var(--pink);
    font-size: 20px;
  }

  &__join {
    display: flex;
    gap: 10px;

    .field { flex: 1; min-width: 0; }
  }

  .btn--big { animation: none; }
}

.field {
  width: 100%;
  padding: 10px 12px;
  background: #0d0820;
  color: var(--white);
  border: 4px solid var(--white);
  box-shadow: 4px 4px 0 #000;
  font: inherit;
  font-size: 26px;
  outline: none;

  &:focus { border-color: var(--yellow); }
  &::placeholder { color: var(--muted); }
  &--error { border-color: var(--pink); }
  &--code { text-transform: uppercase; letter-spacing: 3px; font-size: 22px; }
}

.btn.btn--wide {
  padding: 16px 20px;
  font-size: clamp(11px, 2.4vw, 14px);
}

.dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 8px;
  background: var(--c);
  border: 2px solid #000;
  vertical-align: middle;
}

.lobby {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding-top: 6vh;

  &__card {
    width: min(100%, 520px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
  }

  &__label {
    margin: 6px 0 0;
    font-family: var(--font-pixel);
    font-size: 10px;
    color: var(--muted);
  }

  &__code {
    margin: 0;
    font-family: var(--font-pixel);
    font-size: clamp(30px, 9vw, 52px);
    letter-spacing: 6px;
    color: var(--yellow);
    text-shadow: 4px 4px 0 var(--pink), 7px 7px 0 #000;
  }

  &__hint { margin: 0; font-size: 22px; }

  &__link {
    display: flex;
    gap: 10px;
    width: 100%;

    .field { flex: 1; min-width: 0; font-size: 18px; }
  }

  &__players {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;

    li {
      padding: 8px 12px;
      background: #0d0820;
      border: 3px solid var(--c);
      text-align: left;
      font-size: 24px;
      animation: msg-in 0.2s steps(3);
    }

    small {
      margin-left: 8px;
      padding: 2px 5px;
      background: var(--c);
      color: #000;
      font-family: var(--font-pixel);
      font-size: 8px;
      vertical-align: middle;
    }
  }

  &__wait { margin: 0; color: var(--cyan); font-size: 24px; }
  &__tip { margin: 0; color: var(--muted); font-size: 18px; text-align: center; }
}

.center-msg__actions {
  display: flex;
  gap: 12px;
}

/* ---------- Co-op turn bar ---------- */
.turns {
  list-style: none;
  margin: 0 0 4px;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;

  &__p {
    padding: 6px 10px;
    background: var(--panel);
    border: 3px solid #000;
    font-size: 22px;
    opacity: 0.6;

    small { color: var(--muted); }

    &--now {
      opacity: 1;
      border-color: var(--c);
      box-shadow: 4px 4px 0 #000;
      animation: wiggle 1s steps(2) infinite;
    }
  }
}

.board--mine {
  border-color: var(--turn, var(--white));
  box-shadow: 8px 8px 0 #000, 0 0 0 4px #000, 0 0 24px var(--turn, transparent);
}

.board__turn {
  display: inline-block;
  margin-right: 10px;
  padding: 3px 7px;
  background: var(--turn, var(--yellow));
  color: #000;
  border: 2px solid #000;
}
</style>
