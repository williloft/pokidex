import { memo, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { prefetchDetail } from '../lib/api'
import { dexNumber, displayName, type DexEntry } from '../lib/pokedex'
import { formViews, statTotal } from '../lib/types'
import type { SlotState } from '../lib/useTeam'
import { FormSwatches } from './FormSwatches'
import { Sprite } from './Sprite'
import { TypeBadge } from './TypeBadge'

interface Props {
  entry: DexEntry
  shiny: boolean
  /** Asked per form, because the card's selected variant is local state. */
  slotState: (id: number, form: string | null) => SlotState
  teamFull: boolean
  onToggleTeam: (id: number, form: string | null) => void
}

/** Sweeping the mouse over the grid shouldn't fire a request per card. */
const PREFETCH_DELAY = 150

export const PokemonCard = memo(function PokemonCard({
  entry,
  shiny,
  slotState,
  teamFull,
  onToggleTeam,
}: Props) {
  const { pokemon } = entry
  const views = formViews(pokemon)
  const [selected, setSelected] = useState(entry.formName ?? pokemon.name)
  const [navigating, setNavigating] = useState(false)
  const prefetchTimer = useRef<number | undefined>(undefined)

  // A new filter can pick a different form for this card; follow it.
  useEffect(() => {
    setSelected(entry.formName ?? pokemon.name)
  }, [entry.formName, pokemon.name])

  useEffect(() => () => window.clearTimeout(prefetchTimer.current), [])

  const view = views.find((item) => item.name === selected) ?? views[0]!
  const primary = view.types[0] ?? 'normal'
  const secondary = view.types[1] ?? null
  const formName = view.category === 'default' ? null : view.name
  const slot = slotState(pokemon.id, formName)
  const disabled = teamFull && slot === 'out'
  const href =
    view.category === 'default'
      ? `/pokemon/${pokemon.name}`
      : `/pokemon/${pokemon.name}?form=${view.name}`

  const startPrefetch = () => {
    window.clearTimeout(prefetchTimer.current)
    prefetchTimer.current = window.setTimeout(() => prefetchDetail(pokemon.id), PREFETCH_DELAY)
  }
  const cancelPrefetch = () => window.clearTimeout(prefetchTimer.current)

  return (
    <article
      className={`card ${secondary ? 'card--dual' : ''}`}
      style={
        {
          '--card-primary': `var(--type-${primary})`,
          '--card-secondary': `var(--type-${secondary ?? primary})`,
        } as React.CSSProperties
      }
    >
      <Link
        className="card__link"
        to={href}
        viewTransition
        onPointerEnter={startPrefetch}
        onPointerLeave={cancelPrefetch}
        onFocus={startPrefetch}
        onBlur={cancelPrefetch}
        onClick={() => setNavigating(true)}
      >
        <span className="card__number">{dexNumber(pokemon.id)}</span>

        <Sprite
          id={view.id}
          alt={view.title}
          shiny={shiny}
          size={240}
          className="card__art"
          transitionName={navigating ? `art-${view.id}` : undefined}
        />

        <h2 className="card__name">{view.title}</h2>

        <div className="card__types">
          {view.types.map((type) => (
            <TypeBadge key={type} type={type} />
          ))}
        </div>

        <span className="card__total">{statTotal(view.stats)} BST</span>
      </Link>

      <FormSwatches
        views={views}
        selected={selected}
        onSelect={setSelected}
        name={displayName(pokemon.name)}
      />

      <button
        type="button"
        className={`card__team card__team--${slot}`}
        onClick={() => onToggleTeam(pokemon.id, formName)}
        disabled={disabled}
        aria-pressed={slot === 'in'}
        title={
          slot === 'in'
            ? `Remove ${displayName(pokemon.name)} from your team`
            : slot === 'other-form'
              ? // The species already has a slot — this swaps which variant fills it.
                `Run ${view.title} instead on your team`
              : disabled
                ? 'Your team is full'
                : `Add ${view.title} to your team`
        }
      >
        {slot === 'in' ? '−' : slot === 'other-form' ? '⇄' : '+'}
        <span className="visually-hidden">
          {slot === 'in'
            ? 'Remove from team'
            : slot === 'other-form'
              ? 'Switch team form'
              : 'Add to team'}
        </span>
      </button>
    </article>
  )
})
