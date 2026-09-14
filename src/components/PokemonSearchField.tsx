import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_FILTERS, dexNumber, filterAndSort } from '../lib/pokedex'
import { resolveForm, type Pokemon } from '../lib/types'
import { TypeBadge } from './TypeBadge'

interface Props {
  pokemon: readonly Pokemon[]
  placeholder: string
  onPick: (pokemon: Pokemon, formName: string | null) => void
  /** Clear the box after a pick — right for a quiz, wrong for a picker. */
  clearOnPick?: boolean
  autoFocus?: boolean
  label: string
  disabled?: boolean
}

const MAX_SUGGESTIONS = 8

/**
 * Type a few letters, get a short list, click the one you meant.
 *
 * Deliberately shows the dex number and typing but never the artwork: in the
 * quiz the picture is the question, so putting it in the suggestion list would
 * hand over the answer.
 */
export function PokemonSearchField({
  pokemon,
  placeholder,
  onPick,
  clearOnPick = false,
  autoFocus = false,
  label,
  disabled = false,
}: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  // A picker keeps its text after a choice, so the list has to be dismissed
  // explicitly — otherwise it stays open on top of the answer it just produced.
  const [dismissed, setDismissed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const results = useMemo(() => {
    const trimmed = query.trim()
    if (dismissed || trimmed.length < 1) return []
    return filterAndSort(pokemon, { ...DEFAULT_FILTERS, query: trimmed }).slice(0, MAX_SUGGESTIONS)
  }, [pokemon, query, dismissed])

  useEffect(() => setActive(0), [query])

  const pick = (index: number) => {
    const chosen = results[index]
    if (!chosen) return
    onPick(chosen.pokemon, chosen.formName)
    if (clearOnPick) setQuery('')
    setDismissed(true)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => (current + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => (current - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      pick(active)
    } else if (event.key === 'Escape') {
      setDismissed(true)
    }
  }

  return (
    <div className="finder">
      <input
        ref={inputRef}
        type="search"
        className="finder__input"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setDismissed(false)
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
      />

      {results.length > 0 ? (
        <ul className="finder__results" role="listbox" aria-label={label}>
          {results.map((result, index) => {
            const view = resolveForm(result.pokemon, result.formName)
            return (
              <li key={result.pokemon.id}>
                <button
                  type="button"
                  className={`finder__option ${index === active ? 'finder__option--active' : ''}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(index)}
                >
                  <span className="finder__number">{dexNumber(result.pokemon.id)}</span>
                  <span className="finder__name">{view.title}</span>
                  <span className="finder__types">
                    {view.types.map((type) => (
                      <TypeBadge key={type} type={type} />
                    ))}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
