export interface Actor {
  id: number
  name: string
  /** Full image URL, or null if none */
  image: string | null
  /** e.g. character name when listed in a film's cast */
  character?: string
}

export interface Film {
  id: number
  title: string
  year: string
  image: string | null
  character?: string
}

export interface NewGameResponse {
  start: Actor
  target: Actor
  demo: boolean
}


/** Autocomplete suggestion (a film or a person) */
export interface Suggestion {
  id: number
  title: string
  subtitle?: string
  image: string | null
}

export interface Player {
  /** PeerJS id (the host's id for the host) */
  id: string
  name: string
  color: string
}
