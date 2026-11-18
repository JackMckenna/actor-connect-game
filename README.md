# Actor Connect 🕹️

A bright, pixel-art web game: you get two random actors, a **START** and a **TARGET**.
**Type** a film the current actor was in, then **type** a co-star from that film to jump to them.
Keep going until you reach the target. **Fewer films = higher score.**

- Typos, accents, punctuation and a leading "The" are forgiven ("dark night" → The Dark Knight).
- Add a year to pick between remakes: `Ocean's Eleven 2001`.
- The autocomplete searches *all* of TMDB, so it helps with spelling without giving answers away.
- Stuck? **HINT** shows a masked answer (`F______ G___ (1994)`) for -50 pts. Wrong guesses are free.

The START and TARGET are always two actors who have **never been in a film together**,
so every chain needs at least one actor in the middle (minimum 2 films).

| Films in chain | Score | Rank |
| --- | --- | --- |
| 2 | 1000 | LEGENDARY! |
| 3 | 850 | AMAZING! |
| 4 | 700 | GREAT! |
| 5 | 550 | NICE |
| 6-7 | 400-250 | NOT BAD |
| 8+ | 100+ | MADE IT |

(minus 50 per hint, minimum 100)

## Co-op multiplayer

Click **HOST A CO-OP GAME**, send the invite link (`…/actor-connect-game/?room=K7QX2`) to friends,
and build **one chain together**, taking turns. Each correct film or co-star passes the turn on;
wrong guesses keep the turn, and **PASS** hands it over if you're stuck. Friends can join mid-game.

Players talk through a free public MQTT message broker (HiveMQ, with EMQX as a fallback) over secure
WebSockets, so it works across home wi-fi, mobile data and most work networks with no backend or accounts.
The **host's browser runs the game**, so the host must keep their tab open. Room messages aren't secret
(anyone with the room code could read them), which is fine for a game.

Built with **Nuxt 4** (Vue 3 + SCSS). Film data comes from [TMDB](https://www.themoviedb.org), the same open
database Letterboxd uses (IMDb and Letterboxd don't offer public APIs).

## Setup

```bash
npm install
cp .env.example .env   # then paste your TMDB token in (optional, see below)
npm run dev            # http://localhost:3000
```

### TMDB key

1. Create a free account at themoviedb.org → **Settings → API** → request a key.
2. Put either the **API Read Access Token** (long, starts `eyJ`) or the short **API Key** in `.env`:
   ```
   NUXT_PUBLIC_TMDB_TOKEN=eyJhbGciOi...
   ```
3. Restart `npm run dev`.

Without a key the game runs in **DEMO MODE** with ~35 well-known films built in (`app/utils/demoData.ts`).

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds a static site and publishes it on every push to `main`.
One-time setup in the GitHub repo:

1. **Settings → Secrets and variables → Actions → New repository secret**: name `TMDB_TOKEN`, value = your token.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main` (or run the workflow from the **Actions** tab). The site appears at
   `https://<username>.github.io/<repo-name>/`.

The token is baked into the page at build time, so it is visible to anyone who inspects the site.
That's normal for TMDB's free read-only token. If it's ever abused, regenerate it on TMDB and update the secret.

To test the Pages build locally: `SITE_BASE_URL=/actor-connect-game/ npx nuxi generate --preset github_pages`
(in Git Bash on Windows prefix it with `MSYS_NO_PATHCONV=1` or the path gets mangled).

## How it fits together

There is no server: everything runs in the browser.

```
app/
  pages/index.vue             menu, lobby, game board, win screen
  composables/useGame.ts      game engine: chain, guess checking, hints, undo, scoring, co-op turns & sync
  utils/movieApi.ts           TMDB client (filmographies, casts, search, random fair pairs), cached per session
  utils/net.ts                lobbies over public MQTT brokers: host runs the game, guests send moves
  utils/demoData.ts           offline demo film set (used when no token is set)
  components/GuessBox.vue     typing box + autocomplete
  components/ChainBoard.vue   the picture chain across the top (start → film → actor → … → target)
  components/                 ChainCard, PixelImage, WinScreen
  plugins/tmdb.client.ts      hands the token to the TMDB client
  assets/scss/main.scss       pixel theme (colours, buttons, fonts)
shared/utils/match.ts         forgiving guess matching (typos, accents, years)
```

Controls: type + **Enter**, **↑/↓** to pick a suggestion, **Esc** (outside the box) = undo.

_This product uses the TMDB API but is not endorsed or certified by TMDB._
