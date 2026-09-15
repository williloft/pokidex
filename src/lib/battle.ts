import { isBattleMove, type FormView, type Move, type MoveIndex, type Pokemon, type TypeChart } from './types'
import { effectiveness } from './typeChart'

export const BATTLE_LEVEL = 50

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

/**
 * The fallback when a Pokémon has nothing left to throw.
 *
 * Typeless in the games — it ignores the chart entirely rather than counting as
 * Normal — and it hurts the user. Without it, a Pokémon out of PP with no
 * healthy team-mate would leave the battle with no legal action at all.
 */
export const STRUGGLE: Move = {
  name: 'struggle',
  type: 'typeless',
  damageClass: 'physical',
  power: 50,
  accuracy: null,
  pp: 1,
  priority: 0,
  effect: 'Has no type and always connects. The user takes a quarter of the damage dealt.',
}

const STRUGGLE_RECOIL = 0.25

export interface MoveSlot {
  move: Move
  pp: number
  maxPp: number
}

export interface Battler {
  key: string
  pokemon: Pokemon
  view: FormView
  maxHp: number
  hp: number
  moves: MoveSlot[]
}

/**
 * Turn move names into usable slots.
 *
 * Names that are not in the move index are dropped rather than faked — a data
 * file older than the team that was saved against it should cost you a move,
 * not invent one. Status moves are dropped for the same reason there is no
 * button for them: nothing here can carry out what they do.
 */
export function resolveMoves(names: readonly string[], index: MoveIndex): MoveSlot[] {
  const slots: MoveSlot[] = []
  const seen = new Set<string>()

  for (const name of names) {
    const move = index[name]
    if (!move || seen.has(name) || !isBattleMove(move)) continue
    seen.add(name)
    slots.push({ move, pp: move.pp, maxPp: move.pp })
    if (slots.length === 4) break
  }

  return slots
}

export function makeBattler(
  pokemon: Pokemon,
  view: FormView,
  key: string,
  index: MoveIndex = {},
  chosen?: readonly string[] | null,
): Battler {
  const maxHp = hpAtLevel(view.stats.hp)
  let moves = resolveMoves(chosen ?? view.moves ?? [], index)

  /*
   * A form with no moveset of its own fights with the species'.
   *
   * Gigantamax forms are the case that matters: the API treats them as a look
   * rather than a Pokémon and returns an empty move list for every one of
   * them. The data build fills that in, but a dataset generated before it did
   * would otherwise send them out with nothing but Struggle.
   */
  if (moves.length === 0 && view.name !== pokemon.name) {
    moves = resolveMoves(pokemon.moves ?? [], index)
  }

  return { key, pokemon, view, maxHp, hp: maxHp, moves }
}

export const isDown = (battler: Battler): boolean => battler.hp <= 0

/** Moves it can still use. Empty means it is down to Struggle. */
export const usableMoves = (battler: Battler): MoveSlot[] =>
  battler.moves.filter((slot) => slot.pp > 0)

/** What this Pokémon will actually swing with for a given slot. */
export const moveAt = (battler: Battler, index: number): Move =>
  battler.moves[index]?.move ?? STRUGGLE

export interface DamageResult {
  damage: number
  multiplier: number
  move: Move
  /** Damage the attacker takes back. Only Struggle does this today. */
  recoil: number
}

/**
 * What this move is worth against these types.
 *
 * Struggle ignores the type chart rather than counting as a Normal move, so
 * even a Ghost takes full damage from it.
 */
export const moveEffectiveness = (
  chart: TypeChart,
  move: Move,
  defender: readonly string[],
): number => (move.name === STRUGGLE.name ? 1 : effectiveness(chart, move.type, defender))

const multiplierFor = moveEffectiveness

/**
 * The mainline damage formula, minus everything we cannot know.
 *
 * No items, abilities, weather or criticals — just level, the move, the
 * relevant stats, same-type bonus and the type chart, with the usual random
 * spread so two identical turns are not identical.
 */
export function computeDamage(
  chart: TypeChart,
  attacker: Battler,
  defender: Battler,
  move: Move,
  roll: () => number = Math.random,
): DamageResult {
  const multiplier = multiplierFor(chart, move, defender.view.types)
  const special = move.damageClass === 'special'

  const attackStat = statAtLevel(
    special ? attacker.view.stats['special-attack'] : attacker.view.stats.attack,
  )
  const defenceStat = statAtLevel(
    special ? defender.view.stats['special-defense'] : defender.view.stats.defense,
  )

  const base =
    Math.floor(
      Math.floor((Math.floor((2 * BATTLE_LEVEL) / 5 + 2) * move.power * attackStat) / defenceStat) /
        50,
    ) + 2

  const stab = attacker.view.types.includes(move.type) ? STAB : 1
  const spread = 0.85 + roll() * 0.15
  const damage = multiplier === 0 ? 0 : Math.max(1, Math.floor(base * stab * multiplier * spread))
  const recoil = move.name === STRUGGLE.name ? Math.max(1, Math.floor(damage * STRUGGLE_RECOIL)) : 0

  return { damage, multiplier, move, recoil: damage > 0 ? recoil : 0 }
}

/** A null accuracy means it never misses, and the games mean that literally. */
export function willHit(move: Move, roll: () => number = Math.random): boolean {
  if (move.accuracy === null) return true
  return roll() * 100 < move.accuracy
}

export const speedOf = (battler: Battler): number => statAtLevel(battler.view.stats.speed)

/**
 * Who acts first: move priority decides it, and only then speed. Ties are
 * broken by a coin flip, as in the games.
 */
export function firstMover(
  a: Battler,
  b: Battler,
  moveA: Move | null,
  moveB: Move | null,
  roll: () => number = Math.random,
): 'a' | 'b' {
  const priorityA = moveA?.priority ?? 0
  const priorityB = moveB?.priority ?? 0
  if (priorityA !== priorityB) return priorityA > priorityB ? 'a' : 'b'

  const speedA = speedOf(a)
  const speedB = speedOf(b)
  if (speedA === speedB) return roll() < 0.5 ? 'a' : 'b'
  return speedA > speedB ? 'a' : 'b'
}

export type Difficulty = 'easy' | 'normal' | 'hard'

/**
 * Roughly how much a move would take off, before the damage roll.
 *
 * Used to rank options rather than to report a number, so the constant factors
 * of the real formula are left out — only the parts that differ between moves
 * matter for the comparison.
 */
export function expectedDamage(
  chart: TypeChart,
  attacker: Battler,
  defender: Battler,
  move: Move,
): number {
  const multiplier = multiplierFor(chart, move, defender.view.types)
  if (multiplier === 0) return 0

  const special = move.damageClass === 'special'
  const attackStat = special ? attacker.view.stats['special-attack'] : attacker.view.stats.attack
  const defenceStat = special
    ? defender.view.stats['special-defense']
    : defender.view.stats.defense

  const stab = attacker.view.types.includes(move.type) ? STAB : 1
  const hitChance = (move.accuracy ?? 100) / 100

  return (move.power * attackStat * stab * multiplier * hitChance) / Math.max(1, defenceStat)
}

/** The slot index the opponent would pick, or -1 when it is down to Struggle. */
export function bestMoveIndex(
  chart: TypeChart,
  attacker: Battler,
  defender: Battler,
  difficulty: Difficulty,
  roll: () => number = Math.random,
): number {
  const usable = attacker.moves
    .map((slot, index) => ({ slot, index }))
    .filter((entry) => entry.slot.pp > 0)

  if (usable.length === 0) return -1

  // Easy swings with whatever it happens to have; it is not reading the chart.
  if (difficulty === 'easy') {
    return usable[Math.min(usable.length - 1, Math.floor(roll() * usable.length))]!.index
  }

  let best = usable[0]!
  let bestScore = -1
  for (const entry of usable) {
    const score = expectedDamage(chart, attacker, defender, entry.slot.move)
    if (score > bestScore) {
      bestScore = score
      best = entry
    }
  }
  return best.index
}

export type OpponentAction = { kind: 'move'; index: number } | { kind: 'switch'; to: Battler }

/** The moves a battler would actually pick from, Struggle included as a floor. */
const attackPool = (battler: Battler): Move[] => {
  const moves = usableMoves(battler).map((slot) => slot.move)
  return moves.length > 0 ? moves : [STRUGGLE]
}

/** The best multiplier one side can reach against the other. */
const bestMultiplier = (chart: TypeChart, attacker: Battler, defender: Battler): number =>
  Math.max(...attackPool(attacker).map((move) => moveEffectiveness(chart, move, defender.view.types)))

/**
 * How long a trainer sticks with what it has out before considering a switch.
 *
 * Without this the opponent mirrors you: you send something in, it answers on
 * the very next turn, and you can never establish a matchup. Real trainers
 * commit to what is on the field.
 */
const PATIENCE: Record<Difficulty, number> = { easy: Infinity, normal: 3, hard: 2 }

/** How often it takes a switch it has decided is available. */
const SWITCH_NERVE: Record<Difficulty, number> = { easy: 0, normal: 0.45, hard: 0.7 }

/**
 * How well the opponent plays.
 *
 * Easy picks a move at random and never retreats. Normal and Hard pick their
 * best move, and pull out only when the matchup has actually gone against them
 * — taking super-effective damage, or unable to get through what is in front
 * of them. Even then they will not switch two turns running, and even then it
 * is a coin weighted by difficulty rather than a certainty.
 *
 * `turnsSinceSwitch` is how long the current Pokémon has been out; a trainer
 * that has just sent something in does not immediately take it back.
 */
export function chooseOpponentAction(
  chart: TypeChart,
  active: Battler,
  bench: readonly Battler[],
  target: Battler,
  difficulty: Difficulty,
  roll: () => number = Math.random,
  turnsSinceSwitch = Number.POSITIVE_INFINITY,
): OpponentAction {
  const attack = (): OpponentAction => ({
    kind: 'move',
    index: bestMoveIndex(chart, active, target, difficulty, roll),
  })

  const available = bench.filter((member) => !isDown(member) && member.key !== active.key)
  if (available.length === 0 || difficulty === 'easy') return attack()

  // Just came in — see how it goes before thinking about leaving again.
  if (turnsSinceSwitch < PATIENCE[difficulty]) return attack()

  /*
   * Is this actually a bad spot, or merely not the best one available?
   *
   * Scoring every bench slot and taking the maximum meant switching whenever
   * anything was marginally better, which is how the opponent ended up
   * answering every move you made. The question is the one a player asks: am I
   * being hit hard, or am I failing to hit back?
   */
  const takingHeavy = bestMultiplier(chart, target, active) >= 2
  const wallSituation = bestMultiplier(chart, active, target) <= 0.5
  if (!takingHeavy && !wallSituation) return attack()

  if (roll() >= SWITCH_NERVE[difficulty]) return attack()

  /*
   * Only leave for something that improves the matchup.
   *
   * Judged against what is out rather than against a fixed bar: a trainer
   * built around one type shares its weakness across the whole team, and an
   * absolute test ("must not be weak to you") would mean such a trainer could
   * never switch at all.
   */
  const takes = (member: Battler) => bestMultiplier(chart, target, member)
  const gives = (member: Battler) => bestMultiplier(chart, member, target)
  const answers = available.filter(
    (member) => takes(member) < takes(active) || gives(member) > gives(active),
  )
  if (answers.length === 0) return attack()

  const threat = (attacker: Battler, defender: Battler) =>
    Math.max(...attackPool(attacker).map((move) => expectedDamage(chart, attacker, defender, move)))

  const score = (battler: Battler) => threat(battler, target) - threat(target, battler)
  const best = [...answers].sort((a, b) => score(b) - score(a))[0]!

  return score(best) > score(active) ? { kind: 'switch', to: best } : attack()
}
