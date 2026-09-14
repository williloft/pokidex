import type { EvolutionNode, PokemonDetail } from './types'

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
const CACHE_VERSION = 'v2'

const memory = new Map<number, PokemonDetail>()

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

/** English flavour text, newest entry first, with the line breaks cleaned up. */
function pickFlavorText(entries: Array<{ flavor_text: string; language: { name: string } }>) {
  const english = entries.filter((entry) => entry.language.name === 'en')
  const chosen = english[english.length - 1] ?? english[0]
  return chosen ? chosen.flavor_text.replace(/[\n\f­]/g, ' ').replace(/\s+/g, ' ').trim() : null
}

export async function fetchDetail(id: number, signal?: AbortSignal): Promise<PokemonDetail> {
  const cached = readCache(id)
  if (cached) return cached

  const speciesRes = await fetch(`${BASE}/pokemon-species/${id}`, { signal })
  if (!speciesRes.ok) throw new Error(`Could not load species ${id} (${speciesRes.status})`)
  const species = await speciesRes.json()

  let evolution: EvolutionNode | null = null
  if (species.evolution_chain?.url) {
    const chainRes = await fetch(species.evolution_chain.url, { signal })
    if (chainRes.ok) {
      const chain = await chainRes.json()
      evolution = toEvolutionTree(chain.chain as RawChainLink)
    }
  }

  const detail: PokemonDetail = {
    id,
    flavorText: pickFlavorText(species.flavor_text_entries ?? []),
    genus:
      species.genera?.find((g: { language: { name: string } }) => g.language.name === 'en')?.genus ??
      null,
    evolution,
    eggGroups: (species.egg_groups ?? []).map((g: { name: string }) => g.name),
    captureRate: species.capture_rate ?? 0,
    growthRate: species.growth_rate?.name ?? null,
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
