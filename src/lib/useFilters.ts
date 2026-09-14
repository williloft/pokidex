import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_FILTERS, type Filters, type SortKey } from './pokedex'

const SORT_KEYS: SortKey[] = [
  'relevance',
  'id',
  'name',
  'total',
  'hp',
  'attack',
  'defense',
  'special-attack',
  'special-defense',
  'speed',
]

const parseList = (value: string | null): string[] =>
  value ? value.split(',').filter(Boolean) : []

/** Read filters out of a query string. Unknown values fall back to defaults. */
export function parseFilters(params: URLSearchParams): Filters {
  const sort = params.get('sort') as SortKey | null
  return {
    query: params.get('q') ?? DEFAULT_FILTERS.query,
    types: parseList(params.get('type')),
    generations: parseList(params.get('gen')).map(Number).filter(Number.isFinite),
    sort: sort && SORT_KEYS.includes(sort) ? sort : DEFAULT_FILTERS.sort,
    direction: params.get('dir') === 'desc' ? 'desc' : 'asc',
  }
}

/** Write filters back to a query string, omitting anything at its default. */
export function serialiseFilters(filters: Filters): URLSearchParams {
  const search = new URLSearchParams()
  if (filters.query) search.set('q', filters.query)
  if (filters.types.length > 0) search.set('type', filters.types.join(','))
  if (filters.generations.length > 0) search.set('gen', filters.generations.join(','))
  if (filters.sort !== DEFAULT_FILTERS.sort) search.set('sort', filters.sort)
  if (filters.direction !== DEFAULT_FILTERS.direction) search.set('dir', filters.direction)
  return search
}

/**
 * Filters live in the URL rather than in component state, so any view can be
 * shared, bookmarked, or reached with the back button.
 */
export function useFilters(): [Filters, (patch: Partial<Filters>) => void, () => void] {
  const [params, setParams] = useSearchParams()

  const filters = useMemo(() => parseFilters(params), [params])

  const update = useCallback(
    (patch: Partial<Filters>) => {
      // Derive from the live params rather than the snapshot this callback
      // closed over: a debounced search landing next to a chip click would
      // otherwise overwrite whichever change was applied first.
      setParams((previous) => serialiseFilters({ ...parseFilters(previous), ...patch }), {
        replace: true,
      })
    },
    [setParams],
  )

  const reset = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams])

  return [filters, update, reset]
}
