#!/usr/bin/env node
/**
 * Build-time data fetch.
 *
 * PokéAPI's fair-use policy asks consumers to cache locally rather than hammer
 * the API on every page load. So instead of fetching at runtime, we pull the
 * whole national dex once, here, and commit the result as static JSON. The app
 * then ships with an index it can search instantly and offline.
 *
 * Responses are also cached on disk in .cache/ so re-running is nearly free.
 *
 *   node scripts/fetch-data.mjs          # incremental (uses .cache)
 *   node scripts/fetch-data.mjs --fresh  # ignore the cache
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_DIR = join(ROOT, '.cache')
const OUT_DIR = join(ROOT, 'public', 'data')
const BASE = 'https://pokeapi.co/api/v2'
const CONCURRENCY = 16
const FRESH = process.argv.includes('--fresh')

/** Types that exist in the API but not in any real battle. */
const EXCLUDED_TYPES = new Set(['unknown', 'shadow'])

/** @type {(path: string) => string} */
const cachePath = (path) => join(CACHE_DIR, path.replace(/[^a-z0-9]+/gi, '_') + '.json')

/** Fetch JSON from PokéAPI, memoised on disk. */
async function get(path) {
  const file = cachePath(path)
  if (!FRESH && existsSync(file)) {
    return JSON.parse(await readFile(file, 'utf8'))
  }
  const res = await fetch(`${BASE}/${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`)
  const json = await res.json()
  await writeFile(file, JSON.stringify(json))
  return json
}

/** Run `worker` over `items` with a bounded number of in-flight requests. */
async function pool(items, worker, onProgress) {
  const results = new Array(items.length)
  let cursor = 0
  let done = 0
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index], index)
      done++
      if (onProgress && done % 25 === 0) onProgress(done, items.length)
    }
  })
  await Promise.all(runners)
  if (onProgress) onProgress(items.length, items.length)
  return results
}

const idFromUrl = (url) => Number(url.split('/').filter(Boolean).pop())

/**
 * Build the attack-vs-defend multiplier table.
 * Shape: chart[attackingType][defendingType] = 0 | 0.5 | 1 | 2
 * Only non-1 entries are stored; the app treats a missing entry as 1x.
 */
async function buildTypeChart() {
  const { results } = await get('type?limit=100')
  const names = results.map((t) => t.name).filter((n) => !EXCLUDED_TYPES.has(n))

  const chart = {}
  await pool(names, async (name) => {
    const { damage_relations: rel } = await get(`type/${name}`)
    const row = {}
    for (const t of rel.no_damage_to) row[t.name] = 0
    for (const t of rel.half_damage_to) row[t.name] = 0.5
    for (const t of rel.double_damage_to) row[t.name] = 2
    chart[name] = row
  })

  return { types: names.sort(), chart }
}

/** species name -> { id, name } of the generation it was introduced in. */
async function buildGenerationMap() {
  const { results } = await get('generation?limit=100')
  const map = new Map()
  const labels = []

  for (const entry of results) {
    const gen = await get(`generation/${entry.name}`)
    const id = gen.id
    const region = gen.main_region?.name ?? null
    labels.push({ id, name: entry.name, region })
    for (const species of gen.pokemon_species) map.set(species.name, id)
  }

  labels.sort((a, b) => a.id - b.id)
  return { map, labels }
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true })
  await mkdir(OUT_DIR, { recursive: true })

  console.log('→ type chart')
  const { types, chart } = await buildTypeChart()

  console.log('→ generations')
  const { map: genMap, labels: generations } = await buildGenerationMap()

  // The national dex is exactly the set of species. Every species id has a
  // default form under /pokemon/{id}, so we can address them by number and
  // skip the alternate forms that live above id 10000.
  const { count } = await get('pokemon-species?limit=1')
  console.log(`→ ${count} species`)

  const ids = Array.from({ length: count }, (_, i) => i + 1)
  const pokemon = await pool(
    ids,
    async (id) => {
      const p = await get(`pokemon/${id}`)
      const stats = {}
      for (const s of p.stats) stats[s.stat.name] = s.base_stat
      return {
        id: p.id,
        name: p.name,
        types: p.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
        stats: {
          hp: stats['hp'] ?? 0,
          attack: stats['attack'] ?? 0,
          defense: stats['defense'] ?? 0,
          'special-attack': stats['special-attack'] ?? 0,
          'special-defense': stats['special-defense'] ?? 0,
          speed: stats['speed'] ?? 0,
        },
        height: p.height,
        weight: p.weight,
        abilities: p.abilities
          .sort((a, b) => a.slot - b.slot)
          .map((a) => ({ name: a.ability.name, hidden: a.is_hidden })),
        generation: genMap.get(p.species.name) ?? idFromUrl(p.species.url) ?? 1,
      }
    },
    (done, total) => process.stdout.write(`\r  ${done}/${total}`),
  )
  process.stdout.write('\n')

  await writeFile(
    join(OUT_DIR, 'pokedex.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), generations, pokemon }, null, 0),
  )
  await writeFile(join(OUT_DIR, 'type-chart.json'), JSON.stringify({ types, chart }, null, 2))

  console.log(`✓ wrote ${pokemon.length} Pokémon and ${types.length} types to public/data/`)
}

main().catch((err) => {
  console.error('\n✗ fetch failed:', err.message)
  process.exit(1)
})
