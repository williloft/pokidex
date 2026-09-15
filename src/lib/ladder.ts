import type { Difficulty } from './battle'
import { createPreference } from './preference'
import { TRAINERS, type TrainerBlueprint } from './trainers'

/** Who you have beaten, kept per difficulty. */
export type Ladder = Record<Difficulty, string[]>

export const EMPTY_LADDER: Ladder = { easy: [], normal: [], hard: [] }

const isLadder = (value: unknown): value is Ladder =>
  typeof value === 'object' &&
  value !== null &&
  (['easy', 'normal', 'hard'] as const).every((key) => {
    const entry = (value as Record<string, unknown>)[key]
    return Array.isArray(entry) && entry.every((id) => typeof id === 'string')
  })

/**
 * Progress through the trainer ladder.
 *
 * Kept per difficulty on purpose: clearing the run on Easy should not hand you
 * the whole of Hard, or the hardest tier would never actually be a run.
 */
export const useLadder = createPreference<Ladder>(
  'pokedex:ladder',
  EMPTY_LADDER,
  (raw) => {
    try {
      const parsed: unknown = JSON.parse(raw)
      return isLadder(parsed) ? parsed : null
    } catch {
      return null
    }
  },
  (value) => JSON.stringify(value),
)

export const withWin = (ladder: Ladder, difficulty: Difficulty, id: string): Ladder =>
  ladder[difficulty].includes(id)
    ? ladder
    : { ...ladder, [difficulty]: [...ladder[difficulty], id] }

export interface LadderStep {
  blueprint: TrainerBlueprint
  beaten: boolean
  /** Locked until the one before it has been beaten. */
  locked: boolean
  /** The last rung: beating this one clears the run. */
  champion: boolean
}

/**
 * The ladder in order, with each rung's state.
 *
 * One at a time, each unlocked by the one before it — so the trainers read as
 * a run you work through rather than twelve interchangeable opponents. The
 * last rung is the champion, which is where the legendary ace lives.
 */
export function ladderSteps(ladder: Ladder, difficulty: Difficulty): LadderStep[] {
  const beaten = new Set(ladder[difficulty])
  let previousCleared = true

  return TRAINERS.map((blueprint, index) => {
    const step: LadderStep = {
      blueprint,
      beaten: beaten.has(blueprint.id),
      locked: !previousCleared,
      champion: index === TRAINERS.length - 1,
    }
    previousCleared = step.beaten
    return step
  })
}

export const ladderProgress = (ladder: Ladder, difficulty: Difficulty) => ({
  beaten: new Set(ladder[difficulty].filter((id) => TRAINERS.some((t) => t.id === id))).size,
  total: TRAINERS.length,
})
