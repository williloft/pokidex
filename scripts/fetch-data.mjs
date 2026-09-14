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

/**
 * Version groups in release order, newest last.
 *
 * A Pokémon's move list is repeated once per game it has appeared in, and the
 * lists disagree — moves get added, removed and re-levelled every generation.
 * Rather than merge twenty contradictory learnsets, we keep the newest one each
 * Pokémon actually appears in, which is the one a player would recognise.
 */
async function buildVersionGroupRank() {
  const { results } = await get('version-group?limit=200')
  const rank = new Map()
  results.forEach((group, index) => rank.set(group.name, index))
  return rank
}

/** The learnset from the newest game this entry appears in. */
function learnset(p, vgRank) {
  let newest = -1
  for (const entry of p.moves) {
    for (const detail of entry.version_group_details) {
      const rank = vgRank.get(detail.version_group.name) ?? -1
      if (rank > newest) newest = rank
    }
  }
  if (newest < 0) return []

  const out = []
  for (const entry of p.moves) {
    const detail = entry.version_group_details.find(
      (d) => (vgRank.get(d.version_group.name) ?? -1) === newest,
    )
    if (!detail) continue
    out.push({
      name: entry.move.name,
      method: detail.move_learn_method.name,
      level: detail.level_learned_at ?? 0,
    })
  }
  return out
}

/**
 * Move data, keyed by name.
 *
 * Status moves are kept too — the dex page lists everything a Pokémon learns,
 * so leaving them out would put holes in the learnset. The battle is what
 * filters them, not the dataset.
 */
async function buildMoves(names) {
  const moves = {}

  await pool(
    [...names].sort(),
    async (name) => {
      const move = await get(`move/${name}`)

      const english = (entry) => entry.language.name === 'en'
      const effect = move.effect_entries?.find(english)
      const description = effect?.short_effect ?? effect?.effect ?? null

      moves[name] = {
        name,
        type: move.type?.name ?? 'normal',
        damageClass: move.damage_class?.name ?? 'status',
        // Status moves report null power; 0 says the same thing without a
        // nullable number spreading through the damage maths.
        power: typeof move.power === 'number' ? move.power : 0,
        // null means it never misses, and the games mean that literally.
        accuracy: typeof move.accuracy === 'number' ? move.accuracy : null,
        pp: move.pp ?? 10,
        priority: move.priority ?? 0,
        effect: description
          ? description.replace(/[\n\f­]/g, ' ').replace(/\s+/g, ' ').trim()
          : null,
      }
    },
    (done, total) => process.stdout.write(`\r  ${done}/${total}`),
  )
  process.stdout.write('\n')

  return moves
}

/**
 * Anything above this is a move with a catch we do not simulate — a recharge
 * turn, heavy recoil, or fainting the user. Including them would make them
 * strictly better here than they are in the games, so the cutoff keeps the
 * default movesets honest.
 */
const MAX_POWER = 120
const MOVESET_SIZE = 4

/**
 * Pick the four moves a Pokémon shows up with.
 *
 * Highest expected damage first, weighted for same-type bonus and for whichever
 * attacking stat it is actually built around — then one move per type, so a
 * Charizard arrives with coverage rather than four flavours of fire.
 */
function chooseMoveset(entry, learnable, moves) {
  const usable = learnable
    .map((line) => moves[line.name])
    .filter(
      (move) =>
        move && move.damageClass !== 'status' && move.power > 0 && move.power <= MAX_POWER,
    )

  if (usable.length === 0) return []

  const physical = entry.stats.attack >= entry.stats['special-attack']
  const score = (move) => {
    let value = (move.power * (move.accuracy ?? 100)) / 100
    if (entry.types.includes(move.type)) value *= 1.5
    if ((move.damageClass === 'physical') === physical) value *= 1.3
    return value
  }

  const ranked = [...usable].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))

  const picked = []
  const seenTypes = new Set()
  for (const move of ranked) {
    if (seenTypes.has(move.type)) continue
    seenTypes.add(move.type)
    picked.push(move.name)
    if (picked.length === MOVESET_SIZE) return picked
  }

  // Fewer than four types available: fill from what is left.
  for (const move of ranked) {
    if (picked.length === MOVESET_SIZE) break
    if (!picked.includes(move.name)) picked.push(move.name)
  }
  return picked
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

/**
 * Ability descriptions, keyed by ability name.
 *
 * There are only a few hundred of them and they are shared across the whole
 * dex, so fetching them once at build time is far cheaper than asking for them
 * per Pokémon at runtime — and it puts real text on the detail page.
 */
async function buildAbilityText(names) {
  const text = {}

  await pool(
    [...names].sort(),
    async (name) => {
      const ability = await get(`ability/${name}`)
      const english = (entry) => entry.language.name === 'en'

      const effect = ability.effect_entries?.find(english)
      const flavour = (ability.flavor_text_entries ?? []).filter(english).pop()

      const description =
        effect?.short_effect ?? effect?.effect ?? flavour?.flavor_text ?? null

      if (description) {
        text[name] = description.replace(/[\n\f\u00ad]/g, ' ').replace(/\s+/g, ' ').trim()
      }
    },
    (done, total) => process.stdout.write(`\r  ${done}/${total}`),
  )
  process.stdout.write('\n')

  return text
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true })
  await mkdir(OUT_DIR, { recursive: true })

  console.log('→ type chart')
  const { types, chart } = await buildTypeChart()

  console.log('→ generations')
  const { map: genMap, labels: generations } = await buildGenerationMap()

  console.log('→ version groups')
  const vgRank = await buildVersionGroupRank()

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
        learnable: learnset(p, vgRank),
      }
    },
    (done, total) => process.stdout.write(`\r  ${done}/${total}`),
  )
  process.stdout.write('\n')

  console.log('→ move data')
  const moveNames = new Set()
  for (const entry of raw) {
    for (const line of entry.learnable) moveNames.add(line.name)
  }
  const moves = await buildMoves(moveNames)

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
        const { speciesId: _s, speciesName: _n, isDefault: _d, learnable, ...rest } = v
        return { ...rest, label, category, moves: chooseMoveset(rest, learnable, moves) }
      })
      .sort(
        (a, b) =>
          (FORM_ORDER[a.category] ?? 9) - (FORM_ORDER[b.category] ?? 9) ||
          a.label.localeCompare(b.label),
      )

    const { speciesId: _s, speciesName: _n, isDefault: _d, learnable, ...core } = base
    pokemon.push({
      ...core,
      id: speciesId,
      generation: genMap.get(base.speciesName) ?? 1,
      forms,
      moves: chooseMoveset(core, learnable, moves),
    })
  }

  pokemon.sort((a, b) => a.id - b.id)

  const formCount = pokemon.reduce((sum, entry) => sum + entry.forms.length, 0)

  console.log('→ ability text')
  const abilityNames = new Set()
  for (const entry of pokemon) {
    for (const ability of entry.abilities) abilityNames.add(ability.name)
    for (const form of entry.forms) {
      for (const ability of form.abilities) abilityNames.add(ability.name)
    }
  }
  const abilities = await buildAbilityText(abilityNames)

  await writeFile(join(OUT_DIR, 'abilities.json'), JSON.stringify(abilities))
  await writeFile(join(OUT_DIR, 'moves.json'), JSON.stringify(moves))

  await writeFile(
    join(OUT_DIR, 'pokedex.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        generations,
        // Release order, so the detail page can pick out the newest learnset a
        // Pokémon appears in without re-deriving the ordering at runtime.
        versionGroups: [...vgRank.keys()],
        pokemon,
      },
      null,
      0,
    ),
  )
  await writeFile(join(OUT_DIR, 'type-chart.json'), JSON.stringify({ types, chart }, null, 2))

  const movelessCount = pokemon.filter((entry) => entry.moves.length === 0).length

  console.log(
    `✓ wrote ${pokemon.length} Pokémon (+${formCount} forms), ${types.length} types, ` +
      `${Object.keys(abilities).length} ability descriptions and ` +
      `${Object.keys(moves).length} moves to public/data/`,
  )
  if (movelessCount > 0) {
    console.log(`  note: ${movelessCount} entries learn no damaging move and will use Struggle`)
  }
}

main().catch((err) => {
  console.error('\n✗ fetch failed:', err.message)
  process.exit(1)
})
