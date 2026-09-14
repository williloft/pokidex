import { Link } from 'react-router-dom'
import { useDex } from '../App'
import { Sprite } from '../components/Sprite'
import { StatBars } from '../components/StatBars'
import { TypeBadge } from '../components/TypeBadge'
import { WeaknessHeatmap } from '../components/WeaknessHeatmap'
import { dexHref } from '../lib/dexLocation'
import { displayName } from '../lib/pokedex'
import { useSpriteStyle } from '../lib/usePrefs'
import { STAT_ORDER, statTotal, type Pokemon, type StatName, type Stats } from '../lib/types'
import { useDocumentTitle } from '../lib/useScrollRestoration'

interface Props {
  team: Pokemon[]
  shiny: boolean
  onRemove: (id: number) => void
}

/** Average of each base stat across the team — a rough shape of what it does. */
function averageStats(team: Pokemon[]): Stats {
  const totals = Object.fromEntries(STAT_ORDER.map((key) => [key, 0])) as Stats
  for (const member of team) {
    for (const key of STAT_ORDER) totals[key] += member.stats[key]
  }
  for (const key of STAT_ORDER) {
    totals[key] = Math.round(totals[key] / Math.max(1, team.length))
  }
  return totals
}

export function TeamPage({ team, shiny, onRemove }: Props) {
  const { typeData } = useDex()
  const [spriteStyle] = useSpriteStyle()
  useDocumentTitle(team.length > 0 ? `Team (${team.length}) · Pokédex` : 'Team · Pokédex')

  if (team.length === 0) {
    return (
      <div className="notice">
        <h1>No team yet</h1>
        <p>Add up to six Pokémon from the dex and this page will show you what beats them.</p>
        <Link className="button" to={dexHref()}>
          Browse the dex
        </Link>
      </div>
    )
  }

  const averages = averageStats(team)
  const typeSpread = new Set(team.flatMap((member) => member.types))
  const bestStat = STAT_ORDER.reduce<StatName>(
    (best, key) => (averages[key] > averages[best] ? key : best),
    'hp',
  )
  const averageBst = Math.round(
    team.reduce((sum, member) => sum + statTotal(member.stats), 0) / team.length,
  )

  return (
    <div className="team-page">
      <header className="team-page__header">
        <h1>Your team</h1>
        <p className="team-page__summary">
          {team.length} of 6 · {typeSpread.size} {typeSpread.size === 1 ? 'type' : 'types'} covered ·{' '}
          {averageBst} average BST
        </p>
      </header>

      <ul className="team-page__roster">
        {team.map((member) => (
          <li key={member.id}>
            <Link to={`/pokemon/${member.name}`} viewTransition>
              <Sprite
                id={member.id}
                alt={displayName(member.name)}
                shiny={shiny}
                style={spriteStyle}
                size={96}
              />
              <span className="team-page__name">{displayName(member.name)}</span>
            </Link>
            <div className="team-page__types">
              {member.types.map((type) => (
                <TypeBadge key={type} type={type} />
              ))}
            </div>
            <button type="button" className="chip chip--ghost" onClick={() => onRemove(member.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>

      <section className="panel">
        <h2>Type coverage</h2>
        <WeaknessHeatmap
          team={team}
          chart={typeData.chart}
          allTypes={typeData.types}
          shiny={shiny}
        />
      </section>

      <section className="panel">
        <h2>Average base stats</h2>
        <p className="panel__note">
          Strongest area: {bestStat.replace('-', ' ')}. Averages hide outliers, so check individual
          members before trusting the shape.
        </p>
        <StatBars stats={averages} accent={team[0]?.types[0] ?? 'normal'} />
      </section>
    </div>
  )
}
