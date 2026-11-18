import type { Actor, Film, NewGameResponse, Suggestion } from '#shared/types/game'

/**
 * Film data, fetched straight from TMDB in the browser (so the game can be a static
 * GitHub Pages site). Without a token everything falls back to the built-in demo set.
 */

const API = 'https://api.themoviedb.org/3'
const IMG = 'https://image.tmdb.org/t/p'

let token = ''
/** Called once at startup by plugins/tmdb.client.ts */
export function setTmdbToken(t: string) {
  token = (t || '').trim()
}
export const isDemo = () => !token

// Every request is cached for the session, so undo / revisits / other players are instant
const cache = new Map<string, Promise<unknown>>()
function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) {
    cache.set(key, fn().catch((e) => {
      cache.delete(key)
      throw e
    }))
  }
  return cache.get(key) as Promise<T>
}

function tmdb<T>(path: string, query: Record<string, string | number> = {}): Promise<T> {
  // Long JWT-style token = v4 "Read Access Token" (Bearer). Short = v3 api_key.
  const isBearer = token.startsWith('eyJ')
  return $fetch<T>(`${API}${path}`, {
    query: { language: 'en-US', ...query, ...(isBearer ? {} : { api_key: token }) },
    headers: isBearer ? { Authorization: `Bearer ${token}` } : {},
  }) as Promise<T>
}

const img = (path: string | null | undefined, size: string) => (path ? `${IMG}/${size}${path}` : null)

interface TmdbPerson {
  id: number
  name: string
  profile_path: string | null
  adult: boolean
  known_for_department: string
  popularity: number
  known_for?: { media_type: string, original_language: string }[]
}

interface TmdbMovieCredit {
  id: number
  title: string
  release_date?: string
  poster_path: string | null
  character?: string
  popularity: number
  genre_ids: number[]
  video?: boolean
  adult?: boolean
}

interface TmdbCast {
  id: number
  name: string
  profile_path: string | null
  character?: string
  order: number
}

const DOCUMENTARY = 99

/** A pool of well-known, mostly English-language film actors to draw start/target from. */
function actorPool(): Promise<Actor[]> {
  if (isDemo()) return Promise.resolve(demoActorPool())
  return cached('pool', async () => {
    const pages = await Promise.all(
      [1, 2, 3, 4, 5, 6, 7, 8].map(page =>
        tmdb<{ results: TmdbPerson[] }>('/person/popular', { page }).catch(() => ({ results: [] })),
      ),
    )
    const seen = new Set<number>()
    const pool: Actor[] = []
    for (const p of pages.flatMap(r => r.results)) {
      if (seen.has(p.id) || p.adult || p.known_for_department !== 'Acting' || !p.profile_path) continue
      const englishFilms = (p.known_for ?? []).filter(k => k.media_type === 'movie' && k.original_language === 'en')
      if (englishFilms.length < 2) continue
      seen.add(p.id)
      pool.push({ id: p.id, name: p.name, image: img(p.profile_path, 'h632') })
    }
    return pool
  })
}

/** An actor's full filmography (minus unreleased titles and documentary "as themselves" spots). */
export function personMovies(id: number): Promise<Film[]> {
  if (isDemo()) return Promise.resolve(demoPersonMovies(id))
  return cached(`movies:${id}`, async () => {
    const data = await tmdb<{ cast: TmdbMovieCredit[] }>(`/person/${id}/movie_credits`)
    const seen = new Set<number>()
    return data.cast
      .filter((m) => {
        if (seen.has(m.id)) return false
        seen.add(m.id)
        return !m.genre_ids.includes(DOCUMENTARY) && !m.video && !!m.release_date
      })
      .sort((a, b) => b.popularity - a.popularity)
      .map(m => ({
        id: m.id,
        title: m.title,
        year: m.release_date!.slice(0, 4),
        image: img(m.poster_path, 'w185'),
        character: m.character || undefined,
      }))
  })
}

/** A film's full cast, in billing order. */
export function movieCast(id: number): Promise<Actor[]> {
  if (isDemo()) return Promise.resolve(demoMovieCast(id))
  return cached(`cast:${id}`, async () => {
    const data = await tmdb<{ cast: TmdbCast[] }>(`/movie/${id}/credits`)
    return data.cast
      .sort((a, b) => a.order - b.order)
      .map(c => ({
        id: c.id,
        name: c.name,
        image: img(c.profile_path, 'w185'),
        character: c.character || undefined,
      }))
  })
}

/** Autocomplete over the whole catalogue, so it helps with spelling without giving answers away. */
export function search(kind: 'movie' | 'person', q: string): Promise<Suggestion[]> {
  const query = q.trim().slice(0, 80)
  if (query.length < 2) return Promise.resolve([])
  if (isDemo()) return Promise.resolve(kind === 'movie' ? demoSearchMovies(query) : demoSearchPeople(query))

  return cached(`search:${kind}:${query.toLowerCase()}`, async () => {
    if (kind === 'movie') {
      const data = await tmdb<{ results: TmdbMovieCredit[] }>('/search/movie', { query, include_adult: 'false' })
      return data.results
        .filter(m => !m.adult)
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 7)
        .map(m => ({ id: m.id, title: m.title, subtitle: m.release_date?.slice(0, 4) || undefined, image: img(m.poster_path, 'w92') }))
    }
    const data = await tmdb<{ results: TmdbPerson[] }>('/search/person', { query, include_adult: 'false' })
    const acting = (p: TmdbPerson) => Number(p.known_for_department === 'Acting')
    return data.results
      .filter(p => !p.adult)
      .sort((a, b) => acting(b) - acting(a) || b.popularity - a.popularity)
      .slice(0, 7)
      .map(p => ({
        id: p.id,
        title: p.name,
        subtitle: p.known_for_department === 'Acting' ? undefined : p.known_for_department,
        image: img(p.profile_path, 'w92'),
      }))
  })
}

/**
 * Random START + TARGET who have NEVER been in a film together,
 * so every chain needs at least one actor in the middle.
 */
export async function newPair(): Promise<NewGameResponse> {
  const demo = isDemo()
  const pool = await actorPool()
  if (pool.length < 2) throw new Error('Could not load actors from TMDB. Check your TMDB token.')

  const filmsOf = (a: Actor) => personMovies(a.id).catch(() => null)

  for (let i = 0; i < 12; i++) {
    const a = Math.floor(Math.random() * pool.length)
    let b = Math.floor(Math.random() * (pool.length - 1))
    if (b >= a) b++
    const start = pool[a]!
    const target = pool[b]!

    const [startFilms, targetFilms] = await Promise.all([filmsOf(start), filmsOf(target)])
    if (!startFilms?.length || !targetFilms?.length) continue

    const startIds = new Set(startFilms.map(f => f.id))
    if (targetFilms.some(f => startIds.has(f.id))) continue

    return { start, target, demo }
  }
  throw new Error('Could not find a fair pair of actors. Try again.')
}
