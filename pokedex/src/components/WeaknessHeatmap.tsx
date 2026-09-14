import { displayName } from '../lib/pokedex'
import { pixelSprite } from '../lib/sprites'
import type { Pokemon } from '../lib/types'
import { formatMultiplier, teamCoverage, uncoveredThreats } from '../lib/typeChart'
import type { TypeChart } from '../lib/types'

interface Props {
  team: Pokemon[]
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
 */
export function WeaknessHeatmap({ team, chart, allTypes, shiny }: Props) {
  const rows = teamCoverage(chart, allTypes, team)
  const threats = uncoveredThreats(rows)

  return (
    <>
      {threats.length > 0 ? (
        <div className="threats" role="status">
          <h3>Uncovered</h3>
          <p>
            Nothing on this team resists {threats.length === 1 ? 'this type' : 'these types'}:
          </p>
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
              {team.map((member) => (
                <th scope="col" key={member.id}>
                  <img
                    src={pixelSprite(member.id, shiny)}
                    alt={displayName(member.name)}
                    width={40}
                    height={30}
                    loading="lazy"
                  />
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
                  <td key={team[index]?.id ?? index} className={cellClass(multiplier)}>
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
