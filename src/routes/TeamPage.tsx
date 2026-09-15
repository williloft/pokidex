import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDex } from '../App'
import { FormSwatches } from '../components/FormSwatches'
import { MovesetEditor, moveLabel } from '../components/MovesetEditor'
import { Sprite } from '../components/Sprite'
import { StatBars } from '../components/StatBars'
import { Suggestions } from '../components/Suggestions'
import { TypeBadge } from '../components/TypeBadge'
import { WeaknessHeatmap } from '../components/WeaknessHeatmap'
import { dexHref } from '../lib/dexLocation'
import { dexNumber, displayName } from '../lib/pokedex'
import { suggestMembers, teamNotices } from '../lib/suggest'
import {
  selectableViews,
  STAT_LABELS,
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
  onSetMoves: (id: number, moves: string[] | null) => void
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

export function TeamPage({
  team,
  shiny,
  teamFull,
  onRemove,
  onSetForm,
  onSetMoves,
  onAdd,
}: Props) {
  const { pokedex, typeData, moves: moveIndex } = useDex()
  const [editing, setEditing] = useState<number | null>(null)
  useDocumentTitle(team.length > 0 ? `Team (${team.length}) · Pokédex` : 'Team · Pokédex')

  const suggestions = useMemo(
    () => suggestMembers(pokedex.pokemon, team, typeData.chart, typeData.types),
    [pokedex.pokemon, team, typeData],
  )
  const notices = useMemo(() => teamNotices(team), [team])
  const editingMember = team.find((member) => member.pokemon.id === editing) ?? null

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
        {team.map((member) => {
          const { pokemon, view } = member
          const views = selectableViews(pokemon)
          return (
            <li
              key={pokemon.id}
              className="roster"
              style={
                { '--roster-accent': `var(--type-${view.types[0] ?? 'normal'})` } as React.CSSProperties
              }
            >
              <Link
                className="roster__head"
                to={
                  view.category === 'default'
                    ? `/pokemon/${pokemon.name}`
                    : `/pokemon/${pokemon.name}?form=${view.name}`
                }
                viewTransition
              >
                {/* Lifted clear of the card's top edge — see .roster__art. */}
                <span className="roster__art">
                  <Sprite id={view.id} alt={view.title} shiny={shiny} size={176} />
                </span>
                <span className="roster__identity">
                  <span className="roster__number">{dexNumber(pokemon.id)}</span>
                  <span className="roster__name">{view.title}</span>
                  <span className="roster__types">
                    {view.types.map((type) => (
                      <TypeBadge key={type} type={type} />
                    ))}
                  </span>
                </span>
              </Link>

              {/* Swap the variant here and the whole analysis below follows. */}
              {views.length > 1 ? (
                <FormSwatches
                  views={views}
                  selected={view.name}
                  onSelect={(formName) =>
                    onSetForm(pokemon.id, formName === pokemon.name ? null : formName)
                  }
                  name={displayName(pokemon.name)}
                />
              ) : null}

              {/* Enough of the numbers to judge it without opening the entry. */}
              <div className="roster__stats">
                <span className="roster__bst">
                  <strong>{statTotal(view.stats)}</strong> BST
                </span>
                <span className="roster__spread" aria-hidden="true">
                  {STAT_ORDER.map((key) => (
                    <span
                      key={key}
                      className="roster__tick"
                      title={`${STAT_LABELS[key]} ${view.stats[key]}`}
                      style={{ height: `${Math.min(100, (view.stats[key] / 180) * 100)}%` }}
                    />
                  ))}
                </span>
              </div>

              {/*
                * Four fixed slots rather than a wrapping row.
                *
                * Flex-wrap centred the chips, so four moves landed one-two-one
                * and no two cards agreed with each other. A 2x2 grid puts every
                * move in the same place on every card, and an unfilled slot
                * stays visible as a gap you can act on.
                */}
              <ul className="roster__moves">
                {[0, 1, 2, 3].map((slot) => {
                  const name = member.moves[slot]
                  const move = name ? moveIndex[name] : undefined
                  if (!name) {
                    return (
                      <li key={slot} className="roster__move roster__move--empty">
                        Empty
                      </li>
                    )
                  }
                  return (
                    <li
                      key={name}
                      className="roster__move"
                      title={move ? `${move.type} · ${move.power} power` : undefined}
                      style={
                        {
                          '--move-accent': `var(--type-${move?.type ?? 'normal'})`,
                        } as React.CSSProperties
                      }
                    >
                      {moveLabel(name)}
                    </li>
                  )
                })}
              </ul>

              <div className="roster__actions">
                <button
                  type="button"
                  className="chip"
                  onClick={() => setEditing(pokemon.id)}
                  disabled={Object.keys(moveIndex).length === 0}
                >
                  Edit moves
                </button>
                <button
                  type="button"
                  className="roster__remove"
                  aria-label={`Remove ${view.title} from your team`}
                  onClick={() => onRemove(pokemon.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {editingMember ? (
        <MovesetEditor
          member={editingMember}
          moveIndex={moveIndex}
          onSave={(moves) => {
            onSetMoves(editingMember.pokemon.id, moves)
            setEditing(null)
          }}
          onReset={() => onSetMoves(editingMember.pokemon.id, null)}
          onClose={() => setEditing(null)}
        />
      ) : null}

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
