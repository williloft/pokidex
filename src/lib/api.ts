import type { DexEntryText, EvolutionNode, LearnedMove, LearnMethod, PokemonDetail } from './types'

/**
 * Everything the grid needs ships as static JSON. Only the detail page reaches
 * out to PokéAPI, and only for the one Pokémon being looked at — which keeps us
 * on the right side of the fair-use policy instead of firing 1000 requests on
 * every page load like the original did.
 *
 * Responses are cached in localStorage, so a second visit is free.
 */

const BASE = 'https://pokeapi.co/api/v2'
const CACHE_PREFIX = 'pokedex:detail:'
// Bumped when the shape changes, so old cached entries are simply ignored
// rather than arriving without the fields the page now expects.
const CACHE_VERSION = 'v4'

const memory = new Map<number, PokemonDetail>()

/**
 * Version groups in release order, handed over once when the dex loads.
 *
 * Module state rather than a prop because every caller of fetchDetail would
 * otherwise have to thread the same constant through — including a prefetch
 * fired from a card deep in the grid, which would quietly cache a learnset
 * built from the wrong game if it ever passed the wrong one.
 */
let versionGroupOrder: readonly string[] = []

export function setVersionGroupOrder(order: readonly string[]): void {
  versionGroupOrder = order
}

function readCache(id: number): PokemonDetail | null {
  const cached = memory.get(id)
  if (cached) return cached
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${CACHE_VERSION}:${id}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PokemonDetail
    memory.set(id, parsed)
    return parsed
  } catch {
    return null
  }
}

function writeCache(id: number, detail: PokemonDetail): void {
  memory.set(id, detail)
  try {
    localStorage.setItem(`${CACHE_PREFIX}${CACHE_VERSION}:${id}`, JSON.stringify(detail))
  } catch {
    // Quota full or storage blocked — the in-memory cache still works.
  }
}

const idFromUrl = (url: string): number => Number(url.split('/').filter(Boolean).pop())

/** PokéAPI describes an evolution step with whichever fields apply. */
function describeTrigger(detail: {
  trigger?: { name: string } | null
  min_level?: number | null
  item?: { name: string } | null
  held_item?: { name: string } | null
  time_of_day?: string
  min_happiness?: number | null
  location?: { name: string } | null
  known_move?: { name: string } | null
}): string | null {
  const parts: string[] = []
  const pretty = (value: string) => value.replace(/-/g, ' ')

  if (detail.min_level) parts.push(`Lv. ${detail.min_level}`)
  if (detail.item) parts.push(pretty(detail.item.name))
  if (detail.held_item) parts.push(`holding ${pretty(detail.held_item.name)}`)
  if (detail.known_move) parts.push(`knows ${pretty(detail.known_move.name)}`)
  if (detail.min_happiness) parts.push('high friendship')
  if (detail.location) parts.push(`at ${pretty(detail.location.name)}`)
  if (detail.time_of_day) parts.push(detail.time_of_day)

  if (parts.length === 0 && detail.trigger) parts.push(pretty(detail.trigger.name))

  return parts.length > 0 ? parts.join(', ') : null
}

interface RawChainLink {
  species: { name: string; url: string }
  evolution_details: Parameters<typeof describeTrigger>[0][]
  evolves_to: RawChainLink[]
}

function toEvolutionTree(link: RawChainLink): EvolutionNode {
  return {
    id: idFromUrl(link.species.url),
    name: link.species.name,
    trigger: link.evolution_details.length > 0 ? describeTrigger(link.evolution_details[0]!) : null,
    children: link.evolves_to.map(toEvolutionTree),
  }
}

/**
 * Every English dex entry, newest first.
 *
 * Each game writes its own entry for the same Pokémon, so there are usually
 * twenty or more — and they differ, which is half the fun of a dex. Taking only
 * the newest left the page with a single sentence. Identical texts are folded
 * together, since a run of games often reuses the same wording.
 */
function collectEntries(
  raw: Array<{ flavor_text: string; language: { name: string }; version?: { name: string } }>,
): DexEntryText[] {
  const byText = new Map<string, DexEntryText>()

  for (const entry of raw) {
    if (entry.language.name !== 'en') continue

    // The API wraps these to the width of a game text box, soft hyphens and all.
    const text = entry.flavor_text
      .replace(/[\n\f\u00ad]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!text) continue

    // Later entries are newer, so overwriting keeps the most recent version.
    byText.set(text, { text, version: entry.version?.name ?? null })
  }

  return [...byText.values()].reverse()
}

interface RawMoveEntry {
  move: { name: string }
  version_group_details: Array<{
    level_learned_at: number
    version_group: { name: string }
    move_learn_method: { name: string }
  }>
}

const KNOWN_METHODS: LearnMethod[] = ['level-up', 'machine', 'egg', 'tutor']

/**
 * The learnset from the newest game this Pokémon appears in.
 *
 * The API repeats the move list once per game, and the lists disagree — moves
 * come and go and get re-levelled every generation. Merging twenty of them
 * would produce a learnset no game has ever had, so we take the newest one it
 * actually appears in and say which that is.
 *
 * `order` is the release order shipped with the dex; without it we cannot tell
 * which version group is newest and fall back to whatever the API listed last.
 */
function collectLearnset(raw: RawMoveEntry[], order: readonly string[]): LearnedMove[] {
  const rank = new Map(order.map((name, index) => [name, index]))
  const rankOf = (name: string) => rank.get(name) ?? -1

  let newest = -1
  let newestName: string | null = null
  for (const entry of raw) {
    for (const detail of entry.version_group_details) {
      const value = rankOf(detail.version_group.name)
      if (value > newest) {
        newest = value
        newestName = detail.version_group.name
      }
    }
  }
  if (newestName === null) return []

  const learnset: LearnedMove[] = []
  for (const entry of raw) {
    const detail = entry.version_group_details.find(
      (line) => line.version_group.name === newestName,
    )
    if (!detail) continue

    const method = detail.move_learn_method.name as LearnMethod
    learnset.push({
      name: entry.move.name,
      method: KNOWN_METHODS.includes(method) ? method : 'other',
      level: detail.level_learned_at ?? 0,
    })
  }

  return learnset
}

const learnsetMemory = new Map<number, LearnedMove[]>()

/**
 * The learnset for one specific variant.
 *
 * Keyed by the variant's own id rather than the species, because a regional
 * form does not learn what the base form learns — Alolan Raichu is not Raichu
 * with different colours.
 *
 * `fallbackId` covers the forms the API treats as a look rather than a
 * Pokémon: every Gigantamax entry comes back with an empty move list, and it
 * plainly still knows what the species knows.
 */
export async function fetchLearnset(
  id: number,
  fallbackId?: number,
  signal?: AbortSignal,
): Promise<LearnedMove[]> {
  const cached = learnsetMemory.get(id)
  if (cached) return cached

  const res = await fetch(`${BASE}/pokemon/${id}`, { signal })
  if (!res.ok) throw new Error(`Could not load moves for ${id} (${res.status})`)

  const pokemon = await res.json()
  let learnset = collectLearnset((pokemon.moves ?? []) as RawMoveEntry[], versionGroupOrder)

  if (learnset.length === 0 && fallbackId !== undefined && fallbackId !== id) {
    learnset = await fetchLearnset(fallbackId, undefined, signal)
  }

  learnsetMemory.set(id, learnset)
  return learnset
}

export async function fetchDetail(id: number, signal?: AbortSignal): Promise<PokemonDetail> {
  const cached = readCache(id)
  if (cached) return cached

  const speciesRes = await fetch(`${BASE}/pokemon-species/${id}`, { signal })
  if (!speciesRes.ok) throw new Error(`Could not load species ${id} (${speciesRes.status})`)
  const species = await speciesRes.json()

  // The chain and the learnset are independent of each other, so there is no
  // reason to wait for one before asking for the other.
  const [chainRes, pokemonRes] = await Promise.all([
    species.evolution_chain?.url
      ? fetch(species.evolution_chain.url, { signal }).catch(() => null)
      : Promise.resolve(null),
    fetch(`${BASE}/pokemon/${id}`, { signal }).catch(() => null),
  ])

  let evolution: EvolutionNode | null = null
  if (chainRes?.ok) {
    const chain = await chainRes.json()
    evolution = toEvolutionTree(chain.chain as RawChainLink)
  }

  // A missing learnset is a thinner page, not a broken one.
  let learnset: LearnedMove[] = []
  if (pokemonRes?.ok) {
    const pokemon = await pokemonRes.json()
    learnset = collectLearnset((pokemon.moves ?? []) as RawMoveEntry[], versionGroupOrder)
  }

  const detail: PokemonDetail = {
    id,
    entries: collectEntries(species.flavor_text_entries ?? []),
    genus:
      species.genera?.find((g: { language: { name: string } }) => g.language.name === 'en')?.genus ??
      null,
    evolution,
    eggGroups: (species.egg_groups ?? []).map((g: { name: string }) => g.name),
    captureRate: species.capture_rate ?? 0,
    growthRate: species.growth_rate?.name ?? null,
    learnset,
  }

  writeCache(id, detail)
  return detail
}

/** Warm the cache on hover so the detail page is already there on click. */
export function prefetchDetail(id: number): void {
  if (readCache(id)) return
  void fetchDetail(id).catch(() => {
    // Prefetch is best-effort; the real load will surface any error.
  })
}
