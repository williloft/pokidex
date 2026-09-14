# Pokédex

A fast Pokédex built on [PokéAPI](https://pokeapi.co): search and filter the full
national dex, inspect any entry, and build a six-slot team with full
type-coverage analysis.

Rewritten from the H2 original — [what changed](#what-changed-from-the-original).

## Stack

React 19 · TypeScript (strict) · Vite 7 · React Router 7 · TanStack Virtual · Vitest

No UI framework, no CSS library — the styling is plain CSS with custom properties.

## Getting started

```sh
npm install
npm run fetch:data   # pulls the dex from PokéAPI into public/data (once)
npm run dev
```

`fetch:data` writes `public/data/pokedex.json` and `public/data/type-chart.json`.
**Commit both.** The app will not start without them, and committing them means
deployments never touch PokéAPI at build time.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Typecheck, then production bundle |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the unit tests |
| `npm run typecheck` | Types only |
| `npm run fetch:data` | Re-fetch the dex (add `--fresh` to bypass the disk cache) |

## How the data works

The original fired 1 + 151 requests at PokéAPI on every single page load, with no
caching. PokéAPI's fair-use policy explicitly asks consumers to cache locally, so
this version flips it around:

- **Build time** — `scripts/fetch-data.mjs` walks the whole national dex once
  (16 requests in flight at a time, every response cached on disk in `.cache/`)
  and writes two static JSON files.
- **Runtime** — the app fetches those two files from its own origin. Search,
  filtering, sorting and the entire team builder then run against an in-memory
  array, so they are instant and work offline.
- **On demand** — only the detail page reaches out to PokéAPI, and only for the
  one Pokémon being viewed (flavour text, evolution chain, breeding data).
  Responses are cached in `localStorage`, and hovering a card prefetches them.

Sprites and cries are not stored in the JSON at all — their URLs are derivable
from the dex number, which keeps the index small.

## Features

**Browsing**

- The full national dex, not just Gen 1
- Windowed grid — only the visible rows exist in the DOM, so 1000+ entries stay smooth
- Search by name or dex number, with a subsequence fallback so `sqrtl` still finds Squirtle
- Filter by type (one or two) and by generation; sort by name, dex number, or any base stat
- Every filter lives in the URL, so any view is shareable and the back button works
- `/` focuses search; arrow keys walk between entries on a detail page

**Detail page**

- Base stats, abilities, physical data, flavour text
- Defensive matchups computed from the type chart — what hits it for 4×, 2×, ½×, 0×
- Evolution chain rendered as a tree, so branching families display correctly
- Cry playback
- Shiny toggle that the whole app respects (the original's hardcoded shiny sprites, made a switch)

**Team builder**

- Up to six members, persisted in `localStorage`
- A heatmap of every attacking type against every member
- An "uncovered" callout listing types that hit the team with *nothing* resisting them —
  the actual hole in a team, which a per-Pokémon weakness list never shows you
- Average base stats across the roster

## Type effectiveness

`src/lib/typeChart.ts` is the only real logic in the app and the only part with
meaningful tests. Multipliers stack across a dual typing, and an immunity beats
any amount of weakness — Ground does nothing to a Ground/Flying target even
though Ground normally hits Rock for 2×.

```ts
effectiveness(chart, 'water', ['ground', 'rock'])  // 4
effectiveness(chart, 'ground', ['rock', 'flying']) // 0
```

The chart itself is derived from PokéAPI's `/type` endpoint at build time rather
than hardcoded, so it stays correct if the games change it again.

## Testing

```sh
npm test
```

28 tests covering the type chart (single, dual, immunity, unknown types),
defensive profiles, team coverage, uncovered-threat detection, and the
search/filter/sort pipeline. CI runs typecheck, tests and build on every push.

## Deploying

Any static host. On Vercel the defaults are correct (`npm run build` → `dist`),
with one thing to check: **Settings → Deployment Protection**. If it is on, every
visitor gets a Vercel login screen instead of the app.

## What changed from the original

The first version was written during H2. It worked in the browser, but not the
way it looked:

- `App.vue` held a `<script>` block of raw DOM manipulation — `XMLHttpRequest`,
  `createElement`, `appendChild` — that ran as a module side effect and wrote
  into `#root`. Meanwhile `main.js` called `app.mount('#app')`, and there was no
  `#app` in `index.html`. Vue never mounted. The router, `HomeView`, `AboutView`
  and `TheWelcome` were untouched scaffold that never ran.
- 152 uncached API requests per page load.
- Gen 1 only, no search, no filters, no detail view, no routing.
- `.card { width: 25% }` with no media queries; no loading or error states; no
  `alt` text.

This version keeps the one good idea from it — shiny sprites as the default look —
and rebuilds everything else.

## Credits

Data and sprites from [PokéAPI](https://pokeapi.co), used under its fair-use
policy. Pokémon is a trademark of Nintendo, Creatures Inc. and GAME FREAK Inc.
This is a non-commercial fan project.
