import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDex } from '../App'
import { PokemonSearchField } from '../components/PokemonSearchField'
import { Sprite } from '../components/Sprite'
import { TypeBadge } from '../components/TypeBadge'
import { dexNumber, displayName } from '../lib/pokedex'
import { EMPTY_SCORE, pickTarget, scoreAnswer, useQuizScore } from '../lib/quiz'
import type { Pokemon } from '../lib/types'
import { useDocumentTitle } from '../lib/useScrollRestoration'

interface Props {
  shiny: boolean
}

interface Answer {
  correct: boolean
  guess: Pokemon | null
}

export function QuizPage({ shiny }: Props) {
  const { pokedex } = useDex()
  const [score, setScore] = useQuizScore()
  useDocumentTitle('Who’s that Pokémon? · Pokédex')

  const [generations, setGenerations] = useState<number[]>([])
  const [target, setTarget] = useState<Pokemon | null>(null)
  const [answer, setAnswer] = useState<Answer | null>(null)

  const next = useCallback(() => {
    setTarget((previous) => pickTarget(pokedex.pokemon, { generations }, previous?.id ?? null))
    setAnswer(null)
  }, [pokedex.pokemon, generations])

  // First question, and a fresh one whenever the generation filter changes.
  useEffect(() => {
    next()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generations])

  const guess = (pokemon: Pokemon) => {
    if (!target || answer) return
    const correct = pokemon.id === target.id
    setAnswer({ correct, guess: pokemon })
    setScore(scoreAnswer(score, correct))
  }

  const skip = () => {
    if (!target) return
    setAnswer({ correct: false, guess: null })
    setScore(scoreAnswer(score, false))
  }

  const toggleGeneration = (id: number) => {
    setGenerations((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    )
  }

  const accuracy = score.asked > 0 ? Math.round((score.correct / score.asked) * 100) : 0

  return (
    <div className="quiz">
      <header className="quiz__header">
        <h1>Who’s that Pokémon?</h1>
        <p className="quiz__score">
          Streak <strong>{score.streak}</strong> · Best <strong>{score.best}</strong> ·{' '}
          {score.asked > 0 ? `${score.correct}/${score.asked} (${accuracy}%)` : 'No answers yet'}
        </p>
      </header>

      <div className="filters__row">
        <span className="filters__legend">Generation</span>
        <div className="chips">
          {pokedex.generations.map((generation) => (
            <button
              key={generation.id}
              type="button"
              className={`chip ${generations.includes(generation.id) ? 'chip--on' : ''}`}
              aria-pressed={generations.includes(generation.id)}
              onClick={() => toggleGeneration(generation.id)}
            >
              Gen {generation.id}
            </button>
          ))}
          {score.asked > 0 ? (
            <button type="button" className="chip chip--ghost" onClick={() => setScore(EMPTY_SCORE)}>
              Reset score
            </button>
          ) : null}
        </div>
      </div>

      {target ? (
        <section className={`quiz__stage ${answer ? 'quiz__stage--revealed' : ''}`}>
          <div className="quiz__art">
            <Sprite
              id={target.id}
              alt={answer ? target.name : 'Silhouette of a Pokémon'}
              shiny={shiny}
              size={320}
              priority
              className={answer ? '' : 'quiz__silhouette'}
            />
          </div>

          <div className="quiz__panel">
            {answer ? (
              <>
                <p className={`quiz__verdict ${answer.correct ? 'quiz__verdict--right' : ''}`}>
                  {answer.correct
                    ? 'Correct'
                    : answer.guess
                      ? `Not ${displayName(answer.guess.name)}`
                      : 'Skipped'}
                </p>

                <p className="quiz__number">{dexNumber(target.id)}</p>
                <h2>{displayName(target.name)}</h2>

                <div className="detail__types">
                  {target.types.map((type) => (
                    <TypeBadge key={type} type={type} size="md" />
                  ))}
                </div>

                <div className="quiz__actions">
                  <button type="button" className="button" onClick={next} autoFocus>
                    Next
                  </button>
                  <Link className="chip" to={`/pokemon/${target.name}`}>
                    Open entry
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="panel__note">
                  Start typing, then pick the one you think it is.
                </p>
                <PokemonSearchField
                  pokemon={pokedex.pokemon}
                  placeholder="Your guess…"
                  label="Guess the Pokémon"
                  onPick={guess}
                  clearOnPick
                  autoFocus
                />
                <button type="button" className="chip chip--ghost" onClick={skip}>
                  Skip
                </button>
              </>
            )}
          </div>
        </section>
      ) : (
        <p className="notice">No Pokémon match that generation filter.</p>
      )}
    </div>
  )
}
