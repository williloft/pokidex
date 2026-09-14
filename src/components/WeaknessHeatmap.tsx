import { displayName } from '../lib/pokedex'
import { pixelSprite } from '../lib/sprites'
import type { TeamMember, TypeChart } from '../lib/types'
import { formatMultiplier, teamCoverage, uncoveredThreats } from '../lib/typeChart'

interface Props {
  team: TeamMember[]
  chart: TypeChart
  allTypes: string[]
  shiny: boolean
}

/** Pick a cell class from the multiplier so the CSS stays declarative. */
function cellClass(multiplier: number): string {
  if (multiplier === 0) return 'heat heat--immune'
  if (multiplier >= 4) return 'heat heat--weak-4'
  if (multiplier > 1) return 'heat heat--weak-2'
  if (multiplier <= 0.25) return 'heat heat--resist-4'
  if (multiplier < 1) return 'heat heat--resist-2'
  return 'heat'
}

/**
 * The point of the team builder: a matrix of every attacking type against every
 * member, so you can see at a glance which type has a clear run at your team.
 *
 * Matchups follow the form each member is running — a Mega can change typing
 * outright, which is exactly the kind of thing this table exists to catch.
 */
export function WeaknessHeatmap({ team, chart, allTypes, shiny }: Props) {
  const rows = teamCoverage(
    chart,
    allTypes,
    team.map((member) => ({ types: member.view.types })),
  )
  const threats = uncoveredThreats(rows)

  return (
    <>
      {threats.length > 0 ? (
        <div className="threats" role="status">
          <h3>Uncovered</h3>
          <p>Nothing on this team resists {threats.length === 1 ? 'this type' : 'these types'}:</p>
          <ul>
            {threats.map((row) => (
              <li key={row.type}>
                <span
                  className="threats__type"
                  style={{ '--type-color': `var(--type-${row.type})` } as React.CSSProperties}
                >
                  {displayName(row.type)}
                </span>
                <span className="threats__count">
                  hits {row.weakCount} of {team.length}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="threats threats--clear" role="status">
          <h3>No open holes</h3>
          <p>Every attacking type is resisted by at least one team member.</p>
        </div>
      )}

      <div className="heatmap-scroll">
        <table className="heatmap">
          <caption className="visually-hidden">
            Damage multiplier of each attacking type against each team member
          </caption>
          <thead>
            <tr>
              <th scope="col">Attacking type</th>
              {team.map(({ pokemon, view }) => (
                <th scope="col" key={pokemon.id}>
                  <img
                    src={pixelSprite(view.id, shiny)}
                    alt={view.title}
                    width={40}
                    height={30}
                    loading="lazy"
                    onError={(event) => {
                      const fallback = pixelSprite(pokemon.id, false)
                      if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback
                    }}
                  />
                  {view.category !== 'default' ? (
                    <span className="heatmap__form">{view.label}</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.type}>
                <th scope="row">
                  <span
                    className="heatmap__type"
                    style={{ '--type-color': `var(--type-${row.type})` } as React.CSSProperties}
                  >
                    {displayName(row.type)}
                  </span>
                </th>
                {row.multipliers.map((multiplier, index) => (
                  <td key={team[index]?.pokemon.id ?? index} className={cellClass(multiplier)}>
                    {multiplier === 1 ? '' : `${formatMultiplier(multiplier)}×`}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
