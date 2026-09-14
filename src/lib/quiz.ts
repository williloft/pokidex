import { createPreference } from './preference'
import type { Pokemon } from './types'

export interface QuizFilters {
  /** Empty means every generation. */
  generations: number[]
}

/**
 * Pick the next silhouette.
 *
 * Avoids repeating whatever was just asked, so a narrow generation filter does
 * not show the same entry twice in a row.
 */
export function pickTarget(
  pokemon: readonly Pokemon[],
  filters: QuizFilters,
  previousId: number | null,
  random: () => number = Math.random,
): Pokemon | null {
  const pool =
    filters.generations.length > 0
      ? pokemon.filter((entry) => filters.generations.includes(entry.generation))
      : pokemon

  if (pool.length === 0) return null
  if (pool.length === 1) return pool[0]!

  const candidates = pool.filter((entry) => entry.id !== previousId)
  const source = candidates.length > 0 ? candidates : pool
  return source[Math.floor(random() * source.length)] ?? null
}

export interface QuizScore {
  streak: number
  best: number
  asked: number
  correct: number
}

export const EMPTY_SCORE: QuizScore = { streak: 0, best: 0, asked: 0, correct: 0 }

/** A right answer extends the streak; a wrong one ends it but still counts. */
export function scoreAnswer(score: QuizScore, wasCorrect: boolean): QuizScore {
  const streak = wasCorrect ? score.streak + 1 : 0
  return {
    streak,
    best: Math.max(score.best, streak),
    asked: score.asked + 1,
    correct: score.correct + (wasCorrect ? 1 : 0),
  }
}

const isScore = (value: unknown): value is QuizScore =>
  typeof value === 'object' &&
  value !== null &&
  ['streak', 'best', 'asked', 'correct'].every(
    (key) => typeof (value as Record<string, unknown>)[key] === 'number',
  )

export const useQuizScore = createPreference<QuizScore>(
  'pokedex:quiz',
  EMPTY_SCORE,
  (raw) => {
    try {
      const parsed: unknown = JSON.parse(raw)
      return isScore(parsed) ? parsed : null
    } catch {
      return null
    }
  },
  (value) => JSON.stringify(value),
)
