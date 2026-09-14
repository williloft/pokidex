import type { Pokemon, StatName } from './types'
import { statTotal } from './types'

export type SortKey = 'id' | 'name' | 'total' | StatName

export interface Filters {
  query: string
  /** Empty means "any type". One or two types, all of which must be present. */
  types: string[]
  generations: number[]
  sort: SortKey
  direction: 'asc' | 'desc'
}

export const DEFAULT_FILTERS: Filters = {
  query: '',
  types: [],
  generations: [],
  sort: 'id',
  direction: 'asc',
}

/** Display name: "mr-mime" -> "Mr. Mime", "ho-oh" -> "Ho-Oh". */
export function displayName(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .replace(/^Mr /, 'Mr. ')
    .replace(/^Mime Jr /, 'Mime Jr. ')
}

export const dexNumber = (id: number): string => `#${String(id).padStart(4, '0')}`

/**
 * Forgiving name match: a plain substring hit wins, but we also accept a
 * subsequence so "chrzd" still finds Charizard, and a bare number matches the
 * dex entry. Shorter names rank first so exact-ish matches float up.
 */
function matchScore(pokemon: Pokemon, query: string): number {
  if (!query) return 0

  if (/^\d+$/.test(query)) {
    return String(pokemon.id).startsWith(query) ? pokemon.id : -1
  }

  const name = pokemon.name.toLowerCase()
  const index = name.indexOf(query)
  if (index === 0) return -1000 + name.length
  if (index > 0) return -500 + index + name.length

  // subsequence fallback
  let cursor = 0
  for (const char of query) {
    cursor = name.indexOf(char, cursor)
    if (cursor === -1) return -1
    cursor++
  }
  return cursor + name.length
}

export function filterAndSort(all: readonly Pokemon[], filters: Filters): Pokemon[] {
  const query = filters.query.trim().toLowerCase()
  const typeSet = new Set(filters.types)
  const genSet = new Set(filters.generations)

  const scored: Array<{ pokemon: Pokemon; score: number }> = []

  for (const pokemon of all) {
    if (genSet.size > 0 && !genSet.has(pokemon.generation)) continue
    if (typeSet.size > 0 && !filters.types.every((t) => pokemon.types.includes(t))) continue

    const score = matchScore(pokemon, query)
    if (score === -1) continue
    scored.push({ pokemon, score })
  }

  // A search query orders by relevance; otherwise the chosen sort applies.
  if (query) {
    scored.sort((a, b) => a.score - b.score || a.pokemon.id - b.pokemon.id)
    return scored.map((entry) => entry.pokemon)
  }

  const sorted = scored.map((entry) => entry.pokemon)
  const sign = filters.direction === 'asc' ? 1 : -1

  sorted.sort((a, b) => {
    let delta: number
    switch (filters.sort) {
      case 'id':
        delta = a.id - b.id
        break
      case 'name':
        delta = a.name.localeCompare(b.name)
        break
      case 'total':
        delta = statTotal(a.stats) - statTotal(b.stats)
        break
      default:
        delta = a.stats[filters.sort] - b.stats[filters.sort]
    }
    return delta * sign || a.id - b.id
  })

  return sorted
}
