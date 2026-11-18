// Hand the (public, read-only) TMDB token to the film data client.
// It's injected at build time from NUXT_PUBLIC_TMDB_TOKEN (.env locally, a GitHub secret in CI).
export default defineNuxtPlugin(() => {
  setTmdbToken(String(useRuntimeConfig().public.tmdbToken ?? ''))
})
