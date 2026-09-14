import { Link } from 'react-router-dom'
import { displayName } from '../lib/pokedex'
import { pixelSprite } from '../lib/sprites'
import { TEAM_SIZE } from '../lib/useTeam'
import type { TeamMember } from '../lib/types'

interface Props {
  team: TeamMember[]
  shiny: boolean
  onRemove: (id: number) => void
  onClear: () => void
}

/** Sticky footer showing the current team, visible from anywhere in the app. */
export function TeamBar({ team, shiny, onRemove, onClear }: Props) {
  if (team.length === 0) return null

  const empty = Math.max(0, TEAM_SIZE - team.length)

  return (
    <div className="teambar">
      <div className="teambar__inner">
        <ul className="teambar__slots">
          {team.map(({ pokemon, view }) => (
            <li key={pokemon.id}>
              <button
                type="button"
                onClick={() => onRemove(pokemon.id)}
                title={
                  view.category === 'default'
                    ? `Remove ${displayName(pokemon.name)}`
                    : `Remove ${displayName(pokemon.name)} (${view.label})`
                }
              >
                <img
                  // The slot shows the variant being run, not the base species.
                  src={pixelSprite(view.id, shiny)}
                  alt={displayName(view.name)}
                  width={48}
                  height={36}
                  loading="lazy"
                  onError={(event) => {
                    // Forms and shinies have patchier icon coverage; fall back
                    // rather than leave an empty slot.
                    const fallback = pixelSprite(pokemon.id, false)
                    if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback
                  }}
                />
                {view.category !== 'default' ? (
                  <span className="teambar__form" aria-hidden="true">
                    {view.label}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
          {Array.from({ length: empty }, (_, index) => (
            <li key={`empty-${index}`} className="teambar__slot--empty" aria-hidden="true" />
          ))}
        </ul>

        <div className="teambar__actions">
          <Link className="button" to="/team" viewTransition>
            Analyse team
          </Link>
          <button type="button" className="chip chip--ghost" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
