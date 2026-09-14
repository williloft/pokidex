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

export type QuizMode = 'easy' | 'hard'

export const useQuizMode = createPreference<QuizMode>(
  'pokedex:quiz-mode',
  'easy',
  (raw) => (raw === 'easy' || raw === 'hard' ? raw : null),
  (value) => value,
)

/**
 * The four buttons in easy mode.
 *
 * Decoys are drawn from the target's own generation where possible: three
 * Pokémon from wildly different eras would make the answer obvious to anyone
 * who knows roughly when a design is from.
 */
export function pickChoices(
  pokemon: readonly Pokemon[],
  target: Pokemon,
  count = 4,
  roll: () => number = Math.random,
): Pokemon[] {
  const sameGeneration = pokemon.filter(
    (entry) => entry.id !== target.id && entry.generation === target.generation,
  )
  const fallback = pokemon.filter((entry) => entry.id !== target.id)
  const pool = sameGeneration.length >= count - 1 ? sameGeneration : fallback

  const decoys: Pokemon[] = []
  const seen = new Set<number>([target.id])

  for (let attempt = 0; attempt < pool.length * 4 && decoys.length < count - 1; attempt++) {
    const candidate = pool[Math.floor(roll() * pool.length)]
    if (!candidate || seen.has(candidate.id)) continue
    seen.add(candidate.id)
    decoys.push(candidate)
  }

  const choices = [target, ...decoys]

  // Fisher-Yates, so the answer is not always in the same slot.
  for (let index = choices.length - 1; index > 0; index--) {
    const swap = Math.floor(roll() * (index + 1))
    ;[choices[index], choices[swap]] = [choices[swap]!, choices[index]!]
  }

  return choices
}
