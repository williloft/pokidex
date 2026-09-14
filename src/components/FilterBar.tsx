import { useEffect, useRef, useState } from 'react'
import { displayName, type Filters, type SortKey } from '../lib/pokedex'
import type { Generation } from '../lib/types'

interface Props {
  filters: Filters
  update: (patch: Partial<Filters>) => void
  reset: () => void
  allTypes: string[]
  generations: Generation[]
  resultCount: number
  totalCount: number
}

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'relevance', label: 'Best match' },
  { value: 'id', label: 'Dex number' },
  { value: 'name', label: 'Name' },
  { value: 'total', label: 'Base stat total' },
  { value: 'hp', label: 'HP' },
  { value: 'attack', label: 'Attack' },
  { value: 'defense', label: 'Defense' },
  { value: 'special-attack', label: 'Sp. Atk' },
  { value: 'special-defense', label: 'Sp. Def' },
  { value: 'speed', label: 'Speed' },
]

/** Nothing is more than dual-typed, so a third choice would match nothing. */
const MAX_TYPES = 2

export function FilterBar({
  filters,
  update,
  reset,
  allTypes,
  generations,
  resultCount,
  totalCount,
}: Props) {
  const [draft, setDraft] = useState(filters.query)
  const searchRef = useRef<HTMLInputElement>(null)

  // Keep the input in step when the URL changes underneath us (back button,
  // a type link, "clear filters").
  useEffect(() => setDraft(filters.query), [filters.query])

  // Typing is cheap to run against a local array, but debouncing keeps us from
  // rewriting the URL on every keystroke.
  useEffect(() => {
    if (draft === filters.query) return
    const timer = setTimeout(() => update({ query: draft }), 120)
    return () => clearTimeout(timer)
  }, [draft, filters.query, update])

  // "/" focuses search, the way every search-first app behaves.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'
      if (event.key === '/' && !typing) {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'Escape' && typing) searchRef.current?.blur()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const typesFull = filters.types.length >= MAX_TYPES

  const toggleType = (type: string) => {
    const next = filters.types.includes(type)
      ? filters.types.filter((entry) => entry !== type)
      : [...filters.types, type]
    update({ types: next })
  }

  const toggleGeneration = (id: number) => {
    const next = filters.generations.includes(id)
      ? filters.generations.filter((entry) => entry !== id)
      : [...filters.generations, id]
    update({ generations: next })
  }

  const hasFilters =
    filters.query !== '' || filters.types.length > 0 || filters.generations.length > 0

  return (
    <section className="filters" aria-label="Search and filters">
      <div className="filters__search">
        <input
          ref={searchRef}
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search by name, form or dex number…"
          aria-label="Search Pokémon"
          autoComplete="off"
          spellCheck={false}
        />
        <kbd aria-hidden="true">/</kbd>
      </div>

      <div className="filters__row">
        <span className="filters__legend">
          Type
          {typesFull ? <em className="filters__hint">max 2</em> : null}
        </span>
        <div className="chips">
          {allTypes.map((type) => {
            const on = filters.types.includes(type)
            return (
              <button
                key={type}
                type="button"
                className={`chip chip--type ${on ? 'chip--on' : ''}`}
                style={{ '--type-color': `var(--type-${type})` } as React.CSSProperties}
                aria-pressed={on}
                // Silently dropping an earlier pick is worse than saying no.
                disabled={typesFull && !on}
                title={typesFull && !on ? 'Deselect a type first — nothing is triple-typed' : undefined}
                onClick={() => toggleType(type)}
              >
                {displayName(type)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="filters__row">
        <span className="filters__legend">Generation</span>
        <div className="chips">
          {generations.map((generation) => (
            <button
              key={generation.id}
              type="button"
              className={`chip ${filters.generations.includes(generation.id) ? 'chip--on' : ''}`}
              aria-pressed={filters.generations.includes(generation.id)}
              onClick={() => toggleGeneration(generation.id)}
              title={generation.region ? displayName(generation.region) : undefined}
            >
              Gen {generation.id}
            </button>
          ))}
        </div>
      </div>

      <div className="filters__row filters__row--end">
        <label className="filters__sort">
          <span className="filters__legend">Sort</span>
          <select
            value={filters.sort}
            onChange={(event) => update({ sort: event.target.value as SortKey })}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="chip"
          onClick={() => update({ direction: filters.direction === 'asc' ? 'desc' : 'asc' })}
          disabled={filters.sort === 'relevance' && filters.query !== ''}
          title={
            filters.sort === 'relevance' && filters.query !== ''
              ? 'Best match has its own order'
              : undefined
          }
        >
          {filters.direction === 'asc' ? '↑ Ascending' : '↓ Descending'}
        </button>

        <p className="filters__count" role="status">
          {resultCount === totalCount ? `${totalCount} Pokémon` : `${resultCount} of ${totalCount}`}
        </p>

        {hasFilters ? (
          <button type="button" className="chip chip--ghost" onClick={reset}>
            Clear
          </button>
        ) : null}
      </div>
    </section>
  )
}
