import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDex } from '../App'
import { BrandMark } from '../components/BrandMark'
import { Sprite } from '../components/Sprite'
import { TypeBadge } from '../components/TypeBadge'
import type { Difficulty } from '../lib/battle'
import { dexHref } from '../lib/dexLocation'
import { ladderProgress, useLadder } from '../lib/ladder'
import { dexNumber, displayName } from '../lib/pokedex'
import { useQuizScore } from '../lib/quiz'
import { statTotal, type Pokemon, type TeamMember } from '../lib/types'
import { useDocumentTitle } from '../lib/useScrollRestoration'
import { TEAM_SIZE } from '../lib/useTeam'

interface Props {
  team: TeamMember[]
  shiny: boolean
}

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard']

const pickRandom = (pokemon: readonly Pokemon[]): Pokemon | null =>
  pokemon.length === 0 ? null : (pokemon[Math.floor(Math.random() * pokemon.length)] ?? null)

export function HomePage({ team, shiny }: Props) {
  const { pokedex } = useDex()
  const [score] = useQuizScore()
  const [ladder] = useLadder()
  useDocumentTitle('Pokédex')

  // Somewhere to look while you decide where to go.
  const [spotlight, setSpotlight] = useState(() => pickRandom(pokedex.pokemon))

  const accuracy = score.asked > 0 ? Math.round((score.correct / score.asked) * 100) : 0
  const slots = Array.from({ length: TEAM_SIZE }, (_, index) => team[index] ?? null)

  return (
    <div className="home">
      <header className="home__hero">
        <BrandMark size={52} />
        <h1>Pokédex</h1>
        <p>
          All {pokedex.pokemon.length} species with their forms, movesets and matchups — plus a
          team to build, a ladder to climb and a silhouette to guess.
        </p>
        <div className="home__cta">
          <Link className="button" to={dexHref()}>
            Browse the dex
          </Link>
          <Link className="chip" to="/quiz">
            Play the quiz
          </Link>
        </div>
      </header>

      <div className="home__grid">
        {/* Your team, and the way back into it. */}
        <Link className="tile tile--team" to="/team">
          <span className="tile__head">
            <span className="tile__title">Your team</span>
            <span className="tile__meta">
              {team.length} of {TEAM_SIZE}
            </span>
          </span>

          <span className="tile__slots">
            {slots.map((member, index) =>
              member ? (
                <span className="tile__slot" key={member.pokemon.id}>
                  <Sprite
                    id={member.view.id}
                    alt={member.view.title}
                    shiny={shiny}
                    size={56}
                  />
                </span>
              ) : (
                <span className="tile__slot tile__slot--empty" key={`empty-${index}`} />
              ),
            )}
          </span>

          <span className="tile__foot">
            {team.length === 0
              ? 'Nothing picked yet — start from the dex.'
              : `${new Set(team.flatMap((member) => member.view.types)).size} types covered`}
          </span>
        </Link>

        {/* Where you are on the ladder, per difficulty. */}
        <Link className="tile" to="/battle">
          <span className="tile__head">
            <span className="tile__title">Battle</span>
            <span className="tile__meta">{team.length === 0 ? 'Team needed' : 'Ladder'}</span>
          </span>

          <span className="tile__rungs">
            {DIFFICULTIES.map((difficulty) => {
              const progress = ladderProgress(ladder, difficulty)
              const share = (progress.beaten / progress.total) * 100
              return (
                <span className="rung" key={difficulty}>
                  <span className="rung__label">{difficulty}</span>
                  <span className="rung__track">
                    <span className={`rung__fill rung__fill--${difficulty}`} style={{ width: `${share}%` }} />
                  </span>
                  <span className="rung__count">
                    {progress.beaten}/{progress.total}
                  </span>
                </span>
              )
            })}
          </span>

          <span className="tile__foot">Thirteen trainers, one unlocked by the last.</span>
        </Link>

        {/* The quiz, and whether you are any good at it. */}
        <Link className="tile" to="/quiz">
          <span className="tile__head">
            <span className="tile__title">Who’s that Pokémon?</span>
            <span className="tile__meta">{score.asked > 0 ? `${accuracy}%` : 'New'}</span>
          </span>

          <span className="tile__figures">
            <span className="figure">
              <strong>{score.streak}</strong>
              <em>streak</em>
            </span>
            <span className="figure">
              <strong>{score.best}</strong>
              <em>best</em>
            </span>
            <span className="figure">
              <strong>{score.correct}</strong>
              <em>right</em>
            </span>
          </span>

          <span className="tile__foot">
            {score.asked > 0
              ? `${score.correct} of ${score.asked} answered`
              : 'Guess it from the shape alone.'}
          </span>
        </Link>

        {/* One at random, so the page has something in it worth looking at. */}
        {spotlight ? (
          <div className="tile tile--spotlight">
            <span className="tile__head">
              <span className="tile__title">Have you met</span>
              <button
                type="button"
                className="chip chip--ghost"
                onClick={() => setSpotlight(pickRandom(pokedex.pokemon))}
              >
                Another
              </button>
            </span>

            <Link className="spotlight" to={`/pokemon/${spotlight.name}`} viewTransition>
              <Sprite id={spotlight.id} alt={spotlight.name} shiny={shiny} size={150} priority />
              <span className="spotlight__body">
                <span className="spotlight__number">{dexNumber(spotlight.id)}</span>
                <span className="spotlight__name">{displayName(spotlight.name)}</span>
                <span className="spotlight__types">
                  {spotlight.types.map((type) => (
                    <TypeBadge key={type} type={type} />
                  ))}
                </span>
                <span className="spotlight__bst">{statTotal(spotlight.stats)} BST</span>
              </span>
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}
