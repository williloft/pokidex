import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDex } from '../App'
import { PokemonSearchField } from '../components/PokemonSearchField'
import { Sprite } from '../components/Sprite'
import { TypeBadge } from '../components/TypeBadge'
import { dexHref } from '../lib/dexLocation'
import { displayName } from '../lib/pokedex'
import { analyseMatchup, bestLead, VERDICT_LABEL } from '../lib/matchup'
import { formatMultiplier } from '../lib/typeChart'
import { resolveForm, type FormView, type Pokemon, type TeamMember } from '../lib/types'
import { useDocumentTitle } from '../lib/useScrollRestoration'

interface Props {
  team: TeamMember[]
  shiny: boolean
}

interface Opponent {
  pokemon: Pokemon
  view: FormView
}

export function BattlePage({ team, shiny }: Props) {
  const { pokedex, typeData } = useDex()
  const [opponent, setOpponent] = useState<Opponent | null>(null)
  useDocumentTitle('Battle · Pokédex')

  const matchups = useMemo(
    () => (opponent ? analyseMatchup(typeData.chart, team, opponent.view.types) : []),
    [typeData.chart, team, opponent],
  )
  const lead = useMemo(() => bestLead(matchups), [matchups])

  if (team.length === 0) {
    return (
      <div className="notice">
        <h1>No team yet</h1>
        <p>Build a team first, then bring an opponent here to see who handles it.</p>
        <Link className="button" to={dexHref()}>
          Browse the dex
        </Link>
      </div>
    )
  }

  return (
    <div className="battle">
      <header className="team-page__header">
        <h1>Battle</h1>
        <p className="team-page__summary">
          Pick an opponent and see which of your six wants the fight.
        </p>
      </header>

      <section className="panel">
        <h2>Opponent</h2>
        <PokemonSearchField
          pokemon={pokedex.pokemon}
          placeholder="Search for the Pokémon you are facing…"
          label="Choose an opponent"
          onPick={(pokemon, formName) =>
            setOpponent({ pokemon, view: resolveForm(pokemon, formName) })
          }
        />

        {opponent ? (
          <div className="battle__opponent">
            <Sprite id={opponent.view.id} alt={opponent.view.title} shiny={shiny} size={120} />
            <div>
              <h3>{opponent.view.title}</h3>
              <div className="detail__types">
                {opponent.view.types.map((type) => (
                  <TypeBadge key={type} type={type} size="md" />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {opponent ? (
        <>
          {lead ? (
            <p className="team-notice" role="status">
              <strong>Send in {lead.member.view.title}.</strong> {VERDICT_LABEL[lead.verdict]} —
              hits for {formatMultiplier(lead.outgoing)}× and takes {formatMultiplier(lead.incoming)}
              × back.
            </p>
          ) : null}

          <section className="panel">
            <h2>Your team against {opponent.view.title}</h2>
            <p className="panel__note">
              Worked out from typing alone — neither side&rsquo;s actual moves, abilities or items
              are in the data, so treat this as the shape of the matchup rather than a prediction.
            </p>

            <ul className="matchup-list">
              {matchups.map((matchup) => (
                <li
                  key={matchup.member.pokemon.id}
                  className={`matchup matchup--${matchup.verdict}`}
                >
                  <Link
                    className="matchup__who"
                    to={`/pokemon/${matchup.member.pokemon.name}`}
                    viewTransition
                  >
                    <Sprite
                      id={matchup.member.view.id}
                      alt={matchup.member.view.title}
                      shiny={shiny}
                      size={64}
                    />
                    <span>{matchup.member.view.title}</span>
                  </Link>

                  <span className="matchup__verdict">{VERDICT_LABEL[matchup.verdict]}</span>

                  <dl className="matchup__numbers">
                    <div>
                      <dt>Deals</dt>
                      <dd>{formatMultiplier(matchup.outgoing)}×</dd>
                    </div>
                    <div>
                      <dt>Takes</dt>
                      <dd>{formatMultiplier(matchup.incoming)}×</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <p className="panel__note">
          Nothing picked yet. Your team: {team.map((member) => displayName(member.pokemon.name)).join(', ')}.
        </p>
      )}
    </div>
  )
}
