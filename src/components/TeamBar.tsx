import { Link } from 'react-router-dom'
import { displayName } from '../lib/pokedex'
import { pixelSprite } from '../lib/sprites'
import { TEAM_SIZE } from '../lib/useTeam'
import type { Pokemon } from '../lib/types'

interface Props {
  team: Pokemon[]
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
          {team.map((member) => (
            <li key={member.id}>
              <button
                type="button"
                onClick={() => onRemove(member.id)}
                title={`Remove ${displayName(member.name)}`}
              >
                <img
                  src={pixelSprite(member.id, shiny)}
                  alt={displayName(member.name)}
                  width={48}
                  height={36}
                  loading="lazy"
                  onError={(event) => {
                    // A missing shiny icon shouldn't leave an empty slot.
                    event.currentTarget.src = pixelSprite(member.id, false)
                  }}
                />
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
