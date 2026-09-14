#!/usr/bin/env node
/**
 * Build-time data fetch.
 *
 * PokéAPI's fair-use policy asks consumers to cache locally rather than hammer
 * the API on every page load. So instead of fetching at runtime, we pull the
 * whole dex once, here, and commit the result as static JSON. The app then
 * ships with an index it can search instantly and offline.
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

/** Types that exist in the API but that nothing is ever actually typed as. */
const EXCLUDED_TYPES = new Set(['unknown', 'shadow', 'stellar'])

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

/** species name -> id of the generation it was introduced in. */
async function buildGenerationMap() {
  const { results } = await get('generation?limit=100')
  const map = new Map()
  const labels = []

  for (const entry of results) {
    const gen = await get(`generation/${entry.name}`)
    labels.push({ id: gen.id, name: entry.name, region: gen.main_region?.name ?? null })
    for (const species of gen.pokemon_species) map.set(species.name, gen.id)
  }

  labels.sort((a, b) => a.id - b.id)
  return { map, labels }
}

const REGIONAL_MARKERS = ['alola', 'galar', 'hisui', 'paldea']

/**
 * Turn "charizard-mega-x" into { label: "Mega X", category: "mega" }.
 *
 * The API has no field for this — a form is just a Pokémon whose name starts
 * with its species name — so the suffix is all we have to go on.
 */
function describeForm(formName, speciesName) {
  const suffix = formName.startsWith(`${speciesName}-`)
    ? formName.slice(speciesName.length + 1)
    : formName

  const parts = suffix.split('-')
  const label = parts
    .map((part) => (part.length <= 2 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)))
    .join(' ')

  let category = 'other'
  if (parts.includes('mega')) category = 'mega'
  else if (parts.includes('gmax')) category = 'gmax'
  else if (parts.some((part) => REGIONAL_MARKERS.includes(part))) category = 'regional'

  return { label, category }
}

/** Pull the fields we keep out of a raw /pokemon response. */
function shape(p) {
  const stats = {}
  for (const s of p.stats) stats[s.stat.name] = s.base_stat

  return {
    id: p.id,
    name: p.name,
    types: [...p.types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
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
    abilities: [...p.abilities]
      .sort((a, b) => a.slot - b.slot)
      .map((a) => ({ name: a.ability.name, hidden: a.is_hidden })),
  }
}

/** Megas and Gigantamax first — they are what people come looking for. */
const FORM_ORDER = { mega: 0, gmax: 1, regional: 2, other: 3 }

async function main() {
  await mkdir(CACHE_DIR, { recursive: true })
  await mkdir(OUT_DIR, { recursive: true })

  console.log('→ type chart')
  const { types, chart } = await buildTypeChart()

  console.log('→ generations')
  const { map: genMap, labels: generations } = await buildGenerationMap()

  // /pokemon lists every variety, alternate forms included — those live above
  // id 10000. We fetch the lot and group them under their species, so the grid
  // can stay one card per species while each card still knows its forms.
  const { results: allEntries } = await get('pokemon?limit=100000')
  console.log(`→ ${allEntries.length} entries (species + forms)`)

  const raw = await pool(
    allEntries,
    async (entry) => {
      const p = await get(`pokemon/${idFromUrl(entry.url)}`)
      return {
        ...shape(p),
        isDefault: p.is_default === true,
        speciesId: idFromUrl(p.species.url),
        speciesName: p.species.name,
      }
    },
    (done, total) => process.stdout.write(`\r  ${done}/${total}`),
  )
  process.stdout.write('\n')

  const bySpecies = new Map()
  for (const entry of raw) {
    if (!bySpecies.has(entry.speciesId)) bySpecies.set(entry.speciesId, [])
    bySpecies.get(entry.speciesId).push(entry)
  }

  const pokemon = []
  for (const [speciesId, varieties] of bySpecies) {
    const base = varieties.find((v) => v.isDefault) ?? varieties[0]
    if (!base) continue

    const forms = varieties
      .filter((v) => v !== base)
      .map((v) => {
        const { label, category } = describeForm(v.name, base.speciesName)
        const { speciesId: _s, speciesName: _n, isDefault: _d, ...rest } = v
        return { ...rest, label, category }
      })
      .sort(
        (a, b) =>
          (FORM_ORDER[a.category] ?? 9) - (FORM_ORDER[b.category] ?? 9) ||
          a.label.localeCompare(b.label),
      )

    const { speciesId: _s, speciesName: _n, isDefault: _d, ...core } = base
    pokemon.push({
      ...core,
      id: speciesId,
      generation: genMap.get(base.speciesName) ?? 1,
      forms,
    })
  }

  pokemon.sort((a, b) => a.id - b.id)

  const formCount = pokemon.reduce((sum, entry) => sum + entry.forms.length, 0)

  await writeFile(
    join(OUT_DIR, 'pokedex.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), generations, pokemon }, null, 0),
  )
  await writeFile(join(OUT_DIR, 'type-chart.json'), JSON.stringify({ types, chart }, null, 2))

  console.log(
    `✓ wrote ${pokemon.length} Pokémon (+${formCount} forms) and ${types.length} types to public/data/`,
  )
}

main().catch((err) => {
  console.error('\n✗ fetch failed:', err.message)
  process.exit(1)
})
