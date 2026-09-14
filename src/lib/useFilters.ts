import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_FILTERS, type Filters, type SortKey } from './pokedex'

const SORT_KEYS: SortKey[] = [
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

/**
 * Filters live in the URL rather than in component state, so any view can be
 * shared, bookmarked, or reached with the back button.
 */
export function useFilters(): [Filters, (patch: Partial<Filters>) => void, () => void] {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<Filters>(() => {
    const sort = params.get('sort') as SortKey | null
    const direction = params.get('dir')
    return {
      query: params.get('q') ?? DEFAULT_FILTERS.query,
      types: parseList(params.get('type')),
      generations: parseList(params.get('gen')).map(Number).filter(Number.isFinite),
      sort: sort && SORT_KEYS.includes(sort) ? sort : DEFAULT_FILTERS.sort,
      direction: direction === 'desc' ? 'desc' : 'asc',
    }
  }, [params])

  const update = useCallback(
    (patch: Partial<Filters>) => {
      const next = { ...filters, ...patch }
      const search = new URLSearchParams()
      if (next.query) search.set('q', next.query)
      if (next.types.length > 0) search.set('type', next.types.join(','))
      if (next.generations.length > 0) search.set('gen', next.generations.join(','))
      if (next.sort !== DEFAULT_FILTERS.sort) search.set('sort', next.sort)
      if (next.direction !== DEFAULT_FILTERS.direction) search.set('dir', next.direction)
      setParams(search, { replace: true })
    },
    [filters, setParams],
  )

  const reset = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams])

  return [filters, update, reset]
}
