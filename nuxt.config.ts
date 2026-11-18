// On GitHub Pages the site lives under /<repo-name>/ – the deploy workflow sets SITE_BASE_URL.
const base = process.env.SITE_BASE_URL || '/'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Pure browser app: GitHub Pages can only serve static files
  ssr: false,

  css: ['~/assets/scss/main.scss'],

  runtimeConfig: {
    public: {
      // Set NUXT_PUBLIC_TMDB_TOKEN in .env (or as a GitHub secret for deploys).
      // It ends up in the browser bundle – that's fine for TMDB's free read-only token.
      tmdbToken: '',
    },
  },

  app: {
    baseURL: base,
    head: {
      title: 'Actor Connect',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Link two random actors through the films they have been in. Play solo or co-op with friends!' },
        { name: 'theme-color', content: '#1a1033' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap' },
      ],
    },
  },
})
