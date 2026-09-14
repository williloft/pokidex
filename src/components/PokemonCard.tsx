import { memo, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { prefetchDetail } from '../lib/api'
import { dexNumber, displayName, type DexEntry } from '../lib/pokedex'
import type { SpriteStyle } from '../lib/sprites'
import { formViews, statTotal } from '../lib/types'
import { FormSwatches } from './FormSwatches'
import { Sprite } from './Sprite'
import { TypeBadge } from './TypeBadge'

interface Props {
  entry: DexEntry
  shiny: boolean
  spriteStyle: SpriteStyle
  inTeam: boolean
  teamFull: boolean
  onToggleTeam: (id: number) => void
}

/** Sweeping the mouse over the grid shouldn't fire a request per card. */
const PREFETCH_DELAY = 150

export const PokemonCard = memo(function PokemonCard({
  entry,
  shiny,
  spriteStyle,
  inTeam,
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
  const disabled = teamFull && !inTeam
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
          alt={displayName(view.name)}
          shiny={shiny}
          style={spriteStyle}
          size={240}
          className="card__art"
          transitionName={navigating ? `art-${view.id}` : undefined}
        />

        <h2 className="card__name">
          {displayName(pokemon.name)}
          {view.category !== 'default' ? (
            <span className="card__form">{view.label}</span>
          ) : null}
        </h2>

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
        className={`card__team ${inTeam ? 'card__team--active' : ''}`}
        onClick={() => onToggleTeam(pokemon.id)}
        disabled={disabled}
        aria-pressed={inTeam}
        title={
          inTeam
            ? `Remove ${displayName(pokemon.name)} from your team`
            : disabled
              ? 'Your team is full'
              : `Add ${displayName(pokemon.name)} to your team`
        }
      >
        {inTeam ? '−' : '+'}
        <span className="visually-hidden">{inTeam ? 'Remove from team' : 'Add to team'}</span>
      </button>
    </article>
  )
})
