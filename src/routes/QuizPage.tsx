import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDex } from '../App'
import { PokemonSearchField } from '../components/PokemonSearchField'
import { Sprite } from '../components/Sprite'
import { TypeBadge } from '../components/TypeBadge'
import { dexNumber, displayName } from '../lib/pokedex'
import {
  EMPTY_SCORE,
  pickChoices,
  pickTarget,
  scoreAnswer,
  useQuizMode,
  useQuizScore,
  type QuizMode,
} from '../lib/quiz'
import type { Pokemon } from '../lib/types'
import { useDocumentTitle } from '../lib/useScrollRestoration'

interface Props {
  shiny: boolean
}

interface Answer {
  correct: boolean
  guess: Pokemon | null
}

const MODES: Array<{ value: QuizMode; label: string; hint: string }> = [
  { value: 'easy', label: 'Easy', hint: 'Four names to choose from' },
  { value: 'hard', label: 'Hard', hint: 'Type the name yourself' },
]

export function QuizPage({ shiny }: Props) {
  const { pokedex } = useDex()
  const [score, setScore] = useQuizScore()
  const [mode, setMode] = useQuizMode()
  useDocumentTitle('Who’s that Pokémon? · Pokédex')

  const [generations, setGenerations] = useState<number[]>([])
  const [target, setTarget] = useState<Pokemon | null>(null)
  const [answer, setAnswer] = useState<Answer | null>(null)

  const next = useCallback(() => {
    setTarget((previous) => pickTarget(pokedex.pokemon, { generations }, previous?.id ?? null))
    setAnswer(null)
  }, [pokedex.pokemon, generations])

  useEffect(() => {
    next()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generations])

  // Re-rolled per question, and only built for the mode that needs them.
  const choices = useMemo(
    () => (mode === 'easy' && target ? pickChoices(pokedex.pokemon, target) : []),
    [mode, target, pokedex.pokemon],
  )

  const guess = (pokemon: Pokemon) => {
    if (!target || answer) return
    const correct = pokemon.id === target.id
    setAnswer({ correct, guess: pokemon })
    setScore(scoreAnswer(score, correct))
  }

  const skip = () => {
    if (!target || answer) return
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

      <div className="quiz__settings">
        <div className="chips">
          {MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`chip ${mode === option.value ? 'chip--on' : ''}`}
              aria-pressed={mode === option.value}
              title={option.hint}
              onClick={() => setMode(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

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
              size={460}
              priority
              className={answer ? '' : 'quiz__silhouette'}
            />
          </div>

          {answer ? (
            <div className="quiz__reveal">
              <p className={`quiz__verdict ${answer.correct ? 'quiz__verdict--right' : ''}`}>
                {answer.correct
                  ? 'Correct'
                  : answer.guess
                    ? `Not ${displayName(answer.guess.name)}`
                    : 'Skipped'}
              </p>

              <p className="quiz__number">{dexNumber(target.id)}</p>
              <h2>{displayName(target.name)}</h2>

              <div className="quiz__types">
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
            </div>
          ) : (
            <div className="quiz__answer">
              {mode === 'easy' ? (
                <ul className="quiz__choices">
                  {choices.map((choice) => (
                    <li key={choice.id}>
                      <button type="button" className="quiz__choice" onClick={() => guess(choice)}>
                        {displayName(choice.name)}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <PokemonSearchField
                  pokemon={pokedex.pokemon}
                  placeholder="Type your guess…"
                  label="Guess the Pokémon"
                  onPick={guess}
                  clearOnPick
                  autoFocus
                />
              )}

              <button type="button" className="chip chip--ghost" onClick={skip}>
                Skip
              </button>
            </div>
          )}
        </section>
      ) : (
        <p className="notice">No Pokémon match that generation filter.</p>
      )}
    </div>
  )
}
