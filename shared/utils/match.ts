/**
 * Forgiving text matching for typed guesses:
 * ignores case, accents, punctuation, "&" vs "and", a leading "The", and small typos.
 */

export function normaliseText(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '')
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]!
}

/** How many typos we forgive for a guess of this length */
const tolerance = (len: number) => (len <= 4 ? 0 : len <= 8 ? 1 : len <= 16 ? 2 : 3)

/**
 * Returns every item the guess could reasonably mean (best matches only).
 * Empty = no match, 1 = clear match, 2+ = ambiguous (let the player choose).
 * A trailing year like "Ocean's Eleven 2001" or "(2001)" narrows film matches.
 */
export function findMatches<T>(
  items: T[],
  guess: string,
  name: (item: T) => string,
  year?: (item: T) => string | undefined,
): T[] {
  let text = guess
  let wantYear: string | undefined
  const y = text.match(/\(?\b((?:18|19|20)\d{2})\)?\s*$/)
  if (y && year && text.replace(y[0], '').trim()) {
    wantYear = y[1]
    text = text.replace(y[0], '')
  }

  const q = normaliseText(text)
  if (!q) return []
  const pool = wantYear ? items.filter(i => year!(i) === wantYear) : items

  // 1. exact
  const exact = pool.filter(i => normaliseText(name(i)) === q)
  if (exact.length) return exact

  // 2. main title before a subtitle ("Pirates of the Caribbean" → "...: The Curse of the Black Pearl")
  const main = pool.filter(i => normaliseText(name(i).split(/:| - /)[0]!) === q)
  if (main.length) return main

  // 3. close enough (typos, missing middle initials...)
  const tol = tolerance(q.length)
  let best = Infinity
  let out: T[] = []
  for (const i of pool) {
    const d = levenshtein(normaliseText(name(i)), q)
    if (d > tol) continue
    if (d < best) {
      best = d
      out = [i]
    }
    else if (d === best) {
      out.push(i)
    }
  }
  return out
}
