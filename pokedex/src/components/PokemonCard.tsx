import { memo } from 'react'
import { Link } from 'react-router-dom'
import { prefetchDetail } from '../lib/api'
import { dexNumber, displayName } from '../lib/pokedex'
import { artwork } from '../lib/sprites'
import { statTotal, type Pokemon } from '../lib/types'
import { TypeBadge } from './TypeBadge'

interface Props {
  pokemon: Pokemon
  shiny: boolean
  inTeam: boolean
  teamFull: boolean
  onToggleTeam: (id: number) => void
}

export const PokemonCard = memo(function PokemonCard({
  pokemon,
  shiny,
  inTeam,
  teamFull,
  onToggleTeam,
}: Props) {
  const primary = pokemon.types[0] ?? 'normal'
  const secondary = pokemon.types[1] ?? primary
  const disabled = teamFull && !inTeam

  return (
    <article
      className="card"
      style={
        {
          '--card-primary': `var(--type-${primary})`,
          '--card-secondary': `var(--type-${secondary})`,
        } as React.CSSProperties
      }
    >
      <Link
        className="card__link"
        to={`/pokemon/${pokemon.name}`}
        onPointerEnter={() => prefetchDetail(pokemon.id)}
        onFocus={() => prefetchDetail(pokemon.id)}
      >
        <span className="card__number">{dexNumber(pokemon.id)}</span>
        <img
          className="card__art"
          src={artwork(pokemon.id, shiny)}
          alt={displayName(pokemon.name)}
          loading="lazy"
          decoding="async"
          width={240}
          height={240}
          style={{ viewTransitionName: `art-${pokemon.id}` }}
        />
        <h2 className="card__name">{displayName(pokemon.name)}</h2>
        <div className="card__types">
          {pokemon.types.map((type) => (
            <TypeBadge key={type} type={type} />
          ))}
        </div>
        <span className="card__total">{statTotal(pokemon.stats)} BST</span>
      </Link>

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
        <span className="visually-hidden">
          {inTeam ? 'Remove from team' : 'Add to team'}
        </span>
      </button>
    </article>
  )
})
