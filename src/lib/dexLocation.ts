import { parseFilters, serialiseFilters } from './useFilters'

const STORAGE_KEY = 'pokedex:last-search'

let lastSearch = ''

/**
 * The index route's query string, remembered across navigations.
 *
 * Without this, following a type link from a detail page would send you to a
 * bare `/?type=fire` — silently throwing away the generation filter and search
 * you had set, which reads as the app resetting itself.
 */
export function rememberSearch(search: string): void {
  lastSearch = search
  try {
    sessionStorage.setItem(STORAGE_KEY, search)
  } catch {
    // Falls back to the in-memory value for this session.
  }
}

function readSearch(): string {
  if (lastSearch) return lastSearch
  try {
    lastSearch = sessionStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    lastSearch = ''
  }
  return lastSearch
}

/** Where the grid lives. The root is the home page. */
const DEX_PATH = '/dex'

/** Link back to the dex exactly as the user left it. */
export const dexHref = (): string => `${DEX_PATH}${readSearch()}`

/** Link to the dex with one type applied on top of the existing filters. */
export function dexHrefWithType(type: string): string {
  const filters = parseFilters(new URLSearchParams(readSearch()))
  const types = filters.types.includes(type) ? filters.types : [...filters.types, type].slice(-2)
  const search = serialiseFilters({ ...filters, types })
  const query = search.toString()
  return query ? `${DEX_PATH}?${query}` : DEX_PATH
}
