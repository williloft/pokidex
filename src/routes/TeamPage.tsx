import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useDex } from '../App'
import { FormSwatches } from '../components/FormSwatches'
import { Sprite } from '../components/Sprite'
import { StatBars } from '../components/StatBars'
import { Suggestions } from '../components/Suggestions'
import { TypeBadge } from '../components/TypeBadge'
import { WeaknessHeatmap } from '../components/WeaknessHeatmap'
import { dexHref } from '../lib/dexLocation'
import { displayName } from '../lib/pokedex'
import { suggestMembers, teamNotices } from '../lib/suggest'
import {
  selectableViews,
  STAT_ORDER,
  statTotal,
  type StatName,
  type Stats,
  type TeamMember,
} from '../lib/types'
import { useDocumentTitle } from '../lib/useScrollRestoration'

interface Props {
  team: TeamMember[]
  shiny: boolean
  teamFull: boolean
  onRemove: (id: number) => void
  onSetForm: (id: number, form: string | null) => void
  onAdd: (id: number, form: string | null) => void
}

/**
 * Average of each base stat across the team — using the form each member is
 * actually running, since a Mega can move these numbers a long way.
 */
function averageStats(team: TeamMember[]): Stats {
  const totals = Object.fromEntries(STAT_ORDER.map((key) => [key, 0])) as Stats
  for (const { view } of team) {
    for (const key of STAT_ORDER) totals[key] += view.stats[key]
  }
  for (const key of STAT_ORDER) {
    totals[key] = Math.round(totals[key] / Math.max(1, team.length))
  }
  return totals
}

const NOTICE_TEXT: Record<'mega' | 'gmax', string> = {
  mega: 'Only one Pokémon can Mega Evolve per battle, so only one of these will ever transform.',
  gmax: 'Only one Pokémon can Dynamax per battle, so only one of these will ever transform.',
}

export function TeamPage({ team, shiny, teamFull, onRemove, onSetForm, onAdd }: Props) {
  const { pokedex, typeData } = useDex()
  useDocumentTitle(team.length > 0 ? `Team (${team.length}) · Pokédex` : 'Team · Pokédex')

  const suggestions = useMemo(
    () => suggestMembers(pokedex.pokemon, team, typeData.chart, typeData.types),
    [pokedex.pokemon, team, typeData],
  )
  const notices = useMemo(() => teamNotices(team), [team])

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
  const typeSpread = new Set(team.flatMap((member) => member.view.types))
  const bestStat = STAT_ORDER.reduce<StatName>(
    (best, key) => (averages[key] > averages[best] ? key : best),
    'hp',
  )
  const averageBst = Math.round(
    team.reduce((sum, member) => sum + statTotal(member.view.stats), 0) / team.length,
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

      {notices.map((item) => (
        <p className="team-notice" key={item.kind} role="status">
          <strong>{item.names.join(' and ')}</strong>
          {' — '}
          {NOTICE_TEXT[item.kind]}
        </p>
      ))}

      <ul className="team-page__roster">
        {team.map(({ pokemon, view }) => {
          const views = selectableViews(pokemon)
          return (
            <li key={pokemon.id}>
              <Link
                to={
                  view.category === 'default'
                    ? `/pokemon/${pokemon.name}`
                    : `/pokemon/${pokemon.name}?form=${view.name}`
                }
                viewTransition
              >
                <Sprite id={view.id} alt={view.title} shiny={shiny} size={128} />
                <span className="team-page__name">{view.title}</span>
              </Link>

              <div className="team-page__types">
                {view.types.map((type) => (
                  <TypeBadge key={type} type={type} />
                ))}
              </div>

              {/* Swap the variant here and the whole analysis below follows. */}
              <FormSwatches
                views={views}
                selected={view.name}
                onSelect={(formName) =>
                  onSetForm(pokemon.id, formName === pokemon.name ? null : formName)
                }
                name={displayName(pokemon.name)}
              />

              <button
                type="button"
                className="chip chip--ghost"
                onClick={() => onRemove(pokemon.id)}
              >
                Remove
              </button>
            </li>
          )
        })}
      </ul>

      <section className="panel">
        <h2>What this team is missing</h2>
        <p className="panel__note">
          Scored on how many uncovered types each one answers, minus anything that piles onto a
          weakness you already share.
        </p>
        <Suggestions
          suggestions={suggestions}
          shiny={shiny}
          teamFull={teamFull}
          onAdd={onAdd}
        />
      </section>

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
        <StatBars stats={averages} accent={team[0]?.view.types[0] ?? 'normal'} />
      </section>
    </div>
  )
}
