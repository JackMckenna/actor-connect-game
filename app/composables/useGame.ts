import type { Actor, Film, Player } from '#shared/types/game'
import type { GuestHandle, HostHandle } from '~/utils/net'

export interface ChainLink {
  actor: Actor
  /** The film that connects this actor to the previous one (absent for the start actor) */
  film?: Film
}

export interface Guess {
  text: string
  /** Set when the player picked an autocomplete suggestion */
  id?: number
}

export interface Feedback {
  kind: 'good' | 'bad' | 'info'
  text: string
  /** Bumps on every new message so identical texts still register as new */
  n: number
}

type Status = 'title' | 'connecting' | 'lobby' | 'loading' | 'playing' | 'won' | 'error'
type Phase = 'film' | 'cast'
export type Mode = 'solo' | 'host' | 'guest'

/** Everything a guest needs to draw the game – sent by the host after every change */
interface SyncedState {
  status: Status
  phase: Phase
  demo: boolean
  start: Actor | null
  target: Actor | null
  chain: ChainLink[]
  selectedFilm: Film | null
  listLoading: boolean
  deadEnd: boolean
  error: string | null
  feedback: Feedback | null
  choices: (Film | Actor)[]
  misses: number
  hints: number
  players: Player[]
  turn: number
}

/** What a player can do – in multiplayer these travel guest → host */
type Action =
  | { type: 'guess', guess: Guess }
  | { type: 'choose', id: number }
  | { type: 'hint' }
  | { type: 'undo' }
  | { type: 'pass' }
  | { type: 'newGame' }

const BEST_KEY = 'actor-connect:best'
const NAME_KEY = 'actor-connect:name'
export const HINT_COST = 50
/** Start & target never share a film, so the shortest possible chain is 2 films */
export const MIN_LINKS = 2
const PLAYER_COLORS = ['#2bd9fe', '#ff3cac', '#ffe14d', '#3dff8b', '#ff8a3d', '#a66bff', '#ff6b6b', '#7dffea']

/** Score for a finished chain. 2 films = perfect; each hint costs a little. */
export function scoreFor(links: number, hints = 0) {
  const extra = Math.max(0, links - MIN_LINKS)
  return Math.max(100, 1000 - extra * 150 - hints * HINT_COST)
}

export function rankFor(links: number) {
  if (links <= 2) return { label: 'LEGENDARY!', color: 'var(--yellow)' }
  if (links === 3) return { label: 'AMAZING!', color: 'var(--green)' }
  if (links === 4) return { label: 'GREAT!', color: 'var(--cyan)' }
  if (links === 5) return { label: 'NICE', color: 'var(--pink)' }
  if (links <= 7) return { label: 'NOT BAD', color: 'var(--orange)' }
  return { label: 'MADE IT', color: 'var(--white)' }
}

/** "Forrest Gump" → "F______ G___" */
function mask(s: string) {
  return s.replace(/\p{L}+/gu, w => w[0] + '_'.repeat(w.length - 1))
}

const pickRandom = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

// Network handles live outside Vue state (they aren't serialisable)
let host: HostHandle | null = null
let guest: GuestHandle | null = null
let feedbackN = 0

export function useGame() {
  /* ---------- synced game state ---------- */
  const status = useState<Status>('status', () => 'title')
  const phase = useState<Phase>('phase', () => 'film')
  const demo = useState('demo', () => false)
  const start = useState<Actor | null>('start', () => null)
  const target = useState<Actor | null>('target', () => null)
  const chain = useState<ChainLink[]>('chain', () => [])
  const selectedFilm = useState<Film | null>('selectedFilm', () => null)
  const listLoading = useState('listLoading', () => false)
  const error = useState<string | null>('error', () => null)
  const feedback = useState<Feedback | null>('feedback', () => null)
  /** Ambiguous guess: let the player choose which one they meant */
  const choices = useState<(Film | Actor)[]>('choices', () => [])
  const misses = useState('misses', () => 0)
  const hints = useState('hints', () => 0)
  const players = useState<Player[]>('players', () => [])
  const turn = useState('turn', () => 0)
  /** Guests can't compute this (they don't hold the answer lists), so the host sends it */
  const syncedDeadEnd = useState('syncedDeadEnd', () => false)

  /* ---------- local-only state ---------- */
  const mode = useState<Mode>('mode', () => 'solo')
  const myId = useState('myId', () => 'me')
  const myName = useState('myName', () => '')
  const roomCode = useState('roomCode', () => '')
  /** Hidden answer lists for the current step (host / solo only) */
  const films = useState<Film[]>('films', () => [])
  const cast = useState<Actor[]>('cast', () => [])
  const best = useState<number>('best', () => 0)
  const newBest = useState('newBest', () => false)

  /* ---------- derived ---------- */
  const current = computed(() => chain.value.at(-1)?.actor ?? null)
  const links = computed(() => chain.value.length - 1)
  /** Score you'd get if your next pick hits the target */
  const potentialScore = computed(() => scoreFor(links.value + 1, hints.value))
  const usedActorIds = computed(() => new Set(chain.value.map(l => l.actor.id)))
  const usedFilmIds = computed(() => new Set(chain.value.flatMap(l => (l.film ? [l.film.id] : []))))
  const openFilms = computed(() => films.value.filter(f => !usedFilmIds.value.has(f.id)))
  const openCast = computed(() => cast.value.filter(a => !usedActorIds.value.has(a.id)))
  const multiplayer = computed(() => mode.value !== 'solo')
  const isHost = computed(() => mode.value === 'host')
  const currentPlayer = computed(() => players.value[turn.value] ?? null)
  const isMyTurn = computed(() => !multiplayer.value || currentPlayer.value?.id === myId.value)
  const deadEnd = computed(() => {
    if (mode.value === 'guest') return syncedDeadEnd.value
    return !listLoading.value && !error.value
      && (phase.value === 'film' ? !openFilms.value.length : !openCast.value.length)
  })

  /* ---------- sync (host → guests) ---------- */
  function snapshot(): SyncedState {
    return {
      status: status.value,
      phase: phase.value,
      demo: demo.value,
      start: start.value,
      target: target.value,
      chain: chain.value,
      selectedFilm: selectedFilm.value,
      listLoading: listLoading.value,
      deadEnd: deadEnd.value,
      error: error.value,
      feedback: feedback.value,
      choices: choices.value,
      misses: misses.value,
      hints: hints.value,
      players: players.value,
      turn: turn.value,
    }
  }

  function applySnapshot(s: SyncedState) {
    status.value = s.status
    phase.value = s.phase
    demo.value = s.demo
    start.value = s.start
    target.value = s.target
    chain.value = s.chain
    selectedFilm.value = s.selectedFilm
    listLoading.value = s.listLoading
    syncedDeadEnd.value = s.deadEnd
    error.value = s.error
    feedback.value = s.feedback
    choices.value = s.choices
    misses.value = s.misses
    hints.value = s.hints
    players.value = s.players
    turn.value = s.turn
  }

  let broadcastQueued = false
  function sync() {
    if (!host || broadcastQueued) return
    broadcastQueued = true
    // Batch all changes made in the same tick into one message
    queueMicrotask(() => {
      broadcastQueued = false
      host?.broadcast(JSON.parse(JSON.stringify(snapshot())))
    })
  }

  /* ---------- helpers ---------- */
  const nameOf = (id: string) => players.value.find(p => p.id === id)?.name ?? 'Someone'
  /** "Sam: " prefix on messages in multiplayer so everyone knows who did what */
  const who = (by: string) => (multiplayer.value ? `${nameOf(by)}: ` : '')

  function say(kind: Feedback['kind'], text: string) {
    feedback.value = { kind, text, n: ++feedbackN }
  }

  function clearStep() {
    feedback.value = null
    choices.value = []
    error.value = null
  }

  function nextTurn() {
    if (players.value.length) turn.value = (turn.value + 1) % players.value.length
  }

  function loadBest() {
    if (!import.meta.client) return
    try {
      best.value = Number(localStorage.getItem(BEST_KEY) ?? 0)
      myName.value = localStorage.getItem(NAME_KEY) ?? ''
    }
    catch {}
  }

  function rememberName(name: string) {
    myName.value = name
    try {
      localStorage.setItem(NAME_KEY, name)
    }
    catch {}
  }

  /* ---------- game engine (runs in solo, or on the host) ---------- */

  async function loadFilms() {
    if (!current.value) return
    listLoading.value = true
    films.value = []
    sync()
    try {
      films.value = await personMovies(current.value.id)
    }
    catch {
      error.value = 'Could not load films. Try again.'
    }
    finally {
      listLoading.value = false
      sync()
    }
  }

  async function startRound() {
    status.value = 'loading'
    clearStep()
    selectedFilm.value = null
    phase.value = 'film'
    misses.value = 0
    hints.value = 0
    turn.value = 0
    sync()
    try {
      const res = await newPair()
      start.value = res.start
      target.value = res.target
      demo.value = res.demo
      chain.value = [{ actor: res.start }]
      status.value = 'playing'
      await loadFilms()
    }
    catch (e: any) {
      error.value = e?.message ?? 'Could not start a game.'
      status.value = 'error'
    }
    sync()
  }

  async function chooseFilm(film: Film, by: string) {
    clearStep()
    say('good', `${who(by)}YES! ${current.value?.name} was in ${film.title} (${film.year})`)
    selectedFilm.value = film
    phase.value = 'cast'
    listLoading.value = true
    cast.value = []
    sync()
    try {
      const list = await movieCast(film.id)
      // The actor you came from doesn't count as a co-star
      cast.value = list.filter(a => a.id !== current.value?.id)
    }
    catch {
      error.value = 'Could not load cast. Try again.'
    }
    finally {
      listLoading.value = false
      sync()
    }

    // Auto-connect: if the TARGET is in this film too, the chain is complete
    const t = target.value
    if (t && cast.value.some(a => a.id === t.id)) {
      await chooseActor(cast.value.find(a => a.id === t.id)!, by)
    }
  }

  async function chooseActor(actor: Actor, by: string) {
    if (!selectedFilm.value) return
    clearStep()
    chain.value = [...chain.value, { actor, film: selectedFilm.value }]
    selectedFilm.value = null

    if (actor.id === target.value?.id) {
      const score = scoreFor(links.value, hints.value)
      newBest.value = !multiplayer.value && score > best.value
      if (newBest.value) {
        best.value = score
        try {
          localStorage.setItem(BEST_KEY, String(score))
        }
        catch {}
      }
      status.value = 'won'
      sync()
      return
    }
    say('good', `${who(by)}YES! ${actor.name} is in it.`)
    phase.value = 'film'
    await loadFilms()
  }

  function miss(text: string) {
    misses.value++
    choices.value = []
    say('bad', text)
    return false
  }

  /** Returns true if the guess moved the chain forward */
  async function guessFilm(g: Guess, by: string): Promise<boolean> {
    if (listLoading.value || !current.value) return false
    const matches = g.id != null
      ? films.value.filter(f => f.id === g.id)
      : findMatches(films.value, g.text, f => f.title, f => f.year)

    if (!matches.length) {
      return miss(demo.value
        ? `${who(by)}"${g.text}" isn't one of ${current.value.name}'s films in the small DEMO list. Add a TMDB key for every film.`
        : `${who(by)}NOPE! ${current.value.name} wasn't in "${g.text}".`)
    }
    const open = matches.filter(f => !usedFilmIds.value.has(f.id))
    if (!open.length) return miss(`${who(by)}${matches[0]!.title} is already in the chain. Pick another film.`)
    if (open.length > 1) {
      choices.value = open
      say('info', `${who(by)}WHICH ONE DID YOU MEAN?`)
      return false
    }
    await chooseFilm(open[0]!, by)
    return true
  }

  async function guessActor(g: Guess, by: string): Promise<boolean> {
    if (listLoading.value || !selectedFilm.value) return false
    const matches = g.id != null
      ? cast.value.filter(a => a.id === g.id)
      : findMatches(cast.value, g.text, a => a.name)

    if (!matches.length) {
      const typedSelf = current.value && findMatches([current.value], g.text, a => a.name).length
      return miss(`${who(by)}${typedSelf
        ? `That's who we're jumping FROM. Name someone else in ${selectedFilm.value.title}.`
        : demo.value
          ? `"${g.text}" isn't in the DEMO cast list for ${selectedFilm.value.title}. Add a TMDB key for full casts.`
          : `NOPE! "${g.text}" isn't in ${selectedFilm.value.title}.`}`)
    }
    const open = matches.filter(a => !usedActorIds.value.has(a.id))
    if (!open.length) return miss(`${who(by)}${matches[0]!.name} is already in the chain.`)
    if (open.length > 1) {
      choices.value = open
      say('info', `${who(by)}WHICH ONE DID YOU MEAN?`)
      return false
    }
    await chooseActor(open[0]!, by)
    return true
  }

  /** Reveal a masked answer from the more famous options. Costs points. */
  function giveHint(by: string) {
    if (phase.value === 'film') {
      const f = pickRandom(openFilms.value.slice(0, 8))
      if (!f) return
      say('info', `${who(by)}HINT: ${mask(f.title)} (${f.year})`)
    }
    else {
      // Top-billed actors are the fairest hint; nudge toward the target if they're in it
      const a = openCast.value.find(x => x.id === target.value?.id) ?? pickRandom(openCast.value.slice(0, 8))
      if (!a) return
      say('info', `${who(by)}HINT: ${mask(a.name)}${a.character ? ` played ${a.character}` : ''}`)
    }
    choices.value = []
    hints.value++
  }

  async function stepBack() {
    clearStep()
    if (phase.value === 'cast') {
      selectedFilm.value = null
      phase.value = 'film'
      return
    }
    if (chain.value.length > 1) {
      chain.value = chain.value.slice(0, -1)
      await loadFilms()
    }
  }

  /** Every action goes through here – locally in solo / on the host, after a turn check */
  async function handle(action: Action, by: string) {
    if (action.type === 'newGame') {
      if (by === myId.value) await startRound() // only the host (or solo player) can deal a new pair
      return
    }
    if (status.value !== 'playing') return
    if (multiplayer.value && currentPlayer.value?.id !== by) return // not your turn

    // One co-op turn = name a film AND a co-star from it; the turn passes once the co-star lands
    const wasNamingActor = phase.value === 'cast'
    const turnBefore = turn.value

    switch (action.type) {
      case 'guess': {
        const ok = wasNamingActor ? await guessActor(action.guess, by) : await guessFilm(action.guess, by)
        if (ok && wasNamingActor && status.value === 'playing') nextTurn()
        break
      }
      case 'choose': {
        const item = choices.value.find(c => c.id === action.id)
        if (!item) break
        if (wasNamingActor) await chooseActor(item as Actor, by)
        else await chooseFilm(item as Film, by)
        if (wasNamingActor && status.value === 'playing') nextTurn()
        break
      }
      case 'hint':
        giveHint(by)
        break
      case 'undo':
        await stepBack()
        break
      case 'pass':
        if (multiplayer.value) {
          nextTurn()
          say('info', `${nameOf(by)} passed. Over to ${currentPlayer.value?.name}!`)
        }
        break
    }
    // Turn just moved on after a co-star landed: tell everyone who's up
    if (action.type !== 'pass' && turn.value !== turnBefore && players.value.length > 1 && feedback.value?.kind === 'good') {
      feedback.value = { ...feedback.value, text: `${feedback.value.text} Over to ${currentPlayer.value?.name}!` }
    }
    sync()
  }

  /** Send an action: straight to the engine, or to the host if we're a guest */
  function act(action: Action) {
    if (mode.value === 'guest') guest?.send(action)
    else void handle(action, myId.value)
  }

  /* ---------- public actions ---------- */
  const guess = (g: Guess) => act({ type: 'guess', guess: g })
  const choose = (item: Film | Actor) => act({ type: 'choose', id: item.id })
  const hint = () => act({ type: 'hint' })
  const undo = () => act({ type: 'undo' })
  const pass = () => act({ type: 'pass' })
  const newGame = () => act({ type: 'newGame' })

  function playSolo() {
    leave()
    mode.value = 'solo'
    myId.value = 'me'
    void startRound()
  }

  /* ---------- lobbies ---------- */

  async function hostLobby(name: string) {
    leave()
    rememberName(name)
    status.value = 'connecting'
    try {
      host = await createHost({
        onJoin(id, joinName) {
          if (players.value.some(p => p.id === id)) return
          players.value = [...players.value, {
            id,
            name: joinName.slice(0, 16) || 'Player',
            color: PLAYER_COLORS[players.value.length % PLAYER_COLORS.length]!,
          }]
          if (status.value !== 'lobby') say('info', `${joinName} joined the game!`)
          sync()
        },
        onLeave(id) {
          const idx = players.value.findIndex(p => p.id === id)
          if (idx < 0) return
          const left = players.value[idx]!
          players.value = players.value.filter(p => p.id !== id)
          if (idx < turn.value) turn.value--
          if (turn.value >= players.value.length) turn.value = 0
          say('info', `${left.name} left the game.`)
          sync()
        },
        onAction(id, action) {
          void handle(action as Action, id)
        },
      })
      mode.value = 'host'
      myId.value = host.id
      roomCode.value = host.code
      players.value = [{ id: host.id, name, color: PLAYER_COLORS[0]! }]
      status.value = 'lobby'
      setRoomInUrl(host.code)
      sync()
    }
    catch (e: any) {
      host = null
      error.value = e?.message ?? 'Could not create a lobby. Check your internet connection and try again.'
      status.value = 'error'
    }
  }

  async function joinLobby(code: string, name: string) {
    leave()
    rememberName(name)
    roomCode.value = code
    status.value = 'connecting'
    try {
      guest = await joinHost(code, name, {
        onState(state, you) {
          myId.value = you
          applySnapshot(state as SyncedState)
        },
        onClose(reason) {
          guest?.destroy()
          guest = null
          error.value = reason
          status.value = 'error'
        },
      })
      mode.value = 'guest'
      myId.value = guest.id
    }
    catch (e: any) {
      guest = null
      error.value = e?.message ?? 'Could not join the game.'
      status.value = 'error'
    }
  }

  /** Leave any lobby and go back to the title screen */
  function leave() {
    host?.destroy()
    guest?.destroy()
    host = null
    guest = null
    mode.value = 'solo'
    myId.value = 'me'
    players.value = []
    turn.value = 0
    clearStep()
    status.value = 'title'
  }

  function exitToTitle() {
    leave()
    roomCode.value = ''
    setRoomInUrl(null)
  }

  const shareLink = computed(() => {
    if (!import.meta.client || !roomCode.value) return ''
    return `${window.location.origin}${window.location.pathname}?room=${roomCode.value}`
  })

  return {
    // state
    status, phase, demo, start, target, chain, selectedFilm, listLoading, error, feedback, choices,
    misses, hints, best, newBest, players, turn, mode, myId, myName, roomCode,
    // derived
    current, links, potentialScore, deadEnd, multiplayer, isHost, currentPlayer, isMyTurn, shareLink,
    // actions
    loadBest, playSolo, newGame, guess, choose, hint, undo, pass, hostLobby, joinLobby, exitToTitle,
  }
}

function setRoomInUrl(code: string | null) {
  if (!import.meta.client) return
  const url = new URL(window.location.href)
  if (code) url.searchParams.set('room', code)
  else url.searchParams.delete('room')
  window.history.replaceState(null, '', url)
}
