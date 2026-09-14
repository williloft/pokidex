import type { FormView, Pokemon, TypeChart } from './types'
import { effectiveness } from './typeChart'

export const BATTLE_LEVEL = 50

/** Power of the generic same-type attack every Pokémon is assumed to carry. */
const MOVE_POWER = 80
const STAB = 1.5

/**
 * Base stats to battle stats at level 50, neutral nature, no EVs or IVs.
 *
 * This is the baseline every damage calculator starts from, and it is the only
 * honest one here: we have base stats and nothing else, so inventing spreads
 * would be dressing guesses up as numbers.
 */
export const statAtLevel = (base: number, level = BATTLE_LEVEL): number =>
  Math.floor((2 * base * level) / 100) + 5

export const hpAtLevel = (base: number, level = BATTLE_LEVEL): number =>
  Math.floor((2 * base * level) / 100) + level + 10

export interface Battler {
  key: string
  pokemon: Pokemon
  view: FormView
  maxHp: number
  hp: number
}

export const makeBattler = (pokemon: Pokemon, view: FormView, key: string): Battler => {
  const maxHp = hpAtLevel(view.stats.hp)
  return { key, pokemon, view, maxHp, hp: maxHp }
}

export const isDown = (battler: Battler): boolean => battler.hp <= 0

/**
 * The attacking type a Pokémon would reach for: whichever of its own types
 * lands hardest on the target. With no move list, its own typing is the best
 * available stand-in, and it is what people picture anyway.
 */
export function chosenType(
  chart: TypeChart,
  attacker: readonly string[],
  defender: readonly string[],
): string {
  return [...attacker].sort(
    (a, b) => effectiveness(chart, b, defender) - effectiveness(chart, a, defender),
  )[0]!
}

export interface DamageResult {
  damage: number
  multiplier: number
  type: string
  /** True when the attack uses the special side of the stat spread. */
  special: boolean
}

/**
 * The mainline damage formula, minus everything we cannot know.
 *
 * No items, abilities, weather or criticals — just level, the relevant stats,
 * a fixed move power, same-type bonus and the type chart, with the usual
 * random spread so two identical turns are not identical.
 */
export function computeDamage(
  chart: TypeChart,
  attacker: Battler,
  defender: Battler,
  roll: () => number = Math.random,
): DamageResult {
  const type = chosenType(chart, attacker.view.types, defender.view.types)
  const multiplier = effectiveness(chart, type, defender.view.types)

  const special = attacker.view.stats['special-attack'] > attacker.view.stats.attack
  const attackStat = statAtLevel(
    special ? attacker.view.stats['special-attack'] : attacker.view.stats.attack,
  )
  const defenceStat = statAtLevel(
    special ? defender.view.stats['special-defense'] : defender.view.stats.defense,
  )

  const base =
    Math.floor(
      Math.floor((Math.floor((2 * BATTLE_LEVEL) / 5 + 2) * MOVE_POWER * attackStat) / defenceStat) /
        50,
    ) + 2

  const spread = 0.85 + roll() * 0.15
  const damage = multiplier === 0 ? 0 : Math.max(1, Math.floor(base * STAB * multiplier * spread))

  return { damage, multiplier, type, special }
}

export const speedOf = (battler: Battler): number => statAtLevel(battler.view.stats.speed)

/** Who acts first. Ties are broken by a coin flip, as in the games. */
export function firstMover(a: Battler, b: Battler, roll: () => number = Math.random): 'a' | 'b' {
  const speedA = speedOf(a)
  const speedB = speedOf(b)
  if (speedA === speedB) return roll() < 0.5 ? 'a' : 'b'
  return speedA > speedB ? 'a' : 'b'
}

export type Difficulty = 'easy' | 'normal' | 'hard'

/**
 * How well the opponent plays.
 *
 * Easy attacks and never thinks. Normal retreats when it is being walled.
 * Hard switches to whichever of its remaining Pokémon best answers yours,
 * which is the same reasoning the team page asks of you.
 */
export function chooseOpponentAction(
  chart: TypeChart,
  active: Battler,
  bench: readonly Battler[],
  target: Battler,
  difficulty: Difficulty,
  roll: () => number = Math.random,
): { kind: 'attack' } | { kind: 'switch'; to: Battler } {
  const available = bench.filter((member) => !isDown(member) && member.key !== active.key)
  if (available.length === 0 || difficulty === 'easy') return { kind: 'attack' }

  const score = (battler: Battler) =>
    effectiveness(chart, chosenType(chart, battler.view.types, target.view.types), target.view.types) -
    effectiveness(chart, chosenType(chart, target.view.types, battler.view.types), battler.view.types)

  const current = score(active)
  const best = [...available].sort((a, b) => score(b) - score(a))[0]!

  if (difficulty === 'normal') {
    // Only bail out of a genuinely bad spot, and not every single time.
    return current < -1 && score(best) > current && roll() < 0.6
      ? { kind: 'switch', to: best }
      : { kind: 'attack' }
  }

  return score(best) > current + 0.5 ? { kind: 'switch', to: best } : { kind: 'attack' }
}
