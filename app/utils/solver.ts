import type { Actor, Film } from '#shared/types/game'

/**
 * Works out the shortest chain between two actors, so the win screen can say
 * "this could be done in N films". Runs in the background while you play.
 *
 * - 2 films (START → film → someone → film → TARGET) is checked exhaustively.
 * - 3 films is checked using each side's most prominent co-stars (checking everyone
 *   would take thousands of requests), so a 3 it finds is real, but it can miss some.
 */

export interface RouteStep {
  actor: Actor
  film?: Film
}

export interface Par {
  /** Shortest number of films found, or null if nothing within 3 films was found */
  links: number | null
  route: RouteStep[]
}

const MAX_FILMS = 150 // per side – covers even the busiest filmographies' well-known work
const DEPTH3_ACTORS = 40 // co-stars per side to explore for 3-film routes

/** Run async jobs with at most `limit` in flight (be kind to the API) */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<(R | null)[]> {
  const out: (R | null)[] = Array.from({ length: items.length }, () => null)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      try {
        out[i] = await fn(items[i]!)
      }
      catch {}
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

interface CoStar {
  actor: Actor
  film: Film
  /** Lower = billed higher = more recognisable */
  rank: number
}

/** Everyone who has shared a film with `who`, with the film that links them */
async function coStarsOf(who: Actor): Promise<Map<number, CoStar>> {
  const films = (await personMovies(who.id)).slice(0, MAX_FILMS)
  const casts = await pool(films, 8, f => movieCast(f.id))
  const map = new Map<number, CoStar>()
  casts.forEach((cast, fi) => {
    cast?.forEach((actor, order) => {
      if (actor.id === who.id) return
      const rank = order + fi * 0.5 // top billing in a popular film wins
      const prev = map.get(actor.id)
      if (!prev || rank < prev.rank) map.set(actor.id, { actor, film: films[fi]!, rank })
    })
  })
  return map
}

export async function shortestRoute(start: Actor, target: Actor): Promise<Par> {
  const [a, b] = await Promise.all([coStarsOf(start), coStarsOf(target)])

  // 2 films: someone who has worked with both
  let best: { x: CoStar, y: CoStar } | null = null
  for (const [id, x] of a) {
    const y = b.get(id)
    if (y && (!best || x.rank + y.rank < best.x.rank + best.y.rank)) best = { x, y }
  }
  if (best) {
    return {
      links: 2,
      route: [
        { actor: start },
        { actor: best.x.actor, film: best.x.film },
        { actor: target, film: best.y.film },
      ],
    }
  }

  // 3 films: a co-star of START and a co-star of TARGET who share a film
  const top = (m: Map<number, CoStar>) =>
    [...m.values()].filter(c => c.actor.image).sort((p, q) => p.rank - q.rank).slice(0, DEPTH3_ACTORS)
  const [topA, topB] = [top(a), top(b)]
  const [filmsA, filmsB] = await Promise.all([
    pool(topA, 8, c => personMovies(c.actor.id)),
    pool(topB, 8, c => personMovies(c.actor.id)),
  ])

  const byFilmA = new Map<number, { x: CoStar, mid: Film }>()
  filmsA.forEach((list, i) => list?.forEach((f) => {
    if (!byFilmA.has(f.id)) byFilmA.set(f.id, { x: topA[i]!, mid: f })
  }))
  for (let i = 0; i < topB.length; i++) {
    const y = topB[i]!
    for (const f of filmsB[i] ?? []) {
      const hit = byFilmA.get(f.id)
      if (!hit || hit.x.actor.id === y.actor.id) continue
      if (f.id === hit.x.film.id || f.id === y.film.id) continue
      return {
        links: 3,
        route: [
          { actor: start },
          { actor: hit.x.actor, film: hit.x.film },
          { actor: y.actor, film: hit.mid },
          { actor: target, film: y.film },
        ],
      }
    }
  }

  return { links: null, route: [] }
}
