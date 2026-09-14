import type { Pokemon, StatName } from './types'
import { formViews, statTotal } from './types'

export type SortKey = 'relevance' | 'id' | 'name' | 'total' | StatName

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
  sort: 'relevance',
  direction: 'asc',
}

/**
 * A row in the grid: a species, plus which of its forms matched. Filtering by
 * Dragon surfaces Charizard wearing its Mega X art, because that is the variant
 * that actually matched.
 */
export interface DexEntry {
  pokemon: Pokemon
  /** API name of the matching form, or null for the base form. */
  formName: string | null
}

/** Display name: "mr-mime" -> "Mr. Mime", "charizard-mega-x" -> "Charizard Mega X". */
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
 * dex entry. Lower is better. -1 means no match.
 */
function nameScore(name: string, query: string): number {
  const index = name.indexOf(query)
  if (index === 0) return -1000 + name.length
  if (index > 0) return -500 + index + name.length

  let cursor = 0
  for (const char of query) {
    cursor = name.indexOf(char, cursor)
    if (cursor === -1) return -1
    cursor++
  }
  return cursor + name.length
}

interface Match {
  score: number
  formName: string | null
}

/** Score a species against the query, considering its forms too. */
function matchQuery(pokemon: Pokemon, query: string): Match | null {
  if (!query) return { score: 0, formName: null }

  if (/^\d+$/.test(query)) {
    return String(pokemon.id).startsWith(query) ? { score: pokemon.id, formName: null } : null
  }

  let best: Match | null = null
  const base = nameScore(pokemon.name.toLowerCase(), query)
  if (base !== -1) best = { score: base, formName: null }

  for (const form of pokemon.forms) {
    // "mega charizard" should find it as readily as "charizard mega".
    const haystack = `${form.label} ${pokemon.name}`.toLowerCase().replace(/-/g, ' ')
    const score = Math.min(
      nameScore(form.name.toLowerCase(), query),
      nameScore(haystack, query) === -1 ? Infinity : nameScore(haystack, query),
    )
    if (score !== -1 && Number.isFinite(score) && (!best || score < best.score)) {
      best = { score, formName: form.name }
    }
  }

  return best
}

/** Does this variant carry every selected type? */
const hasAllTypes = (types: readonly string[], required: readonly string[]) =>
  required.every((type) => types.includes(type))

export function filterAndSort(all: readonly Pokemon[], filters: Filters): DexEntry[] {
  const query = filters.query.trim().toLowerCase()
  const genSet = new Set(filters.generations)
  const wantsType = filters.types.length > 0

  const scored: Array<{ entry: DexEntry; score: number }> = []

  for (const pokemon of all) {
    if (genSet.size > 0 && !genSet.has(pokemon.generation)) continue

    const match = matchQuery(pokemon, query)
    if (!match) continue

    let formName = match.formName

    if (wantsType) {
      // The base form wins if it qualifies; otherwise show whichever form does.
      if (hasAllTypes(pokemon.types, filters.types)) {
        formName = match.formName && matchesFormTypes(pokemon, match.formName, filters.types)
          ? match.formName
          : null
      } else {
        const alternative = pokemon.forms.find((form) => hasAllTypes(form.types, filters.types))
        if (!alternative) continue
        formName = alternative.name
      }
    }

    scored.push({ entry: { pokemon, formName }, score: match.score })
  }

  const byRelevance = filters.sort === 'relevance' && query !== ''
  if (byRelevance) {
    scored.sort((a, b) => a.score - b.score || a.entry.pokemon.id - b.entry.pokemon.id)
    return scored.map((item) => item.entry)
  }

  const entries = scored.map((item) => item.entry)
  const sign = filters.direction === 'asc' ? 1 : -1

  entries.sort((a, b) => {
    let delta: number
    switch (filters.sort) {
      // With nothing to rank against, "best match" is just dex order.
      case 'relevance':
      case 'id':
        delta = a.pokemon.id - b.pokemon.id
        break
      case 'name':
        delta = a.pokemon.name.localeCompare(b.pokemon.name)
        break
      case 'total':
        delta = statTotal(a.pokemon.stats) - statTotal(b.pokemon.stats)
        break
      default:
        delta = a.pokemon.stats[filters.sort] - b.pokemon.stats[filters.sort]
    }
    return delta * sign || a.pokemon.id - b.pokemon.id
  })

  return entries
}

function matchesFormTypes(pokemon: Pokemon, formName: string, required: readonly string[]) {
  const view = formViews(pokemon).find((item) => item.name === formName)
  return view ? hasAllTypes(view.types, required) : false
}
