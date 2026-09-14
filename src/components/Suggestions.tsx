import { Link } from 'react-router-dom'
import { displayName } from '../lib/pokedex'
import type { Suggestion } from '../lib/suggest'
import { Sprite } from './Sprite'
import { TypeBadge } from './TypeBadge'

interface Props {
  suggestions: Suggestion[]
  shiny: boolean
  teamFull: boolean
  onAdd: (id: number, form: string | null) => void
}

/** "Resists Ground and Fire, immune to Electric" — say why, not just what. */
function reason({ covers, immunities, piles }: Suggestion): string {
  const list = (types: string[]) => types.map(displayName).join(', ')
  const parts: string[] = []

  if (immunities.length > 0) parts.push(`immune to ${list(immunities)}`)
  if (covers.length > 0) parts.push(`resists ${list(covers)}`)
  if (parts.length === 0) parts.push('balances the team')

  const sentence = parts.join(', ')
  return piles.length > 0
    ? `${sentence} — but adds to your ${list(piles)} problem`
    : sentence
}

export function Suggestions({ suggestions, shiny, teamFull, onAdd }: Props) {
  if (suggestions.length === 0) {
    return (
      <p className="panel__note">
        Nothing obvious is missing — no attacking type gets a clear run at this team.
      </p>
    )
  }

  return (
    <ul className="suggestions">
      {suggestions.map((suggestion) => {
        const { pokemon, view } = suggestion
        const formName = view.category === 'default' ? null : view.name
        const primary = view.types[0] ?? 'normal'

        return (
          <li
            key={pokemon.id}
            className="suggestion"
            style={{ '--suggestion-accent': `var(--type-${primary})` } as React.CSSProperties}
          >
            <Link
              className="suggestion__link"
              to={formName ? `/pokemon/${pokemon.name}?form=${formName}` : `/pokemon/${pokemon.name}`}
              viewTransition
            >
              <Sprite id={view.id} alt={view.title} shiny={shiny} size={72} />
              <span className="suggestion__name">{view.title}</span>
            </Link>

            <div className="suggestion__types">
              {view.types.map((type) => (
                <TypeBadge key={type} type={type} />
              ))}
            </div>

            <p className="suggestion__reason">{reason(suggestion)}</p>

            <button
              type="button"
              className="chip"
              onClick={() => onAdd(pokemon.id, formName)}
              disabled={teamFull}
              title={teamFull ? 'Your team is full' : `Add ${view.title}`}
            >
              {teamFull ? 'Team full' : '+ Add'}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
